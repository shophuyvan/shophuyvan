/**
 * Facebook Group Manager Module
 * Hỗ trợ lấy danh sách nhóm và share bài viết
 */

export async function fetchGroupsFromFacebook(accessToken) {
  // Lưu ý: App phải được add vào Group hoặc User phải là Admin group
  const url = `https://graph.facebook.com/v19.0/me/groups?fields=id,name,privacy,icon&limit=100&access_token=${accessToken}`;
  
  const res = await fetch(url);
  const data = await res.json();
  
  if (data.error) {
    throw new Error(data.error.message);
  }
  
  return data.data || [];
}

export async function shareToGroup(groupId, link, message, accessToken) {
  // API đăng bài vào Group
  const url = `https://graph.facebook.com/v19.0/${groupId}/feed`;
  
  const body = new URLSearchParams();
  body.append('link', link);
  body.append('message', message);
  body.append('access_token', accessToken);

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: body.toString()
  });
  
  const data = await res.json();
  
  if (data.error) {
    throw new Error(`Group Share Error: ${data.error.message}`);
  }
  
  // Tạo URL để user kiểm tra bài đăng
  const postUrl = `https://www.facebook.com/${data.id.replace('_', '/posts/')}`;
  
  return {
    postId: data.id,
    postUrl: postUrl,
    success: true
  };
}

// Thêm hàm mới để lưu scheduled post vào DB
export async function saveScheduledGroupPost(env, postData) {
  const { fanpage_id, fanpage_name, group_ids, post_link, caption, scheduled_time } = postData;
  
  const result = await env.DB.prepare(`
    INSERT INTO scheduled_group_posts 
    (fanpage_id, fanpage_name, group_ids, post_link, caption, scheduled_time, status)
    VALUES (?, ?, ?, ?, ?, ?, 'pending')
  `).bind(
    fanpage_id,
    fanpage_name,
    JSON.stringify(group_ids),
    post_link,
    caption,
    scheduled_time
  ).run();
  
  return result.meta.last_row_id;
}

// Thêm hàm lấy danh sách scheduled posts
export async function getScheduledGroupPosts(env, filters = {}) {
  let query = `
    SELECT * FROM scheduled_group_posts 
    WHERE 1=1
  `;
  const bindings = [];
  
  if (filters.status) {
    query += ` AND status = ?`;
    bindings.push(filters.status);
  }
  
  if (filters.fanpage_id) {
    query += ` AND fanpage_id = ?`;
    bindings.push(filters.fanpage_id);
  }
  
  query += ` ORDER BY scheduled_time DESC LIMIT 100`;
  
  const { results } = await env.DB.prepare(query).bind(...bindings).all();
  
  return results.map(row => ({
    ...row,
    group_ids: JSON.parse(row.group_ids || '[]'),
    results: row.results ? JSON.parse(row.results) : null
  }));
}