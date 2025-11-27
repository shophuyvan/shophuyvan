// ===============================================
// SHOP HUY VÂN - ORDER CORE ENGINE
// Chuẩn hóa đơn hàng từ đa kênh (Shopee, Lazada, TikTok)
// về format database nội bộ.
// ===============================================

import { lookupProvinceCode, lookupDistrictCode } from '../modules/shipping/helpers.js';

// 1. MAP TRẠNG THÁI ĐƠN HÀNG
// Chuyển đổi trạng thái sàn -> trạng thái nội bộ
export function mapOrderStatus(channel, status) {
  const s = String(status || '').toUpperCase();

  if (channel === 'shopee') {
    // Shopee Statuses: UNPAID, READY_TO_SHIP, PROCESSED, SHIPPED, COMPLETED, IN_CANCEL, CANCELLED, TO_RETURN
    const map = {
      'UNPAID': 'pending',
      'READY_TO_SHIP': 'processing',
      'PROCESSED': 'processing', // Đã in vận đơn
      'RETRY_SHIP': 'processing',
      'SHIPPED': 'shipped',
      'TO_CONFIRM_RECEIVE': 'shipped',
      'COMPLETED': 'completed',
      'IN_CANCEL': 'cancelled',
      'CANCELLED': 'cancelled',
      'TO_RETURN': 'returned'
    };
    return map[s] || 'pending';
  }

  if (channel === 'lazada') {
    // Lazada Statuses: pending, packed, ready_to_ship, shipped, delivered, canceled, returned, failed
    const map = {
      'PENDING': 'pending',
      'PACKED': 'processing',
      'READY_TO_SHIP': 'processing',
      'SHIPPED': 'shipped',
      'DELIVERED': 'completed',
      'CANCELED': 'cancelled',
      'RETURNED': 'returned',
      'FAILED': 'cancelled'
    };
    return map[s] || 'pending';
  }

  return 'pending';
}

// 2. PARSE SHOPEE ORDER
// Chuyển raw JSON từ API Shopee -> Object DB chuẩn
export function parseShopeeOrder(raw) {
  const status = mapOrderStatus('shopee', raw.order_status);
  
 // Map Items
  const items = (raw.item_list || []).map(item => ({
    sku: item.model_sku || item.item_sku || `SHOPEE-${item.item_id}`,
    name: item.model_name || item.item_name,
    quantity: item.model_quantity_purchased || 0,
    price: item.model_discounted_price || item.model_original_price || 0,
    
    // Lưu ID sàn để mapping sau này
    channel_item_id: String(item.item_id),
    channel_model_id: String(item.model_id || '0'),
    
    // ✅ Link ảnh từ Shopee API (Thử nhiều nguồn)
    image: item.image_info?.image_url || item.item_cover_image || item.image_url || (item.images ? item.images[0] : null) || null
  }));

  // Tính toán tài chính
  const subtotal = items.reduce((sum, i) => sum + (i.price * i.quantity), 0);
  
  // ✅ Parse order_income nếu có (từ GetOrderIncome API)
  const orderIncome = raw.order_income || {};
  
  return {
    // Core Fields
    order_number: raw.order_sn,
    channel: 'shopee',
    channel_order_id: raw.order_sn,
    
    // Customer
    customer_name: raw.recipient_address?.name || 'Shopee User',
    customer_phone: '', // Shopee giấu sđt, thường phải lấy từ API riêng hoặc để trống
    
    // Shipping Address
    shipping_name: raw.recipient_address?.name || '',
    shipping_phone: raw.recipient_address?.phone || '',
    shipping_address: raw.recipient_address?.full_address || '',
    shipping_city: raw.recipient_address?.city || '',
    shipping_district: raw.recipient_address?.district || '',
    shipping_province: raw.recipient_address?.state || '',
    shipping_zipcode: raw.recipient_address?.zipcode || '',

    // Financial (Khớp với database.sql mới)
    subtotal: subtotal,
    shipping_fee: raw.actual_shipping_fee || raw.estimated_shipping_fee || 0,
    total: raw.total_amount || 0,
    
    // Shopee specific fields
    tracking_number: raw.tracking_number || '',
    shipping_carrier: raw.shipping_carrier || '',
    
    // ✅ Financial details từ order_income
    coin_used: orderIncome.coins || raw.coin_info?.coin_offset || 0,
    voucher_code: raw.voucher_code || '', 
    voucher_seller: orderIncome.voucher_from_seller || 0,
    voucher_shopee: orderIncome.voucher_from_shopee || 0,
    
    commission_fee: orderIncome.commission_fee || 0,
    service_fee: orderIncome.service_fee || 0,
    seller_transaction_fee: orderIncome.seller_transaction_fee || 0,
    
    escrow_amount: orderIncome.escrow_amount || 0,
    buyer_paid_amount: orderIncome.buyer_total_amount || raw.total_amount || 0,
    
    estimated_shipping_fee: raw.estimated_shipping_fee || 0,
    actual_shipping_fee_confirmed: raw.actual_shipping_fee_confirmed || 0,

    // ✅ Shop info (nếu có)
    shop_id: raw.shop_id || null,
    shop_name: raw.shop_name || null,

    // Status
    status: status,
    payment_method: raw.payment_method || 'cod',
    
    // Timestamps (Shopee trả về unix timestamp giây -> nhân 1000)
    created_at: raw.create_time ? raw.create_time * 1000 : Date.now(),
    updated_at: raw.update_time ? raw.update_time * 1000 : Date.now(),
    
    // Danh sách items đã chuẩn hóa
    items: items
  };
}

