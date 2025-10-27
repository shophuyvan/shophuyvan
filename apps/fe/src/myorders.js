// myorders.js - Quản lý đơn hàng của khách
import api from './lib/api.js';
// THÊM: Cấu hình TIER để dịch tên
const TIER_CONFIG = {
  retail: { name: 'Thành viên thường', color: '#6b7280' },
  silver: { name: 'Thành viên bạc', color: '#94a3b8' },
  gold: { name: 'Thành viên vàng', color: '#fbbf24' },
  diamond: { name: 'Thành viên kim cương', color: '#06b6d4' }
};

// THÊM: Helper lấy thông tin tier
function getTierInfo(tierKey) {
  const key = String(tierKey || 'retail').toLowerCase();
  return TIER_CONFIG[key] || TIER_CONFIG.retail;
}

const state = {
  orders: [],
  filter: 'all',
  loading: false
};

// DOM elements
const loadingState = document.getElementById('loadingState');
const errorState = document.getElementById('errorState');
const emptyState = document.getElementById('emptyState');
const ordersList = document.getElementById('ordersList');
const errorMessage = document.getElementById('errorMessage');
const btnRefresh = document.getElementById('btnRefresh');
const btnRetry = document.getElementById('btnRetry');
const filterTabs = document.getElementById('filterTabs');

// Format giá tiền
function formatPrice(price) {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND'
  }).format(price);
}

// Format ngày tháng
function formatDate(dateStr) {
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('vi-VN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return dateStr;
  }
}

// Lấy class CSS cho trạng thái
function getStatusClass(status) {
  const s = String(status).toLowerCase();
  if (s.includes('pending') || s.includes('cho')) return 'status-pending';
  if (s.includes('shipping') || s.includes('giao')) return 'status-shipping';
  if (s.includes('completed') || s.includes('hoan')) return 'status-completed';
  if (s.includes('cancelled') || s.includes('huy')) return 'status-cancelled';
  return 'status-pending';
}

// Lấy text hiển thị cho trạng thái
function getStatusText(status) {
  const s = String(status).toLowerCase();
  if (s.includes('pending') || s.includes('confirmed') || s.includes('cho')) return 'Chờ xác nhận';
  if (s.includes('shipping') || s.includes('giao')) return 'Đang giao hàng';
  if (s.includes('completed') || s.includes('hoan')) return 'Hoàn thành';
  if (s.includes('cancelled') || s.includes('huy')) return 'Đã hủy';
  return status;
}

/// Kiểm tra order có khớp filter không
function matchFilter(order, filter) {
  if (filter === 'all') return true;
  const s = String(order.status).toLowerCase();
  if (filter === 'pending') return s.includes('pending') || s.includes('confirmed') || s.includes('cho');
  if (filter === 'shipping') return s.includes('shipping') || s.includes('giao');
  if (filter === 'completed') return s.includes('completed') || s.includes('hoan');
  if (filter === 'cancelled') return s.includes('cancelled') || s.includes('huy');
  return false;
}

