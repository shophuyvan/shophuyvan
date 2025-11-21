(function() {
  const API = (window.Admin && Admin.getApiBase && Admin.getApiBase()) || 'https://api.shophuyvan.vn';

  // 1. Tải danh sách Fanpage đã lưu trong DB (Màn hình chính)
  async function loadFanpages() {
    const container = document.getElementById('fanpageList');
    if(!container) return;
    
    try {
      const r = await Admin.req('/admin/fanpages', { method: 'GET' });
      if (r && r.ok) {
        renderList(r.items || []);
      } else {
        container.innerHTML = '<div class="alert alert-error">Không thể tải danh sách (API Error)</div>';
      }
    } catch (e) {
      container.innerHTML = `<div class="alert alert-error">Lỗi kết nối: ${e.message}</div>`;
    }
  }

  function renderList(items) {
    const container = document.getElementById('fanpageList');
    if (items.length === 0) {
      container.innerHTML = '<div class="alert">Chưa có fanpage nào. Hãy bấm "Kết nối Fanpage Mới" để thêm!</div>';
      return;
    }

    container.innerHTML = items.map(page => `
      <div class="page-card">
        <div class="page-avatar" style="display:flex;align-items:center;justify-content:center;font-size:24px;background:#e0e7ff;color:#4f46e5">F</div>
        <div class="page-info">
          <div class="page-name">${page.name || 'Unnamed Page'}</div>
          <div class="page-meta">
            <span>ID: ${page.page_id}</span>
            <span class="status-badge ${page.auto_reply_enabled ? 'status-active' : 'status-inactive'}">
              ${page.auto_reply_enabled ? 'Auto Reply: ON' : 'Auto Reply: OFF'}
            </span>
          </div>
                    <div class="actions">
            <button class="btn-sm" onclick="window.openSettings('${page.page_id}')">⚙️ Cấu hình</button>
            <!-- [SHV] Nút mở Hub quản lý Fanpage -->
            <button class="btn-sm primary" onclick="FanpageManager.openPageHub('${page.page_id}', '${page.name || 'Unnamed Page'}')">
              📘 Quản lý Fanpage
            </button>
          </div>

        </div>
      </div>
    `).join('');
  }

  // 2. Hàm Login Facebook (Giống hệt bên Ads)
  async function loginFacebook() {
    try {
      const r = await Admin.req('/admin/facebook/oauth/authorize', { method: 'GET' });
      if (r && r.ok && r.auth_url) {
        // Mở popup
        const width = 600;
        const height = 700;
        const left = (screen.width - width) / 2;
        const top = (screen.height - height) / 2;
        
        const popup = window.open(
          r.auth_url,
          'FacebookOAuth',
          `width=${width},height=${height},left=${left},top=${top},toolbar=no,location=no,status=no,menubar=no`
        );
        
        // Lắng nghe kết quả
        window.addEventListener('message', function handleOAuthCallback(event) {
          if (event.data && event.data.type === 'FB_OAUTH_SUCCESS') {
            window.removeEventListener('message', handleOAuthCallback);
            if (popup) popup.close();
            
            alert('✅ Đăng nhập thành công! Đang tải danh sách Fanpage...');
            // Tự động tải danh sách sau khi login xong
            fetchPagesFromFacebook();
          }
        });
      } else {
        alert('❌ Lỗi: ' + (r.error || 'Không lấy được URL đăng nhập'));
      }
    } catch (e) {
      alert('❌ Lỗi: ' + e.message);
    }
  }

  // 3. Lấy danh sách Page từ Facebook (Gọi sau khi Login)
  async function fetchPagesFromFacebook() {
    const container = document.getElementById('fbPageList');
    container.innerHTML = '<div class="loading">Đang tải danh sách từ Facebook...</div>';

    try {
      const r = await Admin.req('/admin/fanpages/fetch-facebook', { method: 'GET' });

      if (r && r.ok && r.data && r.data.length > 0) {
        container.innerHTML = r.data.map(p => `
          <div style="display:flex; align-items:center; justify-content:space-between; padding:10px; border-bottom:1px solid #f3f4f6;">
            <div style="display:flex; align-items:center; gap:10px;">
              <img src="${p.picture?.data?.url || ''}" style="width:40px; height:40px; border-radius:50%;">
              <div>
                <div style="font-weight:600;">${p.name}</div>
                <div style="font-size:11px; color:#666;">ID: ${p.id}</div>
              </div>
            </div>
            <button class="btn-sm primary" onclick="FanpageManager.autoConnect('${p.id}', '${p.access_token}', '${p.name}')">
              Kết nối
            </button>
          </div>
        `).join('');
      } else {
        container.innerHTML = `<div class="alert alert-warning" style="text-align:center;">
          ⚠️ Không tìm thấy Fanpage nào.<br>
          Hãy chắc chắn bạn đã bấm nút <b>"Đăng nhập Facebook"</b> ở trên và <b>Chọn Tất Cả Fanpage</b>.
        </div>`;
      }
    } catch (e) {
      container.innerHTML = `<div class="alert alert-error">Lỗi: ${e.message}</div>`;
    }
  }

  // 4. Lưu kết nối vào DB
  async function autoConnect(pageId, token, name) {
    if(!confirm(`Bạn muốn kết nối Fanpage "${name}"?`)) return;
    
    try {
      const r = await Admin.req('/admin/fanpages', {
        method: 'POST',
        body: {
          page_id: pageId,
          name: name,
          access_token: token,
          auto_reply_enabled: true,
          welcome_message: 'Xin chào! Shop Huy Vân có thể giúp gì cho bạn?'
        }
      });

      if (r && r.ok) {
        alert(`✅ Đã kết nối "${name}" thành công!`);
        document.getElementById('connectModal').style.display = 'none';
        loadFanpages();
      } else {
        alert('❌ Lỗi: ' + (r.error || 'Unknown error'));
      }
    } catch (e) {
      alert('❌ Lỗi kết nối: ' + e.message);
    }
  }

    // 5. Khởi tạo + Fanpage Hub
  window.FanpageManager = {
    init: loadFanpages,

    // Khi bấm mở modal, thử load danh sách luôn. Nếu rỗng thì hiện nút Login.
    connectNewPage: () => {
      document.getElementById('connectModal').style.display = 'flex';
      fetchPagesFromFacebook();
    },

    loginFacebook,
    autoConnect,

    // ==============================
    // [SHV] Mở Hub quản lý Fanpage
    // ==============================
    openPageHub: async (pageId, name) => {
      const modal = document.getElementById('pageHubModal');
      if (!modal) {
        alert('Thiếu DOM #pageHubModal');
        return;
      }
      document.getElementById('hubPageName').innerText = `${name} (${pageId})`;
      modal.style.display = 'flex';

      // Set tab active mặc định
      document.querySelectorAll('.hub-tab').forEach(t => t.classList.remove('active'));
      const first = document.querySelector('.hub-tab[data-hub="overview"]');
      if (first) first.classList.add('active');

      FanpageManager.loadHubTab('overview', pageId);

      // Gắn event click cho tab
      document.querySelectorAll('.hub-tab').forEach(tab => {
        tab.onclick = () => {
          document.querySelectorAll('.hub-tab').forEach(t => t.classList.remove('active'));
          tab.classList.add('active');
          const key = tab.getAttribute('data-hub');
          FanpageManager.loadHubTab(key, pageId);
        };
      });
    },

    // ==============================
    // [SHV] LOAD TỪNG TAB
    // ==============================
    loadHubTab: async (tab, pageId) => {
      const c = document.getElementById('hubContent');
      if (!c) return;
      c.innerHTML = 'Đang tải...';

      if (tab === 'overview') {
        return FanpageManager.renderOverview(pageId);
      }
      if (tab === 'ads') {
        return FanpageManager.renderAds(pageId);
      }
      if (tab === 'post') {
        return FanpageManager.renderPost(pageId);
      }
      if (tab === 'autoreply') {
        return FanpageManager.renderAutoReply(pageId);
      }
    },

    // ==============================
    // [SHV] TAB: TỔNG QUAN
    // ==============================
    renderOverview: async (pageId) => {
      const c = document.getElementById('hubContent');
      try {
        const res = await Admin.req(`/admin/facebook/page/overview?page_id=${pageId}`, { method: 'GET' });
        if (!res.ok) {
          c.innerHTML = '<div class="alert alert-error">Không tải được tổng quan.</div>';
          return;
        }

        c.innerHTML = `
          <h3>📌 Bài viết mới nhất</h3>
          <pre style="background:#0b1120;color:#e5e7eb;padding:10px;border-radius:8px;max-height:250px;overflow:auto;">${JSON.stringify(res.data.posts || [], null, 2)}</pre>

          <h3>📌 Chiến dịch Ads gần đây</h3>
          <pre style="background:#0b1120;color:#e5e7eb;padding:10px;border-radius:8px;max-height:250px;overflow:auto;">${JSON.stringify(res.data.ads || [], null, 2)}</pre>
        `;
      } catch (e) {
        c.innerHTML = `<div class="alert alert-error">Lỗi: ${e.message}</div>`;
      }
    },

    // ==============================
    // [SHV] TAB: QUẢNG CÁO
    // ==============================
    renderAds: async (pageId) => {
      const c = document.getElementById('hubContent');
      c.innerHTML = `
        <h3>📣 Chiến dịch Quảng cáo</h3>
        <div id="adsArea">Đang tải campaign...</div>
      `;

      try {
        const r = await Admin.req(`/admin/facebook/ads/list?page_id=${pageId}`, { method: 'GET' });
        if (r.ok && r.items && r.items.length) {
          document.getElementById('adsArea').innerHTML = `
            <pre style="background:#0b1120;color:#e5e7eb;padding:10px;border-radius:8px;max-height:400px;overflow:auto;">${JSON.stringify(r.items, null, 2)}</pre>
          `;
        } else {
          document.getElementById('adsArea').innerHTML = 'Không có campaign nào.';
        }
      } catch (e) {
        document.getElementById('adsArea').innerHTML = 'Lỗi tải campaign: ' + e.message;
      }
    },

    // ==============================
    // [SHV] TAB: ĐĂNG BÀI
    // ==============================
    renderPost: async (pageId) => {
      const c = document.getElementById('hubContent');
      c.innerHTML = `
        <h3>📝 Đăng bài lên Fanpage</h3>
        <div style="display:flex; flex-direction:column; gap:12px; max-width:600px;">
          <textarea id="post-message" placeholder="Nội dung bài viết..." style="width:100%; min-height:80px; padding:8px; border-radius:8px; border:1px solid #e5e7eb;"></textarea>
          <input id="post-link" placeholder="Link đính kèm (tuỳ chọn)" style="width:100%; padding:8px; border-radius:8px; border:1px solid #e5e7eb;" />
          <button class="btn primary" onclick="FanpageManager.submitPost('${pageId}')">Đăng bài</button>
        </div>
      `;
    },

    submitPost: async (pageId) => {
      const message = document.getElementById('post-message').value;
      const link = document.getElementById('post-link').value;

      if (!message.trim()) {
        alert('Vui lòng nhập nội dung bài viết');
        return;
      }

      try {
        const res = await Admin.req('/admin/facebook/posts/create', {
          method: 'POST',
          body: { page_id: pageId, message, link }
        });
        if (res.ok) {
          alert('✅ Đã tạo bài viết!');
        } else {
          alert('❌ Lỗi: ' + (res.error || 'Không đăng được bài'));
        }
      } catch (e) {
        alert('❌ Lỗi kết nối: ' + e.message);
      }
    },

    // ==============================
    // [SHV] TAB: AUTO REPLY
    // ==============================
    renderAutoReply: async (pageId) => {
      const c = document.getElementById('hubContent');

      try {
        const res = await Admin.req(`/admin/fanpages/settings?pageId=${pageId}`, { method: 'GET' });
        const s = res.ok && res.data ? res.data : {};

        c.innerHTML = `
          <h3>🤖 Cấu hình Auto Reply</h3>

          <div style="margin-bottom:12px;">
            <label style="font-weight:600;">Bật Auto Reply</label>
            <input type="checkbox" id="hub-toggle-auto-reply" ${s.enable_auto_reply ? 'checked' : ''} style="transform:scale(1.5); margin-left:8px;">
          </div>

          <div style="margin-bottom:12px;">
            <label style="font-weight:600; display:block; margin-bottom:4px;">Mẫu trả lời:</label>
            <textarea id="hub-reply-template" style="width:100%; min-height:100px; padding:8px; border-radius:8px; border:1px solid #e5e7eb;">${s.reply_template || ''}</textarea>
          </div>

          <button class="btn primary" onclick="FanpageManager.saveAutoReply('${pageId}')">Lưu cấu hình</button>
        `;
      } catch (e) {
        c.innerHTML = `<div class="alert alert-error">Lỗi: ${e.message}</div>`;
      }
    },

    saveAutoReply: async (pageId) => {
      const enable = document.getElementById('hub-toggle-auto-reply').checked;
      const template = document.getElementById('hub-reply-template').value;

      try {
        const res = await Admin.req('/admin/fanpages/settings', {
          method: 'POST',
          body: {
            pageId,
            settings: {
              enable_auto_reply: enable,
              reply_template: template
            }
          }
        });

        if (res.ok) {
          alert('✅ Đã lưu cấu hình Auto Reply!');
          // Reload list để cập nhật badge ON/OFF
          loadFanpages();
        } else {
          alert('❌ Lỗi: ' + (res.error || 'Không lưu được'));
        }
      } catch (e) {
        alert('❌ Lỗi kết nối: ' + e.message);
      }
    }
  };


// --- LOGIC SETTINGS MODAL (FIXED) ---
  
  // 1. Hàm mở Modal
  window.openSettings = async function(pageId) {
    document.getElementById('setting-page-id').value = pageId;
    document.getElementById('modal-settings').style.display = 'flex';
    
    // Reset UI về trạng thái đang tải
    document.getElementById('input-reply-template').value = 'Đang tải...';
    document.getElementById('input-website-link').value = '...';

    try {
        // Gọi API lấy cấu hình
        const res = await Admin.req(`/admin/fanpages/settings?pageId=${pageId}`, { method: 'GET' });
        if (res.ok && res.data) {
            const s = res.data;
            document.getElementById('toggle-hide-phone').checked = !!s.enable_hide_phone;
            document.getElementById('toggle-auto-reply').checked = !!s.enable_auto_reply;
            document.getElementById('input-reply-template').value = s.reply_template || '';
            document.getElementById('input-website-link').value = s.website_link || 'https://shophuyvan.vn';
        }
    } catch (e) {
        console.error('Lỗi tải cấu hình:', e);
        document.getElementById('input-reply-template').value = '';
    }
  };

  // 2. Gắn sự kiện Click cho nút Lưu (Dùng Event Delegation để đảm bảo luôn chạy)
  document.addEventListener('click', async (e) => {
    // Kiểm tra: Nếu click vào đúng nút có ID là 'btn-save-settings'
    if (e.target && e.target.id === 'btn-save-settings') {
        const pageId = document.getElementById('setting-page-id').value;
        
        // Hiệu ứng Loading
        const originalText = e.target.innerText;
        e.target.innerText = 'Đang lưu...';
        e.target.disabled = true;

        // Lấy dữ liệu từ Form
        const settings = {
            enable_hide_phone: document.getElementById('toggle-hide-phone').checked,
            enable_auto_reply: document.getElementById('toggle-auto-reply').checked,
            reply_template: document.getElementById('input-reply-template').value,
            website_link: document.getElementById('input-website-link').value
        };

        try {
            // Gọi API Lưu
            const res = await Admin.req('/admin/fanpages/settings', {
                method: 'POST',
                body: { pageId, settings }
            });
            
            if (res.ok) {
                alert('✅ Đã lưu cấu hình thành công!');
                document.getElementById('modal-settings').style.display = 'none';
                
                // Reload danh sách để cập nhật trạng thái ON/OFF bên ngoài
                if (typeof loadFanpages === 'function') loadFanpages();
            } else {
                alert('❌ Lỗi: ' + (res.error || 'Không lưu được'));
            }
        } catch (err) {
            alert('❌ Lỗi kết nối: ' + err.message);
        } finally {
            // Trả lại trạng thái nút bấm
            e.target.innerText = originalText;
            e.target.disabled = false;
        }
    }
  });

  // 6. Gán sự kiện (Chờ DOM load xong để tránh lỗi null)
  function setupSettingsEvents() {
    const btnSave = document.getElementById('btn-save-settings');
    if (!btnSave) return; // An toàn nếu chưa render modal

    // Xóa event cũ để tránh duplicate nếu chạy lại
    const newBtn = btnSave.cloneNode(true);
    btnSave.parentNode.replaceChild(newBtn, btnSave);

    newBtn.addEventListener('click', async () => {
        const pageId = document.getElementById('setting-page-id').value;
        const settings = {
            enable_hide_phone: document.getElementById('toggle-hide-phone').checked,
            enable_auto_reply: document.getElementById('toggle-auto-reply').checked,
            reply_template: document.getElementById('input-reply-template').value,
            website_link: document.getElementById('input-website-link').value
        };

        try {
            const res = await Admin.req('/admin/fanpages/settings', {
                method: 'POST',
                body: { pageId, settings }
            });
            
            if (res.ok) {
                alert('✅ Đã lưu cấu hình!');
                document.getElementById('modal-settings').style.display = 'none';
                // Reload lại list để cập nhật trạng thái ON/OFF
                loadFanpages();
            } else {
                alert('Lỗi: ' + (res.error || 'Unknown'));
            }
        } catch (e) {
            alert('Lỗi kết nối');
        }
    });
  }

  // Tự động chạy setup khi DOM sẵn sàng
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupSettingsEvents);
  } else {
    setupSettingsEvents();
  }

})();