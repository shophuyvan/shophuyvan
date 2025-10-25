// ===================================================================
// lib/auth.js - Authentication Helper (FIXED - Compatible with both systems)
// ===================================================================
import { superToken } from '../modules/shipping/helpers.js';

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
    const url = new URL(req.url);
    
    // Get token from multiple sources
    let token = req.headers.get('Token') ||
            req.headers.get('x-token') ||
            req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '') ||
            url.searchParams.get('token') ||
            '';

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