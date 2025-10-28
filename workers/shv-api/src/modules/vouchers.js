// ===================================================================
// modules/vouchers.js - Vouchers Module (Optimized)
// ===================================================================

import { json, errorResponse } from '../lib/response.js';
import { adminOK } from '../lib/auth.js';
import { getJSON, putJSON } from '../lib/kv.js';
import { readBody } from '../lib/utils.js';

// ===================================================================
// Constants
// ===================================================================
const VOUCHER_TYPES = {
  CODE: 'code',
  AUTO_FREESHIP: 'auto_freeship'
};

const DEFAULT_VALUES = {
  USAGE_LIMIT_PER_USER: 0,
  USAGE_LIMIT_TOTAL: 0,
  USAGE_COUNT: 0,
  MIN_PURCHASE: 0,
  OFF_PERCENT: 0,
  MAX_DISCOUNT: 0
};

const VALIDATION_RULES = {
  MAX_OFF_PERCENT: 100,
  MIN_OFF_PERCENT: 0
};

// ===================================================================
// Helper Functions
// ===================================================================

/**
 * Validate voucher code format
 */
function validateVoucherCode(code) {
  if (!code || typeof code !== 'string') {
    return { valid: false, error: 'Mã voucher không được để trống' };
  }
  
  const normalized = code.trim().toUpperCase();
  
  if (normalized.length < 3) {
    return { valid: false, error: 'Mã voucher phải có ít nhất 3 ký tự' };
  }
  
  if (!/^[A-Z0-9_-]+$/.test(normalized)) {
    return { valid: false, error: 'Mã voucher chỉ được chứa chữ cái, số, gạch ngang và gạch dưới' };
  }
  
  return { valid: true, code: normalized };
}

/**
 * Validate and normalize voucher data
 */
function normalizeVoucherData(body, existingVoucher = null) {
  const validation = validateVoucherCode(body.code);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  const voucherType = body.voucher_type === VOUCHER_TYPES.AUTO_FREESHIP 
    ? VOUCHER_TYPES.AUTO_FREESHIP 
    : VOUCHER_TYPES.CODE;

  // Parse timestamps
  let starts_at = null;
  let expires_at = null;

  if (body.starts_at) {
    starts_at = Number(body.starts_at);
    if (isNaN(starts_at) || starts_at < 0) {
      throw new Error('Ngày bắt đầu không hợp lệ');
    }
  }

  if (body.expires_at) {
    expires_at = Number(body.expires_at);
    if (isNaN(expires_at) || expires_at < 0) {
      throw new Error('Ngày hết hạn không hợp lệ');
    }
    
    // Check if expires_at is after starts_at
    if (starts_at && expires_at <= starts_at) {
      throw new Error('Ngày hết hạn phải sau ngày bắt đầu');
    }
  }

  // Base data
  const voucherData = {
    code: validation.code,
    on: body.on === true || String(body.on) === 'true',
    voucher_type: voucherType,
    usage_limit_per_user: Math.max(0, parseInt(body.usage_limit_per_user || DEFAULT_VALUES.USAGE_LIMIT_PER_USER)),
    usage_limit_total: Math.max(0, parseInt(body.usage_limit_total || DEFAULT_VALUES.USAGE_LIMIT_TOTAL)),
    starts_at,
    expires_at,
    // Preserve usage_count from existing voucher
    usage_count: existingVoucher?.usage_count || DEFAULT_VALUES.USAGE_COUNT
  };

  // Type-specific data
  if (voucherType === VOUCHER_TYPES.CODE) {
    const offPercent = Number(body.off || DEFAULT_VALUES.OFF_PERCENT);
    voucherData.off = Math.max(
      VALIDATION_RULES.MIN_OFF_PERCENT, 
      Math.min(VALIDATION_RULES.MAX_OFF_PERCENT, offPercent)
    );
    voucherData.min_purchase = Math.max(0, Number(body.min_purchase || DEFAULT_VALUES.MIN_PURCHASE));
    voucherData.max_discount = Math.max(0, Number(body.max_discount || DEFAULT_VALUES.MAX_DISCOUNT));
  } else { // AUTO_FREESHIP
    voucherData.min_purchase = Math.max(0, Number(body.min_purchase || DEFAULT_VALUES.MIN_PURCHASE));
    voucherData.off = DEFAULT_VALUES.OFF_PERCENT;
    voucherData.max_discount = DEFAULT_VALUES.MAX_DISCOUNT;
  }

  return voucherData;
}

