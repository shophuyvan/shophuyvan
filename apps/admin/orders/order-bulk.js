// apps/admin/orders/order-bulk.js

export function updateBulkToolbar(selectedCount) {
  const toolbar = document.getElementById('bulk-actions-toolbar');
  const countSpan = document.getElementById('selected-count');
  if (toolbar && countSpan) {
    toolbar.style.display = selectedCount > 0 ? 'flex' : 'none';
    countSpan.textContent = `Đã chọn: ${selectedCount}`;
  }
}

export async function printSelectedOrders(selectedIds, orders) {
  if (selectedIds.size === 0) { alert('Chưa chọn đơn hàng!'); return; }
  const superaiCodes = Array.from(selectedIds).map(id => orders.find(o => String(o.id) === id)?.superai_code).filter(Boolean);
  if (superaiCodes.length === 0) { alert('Các đơn đã chọn chưa có mã vận đơn!'); return; }

  Admin.toast(`Đang lấy link in ${superaiCodes.length} đơn...`);
  try {
    const res = await Admin.req('/shipping/print-bulk', { method: 'POST', body: { superai_codes: superaiCodes } });
    if (res.ok && res.print_url) { window.open(res.print_url, '_blank'); } 
    else { alert('Lỗi in hàng loạt: ' + res.message); }
  } catch (e) { alert('Lỗi hệ thống: ' + e.message); }
}

export async function cancelSelectedOrders(selectedIds, orders, reloadCallback) {
  if (selectedIds.size === 0) return;
  const codes = Array.from(selectedIds).map(id => orders.find(o => String(o.id) === id)?.superai_code).filter(Boolean);
  if (codes.length === 0) { alert('Chưa có mã vận đơn!'); return; }
  if (!confirm(`Hủy ${codes.length} vận đơn đã chọn?`)) return;

  Admin.toast(`Đang hủy ${codes.length} vận đơn...`);
  try {
    const res = await Admin.req('/shipping/cancel-bulk', { method: 'POST', body: { superai_codes: codes } });
    if (res.ok) { Admin.toast('✅ Đã hủy hàng loạt'); reloadCallback(); } 
    else { alert('Lỗi: ' + res.message); }
  } catch (e) { alert('Lỗi hệ thống: ' + e.message); }
}

export async function confirmSelectedOrders(selectedIds, orders, reloadCallback) {
  if (selectedIds.size === 0) return;
  const pendingOrders = Array.from(selectedIds)
    .map(id => orders.find(o => String(o.id) === id))
    .filter(o => o && String(o.status).toLowerCase() === 'pending');

  if (pendingOrders.length === 0) { alert('Không có đơn chờ xác nhận!'); return; }
  if (!confirm(`Xác nhận ${pendingOrders.length} đơn hàng?`)) return;

  Admin.toast(`Đang xác nhận ${pendingOrders.length} đơn...`);
  let success = 0;
  
  for (const order of pendingOrders) {
    try {
      const res = await Admin.req('/admin/orders/upsert', { method: 'POST', body: { id: order.id, status: 'processing' } });
      if (res.ok) {
        success++;
        // Tự động tạo vận đơn (Call WaybillCreator nếu có)
        if (window.waybillCreator) await window.waybillCreator.createWaybill(order);
      }
    } catch (e) { console.error('Lỗi đơn ' + order.id, e); }
  }
  
  Admin.toast(`✅ Đã xác nhận ${success} đơn`);
  setTimeout(() => reloadCallback(), 2000);
}