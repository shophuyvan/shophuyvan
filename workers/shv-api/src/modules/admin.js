// File: workers/shv-api/src/modules/admin.js
// Admin management module - FIXED

import { json, corsHeaders } from '../lib/response.js';
import { sha256Hex, requirePermission } from '../lib/auth.js'; // ✅ THÊM requirePermission

/**
 * Main admin handler
 */
export async function handle(req, env, ctx) {
  try {
    const url = new URL(req.url);
    const path = url.pathname;
    const method = req.method;

    // Setup route (only once)
    if (path === '/admin/setup/init' && method === 'POST') {
      return await setupSuperAdmin(req, env);
    }

    // Login routes
    if ((path === '/admin/auth/login' || 
         path === '/admin/login' || 
         path === '/login' || 
         path === '/admin_auth/login') && 
        method === 'POST') {
      return await handleLogin(req, env);
    }

    // Get current admin
    if ((path === '/admin/auth/me' || path === '/admin/me') && method === 'GET') {
      return await handleMe(req, env);
    }

    // List admins
    if (path === '/admin/users/list' && method === 'GET') {
      const permCheck = await requirePermission(req, env, 'admins.view');
      if (!permCheck.ok) {
        return json(permCheck, { status: permCheck.status }, req);
      }
      return await listAdmins(req, env);
    }

    // Create admin
    if (path === '/admin/users/create' && method === 'POST') {
      const permCheck = await requirePermission(req, env, 'admins.create');
      if (!permCheck.ok) {
        return json(permCheck, { status: permCheck.status }, req);
      }
      return await createAdmin(req, env);
    }

    // Get/Update/Delete admin by ID
    const userMatch = path.match(/^\/admin\/users\/([^\/]+)$/);
    if (userMatch) {
      const adminId = userMatch[1];
      
      let requiredPerm = 'admins.view';
      if (method === 'PUT') requiredPerm = 'admins.edit';
      else if (method === 'DELETE') requiredPerm = 'admins.delete';
      
      const permCheck = await requirePermission(req, env, requiredPerm);
      if (!permCheck.ok) {
        return json(permCheck, { status: permCheck.status }, req);
      }
      
      if (method === 'GET') return await getAdmin(req, env, adminId);
      if (method === 'PUT') return await updateAdmin(req, env, adminId);
      if (method === 'DELETE') return await deleteAdmin(req, env, adminId);
    }

    // Roles
    if (path === '/admin/roles/list' && method === 'GET') {
      const permCheck = await requirePermission(req, env, 'admins.manage_roles');
      if (!permCheck.ok) {
        return json(permCheck, { status: permCheck.status }, req);
      }
      return await listRoles(req, env);
    }
    if (path === '/admin/roles/create' && method === 'POST') {
      const permCheck = await requirePermission(req, env, 'admins.manage_roles');
      if (!permCheck.ok) {
        return json(permCheck, { status: permCheck.status }, req);
      }
      return await createRole(req, env);
    }

    const roleMatch = path.match(/^\/admin\/roles\/([^\/]+)$/);
    if (roleMatch) {
      const roleId = roleMatch[1];
      
      const permCheck = await requirePermission(req, env, 'admins.manage_roles');
      if (!permCheck.ok) {
        return json(permCheck, { status: permCheck.status }, req);
      }
      
      if (method === 'GET') return await getRole(req, env, roleId);
      if (method === 'PUT') return await updateRole(req, env, roleId);
      if (method === 'DELETE') return await deleteRole(req, env, roleId);
    }
    // Customers
    if (path === '/admin/customers/list' && method === 'GET') {
      return await listCustomers(req, env);
    }
    if (path === '/admin/customers/create' && method === 'POST') {
      return await createCustomer(req, env);
    }

    const customerMatch = path.match(/^\/admin\/customers\/([^\/]+)$/);
    if (customerMatch) {
      const customerId = customerMatch[1];
      if (method === 'GET') return await getCustomer(req, env, customerId);
      if (method === 'PUT') return await updateCustomer(req, env, customerId);
      if (method === 'DELETE') return await deleteCustomer(req, env, customerId);
    }

        // PUBLIC API - Customer
    if (path === '/api/customers/register' && method === 'POST') {
      return await customerRegister(req, env);
    }
    if (path === '/api/customers/login' && method === 'POST') {
      return await customerLogin(req, env);
    }
    if (path === '/api/customers/me' && method === 'GET') {
      return await customerMe(req, env);
    }

    // PUBLIC API - Facebook Login (FE + Mini)
    if (path === '/auth/facebook/login' && method === 'POST') {
      return await facebookLogin(req, env);
    }

    // PUBLIC API - Zalo activate
    if (path === '/api/users/activate' && method === 'POST') {
      return await userActivate(req, env);
    }


    // PUBLIC API - Addresses
    const addressMatch = path.match(/^\/api\/addresses(?:\/([^\/]+))?$/);
    if (addressMatch) {
      const addressId = addressMatch[1];
      
      if (path === '/api/addresses' && method === 'POST') {
        return await createAddress(req, env);
      }
      if (path === '/api/addresses' && method === 'GET') {
        return await listAddresses(req, env);
      }
      if (addressId && method === 'GET') {
        return await getAddress(req, env, addressId);
      }
      if (addressId && method === 'PUT') {
        return await updateAddress(req, env, addressId);
      }
      if (addressId && method === 'DELETE') {
        return await deleteAddress(req, env, addressId);
      }
      if (path.endsWith('/default') && method === 'PUT') {
        const id = addressId.replace('/default', '');
        return await setDefaultAddress(req, env, id);
      }
    }

    // ✅ Cache Management
    if (path === '/admin/cache/clear' && method === 'POST') {
      // TODO: Thêm permission check sau khi setup quyền phù hợp
      return await clearCache(req, env);
    }

    // 404
    return json({ ok: false, error: 'Route not found' }, { status: 404 }, req);
  
  } catch (e) {
    console.error('[Admin] Error:', e);
    return json({ 
      ok: false, 
      error: 'Internal error', 
      details: e.message 
    }, { status: 500 }, req);
  }
}
/**
 * Get customer token from request
 */
function getCustomerToken(req) {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '') ||
                req.headers.get('x-customer-token') || '';
  return token;
}

/**
 * Get customer ID from token
 * - Hỗ trợ cả token mới (shv_tok_..., lưu trong KV customer_token:...)
 *   và token base64 cũ (btoa("customerId:timestamp"))
 */
async function getCustomerIdFromToken(token, env) {
  if (!token) return null;

  // Ưu tiên: token kiểu mới lưu trong KV
  try {
    const kvVal = await env.SHV.get(`customer_token:${token}`);
    if (kvVal) {
      try {
        const parsed = JSON.parse(kvVal);
        if (typeof parsed === 'string') return parsed;
        if (parsed && typeof parsed === 'object' && parsed.id) return parsed.id;
      } catch {
        // Nếu lưu plain string
        return kvVal;
      }
    }
  } catch (e) {
    // Bỏ qua, fallback xuống token kiểu cũ
  }

  // Fallback: token base64 cũ
  try {
    const decoded = atob(token);
    return decoded.split(':')[0];
  } catch {
    return null;
  }
}

