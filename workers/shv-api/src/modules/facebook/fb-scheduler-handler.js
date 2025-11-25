/**
 * Facebook Scheduler Handler
 * Xử lý Cron Job: Quét bài pending -> Đăng lên Page
 */

import { uploadToFacebookPage } from '../social-video-sync/facebook-uploader.js';

export async function publishScheduledPosts(env) {
  const now = Date.now();
  
  // 1. Tìm các bài đang 'pending' và đã đến giờ đăng
  const { results: assignments } = await env.DB.prepare(`
    SELECT 
      fa.id, fa.job_id, fa.fanpage_id, fa.fanpage_name, fa.variant_id,
      cv.caption, cv.hashtags,
      j.video_r2_url
    FROM fanpage_assignments fa
    JOIN content_variants cv ON fa.variant_id = cv.id
    JOIN automation_jobs j ON fa.job_id = j.id
    WHERE fa.status = 'pending' 
      AND fa.scheduled_time IS NOT NULL 
      AND fa.scheduled_time <= ?
    LIMIT 10
  `).bind(now).all();

  if (!assignments.length) {
    return { count: 0, message: "No scheduled posts due." };
  }

  const results = [];

  // 2. Duyệt qua từng bài để đăng
  for (const item of assignments) {
    try {
      // Update status -> publishing
      await env.DB.prepare("UPDATE fanpage_assignments SET status='publishing' WHERE id=?").bind(item.id).run();

      // Upload
      const fbResult = await uploadToFacebookPage(
        item.fanpage_id,
        item.video_r2_url,
        item.caption, // Caption đã bao gồm hashtags nếu được ghép trước đó
        env
      );

      // Success -> Update DB
      await env.DB.prepare(`
        UPDATE fanpage_assignments 
        SET status='published', post_id=?, post_url=?, published_at=?, updated_at=?
        WHERE id=?
      `).bind(fbResult.postId, fbResult.postUrl, Date.now(), Date.now(), item.id).run();

      // Cập nhật Job stats
      await env.DB.prepare(`
        UPDATE automation_jobs SET total_posts_published = total_posts_published + 1 WHERE id=?
      `).bind(item.job_id).run();

      results.push({ id: item.id, status: 'success', page: item.fanpage_name });

    } catch (error) {
      console.error(`Failed to publish assignment ${item.id}:`, error);
      
      // Failed -> Update DB
      await env.DB.prepare(`
        UPDATE fanpage_assignments 
        SET status='failed', error_message=?, updated_at=?
        WHERE id=?
      `).bind(error.message, Date.now(), item.id).run();

      results.push({ id: item.id, status: 'failed', error: error.message });
    }
  }

  return { count: results.length, details: results };
}