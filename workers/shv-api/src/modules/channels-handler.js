// File: workers/shv-api/src/modules/channels-handler.js
// Quản lý kênh TMDT: TikTok (sau này thêm Lazada / Shopee)

import { json } from '../lib/response.js';
import { verifyAdminAuth } from '../admin-handlers.js';
import { buildOAuthURL, exchangeToken, loadLazadaShops, saveLazadaShops } from './lazada.js';
import { callLazadaAPI } from './lazada-api.js';


/**
 * Helper auth admin
 */
async function requireAdmin(req, env) {
  console.log('[Channels][requireAdmin] Starting auth check');
  
  const token = req.headers.get('x-token') || req.headers.get('authorization')?.replace('Bearer ', '');
  console.log('[Channels][requireAdmin] Token exists:', !!token);
  
  const r = await verifyAdminAuth(req, env);
  console.log('[Channels][requireAdmin] Auth result:', { ok: r?.ok, error: r?.error, hasAdmin: !!r?.admin });
  
  if (!r || !r.ok) {
    console.error('[Channels][requireAdmin] ❌ Auth failed:', r?.error || 'Unauthorized');
    return {
      error: {
        ok: false,
        error: r?.error || 'Unauthorized',
        status: r?.status || 401,
      },
    };
  }
  
  console.log('[Channels][requireAdmin] ✅ Auth success, admin:', r.admin.id);
  return { admin: r.admin };
}

/**
 * Đọc list shop TikTok từ KV
 */
async function loadTiktokShops(env) {
  const raw = await env.SHV.get('channels:tiktok:shops');
  if (!raw) return [];
  try {
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : [];
  } catch (e) {
    console.error('[Channels][TikTok] parse shops error:', e);
    return [];
  }
}

/**
 * Lưu list shop TikTok vào KV
 */
async function saveTiktokShops(env, shops) {
  await env.SHV.put('channels:tiktok:shops', JSON.stringify(shops || []));
}

/**
 * Handler chính
 */
