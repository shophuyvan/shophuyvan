// workers/shv-api/src/modules/social-video-sync/threads-uploader.js

/**
 * Upload Video lên Threads (2 Bước: Tạo Container -> Publish)
 * @param {string} userId - Threads User ID
 * @param {string} videoUrl - URL video (R2)
 * @param {string} caption - Nội dung caption
 * @param {string} accessToken - Token của tài khoản Threads
 */
export async function uploadToThreads(userId, videoUrl, caption, accessToken) {
  try {
    // Bước 1: Tạo Media Container (Video)
    const createUrl = `https://graph.threads.net/v1.0/${userId}/threads`;
    const createParams = new URLSearchParams({
      media_type: 'VIDEO',
      video_url: videoUrl,
      text: caption,
      access_token: accessToken
    });

    const createRes = await fetch(createUrl, { method: 'POST', body: createParams });
    const createData = await createRes.json();

    if (!createRes.ok || !createData.id) {
      throw new Error(`Lỗi tạo Threads Container: ${JSON.stringify(createData)}`);
    }

    const containerId = createData.id;

    // Bước 2: Chờ xử lý (Threads cần thời gian download video)
    // Trong môi trường Worker, ta không thể sleep quá lâu, 
    // nhưng Threads thường xử lý video ngắn khá nhanh. Ta thử Publish luôn.
    // Nếu lỗi "Media not ready", cần cơ chế retry (ở đây làm đơn giản trước).
    
    // Đợi 5 giây (giả lập delay bằng loop - không khuyến khích nhưng worker hạn chế sleep)
    // await new Promise(r => setTimeout(r, 5000)); 

    // Bước 3: Publish Media
    const publishUrl = `https://graph.threads.net/v1.0/${userId}/threads_publish`;
    const publishParams = new URLSearchParams({
      creation_id: containerId,
      access_token: accessToken
    });

    const pubRes = await fetch(publishUrl, { method: 'POST', body: publishParams });
    const pubData = await pubRes.json();

    if (!pubRes.ok || !pubData.id) {
       // Nếu lỗi Media Not Ready, trả về thông báo để retry sau (TODO)
       throw new Error(`Lỗi Publish Threads: ${JSON.stringify(pubData)}`);
    }

    return {
      success: true,
      postId: pubData.id,
      postUrl: `https://www.threads.net/@${userId}/post/${pubData.id}` // Link dự kiến
    };

  } catch (e) {
    console.error('[Threads Upload]', e);
    return { success: false, error: e.message };
  }
}

// ============================================================
// SCHEDULER: TỰ ĐỘNG QUÉT VÀ ĐĂNG BÀI (Chạy bởi Cron)
// ============================================================
export async function publishScheduledThreads(env) {
  const now = Date.now();
  console.log('[Threads] ⏳ Checking scheduled posts...');

  try {
    // 1. Lấy Token Threads từ Settings
    const tokenRow = await env.DB.prepare("SELECT value FROM settings WHERE path = 'threads_access_token'").first();
    if (!tokenRow || !tokenRow.value) return;
    
    let threadsToken = tokenRow.value;
    try {
        const parsed = JSON.parse(tokenRow.value);
        if(parsed.access_token) threadsToken = parsed.access_token;
    } catch(e) {}

    // 2. Quét bài đến hạn từ bảng threads_assignments + JOIN bảng automation_jobs để lấy nội dung
    const { results } = await env.DB.prepare(`
      SELECT t.id as assign_id, j.ai_caption, j.r2_url, j.id as job_id
      FROM threads_assignments t
      JOIN automation_jobs j ON t.job_id = j.id
      WHERE t.status = 'pending' AND t.scheduled_time <= ?
    `).bind(now).all();

    if (!results || !results.length) return;

    // 3. Duyệt và đăng
    for (const post of results) {
      try {
        // Gọi hàm uploadToThreads (đã có ở phần trên của file này)
        const res = await uploadToThreads(threadsToken, 'me', post.r2_url, post.ai_caption, 'video');

        // Update thành công
        await env.DB.prepare("UPDATE threads_assignments SET status = 'published', post_id = ?, updated_at = ? WHERE id = ?")
          .bind(res.id || 'published', Date.now(), post.assign_id).run();
          
        console.log(`[Threads] ✅ Đăng thành công Job ${post.job_id}`);

      } catch (err) {
        console.error(`[Threads] ❌ Lỗi Job ${post.job_id}:`, err);
        // Update thất bại
        await env.DB.prepare("UPDATE threads_assignments SET status = 'failed', error_message = ?, updated_at = ? WHERE id = ?")
          .bind(err.message, Date.now(), post.assign_id).run();
      }
    }
  } catch (e) {
    console.error('[Threads] Scheduler error:', e);
  }
}