import api from './lib/api.js';

const bannerWrap  = document.getElementById('banner-wrap');
const newWrap     = document.getElementById('new-products');
const allWrap     = document.getElementById('all-products');
const loadMoreBtn = document.getElementById('load-more');
const searchInput = document.getElementById('shv-search');
const filterInput = document.getElementById('quick-filter');

let cursor = null;
let allCache = [];

// Banners (public)
async function loadBanners() { if(!bannerWrap) return;
  let data = await api('/banners');
  if (!data || data.ok===false) data = await api('/public/banners');
  const items = (data && (data.items || data.banners || data.data)) || [];
  bannerWrap.style.overflow='hidden'; bannerWrap.innerHTML = `<div id=\"banner-track\" class="flex transition-transform duration-700 ease-in-out"></div>`;
  const track = document.getElementById('banner-track');
  items.forEach(b=>{ const d=document.createElement('div'); d.className='min-w-full overflow-hidden rounded-xl border'; d.innerHTML = (b.link?`<a href="${b.link}" target="_blank" rel="noopener">`:'') + `<img src="${b.image||b.url}" class="w-full h-52 object-cover" alt="${b.alt||'banner'}"/>` + (b.link?`</a>`:''); track.appendChild(d); });
  let idx=0; setInterval(()=>{ idx=(idx+1)%Math.max(items.length,1); track.style.transform='translateX(' + (-idx*100) + '%)'; }, 3500);
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
  let data = await api('/products?limit=8');
  if (!data || data.ok===false) data = await api('/public/products?limit=8');
  const items = (data.items || data.products || data.data || []).slice(0,8);
  newWrap.innerHTML = items.map(card).join('');
  hydratePrices(items);
}

// All products with pagination
async function loadAll(){ if(!allWrap||!loadMoreBtn) return; 
  let data = await api('/products?limit=24' + (cursor ? '&cursor='+encodeURIComponent(cursor) : ''));
  if (!data || data.ok===false) data = await api('/public/products?limit=24' + (cursor ? '&cursor='+encodeURIComponent(cursor) : '') + (new URL(location.href).searchParams.get('cat') ? '&category='+encodeURIComponent(new URL(location.href).searchParams.get('cat')) : ''));
  const items = data.items || data.products || data.data || [];
  cursor = data.cursor || data.next || null;
  allCache.push(...items);
  renderAll();
  loadMoreBtn.style.display = cursor ? 'inline-flex' : 'none';
}

function renderAll(){ if(!allWrap) return; 
  const q = (searchInput?.value || '').toLowerCase();
  const f = (filterInput?.value || '').toLowerCase();
  const filtered = allCache.filter(p => {
    const t = (p.title||p.name||'').toLowerCase();
    const slug = String(p.slug||'').toLowerCase();
    return (!q || t.includes(q) || slug.includes(q)) && (!f || t.includes(f));
  });
  allWrap.innerHTML = filtered.map(card).join('');
  hydratePrices(filtered);
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
  const mv = minVarPrice(p)||{}; const s = Number(mv.sale ?? p.price_sale ?? 0); const r = Number(mv.regular ?? p.price ?? 0);
  if (s && s<r) return `<div><b>${s.toLocaleString()}đ</b> <span class="text-sm line-through opacity-70">${r.toLocaleString()}đ</span></div>`;
  return `<div data-price><b>${(r||s||0).toLocaleString()}đ</b></div>`;
}
// --- Price hydration: fetch full product if summary lacks prices/variants ---
const __priceCache = new Map();
async function fetchFullProduct(id){
  if(!id) return null;
  if(__priceCache.has(id)) return __priceCache.get(id);
  try{
    let data = await api('/products?id='+encodeURIComponent(id));
    if(!data || data.ok===false) data = await api('/public/products?id='+encodeURIComponent(id));
    const item = data?.item || data?.data || data?.product || null;
    __priceCache.set(id, item);
    return item;
  }catch{ return null; }
}

function priceHtmlFrom(p){
  const mv = minVarPrice(p)||{};
  const s = Number(mv.sale ?? p?.price_sale ?? p?.sale_price ?? 0);
  const r = Number(mv.regular ?? p?.price ?? 0);
  if (s && r && s<r){
    return `<div><b class="text-rose-600">${s.toLocaleString('vi-VN')}đ</b> <span class="line-through opacity-70 text-sm">${r.toLocaleString('vi-VN')}đ</span></div>`;
  }
  const base = (s||r||0);
  return `<div><b class="text-rose-600">${base.toLocaleString('vi-VN')}đ</b></div>`;
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


function card(p){
  const img = (p.images && p.images[0]) || '/assets/no-image.svg';
  const u = `/product.html?id=${encodeURIComponent(p.id||p.key||'')}`;
  return `<a href="${u}" class="block border rounded-xl overflow-hidden bg-white" data-card-id="${encodeURIComponent(p.id||p.key||'')}">
    <img src="${img}" class="w-full h-48 object-cover" alt="${p.title||p.name||''}"/>
    <div class="p-3">
      <div class="font-semibold text-sm line-clamp-2 min-h-[40px]">${p.title||p.name||''}</div>
      <div class="mt-1 text-blue-600 price" data-id="${(p.id||p.key||'')}">${priceStr(p)}</div>
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
      if(/\b0đ\b/.test(priceBox.textContent||'')){
        const id = card.getAttribute('data-card-id');
        try{
          const paths = [`/public/products/${id}`, `/products/${id}`, `/public/product?id=${id}`, `/product?id=${id}`];
          let data=null;
          for(const p of paths){ try{ const r=await api(p); if(r && !r.error){ data=r; break; } }catch{} }
          const pr = (data?.item||data?.data||data||{});
          const vs = Array.isArray(pr.variants)?pr.variants:[];
          let s=null, r=null;
          vs.forEach(v=>{ const sv=v.sale_price??v.price_sale??null; const rv=v.price??null; if(sv!=null) s=(s==null?sv:Math.min(s,sv)); if(rv!=null) r=(r==null?rv:Math.min(r,rv)); });
          const val = (s && r && s<r) ? (`${(s).toLocaleString()}đ <span class="line-through opacity-70 ml-1">${r.toLocaleString()}đ</span>`)
                  : ((r||s||0).toLocaleString()+'đ');
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