// 3. PARSE LAZADA ORDER (Chuẩn bị sẵn)
export function parseLazadaOrder(raw) {
  const status = mapOrderStatus('lazada', raw.statuses && raw.statuses[0]);
  
  // Items của Lazada nằm ở API riêng (getOrderItems), 
  // nên hàm này thường chỉ parse thông tin chung (Header).
  // Items sẽ được merge vào sau.
  
  return {
    order_number: String(raw.order_id),
    channel: 'lazada',
    channel_order_id: String(raw.order_id),
    
    customer_name: raw.address_billing?.first_name + ' ' + raw.address_billing?.last_name,
    customer_phone: raw.address_billing?.phone || '',
    
    shipping_name: raw.address_shipping?.first_name + ' ' + raw.address_shipping?.last_name,
    shipping_phone: raw.address_shipping?.phone || '',
    shipping_address: raw.address_shipping?.address1 || '',
    shipping_city: raw.address_shipping?.city || '',
    
    subtotal: Number(raw.price || 0),
    shipping_fee: Number(raw.shipping_fee || 0),
    total: Number(raw.price || 0) + Number(raw.shipping_fee || 0),
    
    status: status,
    payment_method: raw.payment_method || 'COD',
    
    created_at: Date.parse(raw.created_at) || Date.now(),
    updated_at: Date.parse(raw.updated_at) || Date.now(),
    
    items: [] // Sẽ được populate sau
  };
}

// 3.1. NORMALIZE ORDER ADDRESS - Chuẩn hóa địa chỉ đầy đủ
async function normalizeOrderAddress(env, order) {
  // Lấy province_code
  let provinceCode = order.receiver_province_code || '';
  if (!provinceCode && order.shipping_province) {
    provinceCode = await lookupProvinceCode(env, order.shipping_province);
  }
  
  // Lấy district_code
  let districtCode = order.receiver_district_code || '';
  if (!districtCode && order.shipping_district && provinceCode) {
    districtCode = await lookupDistrictCode(env, provinceCode, order.shipping_district);
  }
  
  // Fallback: Auto-fill province từ district (HCM: 760-783 → 79)
  if (!provinceCode && districtCode) {
    const districtNum = parseInt(districtCode);
    if (districtNum >= 760 && districtNum <= 783) {
      provinceCode = '79';
    }
  }
  
  return {
    province_code: provinceCode || '',
    district_code: districtCode || '',
    ward_code: order.receiver_ward_code || order.receiver_commune_code || ''
  };
}

