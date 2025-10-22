
// === SHV perf helper ===
function cloudify(u, t='w_800,dpr_auto,q_auto,f_auto') {
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
// IMPORT PRICE FUNCTIONS - THÊM ĐOẠN NÀY
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
  
  // ✅ Aspect ratio 16:9 cho desktop, 4:3 cho mobile
  const isMobile = window.innerWidth < 768;
  const aspectRatio = isMobile ? '75%' : '42.5%'; // 4:3 mobile, 16:9 desktop
  bannerWrap.style.paddingBottom = aspectRatio;
  
  bannerWrap.innerHTML = `<div id="banner-track" style="position:absolute;top:0;left:0;width:100%;height:100%;display:flex;transition:transform 0.7s ease-in-out;"></div>`;
  
  const track = document.getElementById('banner-track');
  
  items.forEach(b => {
    const d = document.createElement('div');
    d.style.cssText = 'min-width:100%;width:100%;height:100%;overflow:hidden;border-radius:12px;';
    
    const imgHtml = `<img 
      src="${b.image||b.url}" 
      alt="${b.alt||'banner'}" 
      style="width:100%;height:100%;object-fit:cover;object-position:center;"
      loading="${items.indexOf(b)===0?'eager':'lazy'}"
    />`;
    
    d.innerHTML = b.link 
      ? `<a href="${b.link}" target="_blank" rel="noopener" style="display:block;width:100%;height:100%;">${imgHtml}</a>`
      : imgHtml;
    
    track.appendChild(d);
  });
  
  // ===== CHÈN ĐOẠN NÀY - BẮT ĐẦU =====
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
  // ===== CHÈN ĐOẠN NÀY - KẾT THÚC =====
  
  // ===== CHÈN ĐOẠN NÀY - BẮT ĐẦU (NÚT PREV/NEXT) =====
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
  // ===== CHÈN ĐOẠN NÀY - KẾT THÚC (NÚT PREV/NEXT) =====
  
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
  
  // ✅ Resize handler
  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      const newIsMobile = window.innerWidth < 768;
      const newAspectRatio = newIsMobile ? '75%' : '42.5%';
      bannerWrap.style.paddingBottom = newAspectRatio;
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
await hydratePrices(items);
// truyền mảng ID để chắc chắn
await hydrateSoldAndRating(items.map(p => p.id || p.key || '').filter(Boolean));
}
} // ← đóng function loadNew()

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
  await hydratePrices(filtered);
  await hydrateSoldAndRating(filtered.map(p => p.id || p.key || '').filter(Boolean));
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
// --- Price hydration: fetch full product if summary lacks prices/variants ---
const __priceCache = new Map();
async function fetchFullProduct(id){
  if (!id) return null;
  if (__priceCache.has(id)) return __priceCache.get(id);

  const paths = [
    `/public/products/${encodeURIComponent(id)}`,
    `/products/${encodeURIComponent(id)}`,
    `/public/products?id=${encodeURIComponent(id)}`,
    `/products?id=${encodeURIComponent(id)}`,
  ];

  let item = null;
  let debugPath = '';
  for (const p of paths) {
    try {
      const data = await api(p);
      const found = data?.item || data?.data || data?.product
                 || (Array.isArray(data?.items)  ? data.items[0]  : null)
                 || (Array.isArray(data?.products)? data.products[0]: null);
      if (found) { item = found; debugPath = p; break; }
    } catch {}
  }

  // bật log một lần để bạn biết endpoint nào thành công (có thể tắt sau khi ok)
  if (!item) {
    console.warn('[hydrate] Không lấy được chi tiết cho', id, '→ kiểm tra API');
  } else {
    console.log('[hydrate] dùng', debugPath, '→', id);
  }

  __priceCache.set(id, item);
  return item;
}


