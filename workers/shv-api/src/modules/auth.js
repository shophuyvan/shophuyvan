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
    // THÊM: Route đăng nhập Facebook
  if (path === '/auth/facebook/login' && method === 'POST') {
    return facebookLogin(req, env);
  }

    // THÊM: Route OTP qua ZNS (Website + Mini)
  if (path === '/auth/otp/send' && method === 'POST') {
    return sendOtp(req, env);
  }

  if (path === '/auth/otp/verify' && method === 'POST') {
    return verifyOtp(req, env);
  }

    // PASSWORD LOGIN / SETUP (WEB)
  if (path === '/auth/password/set' && method === 'POST') {
    return passwordSet(req, env);
  }

  // Đăng nhập bằng email hoặc SĐT + mật khẩu
  if (path === '/auth/password/login' && method === 'POST') {
    return passwordLogin(req, env);
  }

  // Quên mật khẩu: gửi mail/ZNS
  if (path === '/auth/password/forgot' && method === 'POST') {
    return passwordForgot(req, env);
  }

  // Đặt lại mật khẩu: dùng token (email) hoặc phone + OTP (ZNS)
  if (path === '/auth/password/reset' && method === 'POST') {
    return passwordReset(req, env);
  }

  // ZALO MINIAPP: ACTIVATE PHONE
  if (path === '/auth/zalo/activate-phone' && method === 'POST') {
    return zaloActivatePhone(req, env);
  }


  // ZALO WEB: CALLBACK (TODO - cần Zalo App ID)
  if (path === '/auth/zalo/callback' && method === 'GET') {
    return zaloWebCallback(req, env);
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
    
        // 3. Tạo session token cho khách hàng (sống dài hạn)
    const customerToken = await createCustomerToken(env, customer.id);

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

// ===========================================
// OTP QUA ZNS (WEBSITE + MINIAPP)
// ===========================================

const CUSTOMER_TOKEN_TTL_SECONDS = 60 * 60 * 24 * 730; // 1 năm tinh chỉnh thới gian sống của token

async function createCustomerToken(env, customerId) {
  const customerToken = `shv_tok_${crypto.randomUUID().replace(/-/g, '')}`;
  await putJSON(env, `customer_token:${customerToken}`, customerId, {
    expirationTtl: CUSTOMER_TOKEN_TTL_SECONDS,
  });
  return customerToken;
}

const OTP_TTL_SECONDS = 60 * 30; // 30 phút
const PASSWORD_RESET_TTL_SECONDS = 60 * 30; // 30 phút cho link/OTP reset mật khẩu

function normalizePhoneVN(rawPhone) {
  if (!rawPhone) return '';
  const digits = String(rawPhone).replace(/[^0-9]/g, '');
  if (!digits) return '';
  if (digits.startsWith('84')) return digits;
  if (digits.startsWith('0')) return digits;
  if (digits.length === 9 || digits.length === 10) {
    return '0' + digits;
  }
  return digits;
}

function toE164VN(phone) {
  const digits = String(phone).replace(/[^0-9]/g, '');
  if (!digits) return '';
  if (digits.startsWith('84')) return digits;
  if (digits.startsWith('0')) return `84${digits.slice(1)}`;
  return digits;
}

// Gửi OTP: Web dùng, Mini có thể gọi nếu muốn
async function sendOtp(req, env) {
  try {
    const body = await readBody(req) || {};
    const rawPhone = body.phone || body.phonenumber || '';
    const purpose = body.purpose || 'login';

    const phone = normalizePhoneVN(rawPhone);

    if (!phone) {
      return errorResponse('Thiếu hoặc sai định dạng số điện thoại', 400, req);
    }

    const otpCode = String(Math.floor(100000 + Math.random() * 900000));
    const otpKey = `otp:${purpose}:${phone}`;

    await putJSON(
      env,
      otpKey,
      {
        code: otpCode,
        phone,
        purpose,
        created_at: Date.now()
      },
      {
        // TTL 30 phút
        expirationTtl: OTP_TTL_SECONDS
      }
    );

    let channel = 'none';
    const e164 = toE164VN(phone);

    // Ưu tiên gửi qua ZNS
    if (e164 && env.ZALO_ZNS_ACCESS_TOKEN) {
      const ok = await sendZnsOtp(env, e164, otpCode);
      if (ok) {
        channel = 'zns';
      }
    }

    // Fallback SMS (TODO)
    if (channel === 'none') {
      await sendSmsOtp(env, phone, otpCode);
      channel = 'sms_or_todo';
    }

    return json(
      {
        ok: true,
        channel,
        ttl: OTP_TTL_SECONDS
      },
      {},
      req
    );
  } catch (e) {
    console.error('[sendOtp Error]', e);
    return errorResponse(e.message || 'Lỗi máy chủ nội bộ', 500, req);
  }
}

// Gọi ZNS Template API
async function sendZnsOtp(env, phoneE164, otpCode) {
  try {
    if (!env.ZALO_ZNS_ACCESS_TOKEN) {
      console.warn('[ZNS OTP] Thiếu ZALO_ZNS_ACCESS_TOKEN trong env');
      return false;
    }

    const payload = {
      phone: phoneE164,
      template_id: 504670, // template OTP của Shop Huy Vân
      template_data: {
        otp: otpCode
      }
    };

    const res = await fetch('https://business.openapi.zalo.me/message/template', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'access_token': env.ZALO_ZNS_ACCESS_TOKEN
      },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      console.error('[ZNS OTP] HTTP status', res.status);
      return false;
    }

    let data = null;
    try {
      data = await res.json();
    } catch (e) {
      // ignore parse error
    }
    console.log('[ZNS OTP] response', data);
    return true;
  } catch (e) {
    console.error('[ZNS OTP] error', e);
    return false;
  }
}

