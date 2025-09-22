
// ui-pdp.js — SHV PDP v72e (self-mount, robust fetch, zero-console errors)
const $ = (s,r=document)=>r.querySelector(s);
const $$= (s,r=document)=>Array.from(r.querySelectorAll(s));
const qp= (k,def='') => new URL(location.href).searchParams.get(k) ?? def;

const money = n => (Number(n)||0).toLocaleString('vi-VN') + 'đ';
const imgs  = p => Array.isArray(p?.images) ? p.images.filter(Boolean) : [];
const price = p => {
  const raw = Number(p?.price)||0, sale = Number(p?.price_sale||0);
  return {base: sale>0 && sale<raw? sale: raw, compareAt: sale>0 && sale<raw? raw: 0};
};

function ensureMount(){
  let host = document.getElementById('pdp-root');
  if(host) return host;
  let main = document.querySelector('main'); if(!main){ main=document.createElement('main'); document.body.appendChild(main); }
  host = document.createElement('section'); host.id='pdp-root';
  host.innerHTML = `
  <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
    <div class="rounded-lg border bg-white p-2">
      <div id="media-main" class="aspect-square w-full rounded-lg bg-gray-100 grid place-content-center text-gray-400">Đang tải…</div>
      <div id="media-thumbs" class="mt-2 grid grid-cols-6 gap-2"></div>
    </div>
    <div class="rounded-lg border bg-white p-3 space-y-3">
      <h1 id="p-title" class="text-xl font-bold"></h1>
      <div class="text-sm text-gray-500"><span id="p-sold">0 đã bán</span> · <span id="p-rating">5★</span></div>
      <div class="text-2xl font-semibold text-rose-600" id="p-price"></div>
      <div id="p-stock" class="text-sm text-gray-600"></div>
      <div class="flex gap-2">
        <button id="btn-add" class="px-4 py-2 rounded-md bg-rose-600 text-white">Thêm giỏ</button>
        <a id="btn-zalo" class="px-4 py-2 rounded-md border bg-white" target="_blank" rel="noopener">Zalo</a>
      </div>
      <div>
        <h2 class="font-semibold">Mô tả</h2>
        <div id="p-desc" class="prose max-w-none text-gray-800 text-sm"></div>
      </div>
      <div>
        <h2 class="font-semibold">Câu hỏi thường gặp (FAQ)</h2>
        <div id="p-faq" class="space-y-2"></div>
      </div>
      <div>
        <h2 class="font-semibold">Đánh giá khách hàng</h2>
        <div id="p-reviews" class="space-y-2"></div>
      </div>
    </div>
  </div>
  <script id="json-ld-product" type="application/ld+json"></script>`;
  main.appendChild(host);
  return host;
}

