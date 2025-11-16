/* [FILE: apps/admin/_shared/api-admin.js] */
(function () {
  window.SHARED = window.SHARED || {};
const api = {};

// ✅ Override API_BASE cho admin
window.API_BASE = 'https://api.shophuyvan.vn';

  // Dùng lại Admin.req() sẵn có để không đụng auth
  api.tryPaths = async (paths) => {
    let lastErr;
    for (const p of paths) {
      try {
        const res = await window.Admin.req(p);
        
        // ✅ CHECK 403 FORBIDDEN
        if (res && res.status === 403) {
          console.error('[API] 403 Forbidden:', p, res.error);
          window.Admin.toast('⛔ Bạn không có quyền truy cập chức năng này');
          
          // Redirect về trang chủ sau 2s
          setTimeout(() => {
            if (location.pathname !== '/index.html') {
              location.href = '/index.html';
            }
          }, 2000);
          
          throw new Error('Permission denied');
        }
        
        return res;
      } catch (e) {
        lastErr = e;
        console.warn('[API.tryPaths] fail', p, e);
      }
    }
    throw lastErr || new Error('All paths failed');
  };

  api.getProductsList = async () => {
    const r = await api.tryPaths([
      '/admin/products',
      '/admin/product/list',
      '/admin/products/list',
    ]);
    return r?.items || r?.data || r?.products || r?.rows || r?.list || [];
  };

    api.getProductDetail = async (id) => {
    const r = await api.tryPaths([
      `/admin/product?id=${encodeURIComponent(id)}`,
      `/admin/product/detail?id=${encodeURIComponent(id)}`,
      `/admin/products/detail?id=${encodeURIComponent(id)}`
    ]);
    return r?.item || r?.data || r || null;
  };

  // =======================
  // TMDT / TikTok Shop
  // =======================

  api.getTiktokConfig = async () => {
    const r = await window.Admin.req('/admin/channels/config');
    return r || {};
  };

  api.getTiktokShops = async () => {
    const r = await window.Admin.req('/admin/channels/tiktok/shops');
    return r?.shops || [];
  };

  api.disconnectTiktokShop = async (id) => {
    if (!id) return { ok: false, error: 'missing_id' };
    return await window.Admin.req(
      `/admin/channels/tiktok/shops/disconnect?id=${encodeURIComponent(id)}`
    );
  };

  // =======================
  // LAZADA API Helpers
  // =======================

  api.getLazadaShops = async () => {
  console.log('[API] Calling getLazadaShops...');
  
  // ✅ Check token
  const token = window.Admin ? window.Admin.token() : null;
  console.log('[API] Current token exists:', !!token);
  console.log('[API] Token value (first 20 chars):', token ? token.substring(0, 20) + '...' : 'NULL');
  
  if (!token) {
    console.error('[API] ❌ NO TOKEN - User needs to login!');
    throw new Error('No authentication token');
  }
  
  const r = await window.Admin.req('/admin/channels/lazada/shops');
  console.log('[API] getLazadaShops response:', r);
  return r?.shops || [];
};

  api.disconnectLazadaShop = async (id) => {
    if (!id) return { ok: false, error: 'missing_id' };
    
    // ✅ Đảm bảo window.Admin.req tồn tại
    if (!window.Admin || !window.Admin.req) {
      throw new Error('Admin API not ready');
    }
    
    return await window.Admin.req(
      `/admin/channels/lazada/shops/disconnect?id=${encodeURIComponent(id)}`
    );
  };

  api.syncLazadaProducts = async (shopId) => {
    if (!shopId) return { ok: false, error: 'missing_shop_id' };
    
    if (!window.Admin || !window.Admin.req) {
      throw new Error('Admin API not ready');
    }
    
    return await window.Admin.req('/admin/channels/lazada/sync-products', 'POST', {
      shop_id: shopId
    });
  };

  // =======================
  // ✅ SHOPEE API Helpers
  // =======================

  api.getShopeeShops = async () => {
    console.log('[API] Calling getShopeeShops...');
    
    const token = window.Admin ? window.Admin.token() : null;
    console.log('[API] Current token exists:', !!token);
    
    if (!token) {
      console.error('[API] ❌ NO TOKEN - User needs to login!');
      throw new Error('No authentication token');
    }
    
    const r = await window.Admin.req('/admin/shopee/shops');
    console.log('[API] getShopeeShops response:', r);
    return r?.shops || [];
  };

  api.disconnectShopeeShop = async (shopId) => {
    if (!shopId) return { ok: false, error: 'missing_shop_id' };
    
    if (!window.Admin || !window.Admin.req) {
      throw new Error('Admin API not ready');
    }
    
    return await window.Admin.req(
      `/admin/shopee/shops/disconnect?shop_id=${encodeURIComponent(shopId)}`,
      'DELETE'
    );
  };

  api.syncShopeeProducts = async (shopId) => {
    if (!shopId) return { ok: false, error: 'missing_shop_id' };
    
    if (!window.Admin || !window.Admin.req) {
      throw new Error('Admin API not ready');
    }
    
    // ✅ Method phải là POST và body phải có shop_id
    const res = await fetch('https://api.shophuyvan.vn/admin/shopee/sync-products', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-token': window.Admin.token()
      },
      body: JSON.stringify({ shop_id: shopId })
    });
    
    return await res.json();
  };

  api.syncShopeeOrders = async (shopId) => {
    if (!shopId) return { ok: false, error: 'missing_shop_id' };
    
    if (!window.Admin || !window.Admin.req) {
      throw new Error('Admin API not ready');
    }
    
    // ✅ Method phải là POST và body phải có shop_id
    const res = await fetch('https://api.shophuyvan.vn/admin/shopee/sync-orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-token': window.Admin.token()
      },
      body: JSON.stringify({ shop_id: shopId })
    });
    
    return await res.json();
  };

  window.SHARED.api = api;
})();

