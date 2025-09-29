// SHV_PATCH_11
// /* SHV_PDP_HIDE_HEADER */
(function(){try{
// SHV_PATCH: responsive width for checkout modal
(function(){
  try{
    const id='shv-co-responsive-style';
    if(!document.getElementById(id)){
      const st=document.createElement('style');
      st.id=id;
      st.textContent = `        /* modal width & margins */
        #shv-co-mask .co-modal{ box-sizing:border-box; width: calc(100vw - 32px); max-width: 600px; margin: 0 16px; }
        @media (min-width: 640px){ #shv-co-mask .co-modal{ width: calc(100vw - 64px); max-width: 760px; margin: 0 24px; } }
        @media (min-width: 1024px){ #shv-co-mask .co-modal{ width: calc(100vw - 96px); max-width: 840px; margin: 0 32px; } }
        /* form grid: 1 col mobile, 2 cols tablet/desktop */
        #shv-co-mask #co-form{ display:grid; grid-template-columns: 1fr; gap: 10px; }
        #shv-co-mask #co-form input, #shv-co-mask #co-form textarea{ width:100%; }
        @media (min-width: 768px){
          #shv-co-mask #co-form{ grid-template-columns: 1fr 1fr; gap: 12px; }
          #shv-co-mask #co-addr, #shv-co-mask #co-note{ grid-column: 1 / -1; }
        }
        /* widen and full-span location selects */
        #shv-co-mask #co-form #co-province-sel,
        #shv-co-mask #co-form #co-district-sel,
        #shv-co-mask #co-form #co-ward-sel{ grid-column: 1 / -1 !important; width:100% !important; }`; (document.head||document.documentElement).appendChild(st);
    }
  }catch(e){}
})();
  var b=document.body||document.documentElement;
  if(b && !b.classList.contains('pdp')) b.classList.add('pdp');
  var id='shv-pdp-hide-header';
  if(!document.getElementById(id)){
    var css = [
      'body.pdp header','body.pdp .topbar','body.pdp .site-header',
      'body.pdp .shv-header','body.pdp .navbar','body.pdp nav'
    ].join(',') + '{display:none !important;}';
    var s=document.createElement('style'); s.id=id; s.textContent=css;
    (document.head||document.documentElement).appendChild(s);
  }
}catch(_e){}})();
let PRODUCT = (window.PRODUCT||{}); let CURRENT = null;
import api from './lib/api.js';
// === Fixed Shipping Rate Table (weight in grams -> VND) ===
function SHV_getFixedQuotes(weightGrams){
  const kg = Math.max(1, Math.ceil(Number(weightGrams||0)/1000));
  const cap = Math.min(kg, 6);
  const table = {
    vtp: { name: 'Viettel Post', rates: {1:18000,2:23000,3:28000,4:33000,5:38000,6:43000} },
    spx: { name: 'SPX Express',  rates: {1:15000,2:25000,3:35000,4:45000,5:55000,6:65000} },
    jt:  { name: 'J&T Express',  rates: {1:20000,2:25000,3:25000,4:30000,5:35000,6:40000} },
    lex: { name: 'Lazada Express',rates: {1:19000,2:19000,3:19000,4:24000,5:27000,6:31000} },
    ghn: { name: 'GHN',           rates: {1:19000,2:19000,3:24000,4:29000,5:34000,6:39000} },
    best:{ name: 'BEST Express',  rates: {1:18000,2:18000,3:23000,4:28000,5:33000,6:33000} },
  };
  function extend(code){
    const r=table[code].rates; if(kg<=6) return r[cap];
    const step=(r[6]-r[5])||0; return r[6]+step*(kg-6);
  }
  const list = Object.entries(table).map(([code,info])=>({ provider: code, name: info.name, fee: kg<=6?info.rates[cap]:extend(code), eta:'' }));
  return list.filter(o=>o.fee>=0);
}
;

async function shvGetShippingOptions(provinceName, districtName, weightGram){
  try{
    return SHV_getFixedQuotes(weightGram);
  }catch(e){
    console.error(e);
    return [];
  }
}
import { formatPrice } from './lib/price.js';

const $  = (s, r=document)=>r.querySelector(s);
const $$ = (s, r=document)=>Array.from(r.querySelectorAll(s));

function q(key, def=''){
  const u = new URL(location.href);
  return u.searchParams.get(key) || def;
}
function toArr(a){ return Array.isArray(a) ? a : (a ? [a] : []); }
function num(x){ try{ if(x==null||x==='') return 0; return Number(String(x).replace(/\./g,'').replace(/,/g,'.'))||0; }catch{ return 0; } }
function pricePair(o){
  const sale = num(o.sale_price ?? o.price_sale ?? o.sale ?? 0);
  const reg  = num(o.price ?? o.regular_price ?? o.base_price ?? 0);
  if (sale > 0) {
    return { base: sale, original: (reg > 0 ? reg : null) };
  }
  if (reg > 0) {
    return { base: reg, original: null };
  }
  const any = num(o.base ?? o.min_price ?? 0);
  return { base: any, original: null };
}
// --- PDP util: hide header on product page hero ---
function hideHeader(){
  try{
    const h1 = document.querySelector('header');
    if(h1) h1.style.display = 'none';
    const h2 = document.querySelector('.site-header');
    if(h2) h2.style.display = 'none';
    const h3=document.querySelector('nav'); if(h3) h3.style.display='none';
    const st=document.createElement('style'); st.textContent='body>header{display:none!important}'; document.head.appendChild(st);
  }catch{}
}
function cleanImages(arr){
  const out=[]; const seen=new Set();
  for(let u of (arr||[])){
    if(!u) continue;
    let s = String(u).trim();
    if(!s) continue;
    // Convert some Google Drive share links -> direct view
    const g = s.match(/drive\.google\.com\/file\/d\/([^/]+)/);
    if(g) s = `https://drive.google.com/uc?export=view&id=${g[1]}`;
    if(!/^https?:/i.test(s) && !s.startsWith('/')) continue; // only http(s) or relative
    if(seen.has(s)) continue; seen.add(s);
    out.push(s);
  }
  return out;
}
function hasImg(u){ try{ return !!(u && String(u).trim()); }catch{return false;} }
function imagesOf(p){
  const A = [];
  if (Array.isArray(p?.images)) A.push(...p.images);
  if (p?.image) A.unshift(p.image);
  if (p?.thumb) A.push(p.thumb);
  return cleanImages(A);
}

function videosOf(p){
  const arr = [];
  if(Array.isArray(p?.videos)) arr.push(...p.videos);
  if(p?.video) arr.unshift(p.video);
  if(Array.isArray(p?.media)){
    for(const m of p.media){ if(m && (m.type==='video' || /\.mp4|\.webm|\.m3u8/i.test(String(m.src||m.url||'')))) arr.push(m.src||m.url); }
  }
  return arr.filter(Boolean).map(String);
}
function mediaList(p){
  const imgs = imagesOf(p);
  const vids = videosOf(p);
  const out=[];
  vids.forEach(v=> out.push({type:'video', src:v}));
  imgs.forEach(i=> out.push({type:'image', src:i}));
  return out;
}

function variantsOf(p){
  if (Array.isArray(p?.variants)) return p.variants;
  const keys = ['skus','sku_list','children','items','options','variations','combos','list'];
  for(const k of keys){ const v = p?.[k]; if(Array.isArray(v)) return v; }
  return [];
}