function renderMedia(list){
  const main=$('#media-main'), thumbs=$('#media-thumbs'); if(!main||!thumbs) return;
  main.innerHTML=''; thumbs.innerHTML='';
  if(!list.length){ main.textContent='Không có ảnh'; return; }
  const show = i => {
    main.innerHTML = `<img src="${list[i]}" alt="Ảnh sản phẩm" class="w-full h-full object-cover" loading="lazy">`;
    $$('.is-active', thumbs).forEach(x=>x.classList.remove('is-active'));
    const t = thumbs.children[i]; if(t) t.classList.add('is-active');
  };
  list.forEach((src,i)=>{
    const b=document.createElement('button'); b.type='button'; b.className='relative aspect-square border rounded overflow-hidden';
    b.innerHTML = `<img src="${src}" alt="" class="absolute inset-0 w-full h-full object-cover" loading="lazy">`;
    b.onclick=()=>show(i); thumbs.appendChild(b);
  });
  show(0);
}
function renderTitle(p){ $('#p-title').textContent = p?.title || p?.name || ''; $('#p-sold').textContent = `${Number(p?.sold||0)} đã bán`; $('#p-rating').textContent=(p?.rating||5)+'★'; }
function renderPriceStock(p){ const {base,compareAt}=price(p); $('#p-price').innerHTML = compareAt? `<span class="text-rose-600">${money(base)}</span> <s class="text-gray-400 text-base">${money(compareAt)}</s>` : money(base); $('#p-stock').textContent = (p?.stock>0)? `Còn ${p.stock} hàng` : 'Hết hàng'; }
function renderDesc(p){ const el=$('#p-desc'); el.innerHTML = (p?.description_html)|| (p?.description||'').replace(/\n/g,'<br>'); }
function renderFAQ(list){ const root=$('#p-faq'); root.innerHTML=''; (list||[]).forEach(x=>{ const d=document.createElement('details'); d.innerHTML=`<summary class="cursor-pointer font-medium">${x.q||x.question||''}</summary><div class="text-sm text-gray-700 pl-2">${x.a||x.answer||''}</div>`; root.appendChild(d); }); }
function renderReviews(list){ const root=$('#p-reviews'); root.innerHTML=''; (list||[]).forEach(r=>{ const div=document.createElement('div'); div.className='border rounded p-2 bg-white'; div.innerHTML=`<div class="font-medium">${r.author||'Khách'}</div><div class="text-sm">${r.text||''}</div>`; root.appendChild(div); }); }
function injectJSONLD(p){ try{ const data={"@context":"https://schema.org","@type":"Product",name:p?.title||p?.name||'',image:imgs(p),description:p?.description||'',sku:p?.sku||'',offers:{"@type":"Offer",priceCurrency:"VND",price:price(p).base,availability:"https://schema.org/InStock"}}; const tag=document.getElementById('json-ld-product'); if(tag) tag.textContent=JSON.stringify(data);}catch(_){ } }

function cartItems(){ try{ return JSON.parse(localStorage.getItem('CART')||'[]'); }catch(_){ return []; } }
function setCart(arr){ localStorage.setItem('CART', JSON.stringify(arr||[])); }
function addToCart(p){ const its=cartItems(); const first=imgs(p)[0]||''; its.push({id:String(p?.id||p?._id||p?.slug||Date.now()), title:p?.title||p?.name||'', price:price(p).base, image:first, qty:1}); setCart(its); alert('Đã thêm vào giỏ!'); }

async function api(path){ const url = path; const r = await fetch(url,{credentials:'omit'}); if(!r.ok) throw new Error('API '+r.status); const ct=r.headers.get('content-type')||''; return ct.includes('json') ? r.json() : r.text(); }
async function fetchProductById(id){
  const urls = [
    `/public/product?id=${encodeURIComponent(id)}`,
    `/product?id=${encodeURIComponent(id)}`,
    `/public/products/${encodeURIComponent(id)}`,
    `/products/${encodeURIComponent(id)}`
  ];
  for(const u of urls){
    try{
      const r = await api(u);
      if(r){
        const o = r.item || r.product || r.data?.product || r.data || r;
        if(o && (o.id || o.title || o.name)) return o;
      }
    }catch(_){}
  }
  // Last chance: fetch list then find
  try{
    const list = await api('/public/products');
    const items = list?.items || list?.products || list || [];
    const found = (items||[]).find(x=>String(x.id||x._id||'')===String(id));
    if(found) return found;
  }catch(_){}
  return null;
}

(async function init(){
  try{
    ensureMount();
    const id = qp('id','').trim();
    if(!id){ console.warn('PDP: missing id'); return; }
    const p = await fetchProductById(id);
    if(!p){ console.warn('PDP: product not found'); return; }
    renderTitle(p); renderPriceStock(p); renderMedia(imgs(p)); renderDesc(p); renderFAQ(p?.faq||p?.faqs||[]); renderReviews(p?.reviews||[]); injectJSONLD(p);
    const btn=$('#btn-add'); if(btn) btn.onclick=()=>addToCart(p);
    const zalo=$('#btn-zalo'); if(zalo){ const phone=(p?.zalo||'').replace(/\D/g,''); if(phone) zalo.href=`https://zalo.me/${phone}`; }
  }catch(e){ console.warn('PDP init error', e); }
})();
