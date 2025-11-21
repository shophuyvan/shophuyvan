// ===================================================================
// modules/sku-mapping.js - SKU Mapping Management API
// ===================================================================

import { json, errorResponse } from '../lib/response.js';
import { adminOK } from '../lib/auth.js';
import { getInternalSku, mapSku } from '../core/sku-core.js';

// ===================================================================
// 1. Get Unmapped SKUs (SKU chưa map)
// ===================================================================

export async function getUnmappedSkus(req, env) {
  if (!(await adminOK(req, env))) return errorResponse('Unauthorized', 401, req);

  try {
    console.log('[SKU-MAPPING] Getting unmapped SKUs...');

    // Lấy tất cả SKU từ channel_products không có variant_id
    const unmapped = await env.DB.prepare(`
      SELECT 
        cp.channel,
        cp.channel_sku,
        cp.channel_item_id,
        cp.created_at
      FROM channel_products cp
      WHERE cp.variant_id IS NULL OR cp.variant_id = ''
      ORDER BY cp.created_at DESC
      LIMIT 500
    `).all();

    // Lấy thêm thông tin product name từ các bảng mapping (nếu có)
    const results = unmapped.results || [];
    
    console.log('[SKU-MAPPING] Found', results.length, 'unmapped SKUs');

    return json({
      ok: true,
      items: results,
      count: results.length
    }, {}, req);

  } catch (error) {
    console.error('[SKU-MAPPING] Error getting unmapped:', error);
    return json({
      ok: false,
      error: error.message
    }, { status: 500 }, req);
  }
}

// ===================================================================
// 2. Get Mapped SKUs (SKU đã map)
// ===================================================================

export async function getMappedSkus(req, env) {
  if (!(await adminOK(req, env))) return errorResponse('Unauthorized', 401, req);

  try {
    console.log('[SKU-MAPPING] Getting mapped SKUs...');

    // Lấy tất cả mapping đã có variant_id
    const mapped = await env.DB.prepare(`
      SELECT 
        cp.id,
        cp.channel,
        cp.channel_sku,
        cp.channel_item_id,
        cp.variant_id,
        cp.product_id,
        v.sku as internal_sku,
        v.name as variant_name,
        p.title as product_title,
        cp.created_at,
        cp.updated_at
      FROM channel_products cp
      LEFT JOIN variants v ON cp.variant_id = v.id
      LEFT JOIN products p ON cp.product_id = p.id
      WHERE cp.variant_id IS NOT NULL AND cp.variant_id != ''
      ORDER BY cp.updated_at DESC
      LIMIT 1000
    `).all();

    const results = mapped.results || [];
    
    console.log('[SKU-MAPPING] Found', results.length, 'mapped SKUs');

    return json({
      ok: true,
      items: results,
      count: results.length
    }, {}, req);

  } catch (error) {
    console.error('[SKU-MAPPING] Error getting mapped:', error);
    return json({
      ok: false,
      error: error.message
    }, { status: 500 }, req);
  }
}

// ===================================================================
// 3. Get Auto-Matched SKUs (Tự động match)
// ===================================================================

export async function getAutoMatchedSkus(req, env) {
  if (!(await adminOK(req, env))) return errorResponse('Unauthorized', 401, req);

  try {
    console.log('[SKU-MAPPING] Getting auto-matched SKUs...');

    // Tìm các SKU sàn trùng 100% với SKU nội bộ
    const autoMatched = await env.DB.prepare(`
      SELECT 
        v.id as variant_id,
        v.product_id,
        v.sku,
        v.name as variant_name,
        p.title as product_title,
        'shopee' as channel,
        v.sku as channel_sku,
        v.status
      FROM variants v
      LEFT JOIN products p ON v.product_id = p.id
      WHERE EXISTS (
        SELECT 1 FROM channel_products cp 
        WHERE cp.channel_sku = v.sku 
        AND cp.variant_id = v.id
      )
      ORDER BY v.id DESC
      LIMIT 500
    `).all();

    const results = autoMatched.results || [];
    
    console.log('[SKU-MAPPING] Found', results.length, 'auto-matched SKUs');

    return json({
      ok: true,
      items: results,
      count: results.length
    }, {}, req);

  } catch (error) {
    console.error('[SKU-MAPPING] Error getting auto-matched:', error);
    return json({
      ok: false,
      error: error.message
    }, { status: 500 }, req);
  }
}

// ===================================================================
// 4. Search Internal SKUs (Tìm SKU nội bộ)
// ===================================================================

