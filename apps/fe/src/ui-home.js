import api from './lib/api.js';
import { formatPrice, pickLowestPrice, pickPriceByCustomer } from './lib/price.js';

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

// [FIXED] Khai báo biến trước, gán giá trị sau khi DOM load để tránh lỗi null
let grid, bannerStage, bannerDots;
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

function card(p){
  const thumb = cloudify(p?.images?.[0]);
  
  // ✅ DÙNG pickPriceByCustomer ĐỂ ĐỒNG BỘ GIÁ SỈ/LẺ
  const priceInfo = pickPriceByCustomer(p, null) || {};
  const base = priceInfo.base || 0;
  const original = priceInfo.original || null;

  let priceHtml = '';
  
  if (base > 0) {
    priceHtml = `<div><span class="text-rose-600 font-semibold">${formatPrice(base)}</span>`;
    
    // Hiển thị giá gốc nếu có
    if (original && original > base) {
      priceHtml += `<span class="line-through text-gray-400 text-sm ml-2">${formatPrice(original)}</span>`;
    }
    
    // Badge giá sỉ hoặc giảm giá
    if (priceInfo.customer_type === 'wholesale' || priceInfo.customer_type === 'si') {
      priceHtml += ` <span style="background:#4f46e5;color:white;font-size:10px;padding:2px 6px;border-radius:4px;margin-left:6px;font-weight:700;">Giá sỉ</span>`;
    } else if (priceInfo.discount > 0) {
      priceHtml += ` <span style="background:#10b981;color:white;font-size:10px;padding:2px 6px;border-radius:4px;margin-left:6px;font-weight:700;">-${priceInfo.discount}%</span>`;
    }
    
    priceHtml += `</div>`;
  } else {
    priceHtml = `<div class="text-gray-400 text-sm">Liên hệ</div>`;
  }

  // ✅ THÊM: Hiển thị text tier cho All Products
  const tierMap = {
    'retail': { name: 'Thành viên thường', icon: '👤' },
    'silver': { name: 'Thành viên bạc', icon: '🥈' },
    'gold': { name: 'Thành viên vàng', icon: '🥇' },
    'diamond': { name: 'Thành viên kim cương', icon: '💎' }
  };
  const tierInfo = tierMap[priceInfo.tier] || tierMap['retail'];
  
  let tierText = '';
  if (priceInfo.customer_type === 'retail' && priceInfo.tier !== 'retail') {
    tierText = `<div style="font-size:11px;color:#059669;margin-top:4px;font-weight:600;">${tierInfo.name}</div>`;
  }

  return `
  <a class="block rounded-lg border hover:shadow transition bg-white" href="/product?id=${encodeURIComponent(p.id)}">
    <div class="aspect-[1/1] w-full bg-gray-50 overflow-hidden">
      <img loading="lazy" class="w-full h-full object-cover" src="${thumb}" alt="">
    </div>
    <div class="p-3">
      <div class="text-sm h-10 line-clamp-2">${p.name || 'Sản phẩm'}</div>
      ${priceHtml}
      ${tierText}
    </div>
  </a>`;
}

// [FIXED] Bọc toàn bộ logic vào sự kiện DOMContentLoaded
document.addEventListener('DOMContentLoaded', async () => {
  // Lúc này HTML đã có, query sẽ thành công
  grid = document.querySelector('#grid');
  bannerStage = document.querySelector('#banner-stage');
  bannerDots = document.querySelector('#banner-dots');

  if (!grid) return; // Nếu trang không có #grid thì dừng, tránh lỗi

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
  // [FIXED] Tăng limit=200 để hiện hết sản phẩm + Thêm timestamp v=... để xóa cache trình duyệt
  let data=null;
  const t = Date.now(); // Tạo mốc thời gian thực
  try{ data = await api(`/public/products?limit=200&v=${t}`); }catch{}
  if(!data){ try{ data = await api(`/products?limit=200&v=${t}`); }catch{} }
const items = Array.isArray(data?.items)?data.items:[];
  grid.innerHTML = items.map(card).join('');
}); // Đóng sự kiện DOMContentLoaded


// SHV-CWV: lazyload & size images in grids
(function(){
  try{
    const imgs = document.querySelectorAll('.grid img, .product-card img, .banner img');
    imgs.forEach((img, i)=>{
      if(!img.hasAttribute('loading')) img.setAttribute('loading', i===0 ? 'eager' : 'lazy');
      if(!img.hasAttribute('decoding')) img.setAttribute('decoding','async');
      // default 4:3 placeholder sizes to reduce CLS
      if(!img.hasAttribute('width')) img.setAttribute('width','800');
      if(!img.hasAttribute('height')) img.setAttribute('height','600');
      // mark first visible image as high priority (likely LCP)
      if(i===0 && !img.hasAttribute('fetchpriority')) img.setAttribute('fetchpriority','high');
    });
  }catch(e){}
})();

    // R2 storage logic added for Cloudinary images
    const r2Url = (cloudinaryUrl) => {
    const cloudinaryDomain = "https://res.cloudinary.com/dtemskptf/image/upload/";
    return cloudinaryUrl.replace(cloudinaryDomain, "https://r2-cloud-storage.example.com/");
};

// =============================
// SHV – ENABLE DRAG SCROLL
// =============================
(function () {
    const wrapList = document.querySelectorAll('.product-horizontal-scroll');

    wrapList.forEach(wrap => {
        let isDown = false;
        let startX;
        let scrollLeft;

        wrap.addEventListener('mousedown', (e) => {
            isDown = true;
            wrap.classList.add('dragging');
            startX = e.pageX - wrap.offsetLeft;
            scrollLeft = wrap.scrollLeft;
        });

        wrap.addEventListener('mouseleave', () => {
            isDown = false;
            wrap.classList.remove('dragging');
        });

        wrap.addEventListener('mouseup', () => {
            isDown = false;
            wrap.classList.remove('dragging');
        });

        wrap.addEventListener('mousemove', (e) => {
            if (!isDown) return;
            e.preventDefault();
            const x = e.pageX - wrap.offsetLeft;
            const walk = (x - startX) * 1.2; 
            wrap.scrollLeft = scrollLeft - walk;
        });
    });
})();

    