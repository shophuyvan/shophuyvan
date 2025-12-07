import { readBody } from '../../lib/utils.js';
import { json } from '../../lib/response.js';

// Tạo chữ ký Zalo
export async function createZaloSignature(data, secretKey) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', encoder.encode(secretKey), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(data));
  return Array.from(new Uint8Array(signature)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// Gửi CAPI Facebook
export async function sendToFacebookCAPI(order, req, env) {
  try {
    const PIXEL_ID = env.FB_PIXEL_ID || '1974425449800007';
    const ACCESS_TOKEN = env.FB_ACCESS_TOKEN || 'EAAMFNp9k5J8BP1pJbzABrkZB53sX4szb62Of0iu5QMetb51Eab2jkaVioGxxyuB6LG3EjXwSjaxZAAifrSLRgjZAh1unL59fjXN7V9CFGZAdT2FjmNNDYnusZCIraTW0Gax8UkpbUkzANmpFmGnG4rCyIGa8urhUipM0Q6G0WOnfOfUD6lb2N5S1JScCsgK13UgZDZD';
    if (!PIXEL_ID || !ACCESS_TOKEN) return;

    const hash = async (t) => {
      if (!t) return null;
      const b = new TextEncoder().encode(t);
      const h = await crypto.subtle.digest('SHA-256', b);
      return Array.from(new Uint8Array(h)).map(x => x.toString(16).padStart(2, '0')).join('');
    };

    const payload = {
      data: [{
        event_name: 'Purchase',
        event_time: Math.floor(Date.now() / 1000),
        action_source: 'website',
        event_source_url: 'https://shophuyvan.vn',
        event_id: order.id,
        user_data: {
          em: order.customer?.email ? await hash(order.customer.email.trim().toLowerCase()) : null,
          ph: order.customer?.phone ? await hash(order.customer.phone.replace(/\D/g, '')) : null,
          client_ip_address: req.headers.get('cf-connecting-ip'),
          client_user_agent: req.headers.get('user-agent')
        },
        custom_data: { currency: 'VND', value: Number(order.revenue || 0), content_type: 'product', content_ids: order.items.map(it => it.id || it.sku || it.product_id), num_items: order.items.length, order_id: order.id }
      }]
    };

    await fetch(`https://graph.facebook.com/v19.0/${PIXEL_ID}/events?access_token=${ACCESS_TOKEN}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  } catch (e) { console.error('[CAPI] Exception:', e); }
}

// Gửi Telegram
export async function sendOrderNotification(order, env, ctx) {
  const total = new Intl.NumberFormat('vi-VN').format(order.revenue || 0);
  const message = `📦 <b>ĐƠN HÀNG MỚI #${String(order.id).slice(-6).toUpperCase()}</b>\n👤 Khách: ${order.customer.name || 'Khách lẻ'}\n📞 SĐT: ${order.customer.phone || 'Không có'}\n💰 Tổng thu: <b>${total}đ</b>\n-----------------------\n${order.items.map(i => `- ${i.name} (x${i.qty})`).join('\n')}\n-----------------------\n📝 Ghi chú: ${order.note || 'Không'}`;

  const promises = [];
  if (env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHAT_ID) {
    promises.push(fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: env.TELEGRAM_CHAT_ID, text: message, parse_mode: 'HTML' }) }));
  }

  if (ctx && ctx.waitUntil) ctx.waitUntil(Promise.all(promises));
  else Promise.all(promises);
}

// Callback Zalo
export async function notifyZaloPayment(req, env) {
  try {
    const body = await readBody(req) || {};
    const { data, mac } = body;
    if (!data || !mac || !env.ZALO_PRIVATE_KEY) return json({ returnCode: 0, returnMessage: 'Missing config' }, {}, req);
    const calculatedMac = await createZaloSignature(data, env.ZALO_PRIVATE_KEY);
    if (calculatedMac !== mac) return json({ returnCode: 0, returnMessage: 'Invalid signature' }, {}, req);
    return json({ returnCode: 1, returnMessage: 'Success' }, {}, req);
  } catch (e) { return json({ returnCode: 0, returnMessage: 'Error' }, {}, req); }
}