function priceHtmlFrom(p){
  const toNum = (x)=> (typeof x==='string' ? (Number(x.replace(/[^\d.-]/g,''))||0) : Number(x||0));
  const getMin = (prod)=>{
    const vars = Array.isArray(prod?.variants) ? prod.variants
               : Array.isArray(prod?.options)  ? prod.options
               : Array.isArray(prod?.skus)     ? prod.skus : [];
    const cand = [];
    const push = v => { const n = toNum(v); if (n>0) cand.push(n); };
    
    // CHỈ lấy giá từ variants
    if (vars.length){
      for (const v of vars){
        push(v.price_sale ?? v.sale_price ?? v.sale);
        push(v.price ?? v.unit_price);
      }
    }
    
    return cand.length ? Math.min(...cand) : 0;
  };

  try{
    // 1) Giá theo nhóm khách nếu có
    if (typeof formatPriceByCustomer === 'function') {
      const html = formatPriceByCustomer(p, null);
      // nếu formatter trả 0đ/để trống → Fallback
      if (html && !/0\s*đ/i.test(html)) return html;
    }

    // 2) Fallback cứng: min(sale, price, cost) trên biến thể/sản phẩm
    const n = getMin(p);
    return `<div><b class="text-rose-600">${n.toLocaleString('vi-VN')}đ</b></div>`;
  }catch{
    return `<div><b class="text-rose-600">0đ</b></div>`;
  }
}

async function hydratePrices(items){
  try{
    const list = Array.isArray(items)?items:[];
    for(const p of list){
      const id = String(p.id||p.key||'');
      const probe = minVarPrice(p);
      const hasPrice = (probe && (probe.sale>0 || probe.regular>0)) || Number(p?.price_sale||p?.sale_price||p?.price||0)>0;
      if(hasPrice) continue;
      const full = await fetchFullProduct(id);
      if(!full) continue;
      const html = priceHtmlFrom(full);
      document.querySelectorAll(`.price[data-id="${(window.CSS && CSS.escape ? CSS.escape(id) : id)}"]`).forEach(node => node.innerHTML = html);
    }
  }catch(e){ /* silent */ }
}
// [BẮT ĐẦU CHÈN] Bơm số đã bán & rating sau render
// Nhận: array ID (string) hoặc lấy từ DOM nếu không truyền vào
async function hydrateSoldAndRating(items){
  // nếu items là mảng object => convert sang mảng id
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
    if (!Number.isFinite(ratingAvg) || ratingAvg <= 0) ratingAvg = 5.0; // ✅ mặc định 5.0

    if (soldEl)   soldEl.textContent   = `Đã bán ${sold.toLocaleString('vi-VN')}`;
    if (ratingEl) ratingEl.textContent = `⭐ ${ratingAvg.toFixed(1)} (${ratingCount})`;
  }
}
// [KẾT THÚC CHÈN]


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
	<span class="js-rating" data-id="${id}">⭐ 5.0 (0)</span>
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

// Policy section content (static for now)
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


