// apps/admin/orders/order-actions.js
import { formatPrice } from './order-utils.js';

export async function editOrderPrice(orderId, orders, reloadCallback) {
  const order = orders.find(o => String(o.id || '') === orderId);
  if (!order) return;

  const currentShip = Number(order.shipping_fee || 0);
  const currentDiscount = Number(order.discount || 0);
  const subtotal = Number(order.subtotal || 0);

  const newShipStr = prompt(`🚚 SỬA PHÍ VẬN CHUYỂN (VNĐ)\n- Nhập số tiền phí ship (VD: 30000)\n- Nhập 0 nếu miễn phí ship`, currentShip);
  if (newShipStr === null) return;

  const newDiscountStr = prompt(`💰 SỬA GIẢM GIÁ (VNĐ)\n- Nhập số tiền muốn giảm (VD: 20000)\n- Tổng tiền hàng: ${formatPrice(subtotal)}`, currentDiscount);
  if (newDiscountStr === null) return;

  const newShip = Number(newShipStr.replace(/[^0-9]/g, ''));
  const newDiscount = Number(newDiscountStr.replace(/[^0-9]/g, ''));

  if (isNaN(newShip) || isNaN(newDiscount)) { alert('❌ Vui lòng chỉ nhập số tiền (VNĐ)!'); return; }
  if (newDiscount > subtotal + newShip) { alert('❌ Giảm giá không thể lớn hơn tổng đơn!'); return; }

  Admin.toast('⏳ Đang cập nhật...');
  try {
    const res = await Admin.req('/admin/orders/upsert', {
      method: 'POST',
      body: { id: orderId, shipping_fee: newShip, discount: newDiscount, items: order.items }
    });
    if (res.ok) { Admin.toast(`✅ Đã cập nhật`); reloadCallback(); } 
    else { alert('Lỗi: ' + (res.message || 'Unknown')); }
  } catch (e) { alert('Lỗi hệ thống: ' + e.message); }
}

export async function cancelOrder(orderId, reloadCallback) {
  if (!confirm(`Bạn chắc chắn muốn HỦY ĐƠN HÀNG ${orderId}?`)) return;
  Admin.toast('⏳ Đang hủy đơn...');
  try {
    const res = await Admin.req('/admin/orders/upsert', { method: 'POST', body: { id: orderId, status: 'cancelled' } });
    if (res.ok) { Admin.toast('✅ Đã hủy đơn hàng'); reloadCallback(); } 
    else { alert('Lỗi: ' + res.message); }
  } catch (e) { alert('Lỗi hệ thống: ' + e.message); }
}

export async function confirmOrder(orderId, orders, reloadCallback) {
  const order = orders.find(o => String(o.id || '') === orderId);
  if (!order) return;
  if (String(order.status || '').toLowerCase() !== 'pending') { alert('Chỉ xác nhận đơn chờ xử lý!'); return; }
  if (!confirm(`Xác nhận đơn hàng ${orderId}? Hệ thống sẽ tự tạo vận đơn.`)) return;

  Admin.toast('⏳ Đang xác nhận và tạo vận đơn...');
  try {
    const res = await Admin.req('/admin/orders/upsert', { method: 'POST', body: { ...order, status: 'processing' } });
    if (res.ok) {
      Admin.toast('✅ Đã xác nhận! Đang tạo vận đơn...');
      setTimeout(() => reloadCallback(), 2000);
    } else { alert('Lỗi: ' + res.message); }
  } catch (e) { alert('Lỗi hệ thống: ' + e.message); }
}

export async function deleteOrder(orderId, reloadCallback) {
  if (!confirm(`Xác nhận xoá đơn hàng ${orderId}?`)) return;
  try {
    const result = await Admin.req('/admin/orders/delete', { method: 'POST', body: { id: orderId } });
    if (result?.ok) { Admin.toast('✅ Đã xoá đơn hàng'); reloadCallback(); } 
    else { alert('Xoá thất bại: ' + result?.message); }
  } catch (error) { alert('Lỗi xoá đơn: ' + error.message); }
}

export async function printOrder(orderId, orders) {
  const order = orders.find(o => String(o.id || '') === orderId);
  if (!order) return;
  const superaiCode = order.superai_code || order.tracking_number || '';
  if (!superaiCode) { alert('Đơn chưa có mã vận đơn!'); return; }
  
  Admin.toast(`Đang lấy bản in mã: ${superaiCode}...`);
  try {
    const res = await Admin.req('/shipping/print', { method: 'POST', body: { superai_code: superaiCode, order: order } });
    if (res.ok && res.print_html) {
      const w = window.open('', '_blank'); w.document.write(res.print_html); w.document.close();
    } else if (res.ok && res.print_url) {
      window.open(res.print_url, '_blank');
    } else { alert('Lỗi in: ' + res.message); }
  } catch (e) { alert('Lỗi hệ thống: ' + e.message); }
}

export async function cancelWaybill(orderId, orders, reloadCallback) {
  const order = orders.find(o => String(o.id || '') === orderId);
  if (!order) return;
  const superaiCode = order.superai_code || '';
  if (!superaiCode) { alert('Đơn chưa có mã vận đơn!'); return; }
  if (!confirm(`HỦY VẬN ĐƠN ${superaiCode}?`)) return;
  
  Admin.toast('Đang hủy vận đơn...');
  try {
    const res = await Admin.req('/shipping/cancel', { method: 'POST', body: { superai_code: superaiCode } });
    if (res.ok) { Admin.toast('✅ Đã hủy vận đơn'); reloadCallback(); } 
    else { alert('Lỗi: ' + res.message); }
  } catch (e) { alert('Lỗi hệ thống: ' + e.message); }
}