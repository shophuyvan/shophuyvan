
import api from './lib/api.js';

const $ = (sel, el=document) => el.querySelector(sel);
const $$ = (sel, el=document) => Array.prototype.slice.call(el.querySelectorAll(sel));

function safeNum(v){
  if(v===null||v===undefined) return 0;
  if(typeof v==='number') return v;
  if(typeof v==='string'){
    // strip all non-digit except . and ,
    const s=v.trim();
    if(/^[0-9.,\s]+$/.test(s)){
      // remove spaces
      let t=s.replace(/\s+/g,'');
      // if both . and , exist, assume , is thousand sep -> remove commas
      if(t.includes('.') && t.includes(',')){ t=t.replace(/,/g,''); }
      // if only , present -> treat as decimal point
      else if(t.includes(',') && !t.includes('.')){ t=t.replace(/,/g,'.'); }
      v=t;
    }
  }
  const n=Number(v); return Number.isFinite(n)?n:0;
}
function fmtVND(n){
  n = Number(n || 0);
  return n.toLocaleString('vi-VN') + 'đ';
}
function get(obj, key, defVal){
  try {
    const val = obj[key];
    return (val === undefined || val === null) ? defVal : val;
  } catch(e){ return defVal; }
}

/* ---------- Normalizers ---------- */
function normalizeImages(p){
  let imgs = [];
  if (Array.isArray(p.images)) imgs = p.images.slice();
  if (!imgs.length && Array.isArray(p.gallery)) imgs = p.gallery.slice();
  if (!imgs.length && Array.isArray(p.photos)) imgs = p.photos.slice();
  imgs = imgs.map(function(it){
    if (typeof it === 'string') return it;
    if (it && typeof it === 'object') return it.url || it.src || it.image || '';
    return '';
  }).filter(Boolean);
  if (!imgs.length && typeof p.image === 'string' && p.image) imgs.push(p.image);
  return imgs;
}

function firstStr(obj, keys){
  for (var i=0;i<keys.length;i++){
    if (typeof obj[keys[i]] === 'string' && obj[keys[i]].trim()) return obj[keys[i]];
  }
  return '';
}
function firstNum(obj, keys){
  for (var i=0;i<keys.length;i++){
    var v = safeNum(obj[keys[i]]);
    if (Number.isFinite(v) && v !== 0) return v;
  }
  for (var j=0;j<keys.length;j++){
    var vv = safeNum(obj[keys[j]]);
    if (Number.isFinite(vv)) return vv;
  }
  return 0;
}
function normalizeVariants(p){
  if (Array.isArray(p.variants)) return p.variants;
  // common alternative keys
  var keys = ['skus','sku_list','children','items','options','variations','combos','list'];
  for (var i=0;i<keys.length;i++){
    var arr = p[keys[i]];
    if (Array.isArray(arr) && arr.length && typeof arr[0] === 'object'){
      return arr;
    }
  }
  // heuristic: find first array of objects that has price/stock/image-like fields
  for (var k in p){
    if (!Object.prototype.hasOwnProperty.call(p,k)) continue;
    var v = p[k];
    if (Array.isArray(v) && v.length && typeof v[0] === 'object'){
      var ok = v.some(function(it){
        return (('price' in it) || ('sale_price' in it) || ('price_sale' in it) ||
                ('stock' in it) || ('sku' in it) || ('name' in it) || ('image' in it));
      });
      if (ok) return v;
    }
  }
}


function minVariantPriceStrict(p){
  const arr = (p.variants||p.skus||p.items||[]);
  let best = null; // {sale, reg}
  for(const v of arr){
    const pp = pricePair(v);
    // Effective price: sale if >0 else regular if >0 else Infinity
    const eff = (pp.sale>0 ? pp.sale : (pp.reg>0 ? pp.reg : Infinity));
    if(!Number.isFinite(eff)) continue;
    if(!best || eff < (best.sale>0 ? best.sale : best.reg||Infinity)){
      best = { sale: (pp.sale>0 ? pp.sale : eff), reg: (pp.sale>0 && pp.reg>0 ? pp.reg : (pp.sale>0 ? pp.reg||0 : 0)) };
    }
  }
  return best || {sale: 0, reg: 0};
}
function pricePair(src){
  const sale = safeNum(get(src, 'sale_price', get(src, 'price_sale', get(src, 'salePrice', 0))));
  const reg  = safeNum(get(src, 'price', get(src, 'regular_price', get(src, 'base_price', 0))));
  if (sale > 0) return { sale: sale, reg: reg || null };
  return { sale: reg || 0, reg: null };
}


