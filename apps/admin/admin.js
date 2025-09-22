// apps/admin/admin.js
(() => {
  // Toggle thanh công cụ khi màn nhỏ
  const toggle = document.querySelector('[data-admin="toggle"]');
  const nav = document.querySelector('[data-admin="nav"]');
  if (toggle && nav) toggle.addEventListener('click', () => nav.classList.toggle('is-open'));

  // Đồng nhất chiều cao ảnh thumb
  const fixThumb = () => {
    document.querySelectorAll('.thumb img').forEach(img => {
      if (!img.complete) img.onload = () => img.classList.add('ready');
      else img.classList.add('ready');
    });
  };
  fixThumb();

  // Sticky hành động nhanh
  const actions = document.querySelector('[data-admin="actions"]');
  if (actions) {
    const onScroll = () => {
      actions.classList.toggle('shadow', window.scrollY > 8);
    };
    document.addEventListener('scroll', onScroll);
    onScroll();
  }
})();
