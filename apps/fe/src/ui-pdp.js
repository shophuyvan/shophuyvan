
// ui-pdp.js — clean ES module build for PDP
// No external deps; safe for Cloudflare Pages. Console must be clean.
const $ = (sel, root=document)=>root.querySelector(sel);
const $$ = (sel, root=document)=>Array.from(root.querySelectorAll(sel));
const apiBase = ''; // relative; site routes to Workers

async function api(path, init){
  const url = path.startsWith('http') ? path : `${apiBase}${path}`;
  const r = await fetch(url, {credentials:'omit', ...init});
  if(!r.ok) throw new Error(`API ${r.status}`);
  const ct = r.headers.get('content-type')||'';
  return ct.includes('application/json') ? r.json() : r.text();
}
const qp = (k, def='') => new URL(location.href).searchParams.get(k) ?? def;

const money = (n)=> (Number(n)||0).toLocaleString('vi-VN') + 'đ';
const imagesOf = (p)=> Array.isArray(p?.images) ? p.images.filter(Boolean) : [];
const pricePair = (p)=>{
  const raw = Number(p?.price)||0;
  const sale = Number(p?.price_sale||0);
  const base = sale>0 && sale<raw ? sale : raw;
  return { base, compareAt: sale>0 && sale<raw ? raw : 0 };
};

// --- Renderers ---
function renderMedia(imgs){
  const main = $('#media-main'); const thumbs = $('#media-thumbs');
  if(!main || !thumbs) return;
  main.innerHTML = ''; thumbs.innerHTML = '';
  if(!imgs.length){
    main.innerHTML = `<div class="w-full h-full grid place-content-center text-gray-400">Không có ảnh</div>`;
    return;
  }
  let idx = 0;
  const show = (i)=>{
    idx = i;
    main.innerHTML = `<img src="${imgs[i]}" alt="Ảnh sản phẩm" class="w-full h-full object-cover" loading="lazy">`;
    $$('.is-active', thumbs).forEach(el=>el.classList.remove('is-active'));
    const t = thumbs.children[i]; if(t) t.classList.add('is-active');
  };
  imgs.forEach((src,i)=>{
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'relative aspect-square border rounded overflow-hidden';
    b.innerHTML = `<img src="${src}" alt="" class="absolute inset-0 w-full h-full object-cover" loading="lazy">`;
    b.addEventListener('click', ()=>show(i));
    thumbs.appendChild(b);
  });
  show(0);
}

function renderTitle(p){
  $('#p-title').textContent = p?.title || p?.name || '';
  $('#p-sold').textContent = `${Number(p?.sold||0)} đã bán`;
  $('#p-rating').textContent = (p?.rating||5) + '★';
}
function renderPriceStock(p){
  const {base, compareAt} = pricePair(p);
  $('#p-price').innerHTML = compareAt
    ? `<span class="text-rose-600">${money(base)}</span> <s class="text-gray-400 text-base align-middle">${money(compareAt)}</s>`
    : money(base);
  $('#p-stock').textContent = (p?.stock>0) ? `Còn ${p.stock} hàng` : 'Hết hàng';
}
function renderDesc(p){
  const el = $('#p-desc');
  el.innerHTML = (p?.description_html) ? p.description_html : (p?.description||'').replace(/\n/g,'<br>');
}
function renderFAQ(list){
  const root = $('#p-faq'); root.innerHTML='';
  (list||[]).forEach(x=>{
    const d = document.createElement('details');
    d.innerHTML = `<summary class="cursor-pointer font-medium">${x.q||x.question||''}</summary><div class="text-sm text-gray-700 pl-2">${x.a||x.answer||''}</div>`;
    root.appendChild(d);
  });
}
function renderReviews(list){
  const root = $('#p-reviews'); root.innerHTML='';
  (list||[]).forEach(r=>{
    const div = document.createElement('div');
    div.className = 'border rounded p-2 bg-white';
    div.innerHTML = `<div class="font-medium">${r.author||'Khách'}</div><div class="text-sm">${r.text||''}</div>`;
    root.appendChild(div);
  });
}

function injectJSONLD(p){
  try{
    const data = {
      "@context": "https://schema.org",
      "@type": "Product",
      name: p?.title||p?.name||'',
      image: imagesOf(p),
      description: p?.description||'',
      sku: p?.sku||'',
      offers: { "@type": "Offer", priceCurrency: "VND", price: pricePair(p).base, availability: "https://schema.org/InStock" }
    };
    const tag = document.getElementById('json-ld-product') || document.getElementById('id-product');
    if(tag) tag.textContent = JSON.stringify(data);
  }catch(_){}
}

// --- Cart (localStorage) ---
function cartItems(){ try{ return JSON.parse(localStorage.getItem('CART')||'[]'); }catch(e){ return []; } }
function setCartItems(arr){ localStorage.setItem('CART', JSON.stringify(arr||[])); }
function addToCart(p){
  const its = cartItems();
  const firstImg = imagesOf(p)[0]||'';
  its.push({ id: String(p?.id||p?._id||p?.slug||Date.now()), title: p?.title||p?.name||'', price: pricePair(p).base, image: firstImg, qty: 1 });
  setCartItems(its);
  alert('Đã thêm vào giỏ!');
}

// --- Data fetchers ---
async function fetchProduct(id){
  // Try by id with 2 endpoints, then list fallback
  const paths = [`/public/products/${encodeURIComponent(id)}`, `/products/${encodeURIComponent(id)}`];
  for(const p of paths){
    try{
      const r = await api(p);
      if(r && (r.item || r.product || (r.id || r.title))) return r.item || r.product || r;
    }catch(_){}
  }
  try{
    const list = await api(`/public/products`);
    const items = list?.items || list?.products || [];
    return (items||[]).find(x=>String(x.id||x._id||'')===String(id)) || null;
  }catch(_){ return null; }
}

(async function init(){
  try{
    const id = qp('id','').trim();
    if(!id) return;
    const p = await fetchProduct(id);
    if(!p) return;

    // Render UI
    renderTitle(p);
    renderPriceStock(p);
    renderMedia(imagesOf(p));
    renderDesc(p);
    renderFAQ(p?.faq||p?.faqs||[]);
    renderReviews(p?.reviews||[]);
    injectJSONLD(p);

    // Wire actions
    const btn = $('#btn-add');
    if(btn){
      btn.addEventListener('click', ()=> addToCart(p));
    }
    const zalo = $('#btn-zalo');
    if(zalo){
      const phone = (p?.zalo||'').replace(/\D/g,'');
      if(phone) zalo.href = `https://zalo.me/${phone}`;
    }
  }catch(e){
    console.warn('PDP init error', e);
  }
})();