export async function searchInternalSkus(req, env) {
  if (!(await adminOK(req, env))) return errorResponse('Unauthorized', 401, req);

  try {
    const url = new URL(req.url);
    const query = url.searchParams.get('q') || '';

    if (!query || query.length < 2) {
      return json({
        ok: true,
        items: [],
        count: 0
      }, {}, req);
    }

    console.log('[SKU-MAPPING] Searching internal SKUs:', query);

    // Search trong variants
    const results = await env.DB.prepare(`
      SELECT 
        v.id as variant_id,
        v.product_id,
        v.sku,
        v.name as variant_name,
        v.price,
        v.stock,
        v.image,
        p.title as product_title,
        p.slug as product_slug
      FROM variants v
      LEFT JOIN products p ON v.product_id = p.id
      WHERE v.sku LIKE ? OR v.name LIKE ? OR p.title LIKE ?
      ORDER BY v.id DESC
      LIMIT 50
    `).bind(`%${query}%`, `%${query}%`, `%${query}%`).all();

    const items = results.results || [];
    
    console.log('[SKU-MAPPING] Found', items.length, 'variants');

    return json({
      ok: true,
      items: items,
      count: items.length
    }, {}, req);

  } catch (error) {
    console.error('[SKU-MAPPING] Error searching:', error);
    return json({
      ok: false,
      error: error.message
    }, { status: 500 }, req);
  }
}

// ===================================================================
// 5. Map SKU Manually (Map thủ công)
// ===================================================================

export async function mapSkuManually(req, env) {
  if (!(await adminOK(req, env))) return errorResponse('Unauthorized', 401, req);

  try {
    const body = await req.json();
    const { channel, channel_sku, internal_sku } = body;

    if (!channel || !channel_sku || !internal_sku) {
      return json({
        ok: false,
        error: 'Missing required fields: channel, channel_sku, internal_sku'
      }, { status: 400 }, req);
    }

    console.log('[SKU-MAPPING] Mapping:', { channel, channel_sku, internal_sku });

    // Sử dụng hàm mapSku từ sku-core.js
    const result = await mapSku(env, channel, channel_sku, internal_sku);

    console.log('[SKU-MAPPING] ✅ Mapped successfully');

    return json({
      ok: true,
      message: 'Mapped successfully',
      data: result
    }, {}, req);

  } catch (error) {
    console.error('[SKU-MAPPING] Error mapping:', error);
    return json({
      ok: false,
      error: error.message
    }, { status: 500 }, req);
  }
}

// ===================================================================
// 6. Unmap SKU (Xóa mapping)
// ===================================================================

export async function unmapSku(req, env) {
  if (!(await adminOK(req, env))) return errorResponse('Unauthorized', 401, req);

  try {
    const body = await req.json();
    const { channel, channel_sku } = body;

    if (!channel || !channel_sku) {
      return json({
        ok: false,
        error: 'Missing required fields: channel, channel_sku'
      }, { status: 400 }, req);
    }

    console.log('[SKU-MAPPING] Unmapping:', { channel, channel_sku });

    // Xóa mapping trong DB
    await env.DB.prepare(`
      UPDATE channel_products 
      SET variant_id = NULL, product_id = NULL, updated_at = ?
      WHERE channel = ? AND channel_sku = ?
    `).bind(Date.now(), channel, channel_sku).run();

    // Xóa cache
    const cacheKey = `sku_map:${channel}:${channel_sku}`;
    await env.KV.delete(cacheKey);

    console.log('[SKU-MAPPING] ✅ Unmapped successfully');

    return json({
      ok: true,
      message: 'Unmapped successfully'
    }, {}, req);

  } catch (error) {
    console.error('[SKU-MAPPING] Error unmapping:', error);
    return json({
      ok: false,
      error: error.message
    }, { status: 500 }, req);
  }
}

// ===================================================================
// 7. Get Mapping Stats (Thống kê)
// ===================================================================

export async function getMappingStats(req, env) {
  if (!(await adminOK(req, env))) return errorResponse('Unauthorized', 401, req);

  try {
    console.log('[SKU-MAPPING] Getting stats...');

    // Đếm unmapped
    const unmappedCount = await env.DB.prepare(`
      SELECT COUNT(*) as count FROM channel_products 
      WHERE variant_id IS NULL OR variant_id = ''
    `).first();

    // Đếm mapped
    const mappedCount = await env.DB.prepare(`
      SELECT COUNT(*) as count FROM channel_products 
      WHERE variant_id IS NOT NULL AND variant_id != ''
    `).first();

    // Đếm auto-matched (SKU trùng)
    const autoMatchedCount = await env.DB.prepare(`
      SELECT COUNT(*) as count FROM variants v
      WHERE EXISTS (
        SELECT 1 FROM channel_products cp 
        WHERE cp.channel_sku = v.sku 
        AND cp.variant_id = v.id
      )
    `).first();

    const total = (unmappedCount.count || 0) + (mappedCount.count || 0);
    const mappedPercent = total > 0 ? ((mappedCount.count / total) * 100).toFixed(1) : 0;

    const stats = {
      unmapped: unmappedCount.count || 0,
      mapped: mappedCount.count || 0,
      auto_matched: autoMatchedCount.count || 0,
      total: total,
      mapped_percent: mappedPercent
    };

    console.log('[SKU-MAPPING] Stats:', stats);

    return json({
      ok: true,
      stats: stats
    }, {}, req);

  } catch (error) {
    console.error('[SKU-MAPPING] Error getting stats:', error);
    return json({
      ok: false,
      error: error.message
    }, { status: 500 }, req);
  }
}
