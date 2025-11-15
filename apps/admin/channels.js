// apps/admin/channels.js
document.addEventListener('DOMContentLoaded', () => {
  // Bọc layout admin
  if (window.AdminLayout) {
    window.AdminLayout.init('Kênh bán hàng TMDT');
  }

  const root = document.getElementById('channelsRoot');
  if (!root) return;

  // Khung giao diện chính: TikTok / Lazada / Shopee
  root.innerHTML = `
    <div class="admin-page">
      <div class="admin-page-header">
        <h1 style="font-size:20px;font-weight:700;margin-bottom:4px;">Kênh bán hàng TMDT</h1>
        <p style="color:#64748b;font-size:13px;">
          Quản lý kết nối TikTok Shop, Lazada, Shopee. Mỗi sàn có thể kết nối nhiều shop.
        </p>
      </div>

      <div class="admin-card" style="margin-top:16px;">
        <div style="display:flex;gap:8px;margin-bottom:16px;">
          <button class="btn primary channels-tab active" data-tab="tiktok">TikTok Shop</button>
          <button class="btn outline channels-tab" data-tab="lazada">Lazada</button>
          <button class="btn outline channels-tab" data-tab="shopee">Shopee</button>
        </div>

        <div class="channels-panel" data-panel="tiktok">
          <h2 style="font-size:16px;font-weight:600;margin-bottom:8px;">TikTok Shop</h2>
          <p style="font-size:13px;color:#64748b;margin-bottom:12px;">
            Kết nối TikTok Shop để đồng bộ tồn kho & đơn hàng với hệ thống.
          </p>

          <div id="tiktokShopsEmpty" style="font-size:13px;color:#64748b;margin-bottom:12px;">
            Chưa có shop nào được kết nối.
          </div>

          <button id="btnConnectTiktok" class="btn primary">
            Kết nối TikTok Shop
          </button>
        </div>

        <div class="channels-panel" data-panel="lazada" style="display:none;">
  <h2 style="font-size:16px;font-weight:600;margin-bottom:8px;">Lazada</h2>

  <div id="lazadaShopsEmpty" style="font-size:13px;color:#64748b;margin-bottom:12px;">
    Chưa có shop Lazada nào được kết nối.
  </div>

  <button id="btnConnectLazada" class="btn primary">
    Kết nối Lazada
  </button>
</div>


        <div class="channels-panel" data-panel="shopee" style="display:none;">
          <h2 style="font-size:16px;font-weight:600;margin-bottom:8px;">Shopee</h2>
          <p style="font-size:13px;color:#64748b;">
            Phần Shopee sẽ cấu hình sau khi hoàn tất TikTok Shop.
          </p>
        </div>
      </div>
    </div>
  `;

  // Switch tab TMDT
  const tabs = root.querySelectorAll('.channels-tab');
  const panels = root.querySelectorAll('.channels-panel');

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const target = tab.dataset.tab;

      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      panels.forEach(p => {
        p.style.display = (p.dataset.panel === target) ? 'block' : 'none';
      });
    });
  });

  // Nút connect TikTok Shop: bước 1 chỉ mở URL backend, sau mình sẽ code handler worker
  const btnConnect = root.querySelector('#btnConnectTiktok');
if (btnConnect) {
  btnConnect.addEventListener('click', () => {
    const base = 'https://api.shophuyvan.vn';
    const redirect = encodeURIComponent('https://admin.shophuyvan.vn/channels.html');
    const url = `${base}/channels/tiktok/connect?redirect=${redirect}`;
    window.location.href = url;
  });
}

// Thêm handler Lazada
const btnConnectLazada = root.querySelector('#btnConnectLazada');
if (btnConnectLazada) {
  btnConnectLazada.addEventListener('click', () => {
    const base = 'https://api.shophuyvan.vn';
    const redirect = encodeURIComponent('https://admin.shophuyvan.vn/channels.html');
    const url = `${base}/channels/lazada/connect?redirect=${redirect}`;
    window.location.href = url;
  });
}

