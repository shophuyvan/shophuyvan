    // ===============================================
    // SHOP HUY VÂN - ORDER CORE ENGINE
    // Chuẩn hóa đơn hàng từ đa kênh (Shopee, Lazada, TikTok)
    // về format database nội bộ.
    // ===============================================
    
    import { lookupProvinceCode, lookupDistrictCode } from '../modules/shipping/helpers.js';
    import { getJSON } from '../lib/kv.js'; 
    import { applyVoucher } from '../modules/vouchers.js'; 
    
    // ===================================================================
    // Helper: Auto Freeship Logic (Di chuyển từ orders.js)
    // ===================================================================
    /** * Checks for auto-freeship eligibility and returns best discount
     */
    async function getAutoFreeshipDiscount(env, subtotal, shipping_fee) {
      let autoShippingDiscount = 0;
      let autoVoucherCode = null;
      try {
        const now = Date.now();
        const list = await getJSON(env, 'vouchers', []);
        const activeAuto = (Array.isArray(list) ? list : [])
          .filter(v => v && v.on === true && v.voucher_type === 'auto_freeship')
          .filter(v => {
            const s = Number(v.starts_at || 0);
            const e = Number(v.expires_at || 0);
            if (s && now < s) return false;
            if (e && now > e) return false;
            return true;
          })
          .sort((a, b) => (Number(b.min_purchase || 0) - Number(a.min_purchase || 0)));
            
        const eligible = activeAuto.find(v => Number(subtotal) >= Number(v.min_purchase || 0));
        if (eligible) {
          const maxDiscount = Number(eligible.max_discount || shipping_fee); 
          autoShippingDiscount = Math.min(shipping_fee, maxDiscount); // Trừ tối đa bằng phí ship
          autoVoucherCode = eligible.code || null;
          console.log(`[CORE] ✅ Applied auto-freeship: ${autoVoucherCode} with discount: ${autoShippingDiscount}`);
        }
      } catch (e) { console.error('[CORE] Error in auto-freeship logic:', e); }
      return { autoShippingDiscount, autoVoucherCode };
    }
    
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
    // FIX: Đảm bảo total lấy từ buyer_total_amount (nếu có trong orderIncome)
    total: orderIncome.buyer_total_amount || raw.total_amount || 0,
    
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
    // Giữ nguyên logic này để lưu vào cột buyer_paid_amount
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
  // Lấy province_code - Ưu tiên customer.province_code, rồi receiver, rồi lookup từ text
  let provinceCode = order.customer?.province_code || order.receiver_province_code || '';
  
  if (!provinceCode) {
    const provinceName = order.shipping_province || order.customer?.province || '';
    if (provinceName) {
      provinceCode = await lookupProvinceCode(env, provinceName);
    }
  }
  
  // Lấy district_code - Ưu tiên customer.district_code, rồi receiver, rồi lookup từ text
  let districtCode = order.customer?.district_code || order.receiver_district_code || '';
  
  if (!districtCode && provinceCode) {
    const districtName = order.shipping_district || order.customer?.district || '';
    if (districtName) {
      districtCode = await lookupDistrictCode(env, provinceCode, districtName);
    }
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
    ward_code: order.customer?.commune_code || order.customer?.ward_code || order.receiver_ward_code || order.receiver_commune_code || ''
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
    
    // ✅ KÍCH HOẠT LOGIC: Tính toán lại Revenue/Total (Trừ ship nếu >150k)
    // Nếu thiếu dòng này, logic Freeship bạn viết ở dưới sẽ không bao giờ chạy.
    order = await calculateOrderFinancials(order, env);

    console.log('[ORDER-CORE] Saving order to D1:', order.order_number || order.id);
  
    // 1. Chuẩn bị dữ liệu Order
    const orderId = order.id || order.order_number; // ID dạng string/UUID
    const now = Date.now();
    
    // ✅ Normalize địa chỉ (thêm province_code, district_code)
    const addressCodes = await normalizeOrderAddress(env, order);
    console.log('[ORDER-CORE] Address codes:', addressCodes);
    
    // ✅ FIX: Parse items an toàn (xử lý trường hợp items là chuỗi JSON)
    let rawItems = order.items;
    if (typeof rawItems === 'string') {
      try { rawItems = JSON.parse(rawItems); } catch (e) { rawItems = []; }
    }
    
    // ✅ Enrich items với weight từ variants
    const items = await enrichItemsWeight(env, Array.isArray(rawItems) ? rawItems : []);
    console.log(`[ORDER-CORE] Preparing to save ${items.length} items for Order ${order.order_number || order.id}`);
  
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
      superai_code, carrier_id, shipping_service_code, shipping_option_id, -- ✅ Thêm superai_code
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
      ?, ?, ?, ?, -- ✅ Thêm 4 dấu hỏi cho 4 cột mới (superai_code + 3 cột cũ)
      ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?,
      ?, ?
    )
    ON CONFLICT(order_number) DO UPDATE SET
      status = excluded.status,
      updated_at = excluded.updated_at,
      tracking_number = excluded.tracking_number,
      shipping_carrier = excluded.shipping_carrier,
      superai_code = excluded.superai_code
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
    // Tối ưu hóa: Chỉ ưu tiên Buyer Paid Amount hoặc Total. Loại bỏ Revenue khỏi fallback nếu không rõ mục đích.
    Number(order.buyer_paid_amount || order.total || 0), 
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
    
    // ✅ Map dữ liệu vào 4 cột mới
    String(order.superai_code || ''),
    String(order.carrier_id || ''),
    String(order.shipping_service || order.shipping_service_code || ''),
    String(order.shipping_option_id || '1'),

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

    // 3. Xử lý Order Items - ✅ CHỐT AN TOÀN: Chỉ cập nhật nếu có items
    const statements = [];
    
    // Kiểm tra items hợp lệ
    const validItems = Array.isArray(items) && items.length > 0;
    
    if (validItems) {
      // CHỈ KHI CÓ ITEMS MỚI THỰC HIỆN XÓA CŨ - THÊM MỚI
      // Giúp bảo vệ dữ liệu cũ nếu frontend lỡ gửi lên mảng rỗng
      console.log(`[ORDER-CORE] Updating ${items.length} items for Order ID ${dbOrderId}`);

      statements.push(
        env.DB.prepare("DELETE FROM order_items WHERE order_id = ?").bind(dbOrderId)
      );
      
      // Insert từng item
      for (const item of items) {
        if (!item || !item.name) continue;
        
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
            item.variant_id || item.id || null,  
            String(item.sku || item.id || ''),
            String(item.name || item.title || 'Sản phẩm'), 
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
    } else {
      console.warn(`[ORDER-CORE] ⚠️ Empty items list received for Order ${dbOrderId}. SKIPPING item update to preserve existing data.`);
    }

    // ✅ Chạy batch (luôn chạy vì có ít nhất DELETE statement)
    if (statements.length > 0) {
      await env.DB.batch(statements);
      console.log(`[ORDER-CORE] ✅ Executed ${statements.length} SQL statements`);
    }

    console.log('[ORDER-CORE] ✅ Saved successfully. DB ID:', dbOrderId);
    return { ok: true, id: dbOrderId, order_number: orderId };

  } catch (e) {
    console.error('[ORDER-CORE] ❌ Save failed:', e);
    return { ok: false, error: e.message };
  }
} // <--- Dòng này CHỈ NÊN XUẤT HIỆN 1 LẦN để đóng hàm saveOrderToD1

