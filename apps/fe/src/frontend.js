// === SHV perf helper ===
function cloudify(u, t='w_800,dpr_auto,q_auto,f_auto') {
	/**
 * Chọn kích thước banner tối ưu theo device
 * Desktop: 1600x900 (16:9)
 * Mobile: 800x600 (4:3)
 */
function getOptimalBannerSize() {
  const isMobile = window.innerWidth < 768;
  
  if (isMobile) {
    return {
      width: 800,
      height: 600,
      aspectRatio: '4:3',
      paddingBottom: '75%'
    };
  } else {
    return {
      width: 1600,
      height: 900,
      aspectRatio: '16:9',
      paddingBottom: '42.5%'
    };
  }
}

/**
 * Tối ưu hóa ảnh banner với Cloudinary theo kích thước device
 */
function cloudifyBanner(url) {
  if (!url) return url;
  
  const size = getOptimalBannerSize();
  const transform = `w_${size.width},h_${size.height},c_fill,q_auto,f_auto`;
  
  return cloudify(url, transform);
}

  try {
    if (!u) return u;
    const base = (typeof location!=='undefined' && location.origin) ? location.origin : 'https://shophuyvan1.pages.dev';
    const url = new URL(u, base);
    if (!/res\.cloudinary\.com/i.test(url.hostname)) return u;
    if (/\/upload\/[^/]+\//.test(url.pathname)) return url.toString();
    url.pathname = url.pathname.replace('/upload/', '/upload/' + t + '/');
    return url.toString();
  } catch(e) { return u; }
}
// ===================================================================
// IMPORT PRICE FUNCTIONS
// ===================================================================
import { formatPriceByCustomer, pickPriceByCustomer } from './lib/price.js';
import api from './lib/api.js';

const bannerWrap  = document.getElementById('banner-wrap');
const newWrap     = document.getElementById('new-products');
const allWrap     = document.getElementById('all-products');
const loadMoreBtn = document.getElementById('load-more');
const searchInput = document.getElementById('shv-search');
const filterInput = document.getElementById('quick-filter');

let cursor = null;
let allCache = [];

// Banners (public) - ✅ FIXED RESPONSIVE
async function loadBanners() { 
  if(!bannerWrap) return;
  
  let data = await api('/banners');
  if (!data || data.ok===false) data = await api('/public/banners');
  const items = (data && (data.items || data.banners || data.data)) || [];
  
  // ✅ Tạo container với aspect ratio cố định
  bannerWrap.style.overflow='hidden';
  bannerWrap.style.position='relative';
  bannerWrap.style.width='100%';
  
  // ✅ Sử dụng hàm getOptimalBannerSize()
  const size = getOptimalBannerSize();
  bannerWrap.style.paddingBottom = size.paddingBottom;
  
  bannerWrap.innerHTML = `<div id="banner-track" style="position:absolute;top:0;left:0;width:100%;height:100%;display:flex;transition:transform 0.7s ease-in-out;"></div>`;
  
  const track = document.getElementById('banner-track');
  
  items.forEach(b => {
    const d = document.createElement('div');
    d.style.cssText = 'min-width:100%;width:100%;height:100%;overflow:hidden;border-radius:12px;';
    
    // ✅ Sử dụng cloudifyBanner thay vì cloudify
    const optimizedUrl = cloudifyBanner(b.image || b.url);
    
    const imgHtml = `<img 
      src="${optimizedUrl}" 
      alt="${b.alt||'banner'}" 
      data-original-src="${b.image||b.url}"
      style="width:100%;height:100%;object-fit:cover;object-position:center;"
      loading="${items.indexOf(b)===0?'eager':'lazy'}"
    />`;
    
    d.innerHTML = b.link 
      ? `<a href="${b.link}" target="_blank" rel="noopener" style="display:block;width:100%;height:100%;">${imgHtml}</a>`
      : imgHtml;
    
    track.appendChild(d);
  });
  
  // ===== CHỌN ĐOẠN NÀY - BẮT ĐẦU =====
  // ✅ Thêm dots indicator
  let dotsContainer = null;
  if (items.length > 1) {
    dotsContainer = document.createElement('div');
    dotsContainer.style.cssText = 'position:absolute;bottom:12px;left:50%;transform:translateX(-50%);display:flex;gap:8px;z-index:10;';
    
    items.forEach((_, i) => {
      const dot = document.createElement('div');
      dot.className = 'banner-dot';
      dot.dataset.index = i;
      dot.style.cssText = `width:10px;height:10px;border-radius:50%;background:${i===0?'#fff':'rgba(255,255,255,0.5)'};transition:all 0.3s;cursor:pointer;box-shadow:0 2px 4px rgba(0,0,0,0.2);`;
      dotsContainer.appendChild(dot);
    });
    
    bannerWrap.appendChild(dotsContainer);
  }
  // ===== CHỌN ĐOẠN NÀY - KẾT THÚC =====
  
  // ===== CHỌN ĐOẠN NÀY - BẮT ĐẦU (NÚT PREV/NEXT) =====
  // ✅ Thêm nút prev/next
  if (items.length > 1) {
    const btnStyle = 'position:absolute;top:50%;transform:translateY(-50%);background:rgba(0,0,0,0.6);color:#fff;border:none;width:40px;height:40px;border-radius:50%;cursor:pointer;z-index:10;font-size:28px;display:flex;align-items:center;justify-content:center;transition:all 0.3s;backdrop-filter:blur(4px);';
    
    const prevBtn = document.createElement('button');
    prevBtn.innerHTML = '‹';
    prevBtn.setAttribute('aria-label', 'Previous');
    prevBtn.style.cssText = btnStyle + 'left:12px;';
    prevBtn.onmouseenter = () => prevBtn.style.background = 'rgba(0,0,0,0.8)';
    prevBtn.onmouseleave = () => prevBtn.style.background = 'rgba(0,0,0,0.6)';
    
    const nextBtn = document.createElement('button');
    nextBtn.innerHTML = '›';
    nextBtn.setAttribute('aria-label', 'Next');
    nextBtn.style.cssText = btnStyle + 'right:12px;';
    nextBtn.onmouseenter = () => nextBtn.style.background = 'rgba(0,0,0,0.8)';
    nextBtn.onmouseleave = () => nextBtn.style.background = 'rgba(0,0,0,0.6)';
    
    bannerWrap.appendChild(prevBtn);
    bannerWrap.appendChild(nextBtn);
    
    // Lưu reference cho dùng sau
    window._bannerNavBtns = { prevBtn, nextBtn };
  }
  // ===== CHỌN ĐOẠN NÀY - KẾT THÚC (NÚT PREV/NEXT) =====
  
  // ✅ Auto slide (với đồng bộ dots và nút)
  if (items.length > 1) {
    let idx = 0;
    
    // Hàm cập nhật dots
    function updateDots() {
      if (!dotsContainer) return;
      Array.from(dotsContainer.children).forEach((dot, i) => {
        dot.style.background = i === idx ? '#fff' : 'rgba(255,255,255,0.5)';
        dot.style.width = i === idx ? '12px' : '10px';
        dot.style.height = i === idx ? '12px' : '10px';
      });
    }
    
    // Hàm chuyển slide
    function goToSlide(newIdx) {
      idx = newIdx;
      track.style.transform = `translateX(-${idx * 100}%)`;
      updateDots();
    }
    
    // Click vào dots
    if (dotsContainer) {
      Array.from(dotsContainer.children).forEach((dot, i) => {
        dot.onclick = () => goToSlide(i);
      });
    }
    
    // Click vào nút prev/next
    if (window._bannerNavBtns) {
      window._bannerNavBtns.prevBtn.onclick = () => {
        goToSlide((idx - 1 + items.length) % items.length);
      };
      window._bannerNavBtns.nextBtn.onclick = () => {
        goToSlide((idx + 1) % items.length);
      };
    }
    
    // Auto slide mỗi 3.5s
    setInterval(() => {
      goToSlide((idx + 1) % items.length);
    }, 3500);
  }
  
  // ✅ Resize handler - tự động cập nhật kích thước
  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      const size = getOptimalBannerSize();
      bannerWrap.style.paddingBottom = size.paddingBottom;
      
      // Reload ảnh banner
      const img = bannerWrap.querySelector('img');
      if (img) {
        const originalSrc = img.getAttribute('data-original-src');
        if (originalSrc) {
          img.src = cloudifyBanner(originalSrc);
        }
      }
    }, 200);
  });
}