// Load Lazada shops - Dùng API helper đã có sẵn token
async function loadLazadaShops() {
  console.log('[Lazada][DEBUG] Starting loadLazadaShops...');
  
  try {
    // ✅ Sử dụng window.SHARED.api.getLazadaShops() thay vì fetch trực tiếp
    const shops = await window.SHARED.api.getLazadaShops();
    
    console.log('[Lazada][DEBUG] Shops loaded:', shops.length);
    
    if (shops && shops.length > 0) {
      renderLazadaShops(shops);
    } else {
      console.warn('[Lazada][DEBUG] No shops found');
    }
  } catch (e) {
    console.error('[Lazada][DEBUG] Load shops error:', e);
    console.error('[Lazada][DEBUG] Error stack:', e.stack);
  }
}

function renderLazadaShops(shops) {
  const emptyEl = root.querySelector('#lazadaShopsEmpty');
  if (!emptyEl) return;
  
  emptyEl.innerHTML = `
    <div style="margin-bottom:16px;">
      <p style="font-size:14px;font-weight:600;margin-bottom:8px;">Shops đã kết nối (${shops.length})</p>
      ${shops.map(shop => `
        <div style="padding:12px;border:1px solid #e2e8f0;border-radius:6px;margin-bottom:8px;">
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <div>
              <div style="font-weight:600;font-size:14px;">${shop.id}</div>
              <div style="font-size:12px;color:#64748b;">Country: ${shop.country || 'N/A'}</div>
              <div style="font-size:12px;color:#64748b;">Kết nối: ${new Date(shop.created_at).toLocaleDateString('vi-VN')}</div>
            </div>
            <div style="display:flex;gap:8px;">
              <button class="btn primary btn-sm" onclick="syncLazadaProducts('${shop.id}')">
                Đồng bộ sản phẩm
              </button>
              <button class="btn danger btn-sm" onclick="disconnectLazada('${shop.id}')">
                Ngắt kết nối
              </button>
            </div>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

window.syncLazadaProducts = async function(shopId) {
  if (!confirm('Đồng bộ sản phẩm từ Lazada?')) return;
  
  const btn = event.target;
  btn.disabled = true;
  btn.textContent = 'Đang đồng bộ...';
  
  try {
    // ✅ Sử dụng API helper
    const res = await window.SHARED.api.syncLazadaProducts(shopId);
    
    if (res.ok) {
      alert(`✅ Đồng bộ thành công ${res.total || 0} sản phẩm!`);
      location.reload();
    } else {
      alert('❌ Lỗi: ' + (res.error || 'unknown'));
    }
  } catch (e) {
    alert('❌ Lỗi đồng bộ: ' + e.message);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Đồng bộ sản phẩm';
  }
};

window.disconnectLazada = async function(shopId) {
  if (!confirm('Ngắt kết nối shop này?')) return;
  try {
    // ✅ Sử dụng API helper
    const res = await window.SHARED.api.disconnectLazadaShop(shopId);
    if (res.ok) {
      location.reload();
    } else {
      alert('Lỗi: ' + (res.error || 'unknown'));
    }
  } catch (e) {
    alert('Lỗi ngắt kết nối: ' + e.message);
  }
};

// Check callback status
const urlParams = new URLSearchParams(window.location.search);
const lzStatus = urlParams.get('lz_status');
if (lzStatus === 'success') {
  alert('✅ Kết nối Lazada thành công!');
  window.history.replaceState({}, '', '/channels.html');
  loadLazadaShops();
} else if (lzStatus === 'error') {
  const reason = urlParams.get('reason') || 'unknown';
  alert('❌ Kết nối Lazada thất bại: ' + reason);
  window.history.replaceState({}, '', '/channels.html');
}


// Gọi trực tiếp khi DOM ready
setTimeout(() => {
  console.log('[Lazada][DEBUG] Auto-loading shops after page load');
  loadLazadaShops();
}, 500);
});