// ===================================================================
// 5. CALCULATE FINANCIALS (SINGLE SOURCE OF TRUTH)
// ===================================================================

/**
 * Tính toán toàn bộ thông số tài chính cuối cùng của đơn hàng (Subtotal, Discount, Shipping, Revenue, Profit)
 * @param {object} order - Đối tượng đơn hàng thô
 * @param {object} env - Worker env
 * @returns {object} order - Đối tượng order đã được bổ sung/cập nhật các trường tài chính
 */
export async function calculateOrderFinancials(order, env) {
  // 1. Tính Subtotal và Cost từ Items
  const items = order.items || [];
  const subtotal = items.reduce((sum, item) =>
    sum + Number(item.price || 0) * Number(item.qty || 1), 0
  );
  const cost = items.reduce((sum, item) =>
    sum + Number(item.cost || 0) * Number(item.qty || 1), 0
  );

  // 2. Lấy Phí Ship và Voucher/Discount thô
  const shipping_fee = Number(order.shipping_fee || 0);
  const voucher_code_input = order.voucher_code || order.totals?.voucher_code || null;
  
  let final_discount = Number(order.discount || 0);
  let final_ship_discount = Number(order.shipping_discount || 0);
  let final_voucher_code = null;
  
  // 3. Re-validate Voucher Code (Nếu có)
  if (voucher_code_input) {
    try {
      const fakeReq = {
        url: 'fake/url',
        method: 'POST',
        headers: new Headers(),
        json: async () => ({
          code: voucher_code_input,
          customer_id: order.customer?.id || null,
          subtotal: subtotal
        })
      };
      
      const applyRes = await applyVoucher(fakeReq, env);
      const applyData = await applyRes.json();
      
      if (applyRes.status === 200 && applyData.ok && applyData.valid) {
        final_voucher_code = applyData.code;
        final_discount = applyData.discount || 0;
        final_ship_discount = applyData.ship_discount || 0;
      }
    } catch (e) { console.error('[CORE] Voucher re-validation failed:', e); }
  }

  // 4. Áp dụng Auto Freeship (Luôn chạy để đồng bộ)
  const { autoShippingDiscount, autoVoucherCode } = await getAutoFreeshipDiscount(
    env, 
    subtotal, 
    shipping_fee
  );
  
  // 5. Tính toán TỔNG GIẢM SHIP TỐT NHẤT
  const best_shipping_discount = Math.max(final_ship_discount, autoShippingDiscount);
  
  // Chọn mã voucher cuối cùng (ưu tiên mã được áp dụng/gửi lên, nếu mã tự động tốt hơn thì dùng mã tự động)
  if (autoShippingDiscount > final_ship_discount && autoVoucherCode) {
    final_voucher_code = autoVoucherCode;
  } else if (final_voucher_code === null) {
    final_voucher_code = voucher_code_input;
  }
  
  // 6. Tính Revenue & Profit & Total (FIXED: Net Revenue cho Freeship)
  const actualShippingFee = Math.max(0, shipping_fee - best_shipping_discount);

  // Kiểm tra điều kiện Freeship: Có mã Auto Freeship HOẶC Đơn hàng >= 150k
  const isFreeShip = best_shipping_discount > 0 || (subtotal >= 150000);
  
  let revenue = 0;
  
  if (isFreeShip) {
      // ✅ CASE FREESHIP: Trừ phí ship vào tiền hàng để bù ship (Shop chịu phí)
      // Revenue = (Tiền hàng - Giảm giá) - Phí ship
      // VD: Hàng 157.5k, Ship 20k -> Revenue lưu 137.5k. 
      // Khi SuperAI cộng 20k ship vào -> Khách trả đủ 157.5k.
      revenue = Math.max(0, subtotal - final_discount - shipping_fee);
      
      // Log để debug
      console.log(`[CORE] 🔥 NET REVENUE (Freeship): Subtotal ${subtotal} - Ship ${shipping_fee} = Revenue ${revenue}`);
  } else {
      // ✅ CASE THƯỜNG: Khách chịu ship
      // Revenue = Tiền hàng - Giảm giá
      revenue = Math.max(0, subtotal - final_discount);
  }

  // [FIX] TOTAL (Tổng khách trả thực tế trên hệ thống)
  // Luôn bằng Revenue + Phí Ship (để hiển thị đúng số tiền khách phải móc ví trả cho Shipper)
  const total = revenue + shipping_fee; 

  // PROFIT (Lợi nhuận) = Doanh thu - Giá vốn
  const profit = Math.max(0, revenue - cost); 

  // 7. Cập nhật Order Object
  order.subtotal = subtotal;
  order.total_cost = cost;
  order.discount = final_discount;
  order.shipping_discount = best_shipping_discount;
  order.actual_shipping_fee = actualShippingFee;
  
  order.revenue = revenue; // Trị giá hàng hóa
  order.total = total;     // Tổng thanh toán
  
  order.profit = profit;
  order.voucher_code = final_voucher_code;
  
  return order;
}

