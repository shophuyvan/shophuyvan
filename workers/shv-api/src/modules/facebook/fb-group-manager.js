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
  
  const formData = new FormData();
  formData.append('link', link);
  formData.append('message', message);
  formData.append('access_token', accessToken);

  const res = await fetch(url, {
    method: 'POST',
    body: formData
  });
  
  const data = await res.json();
  
  if (data.error) {
    throw new Error(`Group Share Error: ${data.error.message}`);
  }
  
  return {
    postId: data.id,
    success: true
  };
}