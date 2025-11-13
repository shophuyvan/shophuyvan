// File: workers/shv-api/src/modules/channels.js
// Quản lý kênh TMDT: TikTok (sau này thêm Lazada / Shopee)

import { json } from '../lib/response.js';
import { verifyAdminAuth } from '../admin-handlers.js';

/**
 * Helper auth admin
 */
async function requireAdmin(req, env) {
  const r = await verifyAdminAuth(req, env);
  if (!r || !r.ok) {
    return {
      error: {
        ok: false,
        error: r?.error || 'Unauthorized',
        status: r?.status || 401,
      },
    };
  }
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
  // 4) PUBLIC: TikTok Shop - tạo kết nối
  //    /channels/tiktok/connect -> redirect sang TikTok auth link
  // ==========================================
  if (path === '/channels/tiktok/connect') {
    const authUrl = env.TIKTOK_SHOP_AUTH_URL;
    if (!authUrl) {
      // Thiếu cấu hình auth URL
      return json(
        { ok: false, error: 'missing_tiktok_auth_url' },
        { status: 500 },
        req
      );
    }

    // Chỉ đơn giản redirect thẳng sang link ủy quyền TikTok
    return Response.redirect(authUrl, 302);
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

  // Mặc định: không khớp route
  return json(
    { ok: false, error: 'channels_route_not_found' },
    { status: 404 },
    req
  );
}

