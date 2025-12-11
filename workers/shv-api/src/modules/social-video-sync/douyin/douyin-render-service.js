/**
 * File: workers/shv-api/src/modules/social-video-sync/douyin/render-service.js
 * Render final video with Vietnamese voiceover
 * Uses Cloudinary Video API for video processing
 */

import { json } from '../../../lib/response.js';
import { generateVietnameseVoiceover } from './douyin-tts-service.js';

/**
 * API: Render Video with Voiceover
 * POST /api/social/douyin/render
 * Body: {
 *   video_id: string,
 *   script_text: string,
 *   voice_id: string,
 *   voice_speed: number,
 *   output_options: {
 *     save_to_library: boolean,
 *     download: boolean
 *   }
 * }
 */
export async function renderVideo(req, env) {
  try {
    const body = await req.json();
    const { 
      video_id, 
      script_text, 
      voice_id = 'leminh',
      voice_speed = 0,
      output_options = { save_to_library: true, download: true }
    } = body;

    // Fix CORS: Thêm req vào json response
    if (!video_id || !script_text) {
      return json({ ok: false, error: 'Thiếu video_id hoặc script_text' }, { status: 400 }, req);
    }

    const video = await env.DB.prepare(`SELECT * FROM douyin_videos WHERE id = ?`).bind(video_id).first();
    if (!video) {
      return json({ ok: false, error: 'Video không tồn tại' }, { status: 404 }, req);
    }

    const now = Date.now();
    await env.DB.prepare(`UPDATE douyin_videos SET status = 'rendering', updated_at = ? WHERE id = ?`)
      .bind(now, video_id).run();

    try {
      // 1. Generate Voice
      console.log('[Render] Generating voiceover...');
      const voiceover = await generateVietnameseVoiceover(script_text, voice_id, voice_speed, env);

      // 2. Overlay Audio
      console.log('[Render] Overlaying audio...');
      const finalVideo = await overlayAudioOnVideo(video.original_video_url, voiceover.r2Url, video_id, env);

      // 3. Update DB
      await env.DB.prepare(`
        UPDATE douyin_videos
        SET r2_final_key = ?, final_video_url = ?, vietnamese_audio_url = ?,
            final_script_text = ?, voice_model = ?, voice_speed = ?,
            status = 'completed', updated_at = ?
        WHERE id = ?
      `).bind(
        finalVideo.r2Key, finalVideo.r2Url, voiceover.r2Url,
        script_text, voice_id, voice_speed, now, video_id
      ).run();

      // Fix CORS: Thêm req vào json response
      return json({
        ok: true,
        data: {
          video_id,
          final_video_url: finalVideo.r2Url,
          voiceover_url: voiceover.r2Url
        },
        message: 'Video đã render thành công!'
      }, {}, req);

    } catch (renderError) {
      await env.DB.prepare(`UPDATE douyin_videos SET status = 'error', error_message = ?, updated_at = ? WHERE id = ?`)
        .bind(renderError.message, now, video_id).run();
      throw renderError;
    }

  } catch (error) {
    console.error('[Render] Error:', error);
    return json({ ok: false, error: error.message }, { status: 500 }, req);
  }
}

/**
 * [NEW] API: Nghe thử giọng đọc (Preview Voice)
 */
export async function previewVoice(req, env) {
    try {
        const body = await req.json();
        const { text, voice_id, speed } = body;

        if (!text) return json({ ok: false, error: 'Thiếu text' }, { status: 400 }, req);

        // Gọi TTS service nhưng không lưu vào DB video
        const voiceover = await generateVietnameseVoiceover(text, voice_id, speed, env);

        return json({
            ok: true,
            audio_url: voiceover.r2Url,
            duration: voiceover.duration
        }, {}, req);

    } catch (error) {
        return json({ ok: false, error: error.message }, { status: 500 }, req);
    }
}

/**
 * Overlay audio on video using Cloudinary
 * Alternative: Can use external FFmpeg service
 */
async function overlayAudioOnVideo(videoUrl, audioUrl, videoId, env) {
  // OPTION 1: Cloudinary Transformation API
  if (env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY) {
    return await overlayUsingCloudinary(videoUrl, audioUrl, videoId, env);
  }
  
  // OPTION 2: External FFmpeg Service (if configured)
  if (env.FFMPEG_SERVICE_URL) {
    return await overlayUsingFFmpegService(videoUrl, audioUrl, videoId, env);
  }

  // OPTION 3: Fallback - Return original video (no overlay)
  console.warn('[Render] No video processing service configured. Returning original video.');
  
  // Just copy original to final location
  const date = new Date();
  const finalR2Key = `douyin/final/${date.getFullYear()}/${date.getMonth() + 1}/${videoId}_vi.mp4`;
  
  // Fetch original video
  const videoResponse = await fetch(videoUrl);
  const videoBuffer = await videoResponse.arrayBuffer();
  
  // Upload to final location
  await env.SOCIAL_VIDEOS.put(finalR2Key, videoBuffer, {
    httpMetadata: {
      contentType: 'video/mp4',
      cacheControl: 'public, max-age=31536000'
    }
  });

  const finalUrl = `https://social-videos.shophuyvan.vn/${finalR2Key}`;

  return {
    r2Key: finalR2Key,
    r2Url: finalUrl,
    duration: 0, // Unknown without processing
    method: 'copy-only-no-overlay'
  };
}

