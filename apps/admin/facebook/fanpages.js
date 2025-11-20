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

  // 5. Khởi tạo
  window.FanpageManager = {
    init: loadFanpages,
    // Khi bấm mở modal, thử load danh sách luôn. Nếu rỗng thì hiện nút Login.
    connectNewPage: () => {
        document.getElementById('connectModal').style.display = 'flex';
        fetchPagesFromFacebook();
    },
   loginFacebook,
    autoConnect
  };

  // --- LOGIC SETTINGS MODAL ---
  window.openSettings = async function(pageId) {
    document.getElementById('setting-page-id').value = pageId;
    document.getElementById('modal-settings').style.display = 'flex';
    
    // Reset UI
    document.getElementById('toggle-hide-phone').checked = false;
    document.getElementById('toggle-auto-reply').checked = false;
    document.getElementById('input-reply-template').value = 'Đang tải...';

    try {
        const res = await Admin.req(`/admin/fanpages/settings?pageId=${pageId}`, { method: 'GET' });
        if (res.ok && res.data) {
            const s = res.data;
            document.getElementById('toggle-hide-phone').checked = !!s.enable_hide_phone;
            document.getElementById('toggle-auto-reply').checked = !!s.enable_auto_reply;
            document.getElementById('input-reply-template').value = s.reply_template || '';
            document.getElementById('input-website-link').value = s.website_link || 'https://shophuyvan.vn';
        }
    } catch (e) {
        alert('Lỗi tải cấu hình: ' + e.message);
    }
  };

  document.getElementById('btn-save-settings').addEventListener('click', async () => {
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
        } else {
            alert('Lỗi: ' + (res.error || 'Unknown'));
        }
    } catch (e) {
        alert('Lỗi kết nối');
    }
  });

})();