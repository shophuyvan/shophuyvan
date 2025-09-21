import api from './lib/api.js';
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
  return sale>0 ? {base:sale, original: (reg>0?reg:null)} : {base: (reg>0?reg:0), original:null};
}
function imagesOf(p){
  const A = [];
  if (Array.isArray(p?.images)) A.push(...p.images);
  if (p?.image) A.unshift(p.image);
  if (p?.thumb) A.push(p.thumb);
  return A.filter(Boolean).map(String);
}
function variantsOf(p){
  if (Array.isArray(p?.variants)) return p.variants;
  const keys = ['skus','sku_list','children','items','options','variations','combos','list'];
  for(const k of keys){ const v = p?.[k]; if(Array.isArray(v)) return v; }
  return [];
}
function htmlEscape(s){ return String(s||'').replace(/[&<>"]/g, m=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[m])); }
function mdToHTML(raw){
  if(!raw) return '';
  const lines = String(raw).split(/\r?\n/);
  const out=[]; let list=[];
  const flush=()=>{ if(list.length){ out.push('<ul>'+list.map(li=>'<li>'+htmlEscape(li)+'</li>').join('')+'</ul>'); list=[]; } };
  for(const L of lines){
    const t=L.trim(); if(!t) { flush(); continue; }
    if(/^[-*•]\s+/.test(t)){ list.push(t.replace(/^[-*•]\s+/,'')); continue; }
    const h=t.match(/^#{1,6}\s+(.*)$/); if(h){ flush(); const lvl=t.match(/^#{1,6}/)[0].length; out.push(`<h${lvl}>${htmlEscape(h[1])}</h${lvl}>`); continue; }
    out.push('<p>'+htmlEscape(t)+'</p>');
  }
  flush(); return out.join('\n');
}

let PRODUCT=null;
let CURRENT=null;

function renderTitle(){
  $('#p-title') && ($('#p-title').textContent = PRODUCT.title || PRODUCT.name || 'Sản phẩm');
  $('#p-sold')  && ($('#p-sold').textContent  = (num(PRODUCT.sold||PRODUCT.sold_count||0))+' đã bán');
  $('#p-rating')&& ($('#p-rating').textContent= String(PRODUCT.rating||'5★'));
}
function renderPriceStock(){
  const src = CURRENT || PRODUCT || {};
  const {base, original} = pricePair(src);
  const priceEl = $('#p-price'); const stockEl = $('#p-stock');
  if(priceEl){
    if(original && original>base){
      priceEl.innerHTML = `<span class="text-rose-600">${formatPrice(base)}</span> <s class="text-gray-400 text-base">${formatPrice(original)}</s>`;
    }else{
      priceEl.innerHTML = `<span class="text-rose-600">${formatPrice(base)}</span>`;
    }
  }
  if(stockEl){
    let stk = num(src.stock ?? src.qty ?? src.quantity ?? PRODUCT.stock ?? 0);
    if(!stk){
      const vs = variantsOf(PRODUCT);
      if(vs.length){ stk = vs.map(v=>num(v.stock||v.qty||v.quantity)).reduce((a,b)=>a+b,0); }
    }
    stockEl.textContent = stk>0 ? ('Còn '+stk) : 'Hết hàng';
  }
}
function renderVariants(){
  const box = $('#p-variants'); if(!box) return;
  const list = variantsOf(PRODUCT);
  if(!list.length){ box.innerHTML = ''; return; }
  const html = list.map((v,i)=>{
    const {base} = pricePair(v);
    const name = htmlEscape(v.name || v.sku || ('Phân loại '+(i+1)));
    const ptxt = base ? ` – ${formatPrice(base)}` : '';
    const active = (CURRENT && (CURRENT===v)) ? ' ring-2 ring-rose-600 ' : '';
    return `<button data-k="${i}" class="px-3 py-2 rounded border bg-white hover:bg-gray-50 ${active}">${name}${ptxt}</button>`;
  }).join('');
  box.innerHTML = html;
  $$('button[data-k]', box).forEach(btn=>btn.addEventListener('click', e=>{
    const k = +btn.dataset.k;
    CURRENT = list[k]; renderPriceStock(); renderMedia(CURRENT); updateStickyCTA();
  }));
}
function renderMedia(prefer){
  const main = $('#media-main'); const thumbs = $('#media-thumbs');
  if(!main || !thumbs) return;
  const imgs = imagesOf(prefer||PRODUCT);
  const video = (prefer||PRODUCT)?.video || (prefer||PRODUCT)?.video_url || '';
  const media = [...(video?[{type:'video',src:video}]:[]), ...imgs.map(s=>({type:'img',src:s}))];
  if(!media.length){ main.innerHTML=''; thumbs.innerHTML=''; return; }
  let idx=0;
  function show(i){
    idx=(i+media.length)%media.length;
    const m=media[idx];
    if(m.type==='video'){
      main.innerHTML = `<video controls playsinline muted class="w-full h-full object-contain bg-white"><source src="${m.src}"></video>`;
      setTimeout(()=>{ const v=$('#media-main video'); try{ v.play().catch(()=>{});}catch{} },50);
    }else{
      main.innerHTML = `<img loading="eager" class="w-full h-full object-contain bg-white" src="${m.src}" alt="">`;
    }
    thumbs.innerHTML = media.map((t,k)=>`<button data-k="${k}" class="w-16 h-16 border rounded overflow-hidden ${k===idx?'ring-2 ring-rose-600':''}">${t.type==='img'?`<img class="w-full h-full object-cover" src="${t.src}">`:'<span class="text-xs px-1">VIDEO</span>'}</button>`).join('');
    $$('button[data-k]', thumbs).forEach(b=>b.onclick=()=>show(+b.dataset.k));
  }
  show(0);
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
  const btn = $('#btn-add'); if(!btn) return;
  btn.addEventListener('click', ()=>{
    const src = CURRENT || PRODUCT;
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
function cartCount(){ try{ return JSON.parse(localStorage.getItem('CART')||'[]').length }catch{ return 0 } }
function goCart(){ location.href = '/cart.html'; }

function injectFloatingCart(){
  if(document.getElementById('shv-float-cart')) return;
  const btn = document.createElement('a');
  btn.id = 'shv-float-cart';
  btn.href = '/cart.html';
  btn.setAttribute('aria-label','Giỏ hàng');
  btn.style.cssText = 'position:fixed;right:14px;bottom:90px;z-index:60;background:#111827;color:#fff;width:52px;height:52px;border-radius:26px;display:flex;align-items:center;justify-content:center;box-shadow:0 8px 24px rgba(0,0,0,.2)';
  btn.innerHTML = '<span style="font-size:22px;line-height:1">🛒</span><span id="shv-float-cart-badge" style="position:absolute;top:-6px;right:-6px;background:#ef4444;color:#fff;border-radius:10px;padding:1px 6px;font-size:12px;font-weight:700;">0</span>';
  document.body.appendChild(btn);
  const upd=()=>{ const c=cartCount(); const b=document.getElementById('shv-float-cart-badge'); if(b) b.textContent=String(c) };
  upd(); setInterval(upd, 1500);
}

function injectStickyCTA(){
  if(document.getElementById('shv-sticky-cta')) return;
  const wrap = document.createElement('div');
  wrap.id = 'shv-sticky-cta';
  wrap.style.cssText = 'position:fixed;left:0;right:0;bottom:0;z-index:50;background:#ffffff;box-shadow:0 -4px 18px rgba(0,0,0,.08);border-top:1px solid #e5e7eb';
  wrap.innerHTML = `
    <div style="max-width:1120px;margin:0 auto;padding:10px 16px;display:flex;align-items:center;gap:12px">
      <img id="shv-cta-thumb" alt="" style="width:44px;height:44px;object-fit:cover;border-radius:8px;background:#f9fafb;border:1px solid #e5e7eb" />
      <div style="flex:1;min-width:0">
        <div id="shv-cta-title" style="font-size:14px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis"></div>
        <div id="shv-cta-price" style="font-size:16px;font-weight:700;color:#dc2626"></div>
      </div>
      <div style="display:flex;align-items:center;gap:8px">
        <button id="shv-cta-dec" aria-label="Giảm" style="width:32px;height:32px;border-radius:6px;border:1px solid #e5e7eb;background:#fff">−</button>
        <input id="shv-cta-qty" type="number" min="1" value="1" style="width:56px;height:32px;border:1px solid #e5e7eb;border-radius:6px;text-align:center" />
        <button id="shv-cta-inc" aria-label="Tăng" style="width:32px;height:32px;border-radius:6px;border:1px solid #e5e7eb;background:#fff">+</button>
      </div>
      <button id="shv-cta-buy" style="background:#dc2626;color:#fff;border:none;border-radius:8px;padding:10px 16px;font-weight:700">MUA NGAY</button>
    </div>`;
  document.body.appendChild(wrap);

  const dec = ()=>{ const inp=document.getElementById('shv-cta-qty'); let v=Math.max(1, parseInt(inp.value||'1',10)-1); inp.value=String(v); };
  const inc = ()=>{ const inp=document.getElementById('shv-cta-qty'); let v=Math.max(1, parseInt(inp.value||'1',10)+1); inp.value=String(v); };
  document.getElementById('shv-cta-dec').onclick = dec;
  document.getElementById('shv-cta-inc').onclick = inc;
  document.getElementById('shv-cta-buy').onclick = ()=>{
    const qty = Math.max(1, parseInt(document.getElementById('shv-cta-qty').value||'1',10));
    const src = CURRENT || PRODUCT;
    const item = {
      id: String(PRODUCT.id||PRODUCT._id||PRODUCT.slug||Date.now()),
      title: PRODUCT.title || PRODUCT.name || '',
      image: (imagesOf(src||PRODUCT)[0]||''),
      variant: (CURRENT && (CURRENT.name||CURRENT.sku||'')) || '',
      price: pricePair(src).base || 0,
      qty
    };
    try{
      const cart = JSON.parse(localStorage.getItem('CART')||'[]'); cart.push(item);
      localStorage.setItem('CART', JSON.stringify(cart));
      goCart();
    }catch(e){ alert('Không thể thêm giỏ: '+e.message); }
  };
}
function updateStickyCTA(){
  const t=document.getElementById('shv-cta-title');
  const p=document.getElementById('shv-cta-price');
  const im=document.getElementById('shv-cta-thumb');
  if(!t||!p||!im) return;
  const src = CURRENT || PRODUCT || {};
  t.textContent = (PRODUCT.title || PRODUCT.name || 'Sản phẩm');
  const pr = pricePair(src);
  p.textContent = (pr.base||0).toLocaleString('vi-VN') + 'đ';
  im.src = (imagesOf(src)[0] || imagesOf(PRODUCT)[0] || '');
}

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
