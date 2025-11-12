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
          <p style="font-size:13px;color:#64748b;">
            Phần Lazada sẽ cấu hình sau khi hoàn tất TikTok Shop.
          </p>
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
      // Sau này mình sẽ dùng API base động; tạm thời hardcode đúng domain API
      const base = 'https://api.shophuyvan.vn';
      const redirect = encodeURIComponent('https://admin.shophuyvan.vn/channels.html');

      // Route backend sẽ xử lý auth TikTok & redirect về lại admin
      const url = `${base}/channels/tiktok/connect?redirect=${redirect}`;
      window.location.href = url;
    });
  }
});