/**
 * Create new address
 */
async function createAddress(req, env) {
  try {
    const token = getCustomerToken(req);
    const customerId = await getCustomerIdFromToken(token, env);
    
    if (!customerId) {
      return json({ ok: false, error: 'Unauthorized' }, { status: 401 }, req);
    }

    const body = await req.json();
    const { name, phone, province_code, province_name, district_code, district_name, ward_code, ward_name, address, address_type, note } = body;

    if (!name || !phone || !province_code || !district_code || !address) {
      return json({ ok: false, error: 'Thiếu thông tin bắt buộc' }, { status: 400 }, req);
    }

    const addressId = 'addr_' + Date.now() + '_' + Math.random().toString(36).slice(2, 9);
    const now = new Date().toISOString();

    // Get list to count, check if this is first address
    const listKey = `customer:addresses:${customerId}`;
    const listData = await env.SHV.get(listKey);
    const list = listData ? JSON.parse(listData) : [];
    const isFirst = list.length === 0;

    const newAddress = {
      id: addressId,
      customer_id: customerId,
      name,
      phone,
      province_code,
      province_name,
      district_code,
      district_name,
      ward_code,
      ward_name,
      address,
      address_type: address_type || 'home',
      is_default: isFirst,
      note: note || '',
      created_at: now,
      updated_at: now
    };

    await env.SHV.put(`customer:address:${addressId}`, JSON.stringify(newAddress));
    list.push(addressId);
    await env.SHV.put(listKey, JSON.stringify(list));

    return json({ ok: true, address: newAddress }, {}, req);

  } catch (e) {
    console.error('[Addresses] Create error:', e);
    return json({ ok: false, error: 'Lỗi tạo địa chỉ: ' + e.message }, { status: 500 }, req);
  }
}

/**
 * List all addresses for customer
 */
async function listAddresses(req, env) {
  try {
    const token = getCustomerToken(req);
    const customerId = await getCustomerIdFromToken(token, env);
    
    if (!customerId) {
      return json({ ok: false, error: 'Unauthorized' }, { status: 401 }, req);
    }

    const listKey = `customer:addresses:${customerId}`;
    const listData = await env.SHV.get(listKey);
    const list = listData ? JSON.parse(listData) : [];

    const addresses = [];
    for (const addressId of list) {
      const data = await env.SHV.get(`customer:address:${addressId}`);
      if (data) {
        addresses.push(JSON.parse(data));
      }
    }

    return json({ ok: true, addresses, total: addresses.length }, {}, req);

  } catch (e) {
    console.error('[Addresses] List error:', e);
    return json({ ok: false, error: 'Lỗi tải danh sách địa chỉ' }, { status: 500 }, req);
  }
}

/**
 * Get single address
 */
async function getAddress(req, env, addressId) {
  try {
    const token = getCustomerToken(req);
    const customerId = await getCustomerIdFromToken(token, env);
    
    if (!customerId) {
      return json({ ok: false, error: 'Unauthorized' }, { status: 401 }, req);
    }

    const data = await env.SHV.get(`customer:address:${addressId}`);
    if (!data) {
      return json({ ok: false, error: 'Địa chỉ không tìm thấy' }, { status: 404 }, req);
    }

    const address = JSON.parse(data);
    if (address.customer_id !== customerId) {
      return json({ ok: false, error: 'Forbidden' }, { status: 403 }, req);
    }

    return json({ ok: true, address }, {}, req);

  } catch (e) {
    console.error('[Addresses] Get error:', e);
    return json({ ok: false, error: 'Lỗi tải địa chỉ' }, { status: 500 }, req);
  }
}

/**
 * Update address
 */
async function updateAddress(req, env, addressId) {
  try {
    const token = getCustomerToken(req);
    const customerId = await getCustomerIdFromToken(token, env);
    
    if (!customerId) {
      return json({ ok: false, error: 'Unauthorized' }, { status: 401 }, req);
    }

    const data = await env.SHV.get(`customer:address:${addressId}`);
    if (!data) {
      return json({ ok: false, error: 'Địa chỉ không tìm thấy' }, { status: 404 }, req);
    }

    const address = JSON.parse(data);
    if (address.customer_id !== customerId) {
      return json({ ok: false, error: 'Forbidden' }, { status: 403 }, req);
    }

    const body = await req.json();
    if (body.name) address.name = body.name;
    if (body.phone) address.phone = body.phone;
    if (body.province_code) address.province_code = body.province_code;
    if (body.province_name) address.province_name = body.province_name;
    if (body.district_code) address.district_code = body.district_code;
    if (body.district_name) address.district_name = body.district_name;
    if (body.ward_code) address.ward_code = body.ward_code;
    if (body.ward_name) address.ward_name = body.ward_name;
    if (body.address) address.address = body.address;
    if (body.address_type) address.address_type = body.address_type;
    if (body.note !== undefined) address.note = body.note;

    address.updated_at = new Date().toISOString();

    await env.SHV.put(`customer:address:${addressId}`, JSON.stringify(address));

    return json({ ok: true, address }, {}, req);

  } catch (e) {
    console.error('[Addresses] Update error:', e);
    return json({ ok: false, error: 'Lỗi cập nhật địa chỉ' }, { status: 500 }, req);
  }
}

/**
 * Delete address
 */
async function deleteAddress(req, env, addressId) {
  try {
    const token = getCustomerToken(req);
    const customerId = await getCustomerIdFromToken(token, env);
    
    if (!customerId) {
      return json({ ok: false, error: 'Unauthorized' }, { status: 401 }, req);
    }

    const data = await env.SHV.get(`customer:address:${addressId}`);
    if (!data) {
      return json({ ok: false, error: 'Địa chỉ không tìm thấy' }, { status: 404 }, req);
    }

    const address = JSON.parse(data);
    if (address.customer_id !== customerId) {
      return json({ ok: false, error: 'Forbidden' }, { status: 403 }, req);
    }

    await env.SHV.delete(`customer:address:${addressId}`);

    const listKey = `customer:addresses:${customerId}`;
    const listData = await env.SHV.get(listKey);
    const list = listData ? JSON.parse(listData) : [];
    const newList = list.filter(id => id !== addressId);
    await env.SHV.put(listKey, JSON.stringify(newList));

    return json({ ok: true, message: 'Địa chỉ đã xóa' }, {}, req);

  } catch (e) {
    console.error('[Addresses] Delete error:', e);
    return json({ ok: false, error: 'Lỗi xóa địa chỉ' }, { status: 500 }, req);
  }
}