// TODO: Fallback SMS – sau này gắn nhà cung cấp SMS thật vào đây
async function sendSmsOtp(env, phone, otpCode) {
  console.warn('[sendSmsOtp] TODO: implement SMS fallback', phone, otpCode);
  return false;
}

// Gửi mail reset mật khẩu – sẽ gắn SMTP (Zoho, SendGrid, ...) sau
async function sendResetEmail(env, email, resetUrl) {
  try {
    console.log('[sendResetEmail] to', email, 'resetUrl=', resetUrl);
    // TODO: dùng SMTP từ mail domain (matkhau@shophuyvan.vn) hoặc dịch vụ email bên ngoài.
    return true;
  } catch (e) {
    console.error('[sendResetEmail Error]', e);
    return false;
  }
}

// Xác thực OTP: tạo / tìm customer theo SĐT + bind Zalo nếu có
async function verifyOtp(req, env) {
  try {
    const body = await readBody(req) || {};
    const rawPhone = body.phone || body.phonenumber || '';
    const code = String(body.code || body.otp || '').trim();
    const purpose = body.purpose || 'login';

    const zaloId = body.zalo_id || body.zaloId || null;
    const zaloName = body.zalo_name || body.zaloName || null;
    const zaloAvatar = body.zalo_avatar || body.zaloAvatar || null;

    const phone = normalizePhoneVN(rawPhone);

    if (!phone || !code) {
      return errorResponse('Thiếu số điện thoại hoặc mã OTP', 400, req);
    }

    const otpKey = `otp:${purpose}:${phone}`;
    const otpData = await getJSON(env, otpKey, null);

    if (!otpData || otpData.code !== code) {
      return errorResponse('Mã OTP không hợp lệ hoặc đã hết hạn', 400, req);
    }

    // Tìm / tạo customer theo SĐT
    let customerId = await getJSON(env, `customer:phone:${phone}`, null);
    let customer = null;

    if (customerId) {
      customer = await getJSON(env, `customer:${customerId}`, null);
    }

    if (!customer) {
      customerId = `cust_${crypto.randomUUID().replace(/-/g, '')}`;
      customer = {
        id: customerId,
        phone,
        full_name: body.full_name || null,
        email: body.email ? String(body.email).toLowerCase() : null,
        zalo_id: zaloId,
        zalo_name: zaloName,
        zalo_avatar: zaloAvatar,
        addresses: [],
        tier: 'dong',
        points: 0,
        created_at: Date.now()
      };
    } else {
      // Cập nhật thông tin còn thiếu
      if (!customer.phone) {
        customer.phone = phone;
      }
      if (body.full_name && !customer.full_name) {
        customer.full_name = body.full_name;
      }
      if (body.email && !customer.email) {
        customer.email = String(body.email).toLowerCase();
      }
      if (zaloId && !customer.zalo_id) {
        customer.zalo_id = zaloId;
      }
      if (zaloName && !customer.zalo_name) {
        customer.zalo_name = zaloName;
      }
      if (zaloAvatar && !customer.zalo_avatar) {
        customer.zalo_avatar = zaloAvatar;
      }
    }

        // Lưu customer & index
    await putJSON(env, `customer:${customer.id}`, customer);
    await putJSON(env, `customer:phone:${phone}`, customer.id);
    if (customer.email) {
      await putJSON(env, `customer:email:${customer.email.toLowerCase()}`, customer);
    }
    if (customer.zalo_id) {
      await putJSON(env, `customer:zalo:${customer.zalo_id}`, customer.id);
    }

        // Tạo session token giống FB login (sống dài hạn)
    const customerToken = await createCustomerToken(env, customer.id);

    return json(
      {
        ok: true,
        token: customerToken,
        customer
      },
      {},
      req
    );
    } catch (e) {
    console.error('[verifyOtp Error]', e);
    return errorResponse(e.message || 'Lỗi máy chủ nội bộ', 500, req);
  }
}


