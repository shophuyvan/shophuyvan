
/**
 * Lightweight Product Detail Page renderer
 * - Safe syntax (no minified injections)
 * - Works even if the server template is empty
 * - Keeps: add to cart, variant modal, price from lowest variant
 */
import api from "./lib/api.js";

const sel = (q, el=document) => el.querySelector(q);
const $$  = (q, el=document) => Array.from(el.querySelectorAll(q));

function getParam(name){
  return new URLSearchParams(location.search).get(name);
}

function fmtVND(n){
  if (typeof n !== "number") n = Number(n||0);
  return n.toLocaleString("vi-VN") + "đ";
}

function minPrice(p){
  if (Array.isArray(p?.variants) && p.variants.length){
    return Math.min(...p.variants.map(v => Number(v.price || 0)));
  }
  return Number(p?.price || 0);
}

function getCart(){
  try { return JSON.parse(localStorage.getItem("cart")||"[]"); }
  catch { return []; }
}
function saveCart(items){ localStorage.setItem("cart", JSON.stringify(items)); }

function addToCart(item){
  const cart = getCart();
  const key = item.sku || (item.productId + ":" + (item.variantId||""));
  const found = cart.find(x => (x.sku||x.productId+":"+ (x.variantId||"")) === key);
  if (found){ found.qty += item.qty||1; }
  else cart.push({...item, qty:item.qty||1});
  saveCart(cart);
  // bubble event for header badge (if any existing code listens)
  window.dispatchEvent(new CustomEvent("cart:changed", {detail:cart}));
}

function ensureBaseStyles(){
  if (document.getElementById("pdp-inline-styles")) return;
  const css = `
  .pdp-wrap{max-width:960px;margin:0 auto;padding:16px}
  .pdp-grid{display:grid;grid-template-columns:1fr;gap:16px}
  @media(min-width:768px){.pdp-grid{grid-template-columns:1fr 1fr}}
  .pdp-media{background:#fff;border-radius:12px;overflow:hidden}
  .pdp-media img{display:block;width:100%;height:auto}
  .pdp-title{font-size:20px;font-weight:600;margin:8px 0 4px}
  .pdp-price{font-size:22px;color:#d32f2f;font-weight:700}
  .pdp-compare{color:#9aa4af;text-decoration:line-through;margin-left:8px;font-weight:500}
  .pdp-actions{display:flex;gap:12px;margin-top:16px}
  .btn{padding:10px 14px;border-radius:10px;border:1px solid #2563eb;background:#2563eb;color:#fff;cursor:pointer;font-weight:600}
  .btn.secondary{background:#fff;color:#2563eb}
  .chip{border:1px solid #e5e7eb;padding:8px 10px;border-radius:10px;cursor:pointer;background:#fff}
  .chip.active{border-color:#2563eb;box-shadow:0 0 0 2px #bfdbfe}
  /* modal */
  .modal-backdrop{position:fixed;inset:0;background:rgba(0,0,0,.45);display:flex;align-items:end;justify-content:center;z-index:999}
  @media(min-width:640px){.modal-backdrop{align-items:center}}
  .modal{background:#fff;border-radius:16px;max-width:520px;width:100%;padding:16px}
  .modal-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px}
  .close{border:none;background:transparent;font-size:20px;cursor:pointer}
  .qty{display:flex;align-items:center;gap:8px;margin-top:12px}
  .qty button{width:36px;height:36px;border-radius:8px;border:1px solid #e5e7eb;background:#fff}
  `;
  const style = document.createElement("style");
  style.id="pdp-inline-styles";
  style.textContent = css;
  document.head.appendChild(style);
}

