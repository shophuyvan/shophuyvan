/**
 * TikTok Video Downloader
 * Downloads TikTok video without watermark and uploads to R2
 */

export async function downloadTikTokVideo(tiktokUrl, env) {
  try {
    // Extract video ID from URL
    const videoId = extractVideoId(tiktokUrl);
    if (!videoId) {
      throw new Error('Invalid TikTok URL');
    }
    
    // Option 1: Use SnapTik API (free, no auth needed)
    const downloadUrl = await getDownloadUrlFromSnapTik(tiktokUrl);
    
    // Download video
    const videoResponse = await fetch(downloadUrl);
    if (!videoResponse.ok) {
      throw new Error('Failed to download video');
    }
    
    const videoBlob = await videoResponse.arrayBuffer();
    const videoSize = videoBlob.byteLength;
    
    // Generate R2 path
    const timestamp = Date.now();
    const r2Path = `social-videos/${new Date().getFullYear()}/${new Date().getMonth() + 1}/${videoId}_${timestamp}.mp4`;
    
    // Upload to R2
    await env.SOCIAL_VIDEOS.put(r2Path, videoBlob, {
      httpMetadata: {
        contentType: 'video/mp4'
      }
    });
    
    // Generate public URL (if R2 bucket is public)
    const r2Url = `https://social-videos.shophuyvan.vn/${r2Path}`;
    
    return {
      success: true,
      videoId,
      r2Path,
      r2Url,
      fileSize: videoSize,
      duration: null // Will be extracted by Gemini
    };
    
  } catch (error) {
    console.error('[TikTok Downloader] Error:', error);
    throw error;
  }
}

/**
 * Extract video ID from TikTok URL
 */
function extractVideoId(url) {
  // Support formats:
  // https://www.tiktok.com/@user/video/1234567890
  // https://vt.tiktok.com/ZSxxxxx/
  // https://vm.tiktok.com/ZMxxxxx/
  
  const patterns = [
    /\/video\/(\d+)/,
    /\/v\/(\d+)/,
    /vt\.tiktok\.com\/(\w+)/,
    /vm\.tiktok\.com\/(\w+)/
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  
  return null;
}

/**
 * Get download URL from SnapTik
 * This is a simplified version - production should handle more edge cases
 */
async function getDownloadUrlFromSnapTik(tiktokUrl) {
  // SnapTik API endpoint (unofficial)
  const apiUrl = 'https://snaptik.app/abc2.php';
  
  const formData = new FormData();
  formData.append('url', tiktokUrl);
  formData.append('lang', 'en');
  
  const response = await fetch(apiUrl, {
    method: 'POST',
    body: formData
  });
  
  const html = await response.text();
  
  // Parse HTML to get download link (simplified - production needs better parsing)
  const match = html.match(/href="(https:\/\/[^"]+\.mp4[^"]*)"/);
  if (!match) {
    throw new Error('Could not find download URL');
  }
  
  return match[1];
}