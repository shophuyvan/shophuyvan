// workers/shv-api/src/modules/shopee.js
// Shopee API Integration Module

import { json, corsHeaders } from '../lib/response.js';
import { adminOK } from '../lib/auth.js';

/**
 * Shopee API Configuration
 */
const SHOPEE_CONFIG = {
  // Test environment
  test: {
    host: 'https://partner.test-stable.shopeemobile.com',
    partnerId: '1197440',
    // Partner Key sẽ lấy từ env.SHOPEE_TEST_KEY
  },
  // Production environment
  live: {
    host: 'https://partner.shopeemobile.com',
    partnerId: '2013730',
    // Partner Key sẽ lấy từ env.SHOPEE_LIVE_KEY
  }
};

/**
 * Tạo chữ ký cho Shopee API request
 */
async function generateSignature(partnerId, path, timestamp, accessToken, shopId, partnerKey) {
  const baseString = `${partnerId}${path}${timestamp}${accessToken}${shopId}`;
  
  // ✅ Cloudflare Workers sử dụng Web Crypto API
  const encoder = new TextEncoder();
  const keyData = encoder.encode(partnerKey);
  const messageData = encoder.encode(baseString);
  
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, messageData);
  const hashArray = Array.from(new Uint8Array(signature));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Gọi Shopee API
 */
async function callShopeeAPI(env, method, path, shopData, params = null) {
  const isTest = shopData.env === 'test';
  const config = SHOPEE_CONFIG[shopData.env || 'live'];
  const partnerKey = isTest ? env.SHOPEE_TEST_KEY : env.SHOPEE_LIVE_KEY;
  
  if (!partnerKey) {
    throw new Error('Shopee partner key not configured');
  }

  const timestamp = Math.floor(Date.now() / 1000);
  const accessToken = shopData.access_token || '';
  const shopId = shopData.shop_id || '';
  
  const sign = await generateSignature(
    config.partnerId,
    path,
    timestamp,
    accessToken,
    shopId,
    partnerKey
  );

  const url = new URL(config.host + path);
  url.searchParams.set('partner_id', config.partnerId);
  url.searchParams.set('timestamp', timestamp);
  url.searchParams.set('sign', sign);
  url.searchParams.set('access_token', accessToken);
  url.searchParams.set('shop_id', shopId);

  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
    },
  };

  // ✅ XỬ LÝ PARAMS ĐÚNG CÁCH
  if (method === 'GET' && params) {
    // GET: params vào URL
    Object.keys(params).forEach(key => {
      url.searchParams.set(key, params[key]);
    });
  } else if ((method === 'POST' || method === 'PUT') && params) {
    // POST/PUT: params vào body
    options.body = JSON.stringify(params);
  }

  console.log('[Shopee API] Request:', method, path);
  const response = await fetch(url.toString(), options);
  const data = await response.json();
  
  console.log('[Shopee API] Response:', data);
  
  if (!response.ok || data.error) {
    throw new Error(data.message || data.error || 'Shopee API error');
  }

  return data;
}

/**
 * Lưu shop data vào KV
 */
async function saveShopData(env, shopId, data) {
  const key = `shopee:shop:${shopId}`;
  await env.SHV.put(key, JSON.stringify({
    ...data,
    updated_at: Date.now()
  }));
}

/**
 * Lấy shop data từ KV
 */
async function getShopData(env, shopId) {
  const key = `shopee:shop:${shopId}`;
  const data = await env.SHV.get(key);
  return data ? JSON.parse(data) : null;
}

/**
 * Lấy tất cả shops từ KV
 */
async function getAllShops(env) {
  const list = await env.SHV.list({ prefix: 'shopee:shop:' });
  const shops = [];
  
  for (const key of list.keys) {
    const data = await env.SHV.get(key.name);
    if (data) {
      shops.push(JSON.parse(data));
    }
  }
  
  return shops;
}

/**
 * Xóa shop khỏi KV
 */
async function deleteShopData(env, shopId) {
  const key = `shopee:shop:${shopId}`;
  await env.SHV.delete(key);
}

/**
 * Main request handler
 */
