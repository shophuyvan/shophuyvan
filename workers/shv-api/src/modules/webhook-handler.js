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
// ===================================================================
// MINI APP WEBHOOK – Zalo Mini (kích hoạt tài khoản, sự kiện user...)
// ===================================================================

export async function handleMiniWebhook(req, env) {
  // Cho GET trả về đơn giản để bạn test trên trình duyệt
  if (req.method === 'GET') {
    console.log('[MiniWebhook] Health check via GET');
    return json(
      {
        ok: true,
        source: 'mini-webhook',
        msg: 'SHV Mini Webhook is alive'
      },
      {},
      req
    );
  }

  // Chỉ chấp nhận POST cho webhook "thật"
  if (req.method !== 'POST') {
    return errorResponse('Method Not Allowed', 405, req);
  }

  try {
    const body = await readBody(req);
    console.log('================ MINI WEBHOOK ================');
    console.log('[MiniWebhook] body:', JSON.stringify(body, null, 2));

    if (!body || typeof body !== 'object') {
      return json(
        { ok: true, message: 'No JSON payload, ignored' },
        {},
        req
      );
    }

    // Trích event, user, order từ payload (tên field tuỳ Zalo, nên bắt nhiều kiểu)
    const eventName = String(
      body.event ||
      body.event_name ||
      body.type ||
      body.action ||
      ''
    ).toLowerCase();

    const userId =
      body.user_id ||
      body.userId ||
      body.uid ||
      null;

    const orderId =
      body.order_id ||
      body.orderId ||
      body.order_id_zalo ||
      null;

    console.log('[MiniWebhook] event :', eventName || '(unknown)');
    console.log('[MiniWebhook] userId:', userId || '(none)');
    console.log('[MiniWebhook] orderId:', orderId || '(none)');

    // Xử lý nhóm sự kiện liên quan tài khoản (kích hoạt / liên kết...)
    await handleMiniAccountEvent(body, env, { eventName, userId });

    // Xử lý nhóm sự kiện có vẻ liên quan đơn / vận chuyển (tạm thời chỉ log)
    await handleMiniShippingEvent(body, env, { eventName, orderId });

    // Webhook luôn trả 200 cho Zalo
    return json({ ok: true }, {}, req);

  } catch (e) {
    console.error('[MiniWebhook] Exception:', e);
    return json({ ok: true, message: `Mini webhook processed with error: ${e.message}` }, {}, req);
  }
}

// -------------------------------------------------------------------
// Helper: xử lý sự kiện tài khoản (kích hoạt / liên kết / huỷ liên kết)
// -------------------------------------------------------------------

async function handleMiniAccountEvent(body, env, meta) {
  const { eventName, userId } = meta;

  if (!eventName) return;

  // Đây là chỗ bạn sẽ map đúng tên event sau khi xem log thực tế
  const looksLikeActivation =
    eventName.includes('activate') ||
    eventName.includes('activated') ||
    eventName.includes('account') ||
    eventName.includes('link') ||
    eventName.includes('verify');

  if (!looksLikeActivation) {
    return;
  }

  console.log('[MiniWebhook][Account] Có vẻ là event kích hoạt/linked account');

  if (!userId) {
    console.warn('[MiniWebhook][Account] Không có userId trong payload, chỉ log.');
    return;
  }

  try {
    const key = `miniuser:${userId}`;
    const now = new Date().toISOString();

    // Lấy bản cũ nếu có, rồi merge thêm
    const existing = await getJSON(env, key, null);
    const record = {
      ...(existing || {}),
      activated: true,
      user_id: userId,
      last_event: eventName,
      last_payload: body,
      updated_at: now
    };

    await putJSON(env, key, record);
    console.log('[MiniWebhook][Account] ✅ Đã lưu trạng thái kích hoạt cho user', userId);
  } catch (e) {
    console.error('[MiniWebhook][Account] Lỗi khi lưu KV:', e);
  }
}

// -------------------------------------------------------------------
// Helper: xử lý sự kiện liên quan đơn / vận chuyển từ Mini (nếu có)
// -------------------------------------------------------------------

async function handleMiniShippingEvent(body, env, meta) {
  const { eventName, orderId } = meta;

  if (!eventName && !orderId) return;

  const looksLikeShipping =
    eventName.includes('ship') ||
    eventName.includes('delivery') ||
    eventName.includes('transport') ||
    body.shipping_status ||
    body.order_status;

  if (!looksLikeShipping) {
    return;
  }

  console.log('[MiniWebhook][Shipping] Nhận event liên quan vận chuyển từ Mini App');
  console.log('[MiniWebhook][Shipping] Payload:', JSON.stringify(body, null, 2));

  // Hiện tại CHỈ LOG, không update đơn,
  // vì vận chuyển đã được SuperAI cập nhật qua handleSuperAIWebhook.
}

// ===================================================================
// FACEBOOK WEBHOOK HANDLER (Mới thêm)
// ===================================================================

import { handleFacebookAutomation } from './facebook/fb-automation.js'; // Chúng ta sẽ tạo file này ở bước sau

