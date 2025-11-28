/**
 * Facebook Scheduler Handler
 * Xử lý Cron Job: Quét bài pending -> Đăng lên Page
 */

import { uploadToFacebookPage } from '../social-video-sync/facebook-uploader.js';
import { json, errorResponse } from '../../lib/response.js';

// --- 1. CẤU HÌNH KHUNG GIỜ VÀNG (Prime Time Slots) ---
const PRIME_TIME_SLOTS = [
  { start: 6, end: 8, label: 'Sáng sớm (6h-8h)' },
  { start: 11.5, end: 13, label: 'Nghỉ trưa (11h30-13h)' },
  { start: 17, end: 19, label: 'Tan tầm (17h-19h)' },
  { start: 20, end: 22.5, label: 'Buổi tối (20h-22h30)' }
];

function getRandomTimeInSlot(slot) {
  const now = new Date();
  const startHour = Math.floor(slot.start);
  const startMin = (slot.start % 1) * 60;
  const endHour = Math.floor(slot.end);
  const endMin = (slot.end % 1) * 60;

  const totalMinStart = startHour * 60 + startMin;
  const totalMinEnd = endHour * 60 + endMin;
  const randomTotalMin = Math.floor(Math.random() * (totalMinEnd - totalMinStart + 1)) + totalMinStart;

  const targetDate = new Date();
  targetDate.setHours(Math.floor(randomTotalMin / 60));
  targetDate.setMinutes(randomTotalMin % 60);
  targetDate.setSeconds(0);
  
  if (targetDate < now) {
      targetDate.setDate(targetDate.getDate() + 1);
  }
  return targetDate.getTime();
}

// --- 2. API LOGIC MỚI ---

// API: Lập lịch hàng loạt (Batch Schedule)
export async function scheduleBatchPosts(req, env) {
  try {
    const body = await req.json();
    const { jobId } = body;

    if (!jobId) return errorResponse('Missing jobId', 400, req);

    // Lấy danh sách Fanpage đã assign
    const { results: assignments } = await env.DB.prepare(`
        SELECT * FROM fanpage_assignments WHERE job_id = ? AND status = 'pending'
    `).bind(jobId).all();

    if (!assignments.length) return errorResponse('Không có bài nào ở trạng thái pending để lên lịch', 400, req);

    let scheduledCount = 0;
    const now = Date.now();

    for (let i = 0; i < assignments.length; i++) {
        // Phân bổ lần lượt vào các slot
        const slot = PRIME_TIME_SLOTS[i % PRIME_TIME_SLOTS.length];
        const time = getRandomTimeInSlot(slot);

        await env.DB.prepare(`
            UPDATE fanpage_assignments 
            SET status = 'scheduled', scheduled_time = ?, updated_at = ?
            WHERE id = ?
        `).bind(time, now, assignments[i].id).run();
        
        scheduledCount++;
    }

    // Update Job status
    await env.DB.prepare(`
        UPDATE automation_jobs SET status = 'scheduled', updated_at = ? WHERE id = ?
    `).bind(now, jobId).run();

    return json({ ok: true, count: scheduledCount, message: `Đã lên lịch tự động cho ${scheduledCount} bài viết` }, {}, req);
  } catch (e) {
    return errorResponse(e.message, 500, req);
  }
}

// API: Lấy danh sách bài Group đã lên lịch
export async function getScheduledGroupPosts(req, env) {
    try {
        const url = new URL(req.url);
        const fromDate = url.searchParams.get('from'); 
        const toDate = url.searchParams.get('to');
        const status = url.searchParams.get('status');

        let query = `
            SELECT * FROM scheduled_group_posts
            WHERE 1=1
        `;
        let params = [];

        if (status) {
            query += ` AND status = ?`;
            params.push(status);
        } else {
            query += ` AND status IN ('scheduled', 'failed', 'published', 'pending')`;
        }

        if (fromDate) {
            query += ` AND scheduled_time >= ?`;
            params.push(parseInt(fromDate));
        }
        
        if (toDate) {
            query += ` AND scheduled_time <= ?`;
            params.push(parseInt(toDate));
        }

        query += ` ORDER BY scheduled_time ASC LIMIT 50`;

        const { results } = await env.DB.prepare(query).bind(...params).all();
        return json({ ok: true, posts: results }, {}, req);
    } catch (e) {
        return errorResponse(e.message, 500, req);
    }
}
        let params = [];

        if (status) {
            query += ` AND fa.status = ?`;
            params.push(status);
        } else {
            query += ` AND fa.status IN ('scheduled', 'failed', 'published', 'pending')`;
        }

        if (fromDate) {
            query += ` AND fa.scheduled_time >= ?`;
            params.push(parseInt(fromDate));
        }
        
        if (toDate) {
            query += ` AND fa.scheduled_time <= ?`;
            params.push(parseInt(toDate));
        }

        query += ` ORDER BY fa.scheduled_time ASC LIMIT 50`;

        const { results } = await env.DB.prepare(query).bind(...params).all();
        return json({ ok: true, posts: results }, {}, req);
    } catch (e) {
        return errorResponse(e.message, 500, req);
    }
}

// API: Retry bài đăng bị lỗi
export async function retryFailedPost(req, env) {
    try {
        const { id } = await req.json(); // assignment_id
        if (!id) return errorResponse('Missing ID', 400, req);

        // Reset thời gian +5 phút để Cron Job quét lại
        const nextTry = Date.now() + 5 * 60 * 1000; 

        await env.DB.prepare(`
            UPDATE fanpage_assignments 
            SET status = 'scheduled', scheduled_time = ?, error_message = NULL, updated_at = ?
            WHERE id = ?
        `).bind(nextTry, Date.now(), id).run();

        return json({ ok: true, message: 'Đã đưa bài viết vào hàng đợi thử lại' }, {}, req);
    } catch (e) {
        return errorResponse(e.message, 500, req);
    }
}

// API: Lấy danh sách bài Group đã lên lịch
export async function getScheduledGroupPosts(req, env) {
    try {
        const url = new URL(req.url);
        const fromDate = url.searchParams.get('from'); 
        const toDate = url.searchParams.get('to');
        const status = url.searchParams.get('status');

        let query = `
            SELECT * FROM scheduled_group_posts
            WHERE 1=1
        `;
        let params = [];

        if (status) {
            query += ` AND status = ?`;
            params.push(status);
        } else {
            query += ` AND status IN ('scheduled', 'failed', 'published', 'pending')`;
        }

        if (fromDate) {
            query += ` AND scheduled_time >= ?`;
            params.push(parseInt(fromDate));
        }
        
        if (toDate) {
            query += ` AND scheduled_time <= ?`;
            params.push(parseInt(toDate));
        }

        query += ` ORDER BY scheduled_time ASC LIMIT 50`;

        const { results } = await env.DB.prepare(query).bind(...params).all();
        return json({ ok: true, posts: results }, {}, req);
    } catch (e) {
        return errorResponse(e.message, 500, req);
    }
}

// --- 3. CRON JOB HANDLERS (Giữ nguyên logic cũ của bạn) ---

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