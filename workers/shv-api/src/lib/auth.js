// ===================================================================
// lib/auth.js - Authentication Helper (FIXED - Compatible with both systems)
// ===================================================================
import { superToken } from '../modules/shipping/helpers.js';
import { parseCookie } from './utils'; // thêm dòng này nếu CHƯA có


export async function sha256Hex(text) {
  const data = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(String(text || ''))
  );
  return [...new Uint8Array(data)]
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Check admin authentication
 * Compatible with BOTH old system and new admin system
 */
export async function adminOK(req, env) {
  try {
	   // === DEBUG AUTH START ===
  try {
    const u = new URL(req.url);
    const qToken = u.searchParams.get('token') || '';
    const hAuth  = req.headers.get('authorization') || '';
    const hXTok  = req.headers.get('x-token') || '';
    const cookie = req.headers.get('cookie') || '';

    console.log('[Auth][in]', {
      path: u.pathname,
      qToken_len: qToken.length,
      hasAuthHdr: !!hAuth,
      hasXToken: !!hXTok,
      hasCookie: !!cookie
    });
  } catch (e) {
    console.log('[Auth][in] parse error', e?.message || e);
  }
  // === DEBUG AUTH END ===
    const url = new URL(req.url);
    
    // Ưu tiên x-token (từ FE), sau đó Token, Bearer, query ?token, cookie
    let token =
      req.headers.get('x-token') ||
      req.headers.get('Token') ||
      ((req.headers.get('authorization') || '').match(/^Bearer\s+(.+)$/i)?.[1]) ||
      url.searchParams.get('token') ||
      parseCookie(req.headers.get('cookie') || '')['x-token'] ||
      parseCookie(req.headers.get('cookie') || '')['token'] ||
      '';
    
    token = String(token || '').trim().replace(/^"+|"+$/g, '');
    
    console.log('[Auth] Incoming token length:', token ? token.length : 0);
    
    if (!token) {
      console.log('[Auth] No token provided');
      return false;
    }

    // ===== NEW ADMIN SYSTEM CHECK =====
    // Try to decode as new admin token format (base64 encoded)
    try {
      const decoded = atob(token);
      if (decoded.includes(':')) {
        // New format: adminId:timestamp
        const adminId = decoded.split(':')[0];
        
        // Check if admin exists in new system
        const adminData = await env.SHV.get(`admin:${adminId}`);
        if (adminData) {
          const admin = JSON.parse(adminData);
          
          // Check if admin is active
          if (admin.status === 'active') {
            console.log('[Auth] Valid new admin token:', admin.email);
            return true;
          } else {
            console.log('[Auth] Admin account inactive');
            return false;
          }
        }
      }
    } catch (e) {
      // Not new format, continue to old checks
    }

    // ===== OLD SYSTEM CHECKS =====
    
    // Check 1: KV-stored session token (old auth module)
    if (env?.SHV?.get) {
      const saved = await env.SHV.get('admin_token');
      if (saved && token === saved) {
        console.log('[Auth] Valid old session token');
        return true;
      }
    }
    
    // Check 2: Static ADMIN_TOKEN from env
    if (env?.ADMIN_TOKEN) {
      const expected = await sha256Hex(env.ADMIN_TOKEN);
      if (token === expected) {
        console.log('[Auth] Valid static admin token');
        return true;
      }
    }
    
    // ===== STATIC SUPER KEY (tích hợp vận chuyển) qua helpers.superToken =====
try {
  const superKey = (await superToken(env)).trim();
  if (token && token === superKey) {
    console.log('[Auth] Valid SUPER_KEY via superToken');
    return true;
  }
} catch (e) {
  // fallback im lặng nếu có lỗi khi đọc superToken
}
    console.log('[Auth] Token validation failed');
    return false;
    
  } catch (e) {
    console.error('[Auth] adminOK error:', e);
    return false;
  }
}

/**
 * Get admin from token
 * Returns admin object if valid, null otherwise
 */
export async function getAdminFromToken(req, env) {
  try {
    const url = new URL(req.url);
    
    let token =
      req.headers.get('x-token') ||
      req.headers.get('Token') ||
      ((req.headers.get('authorization') || '').match(/^Bearer\s+(.+)$/i)?.[1]) ||
      url.searchParams.get('token') ||
      parseCookie(req.headers.get('cookie') || '')['x-token'] ||
      '';
    
    token = String(token || '').trim().replace(/^"+|"+$/g, '');
    
    if (!token) return null;

    // Try new admin format
    try {
      const decoded = atob(token);
      if (decoded.includes(':')) {
        const adminId = decoded.split(':')[0];
        const adminData = await env.SHV.get(`admin:${adminId}`);
        
        if (adminData) {
          const admin = JSON.parse(adminData);
          
          if (admin.status === 'active') {
            // Get role and permissions
            const roleData = await env.SHV.get(`admin:role:${admin.role_id}`);
            const role = roleData ? JSON.parse(roleData) : null;
            
            return {
              ...admin,
              role: role,
              permissions: role?.permissions || []
            };
          }
        }
      }
    } catch (e) {
      // Not valid format
    }
    
    return null;
  } catch (e) {
    console.error('[Auth] getAdminFromToken error:', e);
    return null;
  }
}

/**
 * Check if admin has specific permission
 */
export function hasPermission(admin, requiredPermission) {
  if (!admin || !admin.permissions) return false;
  
  const permissions = admin.permissions;
  
  // Super admin has all permissions
  if (permissions.includes('*')) return true;
  
  // Exact match
  if (permissions.includes(requiredPermission)) return true;
  
  // Wildcard match (e.g. products.* matches products.view)
  const parts = requiredPermission.split('.');
  if (parts.length === 2) {
    if (permissions.includes(`${parts[0]}.*`)) return true;
  }
  
  return false;
}

/**
 * Middleware to check permission
 * Usage: await requirePermission(req, env, 'products.view')
 */
export async function requirePermission(req, env, permission) {
  const admin = await getAdminFromToken(req, env);
  
  if (!admin) {
    return {
      ok: false,
      error: 'Unauthorized - Please login',
      status: 401
    };
  }
  
  if (!hasPermission(admin, permission)) {
    return {
      ok: false,
      error: 'Forbidden - You do not have permission to access this resource',
      required: permission,
      your_permissions: admin.permissions,
      status: 403
    };
  }
  
  return { ok: true, admin };
}