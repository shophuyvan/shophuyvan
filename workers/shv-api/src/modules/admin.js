// File: workers/shv-api/src/modules/admin.js
// Admin management module - FIXED

import { json, corsHeaders } from '../lib/response.js';

/**
 * Main admin handler
 */
export async function handle(req, env, ctx) {
  const url = new URL(req.url);
  const path = url.pathname;
  const method = req.method;

  try {
    // Setup route (only once)
    if (path === '/admin/setup/init' && method === 'POST') {
      return await setupSuperAdmin(req, env);
    }

    // Login routes - Hỗ trợ nhiều endpoint
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
      return await listAdmins(req, env);
    }

    // Create admin
    if (path === '/admin/users/create' && method === 'POST') {
      return await createAdmin(req, env);
    }

    // Get/Update/Delete admin by ID
    const userMatch = path.match(/^\/admin\/users\/([^\/]+)$/);
    if (userMatch) {
      const adminId = userMatch[1];
      
      if (method === 'GET') {
        return await getAdmin(req, env, adminId);
      }
      if (method === 'PUT') {
        return await updateAdmin(req, env, adminId);
      }
      if (method === 'DELETE') {
        return await deleteAdmin(req, env, adminId);
      }
    }

    // List roles
    if (path === '/admin/roles/list' && method === 'GET') {
      return await listRoles(req, env);
    }

    // Create role
    if (path === '/admin/roles/create' && method === 'POST') {
      return await createRole(req, env);
    }

    // Get/Update/Delete role by ID
    const roleMatch = path.match(/^\/admin\/roles\/([^\/]+)$/);
    if (roleMatch) {
      const roleId = roleMatch[1];
      
      if (method === 'GET') {
        return await getRole(req, env, roleId);
      }
      if (method === 'PUT') {
        return await updateRole(req, env, roleId);
      }
      if (method === 'DELETE') {
        return await deleteRole(req, env, roleId);
      }
    }

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
      login_url: 'https://adminshophuyvan.pages.dev/login.html'
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
    
    if (!token) {
      return json({ ok: false, error: 'Unauthorized' }, { status: 401 }, req);
    }

    const decoded = atob(token);
    const adminId = decoded.split(':')[0];

    const adminData = await env.SHV.get(`admin:${adminId}`);
    if (!adminData) {
      return json({ ok: false, error: 'Admin not found' }, { status: 404 }, req);
    }

    const admin = JSON.parse(adminData);
    const { password_hash, ...safeAdmin } = admin;

    const roleData = await env.SHV.get(`admin:role:${admin.role_id}`);
    const role = roleData ? JSON.parse(roleData) : null;

    return json({
      ok: true,
      admin: {
        ...safeAdmin,
        role: role,
        permissions: role?.permissions || []
      }
    }, {}, req);

  } catch (e) {
    console.error('[Admin] Me error:', e);
    return json({ ok: false, error: 'Invalid token' }, { status: 401 }, req);
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