// Render HTML cho 1 đơn hàng
function renderOrder(order) {
  const items = order.items || [];
  const orderNumber = order.order_number || order.id.slice(0, 8).toUpperCase();
  
  // ✅ Tính tổng tiền chính xác
  const subtotal = Number(order.subtotal || 0);
  const shippingFee = Number(order.shipping_fee || 0);
  const discount = Number(order.discount || 0) + Number(order.shipping_discount || 0);
  const totalAmount = Math.max(0, subtotal + shippingFee - discount);
  
  // ✅ Thông tin khách hàng
  const customer = order.customer || {};
  const customerName = customer.name || order.name || '';
  const customerPhone = customer.phone || order.phone || '';
  const customerAddress = customer.address || order.address || '';
  
  // ✅ Kiểm tra có thể hủy đơn không
  const s = String(order.status || '').toLowerCase();
  const canCancel = s.includes('pending') || s.includes('confirmed') || s.includes('cho');
  
  // ✅ Enrich items với thông tin đầy đủ
  const enrichedItems = items.map(item => ({
    ...item,
    product_name: item.product_name || item.name || 'Sản phẩm',
    variant_name: item.variant_name || item.variant || '',
    image: item.image || item.img || item.thumbnail || '/assets/no-image.svg',
    price: Number(item.price || 0),
    quantity: Number(item.qty || item.quantity || 1)
  }));
  
  return `
    <div class="order-card" data-order-id="${order.id}">
      <div class="order-header">
        <div>
          <div class="font-semibold text-gray-900">Đơn hàng #${orderNumber}</div>
          <div class="text-xs text-gray-500 mt-1">${formatDate(order.createdAt || order.created_at)}</div>
        </div>
        <span class="status-badge ${getStatusClass(order.status)}">
          ${getStatusText(order.status)}
        </span>
      </div>
      
      ${customerName || customerPhone || customerAddress ? `
      <div style="padding: 12px 16px; background: #f8fafc; border-bottom: 1px solid #e5e7eb; font-size: 13px;">
        ${customerName ? `<div class="mb-1"><span class="text-gray-600">Người nhận:</span> <span class="font-medium">${customerName}</span></div>` : ''}
        ${customerPhone ? `<div class="mb-1"><span class="text-gray-600">Số điện thoại:</span> <span class="font-medium">${customerPhone}</span></div>` : ''}
        ${customerAddress ? `<div><span class="text-gray-600">Địa chỉ:</span> <span class="font-medium">${customerAddress}</span></div>` : ''}
      </div>
      ` : ''}
      
      <div class="order-body">
        ${enrichedItems.map(item => `
          <div class="order-item">
            <img 
              src="${item.image}" 
              alt="${item.product_name}"
              class="order-item-img"
              onerror="this.src='/assets/no-image.svg'"
            >
            <div class="flex-1 min-w-0">
              <div class="font-medium text-gray-900 text-sm truncate">${item.product_name}</div>
              ${item.variant_name ? `<div class="text-xs text-gray-500 mt-1">Phân loại: ${item.variant_name}</div>` : ''}
              <div class="text-xs text-gray-500 mt-1">Số lượng: x${item.quantity}</div>
              <div class="text-sm font-semibold text-blue-600 mt-1">
                ${formatPrice(item.price * item.quantity)}
              </div>
            </div>
          </div>
        `).join('')}
      </div>
      
      <div class="order-footer">
        <div>
          <span class="text-gray-600 text-sm">Tổng cộng: </span>
          <span class="font-bold text-blue-600 text-lg">${formatPrice(totalAmount)}</span>
        </div>
        ${canCancel ? `
        <button 
          class="px-4 py-2 bg-red-50 border border-red-300 text-red-600 rounded-lg text-sm font-medium hover:bg-red-100"
          onclick="cancelOrder('${order.id}')"
        >
          Hủy đơn
        </button>
        ` : ''}
      </div>
    </div>
  `;
}

// Render danh sách đơn hàng
function renderOrders() {
  const filtered = state.orders.filter(order => matchFilter(order, state.filter));
  
  if (filtered.length === 0) {
    ordersList.innerHTML = '';
    emptyState.style.display = 'block';
    return;
  }
  
  emptyState.style.display = 'none';
  ordersList.innerHTML = filtered.map(renderOrder).join('');
}

// Hiển thị loading
function showLoading() {
  state.loading = true;
  loadingState.style.display = 'block';
  errorState.style.display = 'none';
  emptyState.style.display = 'none';
  ordersList.innerHTML = '';
}

// Ẩn loading
function hideLoading() {
  state.loading = false;
  loadingState.style.display = 'none';
}

// Hiển thị lỗi
function showError(message) {
  errorMessage.textContent = message;
  errorState.style.display = 'block';
  loadingState.style.display = 'none';
  emptyState.style.display = 'none';
  ordersList.innerHTML = '';
}