// Categories
async function loadCategories(){
  let data = await api('/public/categories');
  if(!data || data.ok===false || !Array.isArray(data.items)){
    try{ data = await (await fetch('./assets/categories.json',{cache:'no-store'})).json(); }
    catch(e){ data = {items:[]}; }
  }
  const cats = (data && data.items)||[];
  const nav = document.querySelector('nav.ml-6');
  if(nav){
    function renderSub(c){
      if(!Array.isArray(c.children)||!c.children.length) return '';
      return '<div class="pl-3">'+c.children.map(sc=>`<a class="block whitespace-nowrap py-1 hover:bg-gray-50" href="/?cat=${encodeURIComponent(sc.slug)}">${sc.name}</a>`).join('')+'</div>';
    }
    const wrap = document.createElement('div');
    wrap.className='relative';
    wrap.innerHTML = `<button id="catBtn" class="hover:text-blue-600">Danh mục ▾</button>
      <div id="catDrop" class="absolute hidden bg-white border rounded shadow p-2 mt-1 max-h-72 overflow-auto z-50"></div>`;
    const drop = wrap.querySelector('#catDrop');
    drop.innerHTML = cats.map(c=>`<a class="block whitespace-nowrap px-3 py-1 hover:bg-gray-50" href="/?cat=${encodeURIComponent(c.slug)}">${c.name}</a>`).join('');
    const btn = wrap.querySelector('#catBtn');
    btn.addEventListener('click', (e)=>{ e.preventDefault(); drop.classList.toggle('hidden'); });
    document.addEventListener('click', (e)=>{ if(!wrap.contains(e.target)) drop.classList.add('hidden'); });
    const links = nav.querySelectorAll('a');
    for(const a of links){ if(a.textContent.trim()==='Danh mục'){ a.replaceWith(wrap); break; } }
  }
  window.__CATS = cats;
}

