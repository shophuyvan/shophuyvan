// ===================================================================
// modules/shipping/waybill.js - Waybill Creation (FIXED COMPLETE)
// ===================================================================

import { json, errorResponse, corsHeaders } from '../../lib/response.js';
import { adminOK } from '../../lib/auth.js';
import { getJSON, putJSON } from '../../lib/kv.js';
import { readBody } from '../../lib/utils.js';
import { idemGet, idemSet } from '../../lib/idempotency.js';
import { superFetch, chargeableWeightGrams, validateDistrictCode, lookupCommuneCode } from './helpers.js';

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

    // Get receiver info for root fields
    const receiverPhone = sanitizePhone(
      body.receiver_phone || 
      order.customer?.phone || 
      body.to_phone || 
      '0900000000'
    );

    const receiverAddress = body.receiver_address || 
                           order.customer?.address || 
                           body.to_address || 
                           '';

    const receiverProvince = body.receiver_province || 
                            order.customer?.province || 
                            body.to_province || 
                            '';

    const receiverDistrict = body.receiver_district || 
                            order.customer?.district || 
                            body.to_district || 
                            '';

    const receiverProvinceCode = body.receiver_province_code || 
                                order.customer?.province_code || 
                                body.province_code || 
                                body.to_province_code || 
                                '';

       // Lấy raw district code
    const rawReceiverDistrictCode = body.receiver_district_code || 
                                    order.customer?.district_code || 
                                    body.district_code || 
                                    body.to_district_code || 
                                    '';

    // ✅ VALIDATE VÀ TỰ ĐỘNG SỬA MÃ DISTRICT NẾU SAI
    const receiverDistrictCode = await validateDistrictCode(
      env,
      receiverProvinceCode || '79',  // Default TP.HCM
      rawReceiverDistrictCode,
      receiverDistrict || body.receiver_district || order.customer?.district || ''
    );

    console.log('[Waybill] 🔍 District code validation:', {
      raw: rawReceiverDistrictCode,
      validated: receiverDistrictCode,
      districtName: receiverDistrict
    });

    const payload = {
      // Root level required fields (SuperShip API requirements)
      name: orderName,
      phone: receiverPhone,
      address: receiverAddress,
      province: receiverProvince || receiverProvinceCode,
      district: receiverDistrict || receiverDistrictCode,
      
      // Amount (REQUIRED)
      amount: calculateOrderAmount(order, body),
      
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
      receiver_address: receiverAddress,
      receiver_province: receiverProvince,
      receiver_district: receiverDistrict,
      receiver_commune: body.receiver_commune || order.customer?.ward || body.to_commune || '',
      receiver_province_code: receiverProvinceCode,
      receiver_district_code: receiverDistrictCode,
      receiver_commune_code: body.receiver_commune_code || order.customer?.commune_code || order.customer?.ward_code || body.commune_code || body.to_commune_code || body.ward_code || '',

      // Package (REQUIRED)
      weight_gram: chargeableWeightGrams(body, order) || 500,
      weight: chargeableWeightGrams(body, order) || 500,
      cod: Number(order.cod || body.cod || 0),
	  // Aliases SuperAI
  value: Number(order.value || body.value || order.cod || body.cod || calculateOrderAmount(order, body) || 0),
  soc: body.soc || order.soc || '',
      
      // Payer (REQUIRED) - '1' = Shop trả phí, '2' = Người nhận trả
      payer: String(body.payer || order.payer || '1'),
      
      // Service (REQUIRED)
      provider: (ship.provider || body.provider || order.shipping_provider || 'vtp').toLowerCase(),
      service_code: ship.service_code || body.service_code || order.shipping_service || '',
      
      // Config (REQUIRED) - '1' = Cho xem hàng, '2' = Không cho xem hàng
      config: String(body.config || order.config || '1'),
      
      // Option ID
      option_id: shipping.option_id || '1',
      
      // Products (REQUIRED)
      products: products,
      
      // Additional
      note: body.note || order.note || ''
    };

    // Root-level aliases for backward compatibility
    payload.province_code = receiverProvinceCode;
    payload.district_code = receiverDistrictCode;
    payload.commune_code = payload.receiver_commune_code;
    payload.to_province_code = receiverProvinceCode;
    payload.to_district_code = receiverDistrictCode;
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
        details: validation.errors
      }, { status: 400 }, req);
    }

    console.log('[Waybill] Creating with payload:', JSON.stringify(payload, null, 2));

    // Call SuperAI API
    const data = await superFetch(env, '/v1/platform/orders/create', {
  method: 'POST',
  body: payload
});

    console.log('[Waybill] SuperAI response:', JSON.stringify(data, null, 2));

    // Check for success
    const code = data?.data?.code || data?.code || null;
    const tracking = data?.data?.tracking || data?.tracking || code || null;

    if (code || tracking) {
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

    const errorMessage = data?.message || data?.error?.message || data?.error || 'Không tạo được vận đơn';
    console.error('[Waybill] Failed:', errorMessage);
    
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
      message: e.message
    }, { status: 500 }, req);
  }
}

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
    let weight = Number(item.weight_gram || item.weight_grams || item.weight || 0);
    if (weight <= 0) weight = 500;

    let name = String(item.name || item.title || `Sản phẩm ${index + 1}`).trim();
    if (name.length > 100) name = name.substring(0, 97) + '...';
    if (!name) name = `Sản phẩm ${index + 1}`;

    return {
      name: name,
      product_price: Number(item.price || 0),
      quantity: Number(item.qty || item.quantity || 1),
      weight: weight,
      product_code: item.sku || item.id || `ITEM${index + 1}`
    };
  });
}

