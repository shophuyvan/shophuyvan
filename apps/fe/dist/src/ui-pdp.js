
(() => {
  'use strict';

  const $ = (sel, el=document) => el.querySelector(sel);
  const $$ = (sel, el=document) => Array.from(el.querySelectorAll(sel));
  const fmtPrice = (n) => {
    if (n == null || isNaN(n)) return '0đ';
    try {
      return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(n);
    } catch (e) {
      return (Math.round(+n)).toLocaleString('vi-VN') + 'đ';
    }
  };

  const state = {
    id: new URLSearchParams(location.search).get('id') || '',
    data: null,
    selectedIndex: -1,
    media: [], // [{type:'img'|'video', src}]
    thumbs: [],
  };

  async function fetchProduct() {
    const id = state.id;
    const origin = location.origin;
    const candidates = [
      `${origin}/api/products?id=${id}`,
      `${origin}/api/product?id=${id}`,
      `${origin}/apijs24?id=${id}`,
      `${origin}/apijs?id=${id}`,
      `${origin}/products?id=${id}`,
    ].filter(Boolean);

    for (const url of candidates) {
      try {
        const res = await fetch(url, { credentials: 'omit' });
        if (!res.ok) continue;
        const json = await res.json().catch(()=>null);
        if (!json) continue;
        const item = normalize(json);
        if (item && item.title) return item;
      } catch (_) {}
    }
    return { title: 'Sản phẩm', price: 0, images: [], variants: [], desc: '', faq: [], reviews: [] };
  }

  // Try to coerce different shapes to one shape
  function normalize(raw) {
    // Case: { ok, item }
    if (raw && typeof raw === 'object' && raw.item) raw = raw.item;
    // Case: { items: [...] }
    if (raw && Array.isArray(raw.items)) raw = raw.items[0] || {};

    const title = raw.title || raw.name || '';
    const images = (raw.images && raw.images.length ? raw.images :
                    raw.gallery || raw.photos || []).map(String);
    const video = raw.video || raw.videos?.[0] || '';
    const desc  = raw.desc || raw.description || '';
    const keywords = raw.keywords || [];

    // Variants
    let variants = [];
    if (Array.isArray(raw.variants) && raw.variants.length) {
      variants = raw.variants.map(v => ({
        name: v.name || v.title || v.sku || '',
        price: num(v.price),
        sale_price: num(v.sale_price ?? v.salePrice ?? v.sale),
        stock: num(v.stock ?? v.qty),
        image: v.image || v.photo || null
      }));
    } else if (Array.isArray(raw.skus) && raw.skus.length) {
      variants = raw.skus.map(v => ({
        name: v.name || v.label || v.sku || '',
        price: num(v.price),
        sale_price: num(v.sale_price ?? v.salePrice ?? v.sale),
        stock: num(v.stock ?? v.qty),
        image: v.image || null
      }));
    } else if (Array.isArray(raw.items) && raw.items.length) {
      variants = raw.items.map(v => ({
        name: v.name || v.title || '',
        price: num(v.price),
        sale_price: num(v.sale_price ?? v.salePrice ?? v.sale),
        stock: num(v.stock ?? v.qty),
        image: v.image || null
      }));
    }

    const price = num(raw.price);
    const price_sale = num(raw.price_sale ?? raw.sale_price ?? raw.salePrice ?? raw.sale);
    const stock = num(raw.stock ?? raw.qty);
    const faq = Array.isArray(raw.faq) ? raw.faq : [];
    const reviews = Array.isArray(raw.reviews) ? raw.reviews : [];

    return { title, images, video, desc, keywords, variants, price, price_sale, stock, faq, reviews };
  }

  function num(x) {
    if (x == null) return null;
    const s = String(x).replace(/[.,\s]/g, m => (m === ',' ? '' : ''));
    const n = Number(s);
    return isFinite(n) ? n : null;
  }

  // Renderers
  function renderAll() {
    $('#title').textContent = state.data.title || 'Sản phẩm';
    renderMedia();
    renderPrice();
    renderVariants();
    renderDesc();
    renderFAQ();
    renderReviews();
    bindActions();
  }

  function renderMedia() {
    const { images, video } = state.data;
    state.media = [];
    if (video) state.media.push({ type: 'video', src: video });
    (images || []).forEach(src => state.media.push({ type: 'img', src }));

    const coverImg = $('#cover-img');
    const coverVideo = $('#cover-video');
    const empty = $('#media-empty');
    const thumbs = $('#thumbs');
    thumbs.innerHTML = '';

    if (!state.media.length) {
      empty.classList.remove('hidden');
      coverImg.classList.add('hidden');
      coverVideo.classList.add('hidden');
      return;
    }
    empty.classList.add('hidden');

    // Build thumbs
    state.media.forEach((m, i) => {
      const el = document.createElement(m.type === 'img' ? 'img' : 'div');
      if (m.type === 'img') {
        el.src = m.src;
        el.alt = '';
        el.className = 'thumb';
      } else {
        el.className = 'thumb flex items-center justify-center bg-black text-white text-xs';
        el.textContent = 'Video';
      }
      el.dataset.index = i;
      el.addEventListener('click', () => showIndex(i));
      thumbs.appendChild(el);
    });

    showIndex(0);
  }

  function showIndex(i) {
    const coverImg = $('#cover-img');
    const coverVideo = $('#cover-video');
    const m = state.media[i];
    if (!m) return;
    $$('.thumb').forEach(t => t.classList.remove('active'));
    const active = $$('.thumb')[i];
    if (active) active.classList.add('active');

    if (m.type === 'img') {
      coverVideo.pause();
      coverVideo.classList.add('hidden');
      coverImg.src = m.src;
      coverImg.classList.remove('hidden');
    } else {
      coverImg.classList.add('hidden');
      coverVideo.src = m.src;
      coverVideo.autoplay = true;
      coverVideo.controls = true;
      coverVideo.classList.remove('hidden');
      coverVideo.play().catch(()=>{});
      coverVideo.onended = () => {
        // after video ends, show first image if any
        const imgIndex = state.media.findIndex(x => x.type === 'img');
        if (imgIndex >= 0) showIndex(imgIndex);
      };
    }
  }

  function minPrice() {
    const { variants, price, price_sale } = state.data;
    const prices = [];
    variants.forEach(v => {
      const n = (v.sale_price ?? v.price);
      if (isFinite(n)) prices.push(n);
    });
    if (isFinite(price_sale)) prices.push(price_sale);
    if (isFinite(price)) prices.push(price);
    return prices.length ? Math.min(...prices) : 0;
  }

  function renderPrice() {
    const el = $('#price');
    const s = $('#stock');
    const { variants } = state.data;
    if (state.selectedIndex >= 0 && variants[state.selectedIndex]) {
      const v = variants[state.selectedIndex];
      const p = isFinite(v.sale_price) ? v.sale_price : v.price;
      el.innerHTML = fmtPrice(p) + (isFinite(v.price) && isFinite(v.sale_price) && v.sale_price < v.price ? ` <s>${fmtPrice(v.price)}</s>` : '');
      s.textContent = v.stock != null ? `Còn ${v.stock}` : '';
      // change image if variant has
      if (v.image) {
        const idx = state.media.findIndex(x => x.type==='img' && x.src === v.image);
        if (idx >= 0) showIndex(idx);
      }
    } else {
      const p = minPrice();
      el.textContent = fmtPrice(p);
      s.textContent = '';
    }
  }

  function renderVariants() {
    const box = $('#variants');
    box.innerHTML = '';
    const { variants } = state.data;
    if (!variants.length) {
      box.innerHTML = '<div class="text-sm text-gray-500">Không có biến thể</div>';
      return;
    }
    variants.forEach((v, i) => {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'chip';
      chip.textContent = v.name || `Biến thể ${i+1}`;
      chip.addEventListener('click', () => {
        state.selectedIndex = i;
        $$('.chip', box).forEach(x => x.classList.remove('active'));
        chip.classList.add('active');
        renderPrice();
      });
      box.appendChild(chip);
    });
  }

  function renderDesc() {
    const el = $('#desc');
    const html = state.data.desc || '';
    if (/<[a-z][\s\S]*>/i.test(html)) {
      el.innerHTML = html;
    } else {
      el.textContent = html || '—';
    }
  }

  function renderFAQ() {
    const el = $('#faq');
    const arr = state.data.faq || [];
    if (!arr.length) { el.innerHTML = '<div class="text-gray-500">—</div>'; return; }
    el.innerHTML = arr.map(it => `
      <div class="mb-3">
        <div class="font-medium">Q: ${escapeHTML(it.q || it.question || '')}</div>
        <div class="">A: ${escapeHTML(it.a || it.answer || '')}</div>
      </div>`).join('');
  }

  function renderReviews() {
    const el = $('#reviews');
    const arr = state.data.reviews || [];
    if (!arr.length) { el.innerHTML = '<div class="text-gray-500">—</div>'; return; }
    el.innerHTML = arr.slice(0, 5).map(it => `
      <div class="mb-3 border-b border-gray-100 pb-2">
        <div class="text-yellow-500 text-sm">${'★'.repeat(it.rating || 5)}</div>
        <div>${escapeHTML(it.content || it.text || '')}</div>
      </div>`).join('');
  }

  function escapeHTML(s) {
    return String(s || '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  }

  function bindActions() {
    $('#btn-add').onclick = () => addToCart(false);
    $('#btn-buy').onclick = () => addToCart(true);
  }

  function addToCart(goCheckout) {
    const id = state.id || state.data.id || state.data.title;
    const idx = state.selectedIndex >= 0 ? state.selectedIndex : null;
    const cart = JSON.parse(localStorage.getItem('cart') || '[]');
    cart.push({ id, variantIndex: idx, qty: 1, at: Date.now() });
    localStorage.setItem('cart', JSON.stringify(cart));
    if (goCheckout) {
      location.href = '/cart';
    } else {
      // Small toast
      const t = document.createElement('div');
      t.textContent = 'Đã thêm vào giỏ';
      t.className = 'fixed left-1/2 -translate-x-1/2 bottom-6 bg-black text-white text-sm px-3 py-2 rounded-lg';
      document.body.appendChild(t);
      setTimeout(() => t.remove(), 1200);
    }
  }

  async function init() {
    try {
      state.data = await fetchProduct();
      renderAll();
    } catch (e) {
      console.error(e);
    }
  }

  init();
})();