// New arrivals (last 8)
async function loadNew(){ if(!newWrap) return; 
  let data = await api('/public/products?limit=8');
  if (!data || data.ok===false) data = await api('/products?limit=8');
  let items = (data.items || data.products || data.data || []);
  const now = Date.now();
  items = items.filter(p=>{
    const d=new Date(p.created_at||p.createdAt||p.updated_at||p.updatedAt||p.published_at||p.publishedAt||p.time||p.ts||0).getTime();
    return d && (now-d) <= 24*60*60*1000;
  }).slice(0,8);
  if (items.length === 0) {
  newWrap.parentElement?.classList?.add('hidden');
} else {
  newWrap.parentElement?.classList?.remove('hidden');
  newWrap.innerHTML = items.map(card).join('');
  await hydrateSoldAndRating(items.map(p => p.id || p.key || '').filter(Boolean));
  console.log('[PRICE] FE new', { tier: items?.[0]?.price_tier, price: items?.[0]?.price_display });
}
}

// All products with pagination
async function loadAll(){ if(!allWrap||!loadMoreBtn) return; 
  const cat = new URL(location.href).searchParams.get('cat');
  const catParam = cat ? '&category='+encodeURIComponent(cat) : '';
  let data = await api('/public/products?limit=24' + (cursor ? '&cursor='+encodeURIComponent(cursor) : '') + catParam);
  if (!data || data.ok===false) data = await api('/products?limit=24' + (cursor ? '&cursor='+encodeURIComponent(cursor) : '') + catParam);
  const items = data.items || data.products || data.data || [];
  cursor = data.cursor || data.next || null;
  allCache.push(...items);
  renderAll();
  loadMoreBtn.style.display = cursor ? 'inline-flex' : 'none';
}

