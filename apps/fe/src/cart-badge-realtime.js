import api from './lib/api.js'; // THÊM DÒNG NÀY

/**
 * FILE PATH: shophuyvan-main/apps/fe/src/cart-badge-realtime.js
 * 
 * DESCRIPTION: Đồng bộ realtime số lượng giỏ hàng trên badge
 * - Cross-tab sync với storage events
 * - Polling fallback mỗi 2s
 * - Support multiple cart keys
 * - Bounce animation khi update
 * 
 * USAGE: <script type="module" src="/src/cart-badge-realtime.js"></script>
 */

const CART_KEYS = ['cart', 'shv_cart_v1', 'CART'];
const BADGE_SELECTORS = ['#cart-badge', '.shv-cart-badge', '[data-cart-badge]'];

/**
 * Get cart count from localStorage
 */
function getCartCount() {
  try {
    for (const key of CART_KEYS) {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      
      const data = JSON.parse(raw);
      let count = 0;
      
      // Handle array format
      if (Array.isArray(data)) {
        count = data.reduce((sum, item) => sum + (Number(item.qty) || 1), 0);
      }
      // Handle object with lines
      else if (data && Array.isArray(data.lines)) {
        count = data.lines.reduce((sum, item) => sum + (Number(item.qty) || 1), 0);
      }
      // Handle object with items
      else if (data && Array.isArray(data.items)) {
        count = data.items.reduce((sum, item) => sum + (Number(item.qty) || 1), 0);
      }
      
      if (count > 0) return count;
    }
    
    return 0;
  } catch (e) {
    console.error('[CartBadge] Error:', e);
    return 0;
  }
}

/**
 * Update all badge elements
 */
function updateBadges() {
  const count = getCartCount();
  
  BADGE_SELECTORS.forEach(selector => {
    const badges = document.querySelectorAll(selector);
    
    badges.forEach(badge => {
      if (count > 0) {
        badge.textContent = count > 99 ? '99+' : String(count);
        badge.classList.add('show');
        
        // Trigger bounce animation
        badge.style.animation = 'none';
        setTimeout(() => {
          badge.style.animation = 'cart-badge-bounce 0.5s ease-out';
        }, 10);
      } else {
        badge.classList.remove('show');
      }
    });
  });
  
  // Update data attribute for custom implementations
  document.documentElement.setAttribute('data-cart-count', String(count));
  
  // Dispatch custom event
  window.dispatchEvent(new CustomEvent('cart-badge-updated', { detail: { count } }));
}

/**
 * Fetch customer info and store it
 */
async function fetchCustomerInfo() {
  try {
    const token = localStorage.getItem('customer_token') || localStorage.getItem('x-customer-token');
    if (!token) {
      // Not logged in, ensure old data is clear
      const wasLoggedIn = !!window.currentCustomer; // Kiểm tra xem trước đó có đăng nhập không
      window.currentCustomer = null;
      localStorage.removeItem('customer_info');
      
      // THÊM: Bắn sự kiện nếu vừa log out (để F5 giá)
      if (wasLoggedIn) {
        window.dispatchEvent(new CustomEvent('customer-info-loaded', { detail: null }));
      }
      return;
    }

    // Check if data is already loaded
    if (window.currentCustomer) return; 

    const data = await api('/api/customers/me');

    if (data && data.ok && data.customer) {
      // Store info globally for this session
      window.currentCustomer = data.customer;
      // Store in localStorage for price.js
      localStorage.setItem('customer_info', JSON.stringify(data.customer));
      console.log('[Auth] Customer info loaded:', data.customer.email, data.customer.tier);

      // THÊM: Bắn sự kiện để trang chủ (frontend.js) biết
      window.dispatchEvent(new CustomEvent('customer-info-loaded', { detail: data.customer }));
    } else {
      // Token invalid or expired
      window.currentCustomer = null;
      localStorage.removeItem('customer_info');
      localStorage.removeItem('customer_token');
      localStorage.removeItem('x-customer-token');
    }
  } catch (error) {
    console.warn('[Auth] Failed to fetch customer info:', error.message);
    // Clear potentially bad data
    window.currentCustomer = null;
    localStorage.removeItem('customer_info');
    localStorage.removeItem('customer_token');
    localStorage.removeItem('x-customer-token');
  }
}

/**
 * Initialize badge sync
 */
async function init() { // SỬA: Thêm 'async'
  // THÊM: Tải thông tin khách hàng trước
  await fetchCustomerInfo();

  // Initial update
  updateBadges();
  
  // Listen to storage events (cross-tab sync)
  window.addEventListener('storage', (e) => {
    if (CART_KEYS.includes(e.key)) {
      updateBadges();
    }
  });
  
  // Listen to custom cart events
  window.addEventListener('shv:cart-changed', updateBadges);
  window.addEventListener('cart-updated', updateBadges);
  
  // Poll every 2 seconds as fallback
  setInterval(updateBadges, 2000);
  
  // Re-check when page becomes visible
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      updateBadges();
    }
  });
  
  console.log('[CartBadge] Realtime sync initialized');
}

// Auto-init
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

// Expose API
window.CartBadgeSync = {
  update: updateBadges,
  getCount: getCartCount
};