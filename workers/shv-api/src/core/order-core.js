// ===============================================
// SHOP HUY VÂN - ORDER CORE ENGINE
// Chuẩn hóa đơn hàng từ đa kênh (Shopee, Lazada, TikTok)
// về format database nội bộ.
// ===============================================

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
    
    // Link ảnh (nếu có)
    image: item.image_info ? item.image_info.image_url : null
  }));

  // Tính toán tài chính
  const subtotal = items.reduce((sum, i) => sum + (i.price * i.quantity), 0);
  
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
    
    coin_used: raw.coin_info?.coin_offset || 0,
    voucher_code: raw.voucher_code || '', 
    voucher_seller: 0, // Cần logic bóc tách nếu Shopee trả về chi tiết
    voucher_shopee: 0,
    
    estimated_shipping_fee: raw.estimated_shipping_fee || 0,
    actual_shipping_fee_confirmed: raw.actual_shipping_fee_confirmed || 0,
    
    buyer_paid_amount: raw.escrow_amount || raw.total_amount || 0,

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