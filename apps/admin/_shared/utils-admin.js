/* [FILE: apps/admin/_shared/utils-admin.js] */
(function () {
  window.SHARED = window.SHARED || {};
  const utils = {};

  // Ép số an toàn: "1,200" / "120.000đ" -> 1200
  utils.toNum = (x) => {
    if (typeof x === 'string') return Number(x.replace(/[^\d.-]/g, '')) || 0;
    return Number(x || 0);
  };

  utils.formatMoney = (n) =>
    new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(Number(n || 0));

  utils.formatPrice = utils.formatMoney;

    // Một số helper trạng thái (nếu cần)
  utils.isActive = (item) => !item?.deleted_at && (item?.status === 'ACTIVE' || item?.status === true);

  // ===== Điều hướng dùng chung cho mọi nơi (FE/Mini/Admin) =====
  // Mở trang Sửa sản phẩm: ghi id vào sessionStorage để trang product_edit.html lấy fallback
  utils.openProductEdit = function (id) {
    const pid = String(id || '').trim();
    if (!pid) { alert('Thiếu ID sản phẩm'); return; }
    try { sessionStorage.setItem('editProductId', pid); } catch {}
    // Không cần gắn ?id=..., trang product_edit.html sẽ tự lấy từ sessionStorage nếu thiếu query
    location.href = './product_edit.html';
  };

  // Mở trang Tạo mới sản phẩm (đặt cờ create=1)
  utils.openProductCreate = function () {
    location.href = './product_edit.html?create=1';
  };

  // Xuất helper ra global để dùng trực tiếp trong HTML (onclick)
  window.openProductEdit = utils.openProductEdit;
  window.openProductCreate = utils.openProductCreate;

  window.SHARED.utils = utils;
})();
