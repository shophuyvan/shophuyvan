/* apps/fe/src/ui-pdp.js
 * PDP an toàn: null-guard, lazy image, giá thấp nhất, chọn biến thể, thêm vào giỏ.
 */
(function () {
  const $  = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const setText = (el, v) => el && (el.textContent = v ?? "");
  const setHTML = (el, v) => el && (el.innerHTML = v ?? "");
  const fmt = n => (Number(n) || 0).toLocaleString("vi-VN") + "đ";

  // === inject CSS PDP (không cần sửa HTML) ===
  (function injectCss(){
    if (document.getElementById("pdp-css")) return;
    const link = document.createElement("link");
    link.id = "pdp-css";
    link.rel = "stylesheet";
    link.href = "/assets/pdp.css?v=" + Date.now();
    document.head.appendChild(link);
  })();

  const params = new URLSearchParams(location.search);
  const pid = params.get("id") || (location.pathname.includes("/product/")
    ? decodeURIComponent(location.pathname.split("/product/")[1])
    : "");

  const els = {
    price:  $('[data-pdp=price]') || $('#price'),
    buyNow: $('#btn-buy-now'),
    add:    $('#btn-add-cart')   || $('[data-pdp=add]'),
    zalo:   $('#btn-zalo')       || $('[data-pdp=zalo]'),
    title:  $('[data-pdp=title]')|| $('h1'),
    desc:   $('[data-pdp=desc]') || $('#desc'),
    media:  $('[data-pdp=media]')|| $('#media'),
    option: $('[data-pdp=option]')|| $('#option')
  };

  async function loadProduct() {
    try {
      const url = `https://shv-api.shophuyvan.workers.dev/product?id=${encodeURIComponent(pid)}`;
      const r = await fetch(url, { headers: { "accept":"application/json" }});
      const p = await r.json();

      // Title + description
      setText(els.title, p.title || p.name || "Sản phẩm");
      setHTML(els.desc, (p.description || p.desc || "").toString());

      // Media (ảnh + video)
      if (els.media) {
        const imgs = (p.images || []).map(src => 
          `<img loading="lazy" decoding="async" src="${src}" alt="${(p.title||"Sản phẩm")}" class="pdp-img">`).join("");
        const vid  = p.video ? `<video controls preload="metadata" class="pdp-vid"><source src="${p.video}" type="video/mp4"></video>` : "";
        setHTML(els.media, vid + imgs);
      }

      // Biến thể + giá thấp nhất
      const variants = p.variants || p.options || [];
      const prices = variants.length
        ? variants.map(v => Number(v.price || v.sale_price || v.minPrice || p.price)).filter(Boolean)
        : [Number(p.sale_price || p.price || 0)];
      const minPrice = prices.length ? Math.min(...prices) : 0;
      setText(els.price, fmt(minPrice));

      if (els.option && variants.length) {
        els.option.innerHTML = variants.map((v, i) => `
          <button type="button" class="opt" data-idx="${i}">${v.name || v.title || ("Phân loại " + (i+1))}</button>
        `).join("");
        els.option.addEventListener("click", (e) => {
          const b = e.target.closest(".opt"); if (!b) return;
          $$(".opt", els.option).forEach(x=>x.classList.remove("act")); b.classList.add("act");
          const idx = +b.dataset.idx;
          const v = variants[idx];
          setText(els.price, fmt(v?.price ?? minPrice));
        }, { passive: true });
      }

      // Hành động
      const addToCart = () => {
        const idx = Number($('.opt.act')?.dataset.idx || 0);
        const v = variants[idx] || {};
        const item = {
          id: p.id,
          title: p.title,
          price: Number(v.price || p.sale_price || p.price || minPrice),
          variant: v.name || v.title || null,
          qty: 1,
          img: (p.images||[])[0]
        };
        const key = "shv_cart";
        const cart = JSON.parse(localStorage.getItem(key) || "[]");
        cart.push(item);
        localStorage.setItem(key, JSON.stringify(cart));
        alert("Đã thêm vào giỏ!");
      };

      els.add    && els.add.addEventListener("click", addToCart, { passive: true });
      els.buyNow && els.buyNow.addEventListener("click", () => { addToCart(); location.href = "/cart.html"; });

    } catch (e) {
      console.error("PDP load error:", e);
    }
  }

  document.readyState !== "loading"
    ? loadProduct()
    : document.addEventListener("DOMContentLoaded", loadProduct);
})();