/* ---------- Render ---------- */
let PRODUCT = null;
let CURRENT = null;
let slideTimer = null;

function renderMedia(){
  const main = $('#media-main');
  const thumbs = $('#media-thumbs');
  if (!main || !thumbs) return;
  main.innerHTML = '';
  thumbs.innerHTML = '';
  const media = [];

  // video first
  var video = PRODUCT.video || PRODUCT.video_url || '';
  if (video) media.push({type:'video', src: video});

  const imgs = normalizeImages(PRODUCT);
  for (var i=0;i<imgs.length;i++){
    media.push({type:'img', src: imgs[i]});
  }

  function show(src, isVideo){
    main.innerHTML = '';
    if (isVideo){
      var v = document.createElement('video');
      v.src = src; v.controls = true; v.playsInline = true; v.autoplay = true; v.muted = true;
      v.className = 'absolute inset-0 w-full h-full object-contain bg-black/5';
      v.addEventListener('ended', startSlide);
      main.appendChild(v);
    }else{
      var img = document.createElement('img');
      img.src = src; img.loading = 'lazy';
      img.className = 'absolute inset-0 w-full h-full object-contain bg-black/5';
      main.appendChild(img);
    }
  }

  function stopSlide(){
    if (slideTimer){ clearInterval(slideTimer); slideTimer = null; }
  }
  window.__pdpStopSlide = stopSlide; // exposed for variant change

  for (var j=0;j<media.length;j++){
    (function(m){
      var b = document.createElement('button');
      b.className = 'relative aspect-square rounded overflow-hidden border';
      if (m.type === 'video'){
        b.innerHTML = '<div class="absolute inset-0 grid place-items-center bg-black/10"><svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg></div>';
      } else {
        b.innerHTML = '<img loading="lazy" src="'+m.src+'" class="w-full h-full object-cover">';
      }
      b.addEventListener('click', function(){ stopSlide(); show(m.src, m.type==='video'); });
      thumbs.appendChild(b);
    })(media[j]);
  }

  if (media.length){
    show(media[0].src, media[0].type==='video');
  } else {
    main.innerHTML = '<div class="absolute inset-0 grid place-items-center text-gray-400">No media</div>';
  }

  function startSlide(){
    var imgsOnly = normalizeImages(PRODUCT);
    if (!imgsOnly.length) return;
    stopSlide();
    var idx = 0;
    show(imgsOnly[idx], false);
    slideTimer = setInterval(function(){
      idx = (idx + 1) % imgsOnly.length;
      show(imgsOnly[idx], false);
    }, 3000);
  }
  window.__pdpStartSlide = startSlide;
}

function renderTitleAndMeta(){
  $('#p-title') && ($('#p-title').textContent = (PRODUCT.title || PRODUCT.name || PRODUCT.product_name || ''));
  var sold = Number(PRODUCT.sold || PRODUCT.sold_count || PRODUCT.soldCount || firstNum(PRODUCT,['sold_total','sales']) || 0);
  $('#p-sold') && ($('#p-sold').textContent = sold + ' đã bán');
  var rating = Number(PRODUCT.rating || PRODUCT.rating_avg || PRODUCT.stars || firstNum(PRODUCT,['rating_average','ratingAvg']) || 5);
  $('#p-rating') && ($('#p-rating').textContent = rating + '★');
}

