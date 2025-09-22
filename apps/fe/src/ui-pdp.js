import { fetchProductByIdOrSlug } from './lib/api.js';
(()=>{const e=e=>document.querySelector(e),t=e("#pdp"),n={product:null};document.addEventListener("DOMContentLoaded",o);async function o(){c(),i();const e=a();if(!e)return s("Không xác định được sản phẩm.");try{const t=await fetchProductByIdOrSlug(e);n.product=r(t),l(),u()}catch(e){console.error("[PDP] init error:",e),s("Không tải được dữ liệu sản phẩm. Vui lòng thử lại.")}}function c(){if(t)return;const e=document.createElement("main");e.id="pdp",e.className="pdp-shell",document.body.appendChild(e)}function a(){const e=new URLSearchParams(location.search);return e.get("id")||e.get("slug")||d()}function d(){const e=location.pathname.replace(/\/+$/,"").split("/"),t=e[e.length-1]||"";return t.replace(/\.html?$/i,"")}function i(){e("#pdp").innerHTML='<div class="pdp-skeleton"><div class="blk"></div><div class="blk"></div></div>'}function r(e={}){const t=(e.images&&e.images.length?e.images:[e.image]).filter(Boolean),o="number"==typeof e.price?e.price:Number(e.price)||0;return{id:e.id||e._id||e.sku||"",title:e.title||e.name||"Sản phẩm",description:e.description||e.desc||"",images:t.length?t:["/assets/no-image.svg"],price:o,variants:Array.isArray(e.variants)?e.variants:[],rating:e.rating||e.stars||5,sold:e.sold||0,slug:e.slug||""}}function l(){const t=n.product;e("#pdp").innerHTML=`
      <div class="pdp-grid">
        <figure class="pdp-figure">
          <img src="${p(t.images[0])}" alt="${p(t.title)}">
          <div class="pdp-variants">
            ${t.images.map(((e,t)=>`<img data-idx="${t}" src="${p(e)}" alt="thumb ${t}" style="width:72px;height:72px;border-radius:10px;object-fit:cover;cursor:pointer;border:1px solid #eee">`)).join("")}
          </div>
        </figure>
        <section>
          <div class="pdp-badge"><span>⭐ ${t.rating}</span><span>•</span><span>${t.sold} đã bán</span></div>
          <h1 class="pdp-title">${p(t.title)}</h1>
          <div class="pdp-price">${m(t.price)}</div>
          <div class="pdp-actions">
            <button id="btn-buy" class="btn primary">MUA NGAY</button>
            <button id="btn-add" class="btn">Thêm giỏ</button>
            <a id="btn-zalo" class="btn" href="https://zalo.me/" target="_blank" rel="noopener">Zalo</a>
          </div>
          ${g(t)}
        </section>
      </div>
      <article class="pdp-desc">${h(t.description)}</article>`}function g(e){return e.variants&&e.variants.length?`<div style="margin-top:12px"><div style="font-weight:600;margin-bottom:6px">Phân loại</div>
      <div class="pdp-variants">${e.variants.map((e=>`<span class="badge" data-var="${p(e.name||e)}">${p(e.name||e)}</span>`)).join("")}</div></div>`:""}function u(){const t=e("#pdp");t?.addEventListener("click",(e=>{const t=e.target;if(t.matches(".pdp-variants img")){const e=Number(t.getAttribute("data-idx")||0),n=t.closest("#pdp").querySelector(".pdp-figure img"),o=n&&n.closest("#pdp")?n:document.querySelector(".pdp-figure img"),c=(o&&o.closest("#pdp"),n||o),a=window.__PDP_STATE__?.product||n?.dataset?.product||{};let d=(a.images||[])[e];d||(d=window.__PDP_LAST_IMAGE__),c&&(c.src=d||c.src),window.__PDP_LAST_IMAGE__=d} "btn-add"===t.id&&f(),"btn-buy"===t.id&&b()}))}function f(){try{const e=JSON.parse(localStorage.getItem("shv_cart")||"[]");e.push({id:n.product.id,qty:1,ts:Date.now()}),localStorage.setItem("shv_cart",JSON.stringify(e)),y("Đã thêm vào giỏ.")}catch(e){console.warn(e)}}function b(){f(),location.href="/checkout.html"}function s(t){e("#pdp").innerHTML=`<div style="padding:24px;border-radius:12px;background:#fff1f2;color:#991b1b">
      <strong>Lỗi:</strong> ${p(t)}</div>`}function m(e){try{return new Intl.NumberFormat("vi-VN",{style:"currency",currency:"VND"}).format(e||0)}catch{return(e||0).toLocaleString("vi-VN")+"đ"}}function p(e=""){return String(e).replace(/[&<>"']/g,(e=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[e])))}function h(e=""){return String(e).replace(/<script/gi,"&lt;script")}function y(t){const n=document.createElement("div");n.textContent=t,n.style.cssText="position:fixed;left:50%;bottom:24px;transform:translateX(-50%);background:#111827;color:#fff;padding:10px 14px;border-radius:999px;z-index:9999",document.body.appendChild(n),setTimeout((()=>n.remove()),1800)}})();