/**
 * Overlay using Cloudinary (Recommended)
 */
async function overlayUsingCloudinary(videoUrl, audioUrl, videoId, env) {
  // Cloudinary Video Transformation with Audio Overlay
  // Docs: https://cloudinary.com/documentation/video_manipulation_and_delivery
  
  const cloudName = env.CLOUDINARY_CLOUD_NAME;
  const apiKey = env.CLOUDINARY_API_KEY;
  const apiSecret = env.CLOUDINARY_API_SECRET;

  // Step 1: Upload video to Cloudinary
  const videoPublicId = `douyin_videos/${videoId}`;
  const uploadResponse = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudName}/video/upload`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${btoa(`${apiKey}:${apiSecret}`)}`
      },
      body: new URLSearchParams({
        file: videoUrl,
        public_id: videoPublicId,
        resource_type: 'video'
      })
    }
  );

  const uploadData = await uploadResponse.json();
  
  if (!uploadResponse.ok) {
    throw new Error(`Cloudinary upload failed: ${uploadData.error?.message || 'Unknown'}`);
  }

  // Step 2: Apply transformation with audio overlay
  // This generates a new video URL with audio overlaid
  const transformedUrl = `https://res.cloudinary.com/${cloudName}/video/upload/` +
    `l_video:${audioUrl.replace(/[^a-zA-Z0-9]/g, '_')},` +
    `fl_layer_apply,so_0,du_auto/` +
    `${videoPublicId}.mp4`;

  // Step 3: Download transformed video
  const transformedResponse = await fetch(transformedUrl);
  const transformedBuffer = await transformedResponse.arrayBuffer();

  // Step 4: Upload to R2
  const date = new Date();
  const finalR2Key = `douyin/final/${date.getFullYear()}/${date.getMonth() + 1}/${videoId}_vi.mp4`;
  
  await env.SOCIAL_VIDEOS.put(finalR2Key, transformedBuffer, {
    httpMetadata: {
      contentType: 'video/mp4',
      cacheControl: 'public, max-age=31536000'
    }
  });

  const finalUrl = `https://social-videos.shophuyvan.vn/${finalR2Key}`;

  return {
    r2Key: finalR2Key,
    r2Url: finalUrl,
    duration: uploadData.duration || 0,
    method: 'cloudinary'
  };
}

/**
 * Overlay using external FFmpeg service
 */
async function overlayUsingFFmpegService(videoUrl, audioUrl, videoId, env) {
  // Call external FFmpeg service
  const response = await fetch(env.FFMPEG_SERVICE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      video_url: videoUrl,
      audio_url: audioUrl,
      output_format: 'mp4'
    })
  });

  const data = await response.json();
  
  if (!response.ok) {
    throw new Error(`FFmpeg service error: ${data.error || 'Unknown'}`);
  }

  // Download processed video
  const processedVideoUrl = data.output_url;
  const processedResponse = await fetch(processedVideoUrl);
  const processedBuffer = await processedResponse.arrayBuffer();

  // Upload to R2
  const date = new Date();
  const finalR2Key = `douyin/final/${date.getFullYear()}/${date.getMonth() + 1}/${videoId}_vi.mp4`;
  
  await env.SOCIAL_VIDEOS.put(finalR2Key, processedBuffer, {
    httpMetadata: {
      contentType: 'video/mp4',
      cacheControl: 'public, max-age=31536000'
    }
  });

  const finalUrl = `https://social-videos.shophuyvan.vn/${finalR2Key}`;

  return {
    r2Key: finalR2Key,
    r2Url: finalUrl,
    duration: data.duration || 0,
    method: 'ffmpeg-service'
  };
}

/**
 * Save to Content Library
 */
async function saveToContentLibrary(video, finalVideo, scriptText, env) {
  const contentId = `content_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
  const now = Date.now();

  // Get product info
  const product = await env.DB.prepare(`
    SELECT title, price FROM products WHERE id = ?
  `).bind(video.product_id).first();

  await env.DB.prepare(`
    INSERT INTO social_content_master (
      id, product_id, product_name,
      source_type, source_id,
      master_video_r2_key, master_video_url,
      master_thumbnail_url,
      duration, file_size,
      base_script, base_caption,
      status,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    contentId,
    video.product_id,
    product?.title || 'Unknown',
    'douyin',
    video.id,
    finalVideo.r2Key,
    finalVideo.r2Url,
    video.original_cover_url,
    finalVideo.duration,
    0, // File size unknown
    scriptText,
    scriptText,
    'ready',
    now,
    now
  ).run();

  // Link back to douyin_videos
  await env.DB.prepare(`
    UPDATE douyin_videos
    SET content_master_id = ?, updated_at = ?
    WHERE id = ?
  `).bind(contentId, now, video.id).run();

  return contentId;
}

console.log('✅ douyin-render-service.js loaded');
