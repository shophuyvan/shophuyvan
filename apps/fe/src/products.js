// apps/fe/src/products.js
(function(){
  const $  = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));
  const box = $('#product-list') || $('[data-list=products]');
  if (!box) return;

  const API = "https://shv-api.shophuyvan.workers.dev/products";
  const fmt = n => (Number(n)||0).toLocaleString("vi-VN")+"đ";

  function card(p){
    const img = (p.images||[])[0] || "";
    const link = p.slug ? `/product/${encodeURIComponent(p.slug)}` : `/product?id=${encodeURIComponent(p.id)}`;
    const price = Number(p.sale_price || p.price || 0);
    return `<a class="p-card" href="${link}" aria-label="${p.title}">
  <div class="p-thumb">
    <img loading="lazy" decoding="async" src="${img}" alt="${p.title || "Sản phẩm"}" />
  </div>
  <div class="p-body">
    <div class="p-title">${p.title || ""}</div>
    <div class="p-price">${fmt(price)}</div>
  </div>
</a>`;
  }

  async function load(){
    try{
      box.innerHTML = `<div class="muted">Đang tải…</div>`;
      const r = await fetch(API, { headers: { "accept":"application/json" }});
      const data = await r.json();
      const items = Array.isArray(data) ? data : (data.items || []);
      if (!items.length){ box.innerHTML = `<div class="muted">Không có sản phẩm</div>`; return; }
      box.innerHTML = items.map(card).join("");
    }catch(e){
      box.innerHTML = `<div class="muted">Lỗi tải dữ liệu</div>`;
    }
  }

  document.readyState !== "loading" ? load() : document.addEventListener("DOMContentLoaded", load);
})();
