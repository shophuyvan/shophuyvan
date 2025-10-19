// ===================================================================
// modules/shipping/waybill.js - Waybill Creation (COMPLETE FIX)
// ===================================================================

import { json, errorResponse, corsHeaders } from '../../lib/response.js';
import { adminOK } from '../../lib/auth.js';
import { getJSON, putJSON } from '../../lib/kv.js';
import { readBody } from '../../lib/utils.js';
import { idemGet, idemSet } from '../../lib/idempotency.js';
import { superFetch, chargeableWeightGrams } from './helpers.js';

export async function createWaybill(req, env) {
  const idem = await idemGet(req, env);
  if (idem.hit) {
    return new Response(idem.body, { 
      status: 200, 
      headers: corsHeaders(req) 
    });
  }

  if (!(await adminOK(req, env))) {
    return errorResponse('Unauthorized', 401, req);
  }

  try {
    const body = await readBody(req) || {};
    const settings = await getJSON(env, 'settings', {}) || {};
    const shipping = settings.shipping || {};
    const store = settings.store || {};
    
    const order = body.order || {};
    const ship = body.ship || {};

    // Build products first
    const products = buildWaybillItems(body, order);
    const orderName = products.length > 0 ? products[0].name : 'Đơn hàng';

    // Get receiver phone (will be used for root phone field)
    const receiverPhone = sanitizePhone(
      body.receiver_phone || 
      order.customer?.phone || 
      body.to_phone || 
      '0900000000'
    );

    const payload = {
      // Root level required fields
      name: orderName,
      phone: receiverPhone,
      address: body.receiver_address || order.customer?.address || body.to_address || '',
      
      // Sender
      sender_name: body.sender_name || shipping.sender_name || store.name || 'Shop',
      sender_phone: sanitizePhone(body.sender_phone || shipping.sender_phone || store.phone || store.owner_phone || '0900000000'),
      sender_address: body.sender_address || shipping.sender_address || store.address || '',
      sender_province: body.sender_province || shipping.sender_province || store.province || store.city || '',
      sender_district: body.sender_district || shipping.sender_district || store.district || '',
      sender_province_code: body.sender_province_code || shipping.sender_province_code || '79',
      sender_district_code: body.sender_district_code || shipping.sender_district_code || '760',
      sender_commune_code: body.sender_commune_code || shipping.sender_commune_code || '',

      // Receiver
      receiver_name: body.receiver_name || order.customer?.name || body.to_name || '',
      receiver_phone: receiverPhone,
      receiver_address: body.receiver_address || order.customer?.address || body.to_address || '',
      receiver_province: body.receiver_province || order.customer?.province || body.to_province || '',
      receiver_district: body.receiver_district || order.customer?.district || body.to_district || '',
      receiver_commune: body.receiver_commune || order.customer?.ward || body.to_commune || '',
      receiver_province_code: body.receiver_province_code || order.customer?.province_code || body.province_code || body.to_province_code || '',
      receiver_district_code: body.receiver_district_code || order.customer?.district_code || body.district_code || body.to_district_code || '',
      receiver_commune_code: body.receiver_commune_code || order.customer?.commune_code || order.customer?.ward_code || body.commune_code || body.to_commune_code || body.ward_code || '',

      // Package
      weight_gram: chargeableWeightGrams(body, order) || 500,
      cod: Number(order.cod || body.cod || 0),
      option_id: shipping.option_id || '1',
      
      // Service
      provider: (ship.provider || body.provider || order.shipping_provider || 'vtp').toLowerCase(),
      service_code: ship.service_code || body.service_code || order.shipping_service || '',
      
      // Products
      products: products,
      
      // Additional
      note: body.note || order.note || ''
    };

    // Root-level aliases for backward compatibility
    payload.province_code = payload.receiver_province_code;
    payload.district_code = payload.receiver_district_code;
    payload.commune_code = payload.receiver_commune_code;
    payload.to_province_code = payload.receiver_province_code;
    payload.to_district_code = payload.receiver_district_code;
    payload.to_commune_code = payload.receiver_commune_code;
    
    payload.to_name = payload.receiver_name;
    payload.to_phone = payload.receiver_phone;
    payload.to_address = payload.receiver_address;
    payload.to_province = payload.receiver_province;
    payload.to_district = payload.receiver_district;
    payload.to_commune = payload.receiver_commune;

    payload.from_name = payload.sender_name;
    payload.from_phone = payload.sender_phone;
    payload.from_address = payload.sender_address;
    payload.from_province = payload.sender_province;
    payload.from_district = payload.sender_district;

    // Validate required fields
    const validation = validateWaybillPayload(payload);
    if (!validation.ok) {
      console.error('[Waybill] Validation failed:', validation.errors);
      return json({
        ok: false,
        error: 'VALIDATION_FAILED',
        details: validation.errors,
        payload: {
          name: payload.name,
          phone: payload.phone,
          products: payload.products
        }
      }, { status: 400 }, req);
    }

    console.log('[Waybill] Creating waybill with payload:', JSON.stringify(payload, null, 2));

    // Call SuperAI API
    const data = await superFetch(env, '/v1/platform/orders/create', {
      method: 'POST',
      body: payload
    });

    console.log('[Waybill] SuperAI API response:', JSON.stringify(data, null, 2));

    // Check for success
    const code = data?.data?.code || data?.code || null;
    const tracking = data?.data?.tracking || data?.tracking || code || null;

    if (code || tracking) {
      // Success - save shipment record
      await putJSON(env, 'shipment:' + (order.id || body.order_id || code), {
        provider: payload.provider,
        service_code: payload.service_code,
        code,
        tracking,
        raw: data,
        createdAt: Date.now()
      });

      const response = json({ 
        ok: true, 
        code, 
        tracking, 
        provider: payload.provider 
      }, {}, req);
      
      await idemSet(idem.key, env, response);
      return response;
    }

    // Failed - return error with details
    const errorMessage = data?.message || data?.error?.message || data?.error || 'Không tạo được vận đơn';
    
    console.error('[Waybill] Failed to create:', errorMessage);
    
    return json({
      ok: false,
      error: 'CREATE_FAILED',
      message: errorMessage,
      raw: data
    }, { status: 400 }, req);

  } catch (e) {
    console.error('[Waybill] Exception:', e);
    return json({
      ok: false,
      error: 'EXCEPTION',
      message: e.message,
      stack: e.stack
    }, { status: 500 }, req);
  }
}

