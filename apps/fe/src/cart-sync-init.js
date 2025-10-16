// ===== FILE 1: apps/fe/src/cart-sync-init.js =====
// Khởi tạo cart sync cho FE web

import { initCartSync, getSessionId } from '@shared/cart/sync';

console.log('[FE] Initializing cart sync...');
console.log('[FE] Session ID:', getSessionId());

// Khởi tạo với key 'cart' (format array)
const cartSync = initCartSync('cart');

// Expose ra window để debug
window.cartSync = cartSync;
window.cartSessionId = getSessionId();

// Log khi cart update
window.addEventListener('shv:cart-changed', () => {
  console.log('[FE] Cart changed, syncing...');
  cartSync.pushToServer();
});

console.log('[FE] Cart sync initialized successfully');


// ===== FILE 2: apps/mini/src/lib/cart-sync-init.ts =====
// Khởi tạo cart sync cho Mini app

import { initCartSync, getSessionId, CartSyncManager } from '@shared/cart/sync';

let syncManager: CartSyncManager | null = null;

export function initMiniCartSync(): CartSyncManager {
  if (syncManager) return syncManager;
  
  console.log('[Mini] Initializing cart sync...');
  console.log('[Mini] Session ID:', getSessionId());
  
  // Khởi tạo với key 'shv_cart_v1' (format object)
  syncManager = initCartSync('shv_cart_v1');
  
  // Expose ra window để debug
  (window as any).cartSync = syncManager;
  (window as any).cartSessionId = getSessionId();
  
  console.log('[Mini] Cart sync initialized successfully');
  
  return syncManager;
}

export function getMiniCartSync(): CartSyncManager | null {
  return syncManager;
}


// ===== FILE 3: apps/fe/index.html (thêm vào <body>) =====
<!--
<script type="module" src="/src/cart-sync-init.js"></script>
-->


// ===== FILE 4: apps/mini/src/app.tsx (update) =====
import React, { useEffect } from 'react';
import { initMiniCartSync } from './lib/cart-sync-init';

export default function App() {
  useEffect(() => {
    // Khởi tạo cart sync khi app mount
    const syncManager = initMiniCartSync();
    
    // Cleanup khi unmount
    return () => {
      syncManager.stop();
    };
  }, []);
  
  return (
    // ... existing app code
  );
}


// ===== FILE 5: Backend API endpoint =====
// Thêm vào workers/shv-api/src/index.js

import { handleCartSync } from './cart-sync-handler.js';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    
    // Cart sync routes
    if (url.pathname.startsWith('/api/cart/sync')) {
      return handleCartSync(request, env);
    }
    
    // ... existing routes
  }
};


// ===== FILE 6: workers/shv-api/src/cart-sync-handler.js =====
export async function handleCartSync(request, env) {
  const url = new URL(request.url);
  const method = request.method;
  
  // GET: Lấy cart
  if (method === 'GET') {
    const sessionId = url.searchParams.get('session_id');
    if (!sessionId) {
      return Response.json({ ok: false, error: 'Missing session_id' }, { status: 400 });
    }
    
    try {
      const key = `cart:${sessionId}`;
      const data = await env.CART_KV.get(key);
      
      if (!data) {
        return Response.json({ ok: true, cart: [], updated_at: null });
      }
      
      const parsed = JSON.parse(data);
      return Response.json({
        ok: true,
        cart: parsed.items || [],
        updated_at: parsed.updated_at
      });
    } catch (e) {
      return Response.json({ ok: false, error: e.message }, { status: 500 });
    }
  }
  
  // POST: Lưu cart
  if (method === 'POST') {
    try {
      const body = await request.json();
      const { session_id, cart, source } = body;
      
      if (!session_id || !Array.isArray(cart)) {
        return Response.json({ ok: false, error: 'Invalid data' }, { status: 400 });
      }
      
      const key = `cart:${session_id}`;
      const now = new Date().toISOString();
      
      const data = {
        items: cart,
        updated_at: now,
        source: source || 'unknown'
      };
      
      // Lưu với TTL 30 ngày
      await env.CART_KV.put(key, JSON.stringify(data), {
        expirationTtl: 30 * 24 * 60 * 60
      });
      
      return Response.json({ ok: true, updated_at: now });
    } catch (e) {
      return Response.json({ ok: false, error: e.message }, { status: 500 });
    }
  }
  
  // DELETE: Xóa cart
  if (method === 'DELETE') {
    const sessionId = url.searchParams.get('session_id');
    if (!sessionId) {
      return Response.json({ ok: false, error: 'Missing session_id' }, { status: 400 });
    }
    
    try {
      await env.CART_KV.delete(`cart:${sessionId}`);
      return Response.json({ ok: true });
    } catch (e) {
      return Response.json({ ok: false, error: e.message }, { status: 500 });
    }
  }
  
  return Response.json({ ok: false, error: 'Method not allowed' }, { status: 405 });
}