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

  window.SHARED.api = api;
})();