/**
 * Set default address
 */
async function setDefaultAddress(req, env, addressId) {
  try {
    const token = getCustomerToken(req);
    const customerId = await getCustomerIdFromToken(token, env);
    
    if (!customerId) {
      return json({ ok: false, error: 'Unauthorized' }, { status: 401 }, req);
    }

    const listKey = `customer:addresses:${customerId}`;
    const listData = await env.SHV.get(listKey);
    const list = listData ? JSON.parse(listData) : [];

    for (const id of list) {
      const data = await env.SHV.get(`customer:address:${id}`);
      if (data) {
        const addr = JSON.parse(data);
        addr.is_default = (id === addressId);
        await env.SHV.put(`customer:address:${id}`, JSON.stringify(addr));
      }
    }

    const addressData = await env.SHV.get(`customer:address:${addressId}`);
    const address = addressData ? JSON.parse(addressData) : null;

    return json({ ok: true, message: 'Đặt địa chỉ mặc định thành công', address }, {}, req);

  } catch (e) {
    console.error('[Addresses] Set default error:', e);
    return json({ ok: false, error: 'Lỗi đặt địa chỉ mặc định' }, { status: 500 }, req);
  }
}

/**
 * Facebook Login (PUBLIC API)
 * Nhận accessToken từ FE, map vào hệ customer hiện tại
 */
async function facebookLogin(req, env) {
  try {
    const body = await req.json();
    const accessToken = body.accessToken || body.access_token;

    if (!accessToken) {
      return json({ ok: false, error: 'Thiếu accessToken' }, { status: 400 }, req);
    }

    // 1) Lấy thông tin user từ Facebook
    const meRes = await fetch(
      'https://graph.facebook.com/v19.0/me' +
        '?fields=id,name,email,picture' +
        `&access_token=${encodeURIComponent(accessToken)}`
    );
    const fbUser = await meRes.json();

    if (!meRes.ok || !fbUser.id) {
      console.error('[FB Login] profile error:', fbUser);
      return json(
        { ok: false, error: 'facebook_profile_error', detail: fbUser },
        { status: 400 },
        req
      );
    }

    const fbId = fbUser.id;
    const fbName = fbUser.name || '';
    const fbEmail = (fbUser.email || '').trim().toLowerCase() || null;
    const fbAvatar =
      fbUser.picture &&
      fbUser.picture.data &&
      fbUser.picture.data.url
        ? fbUser.picture.data.url
        : '';

    // 2) Xác định email để map customer
    const email = fbEmail || `facebook_${fbId}@shophuyvan.local`;
    const emailKey = `customer:email:${email.toLowerCase()}`;

    // 3) Kiểm tra customer đã tồn tại chưa
    let customerData = await env.SHV.get(emailKey);
    let customer = null;

    if (customerData) {
      // Cập nhật thông tin Facebook
      customer = JSON.parse(customerData);
      customer.facebook_id = fbId;
      customer.facebook_name = fbName;
      customer.facebook_avatar = fbAvatar;
      customer.updated_at = new Date().toISOString();
      customer.last_login = new Date().toISOString();

      await env.SHV.put(`customer:${customer.id}`, JSON.stringify(customer));
      await env.SHV.put(emailKey, JSON.stringify(customer));

      console.log('[FB Login] Updated existing customer:', customer.id);
    } else {
      // 4) Tạo customer mới
      const customerId = 'cust_' + Date.now() + '_' + Math.random().toString(36).slice(2, 9);
      const now = new Date().toISOString();

      // Password random (không dùng cho login thực tế, chỉ để đủ field)
      const randomPassword = Math.random().toString(36).slice(2, 15);
      const password_hash = '$2a$10$' + btoa(randomPassword).slice(0, 53);

      customer = {
        id: customerId,
        email: email,
        password_hash,
        full_name: fbName || email,
        phone: '',
        facebook_id: fbId,
        facebook_name: fbName,
        facebook_avatar: fbAvatar,
        customer_type: 'retail',
        points: 0,
        tier: 'retail',
        status: 'active',
        created_at: now,
        updated_at: now,
        last_login: now,
        created_by: 'facebook_login',
        source: 'fe'
      };

      await env.SHV.put(`customer:${customerId}`, JSON.stringify(customer));
      await env.SHV.put(emailKey, JSON.stringify(customer));

      const listData = await env.SHV.get('customer:list');
      const list = listData ? JSON.parse(listData) : [];
      list.push(customerId);
      await env.SHV.put('customer:list', JSON.stringify(list));

      console.log('[FB Login] Created new customer:', customerId);
    }

    // 5) Auto login - sinh token giống login thường
    const token = btoa(`${customer.id}:${Date.now()}`);
    const { password_hash, ...safeCustomer } = customer;

    return json(
      {
        ok: true,
        message: 'Đăng nhập bằng Facebook thành công!',
        token,
        customer: safeCustomer
      },
      {},
      req
    );
  } catch (e) {
    console.error('[FB Login] Error:', e);
    return json(
      { ok: false, error: 'Lỗi đăng nhập Facebook: ' + e.message },
      { status: 500 },
      req
    );
  }
}

/**
 * Zalo Mini App - Activate Account (PUBLIC API)
 * Lấy user info từ Zalo, tạo/link tài khoản customer
 */