// ===================================================================
// 6. INVENTORY MANAGEMENT (Moved from Helpers)
// ===================================================================
export async function adjustInventory(items, env, direction = -1) {
  console.log('[CORE-INV] Adjusting inventory D1', { itemCount: items?.length, direction });
  for (const it of (items || [])) {
    const variantId = it.id || it.variant_id;
    const sku = it.sku;
    if (!variantId && !sku) continue;

    try {
      let variant = null;
      if (variantId) variant = await env.DB.prepare('SELECT * FROM variants WHERE id = ?').bind(variantId).first();
      if (!variant && sku) variant = await env.DB.prepare('SELECT * FROM variants WHERE sku = ?').bind(sku).first();

      if (!variant) continue;
      const delta = Number(it.qty || 1) * direction;
      const oldStock = Number(variant.stock || 0);
      const newStock = Math.max(0, oldStock + delta);

      await env.DB.prepare('UPDATE variants SET stock = ?, updated_at = ? WHERE id = ?').bind(newStock, Date.now(), variant.id).run();
      await env.DB.prepare('INSERT INTO stock_logs (variant_id, old_stock, new_stock, change, reason, channel, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)').bind(variant.id, oldStock, newStock, delta, direction === -1 ? 'order' : 'return', it.channel || 'website', Date.now()).run();
    } catch (err) { console.error('[CORE-INV] Error:', err); }
  }
}

