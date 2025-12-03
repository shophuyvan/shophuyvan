// workers/shv-api/src/modules/shipping/waybill.js
// ===================================================================
//  Waybill Creation (FIXED COMPLETE)
// ===================================================================

import { json, errorResponse, corsHeaders } from '../../lib/response.js';
import { adminOK } from '../../lib/auth.js';
import { getJSON, putJSON } from '../../lib/kv.js';
import { readBody } from '../../lib/utils.js';
import { idemGet, idemSet } from '../../lib/idempotency.js';
import { superFetch, chargeableWeightGrams, validateDistrictCode, lookupCommuneCode, superToken, resolveCarrierCode } from './helpers.js';
import { getWaybillHTML } from './waybill-template.js';

export async function createWaybill(req, env) {
  const idem = await idemGet(req, env);
  if (idem.hit) {
    return new Response(idem.body, { 
      status: 200, 
      headers: corsHeaders(req) 
    });
  }

  // Cho phép public access với static token
  const headerToken =
    (req.headers.get('Token') ||
     req.headers.get('x-token') ||
     (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '') ||
     ''
    ).trim();

  const superKey = 'FxXOoDz2qlTN5joDCsBGQFqKmm1UNvOw7YPwkzm5';
  const isAdmin = await adminOK(req, env);
  const isAllowed = isAdmin || (headerToken && headerToken === superKey);

  if (!isAllowed) {
    console.error('[Waybill] Unauthorized - Token mismatch', { 
      received: headerToken ? headerToken.substring(0, 20) + '...' : 'EMPTY',
      expected: superKey.substring(0, 20) + '...'
    });
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
      province: receiverProvince,
      district: receiverDistrict,
      commune: (body.receiver_commune || order.customer?.ward || body.to_commune || ''),
      
      // Amount (REQUIRED) - FIX: Phải là Giá trị hàng hóa (Subtotal - Discount)
      // Lấy từ order.subtotal - order.discount
      amount: Math.round(Number((order.subtotal || 0) - (order.discount || 0))),
      
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
      // ✅ FIX LỖI 2: Ưu tiên cân nặng từ order trước, fallback mới dùng chargeableWeightGrams
      weight_gram: Number(order.total_weight_gram || order.weight_gram || body.total_weight_gram || body.totalWeightGram || 0) || chargeableWeightGrams(body, order) || 500,
      weight: Number(order.total_weight_gram || order.weight_gram || body.total_weight_gram || body.totalWeightGram || 0) || chargeableWeightGrams(body, order) || 500,
      cod: Number(order.cod_amount || order.cod || body.cod_amount || body.cod || 0),
	  // Aliases SuperAI
      value: Math.round(Number((order.subtotal || 0) - (order.discount || 0))), // FIX: Phải là Giá trị hàng hóa (Subtotal - Discount)
      soc: body.soc || order.soc || '',
      
      payer: '2', // Khách trả phí (theo logic mới)
      
      // Service (REQUIRED)
      // ✅ ƯU TIÊN DÙNG CARRIER ID ĐÃ LƯU (Chuẩn nhất)
      provider: order.carrier_id || await resolveCarrierCode(env, order.shipping_provider || 'vtp'),
      
      // Dùng service_code từ đơn hàng
      service_code: order.shipping_service || order.shipping_service_code || '',
      
      // Config (REQUIRED)
      config: String(body.config || (order.allow_inspection === false ? '2' : '1')),

      // Product type (SuperAI)
      product_type: String(body.product_type || order.product_type || '2'),
      
      // Option ID: Dùng option_id từ đơn hàng (nếu có)
      option_id: order.shipping_option_id || shipping.option_id || '1',
      
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
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(payload)
});

    console.log('[Waybill] SuperAI response:', JSON.stringify(data, null, 2));

    // Check for success (SỬA LẠI THEO LOG)
    // SuperAI trả về { "error": false, "data": {...} } khi thành công
    const isSuccess = data?.error === false && data?.data;
    
    // Lấy mã vận đơn từ các trường SuperAI trả về
   // SỬA: Lấy mã SuperAI và mã NV (carrier) riêng biệt
    const carrier_code = data?.data?.carrier_code || data?.data?.code || null;
    const superai_code = data?.data?.superai_code || data?.data?.tracking || null;

    if (isSuccess && (carrier_code || superai_code)) {
      await putJSON(env, 'shipment:' + (order.id || body.order_id || carrier_code), { // Dùng order.id hoặc carrier_code làm key
        provider: payload.provider,
        service_code: payload.service_code,
        carrier_code: carrier_code, // Lưu mã NV
        superai_code: superai_code, // Lưu mã SuperAI
        raw: data,
        createdAt: Date.now()
      });

      const response = json({ 
        ok: true, 
        carrier_code: carrier_code, // Sửa: Trả về mã NV
        superai_code: superai_code, // Sửa: Trả về mã SuperAI
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

  // Nếu không có items thì trả fallback
  if (!items || items.length === 0) {
    return [{
      sku: 'DEFAULT',
      name: 'Sản phẩm',
      price: 0,
      weight: 500,
      quantity: 1
    }];
  }

  // Có items thì map đúng schema SuperAI
  return items.map((item, index) => {
    let weight = Number(item.weight_gram || item.weight_grams || item.weight || 0);
    if (weight <= 0) weight = 500;

    let name = String(item.name || item.title || `Sản phẩm ${index + 1}`).trim();
    if (name.length > 100) name = name.substring(0, 97) + '...';
    if (!name) name = `Sản phẩm ${index + 1}`;

    return {
  sku: item.sku || item.id || `ITEM${index + 1}`,
  name: name,
  // SỬA: Ưu tiên giá từ variants
  price: Number(
    (item.variant_price ?? (item.variant?.price)) ??
    item.price ?? 0
  ),
  weight: weight,
  quantity: Number(item.qty || item.quantity || 1)
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
const validHCMCDistricts = ['760', '761', '762', '763', '764', '765', '766', '767', '770', '771', '772', '773', '774', '775', '776', '777', '778', '780', '781', '782', '783', '784', '785', '786', '787', '788'];

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

/**
 * HÀM NỘI BỘ: Tự động tạo vận đơn khi khách đặt hàng
 * Được gọi từ /modules/orders.js
 * @param {object} order - Toàn bộ đối tượng order đã được tạo
 * @param {object} env - Worker env
 * @returns {object} - { ok: true, tracking: '...', ... }
 */
export async function autoCreateWaybill(order, env) {
  try {
    const settings = await getJSON(env, 'settings', {}) || {};
    const shipping = settings.shipping || {};
    const store = settings.store || {};

    const products = buildWaybillItems({}, order);
    const orderName = products.length > 0 ? products[0].name : 'Đơn hàng';

    // Lấy thông tin người nhận từ order
    const receiverPhone = sanitizePhone(order.customer?.phone || '0900000000');
    const receiverAddress = order.customer?.address || '';
    const receiverProvince = order.customer?.province || '';
    const receiverDistrict = order.customer?.district || '';
    const receiverProvinceCode = order.receiver_province_code || order.customer?.province_code || '';
    const rawReceiverDistrictCode = order.receiver_district_code || order.customer?.district_code || '';
    const receiverDistrictCode = await validateDistrictCode(env, receiverProvinceCode || '79', rawReceiverDistrictCode, receiverDistrict);
    const receiverCommuneCode = order.receiver_commune_code || order.customer?.commune_code || order.customer?.ward_code || '';

    const totalAmount = calculateOrderAmount(order, {});
    const totalWeight = chargeableWeightGrams({}, order) || 500;
    const payer = '2';
    // ✅ FIX: COD phải bằng tổng tiền khách trả (bao gồm ship)
    const totalCOD = Math.round(Number(order.revenue || order.total || totalAmount || 0)); // 54.000₫
    
    // FIX: Giá trị hàng hóa (Value) phải là Subtotal TRỪ Discount.
    // Lấy giá trị hàng hóa từ order.subtotal - order.discount (Backend đã tính)
    const subtotalNoDiscount = Number(order.subtotal || 0) - Number(order.discount || 0); 
    const totalValue = Math.round(Number(order.value || subtotalNoDiscount || totalCOD || 0)); // Subtotal - Discount (39.000₫)

    // ✅ BƯỚC 1: GỌI PRICING API ĐỂ LẤY DANH SÁCH CARRIERS
    console.log('[autoCreateWaybill] 📊 Calling pricing API to find cheapest carrier...');
    
    const pricingPayload = {
      sender_province: shipping.sender_province || store.province || '',
      sender_district: shipping.sender_district || store.district || '',
      receiver_province: receiverProvince,
      receiver_district: receiverDistrict,
      receiver_commune: (order.customer?.commune || order.customer?.ward || ''),
      weight: totalWeight,
      value: totalCOD
    };

    let selectedCarrier = null;
    try {
      const pricingData = await superFetch(env, '/v1/platform/orders/price', {
        method: 'POST',
        body: pricingPayload
      });

      // Parse carriers từ response
      const carriers = (pricingData?.data?.services || pricingData?.data?.items || pricingData?.data || []);
      
      if (Array.isArray(carriers) && carriers.length > 0) {
        // ✅ SORT THEO FEE TĂNG DẦN (RẺ NHẤT TRƯỚC)
        const sortedCarriers = carriers
          .map(c => ({
            carrier_id: String(c.carrier_id || ''),
            carrier_name: c.carrier_name || c.name || 'Unknown',
            service_code: String(c.service_code || ''),
            fee: Number(c.shipment_fee || c.fee || 0),
            eta: c.estimated_delivery || c.eta || ''
          }))
          .filter(c => c.fee > 0) // Chỉ lấy carrier có fee hợp lệ
          .sort((a, b) => a.fee - b.fee); // Sort tăng dần theo fee

        if (sortedCarriers.length > 0) {
          selectedCarrier = sortedCarriers[0]; // Chọn carrier RẺ NHẤT
          console.log('[autoCreateWaybill] ✅ Selected CHEAPEST carrier:', {
            name: selectedCarrier.carrier_name,
            fee: selectedCarrier.fee,
            eta: selectedCarrier.eta,
            total_options: sortedCarriers.length
          });
        }
      }
    } catch (pricingError) {
      console.warn('[autoCreateWaybill] ⚠️ Pricing API failed, using default carrier:', pricingError.message);
    }

    // ✅ BƯỚC 2: TẠO PAYLOAD VỚI CARRIER ĐÃ CHỌN
    const payload = {
      name: orderName,
      phone: receiverPhone,
      address: receiverAddress,
      province: receiverProvince,
      district: receiverDistrict,
      commune: (order.customer?.commune || order.customer?.ward || ''),
      amount: totalAmount,

      sender_name: shipping.sender_name || store.name || 'Shop',
      sender_phone: sanitizePhone(shipping.sender_phone || store.phone || '0900000000'),
      sender_address: shipping.sender_address || store.address || '',
      sender_province: shipping.sender_province || store.province || '',
      sender_district: shipping.sender_district || store.district || '',
      sender_province_code: shipping.sender_province_code || '79',
      sender_district_code: shipping.sender_district_code || '760',
      sender_commune_code: shipping.sender_commune_code || '',

      receiver_name: order.customer?.name || 'Khách',
      receiver_phone: receiverPhone,
      receiver_address: receiverAddress,
      receiver_province: receiverProvince,
      receiver_district: receiverDistrict,
      receiver_commune: (order.customer?.commune || order.customer?.ward || ''),
      receiver_province_code: receiverProvinceCode,
      receiver_district_code: receiverDistrictCode,
      receiver_commune_code: receiverCommuneCode,

      weight_gram: totalWeight,
      weight: totalWeight,
      cod: totalCOD,
      value: totalValue,
      soc: order.soc || order.id || '',
      
      payer: payer,
      
      // ✅ DÙNG CARRIER ĐÃ CHỌN (RẺ NHẤT) THAY VÌ CỐ ĐỊNH
      provider: selectedCarrier?.carrier_id || await resolveCarrierCode(env, order.shipping_provider || 'vtp'),
      service_code: selectedCarrier?.service_code || order.shipping_service || '',
      
      config: String(order.allow_inspection === false ? '2' : '1'),
      product_type: '2',
      option_id: order.shipping_option_id || shipping.option_id || '1',
      products: products,
      note: order.note || ''
    };

    const validation = validateWaybillPayload(payload);
    if (!validation.ok) {
      console.error('[autoCreateWaybill] Validation failed:', validation.errors);
      return { ok: false, message: 'Validation failed: ' + validation.errors.join(', ') };
    }

    const data = await superFetch(env, '/v1/platform/orders/create', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const isSuccess = data?.error === false && data?.data;
    
    console.log('[autoCreateWaybill] 📊 SuperAI response data keys:', Object.keys(data?.data || {}));
    console.log('[autoCreateWaybill] 📋 Full response data:', JSON.stringify(data?.data, null, 2));
    
    const carrier_code = data?.data?.carrier_code || data?.data?.code || null;
    const superai_code = data?.data?.superai_code || data?.data?.tracking || data?.data?.order_code || null;
    const carrier_id = data?.data?.carrier_id || null;
    const carrier_name = data?.data?.carrier_name || selectedCarrier?.carrier_name || ''; // ✅ LẤY TÊN CARRIER

    if (isSuccess && (carrier_code || superai_code)) {
      return { 
        ok: true, 
        carrier_code: carrier_code,
        superai_code: superai_code,
        carrier_id: carrier_id,
        carrier_name: carrier_name, // ✅ TRẢ VỀ TÊN CARRIER
        provider: payload.provider, 
        raw: data.data 
      };
    }

    const errorMessage = data?.message || data?.error?.message || data?.error || 'Không tạo được vận đơn';
    return { ok: false, message: errorMessage, raw: data };

  } catch (e) {
    console.error('[autoCreateWaybill] Exception:', e);
    return { ok: false, message: e.message };
  }
}

/**
 * HÀM MỚI: Lấy link IN VẬN ĐƠN
 * Gọi từ /shipping/print
 */
export async function printWaybill(req, env) {
  try {
    const body = await readBody(req) || {};
    const superaiCode = body.superai_code;
    let order = body.order || {};
    
   // ✅ 1. LUÔN lấy dữ liệu THẬT từ D1 (Source of Truth)
    console.log('[printWaybill] Fetching fresh data from D1 for code:', superaiCode);
      
       // ✅ VALIDATION: Chặn order_number format (32 ký tự UUID không dấu gạch)
    if (superaiCode && superaiCode.length === 32 && !superaiCode.includes('-') && !superaiCode.includes('.')) {
      console.warn('[printWaybill] ❌ Received order_number instead of superai_code:', superaiCode);
      return errorResponse('Đơn hàng chưa có mã vận đơn. Vui lòng xác nhận đơn trước khi in.', 400, req);
    }
    
    // Tìm bằng superai_code hoặc tracking_number (KHÔNG dùng id)
    const dbOrder = await env.DB.prepare(`
      SELECT * FROM orders 
      WHERE superai_code = ? OR tracking_number = ?
    `).bind(superaiCode, superaiCode).first();
    
        if (dbOrder) {
          // Lấy items từ D1
          const dbItems = await env.DB.prepare(`
            SELECT * FROM order_items WHERE order_id = ?
          `).bind(dbOrder.id).all();
    
      // Parse shipping_address JSON an toàn
      let shippingAddr = {};
      try {
        if (dbOrder.shipping_address && (dbOrder.shipping_address.startsWith('{') || dbOrder.shipping_address.startsWith('['))) {
          shippingAddr = JSON.parse(dbOrder.shipping_address);
        } else {
          shippingAddr = { address: dbOrder.shipping_address || '' };
        }
      } catch (e) { /* ignore */ }

      // Build order object chuẩn từ DB
      order = {
        ...dbOrder,
        id: dbOrder.id, 
        
        // Customer info chuẩn hóa
        customer: {
          name: dbOrder.customer_name,
          phone: dbOrder.customer_phone,
          address: shippingAddr.address || dbOrder.shipping_address || '',
          province: dbOrder.shipping_province || '',
          district: dbOrder.shipping_district || '',
          ward: dbOrder.receiver_ward_code || '' 
        },
        
        // Items chuẩn hóa
        items: (dbItems.results || []).map(i => ({
          name: i.name || i.item_name,
          variant: i.variant_name,
          qty: i.quantity,
          price: i.price,
          sku: i.sku
        })),
        
       // Thông tin vận đơn
        tracking_code: dbOrder.tracking_number, 
        carrier_code: dbOrder.tracking_number, // ✅ Mã tracking từ carrier
        superai_code: dbOrder.superai_code || dbOrder.tracking_number, // ✅ Lấy đúng cột superai_code
        shipping_provider: dbOrder.shipping_carrier,
        carrier_name: dbOrder.shipping_carrier, // ✅ THÊM carrier_name cho template
        
        // Tài chính
        revenue: dbOrder.total,
        shipping_fee: dbOrder.shipping_fee,
        cod: (dbOrder.payment_method === 'cod' || dbOrder.payment_method === 'COD') ? dbOrder.total : 0,
        
        created_at: dbOrder.created_at
      };
      console.log('[printWaybill] ✅ Loaded REAL data from D1');
    } else {
      console.warn('[printWaybill] ❌ Order not found in D1 for tracking:', superaiCode);
      return errorResponse('Không tìm thấy đơn hàng trong Database', 404, req);
    }

    if (!superaiCode) {
      return errorResponse('Missing superai_code', 400, req);
    }

    // 1. Xác định mã Tracking Code CHUẨN để gửi lên SuperAI
    // Ưu tiên: superai_code (Mới) > tracking_number (Cũ) > superaiCode (Input)
    let validTrackingCode = dbOrder?.superai_code || dbOrder?.tracking_number || superaiCode;

    // Chặn mã UUID dài (không phải mã vận đơn)
    if (!validTrackingCode || validTrackingCode.length > 35) {
       // Nếu mã hiện tại là UUID, thử tìm fallback
       if (dbOrder?.tracking_number && dbOrder.tracking_number.length < 35) {
           validTrackingCode = dbOrder.tracking_number;
       } else {
           console.warn('[printWaybill] Invalid tracking code found:', validTrackingCode);
           return errorResponse('Đơn hàng chưa có mã vận đơn hợp lệ (SuperAI Code). Vui lòng tạo vận đơn lại.', 400, req);
       }
    }

    console.log('[printWaybill] Requesting token for Valid Code:', validTrackingCode);

    const tokenRes = await superFetch(env, '/v1/platform/orders/token', {
      method: 'POST',
      body: {
        code: [validTrackingCode]
      }
    });
    
    const printToken = tokenRes?.data?.token;
    if (!printToken) {
      return errorResponse('Không lấy được print token từ SuperAI', 400, req);
    }

    // 2. Lấy settings để có logo
    const settings = await getJSON(env, 'settings', {}) || {};
    const store = settings.store || {};
    const logo = store.logo || 'https://shophuyvan.vn/logo.png';

    // 3. Tạo HTML template A5 dọc
    // ✅ Fallback: Nếu không có sender/receiver, dùng dữ liệu từ settings + hardcode
    
    const sender = order.sender || {
      name: 'SHOP HUY VÂN',
      phone: '0909128999',
      address: '91/6 Liên Khu 5-11-12 Phường Bình Trị Đông Thành Phố Hồ Chí Minh',
      province: 'Thành phố Hồ Chí Minh',
      district: 'Quận Bình Tân'
    };
    
    // Lấy thông tin người nhận từ order (đã chuẩn hóa ở bước 1)
    const receiver = {
        name: order.customer.name || 'Khách',
        phone: order.customer.phone || '',
        address: order.customer.address || ''
    };
    const customer = order.customer;
    const items = Array.isArray(order.items) ? order.items : [];
    
    const createdDate = order.createdAt ? new Date(Number(order.createdAt)).toLocaleString('vi-VN') : new Date().toLocaleString('vi-VN');
    const barcodeSrc = `https://api.superai.vn/v1/platform/orders/barcode?token=${printToken}&format=code128`;
    const qrcodeSrc = `https://api.superai.vn/v1/platform/orders/qrcode?token=${printToken}`;

    const itemsList = items.map(item => `
      <tr>
        <td style="padding:4px 2px;font-size:10px;border-bottom:1px solid #ddd">
          <div>${item.name || ''}</div>
          ${item.variant ? `<div style="color:#666;font-size:9px">${item.variant}</div>` : ''}
        </td>
        <td style="padding:4px 2px;text-align:center;font-size:10px;border-bottom:1px solid #ddd">${item.qty || 1}</td>
      </tr>
    `).join('');

    const html = getWaybillHTML({
      superaiCode,
      logo,
      sender,
      receiver,
      customer,
      items,
      order,
      createdDate,
      barcodeSrc,
      store
    });

    return json({ ok: true, print_html: html }, {}, req);

  } catch (e) {
    console.error('[printWaybill] Exception:', e);
    return errorResponse(e.message, 500, req);
  }
}

/**
 * HÀM MỚI: HỦY VẬN ĐƠN
 * Gọi từ /shipping/cancel
 */
export async function cancelWaybill(req, env) {
  try {
    const body = await readBody(req) || {};
    const superaiCode = body.superai_code;

    if (!superaiCode) {
      return errorResponse('Missing superai_code', 400, req);
    }

    // 1. Gọi API Hủy của SuperAI
    const cancelRes = await superFetch(env, '/v1/platform/orders/cancel', {
      method: 'POST',
      body: {
        code: [superaiCode]
      }
    });

    // 2. Kiểm tra kết quả (bao gồm cả trường hợp đã hủy trước đó)
    const isSuccess = 
      cancelRes.error === false || 
      (cancelRes.data && cancelRes.data.success) ||
      (cancelRes.error === true && cancelRes.message && 
       (cancelRes.message.includes('đã ở trạng thái hủy') || 
        cancelRes.message.includes('đã hủy') ||
        cancelRes.message.includes('hủy trước đó')));

    if (isSuccess) {
      // 3. Cập nhật trạng thái trực tiếp vào D1
      try {
        const updateStmt = env.DB.prepare(
          `UPDATE orders 
           SET status = 'cancelled', 
               tracking_number = 'CANCELLED',
               updated_at = ?
           WHERE superai_code = ?`
        );
        
        const result = await updateStmt.bind(Date.now(), superaiCode).run();
        
        if (result.meta.changes > 0) {
          console.log(`[cancelWaybill] ✅ Đã cập nhật ${result.meta.changes} đơn hàng trong D1`);
        } else {
          console.warn('[cancelWaybill] ⚠️ Không tìm thấy đơn hàng với superai_code:', superaiCode);
        }
      } catch (e) {
        console.error('[cancelWaybill] ❌ Lỗi cập nhật D1:', e.message);
        return errorResponse('Hủy vận đơn thành công nhưng không cập nhật được database', 500, req);
      }
      
      return json({ ok: true, message: 'Hủy vận đơn thành công' }, {}, req);
    }

    return errorResponse(cancelRes.message || 'Lỗi từ SuperAI', 400, req);

  } catch (e) {
    console.error('[cancelWaybill] Exception:', e);
    return errorResponse(e.message, 500, req);
  }
}

/**
 * HÀM MỚI: Lấy link IN HÀNG LOẠT
 * Gọi từ /shipping/print-bulk
 */
export async function printWaybillsBulk(req, env) {
  try {
    const body = await readBody(req) || {};
    const superaiCodes = body.superai_codes; // Mảng các mã SuperAI

    if (!Array.isArray(superaiCodes) || superaiCodes.length === 0) {
      return errorResponse('Missing or empty superai_codes array', 400, req);
    }

    // 1. Lấy Print Token HÀNG LOẠT
    const tokenRes = await superFetch(env, '/v1/platform/orders/token', {
      method: 'POST',
      body: {
        code: superaiCodes // Gửi mảng mã SuperAI
      }
    });
    
    const printToken = tokenRes?.data?.token;
    if (!printToken) {
      return errorResponse('Không lấy được print token hàng loạt từ SuperAI', 400, req);
    }

    // 2. Trả về URL in (SuperAI tự xử lý in hàng loạt với cùng token)
    const printUrl = `https://api.superai.vn/v1/platform/orders/label?token=${printToken}&size=S13`;
    
    return json({ ok: true, print_url: printUrl, count: superaiCodes.length }, {}, req);

  } catch (e) {
    console.error('[printWaybillsBulk] Exception:', e);
    return errorResponse(e.message, 500, req);
  }
}

/**
 * HÀM MỚI: HỦY HÀNG LOẠT
 * Gọi từ /shipping/cancel-bulk
 */
export async function cancelWaybillsBulk(req, env) {
  try {
    const body = await readBody(req) || {};
    const superaiCodes = body.superai_codes; // Mảng các mã SuperAI

    if (!Array.isArray(superaiCodes) || superaiCodes.length === 0) {
      return errorResponse('Missing or empty superai_codes array', 400, req);
    }

    // 1. Gọi API Hủy HÀNG LOẠT của SuperAI
    const cancelRes = await superFetch(env, '/v1/platform/orders/cancel', {
      method: 'POST',
      body: {
        code: superaiCodes // Gửi mảng mã SuperAI
      }
    });

    // SuperAI trả về { error: false } nếu thành công chung, không có chi tiết từng đơn
    if (cancelRes.error === false || (cancelRes.data && cancelRes.data.success)) {
      // 2. Cập nhật trạng thái trong KV cho TẤT CẢ các đơn đã gửi yêu cầu hủy
      let updatedCount = 0;
      try {
        const list = await getJSON(env, 'orders:list', []);
        let listChanged = false;
        
        for (const codeToCancel of superaiCodes) {
          const index = list.findIndex(o => 
            o.superai_code === codeToCancel || 
            o.tracking_code === codeToCancel || 
            o.shipping_tracking === codeToCancel
          );
          
          if (index > -1 && list[index].status !== 'cancelled') {
            list[index].status = 'cancelled';
            list[index].tracking_code = 'CANCELLED';
            listChanged = true;
            updatedCount++;
            
            const orderId = list[index].id;
            if (orderId) {
              const order = await getJSON(env, 'order:' + orderId, null);
              if (order && order.status !== 'cancelled') {
                order.status = 'cancelled';
                order.tracking_code = 'CANCELLED';
                await putJSON(env, 'order:' + orderId, order);
              }
            }
          }
        }
        
        if (listChanged) {
          await putJSON(env, 'orders:list', list);
        }
      } catch (e) {
        console.warn('[cancelWaybillsBulk] Lỗi cập nhật KV, nhưng SuperAI có thể đã hủy OK:', e.message);
      }
      
      return json({ ok: true, message: `Đã gửi yêu cầu hủy cho ${superaiCodes.length} đơn.`, cancelled_count: updatedCount }, {}, req);
    }

    return errorResponse(cancelRes.message || 'Lỗi hủy hàng loạt từ SuperAI', 400, req);

  } catch (e) {
    console.error('[cancelWaybillsBulk] Exception:', e);
    return errorResponse(e.message, 500, req);
  }
}