/**
 * Check if voucher is currently valid (time-based only)
 */
function isVoucherTimeValid(voucher) {
  const now = Date.now();
  
  if (voucher.starts_at && now < voucher.starts_at) {
    return { valid: false, reason: 'not_started', message: 'Mã voucher chưa có hiệu lực' };
  }
  
  if (voucher.expires_at && now > voucher.expires_at) {
    return { valid: false, reason: 'expired', message: 'Mã voucher đã hết hạn' };
  }
  
  return { valid: true };
}

/**
 * Format price for display
 */
function formatPrice(n) { 
  return Number(n || 0).toLocaleString('vi-VN') + '₫'; 
}

// ===================================================================
// Public API
// ===================================================================

/**
 * Public: Get all active vouchers (only returns vouchers that are ON)
 */
async function getPublicVouchers(req, env) {
  try {
    const list = await getJSON(env, 'vouchers', []);
    
    // Filter: only return vouchers that are ON and currently valid
    const activeVouchers = list.filter(v => {
      if (!v.on) return false;
      const timeCheck = isVoucherTimeValid(v);
      return timeCheck.valid;
    });
    
    // Remove sensitive fields before returning
    const sanitized = activeVouchers.map(v => ({
      code: v.code,
      voucher_type: v.voucher_type,
      off: v.off || 0,
      min_purchase: v.min_purchase || 0,
      expires_at: v.expires_at
      // Don't expose usage_count, usage_limit, etc.
    }));
    
    return json({ items: sanitized }, {}, req);
  } catch (e) {
    console.error('[getPublicVouchers] Error:', e);
    return errorResponse(e, 500, req);
  }
}

// ===================================================================
// Admin API
// ===================================================================

/**
 * Admin: List all vouchers (including inactive ones)
 */
async function listAdminVouchers(req, env) {
  if (!(await adminOK(req, env))) {
    return errorResponse('Unauthorized', 401, req);
  }

  try {
    const list = await getJSON(env, 'vouchers', []);
    
    // Add computed fields for admin view
    const enriched = list.map(v => {
      const timeCheck = isVoucherTimeValid(v);
      return {
        ...v,
        is_time_valid: timeCheck.valid,
        time_status: timeCheck.reason || 'active'
      };
    });
    
    return json({ items: enriched }, {}, req);
  } catch (e) {
    console.error('[listAdminVouchers] Error:', e);
    return errorResponse(e, 500, req);
  }
}

/**
 * Admin: Create or update voucher
 */
async function upsertVoucher(req, env) {
  // ✅ FIX: Add admin authorization check
  if (!(await adminOK(req, env))) {
    return errorResponse('Unauthorized', 401, req);
  }

  try {
    const body = await readBody(req) || {};
    const list = await getJSON(env, 'vouchers', []);

    // Find existing voucher
    const code = String(body.code || '').toUpperCase().trim();
    const index = list.findIndex(v => 
      (v.code || '').toUpperCase() === code
    );

    // Normalize and validate data
    let voucherData;
    try {
      voucherData = normalizeVoucherData(body, index >= 0 ? list[index] : null);
    } catch (validationError) {
      return errorResponse(validationError.message, 400, req);
    }

    if (index >= 0) {
      // Update existing
      list[index] = {
        ...list[index],
        ...voucherData,
        updated_at: Date.now()
      };
    } else {
      // Create new
      list.push({
        ...voucherData,
        created_at: Date.now(),
        updated_at: Date.now()
      });
    }

    await putJSON(env, 'vouchers', list);
    
    return json({ 
      ok: true, 
      voucher: index >= 0 ? list[index] : list[list.length - 1],
      action: index >= 0 ? 'updated' : 'created'
    }, {}, req);
    
  } catch (e) {
    console.error('[upsertVoucher] Error:', e);
    return errorResponse(e.message || 'Internal server error', 500, req);
  }
}

