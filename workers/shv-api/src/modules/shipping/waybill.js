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
      // ✅ FIX LỖI 2: Ưu tiên cân nặng từ order trước, fallback mới dùng chargeableWeightGrams
      weight_gram: Number(order.total_weight_gram || order.weight_gram || body.total_weight_gram || body.totalWeightGram || 0) || chargeableWeightGrams(body, order) || 500,
      weight: Number(order.total_weight_gram || order.weight_gram || body.total_weight_gram || body.totalWeightGram || 0) || chargeableWeightGrams(body, order) || 500,
      cod: Number(order.cod_amount || order.cod || body.cod_amount || body.cod || 0),
	  // Aliases SuperAI
  value: Number(order.value || body.value || order.cod || body.cod || calculateOrderAmount(order, body) || 0),
  soc: body.soc || order.soc || '',
      
      // Payer (REQUIRED) - '1' = Shop trả phí, '2' = Người nhận trả
      payer: String(body.payer || order.payer || '1'),
      
      // Service (REQUIRED)
     // ✅ FIX LỖI 1: Ưu tiên từ order (đã lưu từ FE/Mini)
      provider: (order.shipping_provider || ship.provider || body.provider || 'vtp').toLowerCase(),
      service_code: order.shipping_service || ship.service_code || body.service_code || '',
      
// Config (REQUIRED) - '1' = Cho xem hàng, '2' = Không cho xem hàng
      // ✅ Map allow_inspection: true -> '1', false -> '2'
      config: String(body.config || (order.allow_inspection === false ? '2' : (order.allow_inspection === true ? '1' : '1'))),

      // Product type (SuperAI)
      product_type: String(body.product_type || order.product_type || '2'),
      
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

    const products = buildWaybillItems({}, order); // Dùng order object
    const orderName = products.length > 0 ? products[0].name : 'Đơn hàng';

    // Lấy thông tin người nhận từ order
    const receiverPhone = sanitizePhone(order.customer?.phone || '0900000000');
    const receiverAddress = order.customer?.address || '';
    const receiverProvince = order.customer?.province || '';
    const receiverDistrict = order.customer?.district || '';
    const receiverProvinceCode = order.customer?.province_code || '';
    const rawReceiverDistrictCode = order.customer?.district_code || '';
    const receiverDistrictCode = await validateDistrictCode(env, receiverProvinceCode || '79', rawReceiverDistrictCode, receiverDistrict);
    const receiverCommuneCode = (order.customer?.commune_code || order.customer?.ward_code || '');

// Tính toán các giá trị
    const totalAmount = calculateOrderAmount(order, {});
    const totalWeight = chargeableWeightGrams({}, order) || 500;

    // SỬA: Logic Phí (Theo yêu cầu của bạn: Khách trả phí)
    // Payer = 2 (Khách trả phí)
    // COD = Chỉ thu hộ tiền hàng (subtotal)
    const payer = '2';
    const totalCOD = Number(order.subtotal || 0);
    // Giá trị đơn hàng (value) vẫn là tổng (revenue)
    const totalValue = Number(order.revenue || order.total || totalAmount || 0);

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
      cod: totalCOD, // Sửa: Thu hộ tiền hàng (subtotal)
      value: totalValue, // Sửa: Giá trị đơn hàng (full)
      soc: order.soc || order.id || '',
      
      payer: payer, // Sửa: '2' (Khách trả phí)
      provider: await resolveCarrierCode(env, order.shipping_provider || 'vtp'), // ✅ Convert sang mã số
      service_code: order.shipping_service || '', // Lấy từ đơn hàng khách đã chọn
      config: String(order.allow_inspection === false ? '2' : '1'), // ✅ Map allow_inspection
      product_type: '2',
      option_id: shipping.option_id || '1',
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
    
    // ✅ LOG CHI TIẾT - Xem SuperAI trả về gì
    console.log('[autoCreateWaybill] 📊 SuperAI response data keys:', Object.keys(data?.data || {}));
    console.log('[autoCreateWaybill] 📋 Full response data:', JSON.stringify(data?.data, null, 2));
    
    // Sá»¬A: Láº¥y 2 mÃ£ tracking riÃªng biá»‡t
    const carrier_code = data?.data?.carrier_code || data?.data?.code || null;
    const superai_code = data?.data?.superai_code || data?.data?.tracking || data?.data?.order_code || null;
    const carrier_id = data?.data?.carrier_id || null;

    if (isSuccess && (carrier_code || superai_code)) {
      return { 
        ok: true, 
        carrier_code: carrier_code,     // Mã nhà vận chuyển (SPXVN...)
        superai_code: superai_code,     // Mã SuperAI (CTOS...)
        carrier_id: carrier_id,
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
    
    // ✅ Nếu admin không gửi order, tìm từ KV
    if (!order.id || !order.items) {
      console.log('[printWaybill] Order incomplete, searching KV...');
      const list = await getJSON(env, 'orders:list', []);
      const found = list.find(o => o.superai_code === superaiCode || o.shipping_tracking === superaiCode);
      if (found && found.id) {
        const fullOrder = await getJSON(env, 'order:' + found.id, null);
        if (fullOrder) {
          order = fullOrder;
          console.log('[printWaybill] ✅ Found full order from KV');
        }
      }
    }

    if (!superaiCode) {
      return errorResponse('Missing superai_code', 400, req);
    }

    // 1. Lấy Print Token từ SuperAI để có barcode
    const tokenRes = await superFetch(env, '/v1/platform/orders/token', {
      method: 'POST',
      body: {
        code: [superaiCode]
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
    
    const receiver = order.receiver || order.customer || {};
    const customer = order.customer || {};
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

    if (cancelRes.error === false || (cancelRes.data && cancelRes.data.success)) {
      // 2. Cập nhật trạng thái trong KV
      try {
        const list = await getJSON(env, 'orders:list', []);
        let orderId = null;
        
        const index = list.findIndex(o => 
          o.superai_code === superaiCode || 
          o.tracking_code === superaiCode || 
          o.shipping_tracking === superaiCode
        );
        
        if (index > -1) {
          list[index].status = 'cancelled';
          list[index].tracking_code = 'CANCELLED';
          orderId = list[index].id;
          await putJSON(env, 'orders:list', list);
          
          if (orderId) {
            const order = await getJSON(env, 'order:' + orderId, null);
            if (order) {
              order.status = 'cancelled';
              order.tracking_code = 'CANCELLED';
              // FIX: Removed extra 'A'
              await putJSON(env, 'order:' + orderId, order);
            }
          }
        }
      } catch (e) {
        console.warn('[cancelWaybill] Lỗi cập nhật KV, nhưng SuperAI đã hủy OK:', e.message);
      }
      
      return json({ ok: true, message: 'Hủy thành công' }, {}, req);
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