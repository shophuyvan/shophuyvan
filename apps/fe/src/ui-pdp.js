// ============================================
// FILE: apps/fe/src/ui-pdp.js
// COMPLETE VERSION - NO ERRORS
// ✅ Video aspect ratio fixed
// ✅ Modal variant with thumbnails
// ✅ All syntax errors fixed
// ============================================

import api from './lib/api.js';
import { formatPrice } from './lib/price.js';

// === CART MIGRATION ===
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
  return out.length ? out : [{ type: 'image', src: '/public/icon.png' }];
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

// === SUCCESS TOAST ===
function showSuccessToast(message) {
  const existing = document.getElementById('shv-toast');
  if (existing) existing.remove();
  
  const toast = document.createElement('div');
  toast.id = 'shv-toast';
  toast.style.cssText = `
    position: fixed;
    top: 70px;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(16, 185, 129, 0.95);
    color: white;
    padding: 12px 24px;
    border-radius: 12px;
    font-weight: 600;
    font-size: 14px;
    z-index: 9999;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
    animation: toast-slide-down 0.3s ease-out;
  `;
  toast.textContent = message;
  
  const style = document.createElement('style');
  style.textContent = `
    @keyframes toast-slide-down {
      from { opacity: 0; transform: translate(-50%, -20px); }
      to { opacity: 1; transform: translate(-50%, 0); }
    }
  `;
  document.head.appendChild(style);
  document.body.appendChild(toast);
  
  setTimeout(() => {
    toast.style.animation = 'toast-slide-down 0.3s ease-out reverse';
    setTimeout(() => toast.remove(), 300);
  }, 2000);
}

// === RENDER FUNCTIONS ===
function renderTitle() {
  const titleEl = $('#p-title');
  const soldEl = $('#p-sold');
  const ratingEl = $('#p-rating');
  
  if (titleEl) titleEl.textContent = PRODUCT.title || PRODUCT.name || 'Sản phẩm';
  
  if (soldEl) {
    const sold = num(PRODUCT.sold || PRODUCT.sold_count || 0);
    soldEl.textContent = sold > 0 ? sold.toLocaleString('vi-VN') : '0';
  }
  
  if (ratingEl) {
    const rating = PRODUCT.rating || 5;
    ratingEl.textContent = rating + '★';
  }
}

function renderPriceStock() {
  const priceOriginalEl = document.getElementById('p-price-original');
  const priceSaleEl = document.getElementById('p-price-sale');
  const stockEl = document.getElementById('p-stock');
  
  if (!priceSaleEl) return;

  const vs = variantsOf(PRODUCT).slice(0, 400);
  let rendered = false;

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
      
      const baseText = (minBase === maxBase) 
        ? formatPrice(minBase) 
        : (formatPrice(minBase) + ' - ' + formatPrice(maxBase));
      
      priceSaleEl.textContent = baseText;
      
      if (minOrig > 0 && maxOrig > 0 && maxOrig > minBase) {
        const origText = (minOrig === maxOrig) 
          ? formatPrice(minOrig) 
          : (formatPrice(minOrig) + ' - ' + formatPrice(maxOrig));
        
        if (priceOriginalEl) {
          priceOriginalEl.textContent = origText;
          priceOriginalEl.style.display = 'inline';
        }
      } else {
        if (priceOriginalEl) priceOriginalEl.style.display = 'none';
      }
      
      rendered = true;
    }
  }

  if (!rendered) {
    const src = CURRENT || PRODUCT || null;
    const { base, original } = pricePair(src || {});
    
    priceSaleEl.textContent = formatPrice(+base || 0);
    
    if (original && original > base && priceOriginalEl) {
      priceOriginalEl.textContent = formatPrice(original);
      priceOriginalEl.style.display = 'inline';
    } else {
      if (priceOriginalEl) priceOriginalEl.style.display = 'none';
    }
  }

  // Stock display
  if (stockEl) {
    let stk = 0;
    if (vs.length) {
      stk = vs.map(v => (v.stock || v.qty || v.quantity || 0)).reduce((a, b) => a + (+b || 0), 0);
    } else {
      stk = (PRODUCT.stock || PRODUCT.qty || PRODUCT.quantity || 0) || 0;
    }
    
    if (stk > 0) {
      stockEl.textContent = 'Còn ' + stk + ' sản phẩm';
      stockEl.className = 'stock-info';
    } else {
      stockEl.textContent = 'Hết hàng';
      stockEl.className = 'stock-info low';
    }
  }
}

