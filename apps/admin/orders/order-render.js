// apps/admin/orders/order-render.js
import { formatPrice, formatDate, cloudify, getPlaceholderImage, calculateOrderTotals } from './order-utils.js';

// Render Tabs Trạng Thái
export function renderStatusTabs(allOrders, currentStatusFilter, onTabClick) {
  const tabsContainer = document.getElementById('status-tabs-container');
  if (!tabsContainer) return;

  const statusCounts = allOrders.reduce((counts, order) => {
    const status = String(order.status || 'unknown').toLowerCase();
    counts[status] = (counts[status] || 0) + 1;
    return counts;
  }, {});

  const displayStatuses = [
    { key: 'all', name: 'Tất cả' },
    { key: 'pending', name: 'Chờ xác nhận' },
    { key: 'processing', name: 'Chờ lấy hàng' },
    { key: 'shipping', name: 'Đang giao' },
    { key: 'delivered', name: 'Đã giao' },
    { key: 'cancelled', name: 'Đã hủy' },
    { key: 'returned', name: 'Trả hàng/Hoàn tiền' }
  ];

  let tabsHTML = '';
  displayStatuses.forEach(statusInfo => {
    const statusKey = statusInfo.key;
    const count = (statusKey === 'all') ? allOrders.length : (statusCounts[statusKey] || 0);
    const isActive = statusKey === currentStatusFilter;

    if (count > 0 || statusKey === 'all') {
      tabsHTML += `
        <button class="tab ${isActive ? 'active' : ''}" data-status="${statusKey}">
          ${statusInfo.name}
          <span class="count">${count}</span>
        </button>
      `;
    }
  });

  tabsContainer.innerHTML = tabsHTML;
  tabsContainer.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => onTabClick(tab.dataset.status));
  });
}

// Render Bộ Lọc Nguồn (Kênh)
export function renderSourceFilter(currentSourceFilter, onChange) {
  const toolbar = document.querySelector('.toolbar');
  if (!toolbar || document.getElementById('source-filter-select')) return;

  const filterContainer = document.createElement('div');
  Object.assign(filterContainer.style, { display: 'flex', alignItems: 'center', gap: '8px', marginLeft: 'auto', marginRight: '12px' });

  const label = document.createElement('span');
  label.textContent = 'Kênh: ';
  Object.assign(label.style, { fontWeight: '500', fontSize: '14px' });

  const select = document.createElement('select');
  select.id = 'source-filter-select';
  select.className = 'btn';
  Object.assign(select.style, { padding: '6px 12px', border: '1px solid #ccc', height: '38px', outline: 'none' });

  const sources = [
    { value: 'all', text: 'Tất cả kênh' },
    { value: 'website', text: '🌐 Website' },
    { value: 'zalo', text: '📱 Zalo MiniApp' },
    { value: 'shopee', text: '🟠 Shopee' },
    { value: 'lazada', text: '🔵 Lazada' },
    { value: 'tiktok', text: '🎵 TikTok' },
    { value: 'pos', text: '🏪 Tại quầy' }
  ];

  sources.forEach(src => {
    const opt = document.createElement('option');
    opt.value = src.value;
    opt.textContent = src.text;
    if (src.value === currentSourceFilter) opt.selected = true;
    select.appendChild(opt);
  });

  select.addEventListener('change', (e) => onChange(e.target.value));
  filterContainer.appendChild(label);
  filterContainer.appendChild(select);

  const reloadBtn = document.getElementById('reload-orders');
  if (reloadBtn) toolbar.insertBefore(filterContainer, reloadBtn);
  else toolbar.appendChild(filterContainer);
}

