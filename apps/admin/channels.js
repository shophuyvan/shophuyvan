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
          <p style="font-size:13px;color:#64748b;margin-bottom:12px;">
            Kết nối Shopee để đồng bộ tồn kho & đơn hàng với hệ thống.
          </p>

          <div id="shopeeShopsEmpty" style="font-size:13px;color:#64748b;margin-bottom:12px;">
            Chưa có shop Shopee nào được kết nối.
          </div>

          <button id="btnConnectShopee" class="btn primary">
            Kết nối Shopee
          </button>
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

// ✅ THÊM HANDLER SHOPEE
const btnConnectShopee = root.querySelector('#btnConnectShopee');
if (btnConnectShopee) {
  btnConnectShopee.addEventListener('click', () => {
    const base = 'https://api.shophuyvan.vn';
    const redirect = encodeURIComponent('https://admin.shophuyvan.vn/channels.html');
    const url = `${base}/channels/shopee/connect?redirect=${redirect}`;
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
              <button class="btn primary btn-sm" onclick="syncLazadaOrders('${shop.id}')">
                Đồng bộ đơn hàng
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

window.syncLazadaOrders = async function(shopId) {
  if (!confirm('Đồng bộ đơn hàng từ Lazada?')) return;
  
  const btn = event.target;
  btn.disabled = true;
  btn.textContent = 'Đang đồng bộ...';
  
  try {
    const res = await window.SHARED.api.syncLazadaOrders(shopId);
    
    if (res.ok) {
      alert(`✅ Đồng bộ thành công ${res.total || 0} đơn hàng!`);
    } else {
      alert('❌ Lỗi: ' + (res.error || 'unknown'));
    }
  } catch (e) {
    alert('❌ Lỗi đồng bộ: ' + e.message);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Đồng bộ đơn hàng';
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


// Load shops with retry for Admin.req
  let loadRetries = 0;
  const tryLoadShops = () => {
    console.log(`[Lazada][Retry ${loadRetries}] Checking dependencies...`);
    console.log(`[Lazada][Retry ${loadRetries}] window.Admin:`, !!window.Admin);
    console.log(`[Lazada][Retry ${loadRetries}] window.Admin.req:`, !!(window.Admin && window.Admin.req));
    console.log(`[Lazada][Retry ${loadRetries}] window.SHARED:`, !!window.SHARED);
    console.log(`[Lazada][Retry ${loadRetries}] window.SHARED.api:`, !!(window.SHARED && window.SHARED.api));
    
    if (!window.Admin || !window.Admin.req || !window.SHARED || !window.SHARED.api) {
      if (loadRetries < 50) {
        loadRetries++;
        setTimeout(tryLoadShops, 100);
      } else {
        console.error('[Lazada] Dependencies not ready after 5s');
        console.error('[Lazada] Final state - window.Admin:', window.Admin);
        console.error('[Lazada] Final state - window.SHARED:', window.SHARED);
      }
      return;
    }
    
    console.log('[Lazada] ✅ Dependencies ready after', loadRetries * 100, 'ms');
    loadLazadaShops();
  };
  
  tryLoadShops();
  
  // ✅ THÊM: Load Shopee shops
  tryLoadShopeeShops();
// ============================================
  // SHOPEE FUNCTIONS (✅ DI CHUYỂN VÀO TRONG DOMContentLoaded)
  // ============================================

  async function loadShopeeShops() {
  console.log('[Shopee][DEBUG] Starting loadShopeeShops...');
  
  try {
    const shops = await window.SHARED.api.getShopeeShops();
    console.log('[Shopee][DEBUG] Shops loaded:', shops.length);
    
    if (shops && shops.length > 0) {
      renderShopeeShops(shops);
    }
  } catch (e) {
    console.error('[Shopee][DEBUG] Load shops error:', e);
  }
}

function renderShopeeShops(shops) {
  const root = document.getElementById('channelsRoot'); // ✅ THÊM DÒNG NÀY
  if (!root) return;
  
  const emptyEl = root.querySelector('#shopeeShopsEmpty');
  if (!emptyEl) return;
  
  emptyEl.innerHTML = `
    <div style="margin-bottom:16px;">
      <p style="font-size:14px;font-weight:600;margin-bottom:8px;">Shops đã kết nối (${shops.length})</p>
      ${shops.map(shop => `
        <div style="padding:12px;border:1px solid #e2e8f0;border-radius:6px;margin-bottom:8px;">
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <div>
              <div style="font-weight:600;font-size:14px;">Shop #${shop.shop_id}</div>
              <div style="font-size:12px;color:#64748b;">Region: ${shop.region || 'VN'}</div>
              <div style="font-size:12px;color:#64748b;">Kết nối: ${new Date(shop.created_at).toLocaleDateString('vi-VN')}</div>
            </div>
            <div style="display:flex;gap:8px;flex-wrap:wrap;">
              <button class="btn primary btn-sm" onclick="syncShopeeStock('${shop.shop_id}')">
                📦 Đồng bộ tồn kho
              </button>
              <button class="btn primary btn-sm" onclick="syncShopeeOrders('${shop.shop_id}')">
                Đồng bộ đơn hàng
              </button>
              <button class="btn danger btn-sm" onclick="disconnectShopee('${shop.shop_id}')">
                Ngắt kết nối
              </button>
            </div>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

window.syncShopeeStock = async function(shopId) {
  if (!confirm('📦 Đồng bộ tồn kho từ Shopee về Website?\n\nLưu ý: Tồn kho trên Shopee sẽ là chuẩn.')) return;
  
  const btn = event.target;
  const originalText = btn.textContent;
  btn.disabled = true;
  
  // ✅ TẠO MODAL PROGRESS
  const modal = document.createElement('div');
  modal.style.cssText = `
    position: fixed; top: 0; left: 0; right: 0; bottom: 0;
    background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center;
    z-index: 9999;
  `;
  modal.innerHTML = `
    <div style="background: white; padding: 24px; border-radius: 8px; min-width: 400px;">
      <h3 style="margin: 0 0 16px 0; font-size: 18px;">Đang đồng bộ tồn kho Shopee</h3>
      <div style="margin-bottom: 8px;">
        <div style="font-size: 14px; color: #64748b;" id="syncProgress">Đang khởi tạo...</div>
      </div>
      <div style="background: #e2e8f0; height: 8px; border-radius: 4px; overflow: hidden;">
        <div id="syncProgressBar" style="background: #3b82f6; height: 100%; width: 0%; transition: width 0.3s;"></div>
      </div>
      <div style="margin-top: 12px; font-size: 12px; color: #94a3b8;" id="syncDetails"></div>
    </div>
  `;
  document.body.appendChild(modal);
  
  const progressText = modal.querySelector('#syncProgress');
  const progressBar = modal.querySelector('#syncProgressBar');
  const detailsText = modal.querySelector('#syncDetails');
  
  try {
    let offset = 0;
    let totalProcessed = 0;
    let totalItems = 0;
    const limit = 40;
    
    // ✅ LOOP GỌI API VỚI PAGINATION
    while (true) {
      progressText.textContent = `Đang xử lý batch ${Math.floor(offset / limit) + 1}...`;
      
      const res = await fetch('https://api.shophuyvan.vn/admin/shopee/sync-stock', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-token': window.Admin.token
        },
        body: JSON.stringify({
          shop_id: shopId,
          offset: offset,
          limit: limit
        })
      });
      
      const data = await res.json();
      
      if (!data.ok) {
        throw new Error(data.error || 'Sync failed');
      }
      
      // ✅ CẬP NHẬT PROGRESS
      totalItems = data.total;
      totalProcessed += data.processed;
      
      const percent = Math.round((totalProcessed / totalItems) * 100);
      progressBar.style.width = percent + '%';
      progressText.textContent = `Đã xử lý ${totalProcessed}/${totalItems} sản phẩm (${percent}%)`;
      detailsText.textContent = `Batch này: ${data.processed} variants đã cập nhật`;
      
      // ✅ KIỂM TRA XONG CHƯA
      if (!data.has_more) {
        break;
      }
      
      offset = data.next_offset;
      
      // ✅ DELAY 500ms giữa các batch để tránh spam
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    // ✅ HOÀN THÀNH
    progressText.textContent = '✅ Hoàn thành!';
    progressBar.style.background = '#10b981';
    detailsText.textContent = `Tổng cộng ${totalProcessed} variants đã được cập nhật tồn kho`;
    
    setTimeout(() => {
      document.body.removeChild(modal);
      alert(`✅ Đồng bộ thành công ${totalProcessed} variants!\n\nTồn kho đã được cập nhật từ Shopee.`);
      location.reload();
    }, 2000);
    
  } catch (e) {
    document.body.removeChild(modal);
    alert('❌ Lỗi đồng bộ: ' + e.message);
    btn.disabled = false;
    btn.textContent = originalText;
  }
};

window.syncShopeeOrders = async function(shopId) {
  if (!confirm('Đồng bộ đơn hàng từ Shopee?')) return;
  
  const btn = event.target;
  btn.disabled = true;
  btn.textContent = 'Đang đồng bộ...';
  
  try {
    const res = await window.SHARED.api.syncShopeeOrders(shopId);
    
    if (res.ok) {
      alert(`✅ Đồng bộ thành công ${res.total || 0} đơn hàng!`);
    } else {
      alert('❌ Lỗi: ' + (res.error || 'unknown'));
    }
  } catch (e) {
    alert('❌ Lỗi đồng bộ: ' + e.message);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Đồng bộ đơn hàng';
  }
};

window.disconnectShopee = async function(shopId) {
  if (!confirm('Ngắt kết nối shop này?')) return;
  try {
    const res = await window.SHARED.api.disconnectShopeeShop(shopId);
    if (res.ok) {
      location.reload();
    } else {
      alert('Lỗi: ' + (res.error || 'unknown'));
    }
  } catch (e) {
    alert('Lỗi ngắt kết nối: ' + e.message);
  }
};

// Check Shopee callback status
const spStatus = urlParams.get('sp_status');
if (spStatus === 'success') {
  alert('✅ Kết nối Shopee thành công!');
  window.history.replaceState({}, '', '/channels.html');
  loadShopeeShops();
} else if (spStatus === 'error') {
  const reason = urlParams.get('reason') || 'unknown';
  alert('❌ Kết nối Shopee thất bại: ' + reason);
  window.history.replaceState({}, '', '/channels.html');
}

// Load Shopee shops with retry
  function tryLoadShopeeShops() {
    let retries = 0;
    const tryLoad = () => {
      if (!window.SHARED || !window.SHARED.api) {
        if (retries < 50) {
          retries++;
          setTimeout(tryLoad, 100);
        }
        return;
      }
      loadShopeeShops();
    };
    tryLoad();
  }
}); // ✅ KẾT THÚC DOMContentLoaded Ở ĐÂY