function renderPrice(obj){
  var pair = pricePair(obj || CURRENT || PRODUCT);
  var priceEl = $('#p-price');
  var stockEl = $('#p-stock');
  if (!priceEl || !stockEl) return;
  if (pair.reg && pair.sale && pair.sale < pair.reg){
    priceEl.innerHTML = '<span class="text-rose-600 font-semibold">'+fmtVND(pair.sale)+'</span> <span class="line-through text-gray-400 text-xl">'+fmtVND(pair.reg)+'</span>';
  }else{
    priceEl.innerHTML = '<span class="text-gray-800">'+fmtVND(pair.sale || pair.reg || 0)+'</span>';
  }
  
  var src = obj||CURRENT||PRODUCT;
  var stk = firstNum(src, ['stock','qty','quantity','inventory','ton_kho','tonkho']);
  if (!stk){
    var vars = normalizeVariants(PRODUCT);
    if (vars.length){
      var sum = 0;
      for (var i=0;i<vars.length;i++){
        var sv = Number(firstNum(vars[i],['stock','qty','quantity','inventory']));
        if (!isNaN(sv)) sum += sv;
      }
      if (sum) stk = sum;
    }
  }
  stockEl.textContent = (stk>0 ? 'Còn '+stk : 'Hết hàng');

}

function renderVariants(){
  var box = $('#p-variants');
  if (!box) return;
  box.innerHTML = '';
  var vars = normalizeVariants(PRODUCT);
  if (!vars.length){ 
    // try to compute min price across possible variant-like arrays inside product
    var minSale = null, maxSale = null;
    var arrKeys = ['variants','skus','sku_list','children','items','options','variations','combos','list'];
    for (var i=0;i<arrKeys.length;i++){
      var A = PRODUCT[arrKeys[i]];
      if (Array.isArray(A)){
        for (var j=0;j<A.length;j++){
          var pp = pricePair(A[j]);
          var val = pp.sale || pp.reg || 0;
          if (minSale===null || val<minSale) minSale = val;
          if (maxSale===null || val>maxSale) maxSale = val;
        }
      }
    }
    if (minSale!==null){
      var priceEl = $('#p-price');
      if (priceEl){
        if (maxSale!==null && maxSale!==minSale){
          priceEl.innerHTML = '<span class="text-gray-800">'+fmtVND(minSale)+' - '+fmtVND(maxSale)+'</span>';
        }else{
          priceEl.innerHTML = '<span class="text-gray-800">'+fmtVND(minSale)+'</span>';
        }
      }
    } else {
      renderPrice(PRODUCT);
    }
    return; 
  }
  var title = document.createElement('div');
  title.className = 'text-sm text-gray-600 mb-1';
  title.textContent = 'Phân loại';
  box.appendChild(title);

  var wrap = document.createElement('div');
  wrap.className = 'flex flex-wrap gap-2';
  vars.forEach(function(v, idx){
    var b = document.createElement('button');
    b.className = 'px-3 py-2 rounded border hover:border-rose-500 text-sm';
    b.textContent = v.name || v.sku || ('#'+(idx+1));
    b.addEventListener('click', function(){
      CURRENT = v;
      if (v.image && typeof window.__pdpStopSlide === 'function'){ window.__pdpStopSlide(); }
      var main = $('#media-main');
      if (main && v.image){
        main.innerHTML = '<img src="'+v.image+'" class="absolute inset-0 w-full h-full object-contain bg-black/5">';
      }
      renderPrice(v);
    });
    wrap.appendChild(b);
  });
  box.appendChild(wrap);

  CURRENT = vars[0];
  renderPrice(CURRENT);
  if (CURRENT && CURRENT.image){
    var main = $('#media-main');
    if (main){
      main.innerHTML = '<img src="'+CURRENT.image+'" class="absolute inset-0 w-full h-full object-contain bg-black/5">';
    }
  }
}

