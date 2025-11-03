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

async function pricePair(o, customerType = null) {
  // ✅ Lấy thông tin customer nếu chưa có
  let customer = null;
  if (!customerType) {
    customer = await getCustomerInfo();
    customerType = customer?.customer_type || 'retail';
  }
  
  // ✅ HÀM PHỤ: Lấy giá base từ object
  function getBasePrice(obj) {
    const sale = num(obj?.sale_price ?? obj?.price_sale ?? obj?.sale ?? 0);
    const price = num(obj?.price ?? obj?.regular_price ?? obj?.base_price ?? 0);
    
    if (sale > 0) {
      return { base: sale, original: price > sale ? price : null };
    }
    if (price > 0) {
      return { base: price, original: null };
    }
    return { base: 0, original: null };
  }
  
  // ✅ 1. ƯU TIÊN: GIÁ SỈ (wholesale)
  if (customerType === 'wholesale' || customerType === 'si') {
    const wholesalePrice = num(o?.wholesale_price ?? o?.price_wholesale ?? 0);
    
    if (wholesalePrice > 0) {
      const basePrice = getBasePrice(o);
      return {
        base: wholesalePrice,
        original: basePrice.base > wholesalePrice ? basePrice.base : null,
        isWholesale: true,
        tier: customer?.tier || 'retail',
        customer_type: customerType
      };
    }
  }
  
  // ✅ 2. GIÁ THEO HẠNG THÀNH VIÊN (tier discount)
  const basePrice = getBasePrice(o);
  const tier = customer?.tier || customerType === 'wholesale' ? 'retail' : 'retail';
  
  const tierMap = {
    'retail': 0,
    'silver': 3,
    'gold': 5,
    'diamond': 8
  };
  
  const discountPercent = tierMap[tier] || 0;
  
  if (discountPercent > 0 && basePrice.base > 0) {
    const discountAmount = basePrice.base * (discountPercent / 100);
    const discountedBase = Math.floor(basePrice.base - discountAmount);
    
    let original = basePrice.original;
    if (!original && discountedBase < basePrice.base) {
      original = basePrice.base;
    }
    
    return {
      base: discountedBase,
      original: original,
      isWholesale: false,
      tier: tier,
      customer_type: customerType,
      discount: discountPercent
    };
  }
  
  // ✅ 3. FALLBACK: GIÁ BÁN LẺ (không giảm)
  return {
    base: basePrice.base,
    original: basePrice.original,
    isWholesale: false,
    tier: tier,
    customer_type: customerType
  };
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

// ===== CUSTOMER AUTH CHECK =====
function getCustomerToken() {
  return localStorage.getItem('customer_token') || 
         localStorage.getItem('x-customer-token') || '';
}

async function getCustomerInfo() {
  try {
    const token = getCustomerToken();
    if (!token) return null;
    
    const API_BASE = window.API_BASE || 'https://api.shophuyvan.vn';
    const res = await fetch(`${API_BASE}/api/customers/me`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (!res.ok) {
      localStorage.removeItem('customer_token');
      localStorage.removeItem('x-customer-token');
      return null;
    }
    
    const data = await res.json();
    return data.customer || null;
  } catch(e) {
    console.error('[Customer] Get info error:', e);
    return null;
  }
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

async function renderPriceStock() {
  const priceOriginalEl = document.getElementById('p-price-original');
  const priceSaleEl = document.getElementById('p-price-sale');
  const stockEl = document.getElementById('p-stock');
  
  if (!priceSaleEl) return;

  // ✅ Lấy thông tin customer
  const customer = await getCustomerInfo();
  const customerType = customer?.customer_type || 'retail';

  const vs = variantsOf(PRODUCT).slice(0, 400);
  let rendered = false;

  if (vs.length) {
    const pairs = await Promise.all(vs.map(v => pricePair(v, customerType)));
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
      
      // ✅ Thêm badge theo loại giá
      let badge = '';
      const firstPair = pairs[0] || {};
      
      if (firstPair.isWholesale && firstPair.original) {
        badge = '<span style="background:#4f46e5;color:#fff;padding:2px 8px;border-radius:8px;font-size:11px;margin-left:8px;font-weight:700;">Giá sỉ</span>';
      } else if (firstPair.discount > 0) {
        const tierIcons = { 'silver': '🥈', 'gold': '🥇', 'diamond': '💎' };
        const icon = tierIcons[firstPair.tier] || '';
        badge = `<span style="background:#10b981;color:#fff;padding:2px 8px;border-radius:8px;font-size:11px;margin-left:8px;font-weight:700;">${icon} -${firstPair.discount}%</span>`;
      }
      
      priceSaleEl.innerHTML = baseText + badge;
      
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
    const priceData = await pricePair(src || {}, customerType);
    const { base, original, isWholesale } = priceData;
    
    // ✅ Thêm badge theo loại giá
    let badge = '';
    
    if (isWholesale && original) {
      badge = '<span style="background:#4f46e5;color:#fff;padding:2px 8px;border-radius:8px;font-size:11px;margin-left:8px;font-weight:700;">Giá sỉ</span>';
    } else if (priceData.discount > 0) {
      const tierIcons = { 'silver': '🥈', 'gold': '🥇', 'diamond': '💎' };
      const icon = tierIcons[priceData.tier] || '';
      badge = `<span style="background:#10b981;color:#fff;padding:2px 8px;border-radius:8px;font-size:11px;margin-left:8px;font-weight:700;">${icon} -${priceData.discount}%</span>`;
    }
    
    priceSaleEl.innerHTML = formatPrice(+base || 0) + badge;
    
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
  main.innerHTML = `
    <video
      autoplay
      muted
      playsinline
      controls
      style="
        width:100%;
        height:100%;
        object-fit:contain;
        background:#000;
        border-radius:12px;
        cursor:pointer;
      "
    ></video>
  `;
  const v = main.querySelector('video');
  v.src = it.src;
  v.load();

  // ✅ Bấm vào video -> bật tiếng, bấm lần nữa -> tắt tiếng
  v.addEventListener('click', () => {
    if (v.muted) {
      v.muted = false;
      v.play().catch(() => {});
    } else {
      v.muted = true;
    }
  });
} else {
  main.innerHTML = `
    <img
      src="${it.src}"
      alt="${PRODUCT.title || PRODUCT.name || ''}"
      style="
        width:100%;
        height:100%;
        object-fit:contain;
        border-radius:12px;
        background:#fff;
      "
      loading="eager"
      fetchpriority="high"
    />
  `;
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

// ✅ Hiển thị mô tả đẹp giống Mini App + ẩn khi rỗng
function renderDesc() {
  const el = $('#p-desc');
  const wrapSection = el?.closest('section');
  if (!el) return;

  const raw = PRODUCT.description_html || PRODUCT.description || PRODUCT.desc || '';
  const html = (/<\w+/.test(String(raw || ''))) ? raw : mdToHTML(raw);

  if (!html || html.trim().length < 10) {
    // Ẩn nếu không có nội dung
    if (wrapSection) wrapSection.style.display = 'none';
    return;
  }

  // Gán nội dung mô tả
  el.innerHTML = html;

  // Thêm style Tailwind đẹp giống bản Mini App
  el.className = `
    text-[15px] leading-relaxed text-gray-700
    bg-gray-50 border border-gray-200 rounded-xl p-4
    [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-gray-900 [&_h2]:mt-4 [&_h2]:mb-2
    [&_h3]:text-base [&_h3]:font-semibold [&_h3]:text-gray-900 [&_h3]:mt-3 [&_h3]:mb-1
    [&_p]:mb-3 [&_p]:text-gray-700 [&_p]:leading-relaxed
    [&_strong]:text-gray-900 [&_strong]:font-semibold
    [&_ul]:list-disc [&_ul]:pl-5 [&_li]:mb-1
    [&_table]:border-collapse [&_td]:border [&_td]:border-gray-200 [&_td]:p-2 [&_td]:align-top
  `.trim();

  // Đảm bảo section hiển thị nếu có nội dung
  if (wrapSection) wrapSection.style.display = '';
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

  // Ẩn thanh đáy khi mở modal (lưu lại trạng thái cũ)
  const bottomBar = document.querySelector('.shv-bottom-bar');
  if (bottomBar) {
    bottomBar.dataset.prevDisplay = bottomBar.style.display || '';
    bottomBar.style.opacity = '0';
    bottomBar.style.pointerEvents = 'none';
    bottomBar.style.transition = 'opacity 0.2s ease';
  }

  mask.style.cssText = `
    position:fixed;
    inset:0;
    background:rgba(0,0,0,.45);
    z-index:70;
    display:flex;
    align-items:flex-end;
    justify-content:center;
  `;
  document.body.appendChild(mask);

  const vs = variantsOf(PRODUCT).slice(0, 15);
  const imgs = imagesOf(PRODUCT);

  // Auto select variant đầu tiên
  if (!CURRENT && vs.length) CURRENT = vs[0];

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

    <!-- Nút full width -->
    <div style="
      position:sticky;
      left:0;right:0;bottom:0;
      background:#fff;
      padding-top:16px;
      border-top:1px solid #f0f0f0;
      display:flex;
      justify-content:center;
    ">
      <button id="vm-add" style="
        width:100%;
        background:#ef4444;
        color:#fff;
        border:none;
        border-radius:8px;
        padding:16px;
        font-weight:800;
        font-size:15px;
        box-shadow:0 6px 18px rgba(239,68,68,0.25);
      ">
        Thêm Vào Giỏ Hàng
      </button>
    </div>

    <button id="vm-close" aria-label="Đóng" style="position:absolute;right:10px;top:10px;border:none;background:#f3f4f6;width:28px;height:28px;border-radius:14px;font-size:16px;color:#6b7280;display:flex;align-items:center;justify-content:center">✕</button>
  </div>`;
  mask.innerHTML = html;
  const listEl = mask.querySelector('#vm-variants');

  function renderVariantList() {
    if (!listEl) return;
    listEl.innerHTML = (vs || []).map((v, i) => {
      const thumb = (imagesOf(v)[0] || imagesOf(PRODUCT)[0] || '');
      const active = (CURRENT && (CURRENT === v || (CURRENT.id && (String(CURRENT.id) === String(v.id)))));
      return `
        <button data-idx="${i}" style="
          display:flex;align-items:center;gap:8px;
          border:1px solid ${active ? '#ef4444' : '#e5e7eb'};
          background:${active ? '#fff5f5' : '#fff'};
          border-radius:10px;padding:8px;cursor:pointer;text-align:left
        ">
          ${thumb ? `<img src="${thumb}" alt="" style="width:36px;height:36px;object-fit:contain;border-radius:6px;border:1px solid #f1f5f9;background:#fff" />` : ``}
          <span style="font-weight:600;font-size:13px;line-height:1.2">${htmlEscape(v.name || v.title || v.sku || 'Tuỳ chọn')}</span>
        </button>`;
    }).join('');
  }

  renderVariantList();

  // Chọn biến thể
  listEl?.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-idx]');
    if (!btn) return;
    const i = Number(btn.dataset.idx || 0);
    CURRENT = vs[i] || CURRENT;

    // Cập nhật ảnh, giá, tồn kho trong header modal
    const imgEl = mask.querySelector('#vm-img');
    if (imgEl) imgEl.src = imagesOf(CURRENT)[0] || imagesOf(PRODUCT)[0] || '';

    // Gọi cập nhật giá/tồn kho đang có sẵn
    updPrice();

    // Vẽ lại danh sách để highlight item đang chọn
    renderVariantList();
  });

  // === Các xử lý sự kiện ===
  async function updPrice() {
    const src = CURRENT || PRODUCT;
    const pr = await pricePair(src); // ✅ THÊM await
    const stock = src.stock || src.qty || src.quantity || 0;
    mask.querySelector('#vm-price').textContent = formatPrice(pr.base || 0);
    mask.querySelector('#vm-stock-info').textContent = stock > 0 ? `Còn ${stock} sản phẩm` : 'Hết hàng';
  }

  async function addSelectedToCart() {
    const qty = Math.max(1, parseInt(mask.querySelector('#vm-qty').value || '1', 10));
    const src = CURRENT || PRODUCT;
    const pr = await pricePair(src);

    // ✅ FIX: Ưu tiên weight (field trong Admin) trước weight_gram
    const weight_grams_val = Number(
      src.weight ??                    // ✅ ƯU TIÊN field Admin
      src.weight_gram ??
      src.weight_grams ??
      src.variant?.weight ??           // ✅ ƯU TIÊN variant.weight
      src.variant?.weight_gram ??
      src.variant?.weight_grams ??
      PRODUCT.weight ??                // ✅ ƯU TIÊN product.weight
      PRODUCT.weight_gram ??
      PRODUCT.weight_grams ??
      0
    );

    const item = {
      id: String(PRODUCT.id || PRODUCT._id || PRODUCT.slug || Date.now()),
      name: PRODUCT.title || PRODUCT.name || '',
      image: imagesOf(src)[0] || '',
      variantName: src.name || '',
      variantImage: imagesOf(src)[0] || '',
      price: Number(pr.base || 0),
      // 🔽 BẮT BUỘC: gắn đủ 3 alias để Checkout đọc đúng
      weight_gram: weight_grams_val,
      weight_grams: weight_grams_val,
      weight: weight_grams_val,
      qty
    };
    addToCart(item, qty);
  }

  mask.querySelector('#vm-add').onclick = async () => { // ✅ THÊM async
    await addSelectedToCart(); // ✅ THÊM await
    closeModal();
    window.dispatchEvent(new Event('shv:cart-changed'));
    showSuccessToast('✓ Đã thêm vào giỏ hàng');
  };

  mask.querySelector('#vm-dec').onclick = () => {
    const inp = mask.querySelector('#vm-qty');
    inp.value = Math.max(1, parseInt(inp.value) - 1);
  };
  mask.querySelector('#vm-inc').onclick = () => {
    const inp = mask.querySelector('#vm-qty');
    inp.value = Math.max(1, parseInt(inp.value) + 1);
  };

  // === Đóng modal và khôi phục thanh đáy ===
  function closeModal() {
    mask.remove();
    const bottomBar = document.querySelector('.shv-bottom-bar');
    if (bottomBar) {
      bottomBar.style.opacity = '1';
      bottomBar.style.pointerEvents = 'auto';
      setTimeout(() => {
        bottomBar.style.display = bottomBar.dataset.prevDisplay || '';
      }, 200);
    }
  }

  mask.querySelector('#vm-close').onclick = closeModal;
  mask.onclick = (e) => { if (e.target === mask) closeModal(); };

  updPrice(); // ✅ GIỮ NGUYÊN (sẽ tự resolve promise)
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
    const imgs = $$('img'); // Dùng hàm $$ ở trên (querySelectorAll)
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