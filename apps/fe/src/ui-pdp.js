let PRODUCT = (window.PRODUCT||{}); let CURRENT = null;
import api from './lib/api.js';
import { formatPrice } from './lib/price.js';

const $  = (s, r=document)=>r.querySelector(s);
const $$ = (s, r=document)=>Array.from(r.querySelectorAll(s));

function q(key, def=''){
  const u = new URL(location.href);
  return u.searchParams.get(key) || def;
}
function toArr(a){ return Array.isArray(a) ? a : (a ? [a] : []); }
function num(x){
  if (x==null || x==='') return 0;
  if (typeof x === 'number' && isFinite(x)) return x;
  if (typeof x === 'string'){
    const cleaned = x.replace(/\s+/g,'').replace(/\./g,'').replace(/,/g,'.');
    const n = Number(cleaned);
    return isNaN(n) ? 0 : n;
  }
  const n = Number(x);
  return isNaN(n) ? 0 : n;
}catch{ return 0; } }
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
  
    const h1 = document.querySelector('header');
    if(h1) h1.style.display = 'none';
    const h2 = document.querySelector('.site-header');
    if(h2) h2.style.display = 'none';
    const h3=document.querySelector('nav'); if(h3) h3.style.display='none';
    const st=document.createElement('style'); st.textContent='body>header{display:none!important}'; document.head.appendChild(st);
  }
}
function imagesOf(p){
  const A = [];
  if (Array.isArray(p?.images)) A.push(...p.images);
  if (p?.image) A.unshift(p.image);
  if (p?.thumb) A.push(p.thumb);
  return A.filter(Boolean).map(String);
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
  let src = CURRENT || null;
  if(!src){
    const vs = variantsOf(PRODUCT);
    if(vs.length){
      let best=null;
      for(const v of vs){ const pr = pricePair(v); if(pr.base>0 && (!best || pr.base<best.base)) best=pr; }
      if(best){
        el && (el.innerHTML = best.original
          ? `<div class='text-rose-600 font-bold text-xl'>${formatPrice(best.base)}</div><div class='line-through text-gray-400'>${formatPrice(best.original)}</div>`
          : `<div class='text-rose-600 font-bold text-xl'>${formatPrice(best.base)}</div>`);
      }
    }
  }
  if(src){
    const {base, original} = pricePair(src);
    if(el){
      el.innerHTML = original
        ? `<div class='text-rose-600 font-bold text-xl'>${formatPrice(base)}</div><div class='line-through text-gray-400'>${formatPrice(original)}</div>`
        : `<div class='text-rose-600 font-bold text-xl'>${formatPrice(base)}</div>`;
    }
  }
  if(stockEl){
    let stk = 0;
    const vs = variantsOf(PRODUCT); if(vs.length){ stk = vs.map(v=> (v.stock||v.qty||v.quantity||0) ).reduce((a,b)=>a+(+b||0),0); }
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
    if(items.length===0){ main.innerHTML=''; return; }
    idx = (i+items.length)%items.length;
    const it = items[idx];
    if(it.type==='video'){
      main.innerHTML = `<video id="pdp-video" playsinline controls style="width:100%;height:100%;object-fit:cover;background:#000;border-radius:12px"></video>`;
      const v=main.querySelector('#pdp-video'); v.src=it.src; v.load();
    }else{
      main.innerHTML = `<img src="${it.src}" style="width:100%;height:100%;object-fit:cover;border-radius:12px" />`;
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
    const vs = variantsOf(PRODUCT);
    const pricePairs = vs.map(v=> pricePair(v)).filter(p=>p.base>0);
    let priceHTML='';
    if(pricePairs.length){
      const min = Math.min(...pricePairs.map(p=>p.base));
      const max = Math.max(...pricePairs.map(p=>p.base));
      priceHTML = `<div style="font-weight:800;color:#dc2626;font-size:20px;margin-top:6px">${min===max?formatPrice(min):formatPrice(min)+' - '+formatPrice(max)}</div>`;
    }
    const countHTML = vs.length ? `<div style="font-size:13px;color:#6b7280;margin-top:6px">${vs.length} phân loại có sẵn</div>` : '';
    const list = vs.slice(0,12).map((v,i)=>{
      const img = imagesOf(v)[0] || imagesOf(PRODUCT)[0] || '';
      const name = v.name || v.sku || ('Loại '+(i+1));
      return `<button data-vidx="${i}" style="border:1px solid #e5e7eb;border-radius:10px;padding:6px;background:#fff;display:flex;align-items:center;gap:8px">
        <img src="${img}" style="width:48px;height:48px;object-fit:cover;border-radius:8px;background:#f3f4f6" />
        <span style="font-size:13px">${name}</span>
      </button>`;
    }).join('');
    thumbs.style.display='none'; thumbs.innerHTML='';
    thumbs.style.gridTemplateColumns = 'repeat(4,minmax(0,1fr))';
    thumbs.innerHTML = (countHTML ? `<div style="grid-column:1/-1">${countHTML}</div>` : '') + list + (priceHTML? `<div style="grid-column:1/-1">${priceHTML}</div>`:'');
    thumbs.querySelectorAll('button[data-vidx]').forEach(btn=>{
      btn.onclick=()=>{ const v=vs[Number(btn.getAttribute('data-vidx'))]; if(v){ CURRENT=v; renderPriceStock(); } };
    });
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
   const a=$('#btn-add'); const z=$('#btn-zalo'); if(a) a.style.display='none'; if(z) z.style.display='none'; const group=(a&&a.parentElement===z?.parentElement ? a.parentElement : (a&&a.parentElement)|| (z&&z.parentElement)); if(group){ group.style.display='none'; } }
  const btn = $('#btn-add'); if(!btn) return;
  btn.addEventListener('click', ()=>{ openVariantModal('cart'); return; /* legacy below disabled */

    const src = CURRENT || PRODUCT;
    const item = {
      id: String(PRODUCT.id||PRODUCT._id||PRODUCT.slug||Date.now()),
      title: PRODUCT.title || PRODUCT.name || '',
      image: imagesOf(src||PRODUCT)[0] || '',
      variant: (CURRENT && (CURRENT.name||CURRENT.sku||'')) || '',
      price: pricePair(src).base || 0,
      qty: 1
    };
    
      const cart = JSON.parse(localStorage.getItem('CART')||'[]'); cart.push(item);
      localStorage.setItem('CART', JSON.stringify(cart));
      alert('Đã thêm vào giỏ!');
    }
  });
}