// 3.2. ENRICH ITEMS WITH WEIGHT - Bổ sung weight cho items từ variants
async function enrichItemsWeight(env, items) {
  const enriched = [];
  
  for (const item of items) {
    let weight = Number(item.weight || item.weight_gram || 0);
    
    // Nếu item chưa có weight, query từ variants
    if (weight === 0 && item.variant_id) {
      try {
        const variant = await env.DB.prepare(
          'SELECT weight FROM variants WHERE id = ?'
        ).bind(item.variant_id).first();
        
        if (variant && variant.weight) {
          weight = Number(variant.weight);
        }
      } catch (e) {
        console.warn('[ORDER-CORE] Failed to get weight for variant:', item.variant_id, e);
      }
    }
    
    enriched.push({ ...item, weight });
  }
  
  return enriched;
}

  // 4. SAVE ORDER TO D1 (CORE FUNCTION)
  // Lưu đơn hàng chuẩn hóa vào D1 Database (Transactional)
  export async function saveOrderToD1(env, order) {
    console.log('[ORDER-CORE] Saving order to D1:', order.order_number || order.id);
  
    // 1. Chuẩn bị dữ liệu Order
    const orderId = order.id || order.order_number; // ID dạng string/UUID
    const now = Date.now();
    
    // ✅ Normalize địa chỉ (thêm province_code, district_code)
    const addressCodes = await normalizeOrderAddress(env, order);
    console.log('[ORDER-CORE] Address codes:', addressCodes);
    
    // ✅ Enrich items với weight từ variants
    const items = await enrichItemsWeight(env, Array.isArray(order.items) ? order.items : []);
    console.log('[ORDER-CORE] Items with weight:', items.length);
  
    // Map field từ Object sang SQL Column (Khớp 100% với database.sql)
    const sqlOrder = `
    INSERT INTO orders (
      order_number, channel, channel_order_id,
      customer_name, customer_phone, customer_email,
      shipping_name, shipping_phone, shipping_address,
      shipping_district, shipping_city, shipping_province, shipping_zipcode,
      receiver_province_code, receiver_district_code, receiver_ward_code,
      total_weight_gram,
      subtotal, shipping_fee, discount, total, profit,
      seller_transaction_fee, shop_id, shop_name,
      status, payment_status, fulfillment_status, payment_method,
      customer_note, admin_note,
      tracking_number, shipping_carrier,
      coin_used, voucher_code, voucher_seller, voucher_shopee,
      commission_fee, service_fee, escrow_amount, buyer_paid_amount,
      estimated_shipping_fee, actual_shipping_fee_confirmed,
      created_at, updated_at
  ) VALUES (
      ?, ?, ?,
      ?, ?, ?,
      ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?,
      ?,
      ?, ?, ?, ?, ?,
      ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?,
      ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?,
      ?, ?
    )
    ON CONFLICT(order_number) DO UPDATE SET
      status = excluded.status,
      updated_at = excluded.updated_at,
      tracking_number = excluded.tracking_number,
      shipping_carrier = excluded.shipping_carrier
    RETURNING id;
  `;

  // Chuẩn bị tham số cho câu lệnh INSERT Order
  const paramsOrder = [
    String(order.order_number || order.id), 
    String(order.channel || order.source || 'website'), 
    String(order.channel_order_id || order.id || ''),
    
    String(order.customer?.name || order.customer_name || ''), 
    String(order.customer?.phone || order.customer_phone || ''), 
    String(order.customer?.email || order.customer_email || ''),
    
    String(order.shipping_name || order.customer?.name || ''), 
      String(order.shipping_phone || order.customer?.phone || ''), 
      String(
    order.shipping_address 
    || order.address 
    || order.customer?.address 
    || order.shipping?.address 
    || ''
  ),
  String(
    order.shipping_district 
    || order.district 
    || order.customer?.district 
    || order.shipping?.district 
    || ''
  ),
  String(
    order.shipping_city 
    || order.city 
    || order.customer?.city 
    || order.shipping?.city 
    || ''
  ),
  String(
    order.shipping_province 
    || order.province 
    || order.customer?.province 
    || order.shipping?.province 
    || ''
  ),
  String(
    order.shipping_zipcode 
    || order.customer?.zipcode 
    || ''
  ),
  
  // ✅ Địa chỉ codes - Ưu tiên từ customer nếu có
  String(
    order.customer?.province_code 
    || order.receiver_province_code 
    || addressCodes.province_code
  ),
  String(
    order.customer?.district_code 
    || order.receiver_district_code 
    || addressCodes.district_code
  ),
  String(
    order.customer?.commune_code 
    || order.customer?.ward_code
    || order.receiver_ward_code 
    || addressCodes.ward_code
  ),
  
  // ✅ Total weight
  Number(order.total_weight_gram || order.totalWeightGram || 0),
  
    Number(order.subtotal || 0),
    Number(order.shipping_fee || 0), 
    Number(order.discount || 0), 
    Number(order.revenue || order.total || 0), // revenue là thực thu, total là tổng
    Number(order.profit || 0), // ✅ Lưu lợi nhuận tính toán từ Product Core
    
    Number(order.seller_transaction_fee || 0),
    String(order.shop_id || ''),
    String(order.shop_name || ''),

    String(order.status || 'pending').toLowerCase(), 
    String(order.payment_status || 'pending'), 
    String(order.fulfillment_status || 'unfulfilled'), 
    String(order.payment_method || 'cod'),

    String(order.note || order.customer_note || ''), 
    String(order.admin_note || ''),

    String(order.tracking_code || order.tracking_number || ''), 
    String(order.shipping_provider || order.shipping_carrier || ''),

    Number(order.coin_used || 0), 
    String(order.voucher_code || ''), 
    Number(order.voucher_seller || 0), 
    Number(order.voucher_shopee || 0),

    Number(order.commission_fee || 0), 
    Number(order.service_fee || 0), 
    Number(order.escrow_amount || 0), 
    Number(order.buyer_paid_amount || 0),

    Number(order.estimated_shipping_fee || 0), 
    Number(order.actual_shipping_fee_confirmed || 0),

    Number(order.createdAt || order.created_at || now), 
    now
  ];

  try {
    // 2. Thực hiện Transaction (Batch)
    // D1 hiện chưa hỗ trợ transaction đầy đủ như SQL truyền thống, 
    // nhưng hỗ trợ batch() để chạy nhiều lệnh cùng lúc.
    // Tuy nhiên, vì cần lấy ID của Order vừa tạo để insert Items, 
    // ta nên chạy lệnh Insert Order trước.

    let result = await env.DB.prepare(sqlOrder).bind(...paramsOrder).first();
    
    if (!result || !result.id) {
        // Trường hợp update (ON CONFLICT DO UPDATE) có thể không trả về ID nếu không có thay đổi,
        // hoặc trả về ID của row đã update.
        // Ta cần select lại ID nếu insert fail (do đã tồn tại)
        const existing = await env.DB.prepare("SELECT id FROM orders WHERE order_number = ?").bind(String(order.order_number || order.id)).first();
        if (!existing) throw new Error("Failed to insert/get order ID");
        result = existing;
    }

    const dbOrderId = result.id; // ID tự tăng (INTEGER) trong DB

    // 3. Xử lý Order Items
    // Xóa items cũ (để tránh duplicate khi update) và insert lại mới
    const statements = [];
    
    statements.push(
      env.DB.prepare("DELETE FROM order_items WHERE order_id = ?").bind(dbOrderId)
    );

    // ✅ Sử dụng items đã enrich weight
    for (const item of items) {
      statements.push(
        env.DB.prepare(`
          INSERT INTO order_items (
            order_id, product_id, variant_id,
            sku, name, variant_name,
            price, quantity, subtotal, image,
            weight,
            channel_item_id, channel_model_id
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
          dbOrderId,
          item.product_id || null, 
          item.variant_id || item.id || null, // Ưu tiên variant_id nếu có
          String(item.sku || item.id || ''), 
          String(item.name || ''), 
          String(item.variant || item.variant_name || ''),
          Number(item.price || 0), 
          Number(item.qty || item.quantity || 1), 
          Number(item.price || 0) * Number(item.qty || item.quantity || 1), 
          String(item.image || item.img || ''),
          Number(item.weight || 0),
          String(item.channel_item_id || ''), 
          String(item.channel_model_id || '')
        )
      );
    }

    // Chạy batch insert items
    if (statements.length > 0) {
      await env.DB.batch(statements);
    }

    console.log('[ORDER-CORE] ✅ Saved successfully. DB ID:', dbOrderId);
    return { ok: true, id: dbOrderId, order_number: orderId };

  } catch (e) {
    console.error('[ORDER-CORE] ❌ Save failed:', e);
    return { ok: false, error: e.message };
  }
}