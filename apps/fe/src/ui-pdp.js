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
    CURRENT = list[k]; renderPriceStock(); renderMedia(CURRENT);
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
    renderTitle(); renderPriceStock(); renderVariants(); renderMedia(); renderDesc(); renderFAQ(); renderReviews(); attachCart();
  }catch(e){ console.error(e); }
})();