import api from './lib/api.js';
import { formatPrice, pickLowestPrice } from './lib/price.js';

const noImage = encodeURI(`
  data:image/svg+xml;utf8,
  <svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 600 380'>
    <rect width='100%' height='100%' fill='#f3f4f6'/>
    <g stroke='#9ca3af' stroke-width='10' fill='none'>
      <circle cx='130' cy='120' r='40'/>
      <path d='M80 310 L230 190 L350 270 L410 230 L520 310'/>
      <rect x='5' y='5' width='590' height='370' rx='18'/>
    </g>
    <text x='300' y='350' text-anchor='middle' fill='#6b7280' font-size='28' font-family='ui-sans-serif,system-ui'>No image</text>
  </svg>
`);

function cloudify(u, t='w_500,q_auto,f_auto') {
  try {
    if (!u) return noImage;
    const url = new URL(u);
    if (!url.hostname.includes('res.cloudinary.com')) return u;
    url.pathname = url.pathname.replace('/upload/', `/upload/${t}/`);
    return url.toString();
  } catch { return u || noImage; }
}

const grid = document.querySelector('#grid');

const bannerStage = document.querySelector('#banner-stage');
const bannerDots = document.querySelector('#banner-dots');
let banners = [], bIdx = 0, bTimer = null;

function renderBanner(i){
  if(!banners.length){ bannerStage.innerHTML = `<div class="w-full h-full grid place-items-center muted">Chưa có banner</div>`; return; }
  bIdx = (i + banners.length) % banners.length;
  const b = banners[bIdx];
  bannerStage.innerHTML = `
    <a href="${b.href||'#'}" target="${b.href ? '_blank' : '_self'}">
      <img class="w-full h-full object-cover" src="${cloudify(b.image,'w_1400,q_auto,f_auto')}" alt="">
    </a>`;
  bannerDots.innerHTML = banners.map((_,k)=>`
    <button data-k="${k}" class="w-2 h-2 rounded-full ${k===bIdx?'bg-rose-600':'bg-gray-300'}"></button>
  `).join('');
  [...bannerDots.children].forEach(el=>el.onclick=()=>{renderBanner(+el.dataset.k); startBanner();});
}
function startBanner(){ stopBanner(); if(banners.length>1) bTimer=setInterval(()=>renderBanner(bIdx+1),4000); }
function stopBanner(){ if(bTimer) clearInterval(bTimer), bTimer=null; }

function card(p){
  const thumb = cloudify(p?.images?.[0]);
  const { base, original } = pickLowestPrice(p);
  const priceHtml = original>base && original>0
    ? `<div><span class="text-rose-600 font-semibold mr-2">${formatPrice(base)}</span><span class="line-through text-gray-400 text-sm">${formatPrice(original)}</span></div>`
    : `<div class="text-rose-600 font-semibold">${formatPrice(base)}</div>`;

  return `
  <a class="block rounded-lg border hover:shadow transition bg-white" href="/product?id=${encodeURIComponent(p.id)}">
    <div class="aspect-[1/1] w-full bg-gray-50 overflow-hidden">
      <img class="w-full h-full object-cover" src="${thumb}" alt="">
    </div>
    <div class="p-3">
      <div class="text-sm h-10 line-clamp-2">${p.name || 'Sản phẩm'}</div>
      ${priceHtml}
    </div>
  </a>`;
}

(async function init(){
  try{
    const s = await api('/banners');
    banners = Array.isArray(s?.items) ? s.items : (Array.isArray(s?.value) ? s.value : []);
  }catch{ banners = []; }
  renderBanner(0); startBanner();
  bannerStage.addEventListener('mouseenter', stopBanner);
  bannerStage.addEventListener('mouseleave', startBanner);

  const data = await api('/products?limit=20');
  const items = Array.isArray(data?.items)?data.items:[];
  grid.innerHTML = items.map(card).join('');
})();


async function loadProductsHome(){
  try{
    const r = await api('/products');
    const arr = r?.items || [];
    const grid = document.querySelector('[data-home-products]');
    if(!grid) return;
    grid.innerHTML = (arr||[]).map(p=>`
      <a class="card" href="/product.html?id=${p.id}">
        ${p.images && p.images[0] ? `<img src="${p.images[0]}" alt="${p.name||''}"/>` : ''}
        <div class="title">${p.name||''}</div>
        <div class="price">${(p.price_sale||p.price||0)}</div>
      </a>
    `).join('');
  }catch(e){}
}
loadProductsHome();
