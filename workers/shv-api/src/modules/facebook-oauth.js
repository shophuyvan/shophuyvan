// File: workers/shv-api/src/modules/facebook-oauth.js
// Facebook OAuth 2.0 Handler - Authorization Flow & Token Management
// ===================================================================

import { json, errorResponse } from '../lib/response.js';
import { adminOK } from '../lib/auth.js';
import { getJSON, putJSON } from '../lib/kv.js';

/**
 * Main OAuth handler
 */
export async function handle(req, env, ctx) {
  const url = new URL(req.url);
  const path = url.pathname;
  const method = req.method;

  // Get OAuth authorization URL
  if (path === '/admin/facebook/oauth/authorize' && method === 'GET') {
    return getAuthorizationURL(req, env);
  }

  // OAuth callback handler
  if (path === '/admin/facebook/oauth/callback' && method === 'GET') {
    return handleOAuthCallback(req, env);
  }

  // Exchange short-lived token for long-lived token
  if (path === '/admin/facebook/oauth/exchange-token' && method === 'POST') {
    return exchangeToken(req, env);
  }

  // Get current token info & permissions
  if (path === '/admin/facebook/oauth/token-info' && method === 'GET') {
    return getTokenInfo(req, env);
  }

  // Revoke token
  if (path === '/admin/facebook/oauth/revoke' && method === 'POST') {
    return revokeToken(req, env);
  }

  return errorResponse('Route not found', 404, req);
}

// ===================================================================
// STEP 1: GET AUTHORIZATION URL
// ===================================================================

async function getAuthorizationURL(req, env) {
  if (!(await adminOK(req, env))) {
    return errorResponse('Unauthorized', 401, req);
  }

  try {
    // Load Facebook App credentials
    const settings = await getJSON(env, 'settings:facebook_ads', null) || {};
    const appId = settings.app_id || env.FB_APP_ID;

    if (!appId) {
      return json({
        ok: false,
        error: 'Chưa cấu hình Facebook App ID. Vui lòng vào Settings để cấu hình.'
      }, { status: 400 }, req);
    }

    // CRITICAL: Request the correct permissions
    const permissions = [
      'ads_management',        // Quản lý quảng cáo
      'ads_read',              // Đọc dữ liệu quảng cáo
      'business_management'    // Quản lý Business Manager
    ].join(',');

    // Redirect URI (phải match với Facebook App settings)
    // CRITICAL: Phải dùng API domain, không phải admin domain
    const apiBase = env.API_BASE_URL || 'https://api.shophuyvan.vn';
    const redirectUri = `${apiBase}/admin/facebook/oauth/callback`;

    // Build OAuth URL
    const authUrl = new URL('https://www.facebook.com/v19.0/dialog/oauth');
    authUrl.searchParams.set('client_id', appId);
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('scope', permissions);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('state', generateState()); // CSRF protection

    return json({
      ok: true,
      auth_url: authUrl.toString(),
      permissions: permissions.split(','),
      message: 'Vui lòng mở URL này để đăng nhập Facebook và cấp quyền'
    }, {}, req);

  } catch (e) {
    console.error('[OAuth] Get auth URL error:', e);
    return errorResponse(e, 500, req);
  }
}

/**
 * Generate random state for CSRF protection
 */
function generateState() {
  return 'state_' + Date.now() + '_' + Math.random().toString(36).slice(2, 15);
}

// ===================================================================
// STEP 2: HANDLE OAUTH CALLBACK
// ===================================================================

