// File: apps/fe/src/cart-ui-sync.js
// Đồng bộ tất cả cart UI elements: header badge, modal, floating button

const CART_KEY = 'shv_cart_v1'; // Main cart key - đồng bộ với cart-sync
const LEGACY_KEYS = ['cart', 'CART']; // Legacy keys for backward compatibility

/**
 * Get cart từ localStorage (ưu tiên key mới)
 */
function getCart() {
  try {
    // Try new key first
    let raw = localStorage.getItem(CART_KEY);
    if (!raw) {
      // Fallback to legacy keys
      for (const key of LEGACY_KEYS) {
        raw = localStorage.getItem(key);
        if (raw) {
          // Migrate to new key
          localStorage.setItem(CART_KEY, raw);
          break;
        }
      }
    }
    
    if (!raw) return [];
    
    const data = JSON.parse(raw);
    
    // Support both formats: array and object with lines
    if (Array.isArray(data)) return data;
    if (data && Array.isArray(data.lines)) return data.lines;
    
    return [];
  } catch (e) {
    console.error('[CartUI] Parse error:', e);
    return [];
  }
}

/**
 * Save cart to localStorage
 */
function setCart(items) {
  try {
    const subtotal = items.reduce((s, i) => s + (i.price || 0) * (i.qty || 1), 0);
    const savings = items.reduce((s, i) => {
      const orig = i.original && i.original > i.price ? i.original : i.price;
      return s + ((orig - i.price) * i.qty);
    }, 0);
    
    const data = {
      lines: items,
      subtotal: subtotal,
      savings: savings,
      total: subtotal
    };
    
    // Save to main key
    localStorage.setItem(CART_KEY, JSON.stringify(data));
    
    // Also save to legacy keys for backward compatibility
    LEGACY_KEYS.forEach(key => {
      localStorage.setItem(key, JSON.stringify(items));
    });
    
    // Trigger events
    window.dispatchEvent(new Event('storage'));
    window.dispatchEvent(new CustomEvent('shv:cart-changed'));
    
    console.log('[CartUI] Cart saved:', items.length, 'items');
  } catch (e) {
    console.error('[CartUI] Save error:', e);
  }
}

/**
 * Format money
 */
function formatMoney(n) {
  return (n || 0).toLocaleString('vi-VN') + 'đ';
}

/**
 * Update header cart badge
 */
function updateHeaderBadge() {
  const badge = document.getElementById('cart-badge');
  if (!badge) return;
  
  const cart = getCart();
  const totalQty = cart.reduce((sum, item) => sum + (item.qty || item.quantity || 1), 0);
  
  badge.textContent = totalQty;
  badge.style.display = totalQty > 0 ? 'flex' : 'none';
  
  console.log('[CartUI] Header badge updated:', totalQty);
}

/**
 * Render cart modal
 */
function renderCartModal() {
  const modal = document.getElementById('shv-cart-modal');
  const list = document.getElementById('cart-modal-list');
  const total = document.getElementById('cart-modal-total');
  
  if (!list || !total) return;
  
  const cart = getCart();
  
  if (cart.length === 0) {
    list.innerHTML = '<div class="p-4 text-sm text-gray-500">Giỏ hàng trống.</div>';
    total.textContent = '0đ';
    return;
  }
  
  let totalAmount = 0;
  
  list.innerHTML = cart.map((item, idx) => {
    const price = Number(item.price || item.sale_price || item.final_price || 0);
    const qty = Number(item.qty || item.quantity || 1);
    totalAmount += price * qty;
    
    const name = item.name || item.title || 'Sản phẩm';
    const img = item.image || item.variantImage || item.img || '/assets/no-image.svg';
    const variant = item.variant || item.variantName || '';
    
    return `
      <div class="item" style="display:flex;align-items:center;gap:12px;padding:12px;border-bottom:1px solid #f0f0f0">
        <img src="${img}" alt="" style="width:56px;height:56px;border-radius:10px;object-fit:cover;border:1px solid #e5e7eb" onerror="this.src='/assets/no-image.svg'"/>
        <div style="flex:1;min-width:0">
          <div style="font-weight:600;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${name}</div>
          ${variant ? `<div style="font-size:12px;color:#888">${variant}</div>` : ''}
          <div style="color:#ef4444;font-weight:700;margin-top:4px">${formatMoney(price)}</div>
        </div>
        <div class="qty" style="display:flex;align-items:center;gap:6px">
          <button data-idx="${idx}" data-action="dec" style="width:28px;height:28px;border:1px solid #ddd;border-radius:4px;background:white;cursor:pointer">−</button>
          <span style="min-width:30px;text-align:center;font-weight:500">${qty}</span>
          <button data-idx="${idx}" data-action="inc" style="width:28px;height:28px;border:1px solid #ddd;border-radius:4px;background:white;cursor:pointer">+</button>
          <button data-idx="${idx}" data-action="remove" title="Xóa" style="width:28px;height:28px;border:1px solid #ef4444;color:#ef4444;border-radius:4px;background:white;cursor:pointer;margin-left:4px">🗑️</button>
        </div>
      </div>
    `;
  }).join('');
  
  total.textContent = formatMoney(totalAmount);
  
  // Attach events
  list.querySelectorAll('button[data-action]').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.idx);
      const action = btn.dataset.action;
      handleCartAction(idx, action);
    });
  });
  
  console.log('[CartUI] Modal rendered:', cart.length, 'items');
}

