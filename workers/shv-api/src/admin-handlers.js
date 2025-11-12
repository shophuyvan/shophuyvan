// File: workers/shv-api/src/admin-handlers.js
// API handlers cho quản lý admin và phân quyền
// Đã bỏ bcryptjs và @tsndr/cloudflare-worker-jwt để tránh lỗi bundler trên Cloudflare Worker

const JWT_SECRET = 'YOUR_SECRET_KEY_CHANGE_THIS'; // Nên lưu trong env.JWT_SECRET

const encoder = new TextEncoder();

/**
 * Base64URL encode (dùng cho JWT)
 */
function base64UrlEncode(input) {
  let bytes;
  if (typeof input === 'string') {
    bytes = encoder.encode(input);
  } else {
    bytes = new Uint8Array(input);
  }
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

/**
 * Base64URL decode → string
 */
function base64UrlDecodeToString(input) {
  input = input.replace(/-/g, '+').replace(/_/g, '/');
  const pad = input.length % 4;
  if (pad) input += '='.repeat(4 - pad);
  const binary = atob(input);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
}

/**
 * HMAC-SHA256 (dùng cho JWT & hash password)
 */
async function hmacSha256(data, secret) {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(data));
  return base64UrlEncode(new Uint8Array(sig));
}


/**
 * Hash password
 * Dùng HMAC-SHA256 với JWT_SECRET, tránh phụ thuộc bcryptjs
 */
async function hashPassword(password) {
  // Kết quả: base64url(HMAC_SHA256(password, JWT_SECRET))
  return await hmacSha256(password, JWT_SECRET);
}

/**
 * Verify password
 */
async function verifyPassword(password, hash) {
  const hashed = await hashPassword(password);
  return hashed === hash;
}

/**
 * Generate JWT token (HS256)
 */
async function generateToken(admin) {
  const header = {
    alg: 'HS256',
    typ: 'JWT',
  };

  const payload = {
    id: admin.id,
    email: admin.email,
    role_id: admin.role_id,
    exp: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60, // 7 days
  };

  const headerB64 = base64UrlEncode(JSON.stringify(header));
  const payloadB64 = base64UrlEncode(JSON.stringify(payload));
  const unsigned = `${headerB64}.${payloadB64}`;

  const sig = await hmacSha256(unsigned, JWT_SECRET);
  return `${unsigned}.${sig}`;
}

/**
 * Verify JWT token
 */
async function verifyToken(token) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const [headerB64, payloadB64, sig] = parts;
    const unsigned = `${headerB64}.${payloadB64}`;
    const expectedSig = await hmacSha256(unsigned, JWT_SECRET);
    if (sig !== expectedSig) return null;

    const payloadJson = base64UrlDecodeToString(payloadB64);
    const payload = JSON.parse(payloadJson);

    if (payload.exp && Date.now() / 1000 > payload.exp) {
      return null;
    }

    return payload;
  } catch (e) {
    console.error('[AdminAuth] verifyToken error:', e);
    return null;
  }
}

/**
 * Check permission
 */
function hasPermission(adminPermissions, requiredPermission) {
  if (!adminPermissions || !Array.isArray(adminPermissions)) return false;
  
  // Super admin có tất cả quyền
  if (adminPermissions.includes('*')) return true;
  
  // Exact match
  if (adminPermissions.includes(requiredPermission)) return true;
  
  // Wildcard match (e.g., "products.*" matches "products.view")
  const parts = requiredPermission.split('.');
  if (parts.length === 2) {
    const wildcardPerm = `${parts[0]}.*`;
    if (adminPermissions.includes(wildcardPerm)) return true;
  }
  
  return false;
}

/**
 * POST /admin/auth/login
 * Đăng nhập admin
 */
export async function handleAdminLogin(request, env) {
  try {
    const { email, password } = await request.json();
    
    if (!email || !password) {
      return Response.json(
        { ok: false, error: 'Email và password là bắt buộc' },
        { status: 400 }
      );
    }
    
    // Lấy admin từ KV
    const adminKey = `admin:email:${email.toLowerCase()}`;
    const adminData = await env.SHV.get(adminKey);
    
    if (!adminData) {
      return Response.json(
        { ok: false, error: 'Email hoặc mật khẩu không đúng' },
        { status: 401 }
      );
    }
    
    const admin = JSON.parse(adminData);
    
    // Check status
    if (admin.status !== 'active') {
      return Response.json(
        { ok: false, error: 'Tài khoản đã bị khóa hoặc vô hiệu hóa' },
        { status: 403 }
      );
    }
    
    // Verify password
    const isValid = await verifyPassword(password, admin.password_hash);
    
    if (!isValid) {
      return Response.json(
        { ok: false, error: 'Email hoặc mật khẩu không đúng' },
        { status: 401 }
      );
    }
    
    // Lấy role và permissions
    const roleData = await env.SHV.get(`admin:role:${admin.role_id}`);
    const role = roleData ? JSON.parse(roleData) : null;
    
    // Update last login
    admin.last_login = new Date().toISOString();
    await env.SHV.put(`admin:${admin.id}`, JSON.stringify(admin));
    await env.SHV.put(adminKey, JSON.stringify(admin));
    
    // Generate token
    const token = await generateToken(admin);
    
    // Return response (không trả password_hash)
    const { password_hash, ...safeAdmin } = admin;
    
    return Response.json({
      ok: true,
      token,
      admin: {
        ...safeAdmin,
        role: role,
        permissions: role?.permissions || []
      }
    });
  } catch (e) {
    console.error('[AdminAuth] Login error:', e);
    return Response.json(
      { ok: false, error: 'Lỗi đăng nhập' },
      { status: 500 }
    );
  }
}

