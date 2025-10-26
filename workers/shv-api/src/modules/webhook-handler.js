// ===================================================================
// modules/webhook-handler.js - Xử lý Webhook từ SuperAI
// ===================================================================

import { json, errorResponse } from '../lib/response.js';
import { getJSON, putJSON } from '../lib/kv.js';
import { readBody } from '../lib/utils.js';

// Hàm xử lý chính khi SuperAI gọi webhook
export async function handleSuperAIWebhook(req, env) {
  // Chỉ chấp nhận phương thức POST
  if (req.method !== 'POST') {
    return errorResponse('Method Not Allowed', 405, req);
  }

  try {
    const body = await readBody(req);
    console.log('[Webhook] Received:', JSON.stringify(body, null, 2));

    // Kiểm tra cấu trúc cơ bản của webhook
    if (!body || body.type !== 'update_status' || !body.code || !body.status || !body.status_name) {
      console.warn('[Webhook] Invalid payload structure:', body);
      // Vẫn trả về 200 OK để SuperAI không gửi lại
      return json({ ok: true, message: 'Received, but ignored (invalid structure)' }, {}, req);
    }

    const superaiCode = body.code; // Mã đơn hàng SuperAI (CTOS...)
    const newStatus = String(body.status); // Mã trạng thái mới (số)
    const newStatusName = body.status_name; // Tên trạng thái mới

    // ----- Tìm đơn hàng trong KV -----
    const list = await getJSON(env, 'orders:list', []);
    let orderId = null;
    let orderIndex = -1;

    // Tìm trong danh sách dựa trên superai_code
    orderIndex = list.findIndex(o => o.superai_code === superaiCode);

    if (orderIndex === -1) {
      // Nếu không thấy, thử tìm theo tracking_code (có thể trước đó lưu nhầm)
      orderIndex = list.findIndex(o => o.tracking_code === superaiCode || o.shipping_tracking === superaiCode);
    }

    if (orderIndex === -1) {
      console.warn('[Webhook] Order not found in list for superai_code:', superaiCode);
      // Vẫn trả về 200 OK
      return json({ ok: true, message: 'Received, but order not found in list' }, {}, req);
    }

    orderId = list[orderIndex].id;

    // ----- Cập nhật trạng thái -----
    let updated = false;

    // 1. Cập nhật trong danh sách (orders:list)
    if (list[orderIndex].status !== newStatusName.toLowerCase()) {
      list[orderIndex].status = newStatusName.toLowerCase(); // Lưu tên trạng thái cho dễ đọc
      list[orderIndex].status_code_superai = newStatus; // Lưu cả mã trạng thái
      list[orderIndex].last_webhook_update = new Date().toISOString();
      updated = true;
      console.log(`[Webhook] Updating list for order ${orderId}: status -> ${newStatusName}`);
    }

    // 2. Cập nhật trong chi tiết đơn hàng (order:<id>)
    if (orderId) {
      const order = await getJSON(env, 'order:' + orderId, null);
      if (order && order.status !== newStatusName.toLowerCase()) {
        order.status = newStatusName.toLowerCase();
        order.status_code_superai = newStatus;
        order.last_webhook_update = new Date().toISOString();
        // Lưu thêm các thông tin khác từ webhook nếu cần
        order.webhook_history = order.webhook_history || [];
        order.webhook_history.push({
          status: newStatus,
          status_name: newStatusName,
          reason_code: body.reason_code,
          reason_text: body.reason_text,
          partial: body.partial,
          barter: body.barter,
          pushed_at: body.pushed_at,
          received_at: new Date().toISOString()
        });
        await putJSON(env, 'order:' + orderId, order);
        updated = true;
        console.log(`[Webhook] Updating detail for order ${orderId}: status -> ${newStatusName}`);
      } else if (!order) {
        console.warn('[Webhook] Order detail not found for ID:', orderId);
      }
    }

    // Lưu lại danh sách nếu có thay đổi
    if (updated) {
      await putJSON(env, 'orders:list', list);
    } else {
      console.log('[Webhook] No status change needed for superai_code:', superaiCode);
    }

    // Luôn trả về 200 OK cho SuperAI
    return json({ ok: true, message: 'Webhook processed successfully' }, {}, req);

  } catch (e) {
    console.error('[Webhook] Exception:', e);
    // Vẫn trả về 200 OK để SuperAI không bị lỗi và gửi lại liên tục
    return json({ ok: true, message: `Webhook processed with error: ${e.message}` }, {}, req);
  }
}