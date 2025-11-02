// File: packages/shared/src/cart/sync.ts
// Hệ thống đồng bộ giỏ hàng đơn giản, tương thích với code hiện tại

const API_BASE = 'https://shv-api.shophuyvan.workers.dev';
const SESSION_KEY = 'shv_session_id';
const LAST_SYNC_KEY = 'shv_last_sync';
const SYNC_INTERVAL = 5000; // 5 giây

/**
 * Lấy hoặc tạo session ID
 */
export function getSessionId(): string {
  let sid = localStorage.getItem(SESSION_KEY);
  if (!sid) {
    sid = 'sess_' + Date.now() + '_' + Math.random().toString(36).slice(2, 11);
    localStorage.setItem(SESSION_KEY, sid);
  }
  return sid;
}

/**
 * Normalize cart format giữa FE và Mini
 */
function normalizeCart(items: any[]): any[] {
  return items.map(item => {
    // ✅ Ưu tiên weight (field Admin) trước weight_gram
    const weight_val = Number(
      item.weight ?? 
      item.weight_gram ?? 
      item.weight_grams ?? 
      0
    );
    
    return {
      id: item.id,
      name: item.name,
      image: item.image || item.variantImage,
      variantName: item.variantName || item.variant,
      variantImage: item.variantImage,
      price: Number(item.price || 0),
      original: item.original || null,
      qty: Number(item.qty || 1),
      // ✅ Bắt buộc: gắn đủ 3 alias
      weight: weight_val,
      weight_gram: weight_val,
      weight_grams: weight_val,
      sku: item.sku || ''
    };
  });
}

/**
 * Class đồng bộ cart - tương thích với code hiện tại
 */
export class CartSyncManager {
  private sessionId: string;
  private cartKey: string;
  private syncTimer: any = null;
  private lastSync: number = 0;
  private isSyncing: boolean = false;

  constructor(cartKey: string = 'shv_cart_v1') {
    this.sessionId = getSessionId();
    this.cartKey = cartKey;
    
    // Load last sync time
    const lastSyncStr = localStorage.getItem(LAST_SYNC_KEY);
    this.lastSync = lastSyncStr ? parseInt(lastSyncStr) : 0;
    
    console.log(`[CartSync] Initialized with session: ${this.sessionId}`);
  }

  /**
   * Bắt đầu auto sync
   */
  start() {
    if (this.syncTimer) return;
    
    // Pull ngay lập tức
    this.pullFromServer();
    
    // Auto pull mỗi 5s
    this.syncTimer = setInterval(() => {
      this.pullFromServer();
    }, SYNC_INTERVAL);
    
    // Listen storage changes để push
    window.addEventListener('storage', this.handleStorageChange);
    
    // Push trước khi đóng tab
    window.addEventListener('beforeunload', () => {
      this.pushToServer(true);
    });
    
    console.log('[CartSync] Auto-sync started');
  }

