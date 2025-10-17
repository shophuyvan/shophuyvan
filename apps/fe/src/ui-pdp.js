// ============================================
// UI-PDP.JS - OPTIMIZED & CLEAN VERSION
// Product Detail Page với Cart Sync
// ============================================

import api from './lib/api.js';
import { formatPrice } from './lib/price.js';

// === CART MIGRATION: Di chuyển data cũ sang key mới ===
(function migrateCart() {
  try {
    const oldCart = localStorage.getItem('CART');
    const oldCartV1 = localStorage.getItem('shv_cart_v1');
    const newCart = localStorage.getItem('cart');
    
    if (!newCart && (oldCart || oldCartV1)) {
      const data = oldCart || oldCartV1 || '[]';
      localStorage.setItem('cart', data);
      localStorage.removeItem('CART');
      localStorage.removeItem('shv_cart_v1');
      console.log('[Cart] Migrated old data to new key');
    }
  } catch(e) { console.warn('[Cart] Migration failed:', e); }
})();

// === UTILITIES ===
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

function q(key, def = '') {
  const u = new URL(location.href);
  return u.searchParams.get(key) || def;
}

function num(x) {
  try {
    if (x == null || x === '') return 0;
    return Number(String(x).replace(/\./g, '').replace(/,/g, '.')) || 0;
  } catch {
    return 0;
  }
}

function pricePair(o) {
  const sale = num(o?.sale_price ?? o?.price_sale ?? o?.sale ?? 0);
  const reg = num(o?.price ?? o?.regular_price ?? o?.base_price ?? 0);
  
  if (sale > 0) {
    return { base: sale, original: reg > 0 ? reg : null };
  }
  if (reg > 0) {
    return { base: reg, original: null };
  }
  const any = num(o?.base ?? o?.min_price ?? 0);
  return { base: any, original: null };
}