// ===========================================
// PASSWORD LOGIN & SETUP (WEB)
// ===========================================

async function passwordSet(req, env) {
  try {
    const body = await readBody(req) || {};
    const password = String(body.password || '').trim();
    const full_name = body.full_name;
    const email = body.email ? String(body.email).toLowerCase() : null;

    // Lấy token từ header Authorization hoặc body
    const authHeader = req.headers.get('Authorization') || '';
    const token = authHeader.startsWith('Bearer ')
      ? authHeader.slice(7).trim()
      : (body.token || '');

    if (!token) {
      return errorResponse('Thiếu token xác thực', 401, req);
    }

    const customerId = await getJSON(env, `customer_token:${token}`, null);
    if (!customerId) {
      return errorResponse('Token không hợp lệ hoặc đã hết hạn', 401, req);
    }

    if (!password || password.length < 6) {
      return errorResponse('Mật khẩu phải có ít nhất 6 ký tự', 400, req);
    }

    const customer = await getJSON(env, `customer:${customerId}`, null);
    if (!customer) {
      return errorResponse('Không tìm thấy tài khoản', 404, req);
    }

    const hash = await sha256Hex(password);
    customer.password_hash = hash;

    if (full_name) {
      customer.full_name = full_name;
    }
    if (email) {
      customer.email = email;
      await putJSON(env, `customer:email:${email}`, customer);
    }
    await putJSON(env, `customer:${customer.id}`, customer);

    return json({
      ok: true,
      customer,
    }, {}, req);
  } catch (e) {
    console.error('[passwordSet Error]', e);
    return errorResponse(e.message || 'Lỗi máy chủ nội bộ', 500, req);
  }
}

async function passwordLogin(req, env) {
  try {
    const body = await readBody(req) || {};
    const identifierRaw =
      body.identifier ||
      body.username ||
      body.email ||
      body.phone ||
      body.phonenumber ||
      '';
    const identifier = String(identifierRaw || '').trim();
    const password = String(body.password || '').trim();

    if (!identifier || !password) {
      return errorResponse('Thiếu tài khoản hoặc mật khẩu', 400, req);
    }

    let customer = null;
    let customerId = null;

    // Nếu có @ => email
    if (identifier.includes('@')) {
      const email = identifier.toLowerCase();
      const emailKey = `customer:email:${email}`;
      const emailVal = await getJSON(env, emailKey, null);

      if (emailVal) {
        if (emailVal.id) {
          customer = emailVal;
          customerId = customer.id;
        } else if (typeof emailVal === 'string') {
          customerId = emailVal;
          customer = await getJSON(env, `customer:${customerId}`, null);
        }
      }
    } else {
      // Ngược lại => phone
      const phone = normalizePhoneVN(identifier);
      if (!phone) {
        return errorResponse('Sai định dạng số điện thoại hoặc email', 400, req);
      }

      customerId = await getJSON(env, `customer:phone:${phone}`, null);
      if (customerId) {
        customer = await getJSON(env, `customer:${customerId}`, null);
      }
    }

    if (!customer || !customer.id) {
      return errorResponse('Tài khoản không tồn tại', 404, req);
    }

    if (!customer.password_hash) {
      return errorResponse('Tài khoản chưa thiết lập mật khẩu', 400, req);
    }

        const hash = await sha256Hex(password);

    // Mặc định: so sánh theo chuẩn sha256 mới
    let ok = customer.password_hash === hash;

    // Backward-compat: tài khoản cũ lưu password kiểu "$2a$10$" + btoa(password).slice(0, 53)
    if (
      !ok &&
      typeof customer.password_hash === 'string' &&
      customer.password_hash.startsWith('$2a$10$')
    ) {
      const legacyHash = '$2a$10$' + btoa(password).slice(0, 53);

      if (customer.password_hash === legacyHash) {
        ok = true;

        // NÂNG CẤP: lưu lại theo chuẩn sha256 mới
        customer.password_hash = hash;
        await putJSON(env, `customer:${customer.id}`, customer);
        if (customer.email) {
          await putJSON(
            env,
            `customer:email:${customer.email.toLowerCase()}`,
            customer
          );
        }
        if (customer.phone) {
          const phoneIdx = normalizePhoneVN(customer.phone);
          if (phoneIdx) {
            await putJSON(env, `customer:phone:${phoneIdx}`, customer.id);
          }
        }
      }
    }

    if (!ok) {
      return errorResponse('Mật khẩu không đúng', 401, req);
    }

    const customerToken = await createCustomerToken(env, customer.id);


    return json({
      ok: true,
      token: customerToken,
      customer,
    }, {}, req);
  } catch (e) {
    console.error('[passwordLogin Error]', e);
    return errorResponse(e.message || 'Lỗi máy chủ nội bộ', 500, req);
  }
}

