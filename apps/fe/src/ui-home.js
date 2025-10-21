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

function cloudify(u, t='w_800,dpr_auto,q_auto,f_auto') {
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
      <img loading="lazy" class="w-full h-full object-cover" src="${cloudify(b.image,'w_1400,dpr_auto,q_auto,f_auto')}" alt="">
    </a>`;
  bannerDots.innerHTML = banners.map((_,k)=>`
    <button data-k="${k}" class="w-2 h-2 rounded-full ${k===bIdx?'bg-rose-600':'bg-gray-300'}"></button>
  `).join('');
  [...bannerDots.children].forEach(el=>el.onclick=()=>{renderBanner(+el.dataset.k); startBanner();});
}
function startBanner(){ stopBanner(); if(banners.length>1) bTimer=setInterval(()=>renderBanner(bIdx+1),4000); }
function stopBanner(){ if(bTimer) clearInterval(bTimer), bTimer=null; }

// ✅ FIXED CARD FUNCTION WITH FULL PRICE LOGIC

function card(p){
  const thumb = cloudify(p?.images?.[0]);
  
  // Sử dụng hàm pickLowestPrice từ price.js
  const priceInfo = pickLowestPrice(p);
  
  // Format giá hiển thị
  let priceHtml = '';
  
  if (priceInfo.base > 0) {
    if (priceInfo.original && priceInfo.original > priceInfo.base) {
      priceHtml = `<div><span class="text-rose-600 font-semibold mr-2">${formatPrice(priceInfo.base)}</span><span class="line-through text-gray-400 text-sm">${formatPrice(priceInfo.original)}</span></div>`;
    } else {
      priceHtml = `<div class="text-rose-600 font-semibold">${formatPrice(priceInfo.base)}</div>`;
    }
  } else {
    priceHtml = `<div class="text-gray-400 font-semibold">Liên hệ</div>`;
  }

  return `
  <a class="block rounded-lg border hover:shadow transition bg-white" href="/product?id=${encodeURIComponent(p.id)}">
    <div class="aspect-[1/1] w-full bg-gray-50 overflow-hidden">
      <img loading="lazy" class="w-full h-full object-cover" src="${thumb}" alt="">
    </div>
    <div class="p-3">
      <div class="text-sm h-10 line-clamp-2">${p.name || 'Sản phẩm'}</div>
      ${priceHtml}
    </div>
  </a>`;
}

(async function init(){
  try{
    // Try multiple endpoints/shapes for settings → banners
    let bannersData = [];
    try {
      const s1 = await api('/public/settings');
      const cfg = s1?.settings || s1 || {};
      const val = cfg.banners || cfg?.value || [];
      if (Array.isArray(val)) bannersData = val;
    } catch {}
    if (!bannersData.length) {
      try {
        const s2 = await api('/settings?key=banners');
        const val = s2?.value || s2?.banners || [];
        if (Array.isArray(val)) bannersData = val;
      } catch {}
    }
    banners = Array.isArray(bannersData) ? bannersData : [];
  }catch{ banners = []; }
  renderBanner(0); startBanner();
  bannerStage.addEventListener('mouseenter', stopBanner);
  bannerStage.addEventListener('mouseleave', startBanner);

  // Products: prefer public endpoint, fallback to legacy
  let data=null;
  try{ data = await api('/public/products?limit=20'); }catch{}
  if(!data){ try{ data = await api('/products?limit=20'); }catch{} }
  const items = Array.isArray(data?.items)?data.items:[];
  grid.innerHTML = items.map(card).join('');
})();


// SHV-CWV: lazyload & size images in grids
(function(){
  try{
    const imgs = document.querySelectorAll('.grid img, .product-card img, .banner img');
    imgs.forEach((img, i)=>{
      if(!img.hasAttribute('loading')) img.setAttribute('loading', i===0 ? 'eager' : 'lazy');
      if(!img.hasAttribute('decoding')) img.setAttribute('decoding','async');
      if(!img.hasAttribute('width')) img.setAttribute('width','800');
      if(!img.hasAttribute('height')) img.setAttribute('height','600');
      if(i===0 && !img.hasAttribute('fetchpriority')) img.setAttribute('fetchpriority','high');
    });
  }catch(e){}
})();

// R2 storage logic added for Cloudinary images
const r2Url = (cloudinaryUrl) => {
    const cloudinaryDomain = "https://res.cloudinary.com/dtemskptf/image/upload/";
    return cloudinaryUrl.replace(cloudinaryDomain, "https://r2-cloud-storage.example.com/");
};