// --- v25 runtime fixes (no HTML/CSS changes) ---
document.addEventListener('DOMContentLoaded', ()=>{
  // Banner overflow guard on .hero
  try {
    const hero = document.querySelector('.hero');
    if (hero) { hero.style.overflow='hidden'; }
    document.querySelectorAll('.hero img, .hero video').forEach(el=>{
      el.style.objectFit='cover'; el.style.width='100%'; el.style.height='100%'; el.style.maxHeight='520px';
    });
  } catch {}

  // Mobile hamburger top-left; toggle open/close; auto-close on scroll/blur
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

// Ensure PLP shows lowest sale price among variants
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

// lazy-load all images by default
new MutationObserver(()=>{
  document.querySelectorAll('img:not([loading])').forEach(img=> img.setAttribute('loading','lazy'));
}).observe(document.documentElement, { subtree:true, childList:true });


// v26 banner + mobile + price upgrades
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

  setTimeout(async ()=>{
  document.querySelectorAll('[data-card-id]').forEach(async card=>{
    const priceBox = card.querySelector('[data-price]');
    if(!priceBox) return;
    if(/\b0đ\b|Liên hệ/.test(priceBox.textContent||'')){
      const id = card.getAttribute('data-card-id');
      try{
        const paths = [`/public/products/${id}`, `/products/${id}`];
        let data=null;
        for(const p of paths){ try{ const r=await api(p); if(r && !r.error){ data=r; break; } }catch{} }
        const pr = (data?.item||data?.data||data||{});
        const vs = Array.isArray(pr.variants)?pr.variants:[];
        
        // CHỈ lấy từ variants
        if(!vs.length){ 
          priceBox.innerHTML = `<b>Liên hệ</b>`; 
          return; 
        }
        
        let s=null, r=null;
        vs.forEach(v=>{ 
          const sv=v.sale_price??v.price_sale??null; 
          const rv=v.price??null; 
          if(sv!=null) s=(s==null?sv:Math.min(s,sv)); 
          if(rv!=null) r=(r==null?rv:Math.min(r,rv)); 
        });
        
        const val = (s && r && s<r) 
          ? `${s.toLocaleString()}đ <span class="line-through opacity-70 ml-1">${r.toLocaleString()}đ</span>`
          : `${(s||r||0).toLocaleString()}đ`;
        priceBox.innerHTML = `<b>${val}</b>`;
        }catch{}
      }
    });
  }, 400);
});

// ===== v27: Homepage runtime polish =====
document.addEventListener('DOMContentLoaded', ()=>{
  // A) Banner: single column & media cover
  (function(){
    const sec = document.getElementById('banner');
    if (sec){
      const want = ['max-w-6xl','mx-auto','px-4','py-4','hero'];
      const set = new Set((sec.className||'').split(/\s+/).filter(Boolean));
      want.forEach(c=>set.add(c)); sec.className = Array.from(set).join(' ');
    }
    const wrap = document.getElementById('banner-wrap') || document.querySelector('#banner .grid') || document.querySelector('#banner div');
    if (wrap){
      wrap.style.gridTemplateColumns = '1fr';
      wrap.style.width = '100%';
      Array.from(wrap.children).forEach((c,i)=>{
        const hasMedia = c.querySelector('img,video,iframe,svg');
        if(!hasMedia && i>0){ c.style.display='none'; }
      });
    }
    function fitHero(){
      document.querySelectorAll('#banner img, #banner video').forEach(el=>{
        el.style.objectFit='cover'; el.style.width='100%'; el.style.height='100%'; el.loading='lazy';
      });
      const hero = document.querySelector('#banner'); if(hero) hero.style.overflow='hidden';
    }
    fitHero(); window.addEventListener('resize', fitHero);
  })();

  // B) Mobile hamburger: pin top-left; create if missing
  (function(){
    const nav = document.getElementById('mobile-menu') || document.querySelector('[data-mobile-nav]');
    let btn = document.querySelector('[data-hamburger]') || document.getElementById('hamburger') || document.getElementById('mobile-menu-btn');
    if(!btn){
      btn = document.createElement('button');
      btn.id='__shv_hamburger';
      btn.textContent='☰';
      btn.setAttribute('aria-label','Menu');
      btn.style.cssText = 'position:fixed;left:12px;top:12px;z-index:9999;border-radius:12px;padding:6px 10px;background:#111827;color:#fff;opacity:.9';
      document.body.appendChild(btn);
    } else {
      btn.style.position='fixed'; btn.style.left='12px'; btn.style.top='12px'; btn.style.zIndex='9999';
    }
    if(nav){
      const toggle = ()=>{ const d=getComputedStyle(nav).display; nav.style.display=(d==='none'?'block':'none'); };
      btn.addEventListener('click', (e)=>{ e.preventDefault(); e.stopPropagation(); toggle(); });
      ['click','scroll','blur'].forEach(ev=> window.addEventListener(ev, ()=>{ nav.style.display='none'; }));
    }
  })();

  // C) Card price: show min–max; lazy fix 0đ
  (function(){
    function range(p){
      const vs = Array.isArray(p.variants)?p.variants:[];
      let minS, maxS, minR, maxR;
      for(const v of vs){
        const s = v.sale_price ?? v.price_sale ?? null;
        const r = v.price ?? null;
        if(s!=null){ minS = (minS==null? s: Math.min(minS,s)); maxS = (maxS==null? s: Math.max(maxS,s)); }
        if(r!=null){ minR = (minR==null? r: Math.min(minR,r)); maxR = (maxR==null? r: Math.max(maxR,r)); }
      }
      return {minS,maxS,minR,maxR};
    }
    const fmt = (n)=> Number(n||0).toLocaleString('vi-VN')+'đ';
    // initial pass
    document.querySelectorAll('[data-card-id]').forEach(card=>{
      const priceBox = card.querySelector('[data-price]'); if(!priceBox) return;
      const min = card.getAttribute('data-min'), max = card.getAttribute('data-max');
      if(min && max && min!==max) priceBox.innerHTML = `<b>${fmt(min)} - ${fmt(max)}</b>`;
    });
    // lazy correction
    setTimeout(async ()=>{
      const cards = Array.from(document.querySelectorAll('[data-card-id]'));
      for (const card of cards){
        const priceBox = card.querySelector('[data-price]'); if(!priceBox) continue;
        if(/\b0đ\b/.test(priceBox.textContent||'')){
          const id = card.getAttribute('data-card-id');
          const paths = [`/public/products/${id}`, `/products/${id}`, `/public/product?id=${id}`, `/product?id=${id}`];
          let data=null;
          for(const p of paths){ try{ const r=await api(p); if(r && !r.error){ data=r; break; } }catch{} }
          const pr = (data?.item||data?.data||data||{});
          const {minS,maxS,minR} = range(pr);
          let html='';
          if(minS!=null){
            html = (maxS && maxS>minS) ? `<b>${fmt(minS)} - ${fmt(maxS)}</b>` : `<b>${fmt(minS)}</b>`;
            if(minR!=null && minR>minS) html += ` <span class="line-through opacity-70 ml-1">${fmt(minR)}</span>`;
          }else{
            html = `<b>${fmt(minR)}</b>`;
          }
          priceBox.innerHTML = html;
        }
      }
    }, 300);
  })();
});