async function fetchProduct(id){
  const paths = [`/public/products/${encodeURIComponent(id)}`, `/products/${encodeURIComponent(id)}`];
  for(const p of paths){
    
      const r = await api(p);
      if(r && (r.item || r.product || (r.id || r.title))){
        return r.item || r.product || r;
      }
    }
  }
  // fallback list then find
  
    const list = await api('/public/products');
    const items = list?.items || list?.products || [];
    const f = (items||[]).find(x=>String(x.id||x._id||'')===String(id));
    if(f) return f;
  }
  return null;
}

(async function init(){
  
    const id = q('id','').trim();
    if(!id){ console.warn('No id'); return; }
    const item = await fetchProduct(id);
    if(!item){ console.warn('Product not found'); return; }
    PRODUCT = item; CURRENT = null;
    renderTitle(); renderPriceStock(); renderVariants(); renderMedia(); renderDesc(); renderFAQ(); renderReviews(); attachCart(); injectFloatingCart(); injectStickyCTA(); updateStickyCTA();  getSettings().then(s=>{ const pdp=s?.pdp||s; if(pdp?.countdown_until){ const t=Number(pdp.countdown_until); if(t>Date.now()) renderCountdown(t); } if(Array.isArray(pdp?.badges)) renderBadges(pdp.badges); }); }
  }
})();

// ===== Extra PDP UX (Ladipage-like) =====
async function getSettings(){
  // Try public settings first, then legacy
   const s = await api('/public/settings'); return s?.settings || s || {}; }
   const s = await api('/settings'); return s || {}; }
  return {};
}
function cartCount(){  return JSON.parse(localStorage.getItem('CART')||'[]').length }catch{ return 0 } }
function goCart(){  openCartModal(); } }