function render(root, product){
  ensureBaseStyles();
  const lowest = minPrice(product);
  const cover = product?.images?.[0] || product?.image || "";
  root.innerHTML = `
    <div class="pdp-wrap">
      <div class="pdp-grid">
        <div class="pdp-media">
          ${cover ? `<img src="${cover}" alt="${product.title||''}"/>` : ''}
        </div>
        <div>
          <div class="pdp-title">${product.title||""}</div>
          <div style="color:#6b7280;margin-bottom:6px;">${product.sold? (product.sold+" đã bán • "): ""}5★</div>
          <div style="display:flex;align-items:center;margin:8px 0">
            <div class="pdp-price">${fmtVND(lowest)}</div>
            ${product.compare_at_price ? `<div class="pdp-compare">${fmtVND(product.compare_at_price)}</div>`:""}
          </div>
          <div class="pdp-actions">
            <button class="btn" id="btn-buy-now">MUA NGAY</button>
            <button class="btn secondary" id="btn-add">Thêm giỏ</button>
          </div>
          <div style="margin-top:14px"><button class="btn secondary" id="btn-zalo">Zalo</button></div>
        </div>
      </div>
      <div style="margin-top:22px">
        <h3 style="font-weight:700;font-size:18px;margin-bottom:8px">Mô tả</h3>
        <div style="background:#fff;border-radius:12px;padding:12px">${product.description||""}</div>
      </div>
    </div>
  `;

  sel("#btn-zalo")?.addEventListener("click", () => {
    const zalo = product.zalo || product.zalo_link || "https://zalo.me";
    window.open(zalo, "_blank");
  });

  const openVariant = () => openVariantModal(product, (selected, qty)=>{
    addToCart({
      productId: product.id || getParam("id"),
      variantId: selected?.id, sku: selected?.sku,
      title: product.title, variant_title: selected?.title,
      price: Number(selected?.price || product.price || 0),
      image: selected?.image || product.image,
      qty
    });
  });
  sel("#btn-add")?.addEventListener("click", openVariant);
  sel("#btn-buy-now")?.addEventListener("click", openVariant);
}

function openVariantModal(product, onConfirm){
  // Build options from product.variants OR single default
  const variants = Array.isArray(product?.variants) && product.variants.length ? product.variants : [{id:"default", title:"Mặc định", price:product.price||0, image:product.image}];
  let selected = variants[0];
  let qty = 1;

  const $backdrop = document.createElement("div");
  $backdrop.className = "modal-backdrop";
  $backdrop.innerHTML = `
    <div class="modal" role="dialog" aria-modal="true">
      <div class="modal-header">
        <div style="font-weight:700">Chọn phân loại</div>
        <button class="close" aria-label="Đóng">&times;</button>
      </div>
      <div class="modal-body">
        <div style="display:flex;flex-wrap:wrap;gap:8px" id="variant-wrap"></div>
        <div class="qty">
          <button id="minus">-</button>
          <span id="qty">1</span>
          <button id="plus">+</button>
        </div>
        <div style="margin-top:12px;font-weight:600">Giá: <span id="price">${fmtVND(selected.price||0)}</span></div>
      </div>
      <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:14px">
        <button class="btn secondary" id="cancel">Hủy</button>
        <button class="btn" id="ok">Xác nhận</button>
      </div>
    </div>`;

  const remove = ()=> $backdrop.remove();
  $backdrop.addEventListener("click", e => { if (e.target === $backdrop) remove(); });
  $backdrop.querySelector(".close").addEventListener("click", remove);
  document.body.appendChild($backdrop);

  const vw = sel("#variant-wrap", $backdrop);
  variants.forEach(v => {
    const el = document.createElement("button");
    el.className="chip" + (v===selected?" active":"");
    el.textContent = v.title || v.name || "Phân loại";
    el.addEventListener("click", ()=>{
      selected = v;
      $$(".chip", vw).forEach(x=>x.classList.remove("active"));
      el.classList.add("active");
      sel("#price", $backdrop).textContent = fmtVND(selected.price||0);
    });
    vw.appendChild(el);
  });

  sel("#minus", $backdrop).addEventListener("click", ()=>{
    qty = Math.max(1, qty-1);
    sel("#qty",$backdrop).textContent = qty;
  });
  sel("#plus", $backdrop).addEventListener("click", ()=>{
    qty += 1;
    sel("#qty",$backdrop).textContent = qty;
  });

  sel("#cancel", $backdrop).addEventListener("click", remove);
  sel("#ok", $backdrop).addEventListener("click", ()=>{
    try{ onConfirm?.(selected, qty); }catch(e){ console.error(e); }
    remove();
    alert("Đã thêm vào giỏ hàng!");
  });
}

async function boot(){
  const id = getParam("id");
  if (!id) return;
  // Render into existing placeholder if present, otherwise body
  const mount = document.getElementById("pdp-root") || document.getElementById("__pdp") || document.querySelector("main") || document.body;
  try {
    const product = await api(`/product?id=${encodeURIComponent(id)}`);
    render(mount, product);
  } catch (e){
    console.error("PDP: load failed", e);
    // At least render a basic skeleton so page isn't blank
    render(mount, { title:"Sản phẩm", price:0, description:"" });
  }
}

document.addEventListener("DOMContentLoaded", boot);