// Render Chi Tiết Đơn Hàng (Modal)
export function renderOrderDetail(order) {
  const items = Array.isArray(order.items) ? order.items : [];
  const { subtotal, shipping, discount, total } = calculateOrderTotals(order);

  const customer = order.customer || {};
  const custName = customer.name || order.customer_name || order.name || 'Khách';
  const custPhone = customer.phone || order.phone || '';
  const address = order.address || customer.address || '';
  const shipName = order.shipping_name || order.ship_name || order.shipping_provider || order.provider || '';
  const tracking = order.tracking_code || order.shipping_tracking || '';
  const eta = order.shipping_eta || '';
  const created = formatDate(order.createdAt || order.created_at);

  const itemRows = items.map(item => `
    <tr>
      <td>${item.sku || item.id || ''}</td>
      <td>${item.name || ''}${item.variant ? (' - ' + item.variant) : ''}</td>
      <td style="text-align:right">${item.qty || 1}</td>
      <td style="text-align:right">${formatPrice(item.price || 0)}</td>
      <td style="text-align:right">${formatPrice(item.cost || 0)}</td>
      <td style="text-align:right">${formatPrice((item.price || 0) * (item.qty || 1))}</td>
    </tr>
  `).join('');

  return `
    <div style="margin-bottom:8px">
      <div><b>Khách:</b> ${custName}${custPhone ? ' • ' + custPhone : ''}</div>
      ${address ? `<div><b>Địa chỉ:</b> ${address}</div>` : ''}
      ${shipName ? `<div><b>Vận chuyển:</b> ${shipName}${tracking ? ' • Mã: ' + tracking : ''}${eta ? ' • ' + eta : ''}</div>` : ''}
      ${created ? `<div><b>Ngày tạo:</b> ${created}</div>` : ''}
      <div><b>Trạng thái:</b> ${order.status || 'pending'}</div>
    </div>
    <div class="card">
      <table class="table md-table">
        <thead><tr><th>Mã SP</th><th>Tên/Phân loại</th><th>SL</th><th>Giá bán</th><th>Giá vốn</th><th>Thành tiền</th></tr></thead>
        <tbody>${itemRows || '<tr><td colspan="6" style="color:#6b7280">Không có dòng hàng</td></tr>'}</tbody>
      </table>
      <div style="border-top:1px dashed #e5e7eb;margin-top:8px;padding-top:8px">
        <div style="display:flex;justify-content:space-between"><span>Tổng hàng</span><b>${formatPrice(subtotal)}</b></div>
        <div style="display:flex;justify-content:space-between"><span>Phí vận chuyển</span><b>${formatPrice(shipping)}</b></div>
        ${discount ? `<div style="display:flex;justify-content:space-between;color:#059669"><span>Giảm</span><b>-${formatPrice(discount)}</b></div>` : ''}
        <div style="display:flex;justify-content:space-between;font-size:16px"><span>Tổng thanh toán</span><b>${formatPrice(total)}</b></div>
      </div>
    </div>
  `;
}

