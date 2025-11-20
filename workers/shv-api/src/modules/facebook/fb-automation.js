import { json, errorResponse } from '../../lib/response.js'; // Lưu ý ../../
import { readBody } from '../../lib/utils.js';

// Xác thực Webhook (Facebook gọi GET để verify)
export async function verifyWebhook(req, env) {
  const url = new URL(req.url);
  const mode = url.searchParams.get('hub.mode');
  const token = url.searchParams.get('hub.verify_token');
  const challenge = url.searchParams.get('hub.challenge');

  // Token này bạn tự đặt trong phần cài đặt App Facebook
  const VERIFY_TOKEN = env.FB_VERIFY_TOKEN || 'shv_fanpage_verify_123';

  if (mode && token) {
    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      console.log('WEBHOOK_VERIFIED');
      return new Response(challenge, { status: 200 });
    } else {
      return new Response('Forbidden', { status: 403 });
    }
  }
  return new Response('Bad Request', { status: 400 });
}

// Nhận sự kiện từ Facebook (Tin nhắn, Comment...)
export async function handleWebhookEvent(req, env) {
  try {
    const body = await readBody(req);
    
    if (body.object === 'page') {
      // Trả về 200 OK ngay lập tức để Facebook không gửi lại
      // Xử lý logic (async)
      const entries = body.entry || [];
      for (const entry of entries) {
        const webhook_event = entry.messaging ? entry.messaging[0] : null;
        if (webhook_event) {
          // Chạy ngầm xử lý sự kiện (không await để response nhanh)
          processEvent(webhook_event, env).catch(err => console.error('Process Event Error:', err));
        }
      }
      return new Response('EVENT_RECEIVED', { status: 200 });
    }
    return new Response('Not a page event', { status: 404 });
  } catch (e) {
    console.error('Webhook Error:', e);
    return new Response('Error', { status: 500 });
  }
}

// Logic xử lý tin nhắn (Internal)
async function processEvent(event, env) {
  const senderPsid = event.sender.id;
  console.log(`[FB-AUTO] Nhận event từ: ${senderPsid}`);

  if (event.message && event.message.text) {
    const text = event.message.text.toLowerCase();
    console.log(`[FB-AUTO] Nội dung: ${text}`);
    
    // TODO: Logic tự động trả lời sẽ viết ở đây (check DB fanpages xem có bật auto_reply không)
    // Ví dụ: Nếu khách nhắn "giá", "tư vấn" -> Gửi tin nhắn trả lời mẫu
  }
}