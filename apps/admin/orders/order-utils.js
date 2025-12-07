// apps/admin/orders/order-utils.js

export function formatPrice(n) {
  try {
    return Number(n || 0).toLocaleString('vi-VN') + 'đ';
  } catch (e) {
    return (n || 0) + 'đ';
  }
}

export function formatDate(dateInput) {
  try {
    const date = typeof dateInput === 'number' || /^[0-9]+$/.test(dateInput)
      ? new Date(Number(dateInput))
      : new Date(dateInput);
    return date.toLocaleString('vi-VN');
  } catch (e) {
    return '';
  }
}

export function cloudify(url, transform = 'w_96,q_auto,f_auto,c_fill') {
  if (!url || !url.includes('cloudinary.com')) return url;
  return url.replace('/upload/', `/upload/${transform}/`);
}

export function getPlaceholderImage() {
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48">' +
    '<rect width="48" height="48" fill="#f3f4f6"/>' +
    '<text x="50%" y="52%" dominant-baseline="middle" text-anchor="middle" font-size="10" fill="#9ca3af">no img</text>' +
    '</svg>';
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
}

// Hàm tính toán tài chính (ĐÃ FIX LOGIC TỔNG TIỀN)
export function calculateOrderTotals(order) {
  const items = Array.isArray(order.items) ? order.items : [];
  
  // 1. Tính Subtotal (Tổng tiền hàng thô)
  const subtotal = items.reduce((sum, item) => 
    sum + Number(item.price || 0) * Number(item.qty || 1), 0);
  
  // 2. Tính Giá vốn (Cost)
  const costTotal = items.reduce((sum, item) => 
    sum + Number(item.cost || 0) * Number(item.qty || 1), 0);
  
  // 3. Lấy các thông số giảm giá/ship
  const shipping = Number(order.shipping_fee || 0);
  const orderDiscount = Number(order.discount || 0);          // Giảm giá đơn hàng
  const shipDiscount = Number(order.shipping_discount || 0);  // Giảm giá vận chuyển
  
  // Tổng giảm giá hiển thị
  const discountDisplay = orderDiscount + shipDiscount;
  
  // 4. Tính Revenue (Trị giá hàng - dùng để tính COD/Doanh thu)
  // Revenue = Tiền hàng - Giảm giá hàng hóa (KHÔNG trừ giảm giá ship ở đây)
  const revenue = Number(order.revenue || Math.max(0, subtotal - orderDiscount));

  // 5. Tính Total (Tổng khách phải trả) - QUAN TRỌNG
  // Total = Revenue + (Ship - Giảm giá Ship)
  const realShippingFee = Math.max(0, shipping - shipDiscount);
  const calculatedTotal = revenue + realShippingFee;

  // Ưu tiên lấy total từ backend nếu có, nếu không thì dùng số tính toán
  const total = (order.total !== undefined && order.total !== null) ? Number(order.total) : calculatedTotal;

  // Lợi nhuận = Doanh thu - Giá vốn - (Ship thực tế shop phải chịu nếu free ship cho khách - tuỳ logic, ở đây tính đơn giản)
  const profit = revenue - costTotal;

  return { 
    subtotal, 
    costTotal, 
    profit, 
    shipping, 
    discount: discountDisplay, 
    revenue, 
    total 
  };
}