// shv-fe/src/ui-pdp.js
// PDP media & details renderer (robust image-picker + simple slider + video autoplay)

import { api } from './lib/api.js';
import { formatPrice, pickPrice } from './lib/price.js';

const qs = new URLSearchParams(location.search);
const id = qs.get('id');

const titleEl   = document.getElementById('title');
const priceEl   = document.getElementById('price');
const variantsEl= document.getElementById('variants');
const galleryEl = document.getElementById('gallery');
const descEl    = document.getElementById('description');

let product   = null;
let currentVariant = null;

// ---------- helpers ----------
function toArr(x){
  if (!x) return [];
  if (Array.isArray(x)) return x;
  if (typeof x === 'string') {
    return x.split(',').map(s => s.trim()).filter(Boolean);
  }
  if (typeof x === 'object') {
    const c = [x.url, x.src, x.image, x.image_url, x.img];
    return c.filter(Boolean);
  }
  return [];
}

function cloudify(u, transform='w_800,q_auto,f_auto'){
  if (!u) return u;
  try {
    const url = new URL(String(u));
    if (url.hostname !== 'res.cloudinary.com') return u;
    if (!/\/upload\//.test(url.pathname)) return u;
    url.pathname = url.pathname.replace('/upload/', `/upload/${transform}/`);
    return url.toString();
  } catch(e){ return u; }
}

function pickMedia(p){
  // gather images
  let imgs = [];
  imgs = imgs.concat(toArr(p.images));
  imgs = imgs.concat(toArr(p.gallery));
  if (Array.isArray(p.gallery_map)) {
    imgs = imgs.concat(p.gallery_map.map(v => v?.url || v?.src).filter(Boolean));
  }
  if (typeof p.alt_images === 'string') {
    imgs = imgs.concat(toArr(p.alt_images));
  }
  if (Array.isArray(p.variants)) {
    imgs = imgs.concat(p.variants.map(v => v?.image || v?.image_url || v?.img || v?.src || v?.url).filter(Boolean));
  }
  if (p.image) imgs.push(p.image);
  imgs = imgs.map(x => cloudify(x)).filter(Boolean);

  // videos
  let vids = [];
  vids = vids.concat(toArr(p.videos));
  vids = vids.concat(toArr(p.video_urls));
  vids = vids.map(String).filter(Boolean);
  return { imgs: [...new Set(imgs)], vids: [...new Set(vids)] };
}

function setHTML(el, html=''){
  if (!el) return;
  el.innerHTML = html;
}

// Simple slider: swap img src every 3s
function renderMedia(imgs, vids){
  if (!galleryEl) return;
  if ((!imgs || imgs.length===0) && (!vids || vids.length===0)){
    setHTML(galleryEl, `<img class="w-full h-auto block" src="/assets/no-image.png" alt="No image"/>`);
    return;
  }

  let html = '';
  if (vids && vids.length){
    const v = vids[0];
    html += `<video id="pdp-video" class="w-full h-auto mb-3 rounded" src="${v}" autoplay muted playsinline loop controls></video>`;
  }
  const firstImg = imgs && imgs.length ? imgs[0] : null;
  html += `<img id="pdp-img" class="w-full h-auto rounded" src="${firstImg || '/assets/no-image.png'}" alt="Ảnh sản phẩm"/>`;

  setHTML(galleryEl, html);

  if (imgs && imgs.length > 1){
    let i = 0;
    const imgEl = document.getElementById('pdp-img');
    setInterval(()=>{
      i = (i + 1) % imgs.length;
      if (imgEl) imgEl.src = imgs[i];
    }, 3000);
  }
}

function renderPrice() {
  if (!product || !priceEl) return;
  const { base, original } = pickPrice(product, currentVariant);
  const priceHTML = (original > base)
    ? `<span class="text-rose-600 font-semibold text-xl mr-2">${formatPrice(base)}</span>
       <span class="line-through text-gray-400">${formatPrice(original)}</span>`
    : `<span class="text-rose-600 font-semibold text-xl">${formatPrice(base)}</span>`;
  setHTML(priceEl, priceHTML);
}

async function main(){
  try{
    const rs = await api(`/products?id=${encodeURIComponent(id)}`);
    const p = rs?.items?.[0] || rs?.item || rs;
    product = p || null;

    // expose for debug
    window.__pdp = { product };

    if (!product) {
      console.warn('No product found for id', id);
      return;
    }

    // title
    if (titleEl) titleEl.textContent = product.name || 'Sản phẩm';

    // description
    if (descEl) descEl.setAttribute('content', (product.description || '').slice(0, 160));

    // media
    const { imgs, vids } = pickMedia(product);
    window.__pdp.imgs = imgs; window.__pdp.vids = vids;
    renderMedia(imgs, vids);

    // price
    renderPrice();

    // variants (if any) -> create simple buttons
    if (variantsEl && Array.isArray(product.variants) && product.variants.length){
      const btns = product.variants.map((v, idx) => {
        const label = (v.name || v.sku || `#${idx+1}`);
        return `<button data-vid="${idx}" class="px-3 py-1 rounded border mr-2 mb-2 hover:bg-gray-100">${label}</button>`;
      }).join('');
      setHTML(variantsEl, btns);
      variantsEl.addEventListener('click', (e)=>{
        const b = e.target.closest('button[data-vid]');
        if (!b) return;
        const idx = Number(b.getAttribute('data-vid'));
        currentVariant = product.variants[idx];
        // if variant has its own image -> push on top
        const { imgs, vids } = pickMedia({ ...product, images: [currentVariant?.image || currentVariant?.image_url || product.images?.[0]].filter(Boolean), videos: product.videos });
        renderMedia(imgs, vids);
        renderPrice();
      });
    }

  }catch(e){
    console.error(e);
  }
}

document.addEventListener('DOMContentLoaded', main);
