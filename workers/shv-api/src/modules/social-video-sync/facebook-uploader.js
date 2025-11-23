/**
 * Upload video lên Facebook Page
 * Sử dụng phương thức file_url để server Facebook tự tải từ R2
 */
export async function uploadToFacebookPage(pageId, videoUrl, caption, env) {
  try {
    // 1. Lấy Page Access Token từ DB (Giả sử bạn đã lưu trong bảng facebook_pages)
    // Nếu chưa có bảng này, bạn cần hardcode token tạm hoặc query từ bảng setting
    const pageData = await env.DB.prepare(
      "SELECT access_token FROM facebook_pages WHERE page_id = ?"
    ).bind(pageId).first();

    if (!pageData || !pageData.access_token) {
      throw new Error(`Không tìm thấy Access Token cho Page ID: ${pageId}`);
    }

    const pageAccessToken = pageData.access_token;

    // 2. Gọi Facebook Graph API (POST /videos)
    // Docs: https://developers.facebook.com/docs/video-api/guides/publishing
    const fbUrl = `https://graph-video.facebook.com/v19.0/${pageId}/videos`;
    
    const params = new URLSearchParams();
    params.append('access_token', pageAccessToken);
    params.append('file_url', videoUrl); // Facebook sẽ tự download từ R2
    params.append('description', caption);
    params.append('published', 'true'); // Đăng ngay lập tức

    const response = await fetch(fbUrl, {
      method: 'POST',
      body: params
    });

    const data = await response.json();

    if (!response.ok || data.error) {
      throw new Error(`Facebook Upload Error: ${JSON.stringify(data.error)}`);
    }

    return {
      success: true,
      postId: data.id,
      postUrl: `https://www.facebook.com/${data.id}` // URL dự kiến
    };

  } catch (error) {
    console.error('[Facebook Uploader] Error:', error);
    throw error;
  }
}