function validateWaybillPayload(payload) {
  const errors = [];

  // Root fields
  if (!payload.name || !payload.name.trim()) errors.push('Missing name');
  if (!payload.phone) errors.push('Missing phone');
  if (!payload.address || !payload.address.trim()) errors.push('Missing address');
  
  // Required fields
  if (!payload.amount || payload.amount <= 0) errors.push('Missing or invalid amount');
  if (!payload.payer) errors.push('Missing payer');
  if (!payload.config) errors.push('Missing config');
  
  // Sender
  if (!payload.sender_name || !payload.sender_name.trim()) errors.push('Missing sender_name');
  if (!payload.sender_phone) errors.push('Missing sender_phone');
  if (!payload.sender_address || !payload.sender_address.trim()) errors.push('Missing sender_address');
  if (!payload.sender_province_code) errors.push('Missing sender_province_code');
  if (!payload.sender_district_code) errors.push('Missing sender_district_code');

  // Receiver
  if (!payload.receiver_name || !payload.receiver_name.trim()) errors.push('Missing receiver_name');
  if (!payload.receiver_phone) errors.push('Missing receiver_phone');
  if (!payload.receiver_address || !payload.receiver_address.trim()) errors.push('Missing receiver_address');
  if (!payload.receiver_province_code) errors.push('Missing receiver_province_code');
  if (!payload.receiver_district_code) errors.push('Missing receiver_district_code');
  
  // THÊM VALIDATE MÃ ĐỊA CHỈ
  const provinceCode = String(payload.receiver_province_code || '');
const districtCode = String(payload.receiver_district_code || '');

// Log để debug CHI TIẾT HƠN
console.log('[Waybill] 🔍 Address codes:', { 
  provinceCode, 
  districtCode,
  original: {
    receiver_district_code: payload.receiver_district_code,
    district_code: payload.district_code,
    to_district_code: payload.to_district_code
  }
});

// Kiểm tra district code có trong danh sách hợp lệ
const validHCMCDistricts = ['760', '761', '762', '763', '764', '765', '767', '770', '771', '772', '773', '774', '775', '776', '777', '778', '780', '781', '782', '783', '784', '785', '786', '787', '788'];

if (provinceCode === '79' && districtCode && !validHCMCDistricts.includes(districtCode)) {
  console.error('[Waybill] ❌ Mã quận/huyện không hợp lệ cho TP.HCM:', districtCode);
  console.error('[Waybill] ℹ️ Các mã hợp lệ:', validHCMCDistricts.join(', '));
  errors.push(`Mã quận/huyện "${districtCode}" không hợp lệ cho TP.HCM`);
}

  
  // Warn if codes look suspicious
  if (provinceCode.length > 3) {
    console.warn('[Waybill] ⚠️ Province code quá dài:', provinceCode);
  }
  if (districtCode.length > 4) {
    console.warn('[Waybill] ⚠️ District code quá dài:', districtCode);
  }

  // Weight
  if (!payload.weight_gram || payload.weight_gram <= 0) errors.push('Invalid weight_gram');
  if (!payload.weight || payload.weight <= 0) errors.push('Invalid weight');

  // Products
  if (!Array.isArray(payload.products) || payload.products.length === 0) {
    errors.push('Products empty');
  } else {
    payload.products.forEach((item, idx) => {
      if (!item.name || !item.name.trim()) errors.push(`Product ${idx + 1}: no name`);
      if (!item.weight || item.weight <= 0) errors.push(`Product ${idx + 1}: invalid weight`);
    });
  }

  return { ok: errors.length === 0, errors };
}

function sanitizePhone(phone) {
  return String(phone || '').replace(/\D+/g, '');
}

function calculateOrderAmount(order, body) {
  // Priority: explicit amount > order total > calculated from items
  
  // 1. Check explicit amount
  if (body.amount && Number(body.amount) > 0) {
    return Number(body.amount);
  }
  
  if (order.amount && Number(order.amount) > 0) {
    return Number(order.amount);
  }
  
  // 2. Check order total
  if (order.total && Number(order.total) > 0) {
    return Number(order.total);
  }
  
  // 3. Calculate from items
  const items = Array.isArray(order.items) ? order.items : 
               (Array.isArray(body.items) ? body.items : []);
  
  if (items.length > 0) {
    const itemsTotal = items.reduce((sum, item) => {
      const price = Number(item.price || 0);
      const qty = Number(item.qty || item.quantity || 1);
      return sum + (price * qty);
    }, 0);
    
    if (itemsTotal > 0) return itemsTotal;
  }
  
  // 4. Fallback to COD
  const cod = Number(order.cod || body.cod || 0);
  if (cod > 0) return cod;
  
  // 5. Default minimum
  return 10000; // 10k VND minimum
}