
function pickMedia(p){
  let imgs = [];
  if (Array.isArray(p.images) && p.images.length) imgs = p.images;
  else if (Array.isArray(p.gallery)) imgs = p.gallery.map(x=>x.url||x.src||x).filter(Boolean);
  else if (Array.isArray(p.variants)) imgs = p.variants.map(v=>v.image).filter(Boolean);
  else if (p.image) imgs = [p.image];

  let vids = [];
  if (Array.isArray(p.videos) && p.videos.length) vids = p.videos;
  else if (Array.isArray(p.video_urls)) vids = p.video_urls;
  return { imgs, vids };
}

import { api } from './lib/api.js';
import { formatPrice, pickPrice } from './lib/price.js';

const qs = new URLSearchParams(location.search);
const id = qs.get('id');

const titleEl = document.getElementById('title');
const priceEl = document.getElementById('price');
const variantsEl = document.getElementById('variants');
const galleryEl = document.getElementById('gallery');
const descEl = document.getElementById('description');

let product = null;
let currentVariant = null;
let slides = [];
let slideIdx = 0;
let slideTimer = null;

function cloudify(u, transform='w_800,q_auto,f_auto'){
  if (!u) return '';
  try {
    const url = new URL(u);
    if (url.hostname.includes('res.cloudinary.com') && url.pathname.includes('/upload/')) {
      url.pathname = url.pathname.replace('/upload/', `/upload/${transform}/`);
      return url.toString();
    }
    return u;
  } catch { return u; }
}

function renderPrice(){
  if (!product) return;
  const { base, original } = pickPrice(product, currentVariant);
  if (original > base) {
    priceEl.innerHTML = `<span class="text-rose-600 font-semibold text-xl mr-2">${formatPrice(base)}</span><span class="line-through text-gray-400">${formatPrice(original)}</span>`;
  } else {
    priceEl.innerHTML = `<span class="text-rose-600 font-semibold text-xl">${formatPrice(base)}</span>`;
  }
}

function renderVariants(){
  const vars = product.variants || [];
  if (!vars.length) { variantsEl.innerHTML = ''; return; }
  variantsEl.innerHTML = `<div class="text-sm mb-1">Phân loại:</div><div class="flex flex-wrap gap-2" id="variant-chips"></div>`;
  const chips = variantsEl.querySelector('#variant-chips');
  vars.forEach((v, i)=>{
    const b = document.createElement('button');
    b.className = 'border rounded px-3 py-1 text-sm hover:bg-gray-50';
    b.textContent = v.name || (`Loại ${i+1}`);
    b.onclick = ()=>selectVariant(i);
    chips.appendChild(b);
  });
  selectVariant(0);
}

function buildSlides(){
  slides = [];
  const m = pickMedia(product);
  const imgs = (m.imgs||[]).map(u=>({type:'img', src: cloudify(u)}));
  const vids = (m.vids||[]).map(u=>({type:'video', src: u}));
  slides = vids.concat(imgs); // video trước giống Shopee
  if (!slides.length) slides = [{type:'img', src: 'https://dummyimage.com/800x800/eee/aaa&text=No+image'}];
}


function applySlide(idx){
  if (!slides.length) return;
  slideIdx = (idx + slides.length) % slides.length;
  const s = slides[slideIdx];
  if (s.type === 'video') {
    galleryEl.innerHTML = `<video class="pdp-video" autoplay muted playsinline src="${s.src}"></video>`;
  } else {
    galleryEl.innerHTML = `<img class="w-full rounded border object-contain slide-img" src="${s.src}" alt="${product.name||''}">`;
  }
}

function startAuto(){
  if (slideTimer) clearInterval(slideTimer);
  slideTimer = setInterval(()=>applySlide(slideIdx+1), 3000);
}

function selectVariant(i){
  currentVariant = (product.variants||[])[i] || null;
  variantsEl.querySelectorAll('button').forEach((b, idx)=>{
    b.classList.toggle('bg-black/80', idx===i);
    b.classList.toggle('text-white', idx===i);
  });
  renderPrice();
  if (currentVariant && currentVariant.image) {
    const vimg = cloudify(currentVariant.image);
    const vi = slides.findIndex(s => s.type==='img' && s.src===vimg);
    if (vi >= 0) applySlide(vi);
    else { slides.unshift({type:'img', src: vimg}); applySlide(0); }
  }
}

