// ==== FE-ONLY: apps/fe/src/cart-sync-init.js ====
// Khởi tạo cart sync cho FE web

import { initCartSync, getSessionId } from '@shared/cart/sync';

console.log('[FE] Initializing cart sync...');
console.log('[FE] Session ID:', getSessionId());

// Khởi tạo với key 'cart' (format array)
const cartSync = initCartSync('cart');

// Expose ra window để debug
window.cartSync = cartSync;
window.cartSessionId = getSessionId();

// Log khi cart update -> push lên server
window.addEventListener('shv:cart-changed', () => {
  console.log('[FE] Cart changed, syncing...');
  cartSync.pushToServer();
});

console.log('[FE] Cart sync initialized successfully');
// ==== END FE-ONLY ====