async function renderAll(){ if(!allWrap) return; 
  const q = (searchInput?.value || '').toLowerCase();
  const f = (filterInput?.value || '').toLowerCase();
  const filtered = allCache.filter(p => {
    const t = (p.title||p.name||'').toLowerCase();
    const slug = String(p.slug||'').toLowerCase();
    return (!q || t.includes(q) || slug.includes(q)) && (!f || t.includes(f));
  });
  allWrap.innerHTML = filtered.map(card).join('');
  await hydrateSoldAndRating(filtered.map(p => p.id || p.key || '').filter(Boolean));
  console.log('[PRICE] FE all', { tier: filtered?.[0]?.price_tier, price: filtered?.[0]?.price_display, n: filtered.length });
}

function minVarPrice(p){
  try{
    const vars = Array.isArray(p.variants)?p.variants:[];
    if(!vars.length) return null;
    let minSale=null, minRegular=null;
    for(const v of vars){
      const sale = Number(v.sale_price||v.price_sale||v.salePrice||0)||null;
      const reg  = Number(v.price||v.regular_price||v.base_price||0)||null;
      if(sale!=null){ minSale = (minSale==null)?sale:Math.min(minSale, sale); }
      if(reg!=null){ minRegular = (minRegular==null)?reg:Math.min(minRegular, reg); }
    }
    return { sale:minSale, regular:minRegular };
  }catch{ return null; }
}

function priceStr(p) {
	// ƯU TIÊN GIÁ DO SERVER TÍNH TỪ VARIANTS
  if (Number.isFinite(p?.price_display)) {
    const price = Number(p.price_display) || 0;
    const cmp   = Number(p.compare_at_display) || 0;
    if (price <= 0) return `<div data-price><b>Liên hệ</b></div>`;
    if (cmp > price) {
      return `<div><b>${price.toLocaleString('vi-VN')}đ</b> <span class="text-sm line-through opacity-70">${cmp.toLocaleString('vi-VN')}đ</span></div>`;
    }
    return `<div data-price><b>${price.toLocaleString('vi-VN')}đ</b></div>`;
  }
  // ✅ SỬ DỤNG LOGIC GIÁ SỈ/LẺ MỚI
  if (typeof formatPriceByCustomer === 'function') {
    return formatPriceByCustomer(p, null);
  }
  
  // CHỈ lấy giá từ variants
  const mv = minVarPrice(p);
  if (!mv) return `<div data-price><b>Liên hệ</b></div>`;
  
  const s = Number(mv.sale || 0); 
  const r = Number(mv.regular || 0);
  
  if (s > 0 && s < r) {
    return `<div><b>${s.toLocaleString()}đ</b> <span class="text-sm line-through opacity-70">${r.toLocaleString()}đ</span></div>`;
  }
  
  const price = s || r;
  return price > 0 
    ? `<div data-price><b>${price.toLocaleString()}đ</b></div>`
    : `<div data-price><b>Liên hệ</b></div>`;
}

const __priceCache = new Map();
async function fetchFullProduct(id){
  try {
    if (!id) return null;
    if (__priceCache.has(id)) return __priceCache.get(id);

    const paths = [
      `/public/products/${encodeURIComponent(id)}`,
      `/products/${encodeURIComponent(id)}`
    ];

    let item = null;
    for (const p of paths) {
      try {
        const data = await api(p);
        const found = data?.item || data?.data || data?.product
                   || (Array.isArray(data?.items)  ? data.items[0]  : null)
                   || (Array.isArray(data?.products)? data.products[0]: null);
        if (found) { item = found; break; }
      } catch {}
    }

    __priceCache.set(id, item);
    return item;
  } catch {
    return null;
  }
}