export async function handle(req, env, ctx) {
  const url = new URL(req.url);
  const path = url.pathname;
  const method = req.method;
  
  console.log('[Channels] Handler called:', { method, path });

  // ===========================
  // 1) ADMIN: Lấy config TMDT
  // ===========================
  if (path === '/admin/channels/config' && method === 'GET') {
    const auth = await requireAdmin(req, env);
    if (auth.error) {
      return json(
        { ok: false, error: auth.error.error },
        { status: auth.error.status },
        req
      );
    }

    return json(
      {
        ok: true,
        platforms: {
          tiktok: {
            app_key: env.TIKTOK_SHOP_APP_KEY || '',
            region: env.TIKTOK_SHOP_REGION || 'VN',
            auth_url: env.TIKTOK_SHOP_AUTH_URL || '', // có thể để trống, FE cho nhập tay
          },
          lazada: {
            enabled: false,
          },
          shopee: {
            enabled: false,
          },
        },
      },
      {},
      req
    );
  }

  // ==========================================
  // 2) ADMIN: Lấy danh sách shop TikTok đã nối
  // ==========================================
  if (path === '/admin/channels/tiktok/shops' && method === 'GET') {
    const auth = await requireAdmin(req, env);
    if (auth.error) {
      return json(
        { ok: false, error: auth.error.error },
        { status: auth.error.status },
        req
      );
    }

    const shops = await loadTiktokShops(env);
    return json(
      {
        ok: true,
        shops,
        total: shops.length,
      },
      {},
      req
    );
  }

  // ==========================================
  // 3) ADMIN: Ngắt kết nối 1 shop TikTok
  //    (GET /admin/channels/tiktok/shops/disconnect?id=...)
  // ==========================================
  if (
    path === '/admin/channels/tiktok/shops/disconnect' &&
    method === 'GET'
  ) {
    const auth = await requireAdmin(req, env);
    if (auth.error) {
      return json(
        { ok: false, error: auth.error.error },
        { status: auth.error.status },
        req
      );
    }

    const id = url.searchParams.get('id');
    if (!id) {
      return json(
        { ok: false, error: 'missing_id' },
        { status: 400 },
        req
      );
    }

    const shops = await loadTiktokShops(env);
    const newShops = shops.filter((s) => s.id !== id);

    await saveTiktokShops(env, newShops);
    await env.SHV.delete(`channels:tiktok:shop:${id}`);

    return json(
      {
        ok: true,
        removed: id,
        total: newShops.length,
      },
      {},
      req
    );
  }

  // ==========================================
  // LAZADA: Lấy danh sách shops
  // ==========================================
  if (path === '/admin/channels/lazada/shops' && method === 'GET') {
    console.log('[Channels][Lazada] GET /admin/channels/lazada/shops - Handler reached');
    
    const auth = await requireAdmin(req, env);
    if (auth.error) {
      console.error('[Channels][Lazada] Auth check failed:', auth.error);
      return json(
        { ok: false, error: auth.error.error },
        { status: auth.error.status },
        req
      );
    }

    console.log('[Channels][Lazada] Auth passed, loading shops...');
    const shops = await loadLazadaShops(env);
    console.log('[Channels][Lazada] Loaded shops:', shops.length);
    return json(
      {
        ok: true,
        shops,
        total: shops.length,
      },
      {},
      req
    );
  }

  // ==========================================
  // LAZADA: Ngắt kết nối shop
  // ==========================================
  if (path === '/admin/channels/lazada/shops/disconnect' && method === 'GET') {
    const auth = await requireAdmin(req, env);
    if (auth.error) {
      return json(
        { ok: false, error: auth.error.error },
        { status: auth.error.status },
        req
      );
    }

    const id = url.searchParams.get('id');
    if (!id) {
      return json({ ok: false, error: 'missing_id' }, { status: 400 }, req);
    }

    const shops = await loadLazadaShops(env);
    const newShops = shops.filter((s) => s.id !== id);

    await saveLazadaShops(env, newShops);
    await env.SHV.delete(`channels:lazada:shop:${id}`);

    return json(
      {
        ok: true,
        removed: id,
        total: newShops.length,
      },
      {},
      req
    );
  }

  if (path === '/admin/channels/lazada/sync-products' && (method === 'POST' || method === 'GET')) {
    const auth = await requireAdmin(req, env);
    if (auth.error) {
      return json(
        { ok: false, error: auth.error.error },
        { status: auth.error.status },
        req
      );
    }

    // Support both POST (body) and GET (query param)
    let shopId;
    if (method === 'POST') {
      const body = await req.json();
      shopId = body.shop_id;
    } else {
      shopId = url.searchParams.get('shop_id');
    }

    if (!shopId) {
      return json({ ok: false, error: 'missing_shop_id' }, { status: 400 }, req);
    }

    try {
      // Call Lazada API để lấy products
      const result = await callLazadaAPI(env, shopId, '/products/get', {
        filter: 'all',
        offset: 0,
        limit: 100,
      });

      const products = result.data?.products || [];

      // Lưu vào KV (tạm thời, sau này có thể lưu vào D1)
      await env.SHV.put(
        `channels:lazada:${shopId}:products`,
        JSON.stringify(products)
      );

      return json(
        {
          ok: true,
          total: products.length,
          products: products.slice(0, 10), // Trả về 10 sản phẩm đầu
        },
        {},
        req
      );
    } catch (e) {
      console.error('[Lazada][Sync] error:', e);
      return json(
        { ok: false, error: e.message },
        { status: 500 },
        req
      );
    }
  }

      // 4) PUBLIC: TikTok Shop - tạo kết nối
  if (path === '/channels/tiktok/connect') {
    const authUrl = env.TIKTOK_SHOP_AUTH_URL;
    if (!authUrl) {
      return json(
        { ok: false, error: 'missing_tiktok_auth_url' },
        { status: 500 },
        req
      );
    }
    return Response.redirect(authUrl, 302);
  }

  // Lazada: CONNECT
  if (path === '/channels/lazada/connect') {
    try {
      const url = buildOAuthURL(env);
      return Response.redirect(url, 302);
    } catch (e) {
      console.error('[Lazada][Connect] error:', e);
      return json({ ok: false, error: e.message }, { status: 500 }, req);
    }
  }


  // ==========================================
  // 5) PUBLIC: TikTok Shop redirect về
  //    Redirect URL: https://api.shophuyvan.vn/channels/tiktok/callback
  // ==========================================
  if (path === '/channels/tiktok/callback') {
    const authCode =
      url.searchParams.get('auth_code') || url.searchParams.get('code');
    const state = url.searchParams.get('state') || '';

    const successRedirect =
      state ||
      env.TIKTOK_SHOP_SUCCESS_REDIRECT ||
      'https://admin.shophuyvan.vn/channels.html?tt_status=success';

    const failBase =
      env.TIKTOK_SHOP_FAIL_REDIRECT ||
      'https://admin.shophuyvan.vn/channels.html?tt_status=error';

    if (!authCode) {
      console.error('[TikTok] missing auth_code in callback');
      return Response.redirect(`${failBase}&reason=missing_code`, 302);
    }

    if (!env.TIKTOK_SHOP_APP_KEY || !env.TIKTOK_SHOP_APP_SECRET) {
      console.error('[TikTok] missing app_key/app_secret env');
      return Response.redirect(
        `${failBase}&reason=missing_app_config`,
        302
      );
    }

    const tokenUrl = new URL(
      '/api/v2/token/get',
      'https://auth.tiktok-shops.com'
    );
    tokenUrl.searchParams.set('app_key', env.TIKTOK_SHOP_APP_KEY);
    tokenUrl.searchParams.set('app_secret', env.TIKTOK_SHOP_APP_SECRET);
    tokenUrl.searchParams.set('auth_code', authCode);
    tokenUrl.searchParams.set('grant_type', 'authorized_code');

    let tokenData;
    try {
      const res = await fetch(tokenUrl.toString(), { method: 'GET' });
      tokenData = await res.json();
      console.log('[TikTok] token response:', JSON.stringify(tokenData));

      if (!res.ok) {
        console.error('[TikTok] token http error:', res.status);
        return Response.redirect(
          `${failBase}&reason=http_${res.status}`,
          302
        );
      }
    } catch (e) {
      console.error('[TikTok] token fetch error:', e);
      return Response.redirect(`${failBase}&reason=network_error`, 302);
    }

    const d = tokenData?.data || tokenData || {};
    const now = Date.now();

    const shopInfo = {
      platform: 'tiktok',
      id:
        d.shop_id ||
        d.shop_cipher ||
        d.seller_id ||
        `tiktok_${now}`,
      seller_id: d.seller_id || null,
      shop_cipher: d.shop_cipher || null,
      shop_name: d.shop_name || null,
      region:
        d.region ||
        d.shop_region ||
        url.searchParams.get('shop_region') ||
        env.TIKTOK_SHOP_REGION ||
        'VN',

      access_token: d.access_token || null,
      refresh_token: d.refresh_token || null,
      expires_at: d.access_token_expire_in
        ? now + d.access_token_expire_in * 1000
        : null,
      refresh_expires_at: d.refresh_token_expire_in
        ? now + d.refresh_token_expire_in * 1000
        : null,

      raw: tokenData,
      created_at: new Date(now).toISOString(),
      updated_at: new Date(now).toISOString(),
    };

    const shops = await loadTiktokShops(env);
    const idx = shops.findIndex((s) => s.id === shopInfo.id);
    if (idx >= 0) {
      shops[idx] = { ...shops[idx], ...shopInfo };
    } else {
      shops.push(shopInfo);
    }

    await saveTiktokShops(env, shops);
    await env.SHV.put(
      `channels:tiktok:shop:${shopInfo.id}`,
      JSON.stringify(shopInfo)
    );

    return Response.redirect(successRedirect, 302);
  }

    // Lazada CALLBACK
  if (path === '/channels/lazada/callback') {
    const code = url.searchParams.get('code');
    const failUrl =
      'https://admin.shophuyvan.vn/channels.html?lz_status=error';
    const okUrl =
      'https://admin.shophuyvan.vn/channels.html?lz_status=success';

    if (!code) {
      console.error('[Lazada][Callback] missing code');
      return Response.redirect(failUrl + '&reason=missing_code', 302);
    }

    try {
      const token = await exchangeToken(env, code);
      const now = Date.now();

      const shopId =
        token.country_user_info?.[0]?.seller_id ||
        token.seller_id ||
        token.user_id ||
        'lz_' + now;

      const shopInfo = {
        platform: 'lazada',
        id: shopId,
        country: token.country || null,
        access_token: token.access_token || null,
        refresh_token: token.refresh_token || null,
        expires_at: token.expires_in
          ? now + token.expires_in * 1000
          : null,
        raw: token,
        created_at: new Date(now).toISOString(),
        updated_at: new Date(now).toISOString(),
      };

      const shops = await loadLazadaShops(env);
      const idx = shops.findIndex((s) => s.id === shopInfo.id);
      if (idx >= 0) {
        shops[idx] = { ...shops[idx], ...shopInfo };
      } else {
        shops.push(shopInfo);
      }

      await saveLazadaShops(env, shops);

      return Response.redirect(okUrl, 302);
    } catch (e) {
      console.error('[Lazada][Callback] error:', e);
      return Response.redirect(
        failUrl + '&reason=' + encodeURIComponent(e.message || 'error'),
        302
      );
    }
  }

  // Mặc định: không khớp route
  return json(
    { ok: false, error: 'channels_route_not_found' },
    { status: 404 },
    req
  );
}