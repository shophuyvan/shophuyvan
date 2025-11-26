/**
 * File: workers/shv-api/src/modules/social-video-sync/douyin/upload-handler.js
 * Xử lý upload video từ máy tính lên R2
 */

import { json } from '../../../lib/response.js';

/**
 * Generate ID ngắn gọn
 */
function generateId(prefix = 'douyin') {
  return prefix + '_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
}

/**
 * Extract video metadata (duration, resolution) từ binary
 * Simplified version - production nên dùng FFmpeg
 */
async function extractVideoMetadata(videoBuffer) {
  // Trong production environment, bạn cần dùng FFmpeg hoặc external service
  // Hiện tại return estimate based on file size
  const fileSizeMB = videoBuffer.byteLength / (1024 * 1024);
  
  // Estimate duration: ~1MB per 10 seconds of 1080p video
  const estimatedDuration = (fileSizeMB / 1) * 10;
  
  return {
    duration: Math.round(estimatedDuration),
    width: 1080,
    height: 1920,
    format: 'mp4',
    codec: 'h264'
  };
}

/**
 * Generate thumbnail từ video
 * Simplified - production nên dùng Cloudinary hoặc FFmpeg
 */
async function generateThumbnail(videoR2Key, env) {
  // Trong production, bạn sẽ:
  // 1. Dùng FFmpeg để extract frame đầu tiên
  // 2. Hoặc dùng Cloudinary transformation
  // 3. Upload thumbnail lên R2
  
  // Hiện tại return placeholder
  const thumbnailKey = videoR2Key.replace('.mp4', '_thumb.jpg');
  
  // TODO: Implement real thumbnail generation
  // For now, return key that will be generated later
  return thumbnailKey;
}

/**
 * API: Upload Video từ máy
 * POST /api/social/douyin/upload
 * Content-Type: multipart/form-data
 * Body: { files: File[], product_id: string }
 */
export async function uploadDouyinVideos(req, env) {
  try {
    // Parse multipart form data
    const formData = await req.formData();
    const productId = formData.get('product_id');
    
    if (!productId) {
      return json({ ok: false, error: 'Thiếu product_id' }, { status: 400 });
    }

    // Validate product exists
    const product = await env.DB.prepare(`
      SELECT id, title, price, shortDesc, images
      FROM products
      WHERE id = ?
    `).bind(productId).first();

    if (!product) {
      return json({ ok: false, error: 'Sản phẩm không tồn tại' }, { status: 404 });
    }

    // Get all files
    const files = [];
    for (const [key, value] of formData.entries()) {
      if (key === 'files' && value instanceof File) {
        files.push(value);
      }
    }

    if (files.length === 0) {
      return json({ ok: false, error: 'Không có file nào được upload' }, { status: 400 });
    }

    // Validate limits
    const MAX_FILES = 10;
    const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
    const MAX_TOTAL_SIZE = 500 * 1024 * 1024; // 500MB

    if (files.length > MAX_FILES) {
      return json({ 
        ok: false, 
        error: `Tối đa ${MAX_FILES} videos mỗi lần` 
      }, { status: 400 });
    }

    let totalSize = 0;
    const validFormats = ['video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/webm'];

    for (const file of files) {
      if (!validFormats.includes(file.type)) {
        return json({ 
          ok: false, 
          error: `File ${file.name} không đúng định dạng (chỉ chấp nhận MP4, MOV, AVI, WebM)` 
        }, { status: 400 });
      }

      if (file.size > MAX_FILE_SIZE) {
        return json({ 
          ok: false, 
          error: `File ${file.name} vượt quá 50MB` 
        }, { status: 400 });
      }

      totalSize += file.size;
    }

    if (totalSize > MAX_TOTAL_SIZE) {
      return json({ 
        ok: false, 
        error: 'Tổng dung lượng vượt quá 500MB' 
      }, { status: 400 });
    }

    // Process each file
    const uploadedVideos = [];
    const now = Date.now();

    for (const file of files) {
      const videoId = generateId('douyin');
      const fileBuffer = await file.arrayBuffer();
      
      // R2 key structure: douyin/uploads/YYYY/MM/videoId.mp4
      const date = new Date();
      const r2Key = `douyin/uploads/${date.getFullYear()}/${date.getMonth() + 1}/${videoId}.mp4`;
      
      // Upload to R2
      await env.SOCIAL_VIDEOS.put(r2Key, fileBuffer, {
        httpMetadata: {
          contentType: file.type,
          cacheControl: 'public, max-age=31536000'
        },
        customMetadata: {
          originalFilename: file.name,
          uploadedAt: now.toString(),
          productId: productId
        }
      });

      // Extract metadata
      const metadata = await extractVideoMetadata(fileBuffer);
      
      // Generate thumbnail (placeholder for now)
      const thumbnailKey = await generateThumbnail(r2Key, env);
      
      // Public URL (assuming custom domain setup)
      const r2Url = `https://social-videos.shophuyvan.vn/${r2Key}`;
      const thumbnailUrl = `https://social-videos.shophuyvan.vn/${thumbnailKey}`;

      // Insert into database
      await env.DB.prepare(`
        INSERT INTO douyin_videos (
          id, product_id, source_type, douyin_url,
          r2_original_key, original_video_url,
          r2_thumbnail_key, original_cover_url,
          file_size, original_filename, duration,
          metadata_json, status,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        videoId,
        productId,
        'upload',
        '', // No douyin URL for uploaded videos
        r2Key,
        r2Url,
        thumbnailKey,
        thumbnailUrl,
        file.size,
        file.name,
        metadata.duration,
        JSON.stringify(metadata),
        'uploaded', // Status: uploaded, ready for AI analysis
        now,
        now
      ).run();

      uploadedVideos.push({
        video_id: videoId,
        filename: file.name,
        size: file.size,
        duration: metadata.duration,
        thumbnail_url: thumbnailUrl,
        r2_key: r2Key,
        status: 'uploaded'
      });
    }

    return json({
      ok: true,
      product: {
        id: product.id,
        title: product.title,
        price: product.price
      },
      videos: uploadedVideos,
      message: `Đã upload thành công ${uploadedVideos.length} video(s)`
    });

  } catch (error) {
    console.error('[Douyin Upload] Error:', error);
    return json({ 
      ok: false, 
      error: error.message 
    }, { status: 500 });
  }
}

/**
 * API: Get uploaded videos by product
 * GET /api/social/douyin/uploads?product_id=123
 */
export async function getUploadedVideos(req, env) {
  try {
    const url = new URL(req.url);
    const productId = url.searchParams.get('product_id');

    if (!productId) {
      return json({ ok: false, error: 'Thiếu product_id' }, { status: 400 });
    }

    const { results: videos } = await env.DB.prepare(`
      SELECT 
        id, product_id, original_filename, file_size, duration,
        original_cover_url, status, created_at
      FROM douyin_videos
      WHERE product_id = ? AND source_type = 'upload'
      ORDER BY created_at DESC
    `).bind(productId).all();

    return json({
      ok: true,
      videos,
      total: videos.length
    });

  } catch (error) {
    console.error('[Douyin Get Uploads] Error:', error);
    return json({ 
      ok: false, 
      error: error.message 
    }, { status: 500 });
  }
}

console.log('✅ douyin-upload-handler.js loaded');
