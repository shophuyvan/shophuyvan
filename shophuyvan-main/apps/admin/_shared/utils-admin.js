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

  window.SHARED.utils = utils;
})();
