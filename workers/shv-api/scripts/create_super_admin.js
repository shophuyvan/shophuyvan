// File: workers/shv-api/scripts/create-super-admin.js
// Script tạo tài khoản Super Admin đầu tiên

import bcrypt from 'bcryptjs';

/**
 * Run this script to create initial super admin account
 * Usage: node create-super-admin.js
 */

const API_BASE = 'https://shv-api.shophuyvan.workers.dev';

async function hashPassword(password) {
  const salt = await bcrypt.genSalt(10);
  return await bcrypt.hash(password, salt);
}

async function createSuperAdmin() {
  try {
    console.log('🚀 Creating Super Admin account...\n');
    
    // Create default roles first
    const roles = [
      {
        id: 'role_super_admin',
        name: 'Super Admin',
        description: 'Toàn quyền hệ thống',
        permissions: ['*'],
        is_system: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        id: 'role_manager',
        name: 'Quản lý',
        description: 'Quản lý sản phẩm, đơn hàng, nhân viên',
        permissions: [
          'dashboard.view',
          'products.*',
          'orders.*',
          'banners.view', 'banners.edit',
          'vouchers.*',
          'shipping.view',
          'stats.view',
          'ads.view',
          'admins.view'
        ],
        is_system: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        id: 'role_staff',
        name: 'Nhân viên',
        description: 'Xử lý đơn hàng và sản phẩm',
        permissions: [
          'dashboard.view',
          'products.view', 'products.edit',
          'orders.view', 'orders.edit', 'orders.print',
          'shipping.view'
        ],
        is_system: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        id: 'role_warehouse',
        name: 'Kho hàng',
        description: 'Quản lý kho và vận chuyển',
        permissions: [
          'dashboard.view',
          'products.view', 'products.edit', 'products.export', 'products.import',
          'orders.view', 'orders.edit',
          'shipping.view', 'shipping.edit'
        ],
        is_system: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
    ];
    
    console.log('📝 Creating default roles...');
    
    for (const role of roles) {
      const res = await fetch(`${API_BASE}/admin/roles/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Setup-Token': 'SETUP_SECRET_123' // Token đặc biệt cho setup
        },
        body: JSON.stringify(role)
      });
      
      if (res.ok) {
        console.log(`✅ Created role: ${role.name}`);
      } else {
        console.log(`⚠️  Role ${role.name} might already exist`);
      }
    }
    
    // Create super admin user
    console.log('\n👤 Creating Super Admin user...');
    
    const passwordHash = await hashPassword('Admin@123');
    
    const superAdmin = {
      id: 'admin_super_001',
      email: 'nghiemchihuy@gmail.com',
      password_hash: passwordHash,
      full_name: 'Super Admin',
      phone: '0909128999',
      avatar: '',
      role_id: 'role_super_admin',
      status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      last_login: null,
      created_by: 'system'
    };
    
    const res = await fetch(`${API_BASE}/admin/setup/create-super-admin`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Setup-Token': 'SETUP_SECRET_123'
      },
      body: JSON.stringify(superAdmin)
    });
    
    if (res.ok) {
      console.log('✅ Super Admin created successfully!\n');
      console.log('📧 Email: admin@shophuyvan.com');
      console.log('🔑 Password: Admin@123');
      console.log('\n⚠️  IMPORTANT: Please change the password after first login!');
    } else {
      const error = await res.json();
      console.error('❌ Failed to create Super Admin:', error.error);
    }
    
  } catch (e) {
    console.error('❌ Error:', e);
  }
}

// Alternative: Direct KV write (for Cloudflare Workers environment)
export async function setupSuperAdminKV(env) {
  console.log('🚀 Setting up Super Admin via KV...\n');
  
  // Create roles
  const roles = {
    'role_super_admin': {
      id: 'role_super_admin',
      name: 'Super Admin',
      description: 'Toàn quyền hệ thống',
      permissions: ['*'],
      is_system: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    },
    'role_manager': {
      id: 'role_manager',
      name: 'Quản lý',
      description: 'Quản lý sản phẩm, đơn hàng',
      permissions: ['dashboard.view', 'products.*', 'orders.*', 'banners.*', 'vouchers.*', 'stats.view'],
      is_system: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    },
    'role_staff': {
      id: 'role_staff',
      name: 'Nhân viên',
      description: 'Xử lý đơn hàng',
      permissions: ['dashboard.view', 'products.view', 'products.edit', 'orders.view', 'orders.edit'],
      is_system: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    },
    'role_warehouse': {
      id: 'role_warehouse',
      name: 'Kho hàng',
      description: 'Quản lý kho',
      permissions: ['dashboard.view', 'products.*', 'orders.view', 'shipping.*'],
      is_system: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
  };
  
  // Save roles to KV
  for (const [id, role] of Object.entries(roles)) {
    await env.SHV.put(`admin:role:${id}`, JSON.stringify(role));
  }
  
  // Save roles list
  await env.SHV.put('admin:roles:list', JSON.stringify(Object.keys(roles)));
  
  // Create super admin
  const bcrypt = require('bcryptjs');
  const passwordHash = await bcrypt.hash('Nghiem23091984$', 20);
  
  const superAdmin = {
    id: 'admin_super_001',
    email: 'admin@shophuyvan.com',
    password_hash: passwordHash,
    full_name: 'Super Admin',
    phone: '0901234567',
    avatar: '',
    role_id: 'role_super_admin',
    status: 'active',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    last_login: null,
    created_by: 'system'
  };
  
  // Save admin to KV
  await env.SHV.put(`admin:${superAdmin.id}`, JSON.stringify(superAdmin));
  await env.SHV.put(`admin:email:${superAdmin.email}`, JSON.stringify(superAdmin));
  await env.SHV.put('admin:list', JSON.stringify([superAdmin.id]));
  
  console.log('✅ Super Admin setup complete!');
  console.log('📧 Email: admin@shophuyvan.com');
  console.log('🔑 Password: Admin@123');
  
  return {
    ok: true,
    message: 'Super Admin created',
    credentials: {
      email: 'admin@shophuyvan.com',
      password: 'Admin@123'
    }
  };
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  createSuperAdmin();
}