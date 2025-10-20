/* [FILE: apps/admin/_shared/charts-admin.js] */
(function () {
  window.SHARED = window.SHARED || {};
  const charts = {};

  charts.safeDestroy = (inst) => {
    try { inst && typeof inst.destroy === 'function' && inst.destroy(); } catch(e) { console.warn(e); }
  };

  // Tuỳ trang tự build data; nếu muốn wrap tạo chart có thể thêm ở đây sau.
  window.SHARED.charts = charts;
})();