// ===================================================================
// 7. GET ORDERS (Moved from Admin)
// ===================================================================
export async function getOrders(env, limit = 500) {
  try {
    // 1. Lấy danh sách Orders
    const ordersResult = await env.DB.prepare(`
      SELECT id, order_number, channel, channel_order_id, status, payment_status, fulfillment_status,
        customer_name, customer_phone, customer_email, shipping_name, shipping_phone, shipping_address, 
        shipping_district, shipping_city, shipping_province, shipping_zipcode,
        subtotal, shipping_fee, discount, total, profit, commission_fee, service_fee, 
        seller_transaction_fee, escrow_amount, buyer_paid_amount, coin_used, voucher_seller, voucher_shopee,
        shop_id, shop_name, payment_method, customer_note, admin_note, 
        tracking_number, superai_code, shipping_carrier, carrier_id, created_at, updated_at,
        receiver_province_code, receiver_district_code, receiver_ward_code -- Lấy thêm để debug nếu cần
      FROM orders 
      ORDER BY created_at DESC 
      LIMIT ?
    `).bind(limit).all();

    const orders = ordersResult.results || [];
    if (orders.length === 0) return [];

    // 2. Batch Query Items
    const orderIds = orders.map(o => o.id);
    const BATCH_SIZE = 500;
    const itemsByOrderId = new Map();

    for (let i = 0; i < orderIds.length; i += BATCH_SIZE) {
      const batchIds = orderIds.slice(i, i + BATCH_SIZE);
      const placeholders = batchIds.map(() => '?').join(',');
      
      try {
        const itemsResult = await env.DB.prepare(`
          SELECT order_id, product_id, variant_id, sku, name, variant_name, 
            image, price, cost, quantity, subtotal, channel_item_id, channel_model_id, weight
          FROM order_items WHERE order_id IN (${placeholders}) ORDER BY order_id, id
        `).bind(...batchIds).all();

        for (const item of (itemsResult.results || [])) {
          // ⚠️ FIX CORE: Ép kiểu String cho Key để tránh lỗi Number vs String
          const orderIdKey = String(item.order_id);
          
          if (!itemsByOrderId.has(orderIdKey)) itemsByOrderId.set(orderIdKey, []);
          
          itemsByOrderId.get(orderIdKey).push({
            id: item.variant_id || item.sku || 'unknown',
            product_id: item.product_id,
            sku: item.sku || '',
            name: item.name || 'Sản phẩm',
            variant: item.variant_name || '',
            price: item.price || 0,
            cost: item.cost || 0,
            qty: item.quantity || 1,
            subtotal: item.subtotal || 0,
            image: item.image || null,
            weight: item.weight || 0,
            shopee_item_id: item.channel_item_id || '',
            shopee_model_id: item.channel_model_id || ''
          });
        }
      } catch (e) { console.error('[CORE] Batch items error:', e); }
    }

    // 3. Map kết quả
    return orders.map(row => {
      let shippingAddr = {};
      try { if (row.shipping_address) shippingAddr = JSON.parse(row.shipping_address); } catch (e) {}
      
      // Map data
      return {
        id: row.id, // Giữ nguyên ID gốc (có thể là số)
        order_number: row.order_number,
        status: row.status,
        payment_status: row.payment_status,
        customer: {
          name: row.customer_name,
          phone: row.customer_phone,
          email: row.customer_email,
          address: shippingAddr.address || row.shipping_address || '',
          district: shippingAddr.district || row.shipping_district || '',
          city: shippingAddr.city || row.shipping_city || '',
          province: shippingAddr.province || row.shipping_province || '',
          ward: shippingAddr.ward || shippingAddr.commune || ''
        },
        customer_name: row.customer_name,
        phone: row.customer_phone,
        shipping_provider: row.channel === 'shopee' ? 'Shopee' : null,
        shipping_name: row.channel === 'shopee' ? 'Shopee' : null,
        tracking_code: row.channel_order_id || '',
        tracking_number: row.tracking_number || '',
        superai_code: row.superai_code || '',
        shipping_carrier: row.shipping_carrier || '',
        carrier_id: row.carrier_id || '',
        
        // ⚠️ FIX CORE: Ép kiểu String khi lấy từ Map
        items: itemsByOrderId.get(String(row.id)) || [],
        
        subtotal: row.subtotal,
        shipping_fee: row.shipping_fee,
        discount: row.discount,
        revenue: row.total, // Dùng total làm doanh thu hiển thị
        total: row.total,   // Dùng total làm tổng thanh toán
        profit: row.profit,
        
        commission_fee: row.commission_fee || 0,
        service_fee: row.service_fee || 0,
        seller_transaction_fee: row.seller_transaction_fee || 0,
        escrow_amount: row.escrow_amount || 0,
        buyer_paid_amount: row.buyer_paid_amount || 0,
        coin_used: row.coin_used || 0,
        voucher_seller: row.voucher_seller || 0,
        voucher_shopee: row.voucher_shopee || 0,
        shop_id: row.shop_id,
        shop_name: row.shop_name,
        source: row.channel,
        channel: row.channel,
        payment_method: row.payment_method,
        note: row.customer_note || '',
        createdAt: row.created_at,
        created_at: row.created_at,
        updated_at: row.updated_at
      };
    });
  } catch (e) {
    console.error('[CORE] Get Orders Failed:', e);
    throw e;
  }
}

