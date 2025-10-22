// ==== apps/fe/src/lib/cart-sync-shared.js ====
// Bản ESM thuần trình duyệt: cung cấp getSessionId, CartSyncManager, initCartSync

const API_BASE = 'https://shv-api.shophuyvan.workers.dev';
const SESSION_KEY = 'shv_session_id';
const LAST_SYNC_KEY = 'shv_last_sync';
const DEFAULT_CART_KEY = 'cart'; // FE đang dùng format array trong localStorage

export function getSessionId() {
  let sid = localStorage.getItem(SESSION_KEY);
  if (!sid) {
    sid = 'sess_' + Date.now() + '_' + Math.random().toString(36).slice(2, 11);
    localStorage.setItem(SESSION_KEY, sid);
  }
  return sid;
}

// Chuẩn hoá item (giữ tối thiểu các field cần thiết)
function normalizeCart(items) {
  return (items || []).map(item => ({
    id: item.id,
    name: item.name,
    image: item.image || item.variantImage,
    variantName: item.variantName || item.variant,
    variantImage: item.variantImage,
    price: Number(item.price || 0),
    original: item.original ?? null,
    qty: Number(item.qty || 1)
  }));
}

export class CartSyncManager {
  constructor(cartKey = DEFAULT_CART_KEY) {
    this.sessionId = getSessionId();
    this.cartKey = cartKey;
    this.syncTimer = null;
    this.lastSync = Number(localStorage.getItem(LAST_SYNC_KEY) || '0');
    this.isSyncing = false;
    this.beforeUnloadHandler = () => this.pushToServer(true);
    this.handleStorageChange = (e) => {
      if (e.key === this.cartKey && e.newValue !== e.oldValue) {
        this.pushToServer();
      }
    };
    console.log('[CartSync] session:', this.sessionId, 'key:', this.cartKey);
  }

  start() {
    if (this.syncTimer) return;
    this.pullFromServer();
    this.syncTimer = setInterval(() => this.pullFromServer(), 5000);
    window.addEventListener('storage', this.handleStorageChange);
    window.addEventListener('beforeunload', this.beforeUnloadHandler);
    console.log('[CartSync] started');
  }

  stop() {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
    }
    window.removeEventListener('storage', this.handleStorageChange);
    window.removeEventListener('beforeunload', this.beforeUnloadHandler);
    console.log('[CartSync] stopped');
  }

  getLocalCart() {
    try {
      const raw = localStorage.getItem(this.cartKey);
      if (!raw) return [];
      const data = JSON.parse(raw);

      // FE đang lưu dạng object có { lines, subtotal, ... } hoặc array
      if (Array.isArray(data)) return normalizeCart(data);
      if (data && Array.isArray(data.lines)) return normalizeCart(data.lines);
      return [];
    } catch {
      return [];
    }
  }

  saveLocalCart(items) {
    try {
      const existing = localStorage.getItem(this.cartKey);
      let data;
      try { data = JSON.parse(existing || '[]'); } catch { data = []; }

      if (data && typeof data === 'object' && !Array.isArray(data)) {
        data.lines = items;
        const subtotal = items.reduce((s, l) => s + l.price * l.qty, 0);
        const savings = items.reduce((s, l) => {
          const orig = l.original && l.original > l.price ? l.original : l.price;
          return s + (orig - l.price) * l.qty;
        }, 0);
        data.subtotal = subtotal;
        data.savings = savings;
        data.total = subtotal;
      } else {
        data = items;
      }
      localStorage.setItem(this.cartKey, JSON.stringify(data));

      // Cho UI biết đã đổi
      window.dispatchEvent(new Event('storage'));
      window.dispatchEvent(new CustomEvent('shv:cart-changed'));
    } catch {}
  }

  async pullFromServer() {
    if (this.isSyncing) return false;
    if (!navigator.onLine) return false;
    this.isSyncing = true;
    try {
      const url = `${API_BASE}/api/cart/sync?session_id=${encodeURIComponent(this.sessionId)}`;
      const res = await fetch(url);
      if (!res.ok) return false;
      const data = await res.json();
      if (data.ok && Array.isArray(data.cart)) {
        const serverTime = data.updated_at ? new Date(data.updated_at).getTime() : 0;
        if (serverTime > this.lastSync) {
          const local = this.getLocalCart();
          const server = normalizeCart(data.cart);
          const merged = this.mergeCarts(local, server);
          this.saveLocalCart(merged);
          this.lastSync = serverTime;
          localStorage.setItem(LAST_SYNC_KEY, String(serverTime));
          console.log('[CartSync] pulled:', merged.length);
        }
        return true;
      }
      return false;
    } catch {
      return false;
    } finally {
      this.isSyncing = false;
    }
  }

  async pushToServer(sync = false) {
    try {
      const cart = this.getLocalCart();
      const res = await fetch(`${API_BASE}/api/cart/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: this.sessionId,
          cart,
          source: this.cartKey === 'cart' ? 'fe' : 'mini'
        }),
        keepalive: sync
      });
      if (!res.ok) return false;
      const data = await res.json();
      if (data.ok && data.updated_at) {
        const t = new Date(data.updated_at).getTime();
        this.lastSync = t;
        localStorage.setItem(LAST_SYNC_KEY, String(t));
        console.log('[CartSync] pushed:', cart.length);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  mergeCarts(local, server) {
    const map = new Map();
    server.forEach(it => {
      const key = `${it.id}_${it.variantName || ''}`;
      map.set(key, { ...it });
    });
    local.forEach(it => {
      const key = `${it.id}_${it.variantName || ''}`;
      const ex = map.get(key);
      if (ex) {
        if ((it.qty || 1) > (ex.qty || 1)) map.set(key, { ...ex, qty: it.qty });
      } else {
        map.set(key, { ...it });
      }
    });
    return Array.from(map.values());
  }

  async forceSync() {
    await this.pullFromServer();
    await this.pushToServer();
  }
}

let __instance = null;
export function initCartSync(cartKey = DEFAULT_CART_KEY) {
  if (!__instance) {
    __instance = new CartSyncManager(cartKey);
    __instance.start();
  }
  return __instance;
}
export function getCartSync() {
  return __instance;
}
// ==== END file ====