export async function handleFacebookWebhook(req, env) {
  const url = new URL(req.url);

  // -----------------------------------------------------------------
  // 1. XÁC THỰC (VERIFY TOKEN) - Facebook gọi GET để kiểm tra server
  // -----------------------------------------------------------------
  if (req.method === 'GET') {
    const mode = url.searchParams.get('hub.mode');
    const token = url.searchParams.get('hub.verify_token');
    const challenge = url.searchParams.get('hub.challenge');

    // Mã bí mật bạn tự đặt (khớp với lúc cài đặt trên FB Developer)
    // Tạm thời hardcode hoặc lấy từ env
    const VERIFY_TOKEN = env.FB_VERIFY_TOKEN || 'shophuyvan_secret_2025';

    if (mode && token) {
      if (mode === 'subscribe' && token === VERIFY_TOKEN) {
        console.log('[Facebook] Webhook verified success!');
        // QUAN TRỌNG: Phải trả về challenge dạng text thuần (không phải JSON)
        return new Response(challenge, { status: 200 });
      } else {
        console.warn('[Facebook] Verification failed. Token mismatch.');
        return new Response('Forbidden', { status: 403 });
      }
    }
    return new Response('Bad Request', { status: 400 });
  }

  // -----------------------------------------------------------------
  // 2. NHẬN SỰ KIỆN (EVENT HANDLING) - Facebook gửi POST dữ liệu
  // -----------------------------------------------------------------
  if (req.method === 'POST') {
    try {
      const body = await readBody(req);

      // Kiểm tra xem event có phải từ 'page' không
      if (body.object === 'page') {
        
        // Facebook có thể gửi nhiều entry cùng lúc
        for (const entry of body.entry) {
          const pageId = entry.id; // ID của Fanpage nhận tin

          // --- TRƯỜNG HỢP 1: TIN NHẮN (MESSAGING) ---
          if (entry.messaging) {
            for (const event of entry.messaging) {
              console.log('[Facebook] Inbox Event:', JSON.stringify(event));
              // Gọi logic xử lý tin nhắn (sẽ code ở file fb-automation.js)
              // await handleFacebookAutomation(env, 'message', event, pageId);
            }
          }

          // --- TRƯỜNG HỢP 2: BÌNH LUẬN / FEED (CHANGES) ---
          if (entry.changes) {
            for (const event of entry.changes) {
              // field = 'feed' là comment/post
              if (event.field === 'feed') {
                console.log('[Facebook] Feed Event:', JSON.stringify(event));
                // Gọi logic xử lý comment (ẩn, reply...)
                // await handleFacebookAutomation(env, 'feed', event, pageId);
              }
            }
          }
        }

        // Luôn trả về 'EVENT_RECEIVED' ngay lập tức
        return new Response('EVENT_RECEIVED', { status: 200 });
      }

      return new Response('Not a page event', { status: 404 });

    } catch (e) {
      console.error('[Facebook] Error processing webhook:', e);
      // Vẫn trả về 200 để FB không gửi lại liên tục nếu lỗi code
      return new Response('Error', { status: 200 });
    }
  }

  return errorResponse('Method Not Allowed', 405, req);
}

// ===================================================================
// ZALO MINI APP WEBHOOK (DATA DELETION & SIGNATURE VERIFY)
// ===================================================================

/**
 * Xử lý Webhook từ Zalo Mini App (Xóa dữ liệu / Rút quyền)
 * Tài liệu: https://mini.zalo.me/documents/open-apis/open/webhook-user-revocation/
 */
export async function handleZaloWebhook(req, env) {
  try {
    // 1. Chỉ nhận POST
    if (req.method !== 'POST') {
      return errorResponse('Method not allowed', 405, req);
    }

    // 2. Lấy Signature và Body
    const signature = req.headers.get('X-ZEvent-Signature');
    const body = await readBody(req); // Dùng hàm readBody có sẵn

    if (!signature) {
      return errorResponse('Missing signature', 400, req);
    }

    // 3. Kiểm tra bảo mật (Verify Signature)
    // Lấy API Key từ biến môi trường (Cần cấu hình trong wrangler.toml)
    const apiKey = env.ZALO_MINI_APP_API_KEY; 
    
    if (!apiKey) {
      console.warn('[Zalo Webhook] Missing ZALO_MINI_APP_API_KEY. Skipping verify (Test only).');
      // Nếu chưa có key thì tạm bỏ qua verify để không lỗi luồng, nhưng nên log cảnh báo
    } else {
      const isValid = await verifySignature(body, signature, apiKey);
      if (!isValid) {
        console.error('[Zalo Webhook] Invalid signature!');
        return errorResponse('Invalid signature', 401, req);
      }
    }

    // 4. Xử lý sự kiện
    const { event, userId, appId } = body;
    console.log(`[Zalo Webhook] Event: ${event} | User: ${userId} | App: ${appId}`);

    if (event === 'user.revoke.consent') {
      // SỰ KIỆN QUAN TRỌNG: Người dùng rút lại quyền
      console.log(`[Zalo Webhook] ⚠️ USER REVOKED CONSENT -> Cần xóa dữ liệu user ${userId}`);
      
      // TODO: Viết logic xóa dữ liệu trong DB của bạn tại đây
      // Ví dụ: await env.DB.prepare('DELETE FROM customers WHERE zalo_id = ?').bind(userId).run();
    }

    // Luôn trả về 200 OK cho Zalo
    return json({ message: 'ok' }, {}, req);

  } catch (error) {
    console.error('[Zalo Webhook] Error:', error);
    return errorResponse(error.message, 500, req);
  }
}

/**
 * Hàm kiểm tra chữ ký SHA256 theo tài liệu Zalo
 */
async function verifySignature(data, receivedSignature, apiKey) {
  try {
    // B1: Lấy danh sách keys và sắp xếp A-Z
    const keys = Object.keys(data).sort();
    
    // B2: Ghép các giá trị (values) thành 1 chuỗi content
    const content = keys.map(key => String(data[key])).join('');
    
    // B3: Tính hash = sha256(content + apiKey)
    const message = content + apiKey;
    const mySignature = await sha256(message);

    // B4: So sánh
    return mySignature.toLowerCase() === receivedSignature.toLowerCase();
  } catch (e) {
    console.error('Verify signature error:', e);
    return false;
  }
}

// Helper: Tính SHA256
async function sha256(text) {
  const msgBuffer = new TextEncoder().encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}