// Quên mật khẩu: /auth/password/forgot
async function passwordForgot(req, env) {
  try {
    const body = await readBody(req) || {};
    const identifierRaw =
      body.identifier ||
      body.username ||
      body.email ||
      body.phone ||
      body.phonenumber ||
      '';
    const identifier = String(identifierRaw || '').trim();

    if (!identifier) {
      return errorResponse('Thiếu email hoặc số điện thoại', 400, req);
    }

    let customer = null;
    let customerId = null;
    let phoneNormalized = null;

    if (identifier.includes('@')) {
      const email = identifier.toLowerCase();
      const emailKey = `customer:email:${email}`;
      const emailVal = await getJSON(env, emailKey, null);
      if (emailVal) {
        if (emailVal.id) {
          customer = emailVal;
          customerId = customer.id;
        } else if (typeof emailVal === 'string') {
          customerId = emailVal;
          customer = await getJSON(env, `customer:${customerId}`, null);
        }
      }
    } else {
      phoneNormalized = normalizePhoneVN(identifier);
      if (phoneNormalized) {
        customerId = await getJSON(env, `customer:phone:${phoneNormalized}`, null);
        if (customerId) {
          customer = await getJSON(env, `customer:${customerId}`, null);
        }
      }
    }

    if (!customer || !customer.id) {
      return errorResponse('Tài khoản không tồn tại', 404, req);
    }

    let channel = 'none';

    // ƯU TIÊN: EMAIL → gửi link reset
    if (customer.email) {
      const token = crypto.randomUUID().replace(/-/g, '');
      const key = `password_reset:token:${token}`;

      const record = {
        customer_id: customer.id,
        token,
        channel: 'email',
        created_at: Date.now(),
      };

      await putJSON(env, key, record, {
        expirationTtl: PASSWORD_RESET_TTL_SECONDS,
      });

      const baseUrl = env.WEB_URL || 'https://shophuyvan.vn';
      const resetUrlBase = baseUrl.replace(/\/$/, '');
      const resetUrl = `${resetUrlBase}/password-reset.html?token=${token}`;

      const emailOk = await sendResetEmail(env, customer.email, resetUrl);
      if (emailOk) {
        channel = 'email';
      }
    } else if (customer.phone) {
      // Không có email -> dùng OTP qua ZNS theo SĐT
      phoneNormalized = normalizePhoneVN(customer.phone);
      const phoneKey = phoneNormalized
        ? `password_reset:phone:${phoneNormalized}`
        : null;

      const otpCode = String(
        Math.floor(100000 + Math.random() * 900000)
      );

      const record = {
        customer_id: customer.id,
        phone: phoneNormalized,
        otp: otpCode,
        channel: 'zns',
        created_at: Date.now(),
      };

      if (phoneKey) {
        await putJSON(env, phoneKey, record, {
          expirationTtl: PASSWORD_RESET_TTL_SECONDS,
        });

        const e164 = toE164VN(phoneNormalized);
        if (e164 && env.ZALO_ZNS_ACCESS_TOKEN) {
          const ok = await sendZnsOtp(env, e164, otpCode);
          if (ok) {
            channel = 'zns';
          }
        }
      }
    }

    return json(
      {
        ok: true,
        channel,
        ttl: PASSWORD_RESET_TTL_SECONDS,
      },
      {},
      req
    );
  } catch (e) {
    console.error('[passwordForgot Error]', e);
    return errorResponse(e.message || 'Lỗi máy chủ nội bộ', 500, req);
  }
}

