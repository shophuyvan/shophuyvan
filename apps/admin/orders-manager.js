/**
 * Orders Manager - Quản lý đơn hàng
 * Version: 2.0
 */

class OrdersManager {
  constructor() {
    this.allOrders = []; // Chứa tất cả đơn hàng gốc
    this.orders = []; // Chứa danh sách đã lọc theo trạng thái
    this.currentOrder = null;
    this.selectedOrders = new Set();
    this.currentStatusFilter = 'all'; 
    this.currentSourceFilter = 'all'; // ✅ Thêm biến lọc theo nguồn
    this.productsCache = new Map(); 
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

  // ❌ REMOVED: Không cần fetch products - backend đã trả image trong order items
  // Đã xóa getProductById() và getVariantImage() để tăng tốc 10x

  // ==================== LOAD ORDERS ====================
  
  async loadOrders() {
    Admin.toast('🔄 Đang tải đơn hàng...');
    try {
      const response = await Admin.req('/api/orders', { method: 'GET' });
      this.allOrders = response?.items || []; // Lưu vào allOrders
      Admin.toast(`✅ Tải xong ${this.allOrders.length} đơn hàng.`);

      this.renderStatusTabs(); 
      this.renderSourceFilter(); // ✅ Tạo dropdown lọc nguồn
      this.filterAndRenderOrders();

    } catch (error) {
      console.error('[OrdersManager] Load orders error:', error);
      Admin.toast('❌ Lỗi tải danh sách đơn hàng');
      document.getElementById('list').innerHTML = '<tr><td colspan="2" style="text-align:center;color:red;padding:2rem">Lỗi tải dữ liệu</td></tr>';
      document.getElementById('status-tabs-container').innerHTML = '<span style="color: red;">Lỗi tải trạng thái</span>';
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

    // Reset trạng thái chọn khi tải lại danh sách
    this.selectedOrders.clear();
    this.updateBulkActionsToolbar();
    const selectAllCheckbox = document.getElementById('select-all-orders');
    if (selectAllCheckbox) selectAllCheckbox.checked = false;

    if (this.orders.length === 0) {
      tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;color:#6b7280;padding:2rem">Chưa có đơn hàng</td></tr>';
      return;
    }

    // ✅ OPTIMIZED: Render đồng bộ - nhanh gấp 10x, không cần await
    const rowsHTML = this.orders.map(order => this.renderOrderRow(order));
    tbody.innerHTML = rowsHTML.join('');

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
    
    // ✅ THÊM: Địa chỉ đầy đủ
    const custAddress = customer.address || order.address || '';
    const custProvince = customer.province || order.province || '';
    const custDistrict = customer.district || order.district || '';
    const custWard = customer.ward || customer.commune || order.ward || '';
    const fullAddress = [custAddress, custWard, custDistrict, custProvince].filter(Boolean).join(', ');

    // Shipping info
    const provider = String(order.shipping_provider || order.provider || order.shipping_name || '');
    const tracking = String(order.tracking_code || order.shipping_tracking || 
                           order.ship_tracking || order.shipping?.tracking_code || '');

    // Other info
    const created = this.formatDate(order.created_at || order.createdAt || order.createdAtMs);
    // ✅ KHAI BÁO BIẾN source ĐỂ DÙNG HIỂN THỊ
    const source = String(order.source || order.channel || order.platform || 'Web'); 
    const rawSource = source.toLowerCase(); // Dùng source đã lấy để lowerCase
    const orderId = String(order.id || '');
    const orderStatus = String(order.status || 'pending').toLowerCase();

    // ✅ BADGE NGUỒN (Đã chỉnh sửa màu sắc chuẩn)
    let sourceBadge = `<span style="background:#f3f4f6;color:#374151;padding:2px 8px;border-radius:12px;font-size:11px;border:1px solid #d1d5db;font-weight:600">WEB</span>`;
    
    if (rawSource.includes('shopee')) 
      sourceBadge = `<span style="background:#fff0e6;color:#ee4d2d;padding:2px 8px;border-radius:12px;font-size:11px;border:1px solid #ffcbb8;font-weight:600">SHOPEE</span>`;
    else if (rawSource.includes('lazada')) 
      sourceBadge = `<span style="background:#e0e7ff;color:#3730a3;padding:2px 8px;border-radius:12px;font-size:11px;border:1px solid #c7d2fe;font-weight:600">LAZADA</span>`;
    else if (rawSource.includes('tiktok')) 
      sourceBadge = `<span style="background:#18181b;color:#fff;padding:2px 8px;border-radius:12px;font-size:11px;font-weight:600">TIKTOK</span>`;
    else if (rawSource.includes('zalo') || rawSource.includes('mini')) 
      sourceBadge = `<span style="background:#dbeafe;color:#1e40af;padding:2px 8px;border-radius:12px;font-size:11px;border:1px solid #93c5fd;font-weight:600">ZALO</span>`;
    else if (rawSource.includes('pos')) 
      sourceBadge = `<span style="background:#fef3c7;color:#92400e;padding:2px 8px;border-radius:12px;font-size:11px;border:1px solid #fde68a;font-weight:600">POS</span>`;

    // ✅ BADGE TRẠNG THÁI (Đã map chuẩn Shopee)
    const statusMap = {
      // Nhóm 1: Chờ xác nhận
      'pending': { text: 'Chờ xác nhận', color: '#d97706', bg: '#fffbeb', border: '#fcd34d' },
      'unpaid':  { text: 'Chờ thanh toán', color: '#d97706', bg: '#fffbeb', border: '#fcd34d' },

      // Nhóm 2: Chờ lấy hàng (Processing)
      'processing':     { text: 'Chờ lấy hàng', color: '#b45309', bg: '#fff7ed', border: '#fed7aa' }, // Màu cam nhạt
      'confirmed':      { text: 'Chờ lấy hàng', color: '#b45309', bg: '#fff7ed', border: '#fed7aa' },
      'ready_to_ship':  { text: 'Chờ lấy hàng', color: '#b45309', bg: '#fff7ed', border: '#fed7aa' },
      'pending pickup': { text: 'Chờ lấy hàng', color: '#b45309', bg: '#fff7ed', border: '#fed7aa' },
      'picking':        { text: 'Đang lấy hàng', color: '#7c3aed', bg: '#f5f3ff', border: '#ddd6fe' },

      // Nhóm 3: Đang giao
      'shipping':       { text: 'Đang giao', color: '#0891b2', bg: '#ecfeff', border: '#a5f3fc' },
      'delivering':     { text: 'Đang giao', color: '#0891b2', bg: '#ecfeff', border: '#a5f3fc' },
      'transporting':   { text: 'Đang trung chuyển', color: '#0891b2', bg: '#ecfeff', border: '#a5f3fc' },

      // Nhóm 4: Hoàn thành
      'delivered': { text: 'Đã giao', color: '#16a34a', bg: '#dcfce7', border: '#86efac' },
      'completed': { text: 'Hoàn thành', color: '#16a34a', bg: '#dcfce7', border: '#86efac' },
      
      // Nhóm 5: Hủy/Hoàn
      'cancelled': { text: 'Đã hủy', color: '#dc2626', bg: '#fef2f2', border: '#fecaca' },
      'returning': { text: 'Đang hoàn', color: '#ea580c', bg: '#ffedd5', border: '#fed7aa' },
      'returned':  { text: 'Đã hoàn tiền', color: '#4b5563', bg: '#f3f4f6', border: '#e5e7eb' },
      'lost':      { text: 'Thất lạc', color: '#000000', bg: '#e5e7eb', border: '#9ca3af' }
    };
    
    const stInfo = statusMap[orderStatus] || { text: orderStatus, color: '#4b5563', bg: '#f3f4f6', border: '#e5e7eb' };
    const statusHTML = `<span style="background:${stInfo.bg};color:${stInfo.color};padding:4px 8px;border-radius:12px;font-weight:600;font-size:12px;border:1px solid ${stInfo.border};display:inline-block;white-space:nowrap">${stInfo.text}</span>`;

    // ✅ OPTIMIZED: Dùng trực tiếp item.image từ backend - không cần fetch
    const itemsHTML = items.map(item => {
      let img = item.image || item.img || item.thumbnail || '';
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
              ${fullAddress ? `<div class="customer-address" style="font-size: 12px; color: #6b7280; margin-top: 4px;">📍 ${fullAddress}</div>` : ''}
            </div>
          </div>
          <div class="order-meta" style="display:flex;flex-direction:column;align-items:flex-end;gap:6px">
            <div style="display:flex;align-items:center;gap:8px">
              ${sourceBadge}
              <span class="order-id-badge" style="font-weight:bold;color:#333">#${orderId.slice(-8)}</span>
            </div>
            ${statusHTML}
            <span class="order-date" style="font-size:11px;color:#888;margin-top:2px">${created}</span>
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

           ${/* ✅ HIỂN THỊ CHI TIẾT TÀI CHÍNH SHOPEE (D1 VERSION) */ 
              (order.escrow_amount > 0 || order.commission_fee > 0) ? `
              <div style="margin-top:8px; padding-top:8px; border-top:1px dashed #e5e7eb; font-size:12px;">
                <div class="detail-row">
                   <span class="label">Tổng sàn thu:</span>
                   <span class="value">${this.formatPrice(order.buyer_paid_amount || order.total)}</span>
                </div>
                <div class="detail-row" style="color:#ef4444;">
                  <span class="label">Phí cố định:</span>
                  <span class="value">-${this.formatPrice(order.commission_fee || 0)}</span>
                </div>
                <div class="detail-row" style="color:#ef4444;">
                  <span class="label">Phí dịch vụ:</span>
                  <span class="value">-${this.formatPrice(order.service_fee || 0)}</span>
                </div>
                <div class="detail-row" style="color:#ef4444;">
                   <span class="label">Phí thanh toán:</span>
                   <span class="value">-${this.formatPrice(order.seller_transaction_fee || 0)}</span>
                </div>
                <div class="detail-row" style="color:#16a34a; font-weight:700; border-top:1px solid #f3f4f6; margin-top:4px; padding-top:4px; font-size:13px;">
                  <span class="label">THỰC NHẬN:</span>
                  <span class="value">${this.formatPrice(order.escrow_amount)}</span>
                </div>
              </div>
            ` : ''}

            ${provider ? `
              <div class="detail-row">
                <span class="label">Vận chuyển:</span>
                <span class="value">${provider}</span>
              </div>
            ` : ''}
            ${tracking ? `
              <div class="detail-row">
                <span class="label">Mã vận đơn:</span>
                <span class="value tracking-code">${tracking}</span>
              </div>
            ` : ''}
            <div class="detail-row">
              <span class="label">Nguồn:</span>
              <span class="value">${source}</span>
            </div>
          </div>
          <div class="order-actions-col">
            ${orderStatus === 'pending' ? `
              <button class="btn btn-success" data-confirm="${orderId}" style="background-color:#10b981; color:white; border-color:#10b981;">
                <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
                ✅ Xác nhận đơn
              </button>
            ` : ''}
            <button class="btn btn-view" data-print="${orderId}" style="background-color:#007bff; color:white; border-color:#007bff;">
              <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm7-8a2 2 0 11-4 0 2 2 0 014 0z"/>
              </svg>
              In Vận Đơn
            </button>
            <button class="btn btn-danger" data-cancel="${orderId}">
              <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
              Hủy Vận Đơn
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
            <button class="btn btn-sm btn-print" data-print="${orderId}">
              <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm7-8a2 2 0 11-4 0 2 2 0 014 0z"/>
              </svg>
              In Vận Đơn
            </button>
            <button class="btn btn-sm btn-cancel" data-cancel="${orderId}">
              <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
              Hủy Vận Đơn
            </button>
            <button class="btn btn-sm btn-delete" data-delete="${orderId}">
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
        <td>
          <input type="checkbox" class="order-checkbox" data-order-id="${orderId}">
        </td>
        <td colspan="2">
          ${desktopCard}
        </td>
      </tr>
      <tr class="order-row-mobile">
         <td>
           <input type="checkbox" class="order-checkbox" data-order-id="${orderId}">
         </td>
        <td colspan="2">
          ${mobileCard}
        </td>
      </tr>
    `;
  }

  wireOrderRowEvents() {
    // ✅ THÊM: Nút "Xác nhận đơn"
    document.querySelectorAll('[data-confirm]').forEach(btn => {
      btn.onclick = async () => {
        const id = btn.getAttribute('data-confirm');
        await this.confirmOrder(id);
      };
    });

    // Nút "In Vận Đơn" (thay cho "Xem")
    document.querySelectorAll('[data-print]').forEach(btn => {
      btn.onclick = () => {
        const id = btn.getAttribute('data-print');
        this.printOrder(id); // Gọi hàm in mới
      };
    });

    // Nút "Hủy Vận Đơn" (thay cho "Xóa")
    document.querySelectorAll('[data-cancel]').forEach(btn => {
      btn.onclick = async () => {
        const id = btn.getAttribute('data-cancel');
        await this.cancelWaybill(id); // Gọi hàm hủy mới
      };
    });

    // Xử lý sự kiện cho từng checkbox đơn hàng
    document.querySelectorAll('.order-checkbox').forEach(checkbox => {
      checkbox.addEventListener('change', (event) => {
        const orderId = event.target.dataset.orderId;
        if (event.target.checked) {
          this.selectedOrders.add(orderId);
        } else {
          this.selectedOrders.delete(orderId);
        }
        this.updateBulkActionsToolbar();
        // Cập nhật trạng thái của checkbox "Chọn tất cả"
        this.updateSelectAllCheckboxState();
      });
    });

    // THÊM LẠI: Xử lý sự kiện cho nút "Xóa"
    document.querySelectorAll('[data-delete]').forEach(btn => {
      btn.onclick = async () => {
        const id = btn.getAttribute('data-delete');
        await this.deleteOrder(id); // Gọi hàm deleteOrder đã có sẵn
      };
    });
  } // <<< Kết thúc hàm wireOrderRowEvents

  // ==================== CONFIRM ORDER (NEW) ====================
  
  async confirmOrder(orderId) {
    const order = this.orders.find(o => String(o.id || '') === orderId);
    if (!order) {
      alert('Không tìm thấy đơn hàng!');
      return;
    }

    if (String(order.status || '').toLowerCase() !== 'pending') {
      alert('Chỉ có thể xác nhận đơn hàng đang chờ xử lý!');
      return;
    }

    if (!confirm(`Xác nhận đơn hàng ${orderId}?\n\nSau khi xác nhận, hệ thống sẽ tự động tạo vận đơn.`)) {
      return;
    }

    Admin.toast('⏳ Đang xác nhận đơn hàng...');

    try {
      const updatedOrder = {
        ...order,
        status: 'confirmed'
      };

      const res = await Admin.req('/admin/orders/upsert', {
        method: 'POST',
        body: updatedOrder
      });

      if (res.ok) {
        Admin.toast('✅ Đã xác nhận đơn hàng! Vận đơn đang được tạo...');
        setTimeout(() => {
          this.loadOrders();
        }, 2000);
      } else {
        alert('Lỗi khi xác nhận đơn hàng: ' + (res.message || 'Không rõ lỗi'));
      }
    } catch (e) {
      alert('Lỗi hệ thống khi xác nhận đơn: ' + e.message);
    }
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

    // Render nút actions theo trạng thái
    if (actions) {
      const status = String(order.status || 'pending').toLowerCase();
      const orderId = String(order.id || '');
      
      if (status === 'pending') {
        // Đơn hàng chờ xác nhận: Xác nhận + Chỉnh sửa + Xóa
        actions.innerHTML = `
          <button id="modal-btn-confirm" class="btn primary">
            ✅ Xác nhận đơn
          </button>
          <button id="modal-btn-edit" class="btn secondary">
            ✏️ Chỉnh sửa
          </button>
          <button id="modal-btn-delete" class="btn danger">
            🗑️ Xóa đơn
          </button>
        `;
        
        // Wire events
        document.getElementById('modal-btn-confirm')?.addEventListener('click', () => {
          this.confirmOrder(orderId);
          modal.style.display = 'none';
        });
        
        document.getElementById('modal-btn-edit')?.addEventListener('click', () => {
          alert('Chức năng chỉnh sửa đang phát triển');
        });
        
        document.getElementById('modal-btn-delete')?.addEventListener('click', () => {
          this.deleteOrder(orderId);
          modal.style.display = 'none';
        });
        
      } else {
        // Đơn hàng đã xác nhận: In Vận Đơn + Hủy Vận Đơn + Xóa
        actions.innerHTML = `
          <button id="btn-print-waybill" class="btn secondary">
            🖨️ In vận đơn
          </button>
          <button id="modal-btn-cancel-waybill" class="btn danger">
            🚫 Hủy vận đơn
          </button>
          <button id="modal-btn-delete" class="btn danger">
            🗑️ Xóa đơn
          </button>
        `;
        
        // Wire events (btn-print-waybill đã được wire trong orders.html)
        
        document.getElementById('modal-btn-cancel-waybill')?.addEventListener('click', async () => {
          if (!order.superai_code) {
            alert('Đơn hàng chưa có mã vận đơn để hủy.');
            return;
          }
          
          if (!confirm('Xác nhận hủy vận đơn?')) return;
          
          try {
            const res = await Admin.req('/shipping/cancel', {
              method: 'POST',
              body: { superai_code: order.superai_code }
            });
            
            if (res.ok) {
              Admin.toast('✅ Đã hủy vận đơn');
              this.loadOrders();
              modal.style.display = 'none';
            } else {
              alert('Lỗi: ' + (res.message || 'Không rõ'));
            }
          } catch (e) {
            alert('Lỗi hệ thống: ' + e.message);
          }
        });
        
        document.getElementById('modal-btn-delete')?.addEventListener('click', () => {
          this.deleteOrder(orderId);
          modal.style.display = 'none';
        });
      }
      
      actions.style.display = 'flex';
    }

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

  // ==================== PRINT ORDER (NEW) ====================
  
  async printOrder(orderId) {
    const order = this.orders.find(o => String(o.id || '') === orderId);
    if (!order) {
      alert('Không tìm thấy đơn hàng!');
      return;
    }

    const superaiCode = order.superai_code || '';
    if (!superaiCode) {
      alert('Đơn hàng này chưa có Mã SuperAI để in. Vui lòng chờ hệ thống xử lý.');
      return;
    }
    
    Admin.toast('Đang lấy template in vận đơn...');
    
    try {
      // ✅ THÊM order vào body
      const res = await Admin.req('/shipping/print', {
        method: 'POST',
        body: {
          superai_code: superaiCode,
          order: order
        }
      });

      if (res.ok && res.print_html) {
        Admin.toast('✅ Đã tải template in, đang mở...');
        const printWindow = window.open('', '_blank');
        printWindow.document.write(res.print_html);
        printWindow.document.close();
      } else if (res.ok && res.print_url) {
        Admin.toast('✅ Đã lấy link in, đang mở...');
        window.open(res.print_url, '_blank');
      } else {
        alert('Lỗi khi lấy link in: ' + (res.message || 'Không rõ lỗi'));
      }
    } catch (e) {
      alert('Lỗi hệ thống khi in: ' + e.message);
    }
  }

  // ==================== CANCEL WAYBILL (NEW) ====================
  
  async cancelWaybill(orderId) {
    const order = this.orders.find(o => String(o.id || '') === orderId);
    if (!order) {
      alert('Không tìm thấy đơn hàng!');
      return;
    }

    const superaiCode = order.superai_code || '';
    if (!superaiCode) {
      alert('Đơn hàng này chưa có Mã SuperAI, không thể hủy.');
      return;
    }

    if (!confirm(`Bạn có chắc muốn HỦY VẬN ĐƠN\n\nMã vận đơn: ${superaiCode}\nĐơn hàng: ${orderId}\n\nLưu ý: Thao tác này sẽ gửi yêu cầu HỦY ĐƠN HÀNG qua SuperAI.`)) {
      return;
    }
    
    Admin.toast('Đang gửi yêu cầu hủy vận đơn...');
    
    try {
      const res = await Admin.req('/shipping/cancel', {
        method: 'POST',
        body: {
          superai_code: superaiCode
        }
      });

      if (res.ok) {
        Admin.toast('✅ Đã hủy vận đơn thành công!');
        // Cập nhật trạng thái đơn hàng trên giao diện
        order.status = 'cancelled';
        order.tracking_code = 'CANCELLED';
        this.renderOrdersList();
      } else {
        alert('Lỗi khi hủy vận đơn: ' + (res.message || 'Không rõ lỗi'));
      }
    } catch (e) {
      alert('Lỗi hệ thống khi hủy: ' + e.message);
    }
  }

  // ==================== BULK ACTIONS TOOLBAR ====================

  updateBulkActionsToolbar() {
    const toolbar = document.getElementById('bulk-actions-toolbar');
    const countSpan = document.getElementById('selected-count');
    const selectedCount = this.selectedOrders.size;

    if (toolbar && countSpan) {
      if (selectedCount > 0) {
        toolbar.style.display = 'flex';
        countSpan.textContent = `Đã chọn: ${selectedCount}`;
      } else {
        toolbar.style.display = 'none';
      }
    }
  }

  // ==================== SELECT ALL CHECKBOX ====================

  handleSelectAllChange(event) {
    const isChecked = event.target.checked;
    const checkboxes = document.querySelectorAll('.order-checkbox');
    checkboxes.forEach(checkbox => {
      checkbox.checked = isChecked;
      const orderId = checkbox.dataset.orderId;
      if (isChecked) {
        this.selectedOrders.add(orderId);
      } else {
        this.selectedOrders.delete(orderId);
      }
    });
    this.updateBulkActionsToolbar();
  }

  updateSelectAllCheckboxState() {
    const selectAllCheckbox = document.getElementById('select-all-orders');
    if (!selectAllCheckbox) return;
    const allCheckboxes = document.querySelectorAll('.order-checkbox');
    const totalVisible = allCheckboxes.length;
    const totalSelected = this.selectedOrders.size;

    if (totalVisible > 0 && totalSelected === totalVisible) {
      selectAllCheckbox.checked = true;
      selectAllCheckbox.indeterminate = false;
    } else if (totalSelected > 0) {
      selectAllCheckbox.checked = false;
      selectAllCheckbox.indeterminate = true;
    } else {
      selectAllCheckbox.checked = false;
      selectAllCheckbox.indeterminate = false;
    }
  }

  // ==================== BULK PRINT ORDERS ====================

  async printSelectedOrders() {
    const selectedIds = Array.from(this.selectedOrders);
    if (selectedIds.length === 0) {
      alert('Vui lòng chọn ít nhất một đơn hàng để in.');
      return;
    }

    const superaiCodes = selectedIds.map(id => {
      const order = this.orders.find(o => String(o.id || '') === id);
      return order?.superai_code || null;
    }).filter(Boolean);

    if (superaiCodes.length === 0) {
      alert('Các đơn hàng đã chọn chưa có Mã Vận Đơn (SuperAI Code) để in.');
      return;
    }

    Admin.toast(`Đang lấy link in cho ${superaiCodes.length} vận đơn...`);

    try {
      const res = await Admin.req('/shipping/print-bulk', {
        method: 'POST',
        body: {
          superai_codes: superaiCodes // Gửi mảng mã SuperAI
        }
      });

      if (res.ok && res.print_url) {
        Admin.toast('✅ Đã lấy link in, đang mở...');
        window.open(res.print_url, '_blank');
      } else {
        alert('Lỗi khi lấy link in hàng loạt: ' + (res.message || 'Không rõ lỗi'));
      }
    } catch (e) {
      alert('Lỗi hệ thống khi in hàng loạt: ' + e.message);
    }
  }

  // ==================== BULK CANCEL ORDERS ====================

  async cancelSelectedOrders() {
    const selectedIds = Array.from(this.selectedOrders);
    if (selectedIds.length === 0) {
      alert('Vui lòng chọn ít nhất một đơn hàng để hủy.');
      return;
    }

    const ordersToCancel = selectedIds.map(id => {
      const order = this.orders.find(o => String(o.id || '') === id);
      return { id: id, superai_code: order?.superai_code || null };
    });

    const superaiCodesToCancel = ordersToCancel
                                  .map(o => o.superai_code)
                                  .filter(Boolean); // Chỉ hủy những đơn đã có mã

    if (superaiCodesToCancel.length === 0) {
      alert('Các đơn hàng đã chọn chưa có Mã Vận Đơn, không thể hủy hàng loạt.');
      return;
    }

    if (!confirm(`Bạn có chắc muốn HỦY ${superaiCodesToCancel.length} VẬN ĐƠN đã chọn?\n\nLưu ý: Thao tác này sẽ gửi yêu cầu HỦY ĐƠN HÀNG qua SuperAI.`)) {
      return;
    }

    Admin.toast(`Đang gửi yêu cầu hủy ${superaiCodesToCancel.length} vận đơn...`);

    try {
      const res = await Admin.req('/shipping/cancel-bulk', {
        method: 'POST',
        body: {
          superai_codes: superaiCodesToCancel // Gửi mảng mã SuperAI
        }
      });

      if (res.ok) {
        Admin.toast(`✅ Đã hủy ${res.cancelled_count || superaiCodesToCancel.length} vận đơn thành công!`);
        // Tải lại danh sách để cập nhật trạng thái
        this.loadOrders();
      } else {
        alert('Lỗi khi hủy vận đơn hàng loạt: ' + (res.message || 'Không rõ lỗi'));
      }
    } catch (e) {
      alert('Lỗi hệ thống khi hủy hàng loạt: ' + e.message);
    }
  }

  // ==================== BULK CONFIRM ORDERS ====================

  async confirmSelectedOrders() {
    const selectedIds = Array.from(this.selectedOrders);
    if (selectedIds.length === 0) {
      alert('Vui lòng chọn ít nhất một đơn hàng để xác nhận.');
      return;
    }

    // Chỉ xác nhận đơn PENDING
    const pendingOrders = selectedIds.map(id => {
      const order = this.orders.find(o => String(o.id || '') === id);
      return order && String(order.status || '').toLowerCase() === 'pending' ? order : null;
    }).filter(Boolean);

    if (pendingOrders.length === 0) {
      alert('Không có đơn hàng PENDING nào được chọn.');
      return;
    }

    if (!confirm(`Xác nhận ${pendingOrders.length} đơn hàng? Hệ thống sẽ tự động tạo vận đơn.`)) {
      return;
    }

    Admin.toast(`Đang xác nhận ${pendingOrders.length} đơn hàng...`);

    let successCount = 0;
    let failCount = 0;

    for (const order of pendingOrders) {
      try {
        const res = await Admin.req('/admin/orders/upsert', {
          method: 'POST',
          body: {
            id: order.id,
            status: 'confirmed'
          }
        });

        if (res.ok) {
          successCount++;
          this.selectedOrders.delete(String(order.id));
        } else {
          failCount++;
        }
      } catch (e) {
        console.error('Confirm error:', e);
        failCount++;
      }
    }

    Admin.toast(`✅ Xác nhận thành công: ${successCount}, ❌ Thất bại: ${failCount}`);
    await this.loadOrders();
    this.updateBulkActionsToolbar();
  }

  // ==================== STATUS TABS & FILTERING ====================

  renderStatusTabs() {
    const tabsContainer = document.getElementById('status-tabs-container');
    if (!tabsContainer) return;

    // Đếm số lượng đơn theo từng trạng thái
    const statusCounts = this.allOrders.reduce((counts, order) => {
      const status = String(order.status || 'unknown').toLowerCase();
      counts[status] = (counts[status] || 0) + 1;
      return counts;
    }, {});

    // Danh sách TAB chuẩn theo luồng Shopee/TMĐT
    const displayStatuses = [
      { key: 'all', name: 'Tất cả' },
      { key: 'pending', name: 'Chờ xác nhận' },      // Đơn mới
      { key: 'processing', name: 'Chờ lấy hàng' },    // Đã xác nhận/Đang xử lý (QUAN TRỌNG)
      { key: 'shipping', name: 'Đang giao' },         // Đang đi giao
      { key: 'delivered', name: 'Đã giao' },          // Giao thành công
      { key: 'cancelled', name: 'Đã hủy' },           // Hủy
      { key: 'returned', name: 'Trả hàng/Hoàn tiền' } // Hoàn
    ];

    let tabsHTML = '';
    displayStatuses.forEach(statusInfo => {
      const statusKey = statusInfo.key;
      const statusName = statusInfo.name;
      const count = (statusKey === 'all') ? this.allOrders.length : (statusCounts[statusKey] || 0);
      const isActive = statusKey === this.currentStatusFilter;

      // Chỉ hiển thị tab nếu có đơn hàng (trừ tab "Tất cả")
      if (count > 0 || statusKey === 'all') {
        tabsHTML += `
          <button class="tab ${isActive ? 'active' : ''}" data-status="${statusKey}">
            ${statusName}
            <span class="count">${count}</span>
          </button>
        `;
      }
    });

    tabsContainer.innerHTML = tabsHTML;

    // Gắn sự kiện click cho các tab vừa tạo
    tabsContainer.querySelectorAll('.tab').forEach(tab => {
      tab.addEventListener('click', () => this.handleStatusTabClick(tab.dataset.status));
    });
  }

  handleStatusTabClick(statusKey) {
    if (statusKey === this.currentStatusFilter) return; // Không làm gì nếu bấm lại tab cũ

    this.currentStatusFilter = statusKey;

    // Cập nhật giao diện active cho tab
    const tabsContainer = document.getElementById('status-tabs-container');
    tabsContainer.querySelectorAll('.tab').forEach(tab => {
      tab.classList.toggle('active', tab.dataset.status === statusKey);
    });

    // Lọc và render lại danh sách đơn hàng
    this.filterAndRenderOrders();
  }

  // ✅ 1. HÀM TẠO DROPDOWN LỌC KÊNH (Được thêm mới)
  renderSourceFilter() {
    const toolbar = document.querySelector('.toolbar');
    if (!toolbar || document.getElementById('source-filter-select')) return;

    const filterContainer = document.createElement('div');
    Object.assign(filterContainer.style, {
      display: 'flex', alignItems: 'center', gap: '8px', marginLeft: 'auto', marginRight: '12px'
    });

    const label = document.createElement('span');
    label.textContent = 'Kênh: ';
    label.style.fontWeight = '500';
    label.style.fontSize = '14px';

    const select = document.createElement('select');
    select.id = 'source-filter-select';
    select.className = 'btn';
    Object.assign(select.style, {
      padding: '6px 12px', border: '1px solid #ccc', height: '38px', outline: 'none'
    });

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
      select.appendChild(opt);
    });

    select.addEventListener('change', (e) => {
      this.currentSourceFilter = e.target.value;
      this.filterAndRenderOrders();
    });

    filterContainer.appendChild(label);
    filterContainer.appendChild(select);

    const reloadBtn = document.getElementById('reload-orders');
    if (reloadBtn) toolbar.insertBefore(filterContainer, reloadBtn);
    else toolbar.appendChild(filterContainer);
  }

  // ✅ 2. HÀM LỌC LOGIC (Đã nâng cấp gom nhóm trạng thái)
  filterAndRenderOrders() {
    const statusKey = this.currentStatusFilter;
    const sourceKey = this.currentSourceFilter;

    this.orders = this.allOrders.filter(order => {
      const s = String(order.status || 'unknown').toLowerCase();
      let statusMatch = false;

      if (statusKey === 'all') {
        statusMatch = true;
      } 
      // Tab: Chờ xác nhận
      else if (statusKey === 'pending') {
        if (s === 'pending' || s === 'unpaid' || s === 'new') statusMatch = true;
      }
      // Tab: Chờ lấy hàng (Gồm: Processing, Confirmed, Picking, Ready_to_ship)
      else if (statusKey === 'processing') {
        if (s === 'processing' || s === 'confirmed' || s === 'picking' || s === 'ready_to_ship' || s === 'pending pickup') statusMatch = true;
      }
      // Tab: Đang giao
      else if (statusKey === 'shipping') {
        if (s === 'shipping' || s === 'delivering' || s === 'transporting') statusMatch = true;
      }
      // Tab: Đã giao
      else if (statusKey === 'delivered') {
        if (s === 'delivered' || s === 'completed' || s === 'finish') statusMatch = true;
      }
      // Tab: Trả hàng/Hoàn tiền
      else if (statusKey === 'returned') {
        if (s === 'returned' || s === 'returning' || s === 'refund') statusMatch = true;
      }
      // Tab: Đã hủy
      else if (statusKey === 'cancelled') {
        if (s === 'cancelled' || s === 'cancel') statusMatch = true;
      }
      // Fallback cho các trạng thái khác
      else if (s === statusKey) {
        statusMatch = true;
      }

      let rawSource = String(order.source || order.channel || order.platform || 'Web').toLowerCase();
      let normalizedSource = 'website';
      if (rawSource.includes('shopee')) normalizedSource = 'shopee';
      else if (rawSource.includes('lazada')) normalizedSource = 'lazada';
      else if (rawSource.includes('tiktok')) normalizedSource = 'tiktok';
      else if (rawSource.includes('zalo') || rawSource.includes('mini')) normalizedSource = 'zalo';
      else if (rawSource.includes('pos')) normalizedSource = 'pos';
      else if (rawSource.includes('web')) normalizedSource = 'website';

      const sourceMatch = sourceKey === 'all' || normalizedSource === sourceKey;
      return statusMatch && sourceMatch;
    });

    this.renderOrdersList();
  }

  // ==================== INIT ====================

  init() {
    this.loadOrders();
    this.wireGlobalEvents();
    console.log('[OrdersManager] Initialized ✅ with Bulk Actions');
  }

  wireGlobalEvents() {
    // Nút "Chọn tất cả"
    const selectAllCheckbox = document.getElementById('select-all-orders');
    if (selectAllCheckbox) {
      selectAllCheckbox.addEventListener('change', (event) => this.handleSelectAllChange(event));
    }

    // Nút In hàng loạt
    const bulkPrintBtn = document.getElementById('bulk-print-btn');
    if (bulkPrintBtn) {
      bulkPrintBtn.addEventListener('click', () => this.printSelectedOrders());
    }

    // Nút Hủy hàng loạt
    const bulkCancelBtn = document.getElementById('bulk-cancel-btn');
    if (bulkCancelBtn) {
      bulkCancelBtn.addEventListener('click', () => this.cancelSelectedOrders());
    }

    // Nút Xác nhận hàng loạt
    const bulkConfirmBtn = document.getElementById('bulk-confirm-btn');
    if (bulkConfirmBtn) {
      bulkConfirmBtn.addEventListener('click', () => this.confirmSelectedOrders());
    }
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