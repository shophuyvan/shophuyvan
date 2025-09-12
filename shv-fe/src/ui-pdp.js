// R6.3 – PDP
import { api } from './lib/api.js';
import { formatPrice, pickPrice } from './lib/price.js';
const qs = new URLSearchParams(location.search);
const id = qs.get('id');
const el = (s)=>document.querySelector(s);
const els =(s)=>Array.from(document.querySelectorAll(s));
const titleEl = el('#title'); const priceEl=el('#price'); const saleEl=el('#sale');
const galleryEl=el('#gallery'); const videoWrap=el('#videoWrap'); const variantsEl=el('#variants');
const descEl=el('#description'); const vouchersEl=el('#vouchers'); const faqEl=el('#faq'); const reviewsEl=el('#reviews');
let product=null; let currentVariant=null; let slideIdx=0; let slideTimer=null;
const placeHolder=(w=800,h=600)=>'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${h}'><rect width='100%' height='100%' fill='#eef2f7'/><g stroke='#cbd5e1' stroke-width='8' fill='none'><circle cx='160' cy='160' r='48'/><path d='M120 420 L320 260 L520 420'/></g><text x='50%' y='560' text-anchor='middle' fill='#64748b' font-size='40'>No image</text></svg>`);
function cloudify(url,transform='w_800,q_auto,f_auto'){try{if(!url||!url.includes('/upload/'))return url;const u=new URL(url);u.pathname=u.pathname.replace('/upload/',`/upload/${transform}/`);return u.toString()}catch(_){return url}}
function pickMedia(p){const imgs=Array.isArray(p.images)?p.images:Array.isArray(p.gallery)?p.gallery.map(x=>x.url||x.src||x).filter(Boolean):Array.isArray(p.variants)?p.variants.map(v=>v.image).filter(Boolean):Array.isArray(p.image)?p.image:(p.image?[p.image]:[]);const vids=Array.isArray(p.videos)?p.videos:Array.isArray(p.video_urls)?p.video_urls:[];return{imgs,vids}}
function renderGallery(imgs){galleryEl.innerHTML='';(imgs.length?imgs:[placeHolder()]).forEach((src,i)=>{const li=document.createElement('li');li.className='slide';li.innerHTML=`<img loading="lazy" src="${cloudify(src)}" alt="slide ${i+1}">`;galleryEl.appendChild(li)});slideIdx=0;updateActiveSlide();clearInterval(slideTimer);slideTimer=setInterval(()=>{slideIdx=(slideIdx+1)%galleryEl.children.length;updateActiveSlide()},3000)}
function renderVideo(vids){videoWrap.innerHTML='';if(!vids?.length)return;const v=document.createElement('video');v.src=vids[0];v.muted=true;v.loop=true;v.autoplay=true;v.controls=true;videoWrap.appendChild(v)}
function updateActiveSlide(){els('.slide').forEach((li,i)=>{li.classList.toggle('active',i===slideIdx)})}
function renderPrice(){const {base,original}=pickPrice(product,currentVariant);priceEl.textContent=formatPrice(base);saleEl.textContent=original>base?formatPrice(original):''}
function renderVariants(){variantsEl.innerHTML='';if(!Array.isArray(product.variants)||!product.variants.length)return;product.variants.forEach((v,idx)=>{const b=document.createElement('button');b.type='button';b.className='chip';b.textContent=v.name||v.sku||`#${idx+1}`;b.addEventListener('click',()=>{currentVariant=v;renderPrice();if(v.image)renderGallery([v.image,...pickMedia(product).imgs.filter(x=>x!==v.image)])});variantsEl.appendChild(b)})}
function renderDesc(){descEl.innerHTML=(product.description||'').trim()||'Chưa có mô tả'}
function renderExtras(){vouchersEl.textContent='Freeship 150K';faqEl.textContent=product.faq?.length?'':'Chưa có câu hỏi';reviewsEl.textContent=product.reviews?.length?'':'Chưa có đánh giá'}
async function boot(){if(!id){console.warn('Missing product id');return}const res=await api(`/products?id=${encodeURIComponent(id)}`);const p=res?.items?.[0];if(!p){console.warn('Not found');return}product=p;document.title=`${p.name} – Shop Huy Vân`;titleEl.textContent=p.name||'Sản phẩm';const {imgs,vids}=pickMedia(p);renderGallery(imgs);renderVideo(vids);renderVariants();renderPrice();renderDesc();renderExtras();document.querySelector('#btnAdd')?.addEventListener('click',()=>alert('Đã thêm vào giỏ'));document.querySelector('#btnBuy')?.addEventListener('click',()=>alert('Mua ngay'));document.querySelector('#btnZalo')?.setAttribute('href','https://zalo.me/0933190000')}boot().catch(console.error);