// Đặt lại mật khẩu: /auth/password/reset
async function passwordReset(req, env) {
  try {
    const body = await readBody(req) || {};
    const password = String(body.password || '').trim();

    if (!password || password.length < 6) {
      return errorResponse('Mật khẩu phải có ít nhất 6 ký tự', 400, req);
    }

    let customerId = null;

    const token = body.token ? String(body.token).trim() : '';

    if (token) {
      // Flow email: reset bằng link có token
      const key = `password_reset:token:${token}`;
      const record = await getJSON(env, key, null);

      if (!record || !record.customer_id) {
        return errorResponse(
          'Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn',
          400,
          req
        );
      }

      customerId = record.customer_id;

      // Đánh dấu token đã dùng, rút TTL xuống ngắn
      await putJSON(
        env,
        key,
        { ...record, used: true },
        { expirationTtl: 10 }
      );
    } else {
      // Flow ZNS: phone + OTP
      const rawPhone = body.phone || body.phonenumber || '';
      const code = String(body.code || body.otp || '').trim();
      const phone = normalizePhoneVN(rawPhone);

      if (!phone || !code) {
        return errorResponse('Thiếu số điện thoại hoặc mã OTP', 400, req);
      }

      const key = `password_reset:phone:${phone}`;
      const record = await getJSON(env, key, null);

      if (!record || !record.customer_id || record.otp !== code) {
        return errorResponse('Mã OTP không đúng hoặc đã hết hạn', 400, req);
      }

      customerId = record.customer_id;

      await putJSON(
        env,
        key,
        { ...record, used: true },
        { expirationTtl: 10 }
      );
    }

    const customer = await getJSON(env, `customer:${customerId}`, null);
    if (!customer) {
      return errorResponse('Không tìm thấy tài khoản', 404, req);
    }

    const hash = await sha256Hex(password);
    customer.password_hash = hash;

    await putJSON(env, `customer:${customer.id}`, customer);
    if (customer.email) {
      await putJSON(
        env,
        `customer:email:${customer.email.toLowerCase()}`,
        customer
      );
    }

    const customerToken = await createCustomerToken(env, customer.id);

    return json(
      {
        ok: true,
        token: customerToken,
        customer,
      },
      {},
      req
    );
  } catch (e) {
    console.error('[passwordReset Error]', e);
    return errorResponse(e.message || 'Lỗi máy chủ nội bộ', 500, req);
  }
}

// ===========================================
// ZALO MINIAPP: ACTIVATE BY PHONE + ZALO
// ===========================================

async function zaloActivatePhone(req, env) {
  try {
    const body = await readBody(req) || {};
    const rawPhone = body.phone || body.phonenumber || '';
    const phone = normalizePhoneVN(rawPhone);

    const zaloId = body.zalo_id || body.zaloId || null;
    const zaloName = body.zalo_name || body.zaloName || null;
    const zaloAvatar = body.zalo_avatar || body.zaloAvatar || null;
    const full_name = body.full_name || zaloName || null;
    const email = body.email ? String(body.email).toLowerCase() : null;

    if (!phone && !zaloId) {
      return errorResponse('Thiếu số điện thoại hoặc Zalo ID', 400, req);
    }

    let customerId = null;
    let customer = null;

    if (phone) {
      customerId = await getJSON(env, `customer:phone:${phone}`, null);
    }

    if (!customerId && zaloId) {
      customerId = await getJSON(env, `customer:zalo:${zaloId}`, null);
    }

    if (customerId) {
      customer = await getJSON(env, `customer:${customerId}`, null);
    }

    if (!customer) {
      customerId = `cust_${crypto.randomUUID().replace(/-/g, '')}`;
      customer = {
        id: customerId,
        phone: phone || null,
        full_name,
        email,
        zalo_id: zaloId,
        zalo_name: zaloName,
        zalo_avatar: zaloAvatar,
        addresses: [],
        tier: 'dong',
        points: 0,
        created_at: Date.now(),
      };
    } else {
      if (phone && !customer.phone) {
        customer.phone = phone;
      }
      if (full_name && !customer.full_name) {
        customer.full_name = full_name;
      }
      if (email && !customer.email) {
        customer.email = email;
      }
      if (zaloId && !customer.zalo_id) {
        customer.zalo_id = zaloId;
      }
      if (zaloName) {
        customer.zalo_name = zaloName;
      }
      if (zaloAvatar) {
        customer.zalo_avatar = zaloAvatar;
      }
    }

        await putJSON(env, `customer:${customer.id}`, customer);
    if (customer.email) {
      await putJSON(env, `customer:email:${customer.email.toLowerCase()}`, customer);
    }
    if (phone) {
      await putJSON(env, `customer:phone:${phone}`, customer.id);
    }
    if (customer.zalo_id) {
      await putJSON(env, `customer:zalo:${customer.zalo_id}`, customer.id);
    }

    const customerToken = await createCustomerToken(env, customer.id);

    return json({
      ok: true,
      token: customerToken,
      customer,
    }, {}, req);
  } catch (e) {
    console.error('[zaloActivatePhone Error]', e);
    return errorResponse(e.message || 'Lỗi máy chủ nội bộ', 500, req);
  }
}