function priceHtmlFrom(p){
  const toNum = (x)=> (typeof x==='string' ? (Number(x.replace(/[^\d.-]/g,''))||0) : Number(x||0));
  const getMin = (prod)=>{
    const vars = Array.isArray(prod?.variants) ? prod.variants
               : Array.isArray(prod?.options)  ? prod.options
               : Array.isArray(prod?.skus)     ? prod.skus : [];
    const cand = [];
    const push = v => { const n = toNum(v); if (n>0) cand.push(n); };
    
    if (vars.length){
      for (const v of vars){
        push(v.price_sale ?? v.sale_price ?? v.sale);
        push(v.price ?? v.unit_price);
      }
    }
    
    return cand.length ? Math.min(...cand) : 0;
  };

  try{
    if (typeof formatPriceByCustomer === 'function') {
      const html = formatPriceByCustomer(p, null);
      if (html && !/0\s*đ/i.test(html)) return html;
    }

    const n = getMin(p);
    return `<div><b class="text-rose-600">${n.toLocaleString('vi-VN')}đ</b></div>`;
  }catch{
    return `<div><b class="text-rose-600">0đ</b></div>`;
  }
}

async function hydratePrices() {
  try {
    return;
  } catch { return; }
}

const __HYDRATE_LOG__ = false;
const __logHydrate = (...args) => { if (__HYDRATE_LOG__) console.log('[hydrate]', ...args); };

async function hydrateSoldAndRating(items){
  let ids = [];
  if (Array.isArray(items) && items.length) {
    if (typeof items[0] === 'string') {
      ids = items.filter(Boolean);
    } else {
      ids = items.map(p => (p?.id || p?.key || '')).filter(Boolean);
    }
  } else {
    ids = Array.from(document.querySelectorAll('[data-id]'))
               .map(el => el.getAttribute('data-id'))
               .filter(Boolean);
  }

  for (const id of ids){
    const ratingEl = document.querySelector(`.js-rating[data-id="${id}"]`);
    const soldEl   = document.querySelector(`.js-sold[data-id="${id}"]`);
    if (!ratingEl && !soldEl) continue;

    const full = await fetchFullProduct(id);
    if (!full) continue;

    const toNum = (x)=> (typeof x === 'string' ? (Number(x.replace(/[^\d.-]/g,''))||0) : Number(x||0));
    const sold = toNum(full.sold ?? full.sales ?? full.sold_count ?? full.total_sold ?? full.order_count ?? 0);
    let ratingAvg   = Number(full.rating_avg ?? full.rating_average ?? full.rating);
    const ratingCount = toNum(full.rating_count ?? full.reviews ?? full.review_count ?? 0);
    if (!Number.isFinite(ratingAvg) || ratingAvg <= 0) ratingAvg = 5.0;

    if (soldEl)   soldEl.textContent   = `Đã bán ${sold.toLocaleString('vi-VN')}`;
    if (ratingEl) ratingEl.textContent = `★ ${ratingAvg.toFixed(1)} (${ratingCount})`;
  }
}

function card(p){
  const id  = p.id || p.key || '';
  const img = (p.images && p.images[0]) || '/assets/no-image.svg';
  const u   = `/product.html?id=${encodeURIComponent(id)}`;
  return `<a href="${u}" class="block border rounded-xl overflow-hidden bg-white" data-card-id="${encodeURIComponent(id)}">
    <img src="${img}" class="w-full h-48 object-cover" alt="${p.title||p.name||''}"/>
    <div class="p-3">
      <div class="font-semibold text-sm line-clamp-2 min-h-[40px]">${p.title||p.name||''}</div>
      <div class="mt-1 text-blue-600 price" data-id="${id}">${priceStr(p)}</div>
    </div>
    <div class="mt-1 flex items-center gap-3 text-sm text-gray-600">
	<span class="js-rating" data-id="${id}">★ 5.0 (0)</span>
    <span class="js-sold"   data-id="${id}">Đã bán 0</span>
    </div>
  </a>`;
}

