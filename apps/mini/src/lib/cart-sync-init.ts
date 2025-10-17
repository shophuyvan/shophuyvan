// File: apps/mini/src/lib/cart-sync-init.ts
// Cart sync đơn giản cho Mini App

const API_BASE = 'https://shv-api.shophuyvan.workers.dev';
const SESSION_KEY = 'shv_session_id';
const CART_KEY = 'shv_cart_v1';
const SYNC_INTERVAL = 5000; // 5 giây

/**
 * Lấy hoặc tạo session ID
 */
function getSessionId(): string {
  if (typeof window === 'undefined') return '';
  
  let sid = localStorage.getItem(SESSION_KEY);
  if (!sid) {
    sid = 'sess_' + Date.now() + '_' + Math.random().toString(36).slice(2, 11);
    localStorage.setItem(SESSION_KEY, sid);
  }
  return sid;
}

/**
 * Class quản lý sync
 */
class CartSyncManager {
  private sessionId: string;
  private syncTimer: any = null;
  private lastSync: number = 0;

  constructor() {
    this.sessionId = getSessionId();
    console.log('[CartSync] Session ID:', this.sessionId);
  }

  /**
   * Bắt đầu auto sync
   */
  start() {
    if (this.syncTimer) return;
    
    // Sync ngay
    this.pullFromServer();
    
    // Auto sync mỗi 5s
    this.syncTimer = setInterval(() => {
      this.pullFromServer();
    }, SYNC_INTERVAL);
    
    // Listen storage changes để push
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', this.handleStorageChange);
      window.addEventListener('beforeunload', this.handleBeforeUnload);
    }
    
    console.log('[CartSync] Started');
  }

  /**
   * Dừng sync
   */
  stop() {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
    }
    
    if (typeof window !== 'undefined') {
      window.removeEventListener('storage', this.handleStorageChange);
      window.removeEventListener('beforeunload', this.handleBeforeUnload);
    }
    
    console.log('[CartSync] Stopped');
  }

  private handleStorageChange = (e: StorageEvent) => {
    if (e.key === CART_KEY && e.newValue !== e.oldValue) {
      console.log('[CartSync] Cart changed locally, pushing...');
      this.pushToServer();
    }
  };

  private handleBeforeUnload = () => {
    this.pushToServer(true);
  };

  /**
   * Lấy cart từ localStorage
   */
  private getLocalCart(): any[] {
    if (typeof window === 'undefined') return [];
    
    try {
      const data = localStorage.getItem(CART_KEY);
      if (!data) return [];
      
      const parsed = JSON.parse(data);
      
      // Support cả format array và object
      if (Array.isArray(parsed)) {
        return parsed;
      } else if (parsed && Array.isArray(parsed.lines)) {
        return parsed.lines;
      }
      
      return [];
    } catch (e) {
      console.error('[CartSync] Parse error:', e);
      return [];
    }
  }

  /**
   * Lưu cart vào localStorage
   */
  private saveLocalCart(items: any[]) {
    if (typeof window === 'undefined') return;
    
    try {
      // Tính totals
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
      
      localStorage.setItem(CART_KEY, JSON.stringify(data));
      
      // Dispatch events để UI update
      window.dispatchEvent(new Event('storage'));
      window.dispatchEvent(new CustomEvent('shv:cart-changed'));
      
      console.log('[CartSync] Saved to localStorage:', items.length, 'items');
    } catch (e) {
      console.error('[CartSync] Save error:', e);
    }
  }

  /**
   * Pull cart từ server
   */
  async pullFromServer(): Promise<void> {
    if (!this.sessionId) return;
    
    try {
      const url = `${API_BASE}/api/cart/sync?session_id=${encodeURIComponent(this.sessionId)}`;
      const response = await fetch(url);
      
      if (!response.ok) {
        console.warn('[CartSync] Pull failed:', response.status);
        return;
      }
      
      const data = await response.json();
      
      if (data.ok && Array.isArray(data.cart)) {
        const serverTime = data.updated_at ? new Date(data.updated_at).getTime() : 0;
        
        // Chỉ update nếu server mới hơn
        if (serverTime > this.lastSync) {
          const localCart = this.getLocalCart();
          const serverCart = data.cart;
          
          // Merge carts
          const merged = this.mergeCarts(localCart, serverCart);
          
          if (merged.length > 0) {
            this.saveLocalCart(merged);
            this.lastSync = serverTime;
            console.log('[CartSync] Pulled:', merged.length, 'items');
          }
        }
      }
    } catch (e) {
      console.error('[CartSync] Pull error:', e);
    }
  }

  /**
   * Push cart lên server
   */
  async pushToServer(sync = false): Promise<void> {
    if (!this.sessionId) return;
    
    try {
      const cart = this.getLocalCart();
      
      const body = {
        session_id: this.sessionId,
        cart: cart,
        source: 'mini'
      };
      
      const response = await fetch(`${API_BASE}/api/cart/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        keepalive: sync
      });
      
      if (!response.ok) {
        console.warn('[CartSync] Push failed:', response.status);
        return;
      }
      
      const data = await response.json();
      
      if (data.ok && data.updated_at) {
        this.lastSync = new Date(data.updated_at).getTime();
        console.log('[CartSync] Pushed:', cart.length, 'items');
      }
    } catch (e) {
      console.error('[CartSync] Push error:', e);
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
    
    // Merge local items (giữ qty cao hơn)
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
    const variant = item.variantName || item.variant || '';
    return `${item.id}_${variant}`;
  }

  /**
   * Force sync ngay
   */
  async forceSync(): Promise<void> {
    await this.pullFromServer();
    await this.pushToServer();
  }
}

// Singleton instance
let syncInstance: CartSyncManager | null = null;

/**
 * Khởi tạo cart sync
 */
export function initMiniCartSync(): CartSyncManager {
  if (!syncInstance) {
    syncInstance = new CartSyncManager();
    syncInstance.start();
  }
  return syncInstance;
}

/**
 * Lấy instance hiện tại
 */
export function getMiniCartSync(): CartSyncManager | null {
  return syncInstance;
}

// Export thêm để dùng ở nơi khác
export { getSessionId };