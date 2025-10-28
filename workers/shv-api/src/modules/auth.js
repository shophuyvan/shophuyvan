// ===================================================================
// workers/shv-api/src/modules/auth.js - Authentication Module
// ===================================================================

import { json, errorResponse } from '../lib/response.js';
import { adminOK, sha256Hex } from '../lib/auth.js';
import { readBody } from '../lib/utils.js';
// THÊM: Import hàm KV (Giả định đường dẫn từ file orders.js)
import { getJSON, putJSON } from '../lib/kv.js';

/**
 * Main handler for auth routes
 */
export async function handle(req, env, ctx) {
  const url = new URL(req.url);
  const path = url.pathname;
  const method = req.method;

  // Admin login
  if (path === '/admin/login' || 
      path === '/login' || 
      path === '/admin_auth/login') {
    return adminLogin(req, env);
  }

  // Check admin status
  if (path === '/admin/me' && method === 'GET') {
    return checkAdminStatus(req, env);
  }
  
  // THÊM: Route đăng nhập Facebook
  if (path === '/auth/facebook/login' && method === 'POST') {
    return facebookLogin(req, env);
  }

  return errorResponse('Route not found', 404, req);
}

// ===========================================
// FACEBOOK LOGIN (MỚI)
// ===========================================
async function facebookLogin(req, env) {
  try {
    const body = await readBody(req) || {};
    const accessToken = body.accessToken;

    if (!accessToken) {
      return errorResponse('Missing accessToken', 400, req);
    }

    // 1. Gọi Facebook Graph API để lấy thông tin user
    const fbUrl = `https://graph.facebook.com/me?fields=id,name,email&access_token=${accessToken}`;
    const fbResponse = await fetch(fbUrl);
    const fbData = await fbResponse.json();

    if (fbData.error) {
      console.error('[Facebook Auth Error]', fbData.error);
      return errorResponse(fbData.error.message, 400, req);
    }

    const { id: fb_id, name, email } = fbData;

    if (!fb_id) {
      return errorResponse('Không thể lấy ID Facebook', 400, req);
    }

    // 2. Tìm hoặc Tạo Customer
    let customer = null;
    let customerId = null;

    // 2a. Tìm bằng Facebook ID
    const fbKey = `customer:fb:${fb_id}`;
    customerId = await getJSON(env, fbKey, null);
    if (customerId) {
      customer = await getJSON(env, `customer:${customerId}`, null);
    }

    // 2b. Nếu không thấy, tìm bằng Email
    if (!customer && email) {
      const emailKey = `customer:email:${email.toLowerCase()}`;
      customer = await getJSON(env, emailKey, null);
    }

    // 2c. Nếu vẫn không thấy, tạo mới
    if (!customer) {
      customerId = `cust_${crypto.randomUUID().replace(/-/g, '')}`;
      customer = {
        id: customerId,
        fb_id: fb_id,
        full_name: name,
        email: email ? email.toLowerCase() : null,
        phone: null, // Facebook không trả về SĐT
        addresses: [],
        tier: 'dong', // Tier mặc định
        points: 0,
        created_at: Date.now()
      };

      // Lưu customer mới
      await putJSON(env, `customer:${customerId}`, customer);
      if (email) {
        await putJSON(env, `customer:email:${email.toLowerCase()}`, customer);
      }
      await putJSON(env, `customer:fb:${fb_id}`, customerId); // Lưu liên kết FB ID -> Customer ID
    
    } else if (!customer.fb_id) {
      // Nếu tìm thấy bằng email nhưng chưa liên kết FB -> cập nhật
      customer.fb_id = fb_id;
      await putJSON(env, `customer:${customer.id}`, customer);
      await putJSON(env, `customer:fb:${fb_id}`, customer.id);
    }
    
    // 3. Tạo session token cho khách hàng
    const customerToken = `shv_tok_${crypto.randomUUID().replace(/-/g, '')}`;
    
    // Lưu token vào KV (trỏ đến ID khách hàng), hết hạn sau 30 ngày
    await putJSON(env, `customer_token:${customerToken}`, customer.id, {
      expirationTtl: 60 * 60 * 24 * 30 // 30 ngày
    });

    // 4. Trả về token và thông tin customer
    return json({
      ok: true,
      token: customerToken,
      customer: customer
    }, {}, req);

  } catch (e) {
    console.error('[facebookLogin Error]', e);
    return errorResponse(e.message || 'Lỗi máy chủ nội bộ', 500, req);
  }
}


/**
 * Admin login - Generate session token
 */
async function adminLogin(req, env) {
  try {
    let username = '';
    let password = '';

    // Get credentials from POST body or query params
    if (req.method === 'POST') {
      const body = await readBody(req) || {};
      username = body.user || body.username || body.u || '';
      password = body.pass || body.password || body.p || '';
    } else {
      const url = new URL(req.url);
      username = url.searchParams.get('u') || '';
      password = url.searchParams.get('p') || '';
    }

    // Get expected password from env or KV
    let expectedPassword = (env && env.ADMIN_TOKEN) ? env.ADMIN_TOKEN : '';
    
    if (!expectedPassword && env && env.SHV) {
      expectedPassword = (await env.SHV.get('admin_pass')) || 
                        (await env.SHV.get('admin_token')) || '';
    }

    // Validate credentials
    if (!(username === 'admin' && password === expectedPassword)) {
      return json({
        ok: false,
        error: 'Invalid credentials'
      }, { status: 401 }, req);
    }

    // Generate session token
    let token = '';
    
    if (env && env.SHV) {
      // Generate random session token
      token = crypto.randomUUID().replace(/-/g, '');
      
      // Store in KV with 7 day expiration
      await env.SHV.put('admin_token', token, { 
        expirationTtl: 60 * 60 * 24 * 7 
      });
    } else {
      // Fallback: hash of ADMIN_TOKEN
      token = await sha256Hex(env.ADMIN_TOKEN || '');
    }

    return json({ ok: true, token }, {}, req);
  } catch (e) {
    return errorResponse(e, 500, req);
  }
}

/**
 * Check if current token is valid
 */
async function checkAdminStatus(req, env) {
  const isValid = await adminOK(req, env);
  return json({ ok: isValid }, {}, req);
}