// ===========================================
// ZALO WEB: CALLBACK HANDLER (TODO)
// ===========================================
async function zaloWebCallback(req, env) {
  try {
    const url = new URL(req.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state') || 'register';

    if (!code) {
      return errorResponse('Thiếu authorization code từ Zalo', 400, req);
    }

    // TODO: Cần có ZALO_APP_ID và ZALO_APP_SECRET trong env
    if (!env.ZALO_APP_ID || !env.ZALO_APP_SECRET) {
      console.error('[Zalo Callback] Thiếu cấu hình Zalo App');
      return json({
        ok: false,
        error: 'Tính năng đăng nhập Zalo chưa được cấu hình. Vui lòng liên hệ quản trị viên.'
      }, { status: 503 }, req);
    }

    // 1. Đổi code lấy access_token
    const tokenUrl = 'https://oauth.zaloapp.com/v4/access_token';
    const tokenParams = new URLSearchParams({
      app_id: env.ZALO_APP_ID,
      app_secret: env.ZALO_APP_SECRET,
      code: code,
      grant_type: 'authorization_code'
    });

    const tokenRes = await fetch(`${tokenUrl}?${tokenParams.toString()}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });

    const tokenData = await tokenRes.json();

    if (!tokenRes.ok || !tokenData.access_token) {
      console.error('[Zalo Callback] Token error:', tokenData);
      return errorResponse('Không lấy được access token từ Zalo', 400, req);
    }

    // 2. Lấy thông tin user từ Zalo
    const userRes = await fetch('https://graph.zalo.me/v2.0/me?fields=id,name,picture', {
      headers: {
        'access_token': tokenData.access_token
      }
    });

    const userData = await userRes.json();

    if (!userRes.ok || !userData.id) {
      console.error('[Zalo Callback] User info error:', userData);
      return errorResponse('Không lấy được thông tin user từ Zalo', 400, req);
    }

    // 3. Tìm hoặc tạo customer
    const zaloId = userData.id;
    let customerId = await getJSON(env, `customer:zalo:${zaloId}`, null);
    let customer = null;

    if (customerId) {
      customer = await getJSON(env, `customer:${customerId}`, null);
    }

    if (!customer) {
      customerId = `cust_${crypto.randomUUID().replace(/-/g, '')}`;
      customer = {
        id: customerId,
        zalo_id: zaloId,
        full_name: userData.name || null,
        zalo_name: userData.name || null,
        zalo_avatar: userData.picture?.data?.url || null,
        phone: null,
        email: null,
        addresses: [],
        tier: 'dong',
        points: 0,
        created_at: Date.now()
      };

      await putJSON(env, `customer:${customerId}`, customer);
      await putJSON(env, `customer:zalo:${zaloId}`, customerId);
    }

    // 4. Tạo token
    const customerToken = await createCustomerToken(env, customer.id);

    // 5. Redirect về trang web với token
    const redirectUrl = new URL(env.WEB_URL || 'https://shophuyvan.vn');
    redirectUrl.pathname = '/register.html';
    redirectUrl.searchParams.set('zalo_token', customerToken);
    redirectUrl.searchParams.set('zalo_success', '1');

    return Response.redirect(redirectUrl.toString(), 302);

  } catch (e) {
    console.error('[zaloWebCallback Error]', e);
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