// ===================================================================
// ads_real.js - Facebook Ads Management Logic
// Version: 1.0
// ===================================================================

(function() {
  'use strict';

  const API = (window.Admin && Admin.getApiBase && Admin.getApiBase()) || 'https://api.shophuyvan.vn';
  let productsCache = [];
  let campaignsCache = [];
  let fanpagesCache = [];

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

    // Validation đầy đủ
    if (!name || name.length < 3) {
      toast('❌ Tên campaign phải có ít nhất 3 ký tự');
      return;
    }

    if (!budget || budget < 50000) {
      toast('❌ Ngân sách tối thiểu 50,000 VNĐ');
      return;
    }

    if (parseInt(budget) > 50000000) {
      if (!confirm('Ngân sách rất cao (> 50 triệu VNĐ). Bạn có chắc chắn?')) {
        return;
      }
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

  // ============================================================
  // FANPAGE MANAGEMENT
  // ============================================================

  async function loadFanpages() {
    const container = document.getElementById('fanpageTableBody');
    if (!container) return;
    
    container.innerHTML = '<tr><td colspan="4" style="text-align:center;">⏳ Đang tải dữ liệu...</td></tr>';

    try {
      // Lấy danh sách từ DB
      const r = await Admin.req('/admin/fanpages', { method: 'GET' });
      if (r && r.ok && r.items && r.items.length > 0) {
        fanpagesCache = r.items;
        
        container.innerHTML = r.items.map(fp => `
          <tr>
            <td style="padding:10px; border:1px solid #e5e7eb;">
                <div style="font-weight:600; color:#111827;">${fp.name || 'Unnamed'}</div>
            </td>
            <td style="padding:10px; border:1px solid #e5e7eb; font-family:monospace;">${fp.page_id}</td>
            <td style="padding:10px; border:1px solid #e5e7eb; text-align:center;">
                <span style="background:${fp.auto_reply_enabled ? '#d1fae5' : '#f3f4f6'}; color:${fp.auto_reply_enabled ? '#065f46' : '#6b7280'}; padding:2px 8px; border-radius:4px; font-size:11px; font-weight:bold;">
                    ${fp.auto_reply_enabled ? 'BẬT' : 'TẮT'}
                </span>
            </td>
            <td style="padding:10px; border:1px solid #e5e7eb; text-align:center;">
               <button class="btn-sm danger" style="background:#fee2e2; color:#dc2626; border:1px solid #fca5a5; cursor:pointer; padding:4px 8px; border-radius:4px;" onclick="FacebookAds.deleteFanpage('${fp.page_id}')">Xóa</button>
            </td>
          </tr>
        `).join('');
      } else {
        container.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:20px;">Chưa có Fanpage nào. Hãy bấm nút <b>"Đồng bộ từ Facebook"</b>.</td></tr>';
      }
    } catch (e) {
      container.innerHTML = `<tr><td colspan="4" style="text-align:center; color:red;">Lỗi: ${e.message}</td></tr>`;
    }
  }

  async function addFanpage() {
    const pageId = document.getElementById('newFanpageId')?.value?.trim();
    const pageName = document.getElementById('newFanpageName')?.value?.trim();

    if (!pageId || !pageName) {
      toast('❌ Vui lòng điền đầy đủ thông tin');
      return;
    }

    if (pageId.length < 5) {
      toast('❌ Page ID không hợp lệ');
      return;
    }

    const btn = document.getElementById('btnAddFanpage');
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Đang thêm...';
    }

    try {
      const r = await Admin.req('/admin/facebook/fanpages', {
        method: 'POST',
        body: {
          page_id: pageId,
          page_name: pageName
        }
      });

      if (r && r.ok) {
        toast('✅ ' + (r.message || 'Thêm fanpage thành công'));
        // Reset form
        document.getElementById('newFanpageId').value = '';
        document.getElementById('newFanpageName').value = '';
        // Reload fanpages
        loadFanpages();
      } else {
        toast('❌ ' + (r.error || 'Thêm fanpage thất bại'));
      }
    } catch (e) {
      toast('❌ Lỗi: ' + e.message);
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = '➕ Thêm';
      }
    }
  }

  async function deleteFanpage(id) {
    if (!confirm('Bạn có chắc muốn xóa fanpage này?')) return;

    try {
      const r = await Admin.req(`/admin/facebook/fanpages/${id}`, {
        method: 'DELETE'
      });

      if (r && r.ok) {
        toast('✅ Đã xóa fanpage');
        loadFanpages();
      } else {
        toast('❌ ' + (r.error || 'Xóa thất bại'));
      }
    } catch (e) {
      toast('❌ Lỗi: ' + e.message);
    }
  }

  async function setDefaultFanpage(id) {
    try {
      const r = await Admin.req(`/admin/facebook/fanpages/${id}/default`, {
        method: 'POST'
      });

      if (r && r.ok) {
        toast('✅ ' + (r.message || 'Đã đặt fanpage mặc định'));
        loadFanpages();
      } else {
        toast('❌ ' + (r.error || 'Đặt mặc định thất bại'));
      }
    } catch (e) {
      toast('❌ Lỗi: ' + e.message);
    }
  }

  function renderFanpages(fanpages) {
    const container = document.getElementById('fanpageTableBody');
    if (!container) return;

    if (!fanpages || fanpages.length === 0) {
      container.innerHTML = '<div class="alert">Chưa có fanpage nào. Vui lòng thêm fanpage!</div>';
      return;
    }

    const tableHTML = `
      <style>
        .fanpage-table { width: 100%; border-collapse: collapse; margin-top: 12px; }
        .fanpage-table th, .fanpage-table td { padding: 10px 12px; border: 1px solid var(--border); text-align: left; font-size: 13px; }
        .fanpage-table th { background: #f9fafb; font-weight: 600; }
        .fanpage-table tr.default-page td { background: #dbeafe; }
        .fanpage-table .badge-default { background: #3b82f6; color: white; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; }
        .fanpage-table .btn-group { display: flex; gap: 6px; }
        .fanpage-table .btn-sm { padding: 4px 10px; font-size: 12px; border: 1px solid var(--border); background: white; border-radius: 4px; cursor: pointer; }
        .fanpage-table .btn-sm:hover { background: #f3f4f6; }
        .fanpage-table .btn-danger { background: #fee; color: #dc2626; border-color: #fca5a5; }
        .fanpage-table .btn-primary { background: #eff6ff; color: #2563eb; border-color: #93c5fd; }
      </style>
      <table class="fanpage-table">
        <thead>
          <tr>
            <th>Tên Fanpage</th>
            <th>Page ID</th>
            <th>Trạng thái</th>
            <th>Thao tác</th>
          </tr>
        </thead>
        <tbody>
          ${fanpages.map(fp => `
            <tr class="${fp.is_default ? 'default-page' : ''}">
              <td>
                <strong>${fp.page_name || 'Unnamed Page'}</strong>
                ${fp.is_default ? '<span class="badge-default">MẶC ĐỊNH</span>' : ''}
              </td>
              <td><code>${fp.page_id}</code></td>
              <td>${fp.status === 'active' ? '🟢 Active' : '🔴 Inactive'}</td>
              <td>
                <div class="btn-group">
                  ${!fp.is_default ? `<button class="btn-sm btn-primary" onclick="FacebookAds.setDefaultFanpage('${fp.id}')">Đặt mặc định</button>` : ''}
                  <button class="btn-sm btn-danger" onclick="FacebookAds.deleteFanpage('${fp.id}')">Xóa</button>
                </div>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
    container.innerHTML = tableHTML;
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

  async function loginFacebook() {
    try {
      const r = await Admin.req('/admin/facebook/oauth/authorize', { method: 'GET' });
      if (r && r.ok && r.auth_url) {
        // Mở popup OAuth
        const width = 600;
        const height = 700;
        const left = (screen.width - width) / 2;
        const top = (screen.height - height) / 2;
        
        const popup = window.open(
          r.auth_url,
          'FacebookOAuth',
          `width=${width},height=${height},left=${left},top=${top},toolbar=no,location=no,status=no,menubar=no`
        );
        
        // Lắng nghe message từ OAuth callback
        window.addEventListener('message', function handleOAuthCallback(event) {
          if (event.data && event.data.type === 'FB_OAUTH_SUCCESS') {
            window.removeEventListener('message', handleOAuthCallback);
            if (popup) popup.close();
            
            // Auto-fill access token
            const tokenField = document.getElementById('fbAccessToken');
            if (tokenField && event.data.access_token) {
              tokenField.value = event.data.access_token;
              tokenField.readOnly = true;
              toast('✅ Đã lấy access token từ Facebook');
            }
            
            // Auto-save settings
            setTimeout(saveSettings, 500);
          }
        });
        
        toast('🔐 Đang mở cửa sổ Facebook Login...');
      } else {
        toast('❌ ' + (r.error || 'Không thể tạo OAuth URL'));
      }
    } catch (e) {
      toast('❌ Lỗi: ' + e.message);
    }
  }

  async function checkTokenInfo() {
    try {
      const r = await Admin.req('/admin/facebook/oauth/token-info', { method: 'GET' });
      if (r && r.ok) {
        const status = r.is_expired ? '⚠️ Đã hết hạn' : '✅ Còn hiệu lực';
        const expires = new Date(r.expires_at).toLocaleString('vi-VN');
        const scopes = r.scopes.join(', ');
        
        alert(`🔑 THÔNG TIN ACCESS TOKEN\n\n` +
              `User: ${r.user_name}\n` +
              `Status: ${status}\n` +
              `Expires: ${expires}\n\n` +
              `Permissions:\n${scopes}`);
      } else {
        toast('❌ ' + (r.error || 'Không có token'));
      }
    } catch (e) {
      toast('❌ Lỗi: ' + e.message);
    }
  }

  async function revokeToken() {
    if (!confirm('Bạn có chắc muốn xóa access token?\n\nSau khi xóa, bạn cần login lại Facebook.')) return;
    
    try {
      const r = await Admin.req('/admin/facebook/oauth/revoke', { method: 'POST' });
      if (r && r.ok) {
        toast('✅ Đã xóa access token');
      } else {
        toast('❌ ' + (r.error || 'Xóa thất bại'));
      }
    } catch (e) {
      toast('❌ Lỗi: ' + e.message);
    }
  }

  async function loadSettings() {
    try {
      const r = await Admin.req('/admin/settings/facebook_ads', { method: 'GET' });
      console.log('[FB Ads] loadSettings response:', r);
      
      if (r && r.ok && r.value) {
        const settings = r.value;
        const fbAppId = document.getElementById('fbAppId');
        const fbAppSecret = document.getElementById('fbAppSecret');
        const fbAccessToken = document.getElementById('fbAccessToken');
        const fbAdAccountId = document.getElementById('fbAdAccountId');
        const fbPageId = document.getElementById('fbPageId');
        const fbPixel = document.getElementById('fbPixel');
        
        if (fbAppId) fbAppId.value = settings.app_id || '';
        if (fbAppSecret) fbAppSecret.value = settings.app_secret || '';
        if (fbAccessToken) fbAccessToken.value = settings.access_token || '';
        if (fbAdAccountId) fbAdAccountId.value = settings.ad_account_id || '';
        if (fbPageId) fbPageId.value = settings.page_id || '';
        if (fbPixel) fbPixel.value = settings.pixel_id || '';

        // [SHV] Cập nhật trạng thái hiển thị
        const statusText = document.getElementById('connectionStatusText');
        const btnLogin = document.getElementById('btnLoginFacebook');
        if (settings.access_token && statusText) {
             statusText.innerHTML = '<span style="color:#059669; font-weight:bold;">✅ Đã kết nối (Token Active)</span>';
             if(btnLogin) btnLogin.textContent = '🔄 Đổi tài khoản khác';
             if(btnLogin) btnLogin.classList.replace('primary', 'btn'); // Đổi màu nút cho đỡ nổi
        }
      } else {
        console.warn('[FB Ads] No settings found or invalid response');
      }
      
      // Load Global Automation Settings
      try {
          const autoConfig = await Admin.req('/admin/settings/facebook_automation_global', { method: 'GET' });
          if(autoConfig && autoConfig.value) {
             const val = autoConfig.value;
             if(document.getElementById('global-hide-phone')) document.getElementById('global-hide-phone').checked = val.enable_hide_phone;
             if(document.getElementById('global-auto-reply')) document.getElementById('global-auto-reply').checked = val.enable_auto_reply;
             if(document.getElementById('global-reply-template')) document.getElementById('global-reply-template').value = val.reply_template || '';
             if(document.getElementById('global-website-link')) document.getElementById('global-website-link').value = val.website_link || 'https://shophuyvan.vn';
          }
      } catch(e) { console.log('No global settings yet'); }

      // Load danh sách fanpages
      loadFanpages();
      
      // Load token status widget
      loadTokenStatusWidget();
    } catch (e) {
      console.error('Load settings error:', e);
    }
  }

  async function saveSettings() {
    // 1. Lấy Cấu hình chung (Global)
    const globalConfig = {
      enable_hide_phone: document.getElementById('global-hide-phone')?.checked || false,
      enable_auto_reply: document.getElementById('global-auto-reply')?.checked || false,
      reply_template: document.getElementById('global-reply-template')?.value || '',
      website_link: document.getElementById('global-website-link')?.value || ''
    };

    // 2. Lấy Token Login (nếu có) để giữ session
    const accessToken = document.getElementById('fbAccessToken')?.value?.trim();

    const btn = document.getElementById('btnSaveSettings');
    if (btn) { btn.disabled = true; btn.textContent = '⏳ Đang lưu...'; }

    try {
      // A. Lưu vào Global Settings KV
      await Admin.req('/admin/settings/upsert', {
        method: 'POST',
        body: { path: 'facebook_automation_global', value: globalConfig }
      });

      // B. Nếu có token thì lưu token (Optional)
      if(accessToken) {
         await Admin.req('/admin/settings/upsert', {
            method: 'POST', 
            body: { path: 'facebook_ads_token', value: { access_token: accessToken } }
         });
      }

      // C. Cập nhật hàng loạt cho các Fanpage đã có trong DB (để đồng bộ trạng thái)
      const allPages = fanpagesCache || [];
      for (const page of allPages) {
         await Admin.req('/admin/fanpages', {
            method: 'POST',
            body: {
               page_id: page.page_id,
               name: page.name,
               access_token: page.access_token, // Giữ nguyên token
               auto_reply_enabled: globalConfig.enable_auto_reply,
               reply_template: globalConfig.reply_template
            }
         });
      }

      toast('✅ Đã lưu cấu hình & Áp dụng cho toàn bộ Fanpage!');
      
      // Reload lại bảng để thấy trạng thái Auto Reply thay đổi
      await loadFanpages();
      
      // Fake response object for compatibility
      var r = { ok: true };
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
  // THÊM MỚI: API CALLS CHO TÍNH NĂNG MỚI
  // ============================================================

  async function loadFanpagesForPost() {
    try {
      const r = await Admin.req('/admin/facebook/fanpages', { method: 'GET' });
      if (r && r.ok) {
        fanpagesCache = r.fanpages || [];
        renderFanpageSelector(fanpagesCache);
      }
    } catch (e) {
      console.error('Load fanpages error:', e);
    }
  }

  async function generateAICaption() {
    const productId = document.querySelector('#postProductSelector input[type="radio"]:checked')?.value;
    
    if (!productId) {
      toast('❌ Vui lòng chọn sản phẩm trước');
      return;
    }
    
    const product = productsCache.find(p => p.id === productId);
    if (!product) {
      toast('❌ Không tìm thấy thông tin sản phẩm');
      return;
    }
    
    const tone = document.getElementById('aiCaptionTone')?.value || 'casual';
    const btn = document.getElementById('btnAICaption');
    const captionEl = document.getElementById('postCaption');
    
    btn.disabled = true;
    btn.textContent = '⏳ AI đang viết...';
    captionEl.value = '💭 Đang suy nghĩ...';
    
    try {
      const r = await Admin.req('/admin/facebook/ai/caption', {
        method: 'POST',
        body: {
          product_name: product.name,
          product_description: product.description || product.short_description || '',
          price: product.variants?.[0]?.price || 0,
          tone: tone
        }
      });
      
      if (r && r.ok && r.caption) {
        // Animate typing effect
        captionEl.value = '';
        const caption = r.caption;
        let i = 0;
        
        const typeInterval = setInterval(() => {
          if (i < caption.length) {
            captionEl.value += caption[i];
            i++;
          } else {
            clearInterval(typeInterval);
          }
        }, 20);
        
        toast('✅ AI đã tạo caption thành công!');
      } else {
        toast('❌ ' + (r.error || 'AI tạo caption thất bại'));
        // Fallback to template
        captionEl.value = generateTemplateCaption(product, tone);
      }
    } catch (e) {
      toast('❌ Lỗi: ' + e.message);
      // Fallback to template
      captionEl.value = generateTemplateCaption(product, tone);
    } finally {
      btn.disabled = false;
      btn.textContent = '🤖 AI Generate Caption';
    }
  }

  function generateTemplateCaption(product, tone) {
    const price = formatVND(product.variants?.[0]?.price || 0);
    const name = product.name || 'Sản phẩm';
    const desc = (product.description || product.short_description || '').substring(0, 100);
    
    const templates = {
      casual: `Hế lô! 👋

Mình vừa tìm thấy món ${name} siêu xịn này nè! 

${desc ? desc + '...\n\n' : ''}💰 Giá chỉ: ${price}

Ai thích thì inbox mình nha! 💕`,

      professional: `${name}

${desc ? desc + '...\n\n' : ''}📌 Thông tin sản phẩm:
- Giá: ${price}
- Chất lượng cao, uy tín
- Giao hàng toàn quốc

📞 Liên hệ ngay để được tư vấn chi tiết!`,

      sale: `🔥 SIÊU SALE 🔥

${name.toUpperCase()}

${desc ? '✨ ' + desc + '...\n\n' : ''}💥 GIÁ CHỈ: ${price}
⚡ SỐ LƯỢNG CÓ HẠN!
🎁 MUA NGAY KẺO HẾT!

👉 Inbox đặt hàng ngay hôm nay!`
    };
    
    return templates[tone] || templates.casual;
  }

  async function uploadCustomMedia() {
    const fileInput = document.getElementById('postMediaFile');
    const file = fileInput?.files?.[0];
    
    if (!file) {
      toast('❌ Vui lòng chọn file');
      return;
    }
    
    // Validate size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast('❌ File quá lớn (max 10MB)');
      return;
    }
    
    const btn = document.getElementById('btnUploadMedia');
    const progress = document.getElementById('uploadProgress');
    const progressBar = document.getElementById('uploadProgressBar');
    const progressText = document.getElementById('uploadProgressText');
    
    btn.disabled = true;
    btn.textContent = '⏳ Đang upload...';
    progress.style.display = 'block';
    
    try {
      // Upload to Cloudinary
      const formData = new FormData();
      formData.append('file', file);
      formData.append('upload_preset', 'shv_preset'); // Cần config trên Cloudinary
      
      // Simulate progress
      let uploadProgress = 0;
      const progressInterval = setInterval(() => {
        uploadProgress += 10;
        if (uploadProgress > 90) uploadProgress = 90;
        progressBar.style.width = uploadProgress + '%';
        progressText.textContent = `Uploading... ${uploadProgress}%`;
      }, 200);
      
      const response = await fetch('https://api.cloudinary.com/v1_1/YOUR_CLOUD_NAME/auto/upload', {
        method: 'POST',
        body: formData
      });
      
      clearInterval(progressInterval);
      
      if (!response.ok) {
        throw new Error('Upload failed');
      }
      
      const data = await response.json();
      
      // Save URL globally
      window._uploadedMediaUrl = data.secure_url;
      
      progressBar.style.width = '100%';
      progressText.textContent = '✅ Upload thành công!';
      
      // Show preview
      const preview = document.getElementById('mediaPreview');
      preview.style.display = 'block';
      
      if (file.type.startsWith('image/')) {
        const img = document.getElementById('mediaPreviewImg');
        img.src = data.secure_url;
        img.style.display = 'block';
        document.getElementById('mediaPreviewVideo').style.display = 'none';
      } else {
        const video = document.getElementById('mediaPreviewVideo');
        video.src = data.secure_url;
        video.style.display = 'block';
        document.getElementById('mediaPreviewImg').style.display = 'none';
      }
      
      toast('✅ Upload thành công!');
      
    } catch (e) {
      progressBar.style.width = '0%';
      progressText.textContent = '❌ Upload thất bại';
      toast('❌ Upload thất bại: ' + e.message);
    } finally {
      btn.disabled = false;
      btn.textContent = '📤 Upload lên Cloudinary';
    }
  }

  function renderFanpageSelector(fanpages) {
    const container = document.getElementById('postFanpageSelector');
    if (!container) return;
    
    if (!fanpages || fanpages.length === 0) {
      container.innerHTML = '<div class="alert">Chưa có fanpage nào. Vui lòng thêm fanpage ở tab Cài đặt.</div>';
      return;
    }
    
    const html = fanpages.map(fp => `
      <label style="display: flex; align-items: center; gap: 8px; padding: 8px; border: 1px solid #e5e7eb; border-radius: 6px; margin-bottom: 8px; cursor: pointer;">
        <input type="checkbox" value="${fp.page_id}" ${fp.is_default ? 'checked' : ''} style="width: 18px; height: 18px;"/>
        <div style="flex: 1;">
          <strong>${fp.page_name}</strong>
          ${fp.is_default ? '<span style="background: #3b82f6; color: white; padding: 2px 6px; border-radius: 4px; font-size: 10px; margin-left: 6px;">MẶC ĐỊNH</span>' : ''}
        </div>
      </label>
    `).join('');
    
    container.innerHTML = html;
  }

  async function createFanpagePost() {
    const productId = document.querySelector('#postProductSelector input[type="radio"]:checked')?.value;
    const caption = document.getElementById('postCaption')?.value;
    const postType = document.getElementById('postType')?.value;
    const cta = document.getElementById('postCTA')?.value;
    
    // Lấy các fanpage đã chọn
    const selectedFanpages = [];
    document.querySelectorAll('#postFanpageSelector input[type="checkbox"]:checked').forEach(cb => {
      selectedFanpages.push(cb.value);
    });
    
    // Lấy custom media URL nếu đã upload
    const mediaSource = document.querySelector('input[name="mediaSource"]:checked')?.value;
    const customMediaUrl = mediaSource === 'custom' ? window._uploadedMediaUrl : null;

    if (!productId) {
      toast('❌ Vui lòng chọn 1 sản phẩm');
      return;
    }
    if (!caption) {
      toast('❌ Vui lòng nhập caption');
      return;
    }
    if (selectedFanpages.length === 0) {
      toast('❌ Vui lòng chọn ít nhất 1 fanpage');
      return;
    }

    const btn = document.getElementById('btnCreatePost');
    btn.disabled = true;
    btn.textContent = 'Đang đăng...';

    try {
      const r = await Admin.req('/admin/facebook/posts', {
        method: 'POST',
        body: {
          product_id: productId,
          caption: caption,
          post_type: postType,
          cta: cta,
          fanpage_ids: selectedFanpages,
          custom_media_url: customMediaUrl, // Thêm custom media
          media_type: customMediaUrl ? (customMediaUrl.includes('.mp4') ? 'video' : 'image') : null
        }
      });

      if (r && r.ok) {
        toast('✅ ' + (r.message || 'Tạo post thành công!'));
        document.getElementById('postResultId').value = r.post_id;
        document.getElementById('postResult').style.display = 'block';
        
        // Copy post_id vào clipboard
        if (navigator.clipboard) {
          navigator.clipboard.writeText(r.post_id);
          toast('📋 Post ID đã được copy vào clipboard');
        }
      } else {
        const errorMsg = r.error?.message || r.error?.error_user_msg || r.error || 'Tạo post thất bại';
        toast('❌ ' + errorMsg);
        console.error('Create post error details:', r);
      }
    } catch (e) {
      toast('❌ Lỗi: ' + e.message);
    } finally {
      btn.disabled = false;
      btn.textContent = '🚀 Đăng (Dark Post)';
    }
  }

  async function createABTest() {
    const name = document.getElementById('abTestName')?.value;
    const budget = document.getElementById('abTestBudget')?.value;
    const productId = document.querySelector('#abTestProductSelector input[type="radio"]:checked')?.value;
    const product = productsCache.find(p => p.id === productId);

    if (!name || !budget || !productId) {
      toast('❌ Vui lòng điền tên, ngân sách và chọn sản phẩm');
      return;
    }
    
    if (!product || !product.images || product.images.length < 2) {
      toast('❌ Sản phẩm này cần ít nhất 2 ảnh để A/B test');
      return;
    }

    const variants = [
      {
        caption: document.getElementById('abTestCaptionA')?.value,
        image_url: product.images[0] // Lấy ảnh 1
      },
      {
        caption: document.getElementById('abTestCaptionB')?.value,
        image_url: product.images[1] // Lấy ảnh 2
      }
    ];

    if (!variants[0].caption || !variants[1].caption) {
      toast('❌ Vui lòng nhập caption cho cả 2 variants');
      return;
    }
    
    const btn = document.getElementById('btnCreateABTest');
    btn.disabled = true;
    btn.textContent = 'Đang tạo...';

    try {
      const r = await Admin.req('/admin/facebook/campaigns/ab-test', {
        method: 'POST',
        body: {
          name: name,
          daily_budget: parseInt(budget),
          product_id: productId,
          variants: variants
        }
      });

      if (r && r.ok) {
        toast('✅ ' + (r.message || 'Tạo A/B Test thành công!'));
        document.getElementById('abTestAdSetIdInput').value = r.ad_set_id;
        // Tự động tải kết quả
        loadABTestResults(r.ad_set_id);
      } else {
        toast('❌ ' + (r.error?.message || r.error || 'Tạo test thất bại'));
      }
    } catch (e) {
      toast('❌ Lỗi: ' + e.message);
    } finally {
      btn.disabled = false;
      btn.textContent = '🧪 Bắt đầu A/B Test';
    }
  }

  async function loadABTestResults(adSetId) {
    if (!adSetId) {
      adSetId = document.getElementById('abTestAdSetIdInput')?.value;
    }
    if (!adSetId) {
      toast('❌ Vui lòng nhập Ad Set ID');
      return;
    }
    
    showLoading('abTestResultsContainer', 'Đang tải kết quả A/B test...');

    try {
      const r = await Admin.req(`/admin/facebook/ab-test/${adSetId}/results`, {
        method: 'GET'
      });

      if (r && r.ok && r.results) {
        renderABTestResults(r.results);
      } else {
        showError('abTestResultsContainer', r.error || 'Không thể tải kết quả');
      }
    } catch (e) {
      showError('abTestResultsContainer', 'Lỗi: ' + e.message);
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
    const containerCreate = document.getElementById('productSelector');
    const containerPost = document.getElementById('postProductSelector');
    const containerABTest = document.getElementById('abTestProductSelector');

    if (!products || products.length === 0) {
      const noProductHtml = '<div class="alert">Không có sản phẩm nào</div>';
      if (containerCreate) containerCreate.innerHTML = noProductHtml;
      if (containerPost) containerPost.innerHTML = noProductHtml;
      if (containerABTest) containerABTest.innerHTML = noProductHtml;
      return;
    }

    const htmlCheckbox = products.map(p => renderProductItem(p, 'checkbox')).join('');
    const htmlRadio = products.map(p => renderProductItem(p, 'radio')).join('');

    if (containerCreate) containerCreate.innerHTML = htmlCheckbox;
    // Thêm listener cho radio ở tab AutoPost
    if (containerPost) {
        containerPost.innerHTML = htmlRadio;
        containerPost.querySelectorAll('input[type="radio"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                const productId = e.target.value;
                const product = productsCache.find(p => p.id === productId);
                if(product) {
                    // Tự động điền caption
                    const captionEl = document.getElementById('postCaption');
                    if(captionEl) {
                        captionEl.value = `🔥 ${product.name}\n\n💰 Giá chỉ: ${formatVND(product.variants?.[0]?.price || 0)}\n\n🛒 Mua ngay tại đây:\n(link sản phẩm sẽ tự động đính kèm)`;
                    }
                }
            });
        });
    }
    // Thêm listener cho radio ở tab ABTest
    if (containerABTest) {
        containerABTest.innerHTML = htmlRadio;
        containerABTest.querySelectorAll('input[type="radio"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                const productId = e.target.value;
                const product = productsCache.find(p => p.id === productId);
                if(product) {
                    // Tự động điền caption mẫu
                    document.getElementById('abTestName').value = `Test A/B - ${product.name}`;
                    document.getElementById('abTestCaptionA').value = `[Caption ngắn] Mua ngay ${product.name}!`;
                    document.getElementById('abTestCaptionB').value = `[Caption dài] Khám phá ${product.name}, giải pháp hoàn hảo cho...`;
                    
                    // Cập nhật placeholder ảnh
                    document.getElementById('abTestImageA').placeholder = product.images?.[0] ? `Dùng ảnh: ${product.images[0].split('/').pop()}` : 'Không có ảnh 1';
                    document.getElementById('abTestImageB').placeholder = product.images?.[1] ? `Dùng ảnh: ${product.images[1].split('/').pop()}` : 'Không có ảnh 2';
                }
            });
        });
    }
  }
  
  function renderProductItem(p, type = 'checkbox') {
    const thumb = (p.images && p.images[0]) || '/placeholder.jpg';
    const price = (p.variants && p.variants[0] && p.variants[0].price) || 0;
    const inputName = type === 'radio' ? `product_radio_group` : `product_check_${p.id}`; // Sửa: radio phải cùng name

    return `
      <label class="product-item" for="prod-${type}-${p.id}">
        <input type="${type}" value="${p.id}" name="${inputName}" id="prod-${type}-${p.id}" />
        <img src="${thumb}" alt="${p.name}" class="product-thumb" />
        <div style="flex: 1;">
          <div style="font-weight: 600;">${p.name || 'Unnamed Product'}</div>
          <div style="font-size: 13px; color: #64748b;">${formatVND(price)}</div>
        </div>
      </label>
    `;
  }
  
  function renderABTestResults(results) {
    const container = document.getElementById('abTestResultsContainer');
    if (!results || results.length === 0) {
      container.innerHTML = '<div class="alert">Không có dữ liệu</div>';
      return;
    }
    
    // Tìm winner (ví dụ: CTR cao nhất)
    let winnerId = null;
    let maxCtr = -1;
    results.forEach(r => {
      // Chỉ xét winner nếu đang ACTIVE và có clicks
      if (r.status === 'ACTIVE' && r.clicks > 0 && parseFloat(r.ctr) > maxCtr) {
        maxCtr = parseFloat(r.ctr);
        winnerId = r.ad_id;
      }
    });

    const tableHTML = `
      <style>
        .results-table { width: 100%; border-collapse: collapse; margin-top: 12px; }
        .results-table th, .results-table td { padding: 8px 12px; border: 1px solid var(--border); text-align: left; font-size: 13px; }
        .results-table th { background: #f9fafb; font-weight: 600; }
        .results-table tr.winner td { background: #d1fae5; font-weight: 600; color: #065f46; }
        .results-table td.status-PAUSED { color: #b45309; font-style: italic; }
        .results-table td.status-ACTIVE { color: #059669; font-weight: 600; }
      </style>
      <table class="results-table">
        <thead>
          <tr>
            <th>Creative</th>
            <th>Impressions</th>
            <th>Clicks</th>
            <th>CTR</th>
            <th>CPC (VNĐ)</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          ${results.map(r => `
            <tr class="${r.ad_id === winnerId ? 'winner' : ''}">
              <td>${r.creative} ${r.ad_id === winnerId ? '✅' : ''}</td>
              <td>${r.impressions.toLocaleString('vi-VN')}</td>
              <td>${r.clicks.toLocaleString('vi-VN')}</td>
              <td><strong>${r.ctr}%</strong></td>
              <td>${formatVND(r.cpc)}</td>
              <td class="status-${r.status}">${r.status}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
    container.innerHTML = tableHTML;
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
  // TOKEN STATUS WIDGET
  // ============================================================

  async function loadTokenStatusWidget() {
    try {
      const r = await Admin.req('/admin/facebook/oauth/token-info', { method: 'GET' });
      
      const widget = document.getElementById('tokenStatusWidget');
      if (!widget) return;
      
      if (r && r.ok && r.has_token) {
        widget.style.display = 'block';
        renderTokenWidget(r);
        
        // Auto-refresh mỗi 60s
        setInterval(() => renderTokenWidget(r), 60000);
      } else {
        widget.style.display = 'none';
      }
    } catch (e) {
      console.error('[Token Widget] Load error:', e);
    }
  }

  function renderTokenWidget(tokenInfo) {
    const now = Date.now();
    const expiresAt = new Date(tokenInfo.expires_at).getTime();
    const daysLeft = Math.floor((expiresAt - now) / (1000 * 60 * 60 * 24));
    const hoursLeft = Math.floor((expiresAt - now) / (1000 * 60 * 60));
    
    // Update user name
    const userNameEl = document.getElementById('widgetUserName');
    if (userNameEl) userNameEl.textContent = tokenInfo.user_name || 'Unknown';
    
    // Update expire date
    const expireDateEl = document.getElementById('widgetExpireDate');
    if (expireDateEl) {
      // Nếu expires_at quá xa (năm 2038+), hiển thị là Vĩnh viễn hoặc Dài hạn
      const date = new Date(tokenInfo.expires_at);
      const year = date.getFullYear();
      expireDateEl.textContent = year > 2030 ? 'Dài hạn (Long-lived)' : date.toLocaleDateString('vi-VN');
    }
    
    // Update countdown với màu sắc
    const countdownEl = document.getElementById('widgetCountdown');
    const widget = document.getElementById('tokenStatusWidget');
    
    if (countdownEl && widget) {
      let color, borderColor, icon, message;
      
      if (tokenInfo.is_expired || daysLeft < 0) {
        color = '#fee2e2';
        borderColor = '#dc2626';
        icon = '🔴';
        message = 'Token đã hết hạn! Vui lòng login lại.';
      } else if (daysLeft < 7) {
        color = '#fef3c7';
        borderColor = '#f59e0b';
        icon = '🟡';
        message = `Token còn ${daysLeft} ngày! Nên renew sớm.`;
      } else if (daysLeft < 30) {
        color = '#dbeafe';
        borderColor = '#3b82f6';
        icon = '🟢';
        message = `Token còn ${daysLeft} ngày`;
      } else {
        color = '#d1fae5';
        borderColor = '#10b981';
        icon = '🟢';
        message = `Token còn ${daysLeft} ngày`;
      }
      
      countdownEl.style.background = color;
      countdownEl.innerHTML = `${icon} ${message}`;
      widget.style.borderLeftColor = borderColor;
    }
  }

  function dismissTokenWidget() {
    const widget = document.getElementById('tokenStatusWidget');
    if (widget) widget.style.display = 'none';
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
        
        if (tab.dataset.tab === 'dashboard' && window.FacebookAdsDashboard) {
          FacebookAdsDashboard.init();
        }
        if (tab.dataset.tab === 'campaigns') loadCampaigns();
        if (tab.dataset.tab === 'automation' && window.FacebookAdsAutomation) {
          FacebookAdsAutomation.init();
        }
        if (tab.dataset.tab === 'creative' && window.FacebookAdsCreative) {
          FacebookAdsCreative.init();
        }
        // [SHV] Kích hoạt Fanpage Hub
        if (tab.dataset.tab === 'fanpage-hub' && window.FanpageManager) {
          FanpageManager.init();
        }
        // Cập nhật: loadProducts khi mở tab create, autopost, hoặc abtest
        if (tab.dataset.tab === 'create' || tab.dataset.tab === 'autopost' || tab.dataset.tab === 'abtest') {
          // Load products nếu chưa có hoặc force reload
          if(productsCache.length === 0) {
            loadProducts();
          } else {
            // Re-render nếu đã có cache
            renderProducts(productsCache);
          }
          
          // Load fanpages for multi-select
          if (tab.dataset.tab === 'autopost') {
            loadFanpagesForPost();
          }
        }
        if (tab.dataset.tab === 'settings') loadSettings();
      });
    });

    // Button handlers - Sử dụng addEventListener thay vì onclick
    const btnRefresh = document.getElementById('btnRefreshCampaigns');
    if (btnRefresh) {
      btnRefresh.removeEventListener('click', loadCampaigns); // Remove old
      btnRefresh.addEventListener('click', loadCampaigns);
    }

    const btnTest = document.getElementById('btnTestConnection');
    if (btnTest) btnTest.onclick = testConnection;

    const btnCreate = document.getElementById('btnCreateCampaign');
    if (btnCreate) btnCreate.onclick = createCampaign;

    const btnSave = document.getElementById('btnSaveSettings');
    if (btnSave) btnSave.onclick = saveSettings;

    const btnLoginFacebook = document.getElementById('btnLoginFacebook');
    if (btnLoginFacebook) btnLoginFacebook.onclick = loginFacebook;

    const btnCheckToken = document.getElementById('btnCheckToken');
    if (btnCheckToken) btnCheckToken.onclick = checkTokenInfo;

    const btnRevokeToken = document.getElementById('btnRevokeToken');
    if (btnRevokeToken) btnRevokeToken.onclick = revokeToken;

    // Fanpage Management Buttons
    const btnAddFanpage = document.getElementById('btnAddFanpage');
    if (btnAddFanpage) btnAddFanpage.onclick = addFanpage;

    // THÊM MỚI: Button handlers (mới)
    const btnCreatePost = document.getElementById('btnCreatePost');
    if (btnCreatePost) btnCreatePost.onclick = createFanpagePost;
    
    const btnUploadMedia = document.getElementById('btnUploadMedia');
    if (btnUploadMedia) btnUploadMedia.onclick = uploadCustomMedia;
    
    const btnAICaption = document.getElementById('btnAICaption');
    if (btnAICaption) btnAICaption.onclick = generateAICaption;
    
    // Toggle custom media upload section
    document.querySelectorAll('input[name="mediaSource"]').forEach(radio => {
      radio.addEventListener('change', (e) => {
        const customSection = document.getElementById('customMediaUpload');
        if (customSection) {
          customSection.style.display = e.target.value === 'custom' ? 'block' : 'none';
        }
      });
    });
    
    // Preview file on select
    const postMediaFile = document.getElementById('postMediaFile');
    if (postMediaFile) {
      postMediaFile.addEventListener('change', (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        
        const preview = document.getElementById('mediaPreview');
        const img = document.getElementById('mediaPreviewImg');
        const video = document.getElementById('mediaPreviewVideo');
        
        if (file.type.startsWith('image/')) {
          const reader = new FileReader();
          reader.onload = (ev) => {
            img.src = ev.target.result;
            img.style.display = 'block';
            video.style.display = 'none';
            preview.style.display = 'block';
          };
          reader.readAsDataURL(file);
        } else if (file.type.startsWith('video/')) {
          const reader = new FileReader();
          reader.onload = (ev) => {
            video.src = ev.target.result;
            video.style.display = 'block';
            img.style.display = 'none';
            preview.style.display = 'block';
          };
          reader.readAsDataURL(file);
        }
      });
    }
    
    const btnCreateABTest = document.getElementById('btnCreateABTest');
    if (btnCreateABTest) btnCreateABTest.onclick = createABTest;
    
    const btnFetchABTestResults = document.getElementById('btnFetchABTestResults');
    if (btnFetchABTestResults) btnFetchABTestResults.onclick = () => loadABTestResults(null);

    // Load initial data
    loadCampaigns();
  }
  
  // ============================================================
  // CONTENT & VIRAL CENTER (Thay thế Fanpage Manager cũ)
  // ============================================================
  window.FanpageManager = {
    init: function() {
       // Khởi tạo các tab con hoặc load dữ liệu mẫu
       console.log('Content Center Loaded');
    },
    
    // Giả lập tìm kiếm Viral Content
    searchViral: function() {
       const keyword = document.getElementById('viralKeyword').value;
       const container = document.getElementById('viralResults');
       if(!keyword) return toast('❌ Vui lòng nhập từ khóa!');
       
       container.innerHTML = '<div class="loading">Đang quét Big Data...</div>';
       
       // Giả lập kết quả (Sau này sẽ gọi API thật)
       setTimeout(() => {
          container.innerHTML = `
            <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(250px, 1fr)); gap:16px;">
               <div class="card" style="padding:10px;">
                  <img src="https://via.placeholder.com/300x200?text=Viral+Video+1" style="width:100%; border-radius:8px;">
                  <h4 style="margin:8px 0;">Top Trending: ${keyword} #1</h4>
                  <div style="display:flex; justify-content:space-between; font-size:12px; color:#666;">
                     <span>🔥 1.2M Views</span>
                     <span>👍 50k Likes</span>
                  </div>
                  <button class="btn-sm primary" style="width:100%; margin-top:8px;" onclick="toast('Đã lưu vào thư viện!')">📥 Lấy nội dung này</button>
               </div>
               <div class="card" style="padding:10px;">
                  <img src="https://via.placeholder.com/300x200?text=Viral+Image+2" style="width:100%; border-radius:8px;">
                  <h4 style="margin:8px 0;">Review ${keyword} cực hot</h4>
                  <div style="display:flex; justify-content:space-between; font-size:12px; color:#666;">
                     <span>🔥 800k Views</span>
                     <span>👍 22k Likes</span>
                  </div>
                  <button class="btn-sm primary" style="width:100%; margin-top:8px;" onclick="toast('Đã lưu vào thư viện!')">📥 Lấy nội dung này</button>
               </div>
            </div>
          `;
       }, 1500);
    },

    // Mở Modal Lên lịch đăng bài
    openScheduler: function() {
       // Tận dụng tab Auto Post nhưng ở dạng popup hoặc chuyển hướng
       document.querySelector('.tab[data-tab="autopost"]').click();
       toast('💡 Chuyển đến công cụ đăng bài đa kênh');
    },

    // Seeding Tool
    startSeeding: function() {
       const url = document.getElementById('seedingUrl').value;
       if(!url) return toast('❌ Nhập link bài viết cần seeding');
       
       const btn = document.getElementById('btnStartSeeding');
       btn.disabled = true;
       btn.innerHTML = '⏳ Đang chạy seeding...';
       
       setTimeout(() => {
          btn.disabled = false;
          btn.innerHTML = '🚀 Bắt đầu Seeding';
          toast('✅ Đã seeding xong 50 comment mẫu!');
          document.getElementById('seedingLog').innerHTML += `<div style="font-size:12px; margin-top:4px;">✅ [${new Date().toLocaleTimeString()}] Seeding thành công cho: ${url}</div>`;
       }, 2000);
    }
  };
  // Legacy support for Settings Modal
  window.openSettings = async function(pageId) {
    document.getElementById('setting-page-id').value = pageId;
    document.getElementById('modal-settings').style.display = 'flex';
    document.getElementById('input-reply-template').value = 'Đang tải...';
    try {
      const res = await Admin.req(`/admin/fanpages/settings?pageId=${pageId}`, { method: 'GET' });
      if (res.ok && res.data) {
         const s = res.data;
         document.getElementById('toggle-hide-phone').checked = !!s.enable_hide_phone;
         document.getElementById('toggle-auto-reply').checked = !!s.enable_auto_reply;
         document.getElementById('input-reply-template').value = s.reply_template || '';
         document.getElementById('input-website-link').value = s.website_link || '';
      }
    } catch(e) {}
  };
  
  // Global listener for Save Settings button in Modal
  document.addEventListener('click', async (e) => {
    if (e.target && e.target.id === 'btn-save-settings') {
       const pageId = document.getElementById('setting-page-id').value;
       const settings = {
          enable_hide_phone: document.getElementById('toggle-hide-phone').checked,
          enable_auto_reply: document.getElementById('toggle-auto-reply').checked,
          reply_template: document.getElementById('input-reply-template').value,
          website_link: document.getElementById('input-website-link').value
       };
       try {
          await Admin.req('/admin/fanpages/settings', { method: 'POST', body: { pageId, settings } });
          alert('✅ Đã lưu cấu hình!');
          document.getElementById('modal-settings').style.display = 'none';
          if(window.FanpageManager) FanpageManager.init();
       } catch(err) { alert('❌ Lỗi: ' + err.message); }
    }
  });
  // ============================================================
  // FANPAGE SYNC (TÍCH HỢP VÀO ADS)
  // ============================================================

  async function syncFanpages() {
    const btn = document.getElementById('btnSyncFanpages');
    if (btn) {
      btn.disabled = true;
      btn.textContent = '⏳ Đang tải...';
    }

    try {
      // 1. Gọi API lấy danh sách từ Facebook (dùng Token của Ads)
      const r = await Admin.req('/admin/fanpages/fetch-facebook', { method: 'GET' });

      if (r && r.ok && r.data) {
        let savedCount = 0;
        // Lấy cấu hình chung hiện tại để áp dụng luôn cho page mới
        const globalAuto = document.getElementById('global-auto-reply')?.checked || false;
        
        for (const p of r.data) {
            await Admin.req('/admin/fanpages', {
                method: 'POST',
                body: {
                    page_id: p.id,
                    name: p.name,
                    access_token: p.access_token,
                    auto_reply_enabled: globalAuto, // Áp dụng setting chung
                    welcome_message: 'Xin chào!' 
                }
            });
            savedCount++;
        }
        toast(`✅ Đã đồng bộ ${savedCount} Fanpage!`);
        
        // QUAN TRỌNG: Tải lại bảng ngay lập tức
        await loadFanpages(); 
      } else {
        toast('⚠️ Không tìm thấy Fanpage nào. Hãy kiểm tra lại quyền đăng nhập.');
      }
    } catch (e) {
      toast('❌ Lỗi đồng bộ: ' + e.message);
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = '🔄 Đồng bộ từ Facebook';
      }
    }
  }
  
  // ============================================================
  // TIKTOK REUP & GEMINI INTEGRATION
  // ============================================================

  // 1. Chuyển đổi tab con (Manual <-> Wizard)
  function switchPostTab(tabName) {
    // Reset active states
    document.querySelectorAll('.sub-tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.sub-tab-content').forEach(content => content.classList.remove('active'));
    
    if (tabName === 'manual') {
        // Tab 1: Manual
        const btnManual = document.querySelectorAll('.sub-tab-btn')[0];
        if(btnManual) btnManual.classList.add('active');
        
        const viewManual = document.getElementById('view-post-manual');
        if(viewManual) viewManual.classList.add('active');
        
    } else if (tabName === 'wizard') {
        // Tab 2: Wizard (Auto Sync)
        const btnWizard = document.querySelectorAll('.sub-tab-btn')[1];
        if(btnWizard) btnWizard.classList.add('active');
        
        const viewWizard = document.getElementById('view-post-wizard');
        if(viewWizard) {
            viewWizard.classList.add('active');
            // Khởi tạo Wizard nếu chưa chạy
            if(window.AutoSyncWizard && window.AutoSyncWizard.init) {
                // Chỉ init nếu chưa có data (tránh reset khi user đang làm dở)
                if(!window.AutoSyncWizard.jobData || !window.AutoSyncWizard.jobData.productId) {
                    window.AutoSyncWizard.init();
                }
            }
        }
    } else {
        console.warn('Unknown tab:', tabName);
    }
  }

  // 2. Gọi API Phân tích TikTok
  async function analyzeTikTokVideo() {
    const url = document.getElementById('tiktokUrl').value;
    if (!url) return toast('❌ Vui lòng nhập link TikTok!');

    const btn = document.getElementById('btnAnalyzeTikTok');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-sync fa-spin"></i> Đang xử lý...';
    document.getElementById('tiktokResultArea').style.display = 'none';

    try {
      const r = await Admin.req('/api/social-sync/submit', {
        method: 'POST',
        body: { tiktokUrl: url }
      });

      if (r && (r.ok || r.success)) {
        renderTikTokResult(r);
        // Lưu syncId để dùng cho bước đăng
        window._currentSyncId = r.syncId;
        toast('✅ Phân tích thành công!');
      } else {
        throw new Error(r.error || 'Lỗi xử lý từ server');
      }
    } catch (e) {
      toast('❌ Lỗi: ' + e.message);
      console.error(e);
    } finally {
      btn.disabled = false;
      btn.innerHTML = '<i class="fas fa-bolt"></i> GỌI API TEST';
    }
  }

  // 3. Test Gemini
  async function testGeminiConnection() {
    const btn = document.getElementById('btnCheckGemini');
    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Checking...';

    try {
        const r = await Admin.req('/api/social-sync/test-ai', { method: 'GET' });
        if (r && r.ok) {
            alert('✅ Gemini hoạt động tốt!\nAI trả lời: ' + r.msg);
        } else {
            alert('❌ Gemini lỗi: ' + (r.msg || 'Unknown error'));
        }
    } catch (e) {
        alert('❌ Lỗi kết nối: ' + e.message);
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalText;
    }
  }

  // 4. Render kết quả
  if (!window._globalAiContent) window._globalAiContent = {};
  
  function renderTikTokResult(data) {
    document.getElementById('tiktokResultArea').style.display = 'block';
    
    // Video
    const videoUrl = data.videoUrl || data.r2Url;
    if (videoUrl) {
        const video = document.getElementById('tiktokPreview');
        video.src = videoUrl;
        document.getElementById('tiktokDownloadLink').href = videoUrl;
        video.load();
    }
    if (data.fileSize) {
        document.getElementById('tiktokFileSize').innerText = `Size: ${(data.fileSize / 1024 / 1024).toFixed(2)} MB`;
    }

    // AI Content
    window._globalAiContent = data.contents || data.aiContent || {};
    window._currentAiVersion = 1; // Default version A
    switchAiTab('A');
  }

  function switchAiTab(ver) {
    ['A', 'B', 'C'].forEach(v => {
        const el = document.getElementById(`tabAi${v}`);
        if(el) el.classList.toggle('active', v === ver);
    });

    const mapVer = { 'A': 1, 'B': 2, 'C': 3 };
    window._currentAiVersion = mapVer[ver]; // Update selected version

    const key = `version${ver}`;
    const content = window._globalAiContent[key];
    
    if (content) {
        let text = content.caption || '';
        let tags = '';
        if (Array.isArray(content.hashtags)) tags = content.hashtags.join(' ');
        else tags = content.hashtags;
        
        document.getElementById('aiContentPreview').value = `${text}\n\n${tags}`;
    }
  }

  function loadFanpagesForTikTok() {
    const select = document.getElementById('tiktokTargetPage');
    if (!select || select.options.length > 1) return; 

    if (fanpagesCache && fanpagesCache.length > 0) {
        fanpagesCache.forEach(fp => {
            const opt = document.createElement('option');
            opt.value = fp.page_id;
            opt.textContent = fp.name || fp.page_name; // Support both field names
            select.appendChild(opt);
        });
    } else {
        // Try to load if cache empty
        loadFanpages().then(() => loadFanpagesForTikTok());
    }
  }

  // 5. Đăng lên Fanpage (CÔNG KHAI)
  async function publishTikTokToPage() {
    const pageId = document.getElementById('tiktokTargetPage').value;
    const syncId = window._currentSyncId;
    const version = window._currentAiVersion || 1;

    if (!syncId) return toast('❌ Vui lòng phân tích video trước!');
    if (!pageId) return toast('❌ Vui lòng chọn Fanpage!');

    const btn = document.getElementById('btnPublishTikTok');
    btn.disabled = true;
    btn.innerHTML = '⏳ Đang đăng...';

    try {
        const r = await Admin.req('/api/social-sync/publish', {
            method: 'POST',
            body: {
                syncId: syncId,
                pageId: pageId,
                selectedVersion: version,
                published: true // ✅ Cờ hiệu báo đăng công khai
            }
        });

        if (r && r.ok) {
            toast('✅ Đăng thành công!');
            if (r.postUrl) {
                window.open(r.postUrl, '_blank');
            } else {
                alert('Đăng thành công! Post ID: ' + r.postId);
            }
        } else {
            throw new Error(r.error || 'Đăng thất bại');
        }
    } catch (e) {
        toast('❌ Lỗi: ' + e.message);
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fab fa-facebook-f"></i> Đăng Ngay (Công Khai)';
    }
  }
  
  // ============================================================