function htmlEscape(s){
  return String(s ?? '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}
function mdToHTML(raw){
  if(!raw) return '';
  const lines = String(raw).split(/\r?\n/);
  const out = []; let list = [];
  const flush = () => {
    if(list.length){
      out.push('<ul>' + list.map(li => '<li>'+htmlEscape(li)+'</li>').join('') + '</ul>');
      list = [];
    }
  };
  for(const L of lines){
    const t = L.trim();
    if(!t){ flush(); continue; }
    if(/^[\-*•]\s+/.test(t)){ list.push(t.replace(/^[\-*•]\s+/,'')); continue; }
    const h = t.match(/^#{1,6}\s+(.*)$/);
    if(h){
      flush();
      const lvl = (t.match(/^#{1,6}/)[0] || '#').length;
      out.push(`<h${lvl}>${htmlEscape(h[1])}</h${lvl}>`);
      continue;
    }
    out.push('<p>'+htmlEscape(t)+'</p>');
  }
  flush();
  return out.join('');
}

function renderTitle(){
  $('#p-title') && ($('#p-title').textContent = PRODUCT.title || PRODUCT.name || 'Sản phẩm');
  $('#p-sold')  && ($('#p-sold').textContent  = (num(PRODUCT.sold||PRODUCT.sold_count||0))+' đã bán');
  $('#p-rating')&& ($('#p-rating').textContent= String(PRODUCT.rating||'5★'));
}




function renderPriceStock(){
  const el = $('#p-price'); const stockEl = $('#p-stock');
  if(!el && !stockEl) return;

  // Compute RANGE across variants if available
  const vsAll = variantsOf(PRODUCT) || [];
  const vs = vsAll.length ? vsAll.slice(0, 400) : []; // safety cap
  let rendered = false;

  const renderPriceHtml = (minBase, maxBase, minOrig, maxOrig) => {
    const baseText = (minBase===maxBase) ? formatPrice(minBase) : (formatPrice(minBase)+' - '+formatPrice(maxBase));
    let html = `<div class="text-rose-600 font-bold text-xl">${baseText}</div>`;
    if(minOrig && maxOrig && (maxOrig>maxBase || minOrig>minBase)){
      const origText = (minOrig===maxOrig) ? formatPrice(minOrig) : (formatPrice(minOrig)+' - '+formatPrice(maxOrig));
      html += `<div class="text-gray-400 line-through text-base mt-1">${origText}</div>`;
    }
    return html;
  };

  if(vs.length){
    const pairs = vs.map(v=>pricePair(v));
    // base range
    const baseVals = pairs.map(p=>+p.base||0).filter(v=>v>0);
    if(baseVals.length){
      const minBase = Math.min(...baseVals);
      const maxBase = Math.max(...baseVals);

      // original range (only variants where original>base)
      const origVals = pairs.map(p=>+p.original||0).filter(v=>v>0);
      let minOrig=0, maxOrig=0;
      if(origVals.length){
        minOrig = Math.min(...origVals);
        maxOrig = Math.max(...origVals);
      }
      el && (el.innerHTML = renderPriceHtml(minBase, maxBase, minOrig, maxOrig));
      rendered = true;
    }
  }

  // Fallback: no variants
  if(!rendered){
    const src = CURRENT || PRODUCT || null;
    const {base, original} = pricePair(src||{});
    el && (el.innerHTML = renderPriceHtml(+base||0, +base||0, +original||0, +original||0));
  }

  // Stock sum across variants
  if(stockEl){
    let stk = 0;
    if(vs.length) stk = vs.map(v => (v.stock||v.qty||v.quantity||0)).reduce((a,b)=>a+(+b||0),0);
    else stk = (PRODUCT.stock||PRODUCT.qty||PRODUCT.quantity||0) || 0;
    stockEl.textContent = stk>0 ? ('Còn '+stk) : 'Hết hàng';
  }
}


function renderVariants(){ const box=$('#p-variants'); if(box){ box.innerHTML=''; box.style.display='none'; } }



function renderMedia(prefer){
  const main=$('#media-main'); let thumbs=$('#media-thumbs');
  if(!main) return;
  const items = mediaList(prefer||PRODUCT);
  let idx = 0;
  function show(i){
    window.__pdp_show_impl = function(dir){ if(dir==='next') show(i+1); else if(dir==='prev') show(i-1); };
    if(items.length===0){ main.innerHTML=''; return; }
    idx = (i+items.length)%items.length;
    const it = items[idx];
    if(it.type==='video'){
      main.innerHTML = `<video id="pdp-video" playsinline controls style="width:100%;height:100%;object-fit:cover;background:#000;border-radius:12px"></video>`;
      const v=main.querySelector('#pdp-video'); v.src=it.src; v.load();
    }else{
      main.innerHTML = `<img src="${it.src}" style="width:100%;height:100%;object-fit:cover;border-radius:12px" onerror="this.dataset.err=1;this.src='';this.closest('#media-main') && (function(){try{window.__pdp_show && __pdp_show('next');}catch{}})()" />`;
    }
    draw();
  }
  function draw(){
    Array.from(main.querySelectorAll('.pdp-arrow')).forEach(n=>n.remove());
    const mk=(dir)=>{const b=document.createElement('button'); b.className='pdp-arrow'; b.textContent=dir==='left'?'‹':'›'; b.style.cssText='position:absolute;top:50%;transform:translateY(-50%);'+(dir==='left'?'left:8px;':'right:8px;')+'background:rgba(0,0,0,.35);color:#fff;border:none;border-radius:999px;width:36px;height:36px;display:flex;align-items:center;justify-content:center'; return b;};
    const L=mk('left'), R=mk('right'); L.onclick=()=>{show(idx-1); reset();}; R.onclick=()=>{show(idx+1); reset();}; main.appendChild(L); main.appendChild(R);
  }
  let timer=null; function reset(){ if(timer){clearInterval(timer);} timer=setInterval(()=>{ const v=main.querySelector('video'); if(v && !v.paused && !v.ended) return; show(idx+1); }, 3500); }
  show(0); reset();
  if(thumbs){
    const vsFull = variantsOf(PRODUCT);
      const vs = vsFull && vsFull.length>0 ? vsFull.slice(0, 15) : [];
    // Build horizontal scroller of square thumbnails (mobile-first)
    if (!thumbs) return;
    if (!vs.length) { thumbs.innerHTML = ''; thumbs.style.display = 'none'; }
    else {
      // Compute min-max price range for header (keeps existing logic)
      const pricePairs = vs.map(v => pricePair(v)).filter(p => p.base > 0);
      let header = '';
      if (pricePairs.length) {
        const min = Math.min(...pricePairs.map(p => p.base));
        const max = Math.max(...pricePairs.map(p => p.base));
        const priceText = (min === max) ? formatPrice(min) : (formatPrice(min) + ' - ' + formatPrice(max));
        header = `<div style="flex-basis:100%;font-weight:800;color:#dc2626;font-size:16px;margin-top:6px">${priceText}</div>`;
      }
      /* FORCE_HIDE_COUNT */ const countHTML = '' // '';

      // container styles
      thumbs.style.display = 'block';
      thumbs.style.maxWidth='100%'; thumbs.style.overflow='visible';
      thumbs.style.overflowX = 'auto';
      thumbs.style.gap = '8px';
      thumbs.style.padding = '6px 2px';
      thumbs.style.scrollSnapType = 'x proximity';

      function selCheck(v) {
        try {
          if (!CURRENT) return false;
          if (CURRENT === v) return true;
          if (CURRENT.sku && v.sku && String(CURRENT.sku) === String(v.sku)) return true;
          if (CURRENT.id && v.id && String(CURRENT.id) === String(v.id)) return true;
          return false;
        } catch { return false; }
      }

      
// moved: price range now displayed below title in #p-price
// (variant thumbnails removed)

          }
  }
}
function renderDesc(){
  const el = $('#p-desc'); if(!el) return;
  const raw = PRODUCT.description_html || PRODUCT.description || PRODUCT.desc || '';
  if(/<\w+/.test(String(raw||''))) el.innerHTML = raw;
  else el.innerHTML = mdToHTML(raw) || '<p>Đang cập nhật…</p>';
}
function renderFAQ(){
  const box = $('#p-faq'); if(!box) return;
  const arr = Array.isArray(PRODUCT.faq)?PRODUCT.faq:[];
  if(!arr.length){ box.innerHTML=''; return; }
  box.innerHTML = arr.map(it=>`<details class="border rounded p-2 bg-white"><summary class="font-medium">${htmlEscape(it.q||it.question||'Câu hỏi')}</summary><p class="mt-1 text-sm text-gray-700">${htmlEscape(it.a||it.answer||'Đang cập nhật')}</p></details>`).join('');
}
function renderReviews(){
  const box = $('#p-reviews'); if(!box) return;
  const arr = Array.isArray(PRODUCT.reviews)?PRODUCT.reviews:[];
  if(!arr.length){ box.innerHTML=''; return; }
  box.innerHTML = arr.map(r=>{
    const stars = '★'.repeat(Math.max(4, Math.min(5, num(r.stars||r.rating||5))));
    return `<div class="rounded border p-3 bg-white"><div class="text-sm text-gray-600">${htmlEscape(r.name||'Khách ẩn danh')} • ${stars}</div><p class="mt-1 text-sm">${htmlEscape(r.text||r.content||'')}</p></div>`;
  }).join('');
}
function attachCart(){
  try{ const a=$('#btn-add'); const z=$('#btn-zalo'); if(a) a.style.display='none'; if(z) z.style.display='none'; const group=(a&&a.parentElement===z?.parentElement ? a.parentElement : (a&&a.parentElement)|| (z&&z.parentElement)); if(group){ group.style.display='none'; } }catch{}
  const btn = $('#btn-add'); if(!btn) return;
  btn.addEventListener('click', ()=>{ openVariantModal('cart'); return; /* legacy below disabled */

    const src = CURRENT || (variantsOf(PRODUCT)[0] || PRODUCT);
    const item = {
      id: String(PRODUCT.id||PRODUCT._id||PRODUCT.slug||Date.now()),
      title: PRODUCT.title || PRODUCT.name || '',
      image: imagesOf(src||PRODUCT)[0] || '',
      variant: (CURRENT && (CURRENT.name||CURRENT.sku||'')) || '',
      price: pricePair(src).base || 0,
      qty: 1
    };
    try{
      const cart = JSON.parse(localStorage.getItem('CART')||'[]'); cart.push(item);
      localStorage.setItem('CART', JSON.stringify(cart));
      alert('Đã thêm vào giỏ!');
    }catch(e){ console.warn(e); }
  });
}

async function fetchProduct(id){
  const paths = [`/public/products/${encodeURIComponent(id)}`, `/products/${encodeURIComponent(id)}`];
  for(const p of paths){
    try{
      const r = await api(p);
      if(r && (r.item || r.product || (r.id || r.title))){
        return r.item || r.product || r;
      }
    }catch{}
  }
  // fallback list then find
  try{
    const list = await api('/public/products');
    const items = list?.items || list?.products || [];
    const f = (items||[]).find(x=>String(x.id||x._id||'')===String(id));
    if(f) return f;
  }catch{}
  return null;
}

(async function init(){
  try{
    const id = q('id','').trim();
    if(!id){ console.warn('No id'); return; }
    const item = await fetchProduct(id);
    if(!item){ console.warn('Product not found'); return; }
    PRODUCT = item; CURRENT = null;
    renderTitle(); renderPriceStock(); renderVariants(); renderMedia(); renderDesc(); renderFAQ(); renderReviews(); attachCart(); injectFloatingCart(); injectStickyCTA(); updateStickyCTA(); try{ getSettings().then(s=>{ const pdp=s?.pdp||s; if(pdp?.countdown_until){ const t=Number(pdp.countdown_until); if(t>Date.now()) renderCountdown(t); } if(Array.isArray(pdp?.badges)) renderBadges(pdp.badges); }); }catch{}
  }catch(e){ console.error(e); }
})();

// ===== Extra PDP UX (Ladipage-like) =====
async function getSettings(){
  // Try public settings first, then legacy
  try{ const s = await api('/public/settings'); return s?.settings || s || {}; }catch{}
  try{ const s = await api('/settings'); return s || {}; }catch{}
  return {};
}
function cartCount(){ try{ return (JSON.parse(localStorage.getItem('CART')||'[]')||[]).reduce((s,it)=>s+(Number(it.qty)||1),0) }catch{ return 0 } }
function goCart(){ try{ openCartModal(); }catch(e){ /* no-op */ } }

function injectFloatingCart(){
  if(document.getElementById('shv-float-cart')) return;
  const btn = document.createElement('a');
  btn.id = 'shv-float-cart';
  btn.href = '/cart.html';
  btn.setAttribute('aria-label','Giỏ hàng');
  btn.style.cssText = 'position:fixed;right:14px;bottom:90px;z-index:60;background:#111827;color:#fff;width:52px;height:52px;border-radius:26px;display:flex;align-items:center;justify-content:center;box-shadow:0 8px 24px rgba(0,0,0,.2)';
  btn.innerHTML = '<span style="font-size:22px;line-height:1">🛒</span><span id="shv-float-cart-badge" style="position:absolute;top:-6px;right:-6px;background:#ef4444;color:#fff;border-radius:10px;padding:1px 6px;font-size:12px;font-weight:700;">0</span>';
  document.body.appendChild(btn); btn.addEventListener('click', function(e){ e.preventDefault(); try{ openCartModal(); }catch{} });
  const upd=()=>{ const c=cartCount(); const b=document.getElementById('shv-float-cart-badge'); if(b) b.textContent=String(c) };
  upd(); setInterval(upd, 1500);
}

function injectStickyCTA(){
  if(document.getElementById('shv-sticky-cta')) return;
  const wrap = document.createElement('div');
  wrap.id = 'shv-sticky-cta';
  wrap.style.cssText = 'position:fixed;left:0;right:0;bottom:0;z-index:50;background:#ffffff;box-shadow:0 -4px 18px rgba(0,0,0,.08);border-top:1px solid #e5e7eb';
  wrap.innerHTML = `
    <div style="max-width:1120px;margin:0 auto;padding:10px 16px;display:flex;align-items:center;gap:12px;justify-content:flex-end">
      <a id="shv-cta-zalo" href="#" style="display:flex;align-items:center;gap:6px;border:1px solid #0068FF;color:#0068FF;background:#fff;border-radius:12px;padding:12px 14px;text-decoration:none;font-weight:700">Zalo</a>
      <button id="shv-cta-add" style="border:1px solid #ef4444;color:#ef4444;background:#fff;border-radius:12px;padding:12px 14px;font-weight:700">Thêm giỏ hàng</button>
      <button id="shv-cta-buy" style="background:#ef4444;color:#fff;border:none;border-radius:12px;padding:12px 16px;font-weight:800">MUA NGAY</button>
    </div>`;
  document.body.appendChild(wrap);

  const dec = ()=>{ const inp=document.getElementById('shv-cta-qty'); let v=Math.max(1, parseInt(inp.value||'1',10)-1); inp.value=String(v); };
  const inc = ()=>{ const inp=document.getElementById('shv-cta-qty'); let v=Math.max(1, parseInt(inp.value||'1',10)+1); inp.value=String(v); };
  var _decEl=document.getElementById('shv-cta-dec'); if(_decEl) _decEl.onclick = dec;
  var _incEl=document.getElementById('shv-cta-inc'); if(_incEl) _incEl.onclick = inc;
  const zHref = (document.getElementById('btn-zalo') && document.getElementById('btn-zalo').href) || 'https://zalo.me/';
  document.getElementById('shv-cta-zalo').href = zHref;
  document.getElementById('shv-cta-add').onclick = ()=> openVariantModal('cart');
  document.getElementById('shv-cta-buy').onclick = ()=> openVariantModal('buy');
}
  /* legacy (direct add) fully removed */
function updateStickyCTA(){}
function renderCountdown(untilMs){
  const holder = document.createElement('div');
  holder.id = 'shv-countdown';
  holder.style.cssText = 'margin-top:6px;font-size:13px;color:#dc2626;font-weight:600';
  function tick(){
    const now = Date.now();
    const left = Math.max(0, untilMs - now);
    const h = Math.floor(left/3600000);
    const m = Math.floor((left%3600000)/60000);
    const s = Math.floor((left%60000)/1000);
    holder.textContent = left>0 ? `⚡️ Flash sale còn ${h}h ${m}m ${s}s` : '⚡️ Flash sale đã kết thúc';
  }
  tick(); setInterval(tick, 1000);
  const priceEl = document.getElementById('p-price');
  if(priceEl && !document.getElementById('shv-countdown')) priceEl.appendChild(holder);
}

function renderBadges(badges){
  if(!Array.isArray(badges) || !badges.length) return;
  const box = document.createElement('div');
  box.style.cssText = 'display:flex;gap:10px;flex-wrap:wrap;margin-top:8px';
  badges.forEach(txt=>{
    const el=document.createElement('span');
    el.textContent = String(txt);
    el.style.cssText = 'font-size:12px;padding:4px 8px;border:1px solid #e5e7eb;border-radius:999px;background:#f9fafb;color:#374151';
    box.appendChild(el);
  });
  const priceEl = document.getElementById('p-price');
  if(priceEl) priceEl.parentElement.insertBefore(box, priceEl.nextSibling);
}


// --- Modal primitives ---
function mkMask(id='shv-mask'){
  let m = document.getElementById(id);
  if(!m){ m = document.createElement('div'); m.id=id; m.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:70;display:flex;align-items:flex-end;justify-content:center'; document.body.appendChild(m); }
  m.innerHTML=''; return m;
}
function closeMask(id='shv-mask'){ const m=document.getElementById(id); if(m) m.remove(); }

// Variant choose modal
function openVariantModal(mode){ // mode: 'cart' | 'buy'
  const m = mkMask();
  const vsFull = variantsOf(PRODUCT);
      const vs = vsFull && vsFull.length>0 ? vsFull.slice(0, 15) : [];
  const imgs = imagesOf(PRODUCT);
  const current = null;
// Default select a sensible variant when opening modal
try{
  if(!CURRENT){
    const arr = variantsOf(PRODUCT);
    if(arr.length){
      // choose lowest-priced available variant; fallback to first
      let best = arr[0]; let bestVal = Infinity;
      for(const v of arr){
        const pr = pricePair(v); const base = Number(pr?.base||0);
        if(base>0 && base < bestVal){ best = v; bestVal = base; }
      }
      CURRENT = best || arr[0];
    }
  }
}catch{ /* ignore */ }

  const html = `
  <div style="width:100%;max-width:520px;max-height:88vh;overflow:auto;background:#fff;border-radius:12px 12px 0 0;padding:16px 16px 80px 16px;position:relative">
    <div style="display:flex;gap:10px">
      <img src="${(imagesOf(current)[0]||imgs[0]||'')}" style="width:72px;height:72px;object-fit:contain;border-radius:10px;border:1px solid #eee;background:#f8fafc" />
      <div style="flex:1">
        <div style="font-weight:700;font-size:16px;margin-bottom:4px">${PRODUCT.title||PRODUCT.name||''}</div>
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
  m.innerHTML = html;
  // SHV_FIX v7: strong CSS overrides with !important + mobile block layout
  (function(){
    const head = document.head || document.getElementsByTagName('head')[0];
    let fix = document.getElementById('shv-co-fix-style');
    if(!fix){
      fix = document.createElement('style');
      fix.id = 'shv-co-fix-style';
      fix.type = 'text/css';
      fix.textContent = `
        /* Mobile-first hard overrides */
        @media (max-width: 767px){
          #shv-co-mask #co-form{ display:block !important; }
          #shv-co-mask #co-form input,
          #shv-co-mask #co-form textarea{ width:100% !important; }
          #shv-co-mask #co-form .co-grid{ display:block !important; width:100% !important; min-width:0 !important; }
          #shv-co-mask #co-form #co-addr,
          #shv-co-mask #co-form #co-note{ grid-column:1 / -1 !important; width:100% !important; }
          #shv-co-mask #co-form #co-province-sel,
          #shv-co-mask #co-form #co-district-sel,
          #shv-co-mask #co-form #co-ward-sel{ grid-column:1 / -1 !important; width:100% !important; max-width:100% !important; display:block !important; }
        }
      `;
      head.appendChild(fix);
    }
  })();

  // SHV_FIX v6: On mobile, drop grid for #co-form to avoid implicit columns; enforce full-width selects
  (function(){
    const isMobile = window.matchMedia('(max-width: 767px)').matches;
    const form = m.querySelector('#co-form');
    const gridBox = m.querySelector('.co-grid');
    const killGridColumns = () => {
      if(!form) return;
      // Remove any inline grid-column that may create implicit tracks
      form.querySelectorAll('[style*="grid-column"]').forEach(el => {
        el.style.removeProperty('grid-column');
      });
    };
    try{
      if(isMobile && form){
        form.style.display = 'block';
        form.style.removeProperty('grid-template-columns');
        killGridColumns();
      }else if(form){
        // desktop/tablet fallback
        form.style.display = 'grid';
        form.style.gridTemplateColumns = '1fr';
      }
      if(gridBox){
        // make address selects container stretch fully
        gridBox.style.display = isMobile ? 'block' : 'grid';
        if(!isMobile){
          gridBox.style.gridTemplateColumns = '1fr';
        }
        gridBox.style.width = '100%';
        gridBox.style.minWidth = '0';
      }
      // location selects always full width
      ['co-province-sel','co-district-sel','co-ward-sel'].forEach(id=>{
        const el = m.querySelector('#'+id);
        if(el){
          el.style.setProperty('width','100%','important');
          el.style.setProperty('max-width','100%','important');
          el.style.display = 'block';
        }
      });
      // observe to keep removing grid-column re-applied later
      const mo = new MutationObserver((mutations)=>{
        let touch = false;
        mutations.forEach(mt=>{
          if(mt.type==='attributes' && mt.attributeName==='style'){
            touch = true;
          }
          if(mt.type==='childList') touch = true;
        });
        if(touch){
          killGridColumns();
        }
      });
      mo.observe(form || m, {attributes:true, subtree:true, childList:true});
    }catch(_e){}
  })();

  // SHV_FIX v5: force full-span & watch for regressions
  const __applyGridFix = () => {
    try{
      const form = m.querySelector('#co-form');
      if(form){
        form.style.display = 'grid';
        form.style.gridTemplateColumns = '1fr';
        form.style.alignItems = 'stretch';
      }
      const grid = m.querySelector('.co-grid');
      if(grid){
        grid.style.display = 'grid';
        grid.style.gridTemplateColumns = '1fr';
        grid.style.gridColumn = '1 / -1';
        grid.style.width = '100%';
        grid.style.minWidth = '0';
        grid.style.justifyItems = 'stretch';
        grid.style.alignItems = 'stretch';
      }
      // Prevent implicit columns: address & note must span full row
      ['co-addr','co-note'].forEach(id=>{
        const el = m.querySelector('#'+id);
        if(el){
          el.style.setProperty('grid-column','1 / -1','important');
          el.style.minWidth = '0';
          el.style.width = '100%';
        }
      });
      // Location selects: always full width
      ['co-province-sel','co-district-sel','co-ward-sel'].forEach(id=>{
        const el = m.querySelector('#'+id);
        if(el){
          el.style.setProperty('grid-column','1 / -1','important');
          el.style.setProperty('width','100%','important');
          el.style.setProperty('max-width','100%','important');
          el.style.minWidth = '0';
          el.style.display = 'block';
        }
      });
    }catch(_e){}
  };
  __applyGridFix();
  // Observe mutations to keep the layout stable if any script rewrites inline styles
  try{
    const mo = new MutationObserver(() => __applyGridFix());
    mo.observe(m, { attributes: true, childList: true, subtree: true });
  }catch(_e){}

  // SHV_FIX v4: prevent implicit grid columns causing 129px width
  try{
    const addr = m.querySelector('#co-addr');
    const note = m.querySelector('#co-note');
    if(addr){ addr.style.gridColumn = '1 / -1'; }
    if(note){ note.style.gridColumn = '1 / -1'; }
    const grid = m.querySelector('.co-grid');
    if(grid){ grid.style.display = 'grid'; grid.style.gridTemplateColumns = '1fr'; grid.style.width='100%'; grid.style.minWidth='0'; }
  }catch(_){}

  // SHV_FIX v3: enforce full-span & stretch for address selects
  try{
    const form = m.querySelector('#co-form');
    if(form){
      form.style.display = 'grid';
      form.style.gridTemplateColumns = '1fr';
      form.style.alignItems = 'stretch';
    }
    const grid = m.querySelector('.co-grid');
    if(grid){
      grid.style.gridColumn = '1 / -1';
      grid.style.width = '100%';
      grid.style.minWidth = '0';
      grid.style.display = 'grid';
      grid.style.gridTemplateColumns = '1fr';
      grid.style.alignItems = 'stretch';
      grid.style.justifyItems = 'stretch';
      grid.style.placeItems = 'stretch';
    }
    ['co-province-sel','co-district-sel','co-ward-sel'].forEach(id=>{
      const el = m.querySelector('#'+id);
      if(el){
        el.style.width = '100%';
        el.style.maxWidth = '100%';
        el.style.minWidth = '0';
        el.style.display = 'block';
        el.style.gridColumn = '1 / -1';
        el.style.boxSizing = 'border-box';
      }
    });
  }catch(_e){}

  // Shipping state
  let shipFee = 0; let chosenShip = null;
  // Declare shipping state early to avoid TDZ errors
  // Ensure mobile-safe width & scrolling
  try{ const card=m.firstElementChild; if(card){ card.style.width='calc(100% - 16px)'; card.style.maxWidth='640px'; card.style.margin='0 8px'; card.style.boxSizing='border-box'; card.style.maxHeight='92vh'; card.style.overflow='auto'; card.style.WebkitOverflowScrolling='touch'; }}catch{}

  // Render variants buttons
  function renderVBtns(active){
    const box = m.querySelector('#vm-variants');
    const arr = variantsOf(PRODUCT);
    box.innerHTML = arr.map((v,i)=>{
      const {base}=pricePair(v); const img = imagesOf(v)[0]||'';
      const name = (v.name||v.sku||('Loại '+(i+1)));
      const act = (active===i) ? 'border-color:#ef4444;color:#ef4444;background:#fff1f2;' : '';
      return `<button data-k="${i}" style="display:flex;align-items:center;gap:6px;border:1px solid #e5e7eb;border-radius:8px;padding:8px 10px;background:#fff;${act}">${img?`<img src="${img}" data-fallback="${String(img||'').includes('/file/')?String(img).replace('/file/', '/img/')+'?w=960&q=85&format=auto':img}" onerror="if(this.dataset.fallback&&!this.__tried){this.__tried=1;this.src=this.dataset.fallback}" style="width:28px;height:28px;object-fit:contain;border-radius:6px">`:''}<span>${name}${base?` — ${(base||0).toLocaleString('vi-VN')}đ`:''}</span></button>`;
    }).join('');
    box.querySelectorAll('button[data-k]').forEach(btn=>btn.onclick=()=>{ 
      const k=+btn.dataset.k; CURRENT = arr[k]; renderVBtns(k); updPrice(); 
    });
  }
  function updPrice(){
    const src = CURRENT || (variantsOf(PRODUCT)[0] || PRODUCT);
    let pr = null;
    if(src){ pr = pricePair(src); }
    else {
      const arr = variantsOf(PRODUCT);
      let best = null; for(const v of arr){ const p=pricePair(v); if(p.base>0 && (!best || p.base<best.base)) best=p; }
      pr = best || { base: 0 };
    }
    m.querySelector('#vm-price').textContent = (pr.base||0).toLocaleString('vi-VN')+'đ';
    const im = m.querySelector('img'); im.src = (imagesOf(src)[0] || im.src);
  }
  renderVBtns((vs.indexOf(current)>=0)?vs.indexOf(current):0); updPrice();

  // Qty
  const dec = ()=>{ const inp=m.querySelector('#vm-qty'); let v=Math.max(1, parseInt(inp.value||'1',10)-1); inp.value=String(v); };
  const inc = ()=>{ const inp=m.querySelector('#vm-qty'); let v=Math.max(1, parseInt(inp.value||'1',10)+1); inp.value=String(v); };
  m.querySelector('#vm-dec').onclick = dec;
  m.querySelector('#vm-inc').onclick = inc;

  // Actions
  function addSelectedToCart(){
    const qty = Math.max(1, parseInt(m.querySelector('#vm-qty').value||'1',10));
    const src = CURRENT || (variantsOf(PRODUCT)[0] || PRODUCT);
    const item = { id:String(PRODUCT.id||PRODUCT._id||PRODUCT.slug||Date.now()), title: PRODUCT.title||PRODUCT.name||'', image: imagesOf(src||PRODUCT)[0]||'', variant: (CURRENT && (CURRENT.name||CURRENT.sku||''))||'', price: pricePair(src).base||0, qty };
    try{
      const cart = JSON.parse(localStorage.getItem('CART')||'[]')||[];
      const k = keyOfItem(item);
      const idx = cart.findIndex(x=>keyOfItem(x)===k);
      if(idx>-1){ cart[idx].qty = (Number(cart[idx].qty)||1) + qty; }
      else { cart.push(item); }
      localStorage.setItem('CART', JSON.stringify(consolidateCart(cart)));
    }catch(e){}
  }

  m.querySelector('#vm-add').onclick = ()=>{ addSelectedToCart(); closeMask(); openCartModal(); };
  m.querySelector('#vm-buy').onclick = ()=>{ addSelectedToCart(); closeMask(); openCheckoutModal(); };
  m.querySelector('#vm-close').onclick = ()=> closeMask();

  if(mode==='buy'){/* nothing extra */}
}

// Cart modal bottom sheet
function cartItems(){ try{ const raw=JSON.parse(localStorage.getItem('CART')||'[]'); const merged=consolidateCart(raw); if(merged.length!==raw.length){ localStorage.setItem('CART', JSON.stringify(merged)); } return merged; }catch{ return []; } }

// SHV_PATCH: consolidate cart items by (id, variant, price)
function keyOfItem(it){
  return String(it.id||'')+'|'+String(it.variant||'')+'|'+String(Number(it.price)||0);
}
function consolidateCart(arr){
  try{
    const map = new Map();
    for(const it of arr||[]){
      const k = keyOfItem(it);
      if(!map.has(k)){ map.set(k, {...it, qty: Number(it.qty)||1}); }
      else { const o=map.get(k); o.qty = (Number(o.qty)||1) + (Number(it.qty)||1); map.set(k,o); }
    }
    return Array.from(map.values());
  }catch(e){ return arr||[]; }
}
function setCartItems(arr){ localStorage.setItem('CART', JSON.stringify(arr)); }
function calcTotal(){ return cartItems().reduce((s,it)=>s + (Number(it.price)||0)*(Number(it.qty)||1), 0); }

function openCartModal(){
  const m = mkMask('shv-cart-mask');
  const items = cartItems();
  const html = `
  <div style="width:100%;max-width:560px;max-height:88vh;overflow:auto;background:#fff;border-radius:12px 12px 0 0;padding:12px 12px 80px 12px;position:relative">
    <div style="display:flex;align-items:center;justify-content:space-between;padding:6px 4px 10px">
      <div style="font-weight:800">GIỎ HÀNG (${(items||[]).reduce((s,it)=>s+(Number(it.qty)||1),0)})</div>
      <button id="cm-close" style="border:none;background:transparent;font-size:22px">✕</button>
    </div>
    <div id="cm-list"></div>
    <div style="position:sticky;left:0;right:0;bottom:0;background:#fff;padding-top:12px;margin-top:16px;display:flex;align-items:center;justify-content:space-between;gap:10px">
      <div style="font-weight:700">Tổng: <span id="cm-total" style="color:#dc2626"></span></div>
      <button id="cm-checkout" style="flex:0 0 auto;background:#ef4444;color:#fff;border:none;border-radius:8px;padding:12px 16px;font-weight:700">ĐẶT HÀNG NGAY</button>
    </div>
  </div>`;
  m.innerHTML = html;
  // SHV_FIX v7: strong CSS overrides with !important + mobile block layout
  (function(){
    const head = document.head || document.getElementsByTagName('head')[0];
    let fix = document.getElementById('shv-co-fix-style');
    if(!fix){
      fix = document.createElement('style');
      fix.id = 'shv-co-fix-style';
      fix.type = 'text/css';
      fix.textContent = `
        /* Mobile-first hard overrides */
        @media (max-width: 767px){
          #shv-co-mask #co-form{ display:block !important; }
          #shv-co-mask #co-form input,
          #shv-co-mask #co-form textarea{ width:100% !important; }
          #shv-co-mask #co-form .co-grid{ display:block !important; width:100% !important; min-width:0 !important; }
          #shv-co-mask #co-form #co-addr,
          #shv-co-mask #co-form #co-note{ grid-column:1 / -1 !important; width:100% !important; }
          #shv-co-mask #co-form #co-province-sel,
          #shv-co-mask #co-form #co-district-sel,
          #shv-co-mask #co-form #co-ward-sel{ grid-column:1 / -1 !important; width:100% !important; max-width:100% !important; display:block !important; }
        }
      `;
      head.appendChild(fix);
    }
  })();

  // Shipping state
  let shipFee = 0; let chosenShip = null;
  // Declare shipping state early to avoid TDZ errors
  // Ensure mobile-safe width & scrolling
  try{ const card=m.firstElementChild; if(card){ card.style.width='calc(100% - 16px)'; card.style.maxWidth='640px'; card.style.margin='0 8px'; card.style.boxSizing='border-box'; card.style.maxHeight='92vh'; card.style.overflow='auto'; card.style.WebkitOverflowScrolling='touch'; }}catch{}
  const list = m.querySelector('#cm-list');
  function render(){
    const arr = cartItems();
    list.innerHTML = arr.map((it,idx)=>`
      <div style="display:flex;gap:10px;padding:8px 0;border-top:1px solid #f3f4f6">
        <img src="${it.image||''}" data-fallback="${(it.image||'').replace('/file/', '/img/')+'?w=720&q=85&format=auto'}" onerror="if(this.dataset.fallback&&!this.__tried){this.__tried=1;this.src=this.dataset.fallback}else{this.src='data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'56\' height=\'56\'><rect width=\'100%\' height=\'100%\' fill=\'%23f3f4f6\'/></svg>';}" style="width:56px;height:56px;object-fit:contain;border-radius:8px;background:#f9fafb;border:1px solid #eee">
        <div style="flex:1;min-width:0">
          <div style="font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${it.title}</div>
          ${it.variant?`<div style="font-size:12px;color:#6b7280">${it.variant}</div>`:''}
          <div style="font-weight:700;color:#ef4444">${(Number(it.price)||0).toLocaleString('vi-VN')}đ</div>
        </div>
        <div style="display:flex;align-items:center;gap:6px">
          <button data-dec="${idx}" style="width:28px;height:28px;border:1px solid #e5e7eb;background:#fff;border-radius:6px">−</button>
          <span>${it.qty||1}</span>
          <button data-inc="${idx}" style="width:28px;height:28px;border:1px solid #e5e7eb;background:#fff;border-radius:6px">+</button>
          <button data-del="${idx}" style="margin-left:8px;border:none;background:transparent">🗑️</button>
        </div>
      </div>`).join('') || '<div style="padding:12px;color:#6b7280">Giỏ hàng trống</div>';
    const total = calcTotal(); m.querySelector('#cm-total').textContent = total.toLocaleString('vi-VN')+'đ';
    list.querySelectorAll('[data-dec]').forEach(b=>b.onclick=()=>{ const i=+b.dataset.dec; const arr=cartItems(); arr[i].qty=Math.max(1,(arr[i].qty||1)-1); setCartItems(arr); render(); });
    list.querySelectorAll('[data-inc]').forEach(b=>b.onclick=()=>{ const i=+b.dataset.inc; const arr=cartItems(); arr[i].qty=(arr[i].qty||1)+1; setCartItems(arr); render(); });
    list.querySelectorAll('[data-del]').forEach(b=>b.onclick=()=>{ const i=+b.dataset.del; const arr=cartItems(); arr.splice(i,1); setCartItems(arr); render(); });
  }
  render();
  m.querySelector('#cm-close').onclick=()=>closeMask('shv-cart-mask');
  m.querySelector('#cm-checkout').onclick=()=>{ closeMask('shv-cart-mask'); openCheckoutModal(); };
}

// Checkout modal
function openCheckoutModal(){
  const m = mkMask('shv-co-mask');
  const html = `
  <div class="co-modal" style="max-height:92vh;overflow:auto;background:#fff;border-radius:12px;padding:14px 14px 80px 14px;position:relative">
    <div style="display:flex;align-items:center;gap:6px;padding-bottom:10px">
      <button id="co-back" style="border:none;background:transparent;font-size:22px">←</button>
      <div style="font-weight:800">HOÀN TẤT ĐƠN HÀNG</div>
      <button id="co-close" style="margin-left:auto;border:none;background:transparent;font-size:22px">✕</button>
    </div>
    <div id="co-form" style="display:grid;grid-template-columns:1fr;gap:10px">
      <input id="co-name" placeholder="Họ và tên" style="border:1px solid #e5e7eb;border-radius:8px;padding:10px 12px" />
      <input id="co-phone" placeholder="Số điện thoại" style="border:1px solid #e5e7eb;border-radius:8px;padding:10px 12px" />
      <input id="co-addr" placeholder="Số nhà, thôn, xóm,.." style="grid-column:1/3;border:1px solid #e5e7eb;border-radius:8px;padding:10px 12px" />
      <style id="co-grid-style">.co-grid{display:grid;grid-template-columns:1fr !important;gap:12px;width:100% !important}.co-grid select,.co-grid input{width:100% !important;max-width:100% !important;box-sizing:border-box;display:block;min-height:46px !important;padding:12px !important}</style><div class="co-grid" style="grid-column:1 / -1;width:100% !important;display:block;grid-template-columns:1fr !important;">
        <select id="co-province-sel" style="width:100%;box-sizing:border-box;border:1px solid #e5e7eb;border-radius:8px;padding:12px;display:block;grid-column:1 / -1 !important;min-height:44px;width:100%;max-width:100%;display:block;width:100% !important;max-width:100% !important;min-height:46px !important;display:block;flex:0 0 100%">
          <option value="">— Chọn Tỉnh/Thành —</option>
        </select>
        <select id="co-district-sel" style="width:100%;box-sizing:border-box;border:1px solid #e5e7eb;border-radius:8px;padding:12px;display:block;grid-column:1 / -1 !important;width:100% !important;max-width:100% !important;min-height:46px !important;display:block;flex:0 0 100%" disabled>
          <option value="">— Chọn Quận/Huyện —</option>
        </select>
        <select id="co-ward-sel" style="width:100%;box-sizing:border-box;border:1px solid #e5e7eb;border-radius:8px;padding:12px;display:block;grid-column:1 / -1 !important;width:100% !important;max-width:100% !important;min-height:46px !important;display:block;flex:0 0 100%" disabled>
          <option value="">— Chọn Phường/Xã —</option>
        </select>
      </div>
      <!-- Hidden text fields to hold selected names for province/district/ward (fix null .value) -->
      <input type="hidden" id="co-province" />
      <input type="hidden" id="co-district" />
      <input type="hidden" id="co-ward" />
      <input type="hidden" id="co-province-code" />
      <input type="hidden" id="co-district-code" />
      <input type="hidden" id="co-ward-code" />

      <textarea id="co-note" placeholder="Để lại lời nhắn cho chúng tôi" style="grid-column:1/3;border:1px solid #e5e7eb;border-radius:8px;padding:10px 12px calc(env(safe-area-inset-bottom, 0) + 10px);min-height:80px"></textarea>
    </div>

    <div style="margin-top:12px;border-top:1px solid #f3f4f6;padding-top:10px" id="co-items"></div>

    <div id="co-sticky" style="position:fixed;left:0;right:0;bottom:0;width:100%;z-index:99;background:#fff;border-top:1px solid #e5e7eb;padding:10px 12px calc(env(safe-area-inset-bottom, 0) + 10px);margin-top:16px;display:flex;align-items:center;justify-content:space-between;gap:12px"><div style="display:flex;flex-direction:column;gap:2px;min-width:0"><div style="font-weight:800">Tổng cộng: <span id="co-sticky-grand" style="color:#ef4444">0đ</span></div><div style="font-size:12px;color:#6b7280;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">Sản phẩm: <span id="co-sticky-sub">0đ</span> • Ship: <span id="co-sticky-ship">0đ</span></div></div><button id="co-submit" style="background:#ef4444;color:#fff;border:none;border-radius:8px;padding:12px 22px;font-weight:800;white-space:nowrap">ĐẶT HÀNG</button></div>
  </div>`;
  m.innerHTML = html;
  // SHV_FIX v9: keep CTA sticky and ensure space at the bottom (mobile)
  try{
    const card = m.firstElementChild; if(card){ card.style.paddingBottom = '120px'; }
    const submit = m.querySelector('#co-submit');
    if(submit){
      const wrap = submit.parentElement;
      if(wrap){
        wrap.style.position='fixed'; wrap.style.left='0'; wrap.style.right='0'; wrap.style.bottom='0';
        wrap.style.background='#fff'; wrap.style.paddingTop='12px'; wrap.style.marginTop='16px';
        wrap.style.display='flex'; wrap.style.justifyContent='space-between'; wrap.style.zIndex='1';
      }
    }
  }catch(_e){}

  // SHV_FIX v7: strong CSS overrides with !important + mobile block layout
  (function(){
    const head = document.head || document.getElementsByTagName('head')[0];
    let fix = document.getElementById('shv-co-fix-style');
    if(!fix){
      fix = document.createElement('style');
      fix.id = 'shv-co-fix-style';
      fix.type = 'text/css';
      fix.textContent = `
        /* Mobile-first hard overrides */
        @media (max-width: 767px){
          #shv-co-mask #co-form{ display:block !important; }
          #shv-co-mask #co-form input,
          #shv-co-mask #co-form textarea{ width:100% !important; }
          #shv-co-mask #co-form .co-grid{ display:block !important; width:100% !important; min-width:0 !important; }
          #shv-co-mask #co-form #co-addr,
          #shv-co-mask #co-form #co-note{ grid-column:1 / -1 !important; width:100% !important; }
          #shv-co-mask #co-form #co-province-sel,
          #shv-co-mask #co-form #co-district-sel,
          #shv-co-mask #co-form #co-ward-sel{ grid-column:1 / -1 !important; width:100% !important; max-width:100% !important; display:block !important; }
        }
      `;
      head.appendChild(fix);
    }
  })();

  // Shipping state
  let shipFee = 0; let chosenShip = null;
  // Declare shipping state early to avoid TDZ errors
  // Ensure mobile-safe width & scrolling
  try{ const card=m.firstElementChild; if(card){ card.style.width='calc(100% - 16px)'; card.style.maxWidth='640px'; card.style.margin='0 8px'; card.style.boxSizing='border-box'; card.style.maxHeight='92vh'; card.style.overflow='auto'; card.style.WebkitOverflowScrolling='touch'; }}catch{}
  m.querySelector('#co-back').onclick=()=>{ closeMask('shv-co-mask'); openCartModal(); };
  m.querySelector('#co-close').onclick=()=>closeMask('shv-co-mask');

  function validateCustomer(c){
    const errs=[];
    const phoneRe=/^(03|05|07|08|09)\d{8}$/;
    function mark(id, ok){ const el=m.querySelector(id); if(!el) return; el.style.borderColor = ok? '#e5e7eb' : '#ef4444'; }
    const okName=!!c.name; mark('#co-name', okName); if(!okName) errs.push('Vui lòng nhập họ tên.');
    const okPhone=phoneRe.test(c.phone||''); mark('#co-phone', okPhone); if(!okPhone) errs.push('Số điện thoại không hợp lệ.');
    const okAddr=!!c.address; mark('#co-addr', okAddr); if(!okAddr) errs.push('Vui lòng nhập địa chỉ.');
    const okProv=!!c.province && !!c.province_code; mark('#co-province', okProv); if(!okProv) errs.push('Chọn Tỉnh/Thành.');
    const okDist=!!c.district && !!c.district_code; mark('#co-district', okDist); if(!okDist) errs.push('Chọn Quận/Huyện.');
    const okWard=!!c.ward && !!c.ward_code; mark('#co-ward', okWard); if(!okWard) errs.push('Chọn Phường/Xã.');
    let box=m.querySelector('#co-errors'); if(!box){ box=document.createElement('div'); box.id='co-errors'; box.style.color='#ef4444'; box.style.margin='6px 0 0'; const t=m.querySelector('#co-title'); if(t) t.insertAdjacentElement('afterend', box); }
    box.innerHTML = errs.length? ('<ul style="padding-left:18px;list-style:disc">'+errs.map(e=>'<li>'+e+'</li>').join('')+'</ul>') : '';
    return errs.length===0;
  }



  
  function renderTotals(){
    const sub = calcTotal();
    const grand = sub + (shipFee||0);
    const d1 = m.querySelector('#co-sub'); if(d1) d1.textContent = 'Tạm tính: ' + sub.toLocaleString('vi-VN') + 'đ';
    const d2 = m.querySelector('#co-shipfee'); if(d2) d2.textContent = 'Phí vận chuyển: ' + (shipFee||0).toLocaleString('vi-VN') + 'đ';
    const d3 = m.querySelector('#co-grand'); if(d3) d3.textContent = 'Tổng: ' + grand.toLocaleString('vi-VN') + 'đ';
    const s1 = m.querySelector('#co-sticky-sub'); if(s1) s1.textContent = sub.toLocaleString('vi-VN') + 'đ';
    const s2 = m.querySelector('#co-sticky-ship'); if(s2) s2.textContent = (shipFee||0).toLocaleString('vi-VN') + 'đ';
    const s3 = m.querySelector('#co-sticky-grand'); if(s3) s3.textContent = grand.toLocaleString('vi-VN') + 'đ';
  }

  renderTotals(); setTimeout(refreshShip, 0);
  function updateAddrCard(){
    const name = (m.querySelector('#co-name')?.value||'').trim();
    const phone = (m.querySelector('#co-phone')?.value||'').trim();
    const addr = (m.querySelector('#co-addr')?.value||'').trim();
    const prov = (m.querySelector('#co-province')?.value||'').trim();
    const dist = (m.querySelector('#co-district')?.value||'').trim();
    const ward = (m.querySelector('#co-ward')?.value||'').trim();
    const text = (name||phone||addr||prov||dist||ward)
      ? `${name?name:''} ${phone?('• '+phone):''}<br/>${addr?addr+', ':''}${ward?ward+', ':''}${dist?dist+', ':''}${prov?prov:''}`
      : 'Vui lòng nhập thông tin';
    const el = m.querySelector('#co-addr-text'); if(el) el.innerHTML = text;
  }
  ['#co-name','#co-phone','#co-addr','#co-province','#co-district','#co-ward'].forEach(sel=>{
    const el = m.querySelector(sel); if(el) el.addEventListener('input', updateAddrCard);
  });
  updateAddrCard();

  const list = cartItems();
  const box = m.querySelector('#co-items');

  // Totals box (sub, ship, grand)
  (function(){
    const totals = document.createElement('div');
    totals.id = 'co-totals';
    totals.innerHTML = `<div style="margin-top:10px;border-top:1px solid #f3f4f6;padding-top:8px">
      <div style="display:flex;justify-content:space-between"><div>Tổng tiền hàng</div><div id="co-sub" style="font-weight:700">0đ</div></div>
      <div style="display:flex;justify-content:space-between;margin-top:4px"><div>Tổng tiền phí vận chuyển</div><div id="co-shipfee" style="font-weight:700">0đ</div></div>
      <div style="display:flex;justify-content:space-between;margin-top:6px"><div><b>Tổng thanh toán</b></div><div id="co-grand" style="font-weight:800;color:#ef4444">0đ</div></div>
    </div>`;
    const target = m.querySelector('#co-items');
    if(target) target.insertAdjacentElement('afterend', totals);
  renderTotals();
  })();

  const total = calcTotal();
  
  box.innerHTML = `<div style="font-weight:700;margin-bottom:6px">Thông tin sản phẩm</div>` +
    cartItems().map(it => {
      const sub = (Number(it.price||0) * Number(it.qty||1));
      const vtxt = it.variant ? ` - ${it.variant}` : '';
      const img = it.image ? `<img src="${it.image}" style="width:64px;height:64px;object-fit:cover;border-radius:8px;border:1px solid #eee;background:#f8fafc"/>` : '';
      return `<div style="display:flex;gap:10px;align-items:flex-start;padding:8px 0;border-bottom:1px solid #f3f4f6">
        ${img}
        <div style="flex:1;min-width:0">
          <div style="font-weight:600">${it.name||''}${vtxt}</div>
          <div style="font-size:12px;color:#6b7280">x${Number(it.qty||1)}</div>
        </div>
        <div style="text-align:right;white-space:nowrap">
          <div>${(Number(it.price||0)).toLocaleString('vi-VN')}đ</div>
          <div style="font-size:12px;color:#6b7280">${sub.toLocaleString('vi-VN')}đ</div>
        </div>
      </div>`;
    }).join('');
  // Responsive columns

  const formBox = m.querySelector('#co-form');
  function applyCols(){ formBox.style.gridTemplateColumns = (window.innerWidth>=640?'1fr 1fr':'1fr'); }
  applyCols(); window.addEventListener('resize', applyCols);
  // Shipping quote
  const shipWrap = document.createElement('div');
  shipWrap.innerHTML = `<div style="margin-top:10px"><div style="font-weight:700;margin:6px 0">Đơn vị vận chuyển</div><div id="co-ship-list" style="display:flex;flex-direction:column;gap:6px"></div><div id=\"co-ship-hint\" style=\"font-size:12px;color:#6b7280;margin-top:4px\">Chọn Tỉnh/Quận/Phường để xem phí vận chuyển ước tính</div></div>`;
  
  // === Area selects (receiver) ===
  (async ()=>{
  const $ = (sel)=>m.querySelector(sel);
  async function getAreas(path){
    try{ const res = await api.get(path); return res?.items||res||[]; }catch(e){ return []; }
  }
  function syncNameAndCode(fromSel, textInput, codeInput){
    const sel = $(fromSel); if(!sel) return;
    const opt = sel.options[sel.selectedIndex];
    if(opt){
      const code = (sel.value||'');
      const name = (opt.text||'');
      const isPlaceholder = !code || /Chọn/i.test(name);
      $(textInput).value = isPlaceholder ? '' : name;
      $(codeInput).value = code;
    }
  }
  async function loadProvinces(selectedName=''){
    const data = await getAreas('/shipping/areas/province');
    const sel = $('#co-province-sel'); sel.innerHTML='<option value="">— Chọn Tỉnh/Thành —</option>';
    data.forEach(it=>{
      const o=document.createElement('option'); o.value=it.code; o.textContent=it.name;
      if(selectedName && it.name.trim().toLowerCase()===selectedName.trim().toLowerCase()) o.selected=true;
      sel.appendChild(o);
    });
    sel.disabled=false;
    if(sel.value){ await loadDistricts(sel.value, $('#co-district').value.trim()); }
    syncNameAndCode('#co-province-sel','#co-province','#co-province-code');
  }
  async function loadDistricts(provinceCode, selectedName=''){
    const data = await getAreas('/shipping/areas/district?province=' + encodeURIComponent(provinceCode||''));
    const sel = $('#co-district-sel'); sel.innerHTML='<option value="">— Chọn Quận/Huyện —</option>';
    data.forEach(it=>{
      const o=document.createElement('option'); o.value=it.code; o.textContent=it.name;
      if(selectedName && it.name.trim().toLowerCase()===selectedName.trim().toLowerCase()) o.selected=true;
      sel.appendChild(o);
    });
    sel.disabled=!provinceCode;
    if(sel.value){ await loadWards(sel.value, $('#co-ward').value.trim()); }
    syncNameAndCode('#co-district-sel','#co-district','#co-district-code');
  }
  async function loadWards(districtCode, selectedName=''){
    const data = await getAreas('/shipping/areas/commune?district=' + encodeURIComponent(districtCode||''));
    const sel = $('#co-ward-sel'); sel.innerHTML='<option value="">— Chọn Phường/Xã —</option>';
    data.forEach(it=>{
      const o=document.createElement('option'); o.value=it.code; o.textContent=it.name;
      if(selectedName && it.name.trim().toLowerCase()===selectedName.trim().toLowerCase()) o.selected=true;
      sel.appendChild(o);
    });
    sel.disabled=!districtCode;
    const opt = sel.options[sel.selectedIndex];
    $('#co-ward-code').value = sel.value||'';
    if(opt) $('#co-ward').value = opt.text||'';
  }
  $('#co-province-sel')?.addEventListener('change', async ()=>{ 
    syncNameAndCode('#co-province-sel','#co-province','#co-province-code');
    await loadDistricts($('#co-province-sel').value,'');
    // trigger ship refresh if needed
    $('#co-province').dispatchEvent(new Event('change'));
  });
  $('#co-district-sel')?.addEventListener('change', async ()=>{ 
    syncNameAndCode('#co-district-sel','#co-district','#co-district-code');
    await loadWards($('#co-district-sel').value,'');
    $('#co-district').dispatchEvent(new Event('change'));
  });
  $('#co-ward-sel')?.addEventListener('change', ()=>{ 
    const opt=$('#co-ward-sel').options[$('#co-ward-sel').selectedIndex];
    $('#co-ward-code').value = $('#co-ward-sel').value||'';
    if(opt) $('#co-ward').value=opt.text||'';
  });
  // Prefill selects using existing text (if any)
  await loadProvinces($('#co-province').value.trim());
  if($('#co-province-code').value){
    $('#co-province-sel').value = $('#co-province-code').value;
    await loadDistricts($('#co-province-code').value, $('#co-district').value.trim());
  }
  if($('#co-district-code').value){
    $('#co-district-sel').value = $('#co-district-code').value;
    await loadWards($('#co-district-code').value, $('#co-ward').value.trim());
  }
  // === end area selects ===
  })();

m.querySelector('#co-items').insertAdjacentElement('afterend', shipWrap);
  async function refreshShip(){
    const hint = m.querySelector('#co-ship-hint');
    const list = m.querySelector('#co-ship-list');
    if(list) list.innerHTML = '';
    const provText = (m.querySelector('#co-province')?.value||'').trim();
    const distText = (m.querySelector('#co-district')?.value||'').trim();
    const wardText = (m.querySelector('#co-ward')?.value||'').trim();
    if(hint){ hint.textContent = 'Đang tính phí vận chuyển...'; }try{
      const prov = (m.querySelector('#co-province')?.value||'').trim();
      const dist = (m.querySelector('#co-district')?.value||'').trim();
      
      const items = cartItems();
      const weight = items.reduce((s,it)=> s + (Number(it.weight)||200)*(Number(it.qty)||1), 0);
      const arr = await shvGetShippingOptions(prov, dist, weight); const list = m.querySelector('#co-ship-list'); list.innerHTML = arr.map((o,i)=>`<label style="display:flex;align-items:center;gap:8px;border:1px solid #e5e7eb;border-radius:8px;padding:8px 10px;cursor:pointer">
        <input type="radio" name="ship" value="${o.provider||o.carrier}:${o.service_code||o.service}" ${i===0?'checked':''}/>
        <div style="flex:1"><div style="font-weight:600">${o.provider||o.carrier||'ĐVVC'} - ${o.name||o.service_name||o.service||''}</div>
        <div style="font-size:12px;color:#6b7280">Thời gian: ${o.leadtime_text||o.leadtime||''}</div></div>
        <div style="white-space:nowrap">${(Number(o.fee||o.price||0)).toLocaleString('vi-VN')}đ</div>
      </label>`).join('');
      const first = list.querySelector('input[name=ship]'); if(first){ first.checked = true; shipFee = Number((first.closest('label').querySelector('div[style*="white-space"]').textContent||'0').replace(/[^0-9]/g,''))||0; chosenShip = first.value; renderTotals(); first.dispatchEvent(new Event('change')); }
      list.querySelectorAll('input[name=ship]').forEach(r=> r.onchange = ()=>{
        const fee = Number((r.closest('label').querySelector('div[style*="white-space"]').textContent||'0').replace(/[^0-9]/g,''));
        shipFee = fee; chosenShip = r.value; renderTotals();
      });
    }catch(e){/*silent*/}
  }
  ['#co-province','#co-district'].forEach(sel=>{ const el=m.querySelector(sel); if(el) el.addEventListener('change', refreshShip); });
  /*auto_select_ship*/ setTimeout(()=>{ try{ const list=m.querySelector('#co-ship-list'); const r=list&&list.querySelector('input[name=ship]'); if(r){ r.checked=true; r.dispatchEvent(new Event('change')); } }catch(e){} }, 200);
 + list.map(it=>`
    <div style="display:flex;gap:10px;padding:6px 0;border-top:1px solid #f3f4f6">
      <img src="${it.image}" style="width:48px;height:48px;object-fit:contain;border-radius:8px;background:#f9fafb;border:1px solid #eee" />
      <div style="flex:1;min-width:0">
        <div style="font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${it.title}</div>
        ${it.variant?`<div style="font-size:12px;color:#6b7280">${it.variant}</div>`:''}
      </div>
      <div style="white-space:nowrap">${it.qty} × ${(Number(it.price)||0).toLocaleString('vi-VN')}đ</div>
    </div>`).join('') + `<div style="text-align:right;font-weight:800;margin-top:8px">Tổng: ${total.toLocaleString('vi-VN')}đ</div>`;

  
  m.querySelector('#co-submit').onclick = async ()=>{
    const customer = {
      name: m.querySelector('#co-name').value.trim(),
      phone: m.querySelector('#co-phone').value.trim(),
      address: m.querySelector('#co-addr').value.trim(),
      province: m.querySelector('#co-province').value.trim(),
      district: m.querySelector('#co-district').value.trim(),
      ward: m.querySelector('#co-ward').value.trim(),
      note: m.querySelector('#co-note').value.trim(),
    province_code: m.querySelector('#co-province-code')?.value||'',
      district_code: m.querySelector('#co-district-code')?.value||'',
      ward_code: m.querySelector('#co-ward-code')?.value||''
    };
    if(!validateCustomer(customer)) return;

    try{
      // read selected shipping option (if any)
      let sp=null; const sel=m.querySelector('#co-ship-list input[name=ship]:checked');
      if(sel){ 
        const parts=(sel.value||'').split(':');
        const provider=parts[0]||''; const service=(parts[1]||'').trim();
        const info=sel.closest('label'); 
        const name=info?.querySelector('div>div')?.textContent?.trim()||null;
        const eta=(info?.querySelector('div>div+div')?.textContent||'').replace('Thời gian:','').trim();
        sp={provider, service, name, eta, fee: (shipFee||0)};
      }
      const totalWeight = cartItems().reduce((s,it)=> s + Number(it.weight_gram||it.weight_grams||it.weight||0)*Number(it.qty||1), 0);
      const body = { 
        items: cartItems(), 
        weight_grams_total: totalWeight,
        customer, 
        totals:{ amount: calcTotal(), ship: (shipFee||0) }, 
        shipping_fee: (shipFee||0),
        shipping_name: sp?.name||null,
        shipping_eta: sp?.eta||null,
        shipping_provider: sp?.provider||null,
        shipping_service: sp?.service||null,
        shipping: { method: (sp? (sp.provider+':'+sp.service) : (chosenShip||'')), fee: (shipFee||0) }, 
        source:'pdp' 
      };
      const r = await api.post('/api/orders', body);
      if(r && r.ok){ setCartItems([]); closeMask('shv-co-mask'); openSuccessModal(r.id, customer); }
      else { alert('Đặt hàng lỗi'); }
    }catch(e){ alert('Đặt hàng lỗi: '+e.message); }
  };

}

// Success modal
function openSuccessModal(orderId, customer){
  const m = mkMask('shv-succ-mask');
  const zHref = (document.getElementById('btn-zalo') && document.getElementById('btn-zalo').href) || 'https://zalo.me/';
  const html = `
  <div style="width:100%;max-width:540px;background:#fff;border-radius:12px;padding:20px;position:relative">
    <div style="font-size:40px;line-height:1">✅</div>
    <div style="font-weight:800;font-size:18px;margin:6px 0 2px">Đã gửi đơn hàng</div>
    <div style="color:#374151;margin-bottom:10px">Chúng tôi sẽ liên hệ để xác nhận và giao hàng sớm nhất.</div>
    <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:10px 12px calc(env(safe-area-inset-bottom, 0) + 10px);margin-bottom:12px">
      <div><b>${customer?.name||''}</b> • ${customer?.phone||''}</div>
      <div style="font-size:13px;color:#6b7280">${[customer?.address, customer?.ward, customer?.district, customer?.province].filter(Boolean).join(', ')}</div>
    </div>
    <div style="display:flex;gap:10px;justify-content:center">
      <a href="/" style="border:1px solid #e5e7eb;background:#fff;border-radius:8px;padding:10px 12px calc(env(safe-area-inset-bottom, 0) + 10px);text-decoration:none">Đặt lại đơn hàng</a>
      <a href="${zHref}" target="_blank" rel="noopener" style="border:1px solid #0068FF;color:#0068FF;background:#fff;border-radius:8px;padding:10px 12px calc(env(safe-area-inset-bottom, 0) + 10px);text-decoration:none;font-weight:700">Liên hệ với Shop</a>
    </div>
    <button onclick="(function(){var m=document.getElementById('shv-succ-mask'); if(m) m.remove();})();" style="position:absolute;right:10px;top:10px;border:none;background:transparent;font-size:22px">✕</button>
  </div>`;
  m.innerHTML = html;
  // SHV_FIX v7: strong CSS overrides with !important + mobile block layout
  (function(){
    const head = document.head || document.getElementsByTagName('head')[0];
    let fix = document.getElementById('shv-co-fix-style');
    if(!fix){
      fix = document.createElement('style');
      fix.id = 'shv-co-fix-style';
      fix.type = 'text/css';
      fix.textContent = `
        /* Mobile-first hard overrides */
        @media (max-width: 767px){
          #shv-co-mask #co-form{ display:block !important; }
          #shv-co-mask #co-form input,
          #shv-co-mask #co-form textarea{ width:100% !important; }
          #shv-co-mask #co-form .co-grid{ display:block !important; width:100% !important; min-width:0 !important; }
          #shv-co-mask #co-form #co-addr,
          #shv-co-mask #co-form #co-note{ grid-column:1 / -1 !important; width:100% !important; }
          #shv-co-mask #co-form #co-province-sel,
          #shv-co-mask #co-form #co-district-sel,
          #shv-co-mask #co-form #co-ward-sel{ grid-column:1 / -1 !important; width:100% !important; max-width:100% !important; display:block !important; }
        }
      `;
      head.appendChild(fix);
    }
  })();

  // Shipping state
  let shipFee = 0; let chosenShip = null;
  // Declare shipping state early to avoid TDZ errors
  // Ensure mobile-safe width & scrolling
  try{ const card=m.firstElementChild; if(card){ card.style.width='calc(100% - 16px)'; card.style.maxWidth='640px'; card.style.margin='0 8px'; card.style.boxSizing='border-box'; card.style.maxHeight='92vh'; card.style.overflow='auto'; card.style.WebkitOverflowScrolling='touch'; }}catch{}
}

// SHV-CWV: PDP image hints
(function(){
  try{
    const imgs = document.querySelectorAll('img');
    let firstSet = false;
    imgs.forEach((img)=>{
      // skip logo in header if any
      const isHeader = !!img.closest('header');
      if(!firstSet && !isHeader){
        img.setAttribute('fetchpriority','high');
        img.setAttribute('loading','eager');
        firstSet = true;
      }else{
        if(!img.hasAttribute('loading')) img.setAttribute('loading','lazy');
      }
      if(!img.hasAttribute('decoding')) img.setAttribute('decoding','async');
      if(!img.hasAttribute('width')) img.setAttribute('width','800');
      if(!img.hasAttribute('height')) img.setAttribute('height','600');
    });
  }catch(e){}
})();