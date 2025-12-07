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

// Hàm tính toán tài chính quan trọng
export function calculateOrderTotals(order) {
  const items = Array.isArray(order.items) ? order.items : [];
  
  // Tính doanh thu (chưa có ship)
  const subtotal = items.reduce((sum, item) => 
    sum + Number(item.price || 0) * Number(item.qty || 1), 0);
  
  // Tính giá vốn
  const costTotal = items.reduce((sum, item) => 
    sum + Number(item.cost || 0) * Number(item.qty || 1), 0);
  
  // Tính lợi nhuận
  const profit = subtotal - costTotal;
  
  const shipping = Number(order.shipping_fee || 0);
  const discount = Number(order.discount || 0) + Number(order.shipping_discount || 0);
  
  // [FIX] Tách biệt Revenue (Trị giá hàng) và Total (Tổng tiền)
  const revenue = Number(order.revenue || (subtotal - discount)); 
  const total = Number(order.total || (revenue + shipping));

  return { subtotal, costTotal, profit, shipping, discount, revenue, total };
}