function renderDescription(){
  const text = String(product.description||'').trim();
  if (!text){ descEl.innerHTML = '<div class="text-gray-500">Chưa có mô tả</div>'; return; }
  const html = text.split('\n\n').map(p=>`<p>${p.replace(/\n/g,'<br>')}</p>`).join('');
  descEl.innerHTML = html;
}


function renderFAQ(){
  const wrap = document.getElementById('faq');
  if (!wrap) return;
  const arr = Array.isArray(product.faq)? product.faq : [];
  wrap.innerHTML = !arr.length ? '<div class="text-gray-500">Chưa có câu hỏi</div>' :
    arr.map(q => `<details class="border rounded p-3"><summary class="font-medium">${q.question||q.q||''}</summary><div class="mt-2 text-sm">${q.answer||q.a||''}</div></details>`).join('');
}

function renderReviews(){
  const wrap = document.getElementById('reviews');
  if (!wrap) return;
  const arr = Array.isArray(product.reviews)? product.reviews : [];
  wrap.innerHTML = !arr.length ? '<div class="text-gray-500">Chưa có đánh giá</div>' :
    arr.map(r => `<div class="border rounded p-3"><div class="font-medium">${r.name||'Khách hàng'}</div><div class="text-yellow-500 text-sm">${'★'.repeat(Number(r.rating||5))}</div><div class="text-sm mt-1">${r.comment||''}</div></div>`).join('');
}
async function load(){
  let data; try{ data = await api(`/products/${encodeURIComponent(id)}`).catch(()=>null);
  if(!data || data.error){
    const list = await api(`/products?id=${encodeURIComponent(id)}`);
    data = (list.items && list.items[0]) ? list.items[0] : list;
  };}catch(e){ console.error('Fetch product failed', e); return;}
  product = data.item || data; window.__pdp = product;
  if (typeof product.images === 'string') product.images = product.images.split(',').map(s=>s.trim()).filter(Boolean);
  if (typeof product.videos === 'string') product.videos = product.videos.split(',').map(s=>s.trim()).filter(Boolean);

  if (titleEl) titleEl.textContent = product.name || product.title || 'Sản phẩm';
  (() => { const el = document.getElementById('seo-title'); if (el) el.textContent = (product.name||'') + ' - Shop Huy Vân'; })();
(() => { const el = document.getElementById('seo-desc'); if (el) el.setAttribute('content', (product.description||'').slice(0,160)); })();

  renderPrice();
  renderVariants();
  buildSlides();
  applySlide(0);
  // startAuto deferred to video-ended if first slide is video
  renderDescription();
  renderFAQ();
  renderReviews();
}

load();


        // pdp video-first autoplay
        (function(){
          const v = document.querySelector('.pdp-media video');
          const slides = Array.from(document.querySelectorAll('.pdp-gallery .slide'));
          let idx = 0, timer = null;
          function show(i){
            slides.forEach((s, k)=> s.classList.toggle('active', k===i));
            idx = i;
          }
          function startCarousel(){
            clearInterval(timer);
            if (slides.length <= 1) return;
            timer = setInterval(()=>{
              show((idx+1)%slides.length);
            }, 3500);
          }
          if (v){
            // Place video as first, then slides run after ended
            v.addEventListener('ended', ()=>{
              show(0);
              startCarousel();
            }, {once:true});
          } else {
            startCarousel();
          }
          // Init: prefer video visible
          if (slides.length) show(0);
        })();
        

        // pdp description collapse
        (function(){
          const box = document.querySelector('.product-description');
          if (!box) return;
          const btn = document.createElement('button');
          btn.className = 'btn btn-sm desc-toggle';
          btn.textContent = 'Xem thêm';
          let collapsed = true;
          function apply(){
            if (collapsed){
              box.classList.add('desc-collapsed');
              btn.textContent = 'Xem thêm';
            } else {
              box.classList.remove('desc-collapsed');
              btn.textContent = 'Thu gọn';
            }
          }
          apply();
          btn.addEventListener('click', ()=>{ collapsed = !collapsed; apply(); });
          box.parentNode && box.parentNode.appendChild(btn);
        })();
        

