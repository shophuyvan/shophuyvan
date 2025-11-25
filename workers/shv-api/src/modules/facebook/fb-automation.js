// ===================================================================
// modules/facebook/fb-automation.js (UPGRADED v2)
// Tính năng: Ẩn comment SĐT, Auto Reply, Gửi Link Web
// ===================================================================

import { json } from '../../lib/response.js';
// Đã xóa getJSON vì dùng trực tiếp D1

/**
 * Hàm điều phối chính
 */
export async function handleFacebookAutomation(env, type, event, pageId) {
  try {
    // 1. ✅ Lấy Token & Cấu hình trực tiếp từ bảng fanpages (D1)
    // Không dùng KV config:fanpage:... nữa
    const pageRow = await env.DB.prepare(`
        SELECT access_token, auto_hide_phone, auto_reply_enabled, reply_template, website_link 
        FROM fanpages 
        WHERE page_id = ? AND is_active = 1
    `).bind(pageId).first();

    if (!pageRow || !pageRow.access_token) {
      console.error(`[Automation] ❌ Fanpage chưa được cấu hình hoặc Token rỗng: ${pageId}`);
      return;
    }

    // 2. Chuẩn bị config object từ dữ liệu D1
    const config = {
      enable_hide_phone: pageRow.auto_hide_phone === 1,
      enable_auto_reply: pageRow.auto_reply_enabled === 1,
      reply_messages: [pageRow.reply_template || "Shop đã inbox ạ!"],
      website_url: pageRow.website_link || 'https://shophuyvan.vn'
    };

    const pageToken = pageRow.access_token;

    if (type === 'feed') {
      await processComment(env, event, pageId, pageToken, config);
    }
  } catch(e) {
    console.error(`[Automation] Error: ${e.message}`);
  }
}

/**
 * Xử lý logic cho Comment
 */
async function processComment(env, event, pageId, pageToken, config) {
  const item = event.value;
  if (item.verb !== 'add' && item.verb !== 'edited') return;
  if (item.from.id === pageId) return; // Bỏ qua comment của chính Page

  const message = item.message || '';
  const commentId = item.comment_id || item.post_id;
  const userId = item.from.id;

  console.log(`[Auto] Comment: "${message}" | User: ${item.from.name}`);

 // 1. LOGIC ẨN SỐ ĐIỆN THOẠI
  if (config.enable_hide_phone && checkPhoneNumber(message)) {
    console.log('[Auto] 🚨 Phát hiện SĐT -> Ẩn comment');
    await hideComment(commentId, pageToken);
    // Gửi tin nhắn kín báo khách
    await sendPrivateMessage(commentId, pageToken, `Chào bạn, Shop đã ẩn SĐT để bảo mật thông tin. Nhân viên sẽ gọi lại ngay ạ! \nHoặc đặt nhanh tại: ${config.website_url}`);
    return; 
  }

  // 2. LOGIC AUTO REPLY & ĐIỀU HƯỚNG VỀ WEB
  if (config.enable_auto_reply) {
    // A. Reply công khai
    const randomReply = config.reply_messages[0]; // Lấy mẫu câu từ admin
    await replyToComment(commentId, pageToken, randomReply);

    // B. Gửi inbox kèm Link Web
    const privateMsg = `Chào ${item.from.name}, cảm ơn bạn đã quan tâm!\n\n👉 Xem chi tiết và ưu đãi tại Website: ${config.website_url}`;
    await sendPrivateMessage(commentId, pageToken, privateMsg);
  }
}

// --- CÁC HÀM HỖ TRỢ (HELPER FUNCTIONS) ---

function checkPhoneNumber(text) {
  const phoneRegex = /(\+84|0[3|5|7|8|9])+([0-9\s\.]){8,11}/g;
  return phoneRegex.test(text);
}

// API: Ẩn comment
async function hideComment(commentId, pageToken) {
  await callFbApi(commentId, 'POST', { is_hidden: true }, pageToken);
}

// API: Trả lời comment công khai
async function replyToComment(commentId, pageToken, message) {
  await callFbApi(`${commentId}/comments`, 'POST', { message: message }, pageToken);
}

// API: Gửi tin nhắn riêng qua comment (Private Reply)
// Lưu ý: Chỉ gửi được 1 lần cho mỗi comment
async function sendPrivateMessage(commentId, pageToken, messageText) {
  await callFbApi('me/messages', 'POST', {
    recipient: { comment_id: commentId },
    message: { text: messageText }
  }, pageToken);
}

// Hàm gọi Fetch chung
async function callFbApi(endpoint, method, body, token) {
  try {
    const url = `https://graph.facebook.com/v19.0/${endpoint}?access_token=${token}`;
    const res = await fetch(url, {
      method: method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const data = await res.json();
    if (data.error) {
      console.error(`[FB API Error] ${endpoint}:`, data.error.message);
    } else {
      console.log(`[FB API Success] ${endpoint}`);
    }
    return data;
  } catch (e) {
    console.error('[FB API Exception]', e);
  }
}