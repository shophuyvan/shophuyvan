// ===================================================================
// workers/shv-api/src/modules/auth.js - Authentication Module
// ===================================================================

import { json, errorResponse } from '../lib/response.js';
import { adminOK, sha256Hex } from '../lib/auth.js';
import { readBody } from '../lib/utils.js';

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

  return errorResponse('Route not found', 404, req);
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