/**
 * Handle cart actions (inc, dec, remove)
 */
function handleCartAction(idx, action) {
  const cart = getCart();
  
  if (idx < 0 || idx >= cart.length) return;
  
  switch (action) {
    case 'inc':
      cart[idx].qty = (cart[idx].qty || cart[idx].quantity || 1) + 1;
      break;
      
    case 'dec':
      const currentQty = cart[idx].qty || cart[idx].quantity || 1;
      if (currentQty > 1) {
        cart[idx].qty = currentQty - 1;
      }
      break;
      
    case 'remove':
      if (confirm('Bạn có chắc muốn xóa sản phẩm này?')) {
        cart.splice(idx, 1);
      } else {
        return;
      }
      break;
  }
  
  setCart(cart);
  updateAllUI();
}

/**
 * Update all cart UI elements
 */
function updateAllUI() {
  updateHeaderBadge();
  
  // Only render modal if it's visible
  const modal = document.getElementById('shv-cart-modal');
  if (modal && modal.style.display !== 'none') {
    renderCartModal();
  }
  
  console.log('[CartUI] All UI updated');
}

/**
 * Add floating cart button
 */
function addFloatingCartButton() {
  // Check if already exists
  if (document.getElementById('floating-cart-btn')) return;
  
  const floatingContainer = document.querySelector('.fixed.right-3.bottom-3');
  if (!floatingContainer) return;
  
  const cartBtn = document.createElement('a');
  cartBtn.id = 'floating-cart-btn';
  cartBtn.href = '/cart.html';
  cartBtn.className = 'bg-rose-600 text-white px-3 py-2 rounded shadow relative';
  cartBtn.style.display = 'flex';
  cartBtn.style.alignItems = 'center';
  cartBtn.style.gap = '6px';
  cartBtn.innerHTML = `
    🛒
    <span id="floating-cart-badge" style="position:absolute;top:-8px;right:-8px;background:#ef4444;color:white;border-radius:50%;width:20px;height:20px;display:none;align-items:center;justify-content:center;font-size:11px;font-weight:600">0</span>
  `;
  
  // Insert before Zalo button
  floatingContainer.insertBefore(cartBtn, floatingContainer.firstChild);
  
  // Update badge
  updateFloatingBadge();
  
  console.log('[CartUI] Floating cart button added');
}

/**
 * Update floating cart badge
 */
function updateFloatingBadge() {
  const badge = document.getElementById('floating-cart-badge');
  if (!badge) return;
  
  const cart = getCart();
  const totalQty = cart.reduce((sum, item) => sum + (item.qty || item.quantity || 1), 0);
  
  badge.textContent = totalQty;
  badge.style.display = totalQty > 0 ? 'flex' : 'none';
  
  console.log('[CartUI] Floating badge updated:', totalQty);
}

/**
 * Initialize cart UI sync
 */
function initCartUISync() {
  console.log('[CartUI] Initializing...');
  
  // Initial update
  updateAllUI();
  addFloatingCartButton();
  
  // Listen to storage changes (from other tabs or cart-sync)
  window.addEventListener('storage', (e) => {
    if (e.key === CART_KEY || LEGACY_KEYS.includes(e.key)) {
      console.log('[CartUI] Storage changed, updating UI');
      updateAllUI();
      updateFloatingBadge();
    }
  });
  
  // Listen to custom cart changed event
  window.addEventListener('shv:cart-changed', () => {
    console.log('[CartUI] Cart changed event, updating UI');
    updateAllUI();
    updateFloatingBadge();
  });
  
  // Expose global function for backward compatibility
  window.updateCartBadge = updateAllUI;
  
  console.log('[CartUI] Initialized successfully');
}

// Auto-init when DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initCartUISync);
} else {
  initCartUISync();
}
// ==== START PATCH: force all cart entry points to open /cart.html ====
document.getElementById('header-cart-btn')?.addEventListener('click', (e) => {
  e.preventDefault();
  location.href = '/cart.html';
});

document.querySelectorAll('a[href="#"][data-open-cart], button[data-open-cart]').forEach(el => {
  el.addEventListener('click', (e) => {
    e.preventDefault();
    location.href = '/cart.html';
  });
});
// ==== END PATCH ====

// Export for modules
export { getCart, setCart, updateAllUI, updateHeaderBadge, renderCartModal };