// AUTO SYNC WIZARD LOGIC (New Module)
// ============================================================
const AutoSyncWizard = {
    currentStep: 1,
    jobData: {
        id: null, productId: null, videoUrl: null, variants: [], fanpages: []
    },

    init: function() {
        console.log('Wizard Init');
        this.loadProducts();
    },

    goToStep: function(step) {
        // UI Switching
        document.querySelectorAll('.wiz-content').forEach(el => el.classList.remove('active'));
        document.getElementById(`wiz-step-${step}`).classList.add('active');
        
        // Indicators
        for(let i=1; i<=5; i++) {
            const el = document.getElementById(`wiz-step-${i}-ind`);
            if(i < step) el.className = 'wizard-step completed';
            else if(i === step) el.className = 'wizard-step active';
            else el.className = 'wizard-step';
        }
        
        this.currentStep = step;
        
        // Logic Trigger
        if(step === 3 && this.jobData.variants.length === 0) this.generateVariants();
        if(step === 4) this.loadFanpages();
    },

    // STEP 1
    // STEP 1
    loadProducts: async function() {
        const grid = document.getElementById('wiz-product-grid');
        if (!grid) return;
        
        grid.innerHTML = '<div class="loading">⏳ Đang tải danh sách sản phẩm...</div>';
        
        try {
            // 1. Đổi API endpoint về chuẩn '/admin/products' và thêm limit
            const r = await Admin.req('/admin/products?limit=100', { method: 'GET' });
            
            console.log('[Wizard] Products Response:', r); // Log để debug

            // 2. Kiểm tra dữ liệu linh hoạt (chấp nhận cả r.products, r.data, r.items hoặc r.results)
            const list = r.products || r.data || r.items || r.results || [];

            if(r.ok && list.length > 0) {
                this.productsCache = list; // Lưu cache để filter
                this.renderProducts(list);
            } else {
                grid.innerHTML = '<div style="text-align:center; padding:20px; color:#666;">Không tìm thấy sản phẩm nào.</div>';
            }
        } catch(e) { 
            console.error(e);
            grid.innerHTML = `<div style="color:red; text-align:center; padding:20px;">Lỗi tải sản phẩm: ${e.message}</div>`; 
        }
    },

    renderProducts: function(list) {
        const grid = document.getElementById('wiz-product-grid');
        grid.innerHTML = list.map(p => {
            // 1. Xử lý ảnh: Hỗ trợ cả dạng mảng và dạng chuỗi JSON từ Database
            let img = '/placeholder.jpg';
            if (p.images) {
                try {
                    const parsed = typeof p.images === 'string' ? JSON.parse(p.images) : p.images;
                    if (parsed && parsed.length > 0) img = parsed[0];
                } catch (e) { img = p.images; }
            }

            // 2. Xử lý tên: Ưu tiên 'title' (theo DB), backup 'name'
            const title = p.title || p.name || 'Sản phẩm chưa đặt tên';

            // 3. Xử lý giá
            const price = p.variants?.[0]?.price || p.price || 0;

            return `
                <div class="wiz-card" onclick="AutoSyncWizard.selectProduct('${p.id}', this)">
                    <img src="${img}">
                    <div style="font-weight:bold; font-size:13px; margin-top:5px; height:36px; overflow:hidden;">${title}</div>
                    <div style="color:#dc2626; font-size:12px;">${new Intl.NumberFormat('vi-VN').format(price)}đ</div>
                </div>
            `;
        }).join('');
    },

    filterProducts: function(keyword) {
        if(!this.productsCache) return;
        const filtered = this.productsCache.filter(p => p.name.toLowerCase().includes(keyword.toLowerCase()));
        this.renderProducts(filtered);
    },

    selectProduct: function(id, el) {
        this.jobData.productId = id;
        document.querySelectorAll('.wiz-card').forEach(c => c.classList.remove('selected'));
        el.classList.add('selected');
        document.getElementById('wiz-btn-step1').disabled = false;
    },

    // STEP 2
    processVideo: async function() {
        const url = document.getElementById('wiz-tiktokUrl').value;
        if(!url) return alert('Nhập link TikTok!');
        
        const btn = document.getElementById('wiz-btn-download');
        btn.disabled = true; btn.innerHTML = '⏳ Đang xử lý...';
        
        try {
            const r = await Admin.req('/api/auto-sync/jobs/create', {
                method: 'POST',
                body: { productId: this.jobData.productId, tiktokUrl: url }
            });
            
            if(r.ok) {
                this.jobData.id = r.jobId;
                this.jobData.videoUrl = r.videoUrl;
                
                const vid = document.getElementById('wiz-player');
                vid.src = r.videoUrl;
                document.getElementById('wiz-video-preview').style.display = 'block';
                document.getElementById('wiz-btn-step2').disabled = false;
            } else { alert(r.error); }
        } catch(e) { alert(e.message); }
        finally { btn.disabled = false; btn.innerHTML = '⬇️ Tải & Phân tích'; }
    },

    // STEP 3
    generateVariants: async function(force = false) {
        if(!force && this.jobData.variants.length > 0) return;
        
        document.getElementById('wiz-ai-loading').classList.remove('hidden');
        document.getElementById('wiz-ai-area').classList.add('hidden');
        
        try {
            const r = await Admin.req(`/api/auto-sync/jobs/${this.jobData.id}/generate-variants`, { method: 'POST' });
            if(r.ok) {
                this.jobData.variants = r.variants;
                this.renderVariants();
            }
        } catch(e) { alert(e.message); }
        finally {
            document.getElementById('wiz-ai-loading').classList.add('hidden');
            document.getElementById('wiz-ai-area').classList.remove('hidden');
        }
    },

    renderVariants: function() {
        const tabs = document.getElementById('wiz-ai-tabs');
        tabs.innerHTML = this.jobData.variants.map((v, i) => 
            `<div class="ai-tab ${i===0?'active':''}" onclick="AutoSyncWizard.switchVariant(${i}, this)">Version ${v.version} (${v.tone})</div>`
        ).join('');
        this.switchVariant(0, tabs.children[0]);
    },

    switchVariant: function(index, el) {
        document.querySelectorAll('.ai-tab').forEach(t => t.classList.remove('active'));
        if(el) el.classList.add('active');
        
        const v = this.jobData.variants[index];
        const captionEdit = document.getElementById('wiz-caption-edit');
        if (captionEdit) captionEdit.value = v.caption;
        
        let tags = v.hashtags;
        if(typeof tags === 'string') try { tags = JSON.parse(tags); } catch(e){}
        const hashtagsEl = document.getElementById('wiz-hashtags');
        const toneBadgeEl = document.getElementById('wiz-tone-badge');
        if (hashtagsEl) hashtagsEl.innerText = Array.isArray(tags) ? tags.join(' ') : tags;
        if (toneBadgeEl) toneBadgeEl.innerText = v.tone.toUpperCase();
        
        // Update logic: khi edit caption, cần lưu lại vào mảng variants
        document.getElementById('wiz-caption-edit').onchange = (e) => {
            this.jobData.variants[index].caption = e.target.value;
        };
    },

    // STEP 4
    loadFanpages: async function() {
        const tbody = document.getElementById('wiz-fanpage-list');
        tbody.innerHTML = '<tr><td colspan="3">Loading...</td></tr>';
        
        try {
            // Reuse existing fanpage loader
            const r = await Admin.req('/admin/fanpages', { method: 'GET' });
            const pages = r.items || [];
            
            if(pages.length === 0) {
                tbody.innerHTML = '<tr><td colspan="3">Chưa có Fanpage.</td></tr>';
                return;
            }

            // Auto assign variants round-robin
            const variants = this.jobData.variants;
            
            tbody.innerHTML = pages.map((p, i) => {
                const vIndex = i % variants.length;
                const opts = variants.map((v, vi) => 
                    `<option value="${v.id}" ${vi===vIndex ? 'selected':''}>Version ${v.version} (${v.tone})</option>`
                ).join('');
                
                return `
                    <tr>
                        <td>${p.name}</td>
                        <td><select class="wiz-assign-select input" data-page="${p.page_id}">${opts}</select></td>
                        <td class="text-center"><input type="checkbox" class="wiz-assign-check" data-page="${p.page_id}" checked></td>
                    </tr>
                `;
            }).join('');
        } catch(e) { tbody.innerHTML = 'Error loading pages'; }
    },

    bulkPublish: async function() {
        const assignments = [];
        document.querySelectorAll('.wiz-assign-check:checked').forEach(cb => {
            const pageId = cb.dataset.page;
            const vId = document.querySelector(`.wiz-assign-select[data-page="${pageId}"]`).value;
            assignments.push({ fanpageId: pageId, variantId: parseInt(vId) });
        });

        if(assignments.length === 0) return alert('Chọn ít nhất 1 page!');
        
        const btn = document.getElementById('wiz-btn-publish');
        btn.disabled = true; btn.innerHTML = '⏳ Đang đăng...';

        try {
            // 1. Save Assign
            await Admin.req(`/api/auto-sync/jobs/${this.jobData.id}/assign-fanpages`, {
                method: 'POST',
                body: { assignments }
            });
            
            // 2. Publish
            const r = await Admin.req(`/api/auto-sync/jobs/${this.jobData.id}/publish`, { method: 'POST' });
            if(r.ok) {
                this.renderResults(r.results);
                this.goToStep(5);
            } else { alert(r.error); }
        } catch(e) { alert(e.message); }
        finally { btn.disabled = false; btn.innerHTML = '🚀 Đăng bài ngay'; }
    },

    // STEP 5
    renderResults: function(results) {
        const div = document.getElementById('wiz-results');
        div.innerHTML = results.map(r => `
            <div style="display:flex; justify-content:space-between; padding:10px; border:1px solid #eee; margin-bottom:5px; border-radius:6px;">
                <span>${r.fanpageName}</span>
                ${r.success 
                    ? `<a href="${r.postUrl}" target="_blank" style="color:green; font-weight:bold;">✅ Thành công</a>` 
                    : `<span style="color:red;">❌ ${r.error}</span>`}
            </div>
        `).join('');
        
        // Auto-fill campaign name
        document.getElementById('wiz-camp-name').value = `Ads Job #${this.jobData.id} - ${new Date().toLocaleDateString('vi-VN')}`;
    },

    createAds: async function() {
        const name = document.getElementById('wiz-camp-name').value;
        const budget = document.getElementById('wiz-budget').value;
        
        try {
            const r = await Admin.req(`/api/auto-sync/jobs/${this.jobData.id}/create-ads`, {
                method: 'POST',
                body: { campaignName: name, dailyBudget: parseInt(budget) }
            });
            if(r.ok) alert(r.message);
            else alert(r.error);
        } catch(e) { alert(e.message); }
    }
};

