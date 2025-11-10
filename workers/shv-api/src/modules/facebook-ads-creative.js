// File: workers/shv-api/src/modules/facebook-ads-creative.js
// Creative Management - Upload, Store, Bulk Ads Creation
// ===================================================================

import { json, errorResponse } from '../lib/response.js';
import { adminOK } from '../lib/auth.js';
import { getJSON, putJSON } from '../lib/kv.js';

/**
 * Main handler for creative routes
 */
export async function handle(req, env, ctx) {
  const url = new URL(req.url);
  const path = url.pathname;
  const method = req.method;

  // Upload creative
  if (path === '/admin/facebook/creatives/upload' && method === 'POST') {
    return uploadCreative(req, env);
  }

  // List creatives
  if (path === '/admin/facebook/creatives' && method === 'GET') {
    return listCreatives(req, env);
  }

  // Delete creative
  if (path.match(/^\/admin\/facebook\/creatives\/([^\/]+)$/) && method === 'DELETE') {
    const creativeId = path.match(/^\/admin\/facebook\/creatives\/([^\/]+)$/)[1];
    return deleteCreative(req, env, creativeId);
  }

  // Bulk create ads
  if (path === '/admin/facebook/ads/bulk-create' && method === 'POST') {
    return bulkCreateAds(req, env);
  }

  return errorResponse('Route not found', 404, req);
}

// ===================================================================
// UPLOAD CREATIVE
// ===================================================================

async function uploadCreative(req, env) {
  if (!(await adminOK(req, env))) {
    return errorResponse('Unauthorized', 401, req);
  }

  try {
    const formData = await req.formData();
    const file = formData.get('file');
    const name = formData.get('name') || 'Untitled';
    const tags = formData.get('tags') || '';

    if (!file) {
      return json({ ok: false, error: 'Thiếu file' }, { status: 400 }, req);
    }

    // Get file info
    const fileType = file.type;
    const fileSize = file.size;
    const fileName = file.name;

    // Validate
    const validTypes = ['image/jpeg', 'image/png', 'image/jpg', 'video/mp4'];
    if (!validTypes.includes(fileType)) {
      return json({ ok: false, error: 'File type không hợp lệ' }, { status: 400 }, req);
    }

    if (fileSize > 10 * 1024 * 1024) {
      return json({ ok: false, error: 'File quá lớn (max 10MB)' }, { status: 400 }, req);
    }

    // Upload to Cloudinary (giả sử có env.CLOUDINARY_URL)
    const cloudinaryUrl = await uploadToCloudinary(file, env);

    if (!cloudinaryUrl) {
      return json({ ok: false, error: 'Upload thất bại' }, { status: 500 }, req);
    }

    // Save to KV
    const creativeId = 'creative_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
    const creative = {
      id: creativeId,
      name,
      tags,
      type: fileType.startsWith('video') ? 'video' : 'image',
      url: cloudinaryUrl,
      file_name: fileName,
      file_size: fileSize,
      created_at: new Date().toISOString()
    };

    // Get current list
    const creatives = await getJSON(env, 'facebook:creatives:list', []);
    creatives.unshift(creative);
    
    // Keep only last 100
    if (creatives.length > 100) {
      creatives.splice(100);
    }

    await putJSON(env, 'facebook:creatives:list', creatives);

    return json({
      ok: true,
      creative: creative,
      message: 'Upload thành công'
    }, {}, req);

  } catch (e) {
    console.error('[Creative] Upload error:', e);
    return errorResponse(e, 500, req);
  }
}

/**
 * Upload file to Cloudinary
 */
async function uploadToCloudinary(file, env) {
  try {
    // Read file as ArrayBuffer
    const arrayBuffer = await file.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    
    // Convert to base64
    let binary = '';
    for (let i = 0; i < uint8Array.byteLength; i++) {
      binary += String.fromCharCode(uint8Array[i]);
    }
    const base64 = btoa(binary);
    const dataUrl = `data:${file.type};base64,${base64}`;

    // Upload to Cloudinary (cần có CLOUDINARY_UPLOAD_PRESET trong env)
    const cloudName = 'YOUR_CLOUD_NAME'; // TODO: Thay bằng cloud name thật
    const uploadPreset = env.CLOUDINARY_UPLOAD_PRESET || 'unsigned_preset';

    const formData = new FormData();
    formData.append('file', dataUrl);
    formData.append('upload_preset', uploadPreset);

    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${cloudName}/upload`,
      {
        method: 'POST',
        body: formData
      }
    );

    const result = await response.json();
    
    if (result.secure_url) {
      return result.secure_url;
    }

    return null;

  } catch (e) {
    console.error('[Cloudinary] Upload error:', e);
    return null;
  }
}

// ===================================================================
// LIST CREATIVES
// ===================================================================

async function listCreatives(req, env) {
  if (!(await adminOK(req, env))) {
    return errorResponse('Unauthorized', 401, req);
  }

  try {
    const creatives = await getJSON(env, 'facebook:creatives:list', []);

    return json({
      ok: true,
      creatives: creatives,
      total: creatives.length
    }, {}, req);

  } catch (e) {
    console.error('[Creative] List error:', e);
    return errorResponse(e, 500, req);
  }
}

// ===================================================================
// DELETE CREATIVE
// ===================================================================

async function deleteCreative(req, env, creativeId) {
  if (!(await adminOK(req, env))) {
    return errorResponse('Unauthorized', 401, req);
  }

  try {
    const creatives = await getJSON(env, 'facebook:creatives:list', []);
    const newCreatives = creatives.filter(c => c.id !== creativeId);

    if (newCreatives.length === creatives.length) {
      return json({ ok: false, error: 'Không tìm thấy creative' }, { status: 404 }, req);
    }

    await putJSON(env, 'facebook:creatives:list', newCreatives);

    return json({
      ok: true,
      message: 'Đã xóa creative'
    }, {}, req);

  } catch (e) {
    console.error('[Creative] Delete error:', e);
    return errorResponse(e, 500, req);
  }
}

// ===================================================================
// BULK CREATE ADS
// ===================================================================

async function bulkCreateAds(req, env) {
  if (!(await adminOK(req, env))) {
    return errorResponse('Unauthorized', 401, req);
  }

  try {
    const body = await req.json();
    const { campaign_id, product_ids } = body;

    if (!campaign_id || !product_ids || product_ids.length === 0) {
      return json({ ok: false, error: 'Thiếu thông tin' }, { status: 400 }, req);
    }

    if (product_ids.length > 20) {
      return json({ ok: false, error: 'Tối đa 20 sản phẩm' }, { status: 400 }, req);
    }

    // Load products
    const products = [];
    for (const pid of product_ids) {
      const product = await getJSON(env, `product:${pid}`, null);
      if (product) {
        products.push(product);
      }
    }

    if (products.length === 0) {
      return json({ ok: false, error: 'Không tìm thấy sản phẩm' }, { status: 404 }, req);
    }

    // Create ads for each product
    let created = 0;
    let failed = 0;

    for (const product of products) {
      try {
        // TODO: Call Facebook API to create ad
        // For now, just simulate
        await new Promise(resolve => setTimeout(resolve, 100));
        created++;
      } catch (e) {
        console.error('[Bulk Ads] Create error:', e);
        failed++;
      }
    }

    return json({
      ok: true,
      created: created,
      failed: failed,
      message: `Đã tạo ${created} ads`
    }, {}, req);

  } catch (e) {
    console.error('[Creative] Bulk create error:', e);
    return errorResponse(e, 500, req);
  }
}

console.log('✅ facebook-ads-creative.js loaded');
