/**
 * TikTok Video Downloader (Updated v2)
 * Sử dụng TikWM API (JSON) thay cho SnapTik (HTML Scraping) để ổn định hơn
 */

export async function downloadTikTokVideo(tiktokUrl, env) {
  try {
    // 1. Lấy Video ID để đặt tên file
    const videoId = extractVideoId(tiktokUrl) || `tiktok_${Date.now()}`;
    
    // 2. Lấy Link Download từ TikWM (API trả về JSON)
    const downloadUrl = await getDownloadUrlFromTikWM(tiktokUrl);
    
    console.log(`[TikTok] Found download URL: ${downloadUrl}`);

    // 3. Tải Video về Worker (Buffer)
    const videoResponse = await fetch(downloadUrl);
    if (!videoResponse.ok) {
      throw new Error(`Failed to fetch video file: ${videoResponse.statusText}`);
    }
    
    const videoBlob = await videoResponse.arrayBuffer();
    const videoSize = videoBlob.byteLength;
    
    // 4. Upload lên R2
    // Cấu trúc: social-videos/YYYY/MM/videoId_timestamp.mp4
    const now = new Date();
    const timestamp = Date.now();
    const r2Path = `social-videos/${now.getFullYear()}/${now.getMonth() + 1}/${videoId}_${timestamp}.mp4`;
    
    await env.SOCIAL_VIDEOS.put(r2Path, videoBlob, {
      httpMetadata: {
        contentType: 'video/mp4',
        cacheControl: 'public, max-age=31536000'
      }
    });
    
    // 5. Generate Public URL
    // Lưu ý: Đảm bảo bạn đã map domain social-videos.shophuyvan.vn vào R2 bucket trong Dash Cloudflare
    const r2Url = `https://social-videos.shophuyvan.vn/${r2Path}`;
    
    return {
      success: true,
      videoId,
      r2Path,
      r2Url,
      fileSize: videoSize
    };
    
  } catch (error) {
    console.error('[TikTok Downloader] Error:', error);
    throw error;
  }
}

/**
 * Extract video ID (Hỗ trợ nhiều định dạng link)
 */
function extractVideoId(url) {
  try {
    // Case 1: Link video trực tiếp (tiktok.com/@user/video/123456)
    const idMatch = url.match(/\/video\/(\d+)/);
    if (idMatch) return idMatch[1];

    // Case 2: Link rút gọn (vt.tiktok.com/ZS...) - TikWM tự xử lý được, nhưng ta lấy ID tạm
    const shortMatch = url.match(/vt\.tiktok\.com\/(\w+)/);
    if (shortMatch) return shortMatch[1];
    
    return null;
  } catch (e) {
    return null;
  }
}

/**
 * Get Clean Video URL using TikWM API
 * Docs: https://www.tikwm.com/docs/
 */
async function getDownloadUrlFromTikWM(tiktokUrl) {
  const apiUrl = 'https://www.tikwm.com/api/';
  
  const formData = new FormData();
  formData.append('url', tiktokUrl);
  formData.append('count', 12);
  formData.append('cursor', 0);
  formData.append('web', 1);
  formData.append('hd', 1);

  const response = await fetch(apiUrl, {
    method: 'POST',
    body: formData
  });

  const data = await response.json();
  
  // TikWM trả về code: 0 là thành công
  if (!data || data.code !== 0) {
    throw new Error(`TikWM API Error: ${data.msg || 'Unknown error'}`);
  }

  // data.data.play là link mp4 không logo
  if (!data.data || !data.data.play) {
    throw new Error('TikWM did not return a video URL');
  }

  // Link của TikWM đôi khi là relative path, cần check
  let videoUrl = data.data.play;
  if (!videoUrl.startsWith('http')) {
    videoUrl = `https://www.tikwm.com${videoUrl}`;
  }

  return videoUrl;
}