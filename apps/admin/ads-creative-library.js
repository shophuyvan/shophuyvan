// ads-creative-library.js - Creative Library & Bulk Ads Creation
(function() {
  'use strict';

  const API = (window.Admin && Admin.getApiBase && Admin.getApiBase()) || 'https://api.shophuyvan.vn';
  let creativesCache = [];
  let productsCache = [];

  function toast(msg) {
    if (window.Admin && Admin.toast) {
      Admin.toast(msg);
    } else {
      alert(msg);
    }
  }

  // ============================================================
  // UPLOAD CREATIVE
  // ============================================================

  async function uploadCreative() {
    const fileInput = document.getElementById('creativeFileInput');
    const file = fileInput?.files[0];
    
    if (!file) {
      toast('❌ Vui lòng chọn file');
      return;
    }

    // Check file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast('❌ File quá lớn (max 10MB)');
      return;
    }

    // Check file type
    const validTypes = ['image/jpeg', 'image/png', 'image/jpg', 'video/mp4'];
    if (!validTypes.includes(file.type)) {
      toast('❌ Chỉ hỗ trợ JPG, PNG, MP4');
      return;
    }

    const btn = document.getElementById('btnUploadCreative');
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Đang upload...';
    }

    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const name = document.getElementById('creativeName')?.value?.trim() || file.name;
      const tags = document.getElementById('creativeTags')?.value?.trim() || '';
      
      formData.append('name', name);
      formData.append('tags', tags);

      const r = await Admin.req('/admin/facebook/creatives/upload', {
        method: 'POST',
        body: formData
      });

      if (r && r.ok) {
        toast('✅ Upload thành công');
        fileInput.value = '';
        document.getElementById('creativeName').value = '';
        document.getElementById('creativeTags').value = '';
        loadCreatives();
      } else {
        toast('❌ ' + (r.error || 'Upload thất bại'));
      }
    } catch (e) {
      toast('❌ Lỗi: ' + e.message);
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = '📤 Upload';
      }
    }
  }

  // ============================================================
  // LOAD CREATIVES
  // ============================================================

  async function loadCreatives() {
    const container = document.getElementById('creativesListContainer');
    if (!container) return;

    container.innerHTML = '<div class="loading">Đang tải...</div>';

    try {
      const r = await Admin.req('/admin/facebook/creatives', { method: 'GET' });
      
      if (r && r.ok) {
        creativesCache = r.creatives || [];
        renderCreatives(creativesCache);
      } else {
        container.innerHTML = '<div class="alert alert-error">Không thể tải creatives</div>';
      }
    } catch (e) {
      container.innerHTML = '<div class="alert alert-error">Lỗi: ' + e.message + '</div>';
    }
  }

  function renderCreatives(creatives) {
    const container = document.getElementById('creativesListContainer');
    if (!container) return;

    if (!creatives || creatives.length === 0) {
      container.innerHTML = '<div class="empty-state"><div class="empty-icon">🎨</div><div class="empty-text">Chưa có creative nào</div></div>';
      return;
    }

    const html = creatives.map(c => {
      const isVideo = c.type === 'video';
      const preview = isVideo 
        ? `<video src="${c.url}" controls style="width:100%; height:200px; object-fit:cover; border-radius:8px;"></video>`
        : `<img src="${c.url}" style="width:100%; height:200px; object-fit:cover; border-radius:8px;"/>`;

      return `
        <div class="creative-card">
          ${preview}
          <div class="creative-info">
            <div class="creative-name">${c.name}</div>
            <div class="creative-meta">
              ${isVideo ? '🎥 Video' : '🖼️ Image'} • ${new Date(c.created_at).toLocaleDateString('vi-VN')}
            </div>
            ${c.tags ? `<div class="creative-tags">${c.tags}</div>` : ''}
          </div>
          <div class="creative-actions">
            <button class="btn-small" onclick="FacebookAdsCreative.useCreative('${c.id}')">✅ Dùng</button>
            <button class="btn-small btn-danger" onclick="FacebookAdsCreative.deleteCreative('${c.id}')">🗑️</button>
          </div>
        </div>
      `;
    }).join('');

    container.innerHTML = `<div class="creatives-grid">${html}</div>`;
  }

  async function deleteCreative(creativeId) {
    if (!confirm('Xóa creative này?')) return;

    try {
      const r = await Admin.req(`/admin/facebook/creatives/${creativeId}`, {
        method: 'DELETE'
      });

      if (r && r.ok) {
        toast('✅ Đã xóa');
        loadCreatives();
      } else {
        toast('❌ ' + (r.error || 'Xóa thất bại'));
      }
    } catch (e) {
      toast('❌ Lỗi: ' + e.message);
    }
  }

  // ============================================================
  // BULK CREATE ADS
  // ============================================================

  async function loadProductsForBulk() {
    try {
      const r = await Admin.req('/admin/products/list', { method: 'GET' });
      if (r && r.ok && r.products) {
        productsCache = r.products;
        renderProductsForBulk(productsCache);
      }
    } catch (e) {
      console.error('Load products error:', e);
    }
  }

  function renderProductsForBulk(products) {
    const container = document.getElementById('bulkProductsSelector');
    if (!container) return;

    if (!products || products.length === 0) {
      container.innerHTML = '<div class="alert">Không có sản phẩm</div>';
      return;
    }

    const html = products.map(p => {
      const thumb = (p.images && p.images[0]) || '/placeholder.jpg';
      const price = (p.variants && p.variants[0] && p.variants[0].price) || 0;

      return `
        <label class="product-item-bulk">
          <input type="checkbox" value="${p.id}" class="bulk-product-check"/>
          <img src="${thumb}" class="product-thumb"/>
          <div style="flex:1;">
            <div style="font-weight:600; font-size:13px;">${p.name}</div>
            <div style="font-size:12px; color:#6b7280;">${new Intl.NumberFormat('vi-VN', {style:'currency',currency:'VND'}).format(price)}</div>
          </div>
        </label>
      `;
    }).join('');

    container.innerHTML = html;
  }

  async function bulkCreateAds() {
    const selectedProducts = [];
    document.querySelectorAll('.bulk-product-check:checked').forEach(cb => {
      selectedProducts.push(cb.value);
    });

    if (selectedProducts.length === 0) {
      toast('❌ Vui lòng chọn ít nhất 1 sản phẩm');
      return;
    }

    if (selectedProducts.length > 20) {
      toast('❌ Chỉ được chọn tối đa 20 sản phẩm');
      return;
    }

    const campaignId = document.getElementById('bulkCampaignId')?.value?.trim();
    if (!campaignId) {
      toast('❌ Vui lòng nhập Campaign ID');
      return;
    }

    const btn = document.getElementById('btnBulkCreateAds');
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Đang tạo...';
    }

    const progressContainer = document.getElementById('bulkProgressContainer');
    if (progressContainer) {
      progressContainer.style.display = 'block';
      progressContainer.innerHTML = '<div class="progress-bar"><div class="progress-fill" style="width:0%"></div></div><div id="progressText">0%</div>';
    }

    try {
      const r = await Admin.req('/admin/facebook/ads/bulk-create', {
        method: 'POST',
        body: {
          campaign_id: campaignId,
          product_ids: selectedProducts
        }
      });

      if (r && r.ok) {
        toast(`✅ Đã tạo ${r.created || 0} ads`);
        
        // Show results
        if (progressContainer) {
          progressContainer.innerHTML = `
            <div class="alert alert-success">
              <strong>Thành công:</strong> ${r.created || 0} ads<br/>
              <strong>Thất bại:</strong> ${r.failed || 0} ads
            </div>
          `;
        }

        // Reset form
        document.querySelectorAll('.bulk-product-check').forEach(cb => cb.checked = false);
      } else {
        toast('❌ ' + (r.error || 'Tạo ads thất bại'));
      }
    } catch (e) {
      toast('❌ Lỗi: ' + e.message);
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = '🚀 Tạo Ads hàng loạt';
      }
    }
  }

  // ============================================================
  // EVENT HANDLERS
  // ============================================================

  function attachCreativeEvents() {
    const btnUpload = document.getElementById('btnUploadCreative');
    if (btnUpload) btnUpload.onclick = uploadCreative;

    const btnRefresh = document.getElementById('btnRefreshCreatives');
    if (btnRefresh) btnRefresh.onclick = loadCreatives;

    const btnBulkCreate = document.getElementById('btnBulkCreateAds');
    if (btnBulkCreate) btnBulkCreate.onclick = bulkCreateAds;

    const btnLoadProducts = document.getElementById('btnLoadBulkProducts');
    if (btnLoadProducts) btnLoadProducts.onclick = loadProductsForBulk;
  }

  // ============================================================
  // INIT
  // ============================================================

  function init() {
    console.log('[Creative Library] Initializing...');
    loadCreatives();
    attachCreativeEvents();
  }

  // ============================================================
  // EXPORT
  // ============================================================

  window.FacebookAdsCreative = {
    init,
    uploadCreative,
    loadCreatives,
    deleteCreative,
    bulkCreateAds,
    loadProductsForBulk,
    useCreative: (id) => {
      toast('Creative ID: ' + id + ' (copy vào form tạo ads)');
      navigator.clipboard.writeText(id);
    }
  };

})();

console.log('✅ ads-creative-library.js loaded');