// Export to global
window.AutoSyncWizard = AutoSyncWizard;

 // ============================================================
  // EXPORT PUBLIC API
  // ============================================================

  window.FacebookAds = {
    syncFanpages,
    _initialized: false,
    init: function() {
      if (this._initialized) { console.log('[FB Ads] Skipping re-init'); return; }
      this._initialized = true;
      init();
    },
    testConnection,
    loginFacebook,
    checkTokenInfo,
    revokeToken,
    loadCampaigns,
    loadProducts,
    createCampaign,
    toggleCampaign,
    deleteCampaign,
    getCampaignStats,
    loadSettings,
    saveSettings,
    loadFanpages,
    addFanpage,
    deleteFanpage,
    setDefaultFanpage,
    loadTokenStatusWidget,
    dismissTokenWidget,

    // ✅ CÁC HÀM MỚI CHO TIKTOK
    switchPostTab,
    analyzeTikTokVideo,
    testGeminiConnection,
    switchAiTab,
    publishTikTokToPage
  };

  // Auto-init on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    // Delay init để đảm bảo DOM sẵn sàng
    setTimeout(init, 100);
  }

})();

// Force init nếu window load xong
window.addEventListener('load', function() {
  if (!window.FacebookAds._initialized) {
    console.log('[FB Ads] Force re-init on window load');
    window.FacebookAds.init();
  }
});

console.log('✅ ads_real.js loaded');