  /**
   * Dừng auto sync
   */
  stop() {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
    }
    window.removeEventListener('storage', this.handleStorageChange);
    console.log('[CartSync] Auto-sync stopped');
  }

  private handleStorageChange = (e: StorageEvent) => {
    if (e.key === this.cartKey && e.newValue !== e.oldValue) {
      console.log('[CartSync] Cart changed locally, pushing to server');
      this.pushToServer();
    }
  };

  /**
   * Lấy cart từ localStorage
   */
  private getLocalCart(): any[] {
    try {
      const raw = localStorage.getItem(this.cartKey);
      if (!raw) return [];
      
      const data = JSON.parse(raw);
      
      // Support cả 2 format: array và object với lines
      if (Array.isArray(data)) {
        return normalizeCart(data);
      } else if (data && Array.isArray(data.lines)) {
        return normalizeCart(data.lines);
      }
      
      return [];
    } catch (e) {
      console.error('[CartSync] Parse local cart error:', e);
      return [];
    }
  }

  /**
   * Lưu cart vào localStorage (giữ nguyên format)
   */
  private saveLocalCart(items: any[]) {
    try {
      const existing = localStorage.getItem(this.cartKey);
      let data: any;
      
      try {
        data = JSON.parse(existing || '[]');
      } catch {
        data = [];
      }
      
      // Nếu format là object với lines
      if (data && typeof data === 'object' && !Array.isArray(data)) {
        data.lines = items;
        // Recalc totals
        const subtotal = items.reduce((s, l) => s + (l.price * l.qty), 0);
        const savings = items.reduce((s, l) => {
          const orig = l.original && l.original > l.price ? l.original : l.price;
          return s + ((orig - l.price) * l.qty);
        }, 0);
        data.subtotal = subtotal;
        data.savings = savings;
        data.total = subtotal;
      } else {
        // Format là array
        data = items;
      }
      
      localStorage.setItem(this.cartKey, JSON.stringify(data));
      
      // Dispatch event để UI update
      window.dispatchEvent(new Event('storage'));
      window.dispatchEvent(new CustomEvent('shv:cart-changed'));
      
      console.log('[CartSync] Saved to localStorage:', items.length, 'items');
    } catch (e) {
      console.error('[CartSync] Save local cart error:', e);
    }
  }

  /**
   * Pull cart từ server
   */
  async pullFromServer(): Promise<boolean> {
    if (this.isSyncing) return false;
    
    try {
      this.isSyncing = true;
      
      const url = `${API_BASE}/api/cart/sync?session_id=${encodeURIComponent(this.sessionId)}`;
      const response = await fetch(url);
      
      if (!response.ok) {
        console.warn('[CartSync] Pull failed:', response.status);
        return false;
      }
      
      const data = await response.json();
      
      if (data.ok && Array.isArray(data.cart)) {
        const serverTime = data.updated_at ? new Date(data.updated_at).getTime() : 0;
        
        // Chỉ update nếu server mới hơn
        if (serverTime > this.lastSync) {
          const localCart = this.getLocalCart();
          const serverCart = normalizeCart(data.cart);
          
          // Merge: ưu tiên qty cao hơn
          const merged = this.mergeCarts(localCart, serverCart);
          
          this.saveLocalCart(merged);
          this.lastSync = serverTime;
          localStorage.setItem(LAST_SYNC_KEY, String(serverTime));
          
          console.log('[CartSync] Pulled from server:', merged.length, 'items');
        } else {
          console.log('[CartSync] Local is up-to-date');
        }
        
        return true;
      }
      
      return false;
    } catch (e) {
      console.error('[CartSync] Pull error:', e);
      return false;
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Push cart lên server
   */
  async pushToServer(sync = false): Promise<boolean> {
    try {
      const cart = this.getLocalCart();
      
      const body = {
        session_id: this.sessionId,
        cart: cart,
        source: this.cartKey === 'cart' ? 'fe' : 'mini'
      };
      
      const response = await fetch(`${API_BASE}/api/cart/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        keepalive: sync
      });
      
      if (!response.ok) {
        console.warn('[CartSync] Push failed:', response.status);
        return false;
      }
      
      const data = await response.json();
      
      if (data.ok && data.updated_at) {
        this.lastSync = new Date(data.updated_at).getTime();
        localStorage.setItem(LAST_SYNC_KEY, String(this.lastSync));
        console.log('[CartSync] Pushed to server:', cart.length, 'items');
        return true;
      }
      
      return false;
    } catch (e) {
      console.error('[CartSync] Push error:', e);
      return false;
    }
  }

  /**
   * Merge 2 carts
   */
  private mergeCarts(local: any[], server: any[]): any[] {
    const map = new Map<string, any>();
    
    // Add server items
    server.forEach(item => {
      const key = this.getItemKey(item);
      map.set(key, { ...item });
    });
    
    // Merge local items
    local.forEach(item => {
      const key = this.getItemKey(item);
      const existing = map.get(key);
      
      if (existing) {
        // Giữ qty cao hơn
        if (item.qty > existing.qty) {
          map.set(key, { ...existing, qty: item.qty });
        }
      } else {
        // Item mới từ local
        map.set(key, { ...item });
      }
    });
    
    return Array.from(map.values());
  }

  private getItemKey(item: any): string {
    return `${item.id}_${item.variantName || ''}`;
  }

  /**
   * Clear cart (local + server)
   */
  async clearCart(): Promise<void> {
    // Clear local
    this.saveLocalCart([]);
    
    // Clear server
    try {
      await fetch(
        `${API_BASE}/api/cart/sync?session_id=${encodeURIComponent(this.sessionId)}`,
        { method: 'DELETE' }
      );
      console.log('[CartSync] Cart cleared');
    } catch (e) {
      console.error('[CartSync] Clear server error:', e);
    }
  }

  /**
   * Force sync now
   */
  async forceSync(): Promise<void> {
    await this.pullFromServer();
    await this.pushToServer();
  }
}

// Singleton instance
let cartSyncInstance: CartSyncManager | null = null;

/**
 * Initialize cart sync
 */
export function initCartSync(cartKey: string = 'shv_cart_v1'): CartSyncManager {
  if (!cartSyncInstance) {
    cartSyncInstance = new CartSyncManager(cartKey);
    cartSyncInstance.start();
  }
  return cartSyncInstance;
}

/**
 * Get current cart sync instance
 */
export function getCartSync(): CartSyncManager | null {
  return cartSyncInstance;
}