// ===== Build waybill items/products =====
function buildWaybillItems(body, order) {
  const items = Array.isArray(order.items) ? order.items : 
               (Array.isArray(body.items) ? body.items : []);

  if (!items.length) {
    return [{
      name: 'Sản phẩm',
      product_price: 0,
      quantity: 1,
      weight: 500,
      product_code: 'DEFAULT'
    }];
  }

  return items.map((item, index) => {
    // Weight with fallback
    let weight = Number(item.weight_gram || item.weight_grams || item.weight || 0);
    if (weight <= 0) {
      weight = 500; // Default 500g
    }

    // Name with truncation
    let name = String(item.name || item.title || `Sản phẩm ${index + 1}`).trim();
    if (name.length > 100) {
      name = name.substring(0, 97) + '...';
    }
    if (!name) {
      name = `Sản phẩm ${index + 1}`;
    }

    return {
      name: name,
      product_price: Number(item.price || 0),
      quantity: Number(item.qty || item.quantity || 1),
      weight: weight,
      product_code: item.sku || item.id || `ITEM${index + 1}`
    };
  });
}

// ===== Validate payload before sending to API =====
function validateWaybillPayload(payload) {
  const errors = [];

  // Root level
  if (!payload.name || !payload.name.trim()) {
    errors.push('Missing order name');
  }
  if (!payload.phone) {
    errors.push('Missing phone');
  }

  // Sender validation
  if (!payload.sender_name || !payload.sender_name.trim()) {
    errors.push('Missing sender name');
  }
  if (!payload.sender_phone) {
    errors.push('Missing sender phone');
  }
  if (!payload.sender_address || !payload.sender_address.trim()) {
    errors.push('Missing sender address');
  }
  if (!payload.sender_province_code) {
    errors.push('Missing sender province code');
  }
  if (!payload.sender_district_code) {
    errors.push('Missing sender district code');
  }

  // Receiver validation
  if (!payload.receiver_name || !payload.receiver_name.trim()) {
    errors.push('Missing receiver name');
  }
  if (!payload.receiver_phone) {
    errors.push('Missing receiver phone');
  }
  if (!payload.receiver_address || !payload.receiver_address.trim()) {
    errors.push('Missing receiver address');
  }
  if (!payload.receiver_province_code) {
    errors.push('Missing receiver province code');
  }
  if (!payload.receiver_district_code) {
    errors.push('Missing receiver district code');
  }

  // Package validation
  if (!payload.weight_gram || payload.weight_gram <= 0) {
    errors.push('Invalid weight (must be > 0)');
  }

  // Products validation
  if (!Array.isArray(payload.products) || payload.products.length === 0) {
    errors.push('Products array is empty');
  } else {
    payload.products.forEach((item, idx) => {
      if (!item.name || !item.name.trim()) {
        errors.push(`Product ${idx + 1}: name is required`);
      }
      if (!item.weight || item.weight <= 0) {
        errors.push(`Product ${idx + 1}: weight must be > 0 (got ${item.weight})`);
      }
      if (!item.quantity || item.quantity <= 0) {
        errors.push(`Product ${idx + 1}: quantity must be > 0`);
      }
    });
  }

  return {
    ok: errors.length === 0,
    errors
  };
}

// ===== Sanitize phone number =====
function sanitizePhone(phone) {
  return String(phone || '').replace(/\D+/g, '');
}