/**
 * GET /admin/auth/me
 * Lấy thông tin admin hiện tại
 */
export async function handleAdminMe(request, env) {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return Response.json(
        { ok: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    const token = authHeader.substring(7);
    const payload = await verifyToken(token);
    
    if (!payload) {
      return Response.json(
        { ok: false, error: 'Invalid token' },
        { status: 401 }
      );
    }
    
    // Lấy admin info
    const adminData = await env.SHV.get(`admin:${payload.id}`);
    if (!adminData) {
      return Response.json(
        { ok: false, error: 'Admin not found' },
        { status: 404 }
      );
    }
    
    const admin = JSON.parse(adminData);
    const { password_hash, ...safeAdmin } = admin;
    
    // Lấy role
    const roleData = await env.SHV.get(`admin:role:${admin.role_id}`);
    const role = roleData ? JSON.parse(roleData) : null;
    
    return Response.json({
      ok: true,
      admin: {
        ...safeAdmin,
        role: role,
        permissions: role?.permissions || []
      }
    });
  } catch (e) {
    console.error('[AdminAuth] Me error:', e);
    return Response.json(
      { ok: false, error: 'Internal error' },
      { status: 500 }
    );
  }
}

/**
 * POST /admin/users/create
 * Tạo admin mới (cần quyền admins.create)
 */
export async function handleCreateAdmin(request, env, currentAdmin) {
  try {
    const body = await request.json();
    const { email, password, full_name, phone, role_id } = body;
    
    // Validate
    if (!email || !password || !full_name || !role_id) {
      return Response.json(
        { ok: false, error: 'Thiếu thông tin bắt buộc' },
        { status: 400 }
      );
    }
    
    // Check email exists
    const emailKey = `admin:email:${email.toLowerCase()}`;
    const existing = await env.SHV.get(emailKey);
    
    if (existing) {
      return Response.json(
        { ok: false, error: 'Email đã tồn tại' },
        { status: 409 }
      );
    }
    
    // Verify role exists
    const roleData = await env.SHV.get(`admin:role:${role_id}`);
    if (!roleData) {
      return Response.json(
        { ok: false, error: 'Role không tồn tại' },
        { status: 400 }
      );
    }
    
    // Create admin
    const adminId = 'adm_' + Date.now() + '_' + Math.random().toString(36).slice(2);
    const passwordHash = await hashPassword(password);
    
    const newAdmin = {
      id: adminId,
      email: email.toLowerCase(),
      password_hash: passwordHash,
      full_name,
      phone: phone || '',
      avatar: '',
      role_id,
      status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      last_login: null,
      created_by: currentAdmin.id
    };
    
    // Save to KV
    await env.SHV.put(`admin:${adminId}`, JSON.stringify(newAdmin));
    await env.SHV.put(emailKey, JSON.stringify(newAdmin));
    
    // Add to admin list
    const listKey = 'admin:list';
    const listData = await env.SHV.get(listKey);
    const list = listData ? JSON.parse(listData) : [];
    list.push(adminId);
    await env.SHV.put(listKey, JSON.stringify(list));
    
    const { password_hash, ...safeAdmin } = newAdmin;
    
    return Response.json({
      ok: true,
      admin: safeAdmin
    });
  } catch (e) {
    console.error('[AdminUsers] Create error:', e);
    return Response.json(
      { ok: false, error: 'Lỗi tạo admin' },
      { status: 500 }
    );
  }
}

/**
 * GET /admin/users/list
 * Lấy danh sách admin (cần quyền admins.view)
 */
export async function handleListAdmins(request, env) {
  try {
    const listData = await env.SHV.get('admin:list');
    const list = listData ? JSON.parse(listData) : [];
    
    const admins = [];
    
    for (const adminId of list) {
      const adminData = await env.SHV.get(`admin:${adminId}`);
      if (adminData) {
        const admin = JSON.parse(adminData);
        const { password_hash, ...safeAdmin } = admin;
        
        // Get role
        const roleData = await env.SHV.get(`admin:role:${admin.role_id}`);
        const role = roleData ? JSON.parse(roleData) : null;
        
        admins.push({
          ...safeAdmin,
          role_name: role?.name || 'Unknown'
        });
      }
    }
    
    return Response.json({
      ok: true,
      admins,
      total: admins.length
    });
  } catch (e) {
    console.error('[AdminUsers] List error:', e);
    return Response.json(
      { ok: false, error: 'Lỗi lấy danh sách' },
      { status: 500 }
    );
  }
}

/**
 * PUT /admin/users/:id
 * Cập nhật admin (cần quyền admins.edit)
 */
export async function handleUpdateAdmin(request, env, adminId, currentAdmin) {
  try {
    const body = await request.json();
    
    const adminData = await env.SHV.get(`admin:${adminId}`);
    if (!adminData) {
      return Response.json(
        { ok: false, error: 'Admin không tồn tại' },
        { status: 404 }
      );
    }
    
    const admin = JSON.parse(adminData);
    
    // Update fields
    if (body.full_name) admin.full_name = body.full_name;
    if (body.phone) admin.phone = body.phone;
    if (body.avatar) admin.avatar = body.avatar;
    if (body.status) admin.status = body.status;
    
    // Update role (chỉ super admin mới được đổi role)
    if (body.role_id && currentAdmin.permissions.includes('*')) {
      admin.role_id = body.role_id;
    }
    
    // Update password nếu có
    if (body.new_password) {
      admin.password_hash = await hashPassword(body.new_password);
    }
    
    admin.updated_at = new Date().toISOString();
    
    // Save
    await env.SHV.put(`admin:${adminId}`, JSON.stringify(admin));
    await env.SHV.put(`admin:email:${admin.email}`, JSON.stringify(admin));
    
    const { password_hash, ...safeAdmin } = admin;
    
    return Response.json({
      ok: true,
      admin: safeAdmin
    });
  } catch (e) {
    console.error('[AdminUsers] Update error:', e);
    return Response.json(
      { ok: false, error: 'Lỗi cập nhật' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /admin/users/:id
 * Xóa admin (cần quyền admins.delete)
 */
export async function handleDeleteAdmin(request, env, adminId, currentAdmin) {
  try {
    // Không cho xóa chính mình
    if (adminId === currentAdmin.id) {
      return Response.json(
        { ok: false, error: 'Không thể xóa chính mình' },
        { status: 400 }
      );
    }
    
    const adminData = await env.SHV.get(`admin:${adminId}`);
    if (!adminData) {
      return Response.json(
        { ok: false, error: 'Admin không tồn tại' },
        { status: 404 }
      );
    }
    
    const admin = JSON.parse(adminData);
    
    // Delete from KV
    await env.SHV.delete(`admin:${adminId}`);
    await env.SHV.delete(`admin:email:${admin.email}`);
    
    // Remove from list
    const listData = await env.SHV.get('admin:list');
    const list = listData ? JSON.parse(listData) : [];
    const newList = list.filter(id => id !== adminId);
    await env.SHV.put('admin:list', JSON.stringify(newList));
    
    return Response.json({
      ok: true,
      message: 'Đã xóa admin'
    });
  } catch (e) {
    console.error('[AdminUsers] Delete error:', e);
    return Response.json(
      { ok: false, error: 'Lỗi xóa admin' },
      { status: 500 }
    );
  }
}

/**
 * Middleware: Verify admin token and permissions
 */
export async function verifyAdminAuth(request, env, requiredPermission = null) {
  const authHeader = request.headers.get('Authorization');
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { error: 'Unauthorized', status: 401 };
  }
  
  const token = authHeader.substring(7);
  const payload = await verifyToken(token);
  
  if (!payload) {
    return { error: 'Invalid token', status: 401 };
  }
  
  // Get admin
  const adminData = await env.SHV.get(`admin:${payload.id}`);
  if (!adminData) {
    return { error: 'Admin not found', status: 404 };
  }
  
  const admin = JSON.parse(adminData);
  
  if (admin.status !== 'active') {
    return { error: 'Account inactive', status: 403 };
  }
  
  // Get role and permissions
  const roleData = await env.SHV.get(`admin:role:${admin.role_id}`);
  const role = roleData ? JSON.parse(roleData) : null;
  const permissions = role?.permissions || [];
  
  // Check permission if required
  if (requiredPermission && !hasPermission(permissions, requiredPermission)) {
    return { error: 'Insufficient permissions', status: 403 };
  }
  
  return {
    ok: true,
    admin: {
      ...admin,
      permissions
    }
  };
}

export { hasPermission };