// Load đơn hàng từ API
async function loadOrders() {
  if (state.loading) return;
  
  showLoading();
  
  try {
    const token =
  localStorage.getItem('x-customer-token') ||
  localStorage.getItem('customer_token')   ||
  localStorage.getItem('x-token')          ||
  '';

if (!token) {
  showError('Vui lòng đăng nhập để xem đơn hàng');
  return;
}
    
    // Thử nhiều endpoint
    const endpoints = [
      '/orders/my',
      '/customer/orders',
      '/public/orders/my',
      '/api/orders/customer',
      '/orders?customer=me'
    ];
    
    let data = null;
    for (const endpoint of endpoints) {
      try {
        const response = await api(endpoint);
        if (response && !response.error) {
          data = response;
          console.log('✅ Loaded orders from:', endpoint);
          break;
        }
      } catch (e) {
        console.warn('Failed endpoint:', endpoint, e);
        continue;
      }
    }
    
    if (!data) {
      showError('Không thể tải đơn hàng. Vui lòng thử lại sau.');
      return;
    }
    
    // Extract orders array: API may return an array directly or nested object
    const orders = Array.isArray(data) ? data : data.orders || data.items || data.data || [];
    
    if (!Array.isArray(orders)) {
      showError('Dữ liệu không hợp lệ');
      return;
    }
    
    state.orders = orders;

    // MỚI: Render thông tin customer/tier
    if (data.customer) {
      try {
        // SỬA: data.customer.tier là "retail", cần tra cứu
        const tierKey = data.customer.tier || 'retail'; // Lấy key, ví dụ "retail"
        const tierInfo = getTierInfo(tierKey); // Tra cứu TIER_CONFIG
        const tierName = tierInfo.name; // Lấy 'Thành viên thường'

        const tierPoints = data.customer.points || 0;
        
        const tierInfoEl = document.getElementById('customerTierInfo'); 
        if (tierInfoEl) {
          tierInfoEl.innerHTML = `
            <span class="font-medium">Hạng thành viên:</span> 
            <span class="font-bold text-blue-600">${tierName}</span> 
            <span class="mx-2 text-gray-400">|</span>
            <span class="font-medium">Điểm tích luỹ:</span> 
            <span class="font-bold text-blue-600">${new Intl.NumberFormat('vi-VN').format(tierPoints)}</span>
            <a href="/member.html" class="float-right text-blue-600 hover:underline">Chi tiết 
              &rarr;
            </a>
          `;
          tierInfoEl.style.display = 'block';
        }
      } catch (e) {
        console.warn('Failed to render tier info', e);
      }
    }
    
    hideLoading();
    renderOrders();
    
  } catch (error) {
    console.error('Load orders error:', error);
    showError('Có lỗi xảy ra khi tải đơn hàng');
    hideLoading();
  }
}

// Hủy đơn hàng
window.cancelOrder = async function(orderId) {
  const order = state.orders.find(o => o.id === orderId);
  if (!order) return;
  
  const confirmMsg = `Bạn có chắc muốn hủy đơn hàng này?\n\nĐơn hàng: #${orderId.slice(0, 8).toUpperCase()}`;
  if (!confirm(confirmMsg)) return;
  
  try {
    // Gọi API hủy đơn
    const response = await api('/orders/cancel', {
      method: 'POST',
      body: JSON.stringify({ order_id: orderId })
    });
    
    if (response && response.ok) {
      alert('Đã hủy đơn hàng thành công');
      loadOrders(); // Reload danh sách
    } else {
      alert('Không thể hủy đơn. Vui lòng liên hệ shop.');
    }
  } catch (error) {
    console.error('Cancel order error:', error);
    alert('Có lỗi xảy ra. Vui lòng thử lại.');
  }
};

// Event: Filter tabs
filterTabs.addEventListener('click', (e) => {
  const tab = e.target.closest('.filter-tab');
  if (!tab) return;
  
  // Update active state
  filterTabs.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
  tab.classList.add('active');
  
  // Update filter
  state.filter = tab.dataset.filter;
  renderOrders();
});

// Event: Refresh button
btnRefresh.addEventListener('click', loadOrders);

// Event: Retry button
btnRetry.addEventListener('click', loadOrders);

// Initial load
loadOrders();