// pdp description toggle
(function(){
  const box = document.querySelector('.product-description');
  if(!box) return;
  const btn = document.createElement('button');
  btn.className = 'btn btn-sm mt-2';
  let collapsed = true;
  function apply(){ box.classList.toggle('desc-collapsed', collapsed); btn.textContent = collapsed ? 'Xem thêm' : 'Thu gọn'; }
  apply();
  btn.addEventListener('click', ()=>{ collapsed=!collapsed; apply(); });
  box.parentNode && box.parentNode.appendChild(btn);
})();

// pdp video-first autoplay strict
(function(){
  const galleryEl = document.getElementById('gallery');
  const origApply = applySlide;
  applySlide = function(idx){
    origApply(idx);
    const vid = galleryEl && galleryEl.querySelector('video, .pdp-video');
    if (vid){
      try{ vid.removeAttribute('loop'); }catch(_){}
      const startCarousel = ()=>{
        if (typeof startAuto==='function'){ startAuto(); }
      };
      vid.addEventListener('ended', startCarousel, {once:true});
    }
  };
})();

// defer carousel until video end
(function(){
  try{
    // If first slide is video, wait for ended
    const firstIsVideo = (slides && slides[0] && slides[0].type === 'video');
    if (firstIsVideo){
      const g = document.getElementById('gallery');
      const v = g && g.querySelector('video');
      if (v){
        v.addEventListener('ended', ()=> startAuto(), {once:true});
      }
    }else{
      // no video -> start immediately
      if (typeof startAuto==='function') startAuto();
    }
  }catch(e){}
})();

// mobile-friendly description collapse for #description
(function(){
  const box = document.getElementById('description');
  if(!box) return;
  if (!box.classList.contains('desc-collapsed')) box.classList.add('desc-collapsed');
  const btn = document.createElement('button');
  btn.className = 'border rounded px-3 py-1 text-sm mt-2';
  let opened = false;
  function apply(){ box.classList.toggle('desc-collapsed', !opened); btn.textContent = opened ? 'Thu gọn' : 'Xem thêm'; }
  apply();
  btn.addEventListener('click', ()=>{ opened=!opened; apply(); });
  box.parentNode && box.parentNode.appendChild(btn);
})();

// ---- Video-first then carousel ----
function startCarouselAfterVideo(){
  const v = document.querySelector('video, .pdp-video');
  const carousel = document.querySelector('[data-carousel]');
  if (!carousel){ return; }
  const startCarousel = ()=>{
    if (window.__pdpCarouselTimer) clearInterval(window.__pdpCarouselTimer);
    const imgs = carousel.querySelectorAll('img');
    if (imgs.length<2) return;
    let i = 0;
    window.__pdpCarouselTimer = setInterval(()=>{
      i = (i+1)%imgs.length;
      imgs.forEach((im,idx)=>{
        im.style.display = (idx===i)?'block':'none';
      });
    }, 3200);
  };
  if (v){
    v.addEventListener('ended', startCarousel, {once:true});
    // If video fails to load, fallback to carousel
    v.addEventListener('error', startCarousel, {once:true});
    // Do not auto start carousel until video ends
  } else {
    startCarousel();
  }
}
document.addEventListener('DOMContentLoaded', startCarouselAfterVideo);

// ---- Description collapse on mobile ----
document.addEventListener('DOMContentLoaded', ()=>{
  const desc = document.querySelector('.desc, #description, .product-description');
  const btn = document.getElementById('descToggle');
  if (!desc || !btn) return;
  const isMobile = window.matchMedia('(max-width:768px)').matches;
  if (isMobile) desc.classList.add('collapsed');
  btn.addEventListener('click', ()=>{
    desc.classList.toggle('collapsed');
    btn.textContent = desc.classList.contains('collapsed') ? 'Xem thêm' : 'Thu gọn';
  });
});