// Events
loadMoreBtn?.addEventListener('click', loadAll);
searchInput?.addEventListener('input', renderAll);
filterInput?.addEventListener('input', renderAll);

(async () => {
  try {
    await loadBanners(); await loadCategories();
    await loadNew();
    await loadAll();
  } catch (e) { console.error(e); }
})();

// Policy section content
const policyBox = document.getElementById('policy-box');
if(policyBox){
  policyBox.innerHTML = `<ol class='list-decimal pl-5'>
<li><b>Chính sách Bảo mật</b> – Chúng tôi cam kết bảo vệ thông tin cá nhân của bạn...</li>
<li><b>Chính sách Đổi trả & Hoàn tiền</b> – Đổi/Trả trong 7–14 ngày...</li>
<li><b>Chính sách Vận chuyển</b> – Giao 1–3 ngày, phí theo địa chỉ...</li>
<li><b>Chính sách Bảo hành</b> – Bảo hành 14 ngày cho lỗi NSX.</li>
<li><b>Điều khoản & Điều kiện</b> – Khi sử dụng website, bạn đồng ý với các điều khoản chung.</li>
</ol>`;
}

document.addEventListener('DOMContentLoaded', ()=>{
  try {
    const hero = document.querySelector('.hero');
    if (hero) { hero.style.overflow='hidden'; }
    document.querySelectorAll('.hero img, .hero video').forEach(el=>{
      el.style.objectFit='cover'; el.style.width='100%'; el.style.height='100%'; el.style.maxHeight='520px';
    });
  } catch {}

  const btn = document.querySelector('[data-hamburger]') || document.getElementById('hamburger');
  const nav = document.getElementById('mobile-menu') || document.querySelector('[data-mobile-nav]');
  if (btn && nav){
    btn.style.position='fixed'; btn.style.left='12px'; btn.style.top='12px'; btn.style.zIndex='50';
    const toggle=()=>{ const d=getComputedStyle(nav).display; nav.style.display=(d==='none'?'block':'none'); };
    btn.addEventListener('click', toggle);
    window.addEventListener('scroll', ()=>{ nav.style.display='none'; });
    window.addEventListener('blur',  ()=>{ nav.style.display='none'; });
  }
});

function lowestSalePrice(p){
  const vs = Array.isArray(p.variants)? p.variants:[];
  const prices = vs.map(v => Number(v.price_sale||v.sale_price||v.price||0)).filter(n=>n>0);
  if(prices.length) return Math.min(...prices);
  return Number(p.price_sale||p.sale_price||p.price||0);
}

try{
  if(typeof renderAll==='function'){
    const _renderAll = renderAll;
    renderAll = function(){
      window.__useLowestSalePrice = true;
      return _renderAll();
    }
  }
}catch{}

new MutationObserver(()=>{
  document.querySelectorAll('img:not([loading])').forEach(img=> img.setAttribute('loading','lazy'));
}).observe(document.documentElement, { subtree:true, childList:true });

