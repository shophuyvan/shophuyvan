/**
 * Facebook Scheduler Handler
 * Xử lý Cron Job: Quét bài pending -> Đăng lên Page
 */

import { uploadToFacebookPage } from '../social-video-sync/facebook-uploader.js';

export async function publishScheduledPosts(env) {
  const now = Date.now();
  
  // 1A. Xử lý scheduled posts cho Fanpages (code cũ)
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

// Thêm hàm mới xử lý scheduled posts cho Groups
export async function publishScheduledGroupPosts(env) {
  const now = Date.now();
  
  // 1. Tìm các bài pending đến giờ đăng
  const { results: posts } = await env.DB.prepare(`
    SELECT * FROM scheduled_group_posts
    WHERE status = 'pending' 
      AND scheduled_time <= ?
    LIMIT 10
  `).bind(now).all();

  if (!posts.length) {
    return { count: 0, message: "No scheduled group posts due." };
  }

  const results = [];

  // 2. Import hàm shareToGroup
  const { shareToGroup } = await import('./fb-group-manager.js');

  // 3. Duyệt từng scheduled post
  for (const post of posts) {
    try {
      // Update status -> publishing
      await env.DB.prepare(
        "UPDATE scheduled_group_posts SET status='publishing' WHERE id=?"
      ).bind(post.id).run();

      // Lấy access token từ fanpage
      const pageRow = await env.DB.prepare(
        "SELECT access_token FROM fanpages WHERE page_id = ?"
      ).bind(post.fanpage_id).first();

      if (!pageRow?.access_token) {
        throw new Error('Fanpage token not found');
      }

      const groupIds = JSON.parse(post.group_ids || '[]');
      const postResults = [];

      // 4. Đăng vào từng group
      for (const groupId of groupIds) {
        try {
          const result = await shareToGroup(
            groupId,
            post.post_link,
            post.caption || '',
            pageRow.access_token
          );
          
          postResults.push({
            groupId,
            success: true,
            postId: result.postId,
            postUrl: result.postUrl
          });
        } catch (err) {
          postResults.push({
            groupId,
            success: false,
            error: err.message
          });
        }
      }

      // 5. Kiểm tra có group nào thành công không
      const hasSuccess = postResults.some(r => r.success);
      const status = hasSuccess ? 'published' : 'failed';

      // 6. Update DB
      await env.DB.prepare(`
        UPDATE scheduled_group_posts 
        SET status=?, published_at=?, results=?
        WHERE id=?
      `).bind(
        status,
        Date.now(),
        JSON.stringify(postResults),
        post.id
      ).run();

      results.push({ 
        id: post.id, 
        status, 
        fanpage: post.fanpage_name,
        groupCount: postResults.length,
        successCount: postResults.filter(r => r.success).length
      });

    } catch (error) {
      console.error(`Failed to publish group post ${post.id}:`, error);
      
      await env.DB.prepare(`
        UPDATE scheduled_group_posts 
        SET status='failed', error_message=?
        WHERE id=?
      `).bind(error.message, post.id).run();

      results.push({ 
        id: post.id, 
        status: 'failed', 
        error: error.message 
      });
    }
  }

  return { count: results.length, details: results };
}