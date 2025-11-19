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

  // ✅ THÊM: Load product để lấy ảnh variant
  async getProductById(productId) {
    if (!productId) return null;
    
    // Check cache
    if (this.productsCache.has(productId)) {
      return this.productsCache.get(productId);
    }

    try {
      const response = await Admin.req(`/products?id=${productId}`, { method: 'GET' });
      const product = response?.item || null;
      if (product) {
        this.productsCache.set(productId, product);
      }
      return product;
    } catch (e) {
      console.error('[OrdersManager] Load product error:', e);
      return null;
    }
  }

  // ✅ THÊM: Lấy ảnh variant từ product
  async getVariantImage(item) {
    // Ưu tiên ảnh từ item
    if (item.image || item.img || item.thumbnail) {
      return item.image || item.img || item.thumbnail;
    }

    // Lấy từ product
    const productId = item.product_id || item.pid || item.productId;
    if (!productId) return null;

    const product = await this.getProductById(productId);
    if (!product || !Array.isArray(product.variants)) return null;

    // Tìm variant khớp
    const variantId = item.id || item.variant_id || item.sku;
    const variant = product.variants.find(v => 
      String(v.id || v.sku || '') === String(variantId) ||
      String(v.sku || '') === String(item.sku || '') ||
      String(v.name || '').includes(String(item.variant || ''))
    );

    return variant?.image || variant?.img || product.images?.[0] || null;
  }

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
  
  async renderOrdersList() {
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

    // ✅ FIX: Render async để load ảnh variants
    const rowsHTML = [];
    for (const order of this.orders) {
      const html = await this.renderOrderRow(order);
      rowsHTML.push(html);
    }
    tbody.innerHTML = rowsHTML.join('');

    // Wire event listeners
    this.wireOrderRowEvents();
  }

 async renderOrderRow(order) {
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
    const rawSource = String(order.source || order.channel || order.platform || 'Web').toLowerCase();
    const orderId = String(order.id || '');
    const orderStatus = String(order.status || 'pending').toLowerCase();

// Badge Nguồn (Màu sắc nhận diện)
    let sourceBadge = `<span style="background:#f3f4f6;color:#374151;padding:2px 6px;border-radius:4px;font-size:11px;border:1px solid #d1d5db">Web</span>`;
    if (rawSource.includes('shopee')) sourceBadge = `<span style="background:#fff0e6;color:#ee4d2d;padding:2px 6px;border-radius:4px;font-size:11px;border:1px solid #ffcbb8">Shopee</span>`;
    else if (rawSource.includes('lazada')) sourceBadge = `<span style="background:#e0e7ff;color:#3730a3;padding:2px 6px;border-radius:4px;font-size:11px;border:1px solid #c7d2fe">Lazada</span>`;
    else if (rawSource.includes('tiktok')) sourceBadge = `<span style="background:#18181b;color:#fff;padding:2px 6px;border-radius:4px;font-size:11px;">TikTok</span>`;
    else if (rawSource.includes('zalo') || rawSource.includes('mini')) sourceBadge = `<span style="background:#dbeafe;color:#1e40af;padding:2px 6px;border-radius:4px;font-size:11px;border:1px solid #93c5fd">Zalo</span>`;
    else if (rawSource.includes('pos')) sourceBadge = `<span style="background:#fef3c7;color:#92400e;padding:2px 6px;border-radius:4px;font-size:11px;border:1px solid #fde68a">Tại quầy</span>`;

    // Badge Trạng thái (Cập nhật đầy đủ theo SuperAI)
    const statusMap = {
      'pending': { text: 'Chờ xử lý', color: '#d97706', bg: '#fffbeb', border: '#fcd34d' },
      'confirmed': { text: 'Đã xác nhận', color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe' },
      
      // Trạng thái vận chuyển
      'pending pickup': { text: 'Chờ lấy hàng', color: '#7c3aed', bg: '#f5f3ff', border: '#ddd6fe' },
      'shipping': { text: 'Chờ lấy hàng', color: '#7c3aed', bg: '#f5f3ff', border: '#ddd6fe' },
      'picking': { text: 'Đang lấy', color: '#9333ea', bg: '#f3e8ff', border: '#e9d5ff' },
      'delivering': { text: 'Đang giao', color: '#0891b2', bg: '#ecfeff', border: '#a5f3fc' },
      'delivered': { text: 'Đã giao', color: '#16a34a', bg: '#dcfce7', border: '#86efac' },
      
      // Trạng thái lỗi/hoàn
      'cancelled': { text: 'Đã hủy', color: '#dc2626', bg: '#fef2f2', border: '#fecaca' },
      'returning': { text: 'Đang hoàn', color: '#ea580c', bg: '#ffedd5', border: '#fed7aa' },
      'returned': { text: 'Đã hoàn', color: '#4b5563', bg: '#f3f4f6', border: '#e5e7eb' },
      'lost': { text: 'Thất lạc', color: '#000000', bg: '#e5e7eb', border: '#9ca3af' }
    };
    
    const stInfo = statusMap[orderStatus] || { text: orderStatus, color: '#4b5563', bg: '#f3f4f6', border: '#e5e7eb' };
    const statusHTML = `<span style="background:${stInfo.bg};color:${stInfo.color};padding:4px 8px;border-radius:12px;font-weight:600;font-size:12px;border:1px solid ${stInfo.border};display:inline-block;white-space:nowrap">${stInfo.text}</span>`;

    // ✅ THÊM: Load ảnh variants
    const itemsWithImages = await Promise.all(items.map(async (item) => {
      const variantImg = await this.getVariantImage(item);
      return { ...item, variantImage: variantImg };
    }));

    // Render all items with images
    const itemsHTML = itemsWithImages.map(item => {
      let img = item.variantImage || item.image || item.img || item.thumbnail || '';
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

    // Danh sách các trạng thái muốn hiển thị (có thể tùy chỉnh)
    // Dựa theo hình ảnh SuperAI của bạn và các trạng thái phổ biến
    const displayStatuses = [
      { key: 'all', name: 'Tất cả' },
      // Các trạng thái SuperAI phổ biến (lấy key từ status_name webhook, viết thường)
      { key: 'pending pickup', name: 'Chờ lấy hàng' }, // 'shipping' của chúng ta
      { key: 'picking', name: 'Đang lấy hàng' },
      { key: 'delivering', name: 'Đang giao' },
      { key: 'delivered', name: 'Đã giao' },
      { key: 'returning', name: 'Đang hoàn' },
      { key: 'returned', name: 'Đã hoàn' },
      { key: 'cancelled', name: 'Đã hủy' },
      { key: 'lost', name: 'Thất lạc' },
      // Thêm các trạng thái nội bộ nếu cần
      { key: 'pending', name: 'Chờ xử lý (Nội bộ)' },
      { key: 'confirmed', name: 'Đã xác nhận (Nội bộ)' },
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

  // ✅ 1. HÀM TẠO DROPDOWN LỌC KÊNH (Mới thêm)
  renderSourceFilter() {
    const toolbar = document.querySelector('.toolbar');
    // Kiểm tra tránh tạo trùng lặp
    if (!toolbar || document.getElementById('source-filter-select')) return;

    // Tạo Container
    const filterContainer = document.createElement('div');
    filterContainer.style.display = 'flex';
    filterContainer.style.alignItems = 'center';
    filterContainer.style.gap = '8px';
    filterContainer.style.marginLeft = 'auto';
    filterContainer.style.marginRight = '12px';

    // Label
    const label = document.createElement('span');
    label.textContent = 'Kênh bán: ';
    label.style.fontWeight = '500';
    label.style.fontSize = '14px';

    // Select Box
    const select = document.createElement('select');
    select.id = 'source-filter-select';
    select.className = 'btn';
    select.style.padding = '8px 12px';
    select.style.border = '1px solid #ccc';
    select.style.height = '38px';
    select.style.outline = 'none';

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

    // Sự kiện Change
    select.addEventListener('change', (e) => {
      this.currentSourceFilter = e.target.value;
      this.filterAndRenderOrders();
    });

    filterContainer.appendChild(label);
    filterContainer.appendChild(select);

    // Chèn vào trước nút Tải lại
    const reloadBtn = document.getElementById('reload-orders');
    if (reloadBtn) {
      toolbar.insertBefore(filterContainer, reloadBtn);
    } else {
      toolbar.appendChild(filterContainer);
    }
  }

  // ✅ 2. HÀM LỌC LOGIC (Đã update)
  filterAndRenderOrders() {
    const statusKey = this.currentStatusFilter;
    const sourceKey = this.currentSourceFilter;

    this.orders = this.allOrders.filter(order => {
      // A. LỌC TRẠNG THÁI
      // Hỗ trợ cả status nội bộ (pending/confirmed) và status vận chuyển (picking/shipping...)
      const rawStatus = String(order.status || 'unknown').toLowerCase();
      
      let statusMatch = false;
      if (statusKey === 'all') {
        statusMatch = true;
      } else {
        // Mapping đơn giản để các trạng thái tương đương nhau vẫn hiện
        if (statusKey === 'shipping' && (rawStatus === 'shipping' || rawStatus === 'pending pickup')) statusMatch = true;
        else if (rawStatus === statusKey) statusMatch = true;
      }

      // B. LỌC NGUỒN (SOURCE)
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