function renderDesc(){
  var el = $('#p-desc');
  if (!el) return;
  var d = (PRODUCT.description || PRODUCT.desc || PRODUCT.content || PRODUCT.body || PRODUCT.details || '').trim();
  d = d.replace(/\n-\s*/g,'<br>• ').replace(/\n\/\*\s*/g,'<br>• ');
  el.innerHTML = d || '<div class="text-gray-500">Chưa có mô tả.</div>';
}
function renderFAQ(){
  var box = $('#p-faq'); if (!box) return;
  box.innerHTML = '';
  var rows = Array.isArray(PRODUCT.faq) ? PRODUCT.faq : [];
  if (!rows.length){ box.innerHTML = '<div class="text-gray-500">Chưa có FAQ.</div>'; return; }
  rows.forEach(function(it){
    var d = document.createElement('details');
    d.className = 'rounded border p-3';
    var q = it.q || it.question || 'Hỏi: ...';
    var a = it.a || it.answer || '';
    d.innerHTML = '<summary class="cursor-pointer font-medium">'+ q +'</summary>' +
                  '<div class="mt-2 text-sm text-gray-700">'+ a +'</div>';
    box.appendChild(d);
  });
}

function renderReviews(){
  var box = $('#p-reviews'); if (!box) return;
  box.innerHTML = '';
  var rows = Array.isArray(PRODUCT.reviews) ? PRODUCT.reviews : [];
  if (!rows.length){ box.innerHTML = '<div class="text-gray-500">Chưa có đánh giá.</div>'; return; }
  rows.forEach(function(r){
    var card = document.createElement('div');
    card.className = 'rounded border p-3';
    var star = '';
    var k = Number(r.rating || 5);
    for (var i=0;i<k;i++) star += '★';
    card.innerHTML = '<div class="text-sm text-gray-600">'+ star +'</div>' +
                     '<p class="mt-1 text-sm">'+ (r.content||'') +'</p>';
    box.appendChild(card);
  });
}

function attachActions(){
  var btn = $('#btn-add');
  if (!btn) return;
  btn.addEventListener('click', function(){
    var src = CURRENT || PRODUCT;
    var stk = Number(get(src, 'stock', 1));
    var qty = Number(window.prompt('Nhập số lượng muốn mua:', '1') || 1);
    if (qty < 1) qty = 1;
    if (stk > 0 && qty > stk) qty = stk;
    var payload = {
      id: PRODUCT.id || PRODUCT._id || PRODUCT.slug || '',
      title: PRODUCT.title || PRODUCT.name || '',
      image: (src && src.image) ? src.image : (normalizeImages(PRODUCT)[0] || ''),
      variant: (CURRENT && (CURRENT.name||CURRENT.sku)) || null,
      price: pricePair(src).sale || pricePair(src).reg || 0,
      qty: qty
    };
    try{
      var cart = JSON.parse(localStorage.getItem('CART') || '[]');
      cart.push(payload);
      localStorage.setItem('CART', JSON.stringify(cart));
      alert('Đã thêm vào giỏ!');
    }catch(e){
      alert('Không thể thêm giỏ.');
    }
  });
}

/* ---------- Data fetch ---------- */
function parseItemsList(data){
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (Array.isArray(data.items)) return data.items;
  if (Array.isArray(data.data)) return data.data;
  return [];
}
async function fetchProductById(id){
  // 1) prefer /products?id=...
  try{
    const r = await api.get('/products?id=' + encodeURIComponent(id));
    let d = r && (r.data || r);
    if (d && (d.item || (d.data && d.data.item))) return (d.item || d.data.item);
    let list = parseItemsList(d);
    if (list.length){
      const found = list.find(x => String(x.id||x._id||x.slug||'') === String(id)) || list[0];
      if (found) return found;
    }
    if (d && typeof d==='object' && (d.id||d._id||d.slug)) return d;
  }catch(e){}
  // 2) fallback list
  try{
    const r2 = await api.get('/products');
    let arr = parseItemsList(r2 && (r2.data || r2));
    if (arr.length){
      const found = arr.find(x => String(x.id||x._id||x.slug||'') === String(id)) || arr[0];
      if (found) return found;
    }
  }catch(e){}
  // 3) last try /public/products
  try{
    const r3 = await api.get('/public/products');
    let arr3 = parseItemsList(r3 && (r3.data || r3));
    if (arr3.length){
      const found3 = arr3.find(x => String(x.id||x._id||x.slug||'') === String(id)) || arr3[0];
      if (found3) return found3;
    }
  }catch(e){}
  return null;
}