/**
 * Admin: Delete voucher
 */
async function deleteVoucher(req, env) {
  if (!(await adminOK(req, env))) {
    return errorResponse('Unauthorized', 401, req);
  }

  try {
    const body = await readBody(req) || {};
    const code = String(body.code || '').toUpperCase().trim();
    
    if (!code) {
      return errorResponse('Voucher code is required', 400, req);
    }

    const list = await getJSON(env, 'vouchers', []);
    const index = list.findIndex(v => 
      (v.code || '').toUpperCase() === code
    );

    if (index < 0) {
      return errorResponse('Voucher not found', 404, req);
    }

    const deletedVoucher = list[index];
    const newList = list.filter((_, i) => i !== index);
    
    await putJSON(env, 'vouchers', newList);
    
    return json({ 
      ok: true, 
      deleted: code,
      voucher: deletedVoucher
    }, {}, req);
    
  } catch (e) {
    console.error('[deleteVoucher] Error:', e);
    return errorResponse(e, 500, req);
  }
}

// ===================================================================
// Voucher Application API (Called by Checkout)
// ===================================================================

/**
 * Apply voucher and calculate discount
 * Called by checkout.js when user enters a voucher code
 */
export async function applyVoucher(req, env) {
  try {
    const body = await readBody(req) || {};
    const code = String(body.code || '').toUpperCase().trim();
    const customerId = body.customer_id || null;
    const subtotal = Number(body.subtotal || 0);

    console.log('[applyVoucher] Request:', { code, customerId, subtotal });

    // Validate input
    if (!code) {
      return errorResponse('Vui lòng nhập mã voucher', 400, req);
    }

    if (subtotal <= 0) {
      return errorResponse('Giỏ hàng trống', 400, req);
    }

    // Get voucher from database
    const list = await getJSON(env, 'vouchers', []);
    const voucher = list.find(v => (v.code || '').toUpperCase() === code);

    if (!voucher) {
      console.log('[applyVoucher] Not found:', code);
      return errorResponse('Mã voucher không tồn tại', 404, req);
    }

    // ===== VALIDATION CHECKS =====

    // 1. Is voucher active?
    if (voucher.on !== true) {
      console.log('[applyVoucher] Inactive:', code);
      return errorResponse('Mã voucher không hoạt động', 400, req);
    }

    // 2. Time validity
    const timeCheck = isVoucherTimeValid(voucher);
    if (!timeCheck.valid) {
      console.log('[applyVoucher] Time invalid:', timeCheck);
      return errorResponse(timeCheck.message, 400, req);
    }

    // 3. Total usage limit
    if (voucher.usage_limit_total > 0 && 
        (voucher.usage_count || 0) >= voucher.usage_limit_total) {
      console.log('[applyVoucher] Total limit reached:', {
        count: voucher.usage_count,
        limit: voucher.usage_limit_total
      });
      return errorResponse('Mã voucher đã hết lượt sử dụng', 400, req);
    }

    // 4. Per-user usage limit
    if (customerId && voucher.usage_limit_per_user > 0) {
      const historyKey = `customer_voucher_history:${customerId}`;
      const history = await getJSON(env, historyKey, []);
      const timesUsed = history.filter(
        usedCode => (usedCode || '').toUpperCase() === code
      ).length;

      if (timesUsed >= voucher.usage_limit_per_user) {
        console.log('[applyVoucher] User limit reached:', {
          customerId,
          timesUsed,
          limit: voucher.usage_limit_per_user
        });
        return errorResponse(
          `Bạn đã sử dụng mã voucher này ${timesUsed}/${voucher.usage_limit_per_user} lần`,
          400,
          req
        );
      }
    }

    // 5. Minimum purchase requirement
    if (voucher.min_purchase > 0 && subtotal < voucher.min_purchase) {
      console.log('[applyVoucher] Min purchase not met:', {
        subtotal,
        required: voucher.min_purchase
      });
      return errorResponse(
        `Đơn hàng tối thiểu ${formatPrice(voucher.min_purchase)} để sử dụng mã này`,
        400,
        req
      );
    }

    // ===== CALCULATE DISCOUNT =====

    let discount = 0;
    let ship_discount = 0;
    let discountDetails = {};

    if (voucher.voucher_type === VOUCHER_TYPES.CODE && voucher.off > 0) {
      // Percentage discount on products
      const calculatedDiscount = Math.floor(subtotal * (voucher.off / 100));
      
      // Apply max_discount cap if set
      if (voucher.max_discount > 0 && calculatedDiscount > voucher.max_discount) {
        discount = voucher.max_discount;
        discountDetails.capped = true;
      } else {
        discount = calculatedDiscount;
      }
      
      discountDetails.type = 'percentage';
      discountDetails.percent = voucher.off;
      
      console.log('[applyVoucher] Code discount:', {
        subtotal,
        percent: voucher.off,
        calculated: calculatedDiscount,
        final: discount,
        max: voucher.max_discount
      });
      
    } else if (voucher.voucher_type === VOUCHER_TYPES.AUTO_FREESHIP) {
      // Free shipping vouchers are typically handled by frontend
      // But we can return a flag indicating free shipping is available
      discountDetails.type = 'freeship';
      discountDetails.note = 'Miễn phí vận chuyển';
      console.log('[applyVoucher] Auto-freeship voucher applied');
    }

    // ===== RETURN RESULT =====
    // NOTE: We do NOT update usage_count here.
    // That should only happen when the order is successfully placed.

    return json({
      ok: true,
      valid: true,
      code: voucher.code,
      discount: discount,
      ship_discount: ship_discount,
      details: discountDetails,
      message: 'Áp dụng voucher thành công'
    }, {}, req);

  } catch (e) {
    console.error('[applyVoucher] Exception:', e);
    return errorResponse(e.message || 'Internal server error', 500, req);
  }
}

