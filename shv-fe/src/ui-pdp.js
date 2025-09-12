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
  const imgs = (product.images || []).map(u=>({type:'img', src: cloudify(u)}));
  const vids = (product.videos || []).map(u=>({type:'video', src: u}));
  slides = vids.concat(imgs); // video trước giống Shopee
  if (!slides.length) slides = [{type:'img', src: 'https://dummyimage.com/800x800/eee/aaa&text=No+image'}];
}

function applySlide(idx){
  if (!slides.length) return;
  slideIdx = (idx + slides.length) % slides.length;
  const s = slides[slideIdx];
  if (s.type === 'video') {
    galleryEl.innerHTML = `<video class="w-full rounded border" autoplay muted playsinline loop src="${s.src}"></video>`;
  } else {
    galleryEl.innerHTML = `<img class="w-full rounded border object-contain" src="${s.src}" alt="${product.name||''}">`;
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
  const data = await api(`/products?id=${encodeURIComponent(id)}`);
  product = data.item || data;
  if (typeof product.images === 'string') product.images = product.images.split(',').map(s=>s.trim()).filter(Boolean);
  if (typeof product.videos === 'string') product.videos = product.videos.split(',').map(s=>s.trim()).filter(Boolean);

  titleEl.textContent = product.name || 'Sản phẩm';
  (() => { const el = document.getElementById('seo-title'); if (el) el.textContent = (product.name||'') + ' - Shop Huy Vân'; })();
(() => { const el = document.getElementById('seo-desc'); if (el) el.setAttribute('content', (product.description||'').slice(0,160)); })();

  renderPrice();
  renderVariants();
  buildSlides();
  applySlide(0);
  startAuto();
  renderDescription();
  renderFAQ();
  renderReviews();
}

load();
