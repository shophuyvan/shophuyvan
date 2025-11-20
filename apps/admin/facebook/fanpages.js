(function() {
  const API = (window.Admin && Admin.getApiBase && Admin.getApiBase()) || 'https://api.shophuyvan.vn';

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
      container.innerHTML = '<div class="alert">Chưa có fanpage nào. Hãy bấm "Kết nối" để thêm!</div>';
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
            <button class="btn" onclick="alert('Tính năng Cấu hình đang phát triển')">⚙️ Cấu hình</button>
            <button class="btn" onclick="alert('Tính năng Lịch sử đang phát triển')">💬 Tin nhắn</button>
          </div>
        </div>
      </div>
    `).join('');
  }

  async function savePage() {
    const pageId = document.getElementById('inputPageId').value.trim();
    const token = document.getElementById('inputPageToken').value.trim();

    if (!pageId || !token) return alert('Vui lòng nhập đủ Page ID và Token');

    // Hiệu ứng loading nút lưu
    const btn = event.target;
    const oldText = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Đang lưu...';

    try {
      const r = await Admin.req('/admin/fanpages', {
        method: 'POST',
        body: {
          page_id: pageId,
          name: 'New Fanpage', // Backend có thể tự lấy tên từ Graph API sau này
          access_token: token,
          auto_reply_enabled: true,
          welcome_message: 'Xin chào! Shop Huy Vân có thể giúp gì cho bạn?'
        }
      });

      if (r && r.ok) {
        alert('✅ Kết nối thành công!');
        document.getElementById('connectModal').style.display = 'none';
        // Reset form
        document.getElementById('inputPageId').value = '';
        document.getElementById('inputPageToken').value = '';
        loadFanpages();
      } else {
        alert('❌ Lỗi: ' + (r.error || 'Unknown error'));
      }
    } catch (e) {
      alert('❌ Lỗi: ' + e.message);
    } finally {
      btn.disabled = false;
      btn.textContent = oldText;
    }
  }

  window.FanpageManager = {
    init: loadFanpages,
    connectNewPage: async () => {
      const modal = document.getElementById('connectModal');
      const container = document.getElementById('fbPageList');
      
      modal.style.display = 'flex';
      container.innerHTML = '<div class="loading">Đang kết nối Facebook...</div>';

      try {
        // Gọi API lấy danh sách page từ token hệ thống
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
          container.innerHTML = `<div class="alert alert-warning">
            Không tìm thấy Fanpage nào hoặc Token hết hạn.<br>
            Vui lòng vào <b>Tab Quảng Cáo -> Cài Đặt -> Login Facebook</b> lại.
          </div>`;
        }
      } catch (e) {
        container.innerHTML = `<div class="alert alert-error">Lỗi: ${e.message}</div>`;
      }
    },

    // Hàm lưu tự động khi bấm nút "Kết nối" trên danh sách
    autoConnect: async (pageId, token, name) => {
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
          loadFanpages(); // Load lại danh sách chính
        } else {
          alert('❌ Lỗi: ' + (r.error || 'Unknown error'));
        }
      } catch (e) {
        alert('❌ Lỗi kết nối: ' + e.message);
      }
    },
    savePage
  };
})();