async function handleOAuthCallback(req, env) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  
  // Facebook có thể trả về error hoặc error_code
  const error = url.searchParams.get('error') || url.searchParams.get('error_code');
  const errorDescription = url.searchParams.get('error_description') || url.searchParams.get('error_message');

  // Check for errors
  if (error) {
    return new Response(
      `
      <!DOCTYPE html>
      <html>
      <head><title>OAuth Error</title></head>
      <body style="font-family: system-ui; padding: 50px; text-align: center;">
        <h1>❌ Đăng nhập thất bại</h1>
        <p style="color: #dc2626; font-size: 18px;">${error}: ${errorDescription || 'Unknown error'}</p>
        <p>Vui lòng thử lại hoặc liên hệ admin.</p>
        <a href="/admin/ads.html" style="display: inline-block; margin-top: 20px; padding: 12px 24px; background: #059669; color: white; text-decoration: none; border-radius: 8px;">← Quay lại trang Ads</a>
      </body>
      </html>
      `,
      { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    );
  }

  if (!code) {
    return new Response(
      `
      <!DOCTYPE html>
      <html>
      <head><title>OAuth Error</title></head>
      <body style="font-family: system-ui; padding: 50px; text-align: center;">
        <h1>❌ Thiếu authorization code</h1>
        <p>Vui lòng thử lại.</p>
        <a href="/admin/ads.html" style="display: inline-block; margin-top: 20px; padding: 12px 24px; background: #059669; color: white; text-decoration: none; border-radius: 8px;">← Quay lại trang Ads</a>
      </body>
      </html>
      `,
      { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    );
  }

  try {
    // Load Facebook App credentials
    const settings = await getJSON(env, 'settings:facebook_ads', null) || {};
    const appId = settings.app_id || env.FB_APP_ID;
    const appSecret = settings.app_secret || env.FB_APP_SECRET;

    if (!appId || !appSecret) {
      throw new Error('Chưa cấu hình Facebook App credentials');
    }

    const apiBase = env.API_BASE_URL || 'https://api.shophuyvan.vn';
    const redirectUri = `${apiBase}/admin/facebook/oauth/callback`;

    // Exchange code for access token
    const tokenUrl = new URL('https://graph.facebook.com/v19.0/oauth/access_token');
    tokenUrl.searchParams.set('client_id', appId);
    tokenUrl.searchParams.set('client_secret', appSecret);
    tokenUrl.searchParams.set('redirect_uri', redirectUri);
    tokenUrl.searchParams.set('code', code);

    const tokenResponse = await fetch(tokenUrl.toString());
    const tokenData = await tokenResponse.json();

    if (tokenData.error) {
      throw new Error(tokenData.error.message || 'Failed to get access token');
    }

    const accessToken = tokenData.access_token;

    // Get token info and permissions
    const tokenInfo = await getDebugTokenInfo(accessToken, appId, appSecret);

    // Exchange for long-lived token (60 days)
    const longLivedToken = await exchangeForLongLivedToken(accessToken, appId, appSecret);

    // Get user info
    const userInfo = await getUserInfo(longLivedToken);

    // Save to KV
    const fbSettings = await getJSON(env, 'settings:facebook_ads', {}) || {};
    fbSettings.access_token = longLivedToken;
    fbSettings.token_type = tokenData.token_type || 'bearer';
    fbSettings.token_expires_at = Date.now() + (tokenInfo.expires_in * 1000);
    fbSettings.user_id = tokenInfo.user_id;
    fbSettings.user_name = userInfo.name;
    fbSettings.scopes = tokenInfo.scopes || [];
    fbSettings.updated_at = new Date().toISOString();

    await putJSON(env, 'settings:facebook_ads', fbSettings);

    // Success response
    return new Response(
      `
      <!DOCTYPE html>
      <html>
      <head>
        <title>OAuth Success</title>
        <style>
          body { font-family: system-ui; padding: 50px; text-align: center; }
          .success-box { max-width: 600px; margin: 0 auto; padding: 30px; background: #d1fae5; border-radius: 12px; }
          h1 { color: #065f46; }
          .info { background: white; padding: 15px; border-radius: 8px; margin: 20px 0; text-align: left; }
          pre { background: #f9fafb; padding: 10px; border-radius: 6px; overflow-x: auto; }
          a { display: inline-block; margin-top: 20px; padding: 12px 24px; background: #059669; color: white; text-decoration: none; border-radius: 8px; font-weight: 600; }
          a:hover { background: #047857; }
        </style>
      </head>
      <body>
        <div class="success-box">
          <h1>✅ Đăng nhập Facebook thành công!</h1>
          <div class="info">
            <strong>👤 User:</strong> ${userInfo.name}<br>
            <strong>🔑 Token expires:</strong> ${new Date(fbSettings.token_expires_at).toLocaleString('vi-VN')}<br>
            <strong>✅ Permissions:</strong><br>
            <pre>${tokenInfo.scopes.join('\n')}</pre>
          </div>
          <p>Access token đã được lưu vào hệ thống. Bạn có thể quay lại trang Ads để sử dụng.</p>
          <a href="/admin/ads.html">🚀 Quay lại trang Ads</a>
        </div>
        <script>
          // Auto close và reload parent window sau 3s
          setTimeout(() => {
            if (window.opener) {
              window.opener.location.reload();
              window.close();
            } else {
              window.location.href = '/admin/ads.html';
            }
          }, 3000);
        </script>
      </body>
      </html>
      `,
      { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    );

  } catch (e) {
    console.error('[OAuth] Callback error:', e);
    return new Response(
      `
      <!DOCTYPE html>
      <html>
      <head><title>OAuth Error</title></head>
      <body style="font-family: system-ui; padding: 50px; text-align: center;">
        <h1>❌ Lỗi xử lý callback</h1>
        <p style="color: #dc2626;">${e.message}</p>
        <a href="/admin/ads.html" style="display: inline-block; margin-top: 20px; padding: 12px 24px; background: #059669; color: white; text-decoration: none; border-radius: 8px;">← Quay lại trang Ads</a>
      </body>
      </html>
      `,
      { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    );
  }
}

// ===================================================================
// HELPER FUNCTIONS
// ===================================================================

/**
 * Get debug token info
 */
async function getDebugTokenInfo(accessToken, appId, appSecret) {
  const url = new URL('https://graph.facebook.com/v19.0/debug_token');
  url.searchParams.set('input_token', accessToken);
  url.searchParams.set('access_token', `${appId}|${appSecret}`);

  const response = await fetch(url.toString());
  const data = await response.json();

  if (data.error) {
    throw new Error(data.error.message);
  }

  return data.data;
}

/**
 * Exchange short-lived token for long-lived token (60 days)
 */
async function exchangeForLongLivedToken(shortToken, appId, appSecret) {
  const url = new URL('https://graph.facebook.com/v19.0/oauth/access_token');
  url.searchParams.set('grant_type', 'fb_exchange_token');
  url.searchParams.set('client_id', appId);
  url.searchParams.set('client_secret', appSecret);
  url.searchParams.set('fb_exchange_token', shortToken);

  const response = await fetch(url.toString());
  const data = await response.json();

  if (data.error) {
    console.warn('[OAuth] Cannot exchange for long-lived token:', data.error.message);
    return shortToken; // Fallback to short-lived token
  }

  return data.access_token;
}

/**
 * Get user info
 */
async function getUserInfo(accessToken) {
  const url = new URL('https://graph.facebook.com/v19.0/me');
  url.searchParams.set('fields', 'id,name,email');
  url.searchParams.set('access_token', accessToken);

  const response = await fetch(url.toString());
  const data = await response.json();

  if (data.error) {
    throw new Error(data.error.message);
  }

  return data;
}

// ===================================================================
// GET TOKEN INFO
// ===================================================================

async function getTokenInfo(req, env) {
  if (!(await adminOK(req, env))) {
    return errorResponse('Unauthorized', 401, req);
  }

  try {
    const settings = await getJSON(env, 'settings:facebook_ads', null);
    
    if (!settings || !settings.access_token) {
      return json({
        ok: false,
        error: 'Chưa có access token. Vui lòng login Facebook trước.',
        has_token: false
      }, { status: 400 }, req);
    }

    // Check if token is expired
    const now = Date.now();
    const expiresAt = settings.token_expires_at || 0;
    const isExpired = now > expiresAt;

    return json({
      ok: true,
      has_token: true,
      is_expired: isExpired,
      user_name: settings.user_name || 'Unknown',
      user_id: settings.user_id || null,
      scopes: settings.scopes || [],
      expires_at: new Date(expiresAt).toISOString(),
      updated_at: settings.updated_at || null
    }, {}, req);

  } catch (e) {
    console.error('[OAuth] Get token info error:', e);
    return errorResponse(e, 500, req);
  }
}

// ===================================================================
// REVOKE TOKEN
// ===================================================================

async function revokeToken(req, env) {
  if (!(await adminOK(req, env))) {
    return errorResponse('Unauthorized', 401, req);
  }

  try {
    const settings = await getJSON(env, 'settings:facebook_ads', null);
    
    if (!settings || !settings.access_token) {
      return json({
        ok: false,
        error: 'Không có token để revoke'
      }, { status: 400 }, req);
    }

    // Revoke token on Facebook
    const url = new URL('https://graph.facebook.com/v19.0/me/permissions');
    url.searchParams.set('access_token', settings.access_token);

    try {
      await fetch(url.toString(), { method: 'DELETE' });
    } catch (e) {
      console.warn('[OAuth] Cannot revoke token on Facebook:', e.message);
    }

    // Clear token from KV
    settings.access_token = null;
    settings.token_expires_at = null;
    settings.scopes = [];
    settings.updated_at = new Date().toISOString();

    await putJSON(env, 'settings:facebook_ads', settings);

    return json({
      ok: true,
      message: 'Đã revoke access token'
    }, {}, req);

  } catch (e) {
    console.error('[OAuth] Revoke token error:', e);
    return errorResponse(e, 500, req);
  }
}

console.log('✅ facebook-oauth.js loaded');
