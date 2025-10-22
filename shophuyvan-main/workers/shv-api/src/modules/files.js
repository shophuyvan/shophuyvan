// ===================================================================
// BONUS: modules/files.js - File Upload Module (if needed)
// ===================================================================

import { json, errorResponse, corsHeaders } from '../lib/response.js';
import { adminOK } from '../lib/auth.js';
import { getJSON } from '../lib/kv.js';

/**
 * Main handler for file routes
 */
export async function handle(req, env, ctx) {
  const url = new URL(req.url);
  const path = url.pathname;
  const method = req.method;

  // Download file
  if (path.startsWith('/file/') && method === 'GET') {
    return downloadFile(req, env, path);
  }

  // Upload files (admin only)
  if ((path === '/admin/upload' || path === '/admin/files') && method === 'POST') {
    return uploadFiles(req, env);
  }

  // Responsive image proxy
  if (path.startsWith('/img/') && method === 'GET') {
    return proxyImage(req, env, path);
  }

  return errorResponse('Route not found', 404, req);
}

/**
 * Download file from KV
 */
async function downloadFile(req, env, path) {
  try {
    const id = path.split('/').pop();
    
    const meta = await getJSON(env, 'file:' + id + ':meta', null);
    const data = await env.SHV.get('file:' + id, 'arrayBuffer');

    if (!data || !meta) {
      return new Response('File not found', { 
        status: 404, 
        headers: corsHeaders(req) 
      });
    }

    const headers = {
      'Content-Type': (meta && meta.type) || 'application/octet-stream',
      'Cache-Control': 'public, max-age=31536000, immutable',
      ...corsHeaders(req)
    };

    return new Response(data, { status: 200, headers });
  } catch (e) {
    return errorResponse(e, 500, req);
  }
}

/**
 * Upload files to KV (multipart/form-data)
 */
async function uploadFiles(req, env) {
  if (!(await adminOK(req, env))) {
    return errorResponse('Unauthorized', 401, req);
  }

  try {
    const contentType = req.headers.get('content-type') || '';
    
    if (!contentType.startsWith('multipart/form-data')) {
      return errorResponse('Expected multipart/form-data', 400, req);
    }

    const formData = await req.formData();
    const files = [];

    for (const [key, value] of formData.entries()) {
      if (value && typeof value === 'object' && 'arrayBuffer' in value) {
        files.push(value);
      }
    }

    const urls = [];
    const origin = new URL(req.url).origin;

    for (const file of files) {
      const id = crypto.randomUUID().replace(/-/g, '');
      const buffer = await file.arrayBuffer();

      await env.SHV.put('file:' + id, buffer);
      await env.SHV.put('file:' + id + ':meta', JSON.stringify({
        name: file.name,
        type: file.type,
        size: file.size
      }));

      urls.push(origin + '/file/' + id);
    }

    return json({ ok: true, urls }, {}, req);
  } catch (e) {
    return errorResponse(e, 500, req);
  }
}

/**
 * Proxy image with Cloudflare Image Resizing
 */
async function proxyImage(req, env, path) {
  try {
    const id = path.split('/').pop();
    const url = new URL(req.url);
    
    const width = Number(url.searchParams.get('w') || 0) || undefined;
    const quality = Number(url.searchParams.get('q') || 0) || undefined;
    const format = url.searchParams.get('format') || 'auto';
    
    const src = new URL('/file/' + id, url.origin).toString();
    
    const response = await fetch(src, {
      cf: {
        image: {
          width,
          quality,
          format,
          fit: 'cover'
        }
      }
    });

    const headers = new Headers(response.headers);
    headers.set('cache-control', 'public, max-age=31536000, immutable');
    
    Object.entries(corsHeaders(req)).forEach(([key, value]) => {
      headers.set(key, value);
    });

    return new Response(response.body, {
      status: response.status,
      headers
    });
  } catch (e) {
    return errorResponse(e, 500, req);
  }
}