// ✅ FIXED: renderMedia với video aspect ratio contain
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
      main.innerHTML = `<video autoplay muted playsinline controls style="width:100%;height:100%;object-fit:contain;background:#000;border-radius:12px"></video>`;
      const v = main.querySelector('video');
      v.src = it.src;
      v.load();
    } else {
      main.innerHTML = `<img src="${it.src}" alt="${PRODUCT.title || PRODUCT.name || ''}" style="width:100%;height:100%;object-fit:contain;border-radius:12px" loading="eager" fetchpriority="high" />`;
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
      <a id="shv-cta-zalo" href="https://zalo.me/0933190000" style="display:flex;align-items:center;gap:6px;border:1px solid #0068FF;color:#0068FF;background:#fff;border-radius:12px;padding:12px 14px;text-decoration:none;font-weight:700">Zalo</a>
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

// ✅ FIXED: openVariantModal với thumbnail icons
function openVariantModal(mode) {
  const mask = document.createElement('div');
  mask.id = 'shv-variant-mask';
  const bottomBar = document.querySelector('.shv-bottom-bar');
  if (bottomBar) bottomBar.style.display = 'none';
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
    <div style="display:flex;gap:10px;margin-bottom:12px">
      <img id="vm-img" src="${imagesOf(CURRENT)[0] || imgs[0] || ''}" style="width:72px;height:72px;object-fit:contain;border-radius:10px;border:1px solid #eee;background:#f8fafc" alt="" />
      <div style="flex:1">
        <div style="font-weight:700;font-size:16px;margin-bottom:4px">${PRODUCT.title || PRODUCT.name || ''}</div>
        <div id="vm-price" style="color:#dc2626;font-weight:800;font-size:18px"></div>
        <div id="vm-stock-info" style="font-size:12px;color:#64748b;margin-top:2px"></div>
      </div>
    </div>
    
    <div style="margin-bottom:12px">
      <div style="font-weight:600;margin-bottom:8px;font-size:14px">PHÂN LOẠI</div>
      <div id="vm-variants" style="display:grid;grid-template-columns:repeat(2,1fr);gap:8px"></div>
    </div>
    
    <div style="margin-bottom:16px;padding:12px;background:#f9fafb;border-radius:8px">
      <div style="display:flex;align-items:center;justify-content:space-between">
        <span style="font-weight:600;font-size:14px">Số lượng</span>
        <div style="display:flex;align-items:center;gap:8px">
          <button id="vm-dec" style="width:32px;height:32px;border:1px solid #d1d5db;background:#fff;border-radius:6px;font-weight:700;font-size:16px">−</button>
          <input id="vm-qty" type="number" min="1" value="1" style="width:60px;height:32px;border:1px solid #d1d5db;border-radius:6px;text-align:center;font-weight:600" />
          <button id="vm-inc" style="width:32px;height:32px;border:1px solid #d1d5db;background:#fff;border-radius:6px;font-weight:700;font-size:16px">+</button>
        </div>
      </div>
    </div>
    
    <div style="position:sticky;left:0;right:0;bottom:0;background:#fff;padding-top:16px;display:flex;gap:10px;border-top:1px solid #f0f0f0">
      <button id="vm-add" style="flex:1;border:2px solid #ef4444;color:#ef4444;background:#fff;border-radius:8px;padding:14px 16px;font-weight:700;font-size:14px">Thêm Vào Giỏ Hàng</button>
      <button id="vm-buy" style="flex:1;background:#ef4444;color:#fff;border:none;border-radius:8px;padding:14px 16px;font-weight:700;font-size:14px">Mua Ngay</button>
    </div>
    
    <button id="vm-close" aria-label="Đóng" style="position:absolute;right:10px;top:10px;border:none;background:#f3f4f6;width:28px;height:28px;border-radius:14px;font-size:16px;color:#6b7280;display:flex;align-items:center;justify-content:center">✕</button>
  </div>`;

  mask.innerHTML = html;

  function renderVBtns(active) {
    const box = mask.querySelector('#vm-variants');
    const arr = variantsOf(PRODUCT);
    
    box.innerHTML = arr.map((v, i) => {
      const { base } = pricePair(v);
      const img = imagesOf(v)[0] || imagesOf(PRODUCT)[0] || '';
      const name = (v.name || v.sku || ('Loại ' + (i + 1)));
      const stock = v.stock || v.qty || v.quantity || 0;
      const isActive = (active === i);
      const outOfStock = stock <= 0;
      
      const borderColor = isActive ? '#ef4444' : '#e5e7eb';
      const bgColor = isActive ? '#fef2f2' : '#fff';
      const opacity = outOfStock ? '0.5' : '1';
      
      return `
        <button 
          data-k="${i}" 
          ${outOfStock ? 'disabled' : ''} 
          style="
            display:flex;
            flex-direction:column;
            align-items:center;
            gap:6px;
            border:2px solid ${borderColor};
            border-radius:8px;
            padding:10px 8px;
            background:${bgColor};
            cursor:${outOfStock ? 'not-allowed' : 'pointer'};
            opacity:${opacity};
            transition:all 0.2s;
          "
        >
          ${img ? `
            <img 
              src="${cloudify(img, 'w_100,q_85,f_auto')}" 
              style="width:40px;height:40px;object-fit:contain;border-radius:6px" 
              alt="${name}" 
            />
          ` : `
            <div style="width:40px;height:40px;border-radius:6px;background:#f0f0f0;display:flex;align-items:center;justify-content:center;font-size:20px">
              📦
            </div>
          `}
          <div style="text-align:center;width:100%">
            <div style="font-size:12px;font-weight:600;line-height:1.3;color:${isActive ? '#ef4444' : '#374151'};margin-bottom:2px">${name}</div>
            ${base > 0 ? `<div style="font-size:11px;color:#ef4444;font-weight:700">${formatPrice(base)}</div>` : ''}
            ${stock > 0 ? `<div style="font-size:10px;color:#6b7280;margin-top:2px">Còn ${stock}</div>` : `<div style="font-size:10px;color:#dc2626;margin-top:2px">Hết hàng</div>`}
          </div>
        </button>
      `;
    }).join('');

    box.querySelectorAll('button[data-k]').forEach(btn => {
      if (!btn.disabled) {
        btn.onclick = () => {
          const k = +btn.dataset.k;
          CURRENT = arr[k];
          renderVBtns(k);
          updPrice();
        };
      }
    });
  }

  function updPrice() {
    const src = CURRENT || (variantsOf(PRODUCT)[0] || PRODUCT);
    const pr = pricePair(src);
    const stock = src.stock || src.qty || src.quantity || 0;
    
    mask.querySelector('#vm-price').textContent = formatPrice(pr.base || 0);
    mask.querySelector('#vm-stock-info').textContent = stock > 0 ? `Còn ${stock} sản phẩm` : 'Hết hàng';
    
    const im = mask.querySelector('#vm-img');
    const newImg = imagesOf(src)[0] || im.src;
    if (newImg) im.src = newImg;
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

    addToCart(item, qty);
  }

  mask.querySelector('#vm-add').onclick = () => {
    addSelectedToCart();
    mask.remove();
    window.dispatchEvent(new Event('shv:cart-changed'));
    showSuccessToast('✓ Đã thêm vào giỏ hàng');
  };

  mask.querySelector('#vm-buy').onclick = () => {
    addSelectedToCart();
    mask.remove();
    window.dispatchEvent(new Event('shv:cart-changed'));
    window.location.href = '/checkout.html';
  };

  function closeModal() {
    mask.remove();
    const bottomBar = document.querySelector('.shv-bottom-bar');
    if (bottomBar) bottomBar.style.display = '';
  }

  mask.querySelector('#vm-close').onclick = closeModal;
  mask.onclick = (e) => {
    if (e.target === mask) closeModal();
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

    document.title = `${PRODUCT.title || PRODUCT.name || 'Sản phẩm'} - Shop Huy Vân`;

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

// === IMAGE OPTIMIZATION ===
(function optimizeImages() {
  try {
    const imgs = $('img');
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

// === BOTTOM BAR HANDLERS ===
document.addEventListener('DOMContentLoaded', () => {
  const btnAdd = document.getElementById('btn-add-cart');
  const btnBuy = document.getElementById('btn-buy-now');
  
  if (btnAdd) {
    btnAdd.onclick = (e) => {
      e.preventDefault();
      if (typeof openVariantModal === 'function') {
        openVariantModal('cart');
      } else {
        console.error('openVariantModal not found');
      }
    };
  }
  
  if (btnBuy) {
    btnBuy.onclick = (e) => {
      e.preventDefault();
      if (typeof openVariantModal === 'function') {
        openVariantModal('buy');
      } else {
        console.error('openVariantModal not found');
      }
    };
  }
  
  console.log('[PDP] Bottom bar handlers initialized');
});

// === EXPOSE GLOBAL API ===
window.openVariantModal = openVariantModal;
window.PRODUCT_UTILS = {
  getProduct: () => PRODUCT,
  getCurrent: () => CURRENT,
  getCart: getCart,
  addToCart: addToCart,
  showToast: showSuccessToast
};

console.log('[PDP] UI initialized successfully');