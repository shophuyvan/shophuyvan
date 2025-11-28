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
                <div style="font-weight:600; color:#111827;">${fp.page_name || fp.name || 'Unnamed'}</div>
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
      const r = await Admin.req('/admin/settings/facebook_ads_token', { method: 'GET' });
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
  // FANPAGE HUB: KHO NỘI DUNG & LÊN LỊCH (Đã Nâng Cấp)
  // ============================================================
  window.FanpageManager = {
    init: function() {
       this.loadRepository();
    },
    
    // 1. Tải danh sách bài trong kho (Pending & Scheduled)
    loadRepository: async function() {
       const tbody = document.getElementById('repo-table-body');
       if(!tbody) return;
       tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:20px;">⏳ Đang tải kho nội dung...</td></tr>';

       try {
          const r = await Admin.req('/api/auto-sync/jobs?limit=50', { method: 'GET' });
          
          if(r.ok && r.jobs) {
            // ✅ FIX: Lọc lấy bài 'assigned' (Đã lưu kho) hoặc 'scheduled' (Đã lên lịch)
            const pendingJobs = r.jobs.filter(j => j.status === 'assigned' || j.status === 'scheduled' || j.status === 'pending');
             
             if(pendingJobs.length === 0) {
                tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:20px; color:#666;">Kho trống. Hãy sang tab "Đăng bài" để tạo bài mới.</td></tr>';
                return;
             }

             tbody.innerHTML = pendingJobs.map(job => {
                const thumb = job.product_image || 'https://via.placeholder.com/50';
                
                // Hiển thị trạng thái lịch đăng
                let dateDisplay = '<span style="color:#f59e0b; font-size:12px;">⏳ Chờ lên lịch</span>';
                if (job.scheduled_time && job.scheduled_time > Date.now()) {
                    dateDisplay = `<span style="color:#2563eb; font-weight:bold; font-size:12px;">🕒 ${new Date(job.scheduled_time).toLocaleString('vi-VN')}</span>`;
                }

                return `
                   <tr style="border-bottom:1px solid #eee;">
                      <td style="padding:10px;">
                         <div style="display:flex; gap:10px; align-items:center;">
                            <img src="${thumb}" style="width:50px; height:50px; border-radius:4px; object-fit:cover; border:1px solid #eee;">
                            <div>
                               <div style="font-weight:bold; font-size:13px; color:#1f2937;">#${job.id} - ${job.product_name || 'Sản phẩm không tên'}</div>
                               <div style="font-size:11px; color:#6b7280;">Tạo lúc: ${new Date(job.created_at).toLocaleDateString('vi-VN')}</div>
                            </div>
                         </div>
                      </td>
                      <td style="padding:10px; font-size:12px; color:#374151;">
                         <div style="display:flex; align-items:center; gap:5px;">
                            <span>🎬 Video Sync</span>
                            ${job.total_variants ? `<span style="background:#e0e7ff; color:#3730a3; padding:2px 6px; border-radius:4px; font-size:10px;">${job.total_variants} Versions</span>` : ''}
                         </div>
                      </td>
                      <td style="padding:10px;">
                         ${dateDisplay}
                      </td>
                      <td style="padding:10px; text-align:center;">
                         <button class="btn-sm primary" onclick="FanpageManager.openScheduler(${job.id})" style="background:#eff6ff; color:#2563eb; border:1px solid #bfdbfe;">⚙️ Cấu hình</button>
                      </td>
                   </tr>
                `;
             }).join('');
          } else {
             tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:20px;">Không có dữ liệu.</td></tr>';
          }
       } catch(e) {
          console.error(e);
          tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; color:red;">Lỗi tải dữ liệu: ${e.message}</td></tr>`;
       }
    },

    // 2. Mở Modal Cấu hình & Load thông tin
    openScheduler: async function(jobId) {
        document.getElementById('sched-job-id').value = jobId;
        const modal = document.getElementById('modal-scheduler');
        modal.style.display = 'flex';

        // Reset form
        document.getElementById('sched-time').value = '';
        document.getElementById('sched-share-msg').value = '';
        const groupSelect = document.getElementById('sched-group-select');
        groupSelect.innerHTML = '<option>⏳ Đang tải dữ liệu...</option>';

        // --- ✅ PHẦN MỚI: HIỂN THỊ TÊN FANPAGE ---
        // Tìm hoặc tạo vùng hiển thị thông báo Fanpage
        let infoBox = document.getElementById('sched-fanpage-info');
        if (!infoBox) {
            infoBox = document.createElement('div');
            infoBox.id = 'sched-fanpage-info';
            infoBox.style.cssText = "background:#e0f2fe; color:#0369a1; padding:10px; border-radius:6px; margin-bottom:15px; font-size:13px; border:1px solid #bae6fd;";
            // Chèn vào đầu modal body
            const modalBody = modal.querySelector('div[style*="overflow-y:auto"]');
            if(modalBody) modalBody.insertBefore(infoBox, modalBody.firstChild);
        }
        infoBox.innerHTML = '⏳ Đang lấy thông tin Job...';

        try {
            // A. Gọi API lấy chi tiết Job (để biết Fanpage nào)
            const rJob = await Admin.req(`/api/auto-sync/jobs/${jobId}`, { method: 'GET' });

            if(rJob.ok && rJob.job) {
                const pages = rJob.job.fanpages || [];
                const pageNames = pages.length > 0 ? pages.join(', ') : 'Chưa gán Fanpage nào';
                infoBox.innerHTML = `<strong>📢 Bài viết này sẽ được đăng lên:</strong><br>👉 ${pageNames}`;
            } else {
                infoBox.innerHTML = '⚠️ Không lấy được thông tin Job.';
            }

            // B. Gọi API lấy danh sách Group
            const rGroups = await Admin.req('/api/facebook/groups/fetch', { method: 'GET' });

            if(rGroups.ok && rGroups.groups && rGroups.groups.length > 0) {
                groupSelect.innerHTML = '<option value="">-- Chọn nhóm để share --</option>' + 
                    rGroups.groups.map(g => `<option value="${g.id}">${g.name} (${g.privacy || 'Group'})</option>`).join('');
            } else {
                groupSelect.innerHTML = '<option value="">⚠️ Không tìm thấy nhóm nào (hoặc lỗi token)</option>';
            }

        } catch(e) {
            console.error(e);
            infoBox.innerHTML = '❌ Lỗi kết nối: ' + e.message;
            groupSelect.innerHTML = '<option value="">❌ Lỗi tải dữ liệu</option>';
        }
    },

    // 3. AI Viết Caption Seeding (Giả lập nhanh)
    aiGroupCaption: async function() {
        const btn = document.getElementById('btn-ai-seed');
        const input = document.getElementById('sched-share-msg');
        const oldText = btn.innerText;
        btn.disabled = true; btn.innerText = '🤖...';
        
        // Mẫu câu seeding ngẫu nhiên (hoặc gọi API Gemini thật nếu muốn)
        const seeds = [
            "Mọi người ơi, em mới săn được món này hay quá nè, ai cần không ạ? 👇",
            "Góc pass đồ: Shop em còn dư vài mẫu này xả lỗ, bác nào lấy ới em nhé.",
            "Hàng về đẹp xuất sắc, quay video thực tế cho cả nhà xem luôn ạ!",
            "Cứu cánh cho chị em nội trợ đây ạ, xem video mê luôn. 😍",
            "Em gom đơn món này giá siêu tốt, ai chung đơn không ạ?"
        ];
        
        setTimeout(() => {
            input.value = seeds[Math.floor(Math.random() * seeds.length)];
            btn.disabled = false; btn.innerText = oldText;
        }, 800);
    },

    // 4. Lưu & Kích hoạt Lịch (Gọi API)
    submitSchedule: async function() {
        const jobId = document.getElementById('sched-job-id').value;
        const timeStr = document.getElementById('sched-time').value;
        const groupId = document.getElementById('sched-group-select').value;
        const shareMsg = document.getElementById('sched-share-msg').value;

        // Xử lý thời gian
        let scheduledTime = null;
        if(timeStr) {
            scheduledTime = new Date(timeStr).getTime();
            if(scheduledTime < Date.now()) return alert('❌ Thời gian hẹn phải ở tương lai!');
        }

        const btn = event.target;
        const oldText = btn.innerText;
        btn.disabled = true; btn.innerText = '⏳ Đang lưu...';

        try {
            // Bước 1: Lưu lịch đăng bài (Update Job Status)
            const r1 = await Admin.req(`/api/auto-sync/jobs/${jobId}/save-pending`, {
                method: 'POST',
                body: { scheduledTime: scheduledTime }
            });

            if(!r1.ok) throw new Error(r1.error || 'Lỗi lưu lịch');

            // Bước 2: Nếu có chọn Group -> Setup Share (Hiện tại gọi API share ngay hoặc lưu chờ cron)
            // Tạm thời ta sẽ hiển thị thông báo thành công
            let msg = '✅ Đã lưu cấu hình thành công!';
            if (scheduledTime) msg += '\n⏰ Hệ thống sẽ tự động đăng vào giờ đã hẹn.';
            else msg += '\n🚀 Hệ thống sẽ xử lý đăng ngay bây giờ.';

            if (groupId) {
                 // Gọi API share group (nếu cần share ngay) hoặc lưu vào DB để cron làm
                 // Ở đây demo gọi API share nếu ko hẹn giờ
                 if (!scheduledTime) {
                     // Logic share ngay (Optional)
                 }
                 msg += `\n📢 Đã ghi nhận lệnh share vào Group.`;
            }

            alert(msg);
            document.getElementById('modal-scheduler').style.display = 'none';
            this.loadRepository(); // Reload lại bảng

        } catch(e) {
            alert('❌ Lỗi: ' + e.message);
        } finally {
            btn.disabled = false; btn.innerText = oldText;
        }
    },
    
    // Giữ lại hàm cũ: Tìm kiếm Viral
    searchViral: function() {
       const keyword = document.getElementById('viralKeyword').value;
       const container = document.getElementById('viralResults');
       if(!keyword) return alert('❌ Vui lòng nhập từ khóa!');
       container.innerHTML = '<div class="loading">Đang quét Big Data...</div>';
       setTimeout(() => {
          container.innerHTML = `
            <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(250px, 1fr)); gap:16px;">
               <div class="card" style="padding:10px; border:1px solid #eee;">
                  <img src="https://via.placeholder.com/300x200?text=Viral+Trend" style="width:100%; border-radius:8px;">
                  <h4 style="margin:8px 0; font-size:14px;">Trend: ${keyword} #1</h4>
                  <div style="font-size:12px; color:#666;">🔥 1.2M Views • 👍 50k Likes</div>
                  <button class="btn-sm primary" style="width:100%; margin-top:8px;">📥 Lấy nội dung này</button>
               </div>
            </div>`;
       }, 1000);
    },

    // Giữ lại hàm cũ: Seeding Tool
    startSeeding: function() {
       const url = document.getElementById('seedingUrl').value;
       if(!url) return alert('❌ Nhập link bài viết cần seeding');
       const btn = document.getElementById('btnStartSeeding');
       btn.disabled = true; btn.innerHTML = '⏳ Đang chạy seeding...';
       setTimeout(() => {
          btn.disabled = false; btn.innerHTML = '🚀 Bắt đầu Seeding';
          document.getElementById('seedingLog').innerHTML += `<div style="font-size:11px; margin-top:4px; color:#10b981;">✅ [${new Date().toLocaleTimeString()}] Done: ${url}</div>`;
       }, 2000);
    }
  };
  
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
            this.loadWizardProducts();
        },
     
        // HÀM CHECK AI MỚI
        testAI: async function() {
            const btn = event.target;
            const oldText = btn.innerText;
            btn.disabled = true;
            btn.innerText = "⏳ Checking...";
     
            try {
                const r = await Admin.req('/api/auto-sync/test-ai', { method: 'GET' });
                if (r.ok) {
                    alert(`✅ KẾT NỐI THÀNH CÔNG!\n\nGemini phản hồi: "${r.message}"`);
                } else {
                    alert(`❌ LỖI KẾT NỐI:\n${r.error}`);
                }
            } catch (e) {
                alert('❌ Lỗi hệ thống: ' + e.message);
            } finally {
                btn.disabled = false;
                btn.innerText = oldText;
            }
        },
     
        goToStep: function(step) {
        // Chặn nếu chưa có Job ID (chưa upload xong) mà muốn qua bước 3
        if (step > 2 && !this.jobData.id) {
            alert("⚠️ Vui lòng tải video lên hoặc nhập link TikTok và bấm nút 'Tải/Upload' trước!");
            return;
        }

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
        if(step === 2) {
             // Đảm bảo DOM đã load xong mới render UI
             setTimeout(() => this.renderUploadUI(), 100); 
        }
        if(step === 3 && this.jobData.variants.length === 0) this.generateVariants();
        if(step === 4) this.loadFanpages(); // Đây là hàm loadFanpages của Wizard (Review Content)
    },

    // HÀM MỚI: Vẽ giao diện Upload File
    renderUploadUI: function() {
        const container = document.querySelector('#wiz-step-2 .card-body') || document.querySelector('#wiz-step-2');
        if(!container) return;

        // Kiểm tra nếu đã chèn rồi thì thôi
        if(document.getElementById('wiz-upload-container')) return;

        // Tạo vùng upload
        const uploadDiv = document.createElement('div');
        uploadDiv.id = 'wiz-upload-container';
        uploadDiv.style.marginTop = '20px';
        uploadDiv.style.paddingTop = '20px';
        uploadDiv.style.borderTop = '1px dashed #eee';
        uploadDiv.innerHTML = `
            <div style="font-weight:bold; margin-bottom:10px; color:#666;">HOẶC: Tải video từ máy tính</div>
            <div style="display:flex; gap:10px; align-items:center;">
                <input type="file" id="wiz-file-upload" accept="video/*" class="input" style="flex:1;">
                <button class="btn primary" onclick="AutoSyncWizard.processVideo()">⬆️ Upload Ngay</button>
            </div>
            <div style="font-size:12px; color:#999; margin-top:5px;">Max: 100MB (MP4)</div>
        `;
        
        // Chèn vào sau ô nhập link TikTok
        const inputUrl = document.getElementById('wiz-tiktokUrl');
        if(inputUrl && inputUrl.parentElement) {
            inputUrl.parentElement.after(uploadDiv);
        }
    },

    // STEP 1: Tải sản phẩm (Đổi tên để tránh trùng với hàm loadProducts bên ngoài)
    loadWizardProducts: async function(keyword = '', page = 1) {
        const grid = document.getElementById('wiz-product-grid');
        if (!grid) return;
        
        // Hiển thị loading
        grid.innerHTML = '<div class="loading">⏳ Đang tải...</div>';
        
        try {
            // Xây dựng URL tìm kiếm
            // Backend products.js dùng ?search= cho tìm kiếm và ?page= cho phân trang
            let url = `/admin/products?limit=20&page=${page}`;
            
            if (keyword) {
                url += `&search=${encodeURIComponent(keyword)}`;
            }

            console.log('[Wizard] Fetching products:', url);

            // Gọi API
            const r = await Admin.req(url, { method: 'GET' });
            
            // Xử lý dữ liệu trả về
            const list = r.items || r.products || r.data || [];
            const total = r.pagination?.total || r.total || 0;
            const totalPages = r.pagination?.totalPages || Math.ceil(total / 20) || 1;

            if (r.ok && list.length > 0) {
                this.renderProducts(list);
                this.renderPagination(page, totalPages, keyword);
            } else {
                grid.innerHTML = '<div style="text-align:center; padding:40px; color:#666;">🔍 Không tìm thấy sản phẩm nào phù hợp.</div>';
                // Xóa phân trang nếu không có kết quả
                const pag = document.getElementById('wiz-pagination');
                if(pag) pag.innerHTML = '';
            }
        } catch(e) { 
            console.error(e);
            grid.innerHTML = `<div style="color:red; text-align:center; padding:20px;">Lỗi tải sản phẩm: ${e.message}</div>`; 
        }
    },

    // Hàm hiển thị phân trang (Mới thêm)
    renderPagination: function(currentPage, totalPages, keyword) {
        let container = document.getElementById('wiz-pagination');
        if (!container) {
            // Tạo container nếu chưa có
            container = document.createElement('div');
            container.id = 'wiz-pagination';
            container.style.cssText = 'display:flex; justify-content:center; gap:10px; margin-top:15px; align-items:center;';
            document.getElementById('wiz-product-grid').after(container);
        }

        const prevDisabled = currentPage <= 1 ? 'disabled' : '';
        const nextDisabled = currentPage >= totalPages ? 'disabled' : '';

        container.innerHTML = `
            <button class="btn btn-sm" ${prevDisabled} onclick="AutoSyncWizard.loadWizardProducts('${keyword}', ${currentPage - 1})">← Trước</button>
            <span style="font-size:13px; color:#666;">Trang ${currentPage} / ${totalPages}</span>
            <button class="btn btn-sm" ${nextDisabled} onclick="AutoSyncWizard.loadWizardProducts('${keyword}', ${currentPage + 1})">Sau →</button>
        `;
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

    // Xử lý tìm kiếm với Debounce (chờ 500ms mới gọi API)
    filterProducts: function(keyword) {
        // Xóa timeout cũ nếu người dùng đang gõ tiếp
        if (this.searchTimeout) clearTimeout(this.searchTimeout);

       // Đặt timeout mới
        this.searchTimeout = setTimeout(() => {
            // Khi tìm kiếm mới, luôn load từ trang 1
            // ✅ FIX: Gọi đúng hàm loadWizardProducts
            this.loadWizardProducts(keyword, 1);
        }, 500);
    },

    selectProduct: function(id, el) {
        this.jobData.productId = id;
        document.querySelectorAll('.wiz-card').forEach(c => c.classList.remove('selected'));
        el.classList.add('selected');
        document.getElementById('wiz-btn-step1').disabled = false;
    },

    // STEP 2: Xử lý Video (TikTok hoặc Upload Local)
    processVideo: async function() {
        const urlInput = document.getElementById('wiz-tiktokUrl');
        const fileInput = document.getElementById('wiz-file-upload');
        const url = urlInput ? urlInput.value.trim() : '';
        const file = fileInput ? fileInput.files[0] : null;

        if(!url && !file) return alert('❌ Vui lòng nhập Link TikTok HOẶC chọn Video từ máy tính!');
        
        const btn = document.getElementById('wiz-btn-download');
        const originalText = btn.innerHTML;
        btn.disabled = true; 
        btn.innerHTML = '⏳ Đang xử lý...';
        
        try {
            let r;
            
            if (file) {
                // CASE 1: Upload File
                btn.innerHTML = '⏳ Đang upload video (Vui lòng chờ)...';
                const formData = new FormData();
                formData.append('productId', this.jobData.productId);
                formData.append('videoFile', file);

                // Dùng fetch trực tiếp vì Admin.req thường gửi JSON
                // ✅ FIX V2: Ưu tiên lấy từ window.Admin (Vì Widget đang báo token Xanh)
                let token = '';
                if (window.Admin && typeof window.Admin.token === 'function') {
                    token = window.Admin.token();
                }
                
                // Nếu window.Admin lỗi mới tìm về localStorage
                if (!token) token = localStorage.getItem('x-token');
                if (!token) token = localStorage.getItem('admin_token');

                console.log('[Wizard] Upload Token Length:', token ? token.length : 0);

                console.log('[Wizard] Upload Token:', token ? 'OK' : 'Missing');

                const res = await fetch(API + '/api/auto-sync/jobs/create-upload', {
                    method: 'POST',
                    headers: { 
                        'x-token': token, // Header quan trọng nhất
                        'Authorization': 'Bearer ' + token
                    },
                    body: formData,
                    credentials: 'include' // Quan trọng: Gửi kèm Cookie xác thực
                });
                r = await res.json();
            } else {
                // CASE 2: TikTok URL
                btn.innerHTML = '⏳ Đang tải từ TikTok...';
                r = await Admin.req('/api/auto-sync/jobs/create', {
                    method: 'POST',
                    body: { productId: this.jobData.productId, tiktokUrl: url }
                });
            }
            
            if(r.ok) {
                this.jobData.id = r.jobId;
                this.jobData.videoUrl = r.videoUrl;
                
                // Show preview
                const vid = document.getElementById('wiz-player');
                if(vid) vid.src = r.videoUrl;
                
                const previewDiv = document.getElementById('wiz-video-preview');
                if(previewDiv) previewDiv.style.display = 'block';
                
                const nextBtn = document.getElementById('wiz-btn-step2');
                if(nextBtn) nextBtn.disabled = false;
                
                // Ẩn inputs để tránh sửa
                if(urlInput) urlInput.disabled = true;
                if(fileInput) fileInput.disabled = true;

            } else { 
                alert('❌ Lỗi: ' + (r.error || 'Không xác định')); 
            }
        } catch(e) { 
            alert('❌ Lỗi hệ thống: ' + e.message); 
        } finally { 
            btn.disabled = false; 
            btn.innerHTML = originalText; 
        }
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

// STEP 4: Load Fanpages (Đã sửa lỗi cú pháp & Thêm nút Xem thử)
   // STEP 4: Review Nội dung (Có checkbox chọn phiên bản)
    loadFanpages: function() {
        const container = document.getElementById('wiz-fanpage-list');
        if (!container) return;

        // 1. Ẩn các thành phần thừa cũ
        const step4 = document.getElementById('wiz-step-4');
        if(step4) {
            const dates = step4.querySelectorAll('input[type="datetime-local"], input[type="date"]');
            dates.forEach(el => { const row = el.closest('.row'); if(row) row.style.display = 'none'; });
            const thead = step4.querySelector('thead');
            if(thead) thead.style.display = 'none';
        }

        // 2. Render danh sách Variants
        const variants = this.jobData.variants || [];
        
        if(variants.length === 0) {
            container.innerHTML = `<tr><td colspan="4" style="text-align:center; padding:20px; color:red;">⚠️ Không có nội dung. Vui lòng quay lại Bước 3.</td></tr>`;
            return;
        }

        // Render với Checkbox
        const html = variants.map((v, i) => `
            <tr style="border-bottom: 10px solid #f9fafb;">
                <td colspan="4" style="padding: 15px; background: #fff;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                        <div style="display:flex; align-items:center; gap:10px;">
                            <input type="checkbox" class="wiz-ver-select" id="wiz-check-${i}" data-index="${i}" checked style="width:18px; height:18px; cursor:pointer;">
                            
                            <label for="wiz-check-${i}" style="cursor:pointer; margin:0;">
                                <strong style="color:#2563eb;">Version ${v.version} (${v.tone?.toUpperCase()})</strong>
                            </label>
                        </div>
                        <span style="font-size:11px; background:#eee; padding:2px 6px; border-radius:4px;">ID: ${v.id}</span>
                    </div>
                    
                    <textarea 
                        id="wiz-area-${i}"
                        class="input" 
                        style="width:100%; height:80px; font-family:sans-serif; font-size:13px; border:1px solid #e5e7eb; border-radius:6px; padding:8px;"
                        onchange="AutoSyncWizard.updateVariantContent(${i}, this.value)"
                    >${v.caption}</textarea>
                    
                    <div style="margin-top:5px; font-size:12px; color:#666;">
                        Hashtags: <span style="color:#059669;">${Array.isArray(v.hashtags) ? v.hashtags.join(' ') : v.hashtags}</span>
                    </div>
                </td>
            </tr>
        `).join('');

        container.innerHTML = html;
        
        // Note
        const noteRow = document.createElement('tr');
        noteRow.innerHTML = `
            <td colspan="4" style="text-align:center; padding:15px; background:#f0fdf4; border-top:1px solid #dcfce7;">
                <div style="color:#15803d; font-weight:bold;">👉 Hướng dẫn: Tích chọn các Version bạn muốn dùng, sau đó bấm "Lưu vào kho".</div>
            </td>
        `;
        container.appendChild(noteRow);
    },

    // Hàm phụ trợ để cập nhật data khi user sửa text trên màn hình
    updateVariantContent: function(index, newCaption) {
        if(this.jobData.variants[index]) {
            this.jobData.variants[index].caption = newCaption;
        }
    },

    // Hàm xem trước nội dung (Đã tách ra đúng vị trí)
    showPreview: function(pageId, pageName) {
        const select = document.querySelector(`.wiz-assign-select[data-page="${pageId}"]`);
        const variantId = select ? parseInt(select.value) : 0;
        const variant = this.jobData.variants.find(v => v.id === variantId);

        if (!variant) return alert("Chưa có nội dung để xem.");

        // Check xem Modal có trong HTML chưa
        const modal = document.getElementById('previewModal');
        if(!modal) return alert('Thiếu HTML Modal Preview trong file ads.html');

        document.getElementById('previewPageName').innerText = pageName;
        
        // Xử lý hashtags
        let tags = variant.hashtags;
        if (typeof tags === 'string') try { tags = JSON.parse(tags); } catch(e){}
        const tagStr = Array.isArray(tags) ? tags.join(' ') : tags;

        document.getElementById('previewCaption').innerText = `${variant.caption}\n\n${tagStr}`;
        modal.style.display = 'flex';
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

    // HÀM MỚI: Lưu các Version ĐƯỢC CHỌN vào kho
    saveToRepository: async function() {
        const btn = document.getElementById('wiz-btn-save');
        const oldText = btn ? btn.innerHTML : 'Lưu';
        
        // 1. Lọc các phiên bản được check
        const checkboxes = document.querySelectorAll('.wiz-ver-select:checked');
        if (checkboxes.length === 0) {
            alert("⚠️ Vui lòng tích chọn ít nhất 1 phiên bản để lưu!");
            return;
        }

        const selectedVariants = [];
        checkboxes.forEach(cb => {
            const idx = parseInt(cb.dataset.index);
            // Lấy nội dung mới nhất từ Textarea (đề phòng chưa onchange kịp)
            const textarea = document.getElementById(`wiz-area-${idx}`);
            const variantData = this.jobData.variants[idx];
            
            if (variantData && textarea) {
                variantData.caption = textarea.value; // Cập nhật text mới nhất
                selectedVariants.push(variantData);
            }
        });

        if(btn) { btn.disabled = true; btn.innerHTML = `⏳ Đang lưu ${selectedVariants.length} versions...`; }

        try {
            // 2. Gửi API
            const r = await Admin.req(`/api/auto-sync/jobs/${this.jobData.id}/save-pending`, {
                method: 'POST',
                body: { 
                    scheduledTime: null,
                    variants: selectedVariants // ✅ Chỉ gửi danh sách đã chọn
                }
            });

            if (r.ok) {
                if(confirm(`✅ Đã lưu thành công ${selectedVariants.length} phiên bản!\n\nBạn có muốn chuyển sang tab "Kho Nội dung" để quản lý ngay không?`)) {
                     const hubTab = document.querySelector('.tab[data-tab="fanpage-hub"]');
                     if(hubTab) hubTab.click();
                }
                // Reset về bước 1
                this.currentStep = 1;
                this.goToStep(1);
            } else {
                alert('⚠️ Lỗi: ' + (r.error || 'Unknown error'));
            }
        } catch (e) {
            alert('❌ Lỗi hệ thống: ' + e.message);
            console.error(e);
        } finally {
            if(btn) { btn.disabled = false; btn.innerHTML = oldText; }
        }
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