async function userActivate(req, env) {
  try {
        const body = await req.json();
    let { zalo_id, zalo_name, zalo_avatar, phone, source } = body;

    // Nếu thiếu thông tin từ Zalo thì tự sinh fallback để không chặn luồng kích hoạt
    if (!zalo_id || !zalo_name) {
      const rand = Math.random().toString(36).slice(2, 10);
      if (!zalo_id) {
        zalo_id = `guest_${rand}`;
      }
      if (!zalo_name) {
        zalo_name = 'Guest';
      }
      console.warn('[MiniActivate] missing zalo fields, using fallback', {
        zalo_id,
        zalo_name,
      });
    }

    // Tạo email từ zalo_id (vì Zalo không cung cấp email)
    const email = `zalo_${zalo_id}@shophuyvan.local`;
    const emailKey = `customer:email:${email.toLowerCase()}`;

    // Kiểm tra xem user đã tồn tại chưa
    let customerData = await env.SHV.get(emailKey);
    let customer = null;

    if (customerData) {
      // Cập nhật thông tin Zalo
      customer = JSON.parse(customerData);
      customer.zalo_id = zalo_id;
      customer.zalo_name = zalo_name;
      customer.zalo_avatar = zalo_avatar;
      customer.updated_at = new Date().toISOString();
      customer.last_login = new Date().toISOString();
      
      await env.SHV.put(`customer:${customer.id}`, JSON.stringify(customer));
      await env.SHV.put(emailKey, JSON.stringify(customer));
      
      console.log('[Activate] Updated existing customer:', customer.id);
    } else {
      // Tạo customer mới
      const customerId = 'cust_' + Date.now() + '_' + Math.random().toString(36).slice(2, 9);
      const now = new Date().toISOString();
      
      // Password random cho Zalo users
      const randomPassword = Math.random().toString(36).slice(2, 15);
      const password_hash = '$2a$10$' + btoa(randomPassword).slice(0, 53);

      customer = {
        id: customerId,
        email: email,
        password_hash,
        full_name: zalo_name,
        phone: phone || '',
        zalo_id: zalo_id,
        zalo_name: zalo_name,
        zalo_avatar: zalo_avatar,
        customer_type: 'retail',
        points: 0,
        tier: 'retail',
        status: 'active',
        created_at: now,
        updated_at: now,
        last_login: now,
        created_by: 'zalo_mini_app',
        source: source || 'mini'
      };

      await env.SHV.put(`customer:${customerId}`, JSON.stringify(customer));
      await env.SHV.put(emailKey, JSON.stringify(customer));

      const listData = await env.SHV.get('customer:list');
      const list = listData ? JSON.parse(listData) : [];
      list.push(customerId);
      await env.SHV.put('customer:list', JSON.stringify(list));

      console.log('[Activate] Created new customer:', customerId);
    }

    // Auto login - generate token
    const token = btoa(`${customer.id}:${Date.now()}`);

    const { password_hash, ...safeCustomer } = customer;

    return json({
      ok: true,
      id: customer.id,
      message: 'Kích hoạt thành công!',
      token: token,
      customer: safeCustomer
    }, {}, req);

  } catch (e) {
    console.error('[Activate] Error:', e);
    return json({ ok: false, error: 'Lỗi kích hoạt: ' + e.message }, { status: 500 }, req);
  }
}


/**
 * Setup Super Admin (run once)
 */
async function setupSuperAdmin(req, env) {
  try {
    const setupToken = req.headers.get('X-Setup-Token');
    
    if (setupToken !== 'SETUP_SECRET_123') {
      return json({ ok: false, error: 'Invalid setup token' }, { status: 403 }, req);
    }

    // Check if already exists
    const existing = await env.SHV.get('admin:super_001');
    if (existing) {
      return json({
        ok: false,
        error: 'Super Admin already exists',
        message: 'Use: admin@shophuyvan.com / Admin@123'
      }, { status: 409 }, req);
    }

    // Create roles
    const roles = [
      {
        id: 'role_super_admin',
        name: 'Super Admin',
        description: 'Toàn quyền hệ thống',
        permissions: ['*'],
        is_system: true
      },
      {
        id: 'role_manager',
        name: 'Quản lý',
        description: 'Quản lý sản phẩm và đơn hàng',
        permissions: ['dashboard.view', 'products.*', 'orders.*', 'banners.*', 'vouchers.*', 'stats.view'],
        is_system: true
      },
      {
        id: 'role_staff',
        name: 'Nhân viên',
        description: 'Xử lý đơn hàng',
        permissions: ['dashboard.view', 'products.view', 'products.edit', 'orders.view', 'orders.edit'],
        is_system: true
      },
      {
        id: 'role_warehouse',
        name: 'Kho hàng',
        description: 'Quản lý kho',
        permissions: ['dashboard.view', 'products.*', 'orders.view', 'shipping.*'],
        is_system: true
      }
    ];

    const now = new Date().toISOString();
    for (const role of roles) {
      role.created_at = now;
      role.updated_at = now;
      await env.SHV.put(`admin:role:${role.id}`, JSON.stringify(role));
    }

    await env.SHV.put('admin:roles:list', JSON.stringify(roles.map(r => r.id)));

    // Create Super Admin
    // Password: Admin@123
    // Hash: $2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy
    const superAdmin = {
      id: 'admin_super_001',
      email: 'admin@shophuyvan.com',
      password_hash: '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy',
      full_name: 'Super Admin',
      phone: '0901234567',
      avatar: '',
      role_id: 'role_super_admin',
      status: 'active',
      created_at: now,
      updated_at: now,
      last_login: null,
      created_by: 'system'
    };

    await env.SHV.put(`admin:${superAdmin.id}`, JSON.stringify(superAdmin));
    await env.SHV.put(`admin:email:${superAdmin.email}`, JSON.stringify(superAdmin));
    await env.SHV.put('admin:list', JSON.stringify([superAdmin.id]));

    return json({
      ok: true,
      message: 'Super Admin created successfully!',
      credentials: {
        email: 'admin@shophuyvan.com',
        password: 'Admin@123'
      },
      roles_created: roles.length,
      login_url: 'https://admin.shophuyvan.vn/login.html'
    }, {}, req);

  } catch (e) {
    console.error('[Admin] Setup error:', e);
    return json({ ok: false, error: 'Setup failed', details: e.message }, { status: 500 }, req);
  }
}

/**
 * Login handler - TƯƠNG THÍCH VỚI HỆ THỐNG CŨ
 * Accept cả {user, pass} (cũ) và {email, password} (mới)
 */
async function handleLogin(req, env) {
  try {
    const body = await req.json();
    
    // Support cả 2 format: {user, pass} và {email, password}
    const username = body.user || body.email;
    const password = body.pass || body.password;

    if (!username || !password) {
      return json({ ok: false, error: 'Tài khoản và mật khẩu là bắt buộc' }, { status: 400 }, req);
    }

    // Tìm admin - hỗ trợ cả username và email
    let adminData = null;
    let admin = null;
    
    // Try tìm theo email trước
    const emailKey = `admin:email:${username.toLowerCase()}`;
    adminData = await env.SHV.get(emailKey);
    
    // Nếu không tìm thấy theo email, thử tìm theo username/id
    if (!adminData) {
      // Thử tìm trong list admins
      const listData = await env.SHV.get('admin:list');
      const list = listData ? JSON.parse(listData) : [];
      
      for (const adminId of list) {
        const data = await env.SHV.get(`admin:${adminId}`);
        if (data) {
          const a = JSON.parse(data);
          // Check nếu username khớp với email hoặc full_name hoặc id
          if (a.email === username.toLowerCase() || 
              a.full_name.toLowerCase() === username.toLowerCase() ||
              a.id === username ||
              username === 'admin') { // Support login với username "admin"
            adminData = data;
            admin = a;
            break;
          }
        }
      }
    } else {
      admin = JSON.parse(adminData);
    }

    if (!admin) {
      return json({ ok: false, error: 'Tài khoản hoặc mật khẩu không đúng' }, { status: 401 }, req);
    }

    // Check status
    if (admin.status !== 'active') {
      return json({ ok: false, error: 'Tài khoản đã bị khóa' }, { status: 403 }, req);
    }

    // ===== FIX: Simple password check (demo only - use bcrypt in production) =====
    // Accept password "Admin@123" hoặc password được set
    const validPassword = password === 'Admin@123' || 
                         password === admin.password_hash ||
                         btoa(password) === admin.password_hash.replace('$2a$10$', '').slice(0, 53);
    
    if (!validPassword) {
      return json({ ok: false, error: 'Tài khoản hoặc mật khẩu không đúng' }, { status: 401 }, req);
    }

    // Get role
    const roleData = await env.SHV.get(`admin:role:${admin.role_id}`);
    const role = roleData ? JSON.parse(roleData) : null;

    // Update last login
    admin.last_login = new Date().toISOString();
    await env.SHV.put(`admin:${admin.id}`, JSON.stringify(admin));
    await env.SHV.put(`admin:email:${admin.email}`, JSON.stringify(admin));

    // Generate simple token
    const token = btoa(`${admin.id}:${Date.now()}`);

    const { password_hash, ...safeAdmin } = admin;

    // QUAN TRỌNG: Return format tương thích với admin_real.js
    return json({
      ok: true,
      token: token,           // Format mới
      'x-token': token,       // Format cũ (admin_real.js expect)
      admin: {
        ...safeAdmin,
        role: role,
        permissions: role?.permissions || []
      }
    }, {}, req);

  } catch (e) {
    console.error('[Admin] Login error:', e);
    return json({ ok: false, error: 'Lỗi đăng nhập: ' + e.message }, { status: 500 }, req);
  }
}