export async function handle(req, env, ctx) {
  const url = new URL(req.url);
  const path = url.pathname;
  const method = req.method;

  try {
    // ============================================
    // PUBLIC ROUTES - Auth flow
    // ============================================

    // Bước 1: Bắt đầu kết nối Shopee
    if (path === '/channels/shopee/connect' && method === 'GET') {
      const redirect = url.searchParams.get('redirect') || 'https://admin.shophuyvan.vn/channels.html';
      const env_type = url.searchParams.get('env') || 'live'; // test hoặc live
      
      const config = SHOPEE_CONFIG[env_type];
      const partnerKey = env_type === 'test' ? env.SHOPEE_TEST_KEY : env.SHOPEE_LIVE_KEY;
      
      if (!partnerKey) {
        return json({ ok: false, error: 'Shopee not configured' }, { status: 500 }, req);
      }

      const authPath = '/api/v2/shop/auth_partner';
      const timestamp = Math.floor(Date.now() / 1000);
      const sign = await generateSignature(config.partnerId, authPath, timestamp, '', '', partnerKey);

      const authUrl = new URL(config.host + authPath);
      authUrl.searchParams.set('partner_id', config.partnerId);
      authUrl.searchParams.set('timestamp', timestamp);
      authUrl.searchParams.set('sign', sign);
      authUrl.searchParams.set('redirect', `https://api.shophuyvan.vn/channels/shopee/callback?redirect=${encodeURIComponent(redirect)}&env=${env_type}`);

      return Response.redirect(authUrl.toString(), 302);
    }

    // Bước 2: Callback từ Shopee sau khi shop owner authorize
    if (path === '/channels/shopee/callback' && method === 'GET') {
      const code = url.searchParams.get('code');
      const shopId = url.searchParams.get('shop_id');
      const redirect = url.searchParams.get('redirect') || 'https://admin.shophuyvan.vn/channels.html';
      const env_type = url.searchParams.get('env') || 'live';

      if (!code || !shopId) {
        const errorUrl = new URL(redirect);
        errorUrl.searchParams.set('sp_status', 'error');
        errorUrl.searchParams.set('reason', 'missing_code_or_shop_id');
        return Response.redirect(errorUrl.toString(), 302);
      }

      try {
        const config = SHOPEE_CONFIG[env_type];
        const partnerKey = env_type === 'test' ? env.SHOPEE_TEST_KEY : env.SHOPEE_LIVE_KEY;

        // Lấy access token từ code
        const tokenPath = '/api/v2/auth/token/get';
        const timestamp = Math.floor(Date.now() / 1000);
        const sign = await generateSignature(config.partnerId, tokenPath, timestamp, '', '', partnerKey);

        const tokenUrl = new URL(config.host + tokenPath);
        tokenUrl.searchParams.set('partner_id', config.partnerId);
        tokenUrl.searchParams.set('timestamp', timestamp);
        tokenUrl.searchParams.set('sign', sign);

        const tokenResponse = await fetch(tokenUrl.toString(), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            code,
            shop_id: parseInt(shopId),
            partner_id: parseInt(config.partnerId)
          })
        });

        const tokenData = await tokenResponse.json();

        if (!tokenResponse.ok || tokenData.error || !tokenData.access_token) {
          console.error('[Shopee] Token error:', tokenData);
          const errorUrl = new URL(redirect);
          errorUrl.searchParams.set('sp_status', 'error');
          errorUrl.searchParams.set('reason', tokenData.message || 'token_error');
          return Response.redirect(errorUrl.toString(), 302);
        }

        // Lưu thông tin shop vào KV
        await saveShopData(env, shopId, {
          shop_id: shopId,
          partner_id: config.partnerId,
          access_token: tokenData.access_token,
          refresh_token: tokenData.refresh_token,
          expires_in: tokenData.expire_in,
          env: env_type,
          created_at: Date.now(),
          region: 'VN' // Mặc định Vietnam
        });

        // Redirect về admin với success
        const successUrl = new URL(redirect);
        successUrl.searchParams.set('sp_status', 'success');
        return Response.redirect(successUrl.toString(), 302);

      } catch (e) {
        console.error('[Shopee] Callback error:', e);
        const errorUrl = new URL(redirect);
        errorUrl.searchParams.set('sp_status', 'error');
        errorUrl.searchParams.set('reason', e.message || 'callback_error');
        return Response.redirect(errorUrl.toString(), 302);
      }
    }

    // ============================================
    // WEBHOOK - Nhận events từ Shopee
    // ============================================
    if (path === '/channels/shopee/webhook' && method === 'POST') {
      const body = await req.json();
      console.log('[Shopee Webhook] Received:', body);

      // Verify webhook signature
      const timestamp = req.headers.get('x-shopee-timestamp');
      const sign = req.headers.get('x-shopee-sign');
      
      // TODO: Implement signature verification
      
      // Xử lý các event types
      switch (body.event) {
        case 'order_status_update':
          // Đồng bộ đơn hàng khi có thay đổi
          console.log('[Shopee Webhook] Order updated:', body.data);
          // TODO: Implement order sync
          break;
          
        case 'product_update':
          // Đồng bộ sản phẩm khi có thay đổi
          console.log('[Shopee Webhook] Product updated:', body.data);
          // TODO: Implement product sync
          break;
          
        default:
          console.log('[Shopee Webhook] Unknown event:', body.event);
      }

      return json({ ok: true, message: 'Webhook received' }, {}, req);
    }

    // ============================================
    // ADMIN ROUTES - Yêu cầu auth
    // ============================================

