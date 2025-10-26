/**
 * Orders Manager - Quản lý đơn hàng
 * Version: 2.0
 */

class OrdersManager {
  constructor() {
    this.orders = [];
    this.currentOrder = null;
  }

  // ==================== UTILITIES ====================
  
  cloudify(url, transform = 'w_96,q_auto,f_auto,c_fill') {
    if (!url || !url.includes('cloudinary.com')) return url;
    return url.replace('/upload/', `/upload/${transform}/`);
  }

  formatPrice(n) {
    try {
      return Number(n || 0).toLocaleString('vi-VN') + 'đ';
    } catch (e) {
      return (n || 0) + 'đ';
    }
  }

  getNestedValue(obj, path) {
    try {
      return path.split('.').reduce((value, key) => 
        (value && typeof value === 'object') ? value[key] : '', obj) || '';
    } catch (e) {
      return '';
    }
  }

  formatDate(dateInput) {
    try {
      const date = typeof dateInput === 'number' || /^[0-9]+$/.test(dateInput)
        ? new Date(Number(dateInput))
        : new Date(dateInput);
      return date.toLocaleString('vi-VN');
    } catch (e) {
      return '';
    }
  }

  getPlaceholderImage() {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48">' +
      '<rect width="48" height="48" fill="#f3f4f6"/>' +
      '<text x="50%" y="52%" dominant-baseline="middle" text-anchor="middle" font-size="10" fill="#9ca3af">no img</text>' +
      '</svg>';
    return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
  }

  // ==================== LOAD ORDERS ====================
  
  async loadOrders() {
    try {
      const response = await Admin.req('/api/orders', { method: 'GET' });
      this.orders = response?.items || [];
      this.renderOrdersList();
    } catch (error) {
      console.error('[OrdersManager] Load orders error:', error);
      Admin.toast('❌ Lỗi tải danh sách đơn hàng');
    }
  }

  // ==================== CALCULATE ORDER TOTALS ====================
  
  calculateOrderTotals(order) {
    const items = Array.isArray(order.items) ? order.items : [];
    const subtotal = items.reduce((sum, item) => 
      sum + Number(item.price || 0) * Number(item.qty || 1), 0);
    const shipping = Number(order.shipping_fee || 0);
    const discount = Number(order.discount || 0) + Number(order.shipping_discount || 0);
    const total = Math.max(0, subtotal + shipping - discount);

    return { subtotal, shipping, discount, total };
  }

  // ==================== RENDER ORDERS LIST ====================
  
  renderOrdersList() {
    const tbody = document.getElementById('list');
    if (!tbody) return;

    if (this.orders.length === 0) {
      tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;color:#6b7280;padding:2rem">Chưa có đơn hàng</td></tr>';
      return;
    }

    tbody.innerHTML = this.orders.map(order => this.renderOrderRow(order)).join('');

    // Wire event listeners
    this.wireOrderRowEvents();
  }