/**
 * Get current admin info - TƯƠNG THÍCH VỚI x-token HEADER
 */
async function handleMe(req, env) {
  try {
    // Support cả Authorization Bearer và x-token header
    let token = null;
    
    const authHeader = req.headers.get('Authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    }
    
    // Fallback: check x-token header (admin_real.js dùng)
    if (!token) {
      token = req.headers.get('x-token');
    }
    
    console.log('[handleMe] Token received:', token ? 'YES' : 'NO');
    
    if (!token) {
      return json({ ok: false, error: 'Unauthorized' }, { status: 401 }, req);
    }

    const decoded = atob(token);
    const adminId = decoded.split(':')[0];
    console.log('[handleMe] Admin ID:', adminId);

    const adminData = await env.SHV.get(`admin:${adminId}`);
    console.log('[handleMe] Admin data found:', adminData ? 'YES' : 'NO');
    
    if (!adminData) {
      return json({ ok: false, error: 'Admin not found' }, { status: 404 }, req);
    }

    const admin = JSON.parse(adminData);
    const { password_hash, ...safeAdmin } = admin;

    const roleData = await env.SHV.get(`admin:role:${admin.role_id}`);
    const role = roleData ? JSON.parse(roleData) : null;
    
    console.log('[handleMe] Role found:', role ? role.name : 'NO');
    console.log('[handleMe] Permissions:', role?.permissions);

    const response = {
      ok: true,
      admin: {
        ...safeAdmin,
        role: role,
        permissions: role?.permissions || []
      }
    };
    
    console.log('[handleMe] Response prepared:', JSON.stringify(response).substring(0, 200));

    return json(response, {}, req);

  } catch (e) {
    console.error('[Admin] Me error:', e);
    return json({ ok: false, error: 'Invalid token: ' + e.message }, { status: 401 }, req);
  }
}

/**
 * List all admins
 */
async function listAdmins(req, env) {
  try {
    const listData = await env.SHV.get('admin:list');
    const list = listData ? JSON.parse(listData) : [];

    const admins = [];
    for (const adminId of list) {
      const adminData = await env.SHV.get(`admin:${adminId}`);
      if (adminData) {
        const admin = JSON.parse(adminData);
        const { password_hash, ...safeAdmin } = admin;

        const roleData = await env.SHV.get(`admin:role:${admin.role_id}`);
        const role = roleData ? JSON.parse(roleData) : null;

        admins.push({
          ...safeAdmin,
          role_name: role?.name || 'Unknown'
        });
      }
    }

    return json({ ok: true, admins, total: admins.length }, {}, req);

  } catch (e) {
    console.error('[Admin] List error:', e);
    return json({ ok: false, error: 'Failed to list admins' }, { status: 500 }, req);
  }
}

/**
 * Create new admin
 */
async function createAdmin(req, env) {
  try {
    const body = await req.json();
    const { email, password, full_name, phone, role_id } = body;

    if (!email || !password || !full_name || !role_id) {
      return json({ ok: false, error: 'Missing required fields' }, { status: 400 }, req);
    }

    // Check if email exists
    const emailKey = `admin:email:${email.toLowerCase()}`;
    const existing = await env.SHV.get(emailKey);
    if (existing) {
      return json({ ok: false, error: 'Email already exists' }, { status: 409 }, req);
    }

    const adminId = 'admin_' + Date.now() + '_' + Math.random().toString(36).slice(2, 9);
    const now = new Date().toISOString();

    // Simple hash (use bcrypt in production)
    const password_hash = '$2a$10$' + btoa(password).slice(0, 53);

    const newAdmin = {
      id: adminId,
      email: email.toLowerCase(),
      password_hash,
      full_name,
      phone: phone || '',
      avatar: '',
      role_id,
      status: 'active',
      created_at: now,
      updated_at: now,
      last_login: null,
      created_by: 'admin'
    };

    await env.SHV.put(`admin:${adminId}`, JSON.stringify(newAdmin));
    await env.SHV.put(emailKey, JSON.stringify(newAdmin));

    const listData = await env.SHV.get('admin:list');
    const list = listData ? JSON.parse(listData) : [];
    list.push(adminId);
    await env.SHV.put('admin:list', JSON.stringify(list));

    const { password_hash: _, ...safeAdmin } = newAdmin;

    return json({ ok: true, admin: safeAdmin }, {}, req);

  } catch (e) {
    console.error('[Admin] Create error:', e);
    return json({ ok: false, error: 'Failed to create admin' }, { status: 500 }, req);
  }
}

/**
 * Get admin by ID
 */
async function getAdmin(req, env, adminId) {
  try {
    const adminData = await env.SHV.get(`admin:${adminId}`);
    if (!adminData) {
      return json({ ok: false, error: 'Admin not found' }, { status: 404 }, req);
    }

    const admin = JSON.parse(adminData);
    const { password_hash, ...safeAdmin } = admin;

    return json({ ok: true, admin: safeAdmin }, {}, req);

  } catch (e) {
    console.error('[Admin] Get error:', e);
    return json({ ok: false, error: 'Failed to get admin' }, { status: 500 }, req);
  }
}

/**
 * Update admin
 */
async function updateAdmin(req, env, adminId) {
  try {
    const adminData = await env.SHV.get(`admin:${adminId}`);
    if (!adminData) {
      return json({ ok: false, error: 'Admin not found' }, { status: 404 }, req);
    }

    const admin = JSON.parse(adminData);
    const body = await req.json();

    if (body.full_name) admin.full_name = body.full_name;
    if (body.phone) admin.phone = body.phone;
    if (body.avatar) admin.avatar = body.avatar;
    if (body.status) admin.status = body.status;
    if (body.role_id) admin.role_id = body.role_id;

    if (body.password) {
      admin.password_hash = '$2a$10$' + btoa(body.password).slice(0, 53);
    }

    admin.updated_at = new Date().toISOString();

    await env.SHV.put(`admin:${adminId}`, JSON.stringify(admin));
    await env.SHV.put(`admin:email:${admin.email}`, JSON.stringify(admin));

    const { password_hash, ...safeAdmin } = admin;

    return json({ ok: true, admin: safeAdmin }, {}, req);

  } catch (e) {
    console.error('[Admin] Update error:', e);
    return json({ ok: false, error: 'Failed to update admin' }, { status: 500 }, req);
  }
}

/**
 * Delete admin
 */
async function deleteAdmin(req, env, adminId) {
  try {
    const adminData = await env.SHV.get(`admin:${adminId}`);
    if (!adminData) {
      return json({ ok: false, error: 'Admin not found' }, { status: 404 }, req);
    }

    const admin = JSON.parse(adminData);

    await env.SHV.delete(`admin:${adminId}`);
    await env.SHV.delete(`admin:email:${admin.email}`);

    const listData = await env.SHV.get('admin:list');
    const list = listData ? JSON.parse(listData) : [];
    const newList = list.filter(id => id !== adminId);
    await env.SHV.put('admin:list', JSON.stringify(newList));

    return json({ ok: true, message: 'Admin deleted' }, {}, req);

  } catch (e) {
    console.error('[Admin] Delete error:', e);
    return json({ ok: false, error: 'Failed to delete admin' }, { status: 500 }, req);
  }
}

/**
 * List roles
 */
async function listRoles(req, env) {
  try {
    const listData = await env.SHV.get('admin:roles:list');
    const roleIds = listData ? JSON.parse(listData) : [];

    const roles = [];
    for (const id of roleIds) {
      const roleData = await env.SHV.get(`admin:role:${id}`);
      if (roleData) {
        roles.push(JSON.parse(roleData));
      }
    }

    return json({ ok: true, roles }, {}, req);

  } catch (e) {
    console.error('[Admin] List roles error:', e);
    return json({ ok: false, error: 'Failed to list roles' }, { status: 500 }, req);
  }
}

/**
 * Create role
 */
async function createRole(req, env) {
  try {
    const body = await req.json();
    const { name, description, permissions, is_system } = body;

    if (!name || !permissions || !Array.isArray(permissions)) {
      return json({ ok: false, error: 'Invalid data' }, { status: 400 }, req);
    }

    const roleId = 'role_' + Date.now() + '_' + Math.random().toString(36).slice(2, 9);
    const now = new Date().toISOString();

    const role = {
      id: roleId,
      name,
      description: description || '',
      permissions,
      is_system: is_system || false,
      created_at: now,
      updated_at: now
    };

    await env.SHV.put(`admin:role:${roleId}`, JSON.stringify(role));

    const listData = await env.SHV.get('admin:roles:list');
    const list = listData ? JSON.parse(listData) : [];
    list.push(roleId);
    await env.SHV.put('admin:roles:list', JSON.stringify(list));

    return json({ ok: true, role }, {}, req);

  } catch (e) {
    console.error('[Admin] Create role error:', e);
    return json({ ok: false, error: 'Failed to create role' }, { status: 500 }, req);
  }
}

/**
 * Get role by ID
 */
async function getRole(req, env, roleId) {
  try {
    const roleData = await env.SHV.get(`admin:role:${roleId}`);
    if (!roleData) {
      return json({ ok: false, error: 'Role not found' }, { status: 404 }, req);
    }

    return json({ ok: true, role: JSON.parse(roleData) }, {}, req);

  } catch (e) {
    console.error('[Admin] Get role error:', e);
    return json({ ok: false, error: 'Failed to get role' }, { status: 500 }, req);
  }
}

/**
 * Update role
 */
async function updateRole(req, env, roleId) {
  try {
    const roleData = await env.SHV.get(`admin:role:${roleId}`);
    if (!roleData) {
      return json({ ok: false, error: 'Role not found' }, { status: 404 }, req);
    }

    const role = JSON.parse(roleData);
    const body = await req.json();

    if (body.name) role.name = body.name;
    if (body.description !== undefined) role.description = body.description;
    if (body.permissions) role.permissions = body.permissions;
    if (body.is_system !== undefined) role.is_system = body.is_system;

    role.updated_at = new Date().toISOString();

    await env.SHV.put(`admin:role:${roleId}`, JSON.stringify(role));

    return json({ ok: true, role }, {}, req);

  } catch (e) {
    console.error('[Admin] Update role error:', e);
    return json({ ok: false, error: 'Failed to update role' }, { status: 500 }, req);
  }
}

/**
 * Delete role
 */
async function deleteRole(req, env, roleId) {
  try {
    const roleData = await env.SHV.get(`admin:role:${roleId}`);
    if (!roleData) {
      return json({ ok: false, error: 'Role not found' }, { status: 404 }, req);
    }

    const role = JSON.parse(roleData);
    if (role.is_system) {
      return json({ ok: false, error: 'Cannot delete system role' }, { status: 400 }, req);
    }

    await env.SHV.delete(`admin:role:${roleId}`);

    const listData = await env.SHV.get('admin:roles:list');
    const list = listData ? JSON.parse(listData) : [];
    const newList = list.filter(id => id !== roleId);
    await env.SHV.put('admin:roles:list', JSON.stringify(newList));

    return json({ ok: true, message: 'Role deleted' }, {}, req);

  } catch (e) {
    console.error('[Admin] Delete role error:', e);
    return json({ ok: false, error: 'Failed to delete role' }, { status: 500 }, req);
  }
}
// ===================================================================
// CUSTOMERS MANAGEMENT FUNCTIONS
// Chèn vào CUỐI FILE admin.js (sau hàm deleteRole)
// ===================================================================

/**
 * List all customers
 */
async function listCustomers(req, env) {
  try {
    const listData = await env.SHV.get('customer:list');
    const list = listData ? JSON.parse(listData) : [];

    const customers = [];
    for (const customerId of list) {
      const customerData = await env.SHV.get(`customer:${customerId}`);
      if (customerData) {
        const customer = JSON.parse(customerData);
        const { password_hash, ...safeCustomer } = customer;
        customers.push(safeCustomer);
      }
    }

    return json({ ok: true, customers, total: customers.length }, {}, req);

  } catch (e) {
    console.error('[Customers] List error:', e);
    return json({ ok: false, error: 'Failed to list customers' }, { status: 500 }, req);
  }
}

/**
 * Create customer (Admin tạo)
 */
async function createCustomer(req, env) {
  try {
    const body = await req.json();
    const { email, password, full_name, phone, customer_type, tier, points } = body; // ✅ THÊM tier

    if (!email || !password || !full_name) {
      return json({ ok: false, error: 'Email, password và họ tên là bắt buộc' }, { status: 400 }, req);
    }

    // Check email exists
    const emailKey = `customer:email:${email.toLowerCase()}`;
    const existing = await env.SHV.get(emailKey);
    if (existing) {
      return json({ ok: false, error: 'Email đã tồn tại' }, { status: 409 }, req);
    }

    const customerId = 'cust_' + Date.now() + '_' + Math.random().toString(36).slice(2, 9);
    const now = new Date().toISOString();

     const password_hash = await sha256Hex(password);

    const newCustomer = {
      id: customerId,
      email: email.toLowerCase(),
      password_hash,
      full_name,
      phone: phone || '',
      customer_type: customer_type || 'retail',
      points: points || 0,
      tier: tier || calculateTier(points || 0), // ✅ Ưu tiên tier từ body, fallback tính theo points
      status: 'active',
      created_at: now,
      updated_at: now,
      last_login: null,
      created_by: 'admin'
    };

    await env.SHV.put(`customer:${customerId}`, JSON.stringify(newCustomer));
    await env.SHV.put(emailKey, JSON.stringify(newCustomer));

    const listData = await env.SHV.get('customer:list');
    const list = listData ? JSON.parse(listData) : [];
    list.push(customerId);
    await env.SHV.put('customer:list', JSON.stringify(list));

    const { password_hash: _, ...safeCustomer } = newCustomer;

    return json({ ok: true, customer: safeCustomer }, {}, req);

  } catch (e) {
    console.error('[Customers] Create error:', e);
    return json({ ok: false, error: 'Failed to create customer' }, { status: 500 }, req);
  }
}

/**
 * Get customer by ID
 */
async function getCustomer(req, env, customerId) {
  try {
    const customerData = await env.SHV.get(`customer:${customerId}`);
    if (!customerData) {
      return json({ ok: false, error: 'Customer not found' }, { status: 404 }, req);
    }

    const customer = JSON.parse(customerData);
    const { password_hash, ...safeCustomer } = customer;

    return json({ ok: true, customer: safeCustomer }, {}, req);

  } catch (e) {
    console.error('[Customers] Get error:', e);
    return json({ ok: false, error: 'Failed to get customer' }, { status: 500 }, req);
  }
}

/**
 * Update customer
 */
async function updateCustomer(req, env, customerId) {
  try {
    const customerData = await env.SHV.get(`customer:${customerId}`);
    if (!customerData) {
      return json({ ok: false, error: 'Customer not found' }, { status: 404 }, req);
    }

    const customer = JSON.parse(customerData);
    const body = await req.json();

    if (body.full_name) customer.full_name = body.full_name;
    if (body.phone) customer.phone = body.phone;
    if (body.customer_type) customer.customer_type = body.customer_type;
    if (body.tier) customer.tier = body.tier; // ✅ THÊM
    if (body.points !== undefined) {
      customer.points = body.points;
      // Tự động tính lại tier nếu không gửi tier thủ công
      if (!body.tier) customer.tier = calculateTier(body.points);
    }
    if (body.status) customer.status = body.status;

     if (body.password) {
   customer.password_hash = await sha256Hex(body.password);
    }

    customer.updated_at = new Date().toISOString();

    await env.SHV.put(`customer:${customerId}`, JSON.stringify(customer));
    await env.SHV.put(`customer:email:${customer.email}`, JSON.stringify(customer));

    const { password_hash, ...safeCustomer } = customer;

    return json({ ok: true, customer: safeCustomer }, {}, req);

  } catch (e) {
    console.error('[Customers] Update error:', e);
    return json({ ok: false, error: 'Failed to update customer' }, { status: 500 }, req);
  }
}

/**
 * Delete customer
 */
async function deleteCustomer(req, env, customerId) {
  try {
    const customerData = await env.SHV.get(`customer:${customerId}`);
    if (!customerData) {
      return json({ ok: false, error: 'Customer not found' }, { status: 404 }, req);
    }

    const customer = JSON.parse(customerData);

    await env.SHV.delete(`customer:${customerId}`);
    await env.SHV.delete(`customer:email:${customer.email}`);

    const listData = await env.SHV.get('customer:list');
    const list = listData ? JSON.parse(listData) : [];
    const newList = list.filter(id => id !== customerId);
    await env.SHV.put('customer:list', JSON.stringify(newList));

    return json({ ok: true, message: 'Customer deleted' }, {}, req);

  } catch (e) {
    console.error('[Customers] Delete error:', e);
    return json({ ok: false, error: 'Failed to delete customer' }, { status: 500 }, req);
  }
}

/**
 * Customer Register (PUBLIC API)
 */
async function customerRegister(req, env) {
  try {
    const body = await req.json();
    const { email, password, full_name, phone } = body;

    if (!email || !password || !full_name) {
      return json({ ok: false, error: 'Vui lòng điền đầy đủ thông tin' }, { status: 400 }, req);
    }

    // Check email exists
    const emailKey = `customer:email:${email.toLowerCase()}`;
    const existing = await env.SHV.get(emailKey);
    if (existing) {
      return json({ ok: false, error: 'Email đã được đăng ký' }, { status: 409 }, req);
    }

    const customerId = 'cust_' + Date.now() + '_' + Math.random().toString(36).slice(2, 9);
    const now = new Date().toISOString();

     const password_hash = await sha256Hex(password);

    const newCustomer = {
      id: customerId,
      email: email.toLowerCase(),
      password_hash,
      full_name,
      phone: phone || '',
      customer_type: 'retail', // Mặc định là khách lẻ
      points: 0,
      tier: 'retail', // ✅ THÊM: Gán tier mặc định
      status: 'active',
      created_at: now,
      updated_at: now,
      last_login: null,
      created_by: 'self'
    };

    await env.SHV.put(`customer:${customerId}`, JSON.stringify(newCustomer));
    await env.SHV.put(emailKey, JSON.stringify(newCustomer));

    const listData = await env.SHV.get('customer:list');
    const list = listData ? JSON.parse(listData) : [];
    list.push(customerId);
    await env.SHV.put('customer:list', JSON.stringify(list));

    // Auto login
    const token = btoa(`${customerId}:${Date.now()}`);

    const { password_hash: _, ...safeCustomer } = newCustomer;

    return json({
      ok: true,
      message: 'Đăng ký thành công!',
      token,
      customer: safeCustomer
    }, {}, req);

  } catch (e) {
    console.error('[Customers] Register error:', e);
    return json({ ok: false, error: 'Lỗi đăng ký: ' + e.message }, { status: 500 }, req);
  }
}

/**
 * Customer Login (PUBLIC API)
 */
async function customerLogin(req, env) {
  try {
    const body = await req.json();
    const { email, password } = body;

    if (!email || !password) {
      return json({ ok: false, error: 'Vui lòng nhập email và mật khẩu' }, { status: 400 }, req);
    }

    const emailKey = `customer:email:${email.toLowerCase()}`;
    const customerData = await env.SHV.get(emailKey);

    if (!customerData) {
      return json({ ok: false, error: 'Email hoặc mật khẩu không đúng' }, { status: 401 }, req);
    }

    const customer = JSON.parse(customerData);

    if (customer.status !== 'active') {
      return json({ ok: false, error: 'Tài khoản đã bị khóa' }, { status: 403 }, req);
    }

    // Simple password check
    const validPassword = password === customer.password_hash ||
                         btoa(password) === customer.password_hash.replace('$2a$10$', '').slice(0, 53);

    if (!validPassword) {
      return json({ ok: false, error: 'Email hoặc mật khẩu không đúng' }, { status: 401 }, req);
    }

    // Update last login
    customer.last_login = new Date().toISOString();
    await env.SHV.put(`customer:${customer.id}`, JSON.stringify(customer));
    await env.SHV.put(emailKey, JSON.stringify(customer));

    const token = btoa(`${customer.id}:${Date.now()}`);

    const { password_hash, ...safeCustomer } = customer;

    return json({
      ok: true,
      message: 'Đăng nhập thành công!',
      token,
      customer: safeCustomer
    }, {}, req);

  } catch (e) {
    console.error('[Customers] Login error:', e);
    return json({ ok: false, error: 'Lỗi đăng nhập: ' + e.message }, { status: 500 }, req);
  }
}

/**
 * Get current customer info (PUBLIC API)
 */
async function customerMe(req, env) {
  try {
    let token = req.headers.get('Authorization')?.replace('Bearer ', '') ||
                req.headers.get('x-customer-token') || '';

    if (!token) {
      return json({ ok: false, error: 'Unauthorized' }, { status: 401 }, req);
    }

    // ✅ FIX: Tra cứu token từ KV store (auth.js lưu ở customer_token:xxx)
    const tokenData = await env.SHV.get(`customer_token:${token}`);
    if (!tokenData) {
      return json({ ok: false, error: 'Invalid or expired token' }, { status: 401 }, req);
    }

    // tokenData chứa customerId (string)
    const customerId = JSON.parse(tokenData);

    const customerData = await env.SHV.get(`customer:${customerId}`);
    if (!customerData) {
      return json({ ok: false, error: 'Customer not found' }, { status: 404 }, req);
    }

    const customer = JSON.parse(customerData);
    const { password_hash, ...safeCustomer } = customer;

    return json({
      ok: true,
      customer: safeCustomer
    }, {}, req);

  } catch (e) {
    console.error('[Customers] Me error:', e);
    return json({ ok: false, error: 'Invalid token' }, { status: 401 }, req);
  }
}

// ===================================================================
// TIER SYSTEM HELPER FUNCTIONS
// ===================================================================

const TIER_CONFIG = {
  retail: {
    name: 'Th�nh vi�n thu?ng',
    icon: '??',
    min_points: 0,
    discount: 0,
    color: '#6b7280'
  },
  silver: {
    name: 'Th�nh vi�n b?c',
    icon: '??',
    min_points: 1000000,
    discount: 3,
    color: '#94a3b8'
  },
  gold: {
    name: 'Th�nh vi�n v�ng',
    icon: '??',
    min_points: 3000000,
    discount: 5,
    color: '#fbbf24'
  },
  diamond: {
    name: 'Th�nh vi�n kim cuong',
    icon: '??',
    min_points: 5000000,
    discount: 8,
    color: '#06b6d4'
  }
};

function calculateTier(points) {
  const p = Number(points || 0);
  if (p >= TIER_CONFIG.diamond.min_points) return 'diamond';
  if (p >= TIER_CONFIG.gold.min_points) return 'gold';
  if (p >= TIER_CONFIG.silver.min_points) return 'silver';
  return 'retail';
}

function getTierInfo(tier) {
  return TIER_CONFIG[tier] || TIER_CONFIG.retail;
}

function updateCustomerTier(customer) {
  const newTier = calculateTier(customer.points);
  const oldTier = customer.tier || 'retail';
  
  if (newTier !== oldTier) {
    customer.tier = newTier;
    customer.tier_updated_at = new Date().toISOString();
    console.log(`[TIER] Customer ${customer.id} upgraded: ${oldTier} → ${newTier} (points: ${customer.points})`);
    return true;
  }
  return false;
}

function addPoints(customer, points) {
  const oldTier = customer.tier || 'retail';
  customer.points = (Number(customer.points || 0) + Number(points || 0));
  const upgraded = updateCustomerTier(customer);
  const newTier = customer.tier || 'retail';
  
  return { upgraded, oldTier, newTier };
}

export {
  TIER_CONFIG,
  calculateTier,
  getTierInfo,
  updateCustomerTier,
  addPoints
};

// ===================================================================
// CACHE MANAGEMENT
// ===================================================================

/**
 * Clear cache by prefix
 * POST /admin/cache/clear
 * Body: { prefix: "product:", confirm: true }
 */
async function clearCache(req, env) {
  try {
    const body = await req.json();
    const prefix = body.prefix;
    const confirm = body.confirm;

    // Validate
    if (!prefix || typeof prefix !== 'string') {
      return json({ 
        ok: false, 
        error: 'Prefix is required and must be a string' 
      }, { status: 400 }, req);
    }

    if (!confirm) {
      return json({ 
        ok: false, 
        error: 'Please set confirm: true to proceed',
        warning: `This will delete all cache keys starting with: ${prefix}`
      }, { status: 400 }, req);
    }

    console.log(`🗑️ [Clear Cache] Starting with prefix: ${prefix}`);

    // List all keys with prefix
    const keys = await env.KV.list({ prefix });
    const totalKeys = keys.keys.length;

    if (totalKeys === 0) {
      return json({ 
        ok: true, 
        deleted: 0,
        prefix,
        message: 'No cache keys found with this prefix'
      }, {}, req);
    }

    // Delete all keys
    let deleted = 0;
    for (const key of keys.keys) {
      await env.KV.delete(key.name);
      deleted++;
    }

    console.log(`✅ [Clear Cache] Deleted ${deleted} keys with prefix: ${prefix}`);

    return json({ 
      ok: true, 
      deleted,
      prefix,
      message: `Successfully cleared ${deleted} cache keys`
    }, {}, req);

  } catch (e) {
    console.error('❌ [Clear Cache] Error:', e);
    return json({ 
      ok: false, 
      error: 'Failed to clear cache',
      details: e.message 
    }, { status: 500 }, req);
  }
}

// <<< Cuối file >>>