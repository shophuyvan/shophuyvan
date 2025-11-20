// ===================================================================
// modules/facebook/fb-automation.js
// Xử lý tự động: Ẩn comment chứa SĐT, Auto Reply
// ===================================================================

import { json } from '../../lib/response.js';
import { getJSON } from '../../lib/kv.js';

/**
 * Hàm điều phối chính được gọi từ WebhookHandler
 * @param {Object} env - Environment variables
 * @param {String} type - 'feed' (comment) hoặc 'message' (inbox)
 * @param {Object} event - Dữ liệu sự kiện từ Facebook
 * @param {String} pageId - ID của Fanpage nhận sự kiện
 */
export async function handleFacebookAutomation(env, type, event, pageId) {
  
  // 1. Xử lý Comment (Feed)
  if (type === 'feed') {
    await processComment(env, event, pageId);
  }

  // 2. Xử lý Inbox (Message) - Sẽ làm ở giai đoạn sau
  if (type === 'message') {
    // await processMessage(env, event, pageId);
    console.log('[Automation] Inbox message received (Logic pending)');
  }
}

/**
 * Xử lý logic cho Comment
 */
async function processComment(env, event, pageId) {
  const item = event.value;
  const verb = item.verb; // 'add', 'edited', 'remove'
  
  // Chỉ xử lý khi có comment mới hoặc comment được sửa
  if (verb !== 'add' && verb !== 'edited') return;
  
  // Bỏ qua nếu là post của chính Page (tránh loop vô tận)
  if (item.from.id === pageId) return;

  const message = item.message || '';
  const commentId = item.comment_id || item.post_id; // ID để thao tác ẩn/reply

  console.log(`[Automation] Checking comment: "${message}" from user ${item.from.name}`);

  // --- LOGIC 1: PHÁT HIỆN SỐ ĐIỆN THOẠI ---
  const hasPhoneNumber = checkPhoneNumber(message);

  if (hasPhoneNumber) {
    console.log('[Automation] 🚨 DETECTED PHONE NUMBER! Hiding comment...');
    await hideComment(env, commentId, pageId);
  } else {
    console.log('[Automation] Comment clean.');
  }
}

/**
 * Regex kiểm tra số điện thoại Việt Nam (đơn giản & hiệu quả)
 * Bắt các dạng: 0912345678, 0912.345.678, 0912 345 678, +84...
 */
function checkPhoneNumber(text) {
  // Regex bắt chuỗi số từ 9-12 ký tự, có thể chứa dấu cách hoặc chấm
  const phoneRegex = /(\+84|0[3|5|7|8|9])+([0-9\s\.]){8,11}/g;
  return phoneRegex.test(text);
}

/**
 * Gọi API Facebook để ẩn Comment
 */
async function hideComment(env, commentId, pageId) {
  try {
    // Lấy Page Access Token từ KV hoặc Env (Tạm thời dùng ENV cho nhanh)
    // Bạn cần đảm bảo FB_PAGE_ACCESS_TOKEN đã có trong file .dev.vars hoặc secrets
    const pageAccessToken = env.FB_PAGE_ACCESS_TOKEN; 
    
    if (!pageAccessToken) {
      console.error('[Automation] ❌ Missing FB_PAGE_ACCESS_TOKEN');
      return;
    }

    const url = `https://graph.facebook.com/v19.0/${commentId}`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        is_hidden: true,
        access_token: pageAccessToken
      })
    });

    const data = await response.json();
    
    if (data.success) {
      console.log(`[Automation] ✅ Successfully HIDDEN comment ${commentId}`);
    } else {
      console.error('[Automation] ❌ Failed to hide comment:', data);
    }

  } catch (e) {
    console.error('[Automation] Exception calling FB API:', e);
  }
}