document.addEventListener('DOMContentLoaded', ()=>{
  const sec = document.getElementById('banner');
  if (sec){
    const want = ['max-w-6xl','mx-auto','px-4','py-4','hero'];
    const set = new Set((sec.className||'').split(/\s+/).filter(Boolean));
    want.forEach(c=>set.add(c));
    sec.className = Array.from(set).join(' ');
  }
  const wrap = document.getElementById('banner-wrap');
  if (wrap){
    wrap.style.gridTemplateColumns = '1fr';
    wrap.style.width = '100%';
  }
  function fitHero(){
    document.querySelectorAll('#banner img, #banner video').forEach(el=>{
      el.style.objectFit='cover'; el.style.width='100%'; el.style.height='100%';
      el.loading = 'lazy';
    });
  }
  fitHero(); window.addEventListener('resize', fitHero);

  const btn = document.querySelector('[data-hamburger]') || document.getElementById('mobile-menu-btn') || document.getElementById('hamburger');
  const nav = document.getElementById('mobile-menu') || document.querySelector('[data-mobile-nav]');
  if (btn && nav){
    btn.style.position='fixed'; btn.style.left='12px'; btn.style.top='12px'; btn.style.zIndex='9999';
    const toggle=()=>{ const d=getComputedStyle(nav).display; nav.style.display=(d==='none'?'block':'none'); };
    btn.addEventListener('click', (e)=>{ e.preventDefault(); e.stopPropagation(); toggle(); });
    window.addEventListener('click', ()=>{ nav.style.display='none'; });
    window.addEventListener('scroll', ()=>{ nav.style.display='none'; });
    window.addEventListener('blur',  ()=>{ nav.style.display='none'; });
  }
});

document.addEventListener('DOMContentLoaded', ()=>{
  if(document.querySelector('.header-shop')) return;
  try{
    const wrap = document.getElementById('banner-wrap');
    if(wrap){ Array.from(wrap.children).forEach((c,i)=>{ if(i>0) c.style.display='none'; }); }
  }catch{}

  try{
    const header = document.querySelector('header, .header, .topbar, nav');
    const btn = document.getElementById('__shv_hamburger') || document.querySelector('[data-hamburger], #hamburger, #mobile-menu-btn');
    if(header && btn && !header.contains(btn)){
      header.style.position = header.style.position || 'relative';
      btn.style.position='absolute'; btn.style.left='8px'; btn.style.top='8px';
      header.prepend(btn);
    }
  }catch{}
});

document.addEventListener('DOMContentLoaded', ()=>{
  (function(){
    const banner = document.getElementById('banner');
    const wrap = document.getElementById('banner-wrap') || banner?.querySelector('.grid');
    if(!banner) return;
    banner.style.overflow='hidden';
    let ratio = 9/16;
    function reflow(){
      const w = banner.clientWidth || window.innerWidth;
      const h = Math.max(180, Math.min(520, Math.round(w*ratio)));
      banner.style.minHeight = h+'px';
      banner.style.maxHeight = '520px';
      banner.style.height    = h+'px';
      (wrap? wrap : banner).style.gridTemplateColumns='1fr';
    }
    function fitMedia(){
      banner.querySelectorAll('img,video').forEach(el=>{
        el.style.objectFit='cover'; el.style.width='100%'; el.style.height='100%'; el.loading='lazy';
      });
    }
    reflow(); fitMedia();
    window.addEventListener('resize', ()=>{ reflow(); fitMedia(); });
  })();

  (function(){
    const header = document.querySelector('header, .header, .topbar, nav');
    const logo = header?.querySelector('img[alt], .logo, [data-logo], h1, .brand');
    const btn = document.querySelector('[data-hamburger], #hamburger, #mobile-menu-btn, #__shv_hamburger');
    if(header && logo && btn){
      header.style.position = header.style.position || 'relative';
      btn.style.position='absolute'; btn.style.left='8px'; btn.style.top='8px'; btn.style.zIndex='50';
      logo.style.marginLeft = '40px';
    }
    const nav = document.getElementById('mobile-menu') || document.querySelector('[data-mobile-nav]');
    if(btn && nav){
      const toggle=()=>{ const d=getComputedStyle(nav).display; nav.style.display=(d==='none'?'block':'none'); };
      btn.addEventListener('click', (e)=>{ e.preventDefault(); e.stopPropagation(); toggle(); });
      ['click','scroll','blur'].forEach(ev=> window.addEventListener(ev, ()=>{ nav.style.display='none'; }));
    }
  })();
});