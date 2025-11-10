// ===================================================================
// ads_real.js - Facebook Ads Management Logic
// Version: 1.0
// ===================================================================

(function() {
  'use strict';

  const API = (window.Admin && Admin.getApiBase && Admin.getApiBase()) || 'https://api.shophuyvan.vn';
  let productsCache = [];
  let campaignsCache = [];

  // ============================================================
  // UTILITIES
  // ============================================================

  function formatVND(amount) {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND'
    }).format(amount || 0);
  }

  function showLoading(elementId, message = 'Đang tải...') {
    const el = document.getElementById(elementId);
    if (el) {
      el.innerHTML = `<div class="loading">${message}</div>`;
    }
  }

  function showError(elementId, message) {
    const el = document.getElementById(elementId);
    if (el) {
      el.innerHTML = `<div class="alert alert-error">${message}</div>`;
    }
  }

  function toast(msg) {
    if (window.Admin && Admin.toast) {
      Admin.toast(msg);
    } else {
      alert(msg);
    }
  }

  // ============================================================
  // API CALLS
  // ============================================================

  async function testConnection() {
    try {
      const r = await Admin.req('/admin/facebook/test', { method: 'GET' });
      if (r && r.ok) {
        toast('✅ Kết nối Facebook thành công!');
        if (r.account) {
          console.log('Facebook Account:', r.account);
        }
        return true;
      } else {
        toast('❌ ' + (r.error || 'Kết nối thất bại'));
        return false;
      }
    } catch (e) {
      toast('❌ Lỗi: ' + e.message);
      return false;
    }
  }

  async function loadCampaigns() {
    showLoading('campaignsList', 'Đang tải campaigns...');
    try {
      const r = await Admin.req('/admin/facebook/campaigns', { method: 'GET' });
      if (r && r.ok) {
        campaignsCache = r.campaigns || [];
        renderCampaigns(campaignsCache);
      } else {
        showError('campaignsList', r.error || 'Không thể tải campaigns');
      }
    } catch (e) {
      showError('campaignsList', 'Lỗi: ' + e.message);
    }
  }

  async function loadProducts() {
    showLoading('productSelector', 'Đang tải sản phẩm...');
    try {
      // Gọi API lấy danh sách sản phẩm
      const r = await Admin.req('/admin/products/list', { method: 'GET' });
      if (r && r.ok && r.products) {
        productsCache = r.products;
        renderProducts(productsCache);
      } else {
        showError('productSelector', 'Không thể tải sản phẩm');
      }
    } catch (e) {
      showError('productSelector', 'Lỗi: ' + e.message);
    }
  }

  async function createCampaign() {
    const name = document.getElementById('campaignName')?.value?.trim();
    const budget = document.getElementById('campaignBudget')?.value;
    const objective = document.getElementById('campaignObjective')?.value;
    const ageMin = document.getElementById('targetAgeMin')?.value || 18;
    const ageMax = document.getElementById('targetAgeMax')?.value || 65;

    if (!name) {
      toast('❌ Vui lòng nhập tên campaign');
      return;
    }

    if (!budget || budget < 50000) {
      toast('❌ Ngân sách tối thiểu 50,000 VNĐ');
      return;
    }

    // Lấy sản phẩm đã chọn
    const selectedProducts = [];
    document.querySelectorAll('.product-item input[type="checkbox"]:checked').forEach(cb => {
      selectedProducts.push(cb.value);
    });

    if (selectedProducts.length === 0) {
      toast('❌ Vui lòng chọn ít nhất 1 sản phẩm');
      return;
    }

    if (selectedProducts.length > 10) {
      toast('❌ Chỉ được chọn tối đa 10 sản phẩm');
      return;
    }

    const btn = document.getElementById('btnCreateCampaign');
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Đang tạo...';
    }

    try {
      const r = await Admin.req('/admin/facebook/campaigns', {
        method: 'POST',
        body: {
          name: name,
          daily_budget: parseInt(budget),
          objective: objective,
          product_ids: selectedProducts,
          targeting: {
            age_min: parseInt(ageMin),
            age_max: parseInt(ageMax)
          }
        }
      });

      if (r && r.ok) {
        toast('✅ ' + (r.message || 'Tạo campaign thành công!'));
        // Reset form
        document.getElementById('campaignName').value = '';
        document.getElementById('campaignBudget').value = '100000';
        document.querySelectorAll('.product-item input[type="checkbox"]').forEach(cb => {
          cb.checked = false;
        });
        // Chuyển về tab campaigns
        document.querySelector('.tab[data-tab="campaigns"]')?.click();
        // Reload campaigns
        setTimeout(() => loadCampaigns(), 500);
      } else {
        toast('❌ ' + (r.error || 'Tạo campaign thất bại'));
      }
    } catch (e) {
      toast('❌ Lỗi: ' + e.message);
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = '🚀 Tạo Campaign';
      }
    }
  }

  async function toggleCampaign(campaignId, action) {
    try {
      const r = await Admin.req(`/admin/facebook/campaigns/${campaignId}/${action}`, {
        method: 'POST'
      });

      if (r && r.ok) {
        toast('✅ ' + (r.message || 'Cập nhật thành công'));
        loadCampaigns();
      } else {
        toast('❌ ' + (r.error || 'Cập nhật thất bại'));
      }
    } catch (e) {
      toast('❌ Lỗi: ' + e.message);
    }
  }

  async function deleteCampaign(campaignId) {
    if (!confirm('Bạn có chắc muốn xóa campaign này?')) return;

    try {
      const r = await Admin.req(`/admin/facebook/campaigns/${campaignId}`, {
        method: 'DELETE'
      });

      if (r && r.ok) {
        toast('✅ Đã xóa campaign');
        loadCampaigns();
      } else {
        toast('❌ ' + (r.error || 'Xóa thất bại'));
      }
    } catch (e) {
      toast('❌ Lỗi: ' + e.message);
    }
  }

  async function getCampaignStats(campaignId) {
    try {
      const r = await Admin.req(`/admin/facebook/campaigns/${campaignId}/stats`, {
        method: 'GET'
      });

      if (r && r.ok) {
        return r.stats;
      }
      return null;
    } catch (e) {
      console.error('Get stats error:', e);
      return null;
    }
  }

  async function loadSettings() {
    try {
      const r = await Admin.req('/admin/settings/facebook_ads', { method: 'GET' });
      if (r && r.ok && r.value) {
        const settings = r.value;
        document.getElementById('fbAppId').value = settings.app_id || '';
        document.getElementById('fbAppSecret').value = settings.app_secret || '';
        document.getElementById('fbAccessToken').value = settings.access_token || '';
        document.getElementById('fbAdAccountId').value = settings.ad_account_id || '';
        document.getElementById('fbPageId').value = settings.page_id || '';
        document.getElementById('fbPixel').value = settings.pixel_id || '';
      }
    } catch (e) {
      console.error('Load settings error:', e);
    }
  }

  async function saveSettings() {
    const settings = {
      app_id: document.getElementById('fbAppId')?.value?.trim(),
      app_secret: document.getElementById('fbAppSecret')?.value?.trim(),
      access_token: document.getElementById('fbAccessToken')?.value?.trim(),
      ad_account_id: document.getElementById('fbAdAccountId')?.value?.trim(),
      page_id: document.getElementById('fbPageId')?.value?.trim(),
      pixel_id: document.getElementById('fbPixel')?.value?.trim()
    };

    if (!settings.app_id || !settings.app_secret || !settings.access_token || !settings.ad_account_id) {
      toast('❌ Vui lòng điền đầy đủ thông tin bắt buộc');
      return;
    }

    const btn = document.getElementById('btnSaveSettings');
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Đang lưu...';
    }

    try {
      const r = await Admin.req('/admin/settings/upsert', {
        method: 'POST',
        body: {
          path: 'facebook_ads',
          value: settings
        }
      });

      if (r && r.ok) {
        toast('✅ Đã lưu cấu hình');
      } else {
        toast('❌ ' + (r.error || 'Lưu thất bại'));
      }
    } catch (e) {
      toast('❌ Lỗi: ' + e.message);
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = '💾 Lưu cấu hình';
      }
    }
  }

  // ============================================================
  // UI RENDERING
  // ============================================================

  function renderCampaigns(campaigns) {
    const container = document.getElementById('campaignsList');
    if (!container) return;

    if (!campaigns || campaigns.length === 0) {
      container.innerHTML = `
        <div class="alert alert-info">
          Chưa có campaign nào. Tạo campaign mới ở tab "➕ Tạo mới"
        </div>
      `;
      return;
    }

    container.innerHTML = campaigns.map(c => renderCampaignCard(c)).join('');

    // Wire up event handlers
    campaigns.forEach(c => {
      const pauseBtn = document.getElementById(`pause-${c.id}`);
      const resumeBtn = document.getElementById(`resume-${c.id}`);
      const deleteBtn = document.getElementById(`delete-${c.id}`);
      const statsBtn = document.getElementById(`stats-${c.id}`);

      if (pauseBtn) pauseBtn.onclick = () => toggleCampaign(c.id, 'pause');
      if (resumeBtn) resumeBtn.onclick = () => toggleCampaign(c.id, 'resume');
      if (deleteBtn) deleteBtn.onclick = () => deleteCampaign(c.id);
      if (statsBtn) statsBtn.onclick = () => showCampaignStats(c.id);
    });
  }

  function renderCampaignCard(campaign) {
    const status = campaign.status || 'PAUSED';
    const isActive = status === 'ACTIVE';
    const statusClass = isActive ? 'active' : 'paused';
    const statusText = isActive ? 'Đang chạy' : 'Tạm dừng';

    return `
      <div class="campaign-card">
        <div class="campaign-header">
          <div class="campaign-name">${campaign.name || 'Unnamed Campaign'}</div>
          <div class="campaign-status ${statusClass}">${statusText}</div>
        </div>
        
        <div class="campaign-stats">
          <div class="stat-box">
            <div class="stat-value">${formatVND(campaign.daily_budget || 0)}</div>
            <div class="stat-label">Ngân sách/ngày</div>
          </div>
          <div class="stat-box">
            <div class="stat-value">${campaign.objective || 'N/A'}</div>
            <div class="stat-label">Mục tiêu</div>
          </div>
          <div class="stat-box">
            <div class="stat-value">${(campaign.product_ids || []).length}</div>
            <div class="stat-label">Sản phẩm</div>
          </div>
          <div class="stat-box">
            <div class="stat-value" id="stats-impressions-${campaign.id}">-</div>
            <div class="stat-label">Lượt hiển thị</div>
          </div>
          <div class="stat-box">
            <div class="stat-value" id="stats-clicks-${campaign.id}">-</div>
            <div class="stat-label">Lượt click</div>
          </div>
        </div>

        <div style="margin-top: 12px; display: flex; gap: 8px;">
          ${isActive ? 
            `<button id="pause-${campaign.id}" class="btn">⏸ Tạm dừng</button>` :
            `<button id="resume-${campaign.id}" class="btn primary">▶ Tiếp tục</button>`
          }
          <button id="stats-${campaign.id}" class="btn">📊 Thống kê</button>
          <button id="delete-${campaign.id}" class="btn danger">🗑 Xóa</button>
        </div>
      </div>
    `;
  }

  function renderProducts(products) {
    const container = document.getElementById('productSelector');
    if (!container) return;

    if (!products || products.length === 0) {
      container.innerHTML = '<div class="alert">Không có sản phẩm nào</div>';
      return;
    }

    container.innerHTML = products.map(p => {
      const thumb = (p.images && p.images[0]) || '/placeholder.jpg';
      const price = (p.variants && p.variants[0] && p.variants[0].price) || 0;
      
      return `
        <div class="product-item">
          <input type="checkbox" value="${p.id}" />
          <img src="${thumb}" alt="${p.name}" class="product-thumb" />
          <div style="flex: 1;">
            <div style="font-weight: 600;">${p.name || 'Unnamed Product'}</div>
            <div style="font-size: 13px; color: #64748b;">${formatVND(price)}</div>
          </div>
        </div>
      `;
    }).join('');
  }

  async function showCampaignStats(campaignId) {
    const stats = await getCampaignStats(campaignId);
    if (!stats) {
      toast('❌ Không thể tải thống kê');
      return;
    }

    // Update stats in card
    const impressionsEl = document.getElementById(`stats-impressions-${campaignId}`);
    const clicksEl = document.getElementById(`stats-clicks-${campaignId}`);

    if (impressionsEl) impressionsEl.textContent = (stats.impressions || 0).toLocaleString('vi-VN');
    if (clicksEl) clicksEl.textContent = (stats.clicks || 0).toLocaleString('vi-VN');

    // Show detailed stats in modal/alert
    const message = `
📊 THỐNG KÊ CAMPAIGN

👁 Lượt hiển thị: ${(stats.impressions || 0).toLocaleString('vi-VN')}
🖱 Lượt click: ${(stats.clicks || 0).toLocaleString('vi-VN')}
💰 Chi phí: ${formatVND(stats.spend || 0)}
📈 CTR: ${(stats.ctr || 0).toFixed(2)}%
💵 CPC: ${formatVND(stats.cpc || 0)}
👥 Охват: ${(stats.reach || 0).toLocaleString('vi-VN')}
🔄 Tần suất: ${(stats.frequency || 0).toFixed(2)}
✅ Chuyển đổi: ${stats.conversions || 0}
    `;

    alert(message);
  }

  // ============================================================
  // INITIALIZATION
  // ============================================================

  function init() {
    console.log('[Facebook Ads] Initializing...');

    // Tab switching
    document.querySelectorAll('.tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        tab.classList.add('active');
        document.getElementById(`tab-${tab.dataset.tab}`).classList.add('active');
        
        if (tab.dataset.tab === 'campaigns') loadCampaigns();
        if (tab.dataset.tab === 'create') loadProducts();
        if (tab.dataset.tab === 'settings') loadSettings();
      });
    });

    // Button handlers
    const btnRefresh = document.getElementById('btnRefreshCampaigns');
    if (btnRefresh) btnRefresh.onclick = loadCampaigns;

    const btnTest = document.getElementById('btnTestConnection');
    if (btnTest) btnTest.onclick = testConnection;

    const btnCreate = document.getElementById('btnCreateCampaign');
    if (btnCreate) btnCreate.onclick = createCampaign;

    const btnSave = document.getElementById('btnSaveSettings');
    if (btnSave) btnSave.onclick = saveSettings;

    // Load initial data
    loadCampaigns();
  }

  // ============================================================
  // EXPORT PUBLIC API
  // ============================================================

  window.FacebookAds = {
    init,
    testConnection,
    loadCampaigns,
    loadProducts,
    createCampaign,
    toggleCampaign,
    deleteCampaign,
    getCampaignStats,
    loadSettings,
    saveSettings
  };

  // Auto-init on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();

console.log('✅ ads_real.js loaded');