function injectFloatingCart(){
  if(document.getElementById('shv-float-cart')) return;
  const btn = document.createElement('a');
  btn.id = 'shv-float-cart';
  btn.href = '/cart.html';
  btn.setAttribute('aria-label','Giỏ hàng');
  btn.style.cssText = 'position:fixed;right:14px;bottom:90px;z-index:60;background:#111827;color:#fff;width:52px;height:52px;border-radius:26px;display:flex;align-items:center;justify-content:center;box-shadow:0 8px 24px rgba(0,0,0,.2)';
  btn.innerHTML = '<span style="font-size:22px;line-height:1">🛒</span><span id="shv-float-cart-badge" style="position:absolute;top:-6px;right:-6px;background:#ef4444;color:#fff;border-radius:10px;padding:1px 6px;font-size:12px;font-weight:700;">0</span>';
  document.body.appendChild(btn); btn.addEventListener('click', function(e){ e.preventDefault();  openCartModal(); } });
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
  const vs = variantsOf(PRODUCT);
  const imgs = imagesOf(PRODUCT);
  const current = null;
  const html = `
  <div style="width:100%;max-width:520px;max-height:88vh;overflow:auto;background:#fff;border-radius:12px 12px 0 0;padding:16px 16px 80px 16px;position:relative">
    <div style="display:flex;gap:10px">
      <img src="${(imagesOf(current)[0]||imgs[0]||'')}" style="width:72px;height:72px;object-fit:cover;border-radius:10px;border:1px solid #eee;background:#f8fafc" />
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

  // Render variants buttons
  function renderVBtns(active){
    const box = m.querySelector('#vm-variants');
    const arr = variantsOf(PRODUCT);
    box.innerHTML = arr.map((v,i)=>{
      const {base}=pricePair(v); const img = imagesOf(v)[0]||'';
      const name = (v.name||v.sku||('Loại '+(i+1)));
      const act = (active===i) ? 'border-color:#ef4444;color:#ef4444;background:#fff1f2;' : '';
      return `<button data-k="${i}" style="display:flex;align-items:center;gap:6px;border:1px solid #e5e7eb;border-radius:8px;padding:8px 10px;background:#fff;${act}">${img?`<img src="${img}" style="width:28px;height:28px;object-fit:cover;border-radius:6px">`:''}<span>${name}${base?` `:''}</span></button>`;
    }).join('');
    box.querySelectorAll('button[data-k]').forEach(btn=>btn.onclick=()=>{ 
      const k=+btn.dataset.k; CURRENT = arr[k]; renderVBtns(k); updPrice(); 
    });
  }
  function updPrice(){
    const src = CURRENT || PRODUCT;
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
    const src = CURRENT || PRODUCT;
    const item = { id:String(PRODUCT.id||PRODUCT._id||PRODUCT.slug||Date.now()), title:PRODUCT.title||PRODUCT.name||'', image:(imagesOf(src||PRODUCT)[0]||''), variant:(CURRENT && (CURRENT.name||CURRENT.sku||''))||'', price: pricePair(src).base||0, qty };
     const cart=JSON.parse(localStorage.getItem('CART')||'[]'); cart.push(item); localStorage.setItem('CART', JSON.stringify(cart)); }}

  m.querySelector('#vm-add').onclick = ()=>{ addSelectedToCart(); closeMask(); openCartModal(); };
  m.querySelector('#vm-buy').onclick = ()=>{ addSelectedToCart(); closeMask(); openCheckoutModal(); };
  m.querySelector('#vm-close').onclick = ()=> closeMask();

  if(mode==='buy'){/* nothing extra */}
}

// Cart modal bottom sheet
function cartItems(){  return JSON.parse(localStorage.getItem('CART')||'[]'); }catch{ return []; } }
function setCartItems(arr){ localStorage.setItem('CART', JSON.stringify(arr)); }
function calcTotal(){ return cartItems().reduce((s,it)=>s + (Number(it.price)||0)*(Number(it.qty)||1), 0); }

function openCartModal(){
  const m = mkMask('shv-cart-mask');
  const items = cartItems();
  const html = `
  <div style="width:100%;max-width:560px;max-height:88vh;overflow:auto;background:#fff;border-radius:12px 12px 0 0;padding:12px 12px 80px 12px;position:relative">
    <div style="display:flex;align-items:center;justify-content:space-between;padding:6px 4px 10px">
      <div style="font-weight:800">GIỎ HÀNG (${items.length})</div>
      <button id="cm-close" style="border:none;background:transparent;font-size:22px">✕</button>
    </div>
    <div id="cm-list"></div>
    <div style="position:sticky;left:0;right:0;bottom:0;background:#fff;padding-top:12px;margin-top:16px;display:flex;align-items:center;justify-content:space-between;gap:10px">
      <div style="font-weight:700">Tổng: <span id="cm-total" style="color:#dc2626"></span></div>
      <button id="cm-checkout" style="flex:0 0 auto;background:#ef4444;color:#fff;border:none;border-radius:8px;padding:12px 16px;font-weight:700">ĐẶT HÀNG NGAY</button>
    </div>
  </div>`;
  m.innerHTML = html;
  const list = m.querySelector('#cm-list');
  function render(){
    const arr = cartItems();
    list.innerHTML = arr.map((it,idx)=>`
      <div style="display:flex;gap:10px;padding:8px 0;border-top:1px solid #f3f4f6">
        <img src="${it.image||''}" style="width:56px;height:56px;object-fit:cover;border-radius:8px;background:#f9fafb;border:1px solid #eee">
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
  let shipFee = 0; let chosenShip = null;
  const m = mkMask('shv-co-mask');
  const html = `
  <div style="width:100%;max-width:640px;max-height:92vh;overflow:auto;background:#fff;border-radius:12px;padding:14px 14px 80px 14px;position:relative">
    <div style="display:flex;align-items:center;gap:6px;padding-bottom:10px">
      <button id="co-back" style="border:none;background:transparent;font-size:22px">←</button>
      <div style="font-weight:800">HOÀN TẤT ĐƠN HÀNG</div>
      <button id="co-close" style="margin-left:auto;border:none;background:transparent;font-size:22px">✕</button>
    </div>
    <div id="co-form" style="display:grid;grid-template-columns:1fr;gap:10px">
      <input id="co-name" placeholder="Họ và tên" style="border:1px solid #e5e7eb;border-radius:8px;padding:10px 12px" />
      <input id="co-phone" placeholder="Số điện thoại" style="border:1px solid #e5e7eb;border-radius:8px;padding:10px 12px" />
      <input id="co-addr" placeholder="Số nhà, thôn, xóm,.." style="grid-column:1/3;border:1px solid #e5e7eb;border-radius:8px;padding:10px 12px" />
      <input id="co-province" placeholder="Tỉnh/Thành" style="border:1px solid #e5e7eb;border-radius:8px;padding:10px 12px" />
      <input id="co-district" placeholder="Quận/Huyện" style="border:1px solid #e5e7eb;border-radius:8px;padding:10px 12px" />
      <input id="co-ward" placeholder="Phường/Xã" style="border:1px solid #e5e7eb;border-radius:8px;padding:10px 12px" />
      <textarea id="co-note" placeholder="Để lại lời nhắn cho chúng tôi" style="grid-column:1/3;border:1px solid #e5e7eb;border-radius:8px;padding:10px 12px;min-height:80px"></textarea>
    </div>

    <div style="margin-top:12px;border-top:1px solid #f3f4f6;padding-top:10px" id="co-items"></div>

    <div style="position:sticky;left:0;right:0;bottom:0;background:#fff;padding-top:12px;margin-top:16px;display:flex;justify-content:center">
      <button id="co-submit" style="background:#ef4444;color:#fff;border:none;border-radius:8px;padding:12px 22px;font-weight:800">ĐẶT HÀNG</button>
    </div>
  </div>`;
  m.innerHTML = html;
  m.querySelector('#co-back').onclick=()=>{ closeMask('shv-co-mask'); openCartModal(); };
  m.querySelector('#co-close').onclick=()=>closeMask('shv-co-mask');


  function renderTotals(){ 
    const sub = calcTotal();
    const grand = sub + (shipFee||0);
    const d1 = m.querySelector('#co-sub'); if(d1) d1.textContent = 'Tạm tính: ' + sub.toLocaleString('vi-VN') + 'đ';
    const d2 = m.querySelector('#co-shipfee'); if(d2) d2.textContent = 'Phí vận chuyển: ' + (shipFee||0).toLocaleString('vi-VN') + 'đ';
    const d3 = m.querySelector('#co-grand'); if(d3) d3.textContent = 'Tổng: ' + grand.toLocaleString('vi-VN') + 'đ';
  }
  renderTotals(); setTimeout(refreshShip, 0);

  const list = cartItems();
  const box = m.querySelector('#co-items');
  const total = calcTotal();
  box.innerHTML = `<div style="font-weight:700;margin-bottom:6px">Thông tin sản phẩm</div>`
  // Responsive columns
  const formBox = m.querySelector('#co-form');
  function applyCols(){ formBox.style.gridTemplateColumns = (window.innerWidth>=640?'1fr 1fr':'1fr'); }
  applyCols(); window.addEventListener('resize', applyCols);

  // Shipping quote
  let shipFee = 0; let chosenShip = null;
  const shipWrap = document.createElement('div');
  shipWrap.innerHTML = `<div style="margin-top:10px"><div style="font-weight:700;margin:6px 0">Đơn vị vận chuyển</div><div id="co-ship-list" style="display:flex;flex-direction:column;gap:6px"></div></div>`;
  m.querySelector('#co-items').insertAdjacentElement('afterend', shipWrap);
  async function refreshShip(){
    
      const prov = (m.querySelector('#co-province')?.value||'').trim();
      const dist = (m.querySelector('#co-district')?.value||'').trim();
      if(!prov || !dist) return;
      const items = cartItems();
      const weight = items.reduce((s,it)=> s + (Number(it.weight)||200)*(Number(it.qty)||1), 0);
      const qs = `/shipping/quote?to_province=${encodeURIComponent(prov)}&to_district=${encodeURIComponent(dist)}&weight=${weight}&cod=0`;
      const res = await api.get(qs);
      const arr = (res?.items||res||[]);
      const list = m.querySelector('#co-ship-list');
      list.innerHTML = arr.map((o,i)=>`<label style="display:flex;align-items:center;gap:8px;border:1px solid #e5e7eb;border-radius:8px;padding:8px 10px;cursor:pointer">
        <input type="radio" name="ship" value="${o.provider||o.carrier}:${o.service_code||o.service}" ${i===0?'checked':''}/>
        <div style="flex:1"><div style="font-weight:600">${o.provider||o.carrier||'ĐVVC'} - ${o.name||o.service_name||o.service||''}</div>
        <div style="font-size:12px;color:#6b7280">Thời gian: ${o.leadtime_text||o.leadtime||''}</div></div>
        <div style="white-space:nowrap">${(Number(o.fee||o.price||0)).toLocaleString('vi-VN')}đ</div>
      </label>`).join('');
      const first = list.querySelector('input[name=ship]');
      if(first){ first.dispatchEvent(new Event('change')); }
      list.querySelectorAll('input[name=ship]').forEach(r=> r.onchange = ()=>{
        const fee = Number((r.closest('label').querySelector('div[style*="white-space"]').textContent||'0').replace(/[^0-9]/g,''));
        shipFee = fee; chosenShip = r.value; renderTotals();
      });
    }
  }
  ['#co-province','#co-district'].forEach(sel=>{ const el=m.querySelector(sel); if(el) el.addEventListener('change', refreshShip); });
 + list.map(it=>`
    <div style="display:flex;gap:10px;padding:6px 0;border-top:1px solid #f3f4f6">
      <img src="${it.image}" style="width:48px;height:48px;object-fit:cover;border-radius:8px;background:#f9fafb;border:1px solid #eee" />
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
    };
    
      const body = { items: cartItems(), customer, totals:{ amount: calcTotal(), shipping_fee: shipFee }, shipping: { method: chosenShip, fee: shipFee }, source:'pdp' };
      const r = await api.post('/public/orders/create', body);
      if(r && r.ok){ setCartItems([]); closeMask('shv-co-mask'); openSuccessModal(r.id, customer); }
      else { alert('Đặt hàng lỗi'); }
    }
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
    <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:10px 12px;margin-bottom:12px">
      <div><b>${customer?.name||''}</b> • ${customer?.phone||''}</div>
      <div style="font-size:13px;color:#6b7280">${[customer?.address, customer?.ward, customer?.district, customer?.province].filter(Boolean).join(', ')}</div>
    </div>
    <div style="display:flex;gap:10px;justify-content:center">
      <a href="/" style="border:1px solid #e5e7eb;background:#fff;border-radius:8px;padding:10px 12px;text-decoration:none">Đặt lại đơn hàng</a>
      <a href="${zHref}" target="_blank" rel="noopener" style="border:1px solid #0068FF;color:#0068FF;background:#fff;border-radius:8px;padding:10px 12px;text-decoration:none;font-weight:700">Liên hệ với Shop</a>
    </div>
    <button onclick="(function(){var m=document.getElementById('shv-succ-mask'); if(m) m.remove();})();" style="position:absolute;right:10px;top:10px;border:none;background:transparent;font-size:22px">✕</button>
  </div>`;
  m.innerHTML = html;
}