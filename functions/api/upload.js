// functions/api/upload.js
export async function onRequestPost(context) {
  const { request, env } = context;
  
  // CORS Headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Table-Name',
  };

  try {
    // Get table name from header or default to 'gambar'
    const tableName = request.headers.get('X-Table-Name') || 'gambar';
    
    // Validate table name
    if (!/^[a-zA-Z0-9_]{1,50}$/.test(tableName)) {
      return Response.json({
        success: false,
        message: 'Invalid table name'
      }, { status: 400, headers: corsHeaders });
    }

    // Parse multipart form data
    const formData = await request.formData();
    const file = formData.get('file');
    
    if (!file || !file.name) {
      return Response.json({
        success: false,
        message: 'No file provided'
      }, { status: 400, headers: corsHeaders });
    }

    // File validation
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    const maxSize = 5 * 1024 * 1024; // 5MB
    
    if (!allowedTypes.includes(file.type)) {
      return Response.json({
        success: false,
        message: 'File type not allowed. Only JPEG, PNG, GIF, WEBP are allowed.'
      }, { status: 400, headers: corsHeaders });
    }
    
    if (file.size > maxSize) {
      return Response.json({
        success: false,
        message: 'File size too large. Maximum 5MB allowed.'
      }, { status: 400, headers: corsHeaders });
    }

    // Generate unique filename
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(2, 8);
    const fileExtension = file.name.split('.').pop();
    const uniqueFileName = `${timestamp}_${randomString}.${fileExtension}`;

    // Upload to R2
    await env.R2_BUCKET.put(uniqueFileName, file.stream(), {
      httpMetadata: {
        contentType: file.type,
      },
    });

    // Save to database
    const insertQuery = `
      INSERT INTO ${tableName} (x_01, x_02, x_03, x_04, x_05)
      VALUES (?, ?, ?, ?, ?)
    `;
    
    const result = await env.DB_LATIHAN1.prepare(insertQuery)
      .bind(
        uniqueFileName,        // x_01: filename
        file.name,            // x_02: original filename
        file.type,            // x_03: file type
        file.size,            // x_04: file size
        new Date().toISOString() // x_05: upload date
      )
      .run();

    return Response.json({
      success: true,
      table: tableName,
      data: {
        id: result.meta.last_row_id,
        filename: uniqueFileName,
        originalName: file.name,
        fileType: file.type,
        fileSize: file.size,
        uploadDate: new Date().toISOString(),
        url: `https://your-r2-domain.com/${uniqueFileName}` // sesuaikan dengan domain R2 Anda
      },
      message: 'File uploaded successfully'
    }, { headers: corsHeaders });

  } catch (error) {
    console.error('Upload error:', error);
    return Response.json({
      success: false,
      message: 'Upload failed',
      error: error.message,
      stack: error.stack
    }, { status: 500, headers: corsHeaders });
  }
}

// Handle OPTIONS request for CORS
export async function onRequestOptions(context) {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-Table-Name',
    },
  });
}