function cloudify(u, t = 'w_1200,dpr_auto,q_auto,f_auto') {
  try {
    if (!u) return u;
    const base = location.origin || 'https://example.com';
    const url = new URL(u, base);
    if (!/res\.cloudinary\.com/i.test(url.hostname)) return u;
    if (/\/upload\/[^/]+\//.test(url.pathname)) return url.toString();
    url.pathname = url.pathname.replace('/upload/', '/upload/' + t + '/');
    return url.toString();
  } catch(e) {
    return u;
  }
}

function htmlEscape(s) {
  return String(s ?? '').replace(/[&<>"']/g, m => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[m]));
}

function mdToHTML(raw) {
  if (!raw) return '';
  const lines = String(raw).split(/\r?\n/);
  const out = [];
  let list = [];
  
  const flush = () => {
    if (list.length) {
      out.push('<ul>' + list.map(li => '<li>' + htmlEscape(li) + '</li>').join('') + '</ul>');
      list = [];
    }
  };
  
  for (const L of lines) {
    const t = L.trim();
    if (!t) {
      flush();
      continue;
    }
    if (/^[-*•]\s+/.test(t)) {
      list.push(t.replace(/^[-*•]\s+/, ''));
      continue;
    }
    const h = t.match(/^#{1,6}\s+(.*)$/);
    if (h) {
      flush();
      const lvl = (t.match(/^#{1,6}/)[0] || '#').length;
      out.push(`<h${lvl}>${htmlEscape(h[1])}</h${lvl}>`);
      continue;
    }
    out.push('<p>' + htmlEscape(t) + '</p>');
  }
  flush();
  return out.join('');
}

// === IMAGE UTILITIES ===
function cleanImages(arr) {
  const out = [];
  const seen = new Set();
  
  for (let u of (arr || [])) {
    if (!u) continue;
    let s = String(u).trim();
    if (!s) continue;
    
    // Convert Google Drive share links
    const g = s.match(/drive\.google\.com\/file\/d\/([^/]+)/);
    if (g) s = `https://drive.google.com/uc?export=view&id=${g[1]}`;
    
    if (!/^https?:/i.test(s) && !s.startsWith('/')) continue;
    if (seen.has(s)) continue;
    
    seen.add(s);
    out.push(s);
  }
  return out;
}

function imagesOf(p) {
  const A = [];
  if (Array.isArray(p?.images)) A.push(...p.images);
  if (p?.image) A.unshift(p.image);
  if (p?.thumb) A.push(p.thumb);
  return cleanImages(A);
}

function videosOf(p) {
  const arr = [];
  if (Array.isArray(p?.videos)) arr.push(...p.videos);
  if (p?.video) arr.unshift(p.video);
  if (Array.isArray(p?.media)) {
    for (const m of p.media) {
      if (m && (m.type === 'video' || /\.mp4|\.webm|\.m3u8/i.test(String(m.src || m.url || '')))) {
        arr.push(m.src || m.url);
      }
    }
  }
  return arr.filter(Boolean).map(String);
}

function mediaList(p) {
  const imgs = imagesOf(p);
  const vids = videosOf(p);
  const out = [];
  vids.forEach(v => out.push({ type: 'video', src: v }));
  imgs.forEach(i => out.push({ type: 'image', src: cloudify(i) }));
  return out;
}

function variantsOf(p) {
  if (Array.isArray(p?.variants)) return p.variants;
  const keys = ['skus', 'sku_list', 'children', 'items', 'options', 'variations', 'combos', 'list'];
  for (const k of keys) {
    const v = p?.[k];
    if (Array.isArray(v)) return v;
  }
  return [];
}

// === PRODUCT STATE ===
let PRODUCT = window.PRODUCT || {};
let CURRENT = null;

// === CART HELPERS ===
function getCart() {
  try {
    const raw = localStorage.getItem('cart') || '[]';
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function saveCart(cart) {
  try {
    localStorage.setItem('cart', JSON.stringify(cart));
    window.dispatchEvent(new CustomEvent('shv:cart-changed'));
    window.dispatchEvent(new Event('storage'));
  } catch(e) {
    console.warn('[Cart] Save failed:', e);
  }
}

function cartCount() {
  return getCart().reduce((s, it) => s + (Number(it.qty) || 1), 0);
}

function addToCart(item, qty = 1) {
  const cart = getCart();
  const key = `${item.id}|${item.variantName || ''}|${item.price}`;
  
  const idx = cart.findIndex(x => 
    `${x.id}|${x.variantName || ''}|${x.price}` === key
  );
  
  if (idx >= 0) {
    cart[idx].qty = (Number(cart[idx].qty) || 1) + qty;
  } else {
    cart.push({ ...item, qty });
  }
  
  saveCart(cart);
}

// === RENDER FUNCTIONS ===
function renderTitle() {
  const titleEl = $('#p-title');
  const soldEl = $('#p-sold');
  const ratingEl = $('#p-rating');
  
  if (titleEl) titleEl.textContent = PRODUCT.title || PRODUCT.name || 'Sản phẩm';
  if (soldEl) soldEl.textContent = (num(PRODUCT.sold || PRODUCT.sold_count || 0)) + ' đã bán';
  if (ratingEl) ratingEl.textContent = String(PRODUCT.rating || '5★');
}

function renderPriceStock() {
  const priceEl = $('#p-price');
  const stockEl = $('#p-stock');
  if (!priceEl && !stockEl) return;

  const vs = variantsOf(PRODUCT).slice(0, 400);
  let rendered = false;

  const renderPriceHtml = (minBase, maxBase, minOrig, maxOrig) => {
    const baseText = (minBase === maxBase) 
      ? formatPrice(minBase) 
      : (formatPrice(minBase) + ' - ' + formatPrice(maxBase));
    
    let html = `<div class="text-rose-600 font-bold text-xl">${baseText}</div>`;
    
    if (minOrig && maxOrig && (maxOrig > maxBase || minOrig > minBase)) {
      const origText = (minOrig === maxOrig) 
        ? formatPrice(minOrig) 
        : (formatPrice(minOrig) + ' - ' + formatPrice(maxOrig));
      html += `<div class="text-gray-400 line-through text-base mt-1">${origText}</div>`;
    }
    return html;
  };

  if (vs.length) {
    const pairs = vs.map(v => pricePair(v));
    const baseVals = pairs.map(p => +p.base || 0).filter(v => v > 0);
    
    if (baseVals.length) {
      const minBase = Math.min(...baseVals);
      const maxBase = Math.max(...baseVals);
      const origVals = pairs.map(p => +p.original || 0).filter(v => v > 0);
      
      let minOrig = 0, maxOrig = 0;
      if (origVals.length) {
        minOrig = Math.min(...origVals);
        maxOrig = Math.max(...origVals);
      }
      
      if (priceEl) priceEl.innerHTML = renderPriceHtml(minBase, maxBase, minOrig, maxOrig);
      rendered = true;
    }
  }

  if (!rendered) {
    const src = CURRENT || PRODUCT || null;
    const { base, original } = pricePair(src || {});
    if (priceEl) priceEl.innerHTML = renderPriceHtml(+base || 0, +base || 0, +original || 0, +original || 0);
  }

  if (stockEl) {
    let stk = 0;
    if (vs.length) {
      stk = vs.map(v => (v.stock || v.qty || v.quantity || 0)).reduce((a, b) => a + (+b || 0), 0);
    } else {
      stk = (PRODUCT.stock || PRODUCT.qty || PRODUCT.quantity || 0) || 0;
    }
    stockEl.textContent = stk > 0 ? ('Còn ' + stk) : 'Hết hàng';
  }
}

function renderMedia(prefer) {
  const main = $('#media-main');
  if (!main) return;

  const items = mediaList(prefer || PRODUCT);
  let idx = 0;

  function show(i) {
    if (items.length === 0) {
      main.innerHTML = '';
      return;
    }
    
    idx = (i + items.length) % items.length;
    const it = items[idx];

    if (it.type === 'video') {
      main.innerHTML = `<video autoplay muted playsinline controls style="width:100%;height:100%;object-fit:cover;background:#000;border-radius:12px"></video>`;
      const v = main.querySelector('video');
      v.src = it.src;
      v.load();
    } else {
      main.innerHTML = `<img src="${it.src}" alt="${PRODUCT.title || PRODUCT.name || ''}" style="width:100%;height:100%;object-fit:cover;border-radius:12px" loading="eager" fetchpriority="high" />`;
    }
    drawArrows();
  }

  function drawArrows() {
    if (items.length <= 1) return;
    
    Array.from(main.querySelectorAll('.pdp-arrow')).forEach(n => n.remove());
    
    const mk = (dir) => {
      const b = document.createElement('button');
      b.className = 'pdp-arrow';
      b.textContent = dir === 'left' ? '‹' : '›';
      b.style.cssText = 'position:absolute;top:50%;transform:translateY(-50%);' + 
        (dir === 'left' ? 'left:8px;' : 'right:8px;') + 
        'background:rgba(0,0,0,.35);color:#fff;border:none;border-radius:999px;width:36px;height:36px;display:flex;align-items:center;justify-content:center;cursor:pointer;';
      return b;
    };

    const L = mk('left'), R = mk('right');
    L.onclick = () => { show(idx - 1); reset(); };
    R.onclick = () => { show(idx + 1); reset(); };
    main.appendChild(L);
    main.appendChild(R);
  }

  let timer = null;
  function reset() {
    if (timer) clearInterval(timer);
    timer = setInterval(() => {
      const v = main.querySelector('video');
      if (v && !v.paused && !v.ended) return;
      show(idx + 1);
    }, 3500);
  }

  show(0);
  reset();
}

function renderDesc() {
  const el = $('#p-desc');
  if (!el) return;

  const raw = PRODUCT.description_html || PRODUCT.description || PRODUCT.desc || '';
  if (/<\w+/.test(String(raw || ''))) {
    el.innerHTML = raw;
  } else {
    el.innerHTML = mdToHTML(raw) || '<p>Đang cập nhật…</p>';
  }
}

// === FLOATING CART BUTTON ===
function injectFloatingCart() {
  if ($('#shv-float-cart')) return;

  const btn = document.createElement('a');
  btn.id = 'shv-float-cart';
  btn.href = '/cart.html';
  btn.setAttribute('aria-label', 'Giỏ hàng');
  btn.style.cssText = 'position:fixed;right:14px;bottom:90px;z-index:60;background:#111827;color:#fff;width:52px;height:52px;border-radius:26px;display:flex;align-items:center;justify-content:center;box-shadow:0 8px 24px rgba(0,0,0,.2)';
  btn.innerHTML = '<span style="font-size:22px;line-height:1">🛒</span><span id="shv-float-cart-badge" style="position:absolute;top:-6px;right:-6px;background:#ef4444;color:#fff;border-radius:10px;padding:1px 6px;font-size:12px;font-weight:700;">0</span>';

  document.body.appendChild(btn);

  const upd = () => {
    const c = cartCount();
    const b = $('#shv-float-cart-badge');
    if (b) b.textContent = String(c);
  };

  upd();
  setInterval(upd, 1500);
  window.addEventListener('shv:cart-changed', upd);
}

// === STICKY CTA ===
function injectStickyCTA() {
  if ($('#shv-sticky-cta')) return;

  const wrap = document.createElement('div');
  wrap.id = 'shv-sticky-cta';
  wrap.style.cssText = 'position:fixed;left:0;right:0;bottom:0;z-index:50;background:#ffffff;box-shadow:0 -4px 18px rgba(0,0,0,.08);border-top:1px solid #e5e7eb;padding:10px 16px calc(env(safe-area-inset-bottom, 0px) + 10px);';
  
  wrap.innerHTML = `
    <div style="max-width:1120px;margin:0 auto;display:flex;align-items:center;gap:12px;justify-content:flex-end">
      <a id="shv-cta-zalo" href="https://zalo.me/" style="display:flex;align-items:center;gap:6px;border:1px solid #0068FF;color:#0068FF;background:#fff;border-radius:12px;padding:12px 14px;text-decoration:none;font-weight:700">Zalo</a>
      <button id="shv-cta-add" style="border:1px solid #ef4444;color:#ef4444;background:#fff;border-radius:12px;padding:12px 14px;font-weight:700">Thêm giỏ hàng</button>
      <button id="shv-cta-buy" style="background:#ef4444;color:#fff;border:none;border-radius:12px;padding:12px 16px;font-weight:800">MUA NGAY</button>
    </div>`;
  
  document.body.appendChild(wrap);

  const zBtn = $('#btn-zalo');
  if (zBtn && zBtn.href) {
    $('#shv-cta-zalo').href = zBtn.href;
  }

  $('#shv-cta-add')?.addEventListener('click', (e) => {
    e.preventDefault();
    if (typeof openVariantModal === 'function') {
      openVariantModal('cart');
    } else {
      window.location.href = '/cart.html';
    }
  });
 else {
      window.location.href = '/cart.html';
    }
  });

  }

  $('#shv-cta-add')?.addEventListener('click', (e) => {
    e.preventDefault();
    openVariantModal('cart');
  });

  $('#shv-cta-buy')?.addEventListener('click', async (e) => {
    e.preventDefault();
    try {
      const maybePromise = openVariantModal('buy');
      if (maybePromise && typeof maybePromise.then === 'function') {
        await Promise.race([maybePromise, new Promise(r => setTimeout(r, 300))]);
      } else {
        await new Promise(r => setTimeout(r, 150));
      }
    } catch {}
    window.location.href = '/checkout.html';
  });
}

// === VARIANT MODAL ===
function openVariantModal(mode) {
  const mask = document.createElement('div');
  mask.id = 'shv-variant-mask';
  mask.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:70;display:flex;align-items:flex-end;justify-content:center;';
  document.body.appendChild(mask);

  const vs = variantsOf(PRODUCT).slice(0, 15);
  const imgs = imagesOf(PRODUCT);

  // Auto-select first available variant
  if (!CURRENT && vs.length) {
    let best = vs[0];
    let bestVal = Infinity;
    for (const v of vs) {
      const pr = pricePair(v);
      const base = Number(pr?.base || 0);
      if (base > 0 && base < bestVal) {
        best = v;
        bestVal = base;
      }
    }
    CURRENT = best;
  }

  const html = `
  <div style="width:100%;max-width:520px;max-height:88vh;overflow:auto;background:#fff;border-radius:12px 12px 0 0;padding:16px 16px 80px 16px;position:relative">
    <div style="display:flex;gap:10px">
      <img id="vm-img" src="${imagesOf(CURRENT)[0] || imgs[0] || ''}" style="width:72px;height:72px;object-fit:contain;border-radius:10px;border:1px solid #eee;background:#f8fafc" alt="" />
      <div style="flex:1">
        <div style="font-weight:700;font-size:16px;margin-bottom:4px">${PRODUCT.title || PRODUCT.name || ''}</div>
        <div id="vm-price" style="color:#dc2626;font-weight:800"></div>
      </div>
    </div>
    <div style="margin-top:10px">
      <div style="font-weight:600;margin-bottom:6px">Chọn phân loại</div>
      <div id="vm-variants" style="display:flex;flex-wrap:wrap;gap:8px"></div>
    </div>
    <div style="margin-top:12px;display:flex;align-items:center;gap:10px">
      <span style="min-width:76px;display:inline-block">Số lượng</span>
      <button id="vm-dec" style="width:32px;height:32px;border:1px solid #e5e7eb;background:#fff;border-radius:6px">−</button>
      <input id="vm-qty" type="number" min="1" value="1" style="width:56px;height:32px;border:1px solid #e5e7eb;border-radius:6px;text-align:center" />
      <button id="vm-inc" style="width:32px;height:32px;border:1px solid #e5e7eb;background:#fff;border-radius:6px">+</button>
    </div>
    <div style="position:sticky;left:0;right:0;bottom:0;background:#fff;padding-top:12px;margin-top:16px;display:flex;gap:10px">
      <button id="vm-add" style="flex:1;border:1px solid #ef4444;color:#ef4444;background:#fff;border-radius:8px;padding:12px 16px;font-weight:700">Thêm Vào Giỏ Hàng</button>
      <button id="vm-buy" style="flex:1;background:#ef4444;color:#fff;border:none;border-radius:8px;padding:12px 16px;font-weight:700">Mua Ngay</button>
    </div>
    <button id="vm-close" aria-label="Đóng" style="position:absolute;right:10px;top:10px;border:none;background:transparent;font-size:22px">✕</button>
  </div>`;

  mask.innerHTML = html;

  function renderVBtns(active) {
    const box = mask.querySelector('#vm-variants');
    const arr = variantsOf(PRODUCT);
    
    box.innerHTML = arr.map((v, i) => {
      const { base } = pricePair(v);
      const img = imagesOf(v)[0] || '';
      const name = (v.name || v.sku || ('Loại ' + (i + 1)));
      const act = (active === i) ? 'border-color:#ef4444;color:#ef4444;background:#fff1f2;' : '';
      
      return `<button data-k="${i}" style="display:flex;align-items:center;gap:6px;border:1px solid #e5e7eb;border-radius:8px;padding:8px 10px;background:#fff;cursor:pointer;${act}">
        ${img ? `<img src="${cloudify(img, 'w_80,q_85,f_auto')}" style="width:28px;height:28px;object-fit:contain;border-radius:6px" alt="" />` : ''}
        <span>${name}${base ? ` — ${formatPrice(base)}` : ''}</span>
      </button>`;
    }).join('');

    box.querySelectorAll('button[data-k]').forEach(btn => btn.onclick = () => {
      const k = +btn.dataset.k;
      CURRENT = arr[k];
      renderVBtns(k);
      updPrice();
    });
  }

  function updPrice() {
    const src = CURRENT || (variantsOf(PRODUCT)[0] || PRODUCT);
    const pr = pricePair(src);
    
    mask.querySelector('#vm-price').textContent = formatPrice(pr.base || 0);
    
    const im = mask.querySelector('#vm-img');
    im.src = imagesOf(src)[0] || im.src;
  }

  const currentIdx = vs.indexOf(CURRENT);
  renderVBtns(currentIdx >= 0 ? currentIdx : 0);
  updPrice();

  const dec = () => {
    const inp = mask.querySelector('#vm-qty');
    let v = Math.max(1, parseInt(inp.value || '1', 10) - 1);
    inp.value = String(v);
  };
  
  const inc = () => {
    const inp = mask.querySelector('#vm-qty');
    let v = Math.max(1, parseInt(inp.value || '1', 10) + 1);
    inp.value = String(v);
  };

  mask.querySelector('#vm-dec').onclick = dec;
  mask.querySelector('#vm-inc').onclick = inc;

  function addSelectedToCart() {
    const qty = Math.max(1, parseInt(mask.querySelector('#vm-qty').value || '1', 10));
    const src = CURRENT || (variantsOf(PRODUCT)[0] || PRODUCT);

    const item = {
      id: String(PRODUCT.id || PRODUCT._id || PRODUCT.slug || Date.now()),
      name: PRODUCT.title || PRODUCT.name || '',
      image: imagesOf(src || PRODUCT)[0] || '',
      variantName: (CURRENT && (CURRENT.name || CURRENT.sku || '')) || '',
      price: Number(pricePair(src).base || 0),
      qty: qty
    };

    addToCart(item, qty); // qty already in item
  }

  mask.querySelector('#vm-add').onclick = () => {
    addSelectedToCart();
    mask.remove();
    window.location.href = '/cart.html';
  };

  mask.querySelector('#vm-buy').onclick = () => {
    addSelectedToCart();
    mask.remove();
    window.location.href = '/checkout.html';
  };

  mask.querySelector('#vm-close').onclick = () => mask.remove();
  mask.onclick = (e) => {
    if (e.target === mask) mask.remove();
  };
}

// === FETCH PRODUCT ===
async function fetchProduct(id) {
  const paths = [
    `/public/products/${encodeURIComponent(id)}`,
    `/products/${encodeURIComponent(id)}`
  ];

  for (const p of paths) {
    try {
      const r = await api.get(p);
      if (r && (r.item || r.product || (r.id || r.title))) {
        return r.item || r.product || r;
      }
    } catch {}
  }

  try {
    const list = await api.get('/public/products');
    const items = list?.items || list?.products || [];
    const f = (items || []).find(x => String(x.id || x._id || '') === String(id));
    if (f) return f;
  } catch {}

  return null;
}

// === INIT ===
(async function init() {
  try {
    const id = q('id', '').trim();
    if (!id) {
      console.warn('No product id');
      return;
    }

    const item = await fetchProduct(id);
    if (!item) {
      console.warn('Product not found');
      return;
    }

    PRODUCT = item;
    CURRENT = null;

    renderTitle();
    renderPriceStock();
    renderMedia();
    renderDesc();
    injectFloatingCart();
    injectStickyCTA();

    // Set page title
    document.title = `${PRODUCT.title || PRODUCT.name || 'Sản phẩm'} - Shop Huy Vân`;

    // Add structured data for SEO
    const structuredData = {
      "@context": "https://schema.org/",
      "@type": "Product",
      "name": PRODUCT.title || PRODUCT.name,
      "image": imagesOf(PRODUCT),
      "description": PRODUCT.description || PRODUCT.desc || '',
      "offers": {
        "@type": "Offer",
        "price": pricePair(PRODUCT).base,
        "priceCurrency": "VND",
        "availability": "https://schema.org/InStock"
      }
    };

    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.text = JSON.stringify(structuredData);
    document.head.appendChild(script);

  } catch(e) {
    console.error('[PDP] Init error:', e);
  }
})();

// === IMAGE OPTIMIZATION HINTS ===
(function optimizeImages() {
  try {
    const imgs = $$('img');
    let firstSet = false;

    imgs.forEach((img) => {
      const isHeader = !!img.closest('header');
      
      if (!firstSet && !isHeader) {
        img.setAttribute('fetchpriority', 'high');
        img.setAttribute('loading', 'eager');
        firstSet = true;
      } else {
        if (!img.hasAttribute('loading')) img.setAttribute('loading', 'lazy');
      }
      
      if (!img.hasAttribute('decoding')) img.setAttribute('decoding', 'async');
    });
  } catch(e) {
    console.warn('[PDP] Image optimization failed:', e);
  }
})();