// ===================================================================
// 8. DELETE ORDER (Moved from Admin)
// ===================================================================
export async function deleteOrder(id, env) {
  console.log('[CORE] Deleting order:', id);
  const orderResult = await env.DB.prepare('SELECT * FROM orders WHERE id = ? OR order_number = ?').bind(id, id).first();
  if (!orderResult) throw new Error('Order not found');

  // Hoàn kho nếu cần
  if (shouldAdjustStock(orderResult.status)) {
    const itemsResult = await env.DB.prepare('SELECT * FROM order_items WHERE order_id = ?').bind(orderResult.id).all();
    if (itemsResult.results?.length > 0) {
      const items = itemsResult.results.map(item => ({ 
        id: item.variant_id, 
        sku: item.sku, 
        qty: item.quantity,
        channel: orderResult.channel 
      }));
      await adjustInventory(items, env, +1); // +1 là trả lại kho
    }
  }

  // Xóa Items và Order
  await env.DB.prepare('DELETE FROM order_items WHERE order_id = ?').bind(orderResult.id).run();
  const result = await env.DB.prepare('DELETE FROM orders WHERE id = ?').bind(orderResult.id).run();
  
  return { success: result.meta.changes > 0, superai_code: orderResult.superai_code };
}

// ===================================================================
// 9. CORE HELPERS (Moved to Core to avoid dependency issues)
// ===================================================================
const CANCEL_STATUSES = ['cancel', 'cancelled', 'huy', 'huỷ', 'hủy', 'returned', 'return', 'pending'];

function shouldAdjustStock(status) {
  const s = String(status || '').toLowerCase();
  return !CANCEL_STATUSES.includes(s);
}