// Check admin authentication
    const isAdmin = await adminOK(req, env);
    if (!isAdmin) {
      return json({ ok: false, error: 'Unauthorized' }, { status: 401 }, req);
    }

    // Lấy danh sách shops đã kết nối
    if (path === '/admin/shopee/shops' && method === 'GET') {
      const shops = await getAllShops(env);
      return json({ ok: true, shops }, {}, req);
    }

    // Ngắt kết nối shop
    if (path === '/admin/shopee/shops/disconnect' && method === 'DELETE') {
      const shopId = url.searchParams.get('shop_id');
      
      if (!shopId) {
        return json({ ok: false, error: 'missing_shop_id' }, { status: 400 }, req);
      }

      await deleteShopData(env, shopId);
      return json({ ok: true, message: 'Shop disconnected' }, {}, req);
    }

    // Đồng bộ sản phẩm
    if (path === '/admin/shopee/sync-products' && method === 'POST') {
      const body = await req.json();
      const shopId = body.shop_id;

      if (!shopId) {
        return json({ ok: false, error: 'missing_shop_id' }, { status: 400 }, req);
      }

      const shopData = await getShopData(env, shopId);
      if (!shopData) {
        return json({ ok: false, error: 'shop_not_found' }, { status: 404 }, req);
      }

      try {
        // Lấy danh sách sản phẩm từ Shopee
        const itemListPath = '/api/v2/product/get_item_list';
        const itemListData = await callShopeeAPI(env, 'GET', itemListPath, shopData, {
          offset: 0,
          page_size: 50,
          item_status: 'NORMAL' // ✅ PHẢI LÀ STRING, không phải array
        });

        const itemIds = itemListData.response?.item?.map(i => i.item_id) || [];
        
        if (itemIds.length === 0) {
          return json({ ok: true, total: 0, message: 'No products found' }, {}, req);
        }

        // Lấy chi tiết sản phẩm (tối đa 50 items/lần)
        const detailPath = '/api/v2/product/get_item_base_info';
        const detailData = await callShopeeAPI(env, 'GET', detailPath, shopData, {
          item_id_list: itemIds.slice(0, 50).join(','), // ✅ LIMIT 50
          need_tax_info: false,
          need_complaint_policy: false
        });

        const items = detailData.response?.item_list || [];
        
        // TODO: Lưu products vào database của hệ thống
        // Format: Convert Shopee product -> SHV product schema
        
        console.log('[Shopee] Synced products:', items.length);

        return json({
          ok: true,
          total: items.length,
          message: `Synced ${items.length} products`
        }, {}, req);

      } catch (e) {
        console.error('[Shopee] Sync products error:', e);
        return json({
          ok: false,
          error: e.message || 'sync_error'
        }, { status: 500 }, req);
      }
    }

    // Đồng bộ đơn hàng
    if (path === '/admin/shopee/sync-orders' && method === 'POST') {
      const body = await req.json();
      const shopId = body.shop_id;

      if (!shopId) {
        return json({ ok: false, error: 'missing_shop_id' }, { status: 400 }, req);
      }

      const shopData = await getShopData(env, shopId);
      if (!shopData) {
        return json({ ok: false, error: 'shop_not_found' }, { status: 404 }, req);
      }

      try {
        // Lấy danh sách đơn hàng trong 7 ngày qua
        const timeFrom = Math.floor(Date.now() / 1000) - (7 * 24 * 60 * 60);
        const timeTo = Math.floor(Date.now() / 1000);

        const orderListPath = '/api/v2/order/get_order_list';
        const orderListData = await callShopeeAPI(env, 'GET', orderListPath, shopData, {
          time_range_field: 'create_time',
          time_from: timeFrom,
          time_to: timeTo,
          page_size: 100,
          order_status: 'READY_TO_SHIP' // ✅ THÊM STATUS ĐỂ FILTER
        });

        const orderSns = orderListData.response?.order_list?.map(o => o.order_sn) || [];
        
        if (orderSns.length === 0) {
          return json({ ok: true, total: 0, message: 'No orders found' }, {}, req);
        }

        // Lấy chi tiết đơn hàng
        const detailPath = '/api/v2/order/get_order_detail';
        const detailData = await callShopeeAPI(env, 'POST', detailPath, shopData, {
          order_sn_list: orderSns
        });

        const orders = detailData.response?.order_list || [];
        
        // TODO: Lưu orders vào database của hệ thống
        // Format: Convert Shopee order -> SHV order schema
        
        console.log('[Shopee] Synced orders:', orders.length);

        return json({
          ok: true,
          total: orders.length,
          message: `Synced ${orders.length} orders`
        }, {}, req);

      } catch (e) {
        console.error('[Shopee] Sync orders error:', e);
        return json({
          ok: false,
          error: e.message || 'sync_error'
        }, { status: 500 }, req);
      }
    }

    // Route không khớp
    return json({ ok: false, error: 'route_not_found' }, { status: 404 }, req);

  } catch (e) {
    console.error('[Shopee] Handler error:', e);
    return json({
      ok: false,
      error: String(e?.message || e)
    }, { status: 500 }, req);
  }
}