 renderOrderRow(order) {
    const items = Array.isArray(order.items) ? order.items : [];
    
    // Totals
    const { total } = this.calculateOrderTotals(order);

    // Customer info
    const customer = order.customer || {};
    const custName = customer.name || order.customer_name || order.name || 'Khách';
    const custPhone = customer.phone || order.phone || '';

    // Shipping info
    const provider = String(order.shipping_provider || order.provider || order.shipping_name || '');
    const tracking = String(order.tracking_code || order.shipping_tracking || 
                           order.ship_tracking || order.shipping?.tracking_code || '');

    // Other info
    const created = this.formatDate(order.created_at || order.createdAt || order.createdAtMs);
    const source = String(order.source || order.channel || order.platform || 'Web');
    const orderId = String(order.id || '');

    // Render all items with images
    const itemsHTML = items.map(item => {
      let img = item.image || item.img || item.thumbnail || item.variant_image || '';
      img = img ? this.cloudify(img, 'w_80,h_80,q_auto,f_auto,c_fill') : this.getPlaceholderImage();
      
      const itemTitle = String(item.name || item.title || item.sku || 'Sản phẩm');
      const variantName = item.variant ? String(item.variant) : '';
      const itemQty = Number(item.qty || item.quantity || 1);
      const itemPrice = Number(item.price || 0);
      
      return `
        <div class="order-item">
          <img src="${img}" alt="${itemTitle}" class="item-img"/>
          <div class="item-info">
            <div class="item-name">${itemTitle}</div>
            ${variantName ? `<div class="item-variant">${variantName}</div>` : ''}
            <div class="item-price-qty">
              <span class="item-price">${this.formatPrice(itemPrice)}</span>
              <span class="item-qty">x${itemQty}</span>
            </div>
          </div>
        </div>
      `;
    }).join('');

   // Desktop card view (hiển thị đẹp hơn cho PC)
    const desktopCard = `
      <div class="order-card-desktop">
        <div class="order-card-header-desktop">
          <div class="order-customer-info">
            <svg width="18" height="18" fill="currentColor" viewBox="0 0 20 20">
              <path d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z"/>
            </svg>
            <div>
              <div class="customer-name">${custName}</div>
              ${custPhone ? `<div class="customer-phone">${custPhone}</div>` : ''}
            </div>
          </div>
          <div class="order-meta">
            <span class="order-id-badge">Đơn #${orderId.slice(-8)}</span>
            <span class="order-date">${created}</span>
          </div>
        </div>
        <div class="order-card-body">
          <div class="order-items-col">
            ${itemsHTML}
          </div>
          <div class="order-details-col">
            <div class="detail-row">
              <span class="label">Tổng tiền:</span>
              <span class="value price-total">${this.formatPrice(total)}</span>
            </div>
            ${provider ? `
              <div class="detail-row">
                <span class="label">Vận chuyển:</span>
                <span class="value">${provider}</span>
              </div>
            ` : ''}
            ${tracking ? `
              <div class="detail-row">
                <span class="label">Tracking:</span>
                <span class="value tracking-code">${tracking}</span>
              </div>
            ` : ''}
            <div class="detail-row">
              <span class="label">Nguồn:</span>
              <span class="value">${source}</span>
            </div>
          </div>
          <div class="order-actions-col">
            <button class="btn btn-view" data-view="${orderId}">
              <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
              </svg>
              Xem
            </button>
            <button class="btn btn-danger" data-delete="${orderId}">
              <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
              </svg>
              Xóa
            </button>
          </div>
        </div>
      </div>
    `;

    // Mobile card view
    const mobileCard = `
      <div class="order-card-mobile" data-order-id="${orderId}">
        <div class="order-card-header">
          <div class="order-customer">
            <svg width="16" height="16" fill="currentColor" viewBox="0 0 20 20">
              <path d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z"/>
            </svg>
            <span>${custName}</span>
            ${custPhone ? `<span class="phone">• ${custPhone}</span>` : ''}
          </div>
          <div class="order-id">Đơn ${orderId.slice(-8)}</div>
        </div>
        
        <div class="order-card-items">
          ${itemsHTML}
        </div>
        
        <div class="order-card-footer">
          <div class="order-info-row">
            <span class="label">Tổng tiền:</span>
            <span class="value price">${this.formatPrice(total)}</span>
          </div>
          ${provider ? `
            <div class="order-info-row">
              <span class="label">Vận chuyển:</span>
              <span class="value">${provider}</span>
            </div>
          ` : ''}
          ${tracking ? `
            <div class="order-info-row">
              <span class="label">Mã vận đơn:</span>
              <span class="value">${tracking}</span>
            </div>
          ` : ''}
          <div class="order-info-row">
            <span class="label">Thời gian:</span>
            <span class="value">${created}</span>
          </div>
          
          <div class="order-actions">
            <button class="btn btn-sm btn-view" data-view="${orderId}">
              <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
              </svg>
              Xem chi tiết
            </button>
            <button class="btn btn-sm btn-danger" data-delete="${orderId}">
              <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
              </svg>
              Xóa
            </button>
          </div>
        </div>
      </div>
    `;

    return `
      <tr class="order-row-desktop">
        <td colspan="8">
          ${desktopCard}
        </td>
      </tr>
      <tr class="order-row-mobile">
        <td colspan="8">
          ${mobileCard}
        </td>
      </tr>
    `;
  }

  wireOrderRowEvents() {
    // View buttons
    document.querySelectorAll('[data-view]').forEach(btn => {
      btn.onclick = () => {
        const id = btn.getAttribute('data-view');
        const order = this.orders.find(o => String(o.id || '') === id);
        if (order) this.showOrderDetail(order);
      };
    });

    // Delete buttons
    document.querySelectorAll('[data-delete]').forEach(btn => {
      btn.onclick = async () => {
        const id = btn.getAttribute('data-delete');
        await this.deleteOrder(id);
      };
    });
  }