// Render 1 Dòng Đơn Hàng (Desktop + Mobile)
export function renderOrderRow(order) {
  const items = Array.isArray(order.items) ? order.items : [];
  
  // ✅ REMOVED: costTotal, profit khỏi destructuring vì không dùng nữa
  const { subtotal, shipping, revenue, total } = calculateOrderTotals(order);

  const customer = order.customer || {};
  const custName = customer.name || order.customer_name || order.name || 'Khách';
  const custPhone = customer.phone || order.phone || '';
  const fullAddress = [customer.address || order.address, customer.ward || order.ward, customer.district || order.district, customer.province || order.province].filter(Boolean).join(', ');

  const provider = String(order.carrier_name || order.shipping_provider || order.provider || order.shipping_name || '');
  
  let trackingRaw = String(order.tracking_number || order.carrier_code || order.tracking_code || order.shipping_tracking || '');
  if (trackingRaw.length > 30 || trackingRaw.includes('-')) trackingRaw = ''; 
  const tracking = trackingRaw;
  
  const superaiCode = String(order.superai_code || '');
  const created = formatDate(order.created_at || order.createdAt || order.createdAtMs);
  const source = String(order.source || order.channel || order.platform || 'Web'); 
  const rawSource = source.toLowerCase();
  const orderId = String(order.id || '');
  const orderStatus = String(order.status || 'pending').toLowerCase();

  // Badges
  let sourceBadge = `<span style="background:#f3f4f6;color:#374151;padding:2px 8px;border-radius:12px;font-size:11px;border:1px solid #d1d5db;font-weight:600">WEB</span>`;
  if (rawSource.includes('shopee')) sourceBadge = `<span style="background:#fff0e6;color:#ee4d2d;padding:2px 8px;border-radius:12px;font-size:11px;border:1px solid #ffcbb8;font-weight:600">SHOPEE</span>`;
  else if (rawSource.includes('lazada')) sourceBadge = `<span style="background:#e0e7ff;color:#3730a3;padding:2px 8px;border-radius:12px;font-size:11px;border:1px solid #c7d2fe;font-weight:600">LAZADA</span>`;
  else if (rawSource.includes('tiktok')) sourceBadge = `<span style="background:#18181b;color:#fff;padding:2px 8px;border-radius:12px;font-size:11px;font-weight:600">TIKTOK</span>`;
  else if (rawSource.includes('zalo') || rawSource.includes('mini')) sourceBadge = `<span style="background:#dbeafe;color:#1e40af;padding:2px 8px;border-radius:12px;font-size:11px;border:1px solid #93c5fd;font-weight:600">ZALO</span>`;
  else if (rawSource.includes('pos')) sourceBadge = `<span style="background:#fef3c7;color:#92400e;padding:2px 8px;border-radius:12px;font-size:11px;border:1px solid #fde68a;font-weight:600">POS</span>`;

  const statusMap = {
    'pending': { text: 'Chờ xác nhận', color: '#d97706', bg: '#fffbeb', border: '#fcd34d' },
    'unpaid':  { text: 'Chờ thanh toán', color: '#d97706', bg: '#fffbeb', border: '#fcd34d' },
    'processing': { text: 'Chờ lấy hàng', color: '#b45309', bg: '#fff7ed', border: '#fed7aa' },
    'confirmed': { text: 'Chờ lấy hàng', color: '#b45309', bg: '#fff7ed', border: '#fed7aa' },
    'shipping': { text: 'Đang giao', color: '#0891b2', bg: '#ecfeff', border: '#a5f3fc' },
    'delivered': { text: 'Đã giao', color: '#16a34a', bg: '#dcfce7', border: '#86efac' },
    'completed': { text: 'Hoàn thành', color: '#16a34a', bg: '#dcfce7', border: '#86efac' },
    'cancelled': { text: 'Đã hủy', color: '#dc2626', bg: '#fef2f2', border: '#fecaca' },
    'returned': { text: 'Đã hoàn tiền', color: '#4b5563', bg: '#f3f4f6', border: '#e5e7eb' }
  };
  const stInfo = statusMap[orderStatus] || { text: orderStatus, color: '#4b5563', bg: '#f3f4f6', border: '#e5e7eb' };
  const statusHTML = `<span style="background:${stInfo.bg};color:${stInfo.color};padding:4px 8px;border-radius:12px;font-weight:600;font-size:12px;border:1px solid ${stInfo.border};display:inline-block;white-space:nowrap">${stInfo.text}</span>`;

  // Items
  const itemsHTML = items.map(item => {
    let img = item.image || item.img || item.variantImage || item.product_image || '';
    img = img ? cloudify(img, 'w_100,h_100,q_auto,f_auto,c_pad') : getPlaceholderImage();
    const itemTitle = String(item.name || item.title || 'Sản phẩm');
    const variantName = item.variant || item.variantName || item.variant_name || item.properties || '';
    return `
      <div class="order-item">
        <img src="${img}" alt="${itemTitle}" class="item-img"/>
        <div class="item-info">
          <div class="item-name">${itemTitle}</div>
          ${variantName ? `<div class="item-variant">${variantName}</div>` : ''}
          <div class="item-price-qty"><span class="item-price">${formatPrice(item.price)}</span><span class="item-qty">x${item.qty||1}</span></div>
        </div>
      </div>
    `;
  }).join('');

  // Desktop Card - ✅ ĐÃ XÓA DÒNG LỢI NHUẬN
  const desktopCard = `
    <div class="order-card-desktop">
      <div class="order-card-header-desktop">
        <div class="order-customer-info">
          <svg width="18" height="18" fill="currentColor" viewBox="0 0 20 20"><path d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z"/></svg>
          <div>
            <div class="customer-name">${custName}</div>
            ${custPhone ? `<div class="customer-phone">${custPhone}</div>` : ''}
            ${fullAddress ? `<div class="customer-address" style="font-size: 12px; color: #6b7280; margin-top: 4px;">📍 ${fullAddress}</div>` : ''}
          </div>
        </div>
        <div class="order-meta" style="display:flex;flex-direction:column;align-items:flex-end;gap:6px">
          <div style="display:flex;align-items:center;gap:8px">${sourceBadge}<span class="order-id-badge" style="font-weight:bold;color:#333">#${orderId.slice(-8)}</span></div>
          ${statusHTML}
          <span class="order-date" style="font-size:11px;color:#888;margin-top:2px">${created}</span>
        </div>
      </div>
      <div class="order-card-body">
        <div class="order-items-col">${itemsHTML}</div>
        <div class="order-details-col">
          <div class="detail-row"><span class="label">Trị giá hàng:</span><span class="value" style="font-weight:600">${formatPrice(revenue)}</span></div>
          <div class="detail-row"><span class="label">Phí ship:</span><span class="value">${formatPrice(shipping)}</span></div>
          <div class="detail-row" style="border-top:1px dashed #ccc;margin-top:4px;padding-top:4px"><span class="label" style="font-weight:bold;color:#d32f2f">TỔNG TIỀN:</span><span class="value price-total" style="font-weight:bold;color:#d32f2f">${formatPrice(total)}</span></div>
          
          <div class="detail-row" style="margin-top: 8px;"><span class="label">Đơn vị VC:</span><span class="value" style="font-size: 12px;">${order.carrier_name || order.shipping_carrier || 'Chưa có'}</span></div>
          <div class="detail-row"><span class="label">Mã vận đơn:</span><span class="value tracking-code">${order.superai_code || order.tracking_number || order.tracking_code || 'Chưa tạo'}</span></div>
          ${(order.escrow_amount > 0) ? `<div style="margin-top:8px;padding-top:8px;border-top:1px dashed #e5e7eb;font-size:12px;"><div class="detail-row" style="color:#16a34a;font-weight:700;"><span class="label">THỰC NHẬN:</span><span class="value">${formatPrice(order.escrow_amount)}</span></div></div>` : ''}
          ${tracking ? `<div class="detail-row"><span class="label">Tracking:</span><span class="value tracking-code" style="font-weight:bold;font-size:13px;color:#000;">${tracking}</span></div>` : ''}
          <div class="detail-row"><span class="label">Nguồn:</span><span class="value">${source}</span></div>
        </div>
        <div class="order-actions-col">
          ${(orderStatus === 'pending' || orderStatus === 'unpaid' || orderStatus === 'new') ? `
            <button class="btn btn-success" data-confirm="${orderId}" style="background-color:#10b981;color:white;border-color:#10b981;">✅ Xác nhận đơn</button>
            <button class="btn" data-edit="${orderId}" style="background-color:#f59e0b;color:white;border-color:#f59e0b;">✏️ Sửa giá/Ship</button>
            <button class="btn btn-danger" data-cancel-order="${orderId}" style="background-color:#ef4444;color:white;border-color:#ef4444;">🚫 Hủy đơn hàng</button>
          ` : `
            <button class="btn btn-view" data-print="${orderId}" style="background-color:#007bff;color:white;border-color:#007bff;">🖨️ In Vận Đơn</button>
            <button class="btn btn-danger" data-cancel="${orderId}">🚫 Hủy Vận Đơn</button>
            <button class="btn btn-danger" data-delete="${orderId}">🗑️ Xóa</button>
          `}
        </div>
      </div>
    </div>
  `;

  // Mobile Card - ✅ ĐÃ XÓA DÒNG LỢI NHUẬN
  const mobileCard = `
    <div class="order-card-mobile" data-order-id="${orderId}">
      <div class="order-card-header">
        <div class="order-customer"><svg width="16" height="16" fill="currentColor" viewBox="0 0 20 20"><path d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z"/></svg><span>${custName}</span></div>
        <div class="order-id">Đơn ${orderId.slice(-8)}</div>
      </div>
      <div class="order-card-items">${itemsHTML}</div>
      <div class="order-card-footer">
        <div class="order-info-row"><span class="label">Trị giá hàng:</span><span class="value" style="font-weight:600">${formatPrice(revenue)}</span></div>
        <div class="order-info-row"><span class="label">Phí ship:</span><span class="value">${formatPrice(shipping)}</span></div>
        <div class="detail-row"><span class="label">Tổng khách trả:</span><span class="value price-total">${formatPrice(total)}</span></div>
        ${provider ? `<div class="order-info-row"><span class="label">Đơn vị VC:</span><span class="value" style="font-size: 11px;">${provider}</span></div>` : ''}
        ${tracking ? `<div class="order-info-row"><span class="label">Mã vận đơn:</span><span class="value" style="font-family: monospace; font-size: 10px;">${tracking}</span></div>` : ''}
        <div class="order-info-row"><span class="label">Thời gian:</span><span class="value">${created}</span></div>
        <div class="order-actions">
          <button class="btn btn-sm btn-print" data-print="${orderId}">In Vận Đơn</button>
          <button class="btn btn-sm btn-cancel" data-cancel="${orderId}">Hủy Vận Đơn</button>
          <button class="btn btn-sm btn-delete" data-delete="${orderId}">Xóa</button>
        </div>
      </div>
    </div>
  `;

  return `
    <tr class="order-row-desktop"><td style="width:40px;vertical-align:top;padding-top:20px;"><input type="checkbox" class="order-checkbox" data-order-id="${orderId}" style="width:18px;height:18px;cursor:pointer;"></td><td colspan="2">${desktopCard}</td></tr>
    <tr class="order-row-mobile"><td style="width:40px;vertical-align:top;padding-top:20px;"><input type="checkbox" class="order-checkbox" data-order-id="${orderId}" style="width:18px;height:18px;cursor:pointer;"></td><td colspan="2">${mobileCard}</td></tr>
  `;
}