// v28 banner hard clamp & hamburger-in-header
document.addEventListener('DOMContentLoaded', ()=>{
  if(document.querySelector('.header-shop')) return; // header already has its own menu
  // Hard clamp: only first banner cell visible
  try{
    const wrap = document.getElementById('banner-wrap');
    if(wrap){ Array.from(wrap.children).forEach((c,i)=>{ if(i>0) c.style.display='none'; }); }
  }catch{}

  // If there's a header, re-parent hamburger into it to avoid overlap with logo
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

// v29: banner responsive + hamburger doesn't overlap logo
document.addEventListener('DOMContentLoaded', ()=>{
  // Banner: keep 16:9 by default, scale with container; no overflow
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

  // Hamburger vs logo
  (function(){
    const header = document.querySelector('header, .header, .topbar, nav');
    const logo = header?.querySelector('img[alt], .logo, [data-logo], h1, .brand');
    const btn = document.querySelector('[data-hamburger], #hamburger, #mobile-menu-btn, #__shv_hamburger');
    if(header && logo && btn){
      header.style.position = header.style.position || 'relative';
      btn.style.position='absolute'; btn.style.left='8px'; btn.style.top='8px'; btn.style.zIndex='50';
      logo.style.marginLeft = '40px'; // reserve space for hamburger
    }
    const nav = document.getElementById('mobile-menu') || document.querySelector('[data-mobile-nav]');
    if(btn && nav){
      const toggle=()=>{ const d=getComputedStyle(nav).display; nav.style.display=(d==='none'?'block':'none'); };
      btn.addEventListener('click', (e)=>{ e.preventDefault(); e.stopPropagation(); toggle(); });
      ['click','scroll','blur'].forEach(ev=> window.addEventListener(ev, ()=>{ nav.style.display='none'; }));
    }
  })();
});