  // ==================== DELETE ORDER ====================
  
  async deleteOrder(orderId) {
    if (!confirm(`Xác nhận xoá đơn hàng ${orderId}?`)) return;

    try {
      const result = await Admin.req('/admin/orders/delete', {
        method: 'POST',
        body: { id: orderId }
      });

      if (result?.ok) {
        Admin.toast('✅ Đã xoá đơn hàng');
        this.loadOrders();
      } else {
        alert('Xoá thất bại: ' + (result?.message || 'Lỗi'));
      }
    } catch (error) {
      alert('Lỗi xoá đơn: ' + error.message);
    }
  }

  // ==================== SHOW ORDER DETAIL ====================
  
  showOrderDetail(order) {
    this.currentOrder = order;
    window.__currentOrder = order; // Backward compatibility

    const modal = document.getElementById('modal-detail');
    const body = document.getElementById('md-body');
    const actions = document.getElementById('ship-actions');

    if (!modal || !body) return;

    modal.dataset.orderId = String(order.id || order._id || '');

    // Render detail
    body.innerHTML = this.renderOrderDetail(order);

    // Show shipping actions
    if (actions) actions.style.display = 'flex';

    // Show modal
    modal.style.display = 'flex';
  }

  renderOrderDetail(order) {
    const items = Array.isArray(order.items) ? order.items : [];
    const { subtotal, shipping, discount, total } = this.calculateOrderTotals(order);

    // Customer info
    const customer = order.customer || {};
    const custName = customer.name || order.customer_name || order.name || 'Khách';
    const custPhone = customer.phone || order.phone || '';
    const address = order.address || customer.address || '';

    // Shipping info
    const shipName = order.shipping_name || order.ship_name || 
                     order.shipping_provider || order.provider || '';
    const tracking = order.tracking_code || order.shipping_tracking || '';
    const eta = order.shipping_eta || '';
    const created = this.formatDate(order.createdAt || order.created_at);

    // Items table rows
    const itemRows = items.map(item => `
      <tr>
        <td>${item.sku || item.id || ''}</td>
        <td>${item.name || ''}${item.variant ? (' - ' + item.variant) : ''}</td>
        <td style="text-align:right">${item.qty || 1}</td>
        <td style="text-align:right">${this.formatPrice(item.price || 0)}</td>
        <td style="text-align:right">${this.formatPrice(item.cost || 0)}</td>
        <td style="text-align:right">${this.formatPrice((item.price || 0) * (item.qty || 1))}</td>
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
          <thead>
            <tr>
              <th>Mã SP</th>
              <th>Tên/Phân loại</th>
              <th>SL</th>
              <th>Giá bán</th>
              <th>Giá vốn</th>
              <th>Thành tiền</th>
            </tr>
          </thead>
          <tbody>
            ${itemRows || '<tr><td colspan="6" style="color:#6b7280">Không có dòng hàng</td></tr>'}
          </tbody>
        </table>

        <div style="border-top:1px dashed #e5e7eb;margin-top:8px;padding-top:8px">
          <div style="display:flex;justify-content:space-between">
            <span>Tổng hàng</span>
            <b>${this.formatPrice(subtotal)}</b>
          </div>
          <div style="display:flex;justify-content:space-between">
            <span>Phí vận chuyển</span>
            <b>${this.formatPrice(shipping)}</b>
          </div>
          ${discount ? `
            <div style="display:flex;justify-content:space-between;color:#059669">
              <span>Giảm</span>
              <b>-${this.formatPrice(discount)}</b>
            </div>
          ` : ''}
          <div style="display:flex;justify-content:space-between;font-size:16px">
            <span>Tổng thanh toán</span>
            <b>${this.formatPrice(total)}</b>
          </div>
        </div>
      </div>
    `;
  }

  // ==================== PRINT WAYBILL ====================
  
  openPrintWaybill(order, tracking) {
    const customer = order.customer || {};
    const html = `
      <!doctype html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Vận đơn</title>
        <style>
          body {
            font-family: system-ui, -apple-system, sans-serif;
            padding: 16px;
          }
          .box {
            border: 1px dashed #444;
            padding: 12px;
            margin-bottom: 12px;
          }
          .row {
            display: flex;
            justify-content: space-between;
          }
        </style>
      </head>
      <body>
        <h2>Vận đơn - ${order.shipping_name || order.shipping_provider || ''}</h2>
        <div class="box">
          <div><b>Tracking:</b> ${tracking || order.tracking || ''}</div>
          <div><b>Đơn hàng:</b> ${order.id || ''}</div>
          <div><b>Khách:</b> ${customer.name || order.customer_name || order.name || ''}</div>
          <div><b>ĐT:</b> ${customer.phone || order.phone || ''}</div>
          <div><b>Địa chỉ:</b> ${customer.address || order.address || ''}</div>
        </div>
        <div class="box">
          <div class="row">
            <span>Phí VC:</span>
            <b>${this.formatPrice(order.shipping_fee || 0)}</b>
          </div>
          <div class="row">
            <span>Tổng:</span>
            <b>${this.formatPrice(order.revenue || 0)}</b>
          </div>
        </div>
        <script>window.onload = () => window.print();</script>
      </body>
      </html>
    `;

    const printWindow = window.open('', '_blank');

    // KIỂM TRA NẾU POPUP BỊ CHẶN
    if (!printWindow || printWindow.closed || typeof printWindow.closed == 'undefined') {
        alert('Lỗi: Trình duyệt đã chặn cửa sổ in.\n\n' +
              'Vui lòng cho phép pop-up (cửa sổ bật lên) cho trang này và thử lại,\n' +
              'hoặc bấm nút "In vận đơn" một lần nữa.');
        return; // Dừng lại
    }

    printWindow.document.write(html);
    printWindow.document.close();
  }

  // ==================== INIT ====================
  
  init() {
    this.loadOrders();
    this.wireGlobalEvents();
    console.log('[OrdersManager] Initialized ✅');
  }

  wireGlobalEvents() {
    // Reload button
    const reloadBtn = document.getElementById('reload-orders');
    if (reloadBtn) {
      reloadBtn.onclick = () => this.loadOrders();
    }

    // Close modal button
    const closeBtn = document.getElementById('md-close');
    if (closeBtn) {
      closeBtn.onclick = () => {
        document.getElementById('modal-detail').style.display = 'none';
      };
    }

    // Click outside modal to close
    const modal = document.getElementById('modal-detail');
    if (modal) {
      modal.onclick = (e) => {
        if (e.target === modal) {
          modal.style.display = 'none';
        }
      };
    }

    // Print waybill button
    const printBtn = document.getElementById('btn-print-waybill');
    if (printBtn) {
      printBtn.onclick = () => {
        if (this.currentOrder) {
          const tracking = this.currentOrder.tracking_code || 
                          this.currentOrder.shipping_tracking || '';
          this.openPrintWaybill(this.currentOrder, tracking);
        }
      };
    }

    // Create waybill button — yêu cầu nhập service_code & receiver_commune_code nếu thiếu
    const createBtn = document.getElementById('btn-create-waybill');
    if (createBtn) {
      createBtn.onclick = async () => {
        if (!this.currentOrder) return;

        // Clone nông: thao tác trực tiếp trên currentOrder để WaybillCreator đọc được
        const order = this.currentOrder;

        // Bắt buộc SERVICE CODE
        let service = order.service_code || order.shipping_service || '';
        if (!service || String(service).trim() === '') {
          service = (window.prompt('Nhập service_code (bắt buộc):', '') || '').trim();
          if (!service) { alert('Chưa nhập service_code'); return; }
        }
        order.service_code = service;

        // Bắt buộc WARD/COMMUNE CODE (receiver_commune_code)
        let ward = order.receiver_commune_code || order.commune_code || '';
        if (!ward || String(ward).trim() === '') {
          ward = (window.prompt('Nhập mã Phường/Xã (receiver_commune_code):', '') || '').trim();
          if (!ward) { alert('Chưa nhập receiver_commune_code'); return; }
        }
        order.receiver_commune_code = ward;

        // Gọi WaybillCreator
        if (window.waybillCreator && typeof window.waybillCreator.createWaybill === 'function') {
          await window.waybillCreator.createWaybill(order);
        } else {
          alert('Không tìm thấy WaybillCreator. Vui lòng kiểm tra file waybill-creator.js');
        }
      };
    }
  }
}


// Global instance
window.ordersManager = new OrdersManager();

// Auto-init when DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => window.ordersManager.init());
} else {
  window.ordersManager.init();
}