/**
 * Mark voucher as used (called by order creation logic)
 * This should be called ONLY when an order is successfully placed
 */
export async function markVoucherUsed(env, voucherCode, customerId = null) {
  try {
    const code = String(voucherCode || '').toUpperCase().trim();
    if (!code) return { ok: false, error: 'No code provided' };

    const list = await getJSON(env, 'vouchers', []);
    const index = list.findIndex(v => (v.code || '').toUpperCase() === code);
    
    if (index < 0) {
      return { ok: false, error: 'Voucher not found' };
    }

    // Increment usage count
    list[index].usage_count = (list[index].usage_count || 0) + 1;
    await putJSON(env, 'vouchers', list);

    // Record in customer history if customerId provided
    if (customerId) {
      const historyKey = `customer_voucher_history:${customerId}`;
      const history = await getJSON(env, historyKey, []);
      history.push(code);
      await putJSON(env, historyKey, history);
    }

    console.log('[markVoucherUsed] Success:', {
      code,
      newCount: list[index].usage_count,
      customerId
    });

    return { ok: true, usage_count: list[index].usage_count };
    
  } catch (e) {
    console.error('[markVoucherUsed] Error:', e);
    return { ok: false, error: e.message };
  }
}

// ===================================================================
// Main Handler
// ===================================================================

export async function handle(req, env, ctx) {
  const url = new URL(req.url);
  const path = url.pathname;
  const method = req.method;

  // Public routes
  if (path === '/vouchers' && method === 'GET') {
    return getPublicVouchers(req, env);
  }

  if (path === '/vouchers/apply' && method === 'POST') {
    return applyVoucher(req, env);
  }

  // Admin routes
  if (path === '/admin/vouchers' && method === 'GET') {
    return listAdminVouchers(req, env);
  }

  if (path === '/admin/vouchers/list' && method === 'GET') {
    return listAdminVouchers(req, env);
  }

  if ((path === '/admin/vouchers' || path === '/admin/vouchers/upsert' || path === '/admin/voucher') && method === 'POST') {
    return upsertVoucher(req, env);
  }

  if (path === '/admin/vouchers/delete' && method === 'DELETE') {
    return deleteVoucher(req, env);
  }

  // Legacy support for POST delete
  if (path === '/admin/vouchers/delete' && method === 'POST') {
    return deleteVoucher(req, env);
  }

  return errorResponse('Route not found', 404, req);
}