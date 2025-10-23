// myorders.js - Quản lý đơn hàng của khách
import api from './lib/api.js';

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
  if (s.includes('pending') || s.includes('cho')) return 'Chờ xác nhận';
  if (s.includes('shipping') || s.includes('giao')) return 'Đang giao hàng';
  if (s.includes('completed') || s.includes('hoan')) return 'Hoàn thành';
  if (s.includes('cancelled') || s.includes('huy')) return 'Đã hủy';
  return status;
}

// Kiểm tra order có khớp filter không
function matchFilter(order, filter) {
  if (filter === 'all') return true;
  const s = String(order.status).toLowerCase();
  if (filter === 'pending') return s.includes('pending') || s.includes('cho');
  if (filter === 'shipping') return s.includes('shipping') || s.includes('giao');
  if (filter === 'completed') return s.includes('completed') || s.includes('hoan');
  if (filter === 'cancelled') return s.includes('cancelled') || s.includes('huy');
  return false;
}

// Render HTML cho 1 đơn hàng
function renderOrder(order) {
  const items = order.items || [];
  const orderNumber = order.order_number || order.id.slice(0, 8).toUpperCase();
  
  return `
    <div class="order-card" data-order-id="${order.id}">
      <div class="order-header">
        <div>
          <div class="font-semibold text-gray-900">Đơn hàng #${orderNumber}</div>
          <div class="text-xs text-gray-500 mt-1">${formatDate(order.created_at)}</div>
        </div>
        <span class="status-badge ${getStatusClass(order.status)}">
          ${getStatusText(order.status)}
        </span>
      </div>
      
      <div class="order-body">
        ${items.map(item => `
          <div class="order-item">
            <img 
              src="${item.image || '/assets/no-image.svg'}" 
              alt="${item.product_name}"
              class="order-item-img"
              onerror="this.src='/assets/no-image.svg'"
            >
            <div class="flex-1 min-w-0">
              <div class="font-medium text-gray-900 text-sm truncate">${item.product_name}</div>
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
          <span class="font-bold text-blue-600 text-lg">${formatPrice(order.total)}</span>
        </div>
        <button 
          class="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50"
          onclick="viewOrderDetail('${order.id}')"
        >
          Xem chi tiết
        </button>
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
    
    // Extract orders array
    const orders = data.orders || data.items || data.data || [];
    
    if (!Array.isArray(orders)) {
      showError('Dữ liệu không hợp lệ');
      return;
    }
    
    state.orders = orders;
    hideLoading();
    renderOrders();
    
  } catch (error) {
    console.error('Load orders error:', error);
    showError('Có lỗi xảy ra khi tải đơn hàng');
    hideLoading();
  }
}

// Xem chi tiết đơn hàng
window.viewOrderDetail = function(orderId) {
  // TODO: Navigate to order detail page
  alert(`Chi tiết đơn hàng #${orderId}\n\n(Chức năng đang phát triển)`);
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