/* ---------- Init ---------- */
document.addEventListener('DOMContentLoaded', async function(){
  var raw = $('#id-product');
  if (raw && raw.textContent){
    try{ PRODUCT = JSON.parse(raw.textContent.trim()); }catch(e){ PRODUCT = null; }
  }
  if (!PRODUCT){
    var id = new URL(location.href).searchParams.get('id');
    if (id){
      PRODUCT = await fetchProductById(id);
    }
  }
  if (!PRODUCT){
    PRODUCT = {
      id: 'demo-1',
      title: 'Tên sản phẩm',
      images: ['/logo.png'],
      sold: 0, rating: 5, stock: 10,
      price: 120000, sale_price: 99000,
      variants: [{name:'Combo 1', price:65000, sale_price:60000, stock:5, image:'/logo.png'}],
      description: 'Mô tả sản phẩm…'
    };
    console.warn('[PDP] Dùng fallback vì chưa lấy được dữ liệu hợp lệ.');
  }
  renderTitleAndMeta();
  renderMedia();
  // === Fit media to image ratio & remove side gaps ===
(()=>{ const mediaBox = $('#media-main'); if (mediaBox){
    const adapt = (el)=>{
      if(!el) return;
      if(el.tagName==='IMG'){
        const apply = ()=>{
          if(el.naturalWidth && el.naturalHeight){
            mediaBox.style.aspectRatio = el.naturalWidth + '/' + el.naturalHeight;
          }
          mediaBox.style.background='transparent';
          el.style.width='100%'; el.style.height='100%'; el.style.objectFit='contain';
        };
        if(el.complete) apply(); else el.addEventListener('load', apply, {once:true});
      }
      if(el.tagName==='VIDEO'){
        el.style.width='100%'; el.style.height='100%'; el.style.objectFit='contain';
        el.muted=true; el.playsInline=true;
      }
    };
    adapt(mediaBox.querySelector('img,video'));
  }
// removed stray IIFE close

  // Adapt media container to image ratio & autoplay video
(()=>{ const mediaBox = $('#media-main'); const mainImg = mediaBox.querySelector('img, video');
  if (mainImg && mainImg.tagName === 'IMG'){
    if (mainImg.naturalWidth && mainImg.naturalHeight){
      mediaBox.style.aspectRatio = mainImg.naturalWidth + '/' + mainImg.naturalHeight;
    }
    mainImg.style.width = '100%';
    mainImg.style.height = '100%';
    mainImg.style.objectFit = 'contain';
    mainImg.style.backgroundColor = '#fff';
  }
  // click on video thumb -> autoplay
// removed stray IIFE close
  $$('button[data-media-kind="video"]').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      setTimeout(()=>{
        const v = $('#media-main video');
        if(v){ v.muted = true; v.playsInline = true; v.autoplay = true; v.play().catch(()=>{});
          v.onended = ()=>{
            // auto slide through images
            const thumbs = $$('#media-thumbs button');
            let i = 0;
            const timer = setInterval(()=>{
              // skip video thumb (has data-media-kind=video)
              while(i<thumbs.length && thumbs[i].dataset.mediaKind==='video') i++;
              if(i>=thumbs.length){ clearInterval(timer); return; }
              thumbs[i++].click();
            }, 2500);
          };
        }
      }, 60);

  renderVariants();
  renderPrice(PRODUCT);
  renderDesc();
  renderFAQ();
  renderReviews();
  attachActions();
  // === Autoplay video & auto-slide after ended ===
// removed stray IIFE close
  $$('button[data-media-kind="video"]').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      setTimeout(()=>{
        const v=$('#media-main video');
        if(v){ v.muted=true; v.playsInline=true; v.autoplay=true; v.play().catch(()=>{});
          v.onended=()=>{
            const thumbs=$$('#media-thumbs button');
            let i=0; const tick=()=>{
              while(i<thumbs.length && thumbs[i].dataset.mediaKind==='video') i++;
              if(i>=thumbs.length) return;
              thumbs[i++].click(); setTimeout(tick, 2500);
            }; tick();
          };
        }
      }, 80);

  // Inject 'Mua ngay' button next to 'Thêm giỏ'
  const btnAdd = $('#btn-add');
  if(btnAdd && !$('#btn-buy-now')){
    const buy = document.createElement('button');
    buy.id='btn-buy-now';
    buy.className = btnAdd.className.replace('bg-rose-600','bg-emerald-600').replace('rose-600','emerald-600');
    buy.style.marginLeft = '0.5rem';
    buy.textContent = 'Mua ngay';
    btnAdd.parentNode.insertBefore(buy, btnAdd.nextSibling);
    buy.addEventListener('click', async()=>{
      const ok = await addToCart(1); // add 1 then go to cart
      if(ok!==false){ location.href = '/cart'; }
    });
  }


function minVariantPrice(p){
  const arr = (p.variants||p.skus||p.items||[]);
  if(!arr.length) return null;
  let best = {sale: Infinity, reg: Infinity};
  for(const v of arr){
    const {sale, reg} = pricePair(v);
    const s = (sale>0 ? sale : Infinity);
    const r = (reg>0 ? reg : sale);
    const cand = (s!==Infinity ? s : r);
    if(cand < (best.sale!==Infinity? best.sale : best.reg)){
      best = {sale: s!==Infinity ? s : 0, reg: r||0};
    }
  }
  if(best.sale!==Infinity) return {sale: best.sale, reg: best.reg};
  return {sale: 0, reg: 0};
}

function formatDescSEO(raw){
  if(!raw) return '';
  try{
    let t = String(raw).trim();
    // normalize line breaks
    t = t.replace(/\r\n?|\n/g, '\n');
    const lines = t.split('\n').map(s=>s.trim()).filter(Boolean);
    const blocks=[];
    let list=[];
    for(const line of lines){
      if(/^[-•\*]/.test(line)){
        list.push(line.replace(/^[-•\*]\s?/, ''));
      }else if(/^#{1,6}\s/.test(line)){
        if(list.length){ blocks.push('<ul>'+list.map(li=>'<li>'+escapeHTML(li)+'</li>').join('')+'</ul>'); list=[]; }
        const lvl=line.match(/^#{1,6}/)[0].length;
        blocks.push(`<h${lvl}>${escapeHTML(line.replace(/^#{1,6}\s/,''))}</h${lvl}>`);
      }else{
        if(list.length){ blocks.push('<ul>'+list.map(li=>'<li>'+escapeHTML(li)+'</li>').join('')+'</ul>'); list=[]; }
        blocks.push('<p>'+escapeHTML(line)+'</p>');
      }
    }
    if(list.length){ blocks.push('<ul>'+list.map(li=>'<li>'+escapeHTML(li)+'</li>').join('')+'</ul>'); }
    return blocks.join('\n');
  }catch(e){ return escapeHTML(String(raw)); }
}
});

// ===== SHV hardening addon (idempotent) =====
(function(){
  if (window.__shv_hardened__) return; window.__shv_hardened__ = true;
  const $ = (s, r=document)=>r.querySelector(s);
  const $$ = (s, r=document)=>Array.from(r.querySelectorAll(s));
  const safeNum = (x)=>{ try{ return Number(String(x??0).replace(/\./g,'').replace(/,/g,'.'))||0; }catch(e){ return 0; } };
  function pricePair(o){ if(!o||typeof o!=='object') return {sale:0,reg:0};
    return { sale: safeNum(o.price_sale ?? o.sale_price), reg: safeNum(o.price ?? o.regular_price ?? o.base_price) };
  }
  function minVariantPrice(arr){ if(!Array.isArray(arr)||!arr.length) return {sale:0,reg:0};
    let best={sale:Infinity,reg:Infinity}; for(const v of arr){ const {sale,reg}=pricePair(v); const eff = sale>0 ? sale : reg;
      if(eff>0 && eff < (best.sale!==Infinity?best.sale:best.reg)){ best = {sale: sale>0?sale:0, reg: reg||0}; } }
    return best.sale!==Infinity? best : {sale:0,reg:0};
  }
  function findVariantArray(p){ if(!p||typeof p!=='object') return [];
    const dir = p.variants||p.skus||p.items; if(Array.isArray(dir)&&dir.length) return dir;
    for(const k in p){ if(!Object.prototype.hasOwnProperty.call(p,k)) continue; const v=p[k];
      if(Array.isArray(v)&&v.length&&typeof v[0]==='object'){ const ok=v.some(function(it){
        return ('price'in it)||('sale_price'in it)||('price_sale'in it)||('stock'in it)||('sku'in it)||('name'in it)||('image'in it);
      }); if(ok) return v; } }
    return [];
  }

  // initial price min variant if #price exists and text 0đ
  try{
    const PRODUCT = window.PRODUCT||{}; const VARS=findVariantArray(PRODUCT);
    const priceEl = document.getElementById('price');
    if(priceEl && /\b0đ\b/.test(priceEl.textContent||'') && VARS.length){
      const pair = minVariantPrice(VARS);
      const p = pair.sale || pair.reg || 0;
      priceEl.textContent = (p>0? p.toLocaleString() : 0) + 'đ';
    }
  }catch(e){}

  // Media fit & video autoplay + autoslide
  try{
    const box = document.getElementById('media-main');
    if(box){
      const img = box.querySelector('img,video');
      const fit = (el)=>{
        if(!el) return;
        el.style.width='100%'; el.style.height='100%'; el.style.objectFit='contain';
        if(el.tagName==='IMG'){
          const apply=()=>{ if(el.naturalWidth && el.naturalHeight) box.style.aspectRatio = el.naturalWidth+'/'+el.naturalHeight; };
          el.complete ? apply() : el.addEventListener('load', apply, {once:true});
        }
      };
      fit(img);
      $$('#media-thumbs button[data-media-kind="video"]').forEach(btn=>{
        btn.addEventListener('click', ()=>{
          setTimeout(()=>{ const v=$('#media-main video'); if(!v) return; v.muted=true; v.playsInline=true; v.autoplay=true; v.play().catch(()=>{});
            v.onended=()=>{ const thumbs=$$('#media-thumbs button'); let i=0; const tick=()=>{
              while(i<thumbs.length && thumbs[i].dataset.mediaKind==='video') i++; if(i>=thumbs.length) return; thumbs[i++].click(); setTimeout(tick,2500);
            }; tick(); };
          }, 60);
        });
      });
    }
  }catch(e){}

  // Style Zalo & cart icon
  try{
    const zaloBtn = Array.from(document.querySelectorAll('button,a')).find(x=>x.textContent.trim()==='Zalo');
    if(zaloBtn){ zaloBtn.style.background='#0068FF'; zaloBtn.style.borderColor='#0068FF'; zaloBtn.style.color='#fff'; }
    const cartLink = Array.from(document.querySelectorAll('a,button')).find(x=>x.textContent.trim()==='Giỏ');
    if(cartLink && !cartLink.dataset.iconified){ cartLink.dataset.iconified='1';
      cartLink.innerHTML = '<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" width=\"18\" height=\"18\" style=\"vertical-align:-3px;margin-right:4px\"><path d=\"M7 4h-2l-1 2h2l3.6 7.59-1.35 2.45A2 2 0 0 0 10 18h9v-2h-8.42a.25.25 0 0 1-.22-.37L11.1 13h6.45a2 2 0 0 0 1.8-1.1l3.24-6.49A1 1 0 0 0 21.7 4H7zM7 20a2 2 0 1 0 0-4 2 2 0 0 0 0 4zm10 0a2 2 0 1 0 0-4 2 2 0 0 0 0 4z\"/></svg>Giỏ';
    }
  }catch(e){}
})(); // end hardening addon