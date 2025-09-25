
// --- Enhancements: phone validation & double-submit guard ---
const VN_PHONE_RE = /^(03|05|07|08|09)\d{8}$/;
let __placing = false;
function guardSubmit(btn){ if(__placing) return false; __placing=true; btn?.setAttribute('disabled','disabled'); return true; }
function releaseSubmit(btn){ __placing=false; btn?.removeAttribute('disabled'); }

import { api } from './lib/api.js';
import { formatPrice } from './lib/price.js';

const quoteBtn = document.getElementById('get-quote');
const quoteList = document.getElementById('quote-list');
const testVoucherBtn = document.getElementById('test-voucher');
const voucherInput = document.getElementById('voucher');
const voucherResult = document.getElementById('voucher-result');
const orderBtn = document.getElementById('place-order');
const orderResult = document.getElementById('order-result');
const summaryEl = document.getElementById('cart-summary');
// expose a summary updater for voucher-ui.js to call
window.__updateSummary = function(){ try{ renderSummary(); }catch(e){} };

let chosen = null;
let lastPricing = null;

function calcWeight(cart) {
  return cart.reduce((sum, it) => sum + (it.weight_grams || 0) * (it.qty || 1), 0);
}

// === AUTO QUOTE & AUTO-SELECT CHEAPEST (PATCH) ===
async function __fetchQuoteAndRender(auto=false){
  const to_province = document.getElementById('province')?.value || '';
  const to_district = document.getElementById('district')?.value || '';
  const cart = JSON.parse(localStorage.getItem('CART')||'[]');
  const weight = calcWeight(cart);
  if(!to_province || !to_district || !weight){ 
    if(!auto){ console.warn('quote skipped: missing province/district/weight'); }
    return null;
  }
  const res = await api(`/shipping/quote?to_province=${encodeURIComponent(to_province)}&to_district=${encodeURIComponent(to_district)}&weight=${weight}&cod=0`);
  const items = (res.items || res || []);
  quoteList.innerHTML = items.map(opt => `
    <label class="flex items-center gap-3 border rounded p-3 cursor-pointer">
      <input type="radio" name="ship" value="${opt.provider}:${opt.service_code||''}" data-fee="${opt.fee}" data-eta="${opt.eta||''}" data-name="${opt.name||''}"/>
      <div class="flex-1">
        <div class="font-medium">${opt.name||''}</div>
        <div class="text-sm">Phí: ${formatPrice(opt.fee)} | ETA: ${opt.eta || '-'}</div>
      </div>
    </label>
  `).join('');

  // bind selection
  quoteList.querySelectorAll('input[name=ship]').forEach(r=>r.onchange=()=>{
    const [provider, service_code] = (r.value||'').split(':');
    localStorage.setItem('ship_provider', provider); 
    localStorage.setItem('ship_service', service_code);
    const fee = parseInt(r.dataset.fee||'0',10);
    const eta = r.dataset.eta||'';
    const name = r.dataset.name||'';
    chosen = { provider, service_code, fee, eta, name };
    localStorage.setItem('ship_fee', String(fee));
    localStorage.setItem('ship_eta', eta);
    localStorage.setItem('ship_name', name);
    try{ renderSummary(); }catch(e){}
  });

  // Auto-select cheapest on first load or when auto-triggered
  if(items.length){
    let cheapest = items[0];
    for(const it of items){ if(Number(it.fee)<Number(cheapest.fee)) cheapest = it; }
    // tick corresponding radio
    const val = `${cheapest.provider}:${cheapest.service_code||''}`;
    const radio = quoteList.querySelector(`input[name=ship][value="${val}"]`);
    if(radio){ radio.checked = true; radio.dispatchEvent(new Event('change')); }
  }
  return items;
}

// auto triggers
function __bindAutoQuote(){
  const trigger = () => __fetchQuoteAndRender(true);
  ['province','district','ward','rcv_addr'].forEach(id=>{
    const el = document.getElementById(id); if(!el) return;
    el.addEventListener('change', trigger); el.addEventListener('input', trigger);
  });
  // quantity inputs
  document.querySelectorAll('.item-qty input').forEach(inp=>{
    inp.addEventListener('change', trigger); inp.addEventListener('input', trigger);
  });
  // run once on load
  document.addEventListener('DOMContentLoaded', trigger);
}
// === /PATCH ===

quoteBtn?.addEventListener('click', async ()=>{ await __fetchQuoteAndRender(false); });
__bindAutoQuote();
});
testVoucherBtn?.addEventListener('click', async ()=> {
  const cart = JSON.parse(localStorage.getItem('CART')||'[]');
  const items = cart.map(it => ({ id: it.id, category: '', price: it.price, qty: it.qty }));
  const res = await api('/pricing/preview', { method:'POST', body: { items, shipping_fee: chosen?.fee||0, voucher_code: voucherInput.value||null } });
  lastPricing = res;
  voucherResult.textContent = `Tạm tính: ${formatPrice(res.subtotal)} | Giảm: ${formatPrice((res.discount_product||0)+(res.discount_shipping||0))} | Tổng: ${formatPrice(res.total)}`;
});


function getCart(){ try{ return JSON.parse(localStorage.getItem('CART')||'[]'); }catch{return [];} }
function calcSubtotal(items){ return (items||[]).reduce((s,it)=> s + Number(it.price||0)*Number(it.qty||1), 0); }

function renderSummary(){
  if(!summaryEl) return;
  const items = getCart();
  const sub = calcSubtotal(items);
  const ship_fee = chosen?.fee ?? Number(localStorage.getItem('ship_fee')||0);
  const ship_name = chosen?.name ?? (localStorage.getItem('ship_name')||'Chưa chọn');
  const ship_eta = chosen?.eta ?? (localStorage.getItem('ship_eta')||'');
  const v_discount = Number(localStorage.getItem('voucher_discount')||0);
  const v_ship_discount = Number(localStorage.getItem('voucher_ship_discount')||0);
  const name = document.getElementById('name')?.value || '';
  const phone = document.getElementById('phone')?.value || '';
  const address = document.getElementById('address')?.value || '';

  const fee_after = Math.max(0, ship_fee - v_ship_discount);
  const total = Math.max(0, sub - v_discount + fee_after);

  const itemsHtml = items.map(it=>`
    <div class="flex justify-between text-sm py-1">
      <div class="w-2/3 pr-2">${it.name}${it.variant?` - ${it.variant}`:''} <span class="text-gray-500">x${it.qty}</span></div>
      <div class="text-right font-medium">${formatPrice(Number(it.price||0)*Number(it.qty||1))}</div>
    </div>
  `).join('') || '<div class="text-sm text-gray-500">Giỏ hàng trống.</div>';

  summaryEl.innerHTML = `
  <div class="space-y-3">
    <div>
      <div class="font-semibold mb-1">Địa chỉ nhận hàng</div>
      <div class="text-sm">${name||'-'} ${phone?`• ${phone}`:''}</div>
      <div class="text-sm">${address||'-'}</div>
    </div>

    <div>
      <div class="font-semibold mb-1">Thông tin sản phẩm</div>
      ${itemsHtml}
    </div>

    <div>
      <div class="font-semibold mb-1">Vận chuyển</div>
      <div class="text-sm">${ship_name}${ship_eta?` • ${ship_eta}`:''}</div>
    </div>

    <div class="border-t pt-2 text-sm">
      <div class="flex justify-between"><span>Tổng tiền hàng</span><span>${formatPrice(sub)}</span></div>
      <div class="flex justify-between"><span>Tổng tiền phí vận chuyển</span><span>${formatPrice(ship_fee)}</span></div>
      ${v_discount?`<div class="flex justify-between text-emerald-700"><span>Giảm giá</span><span>-${formatPrice(v_discount)}</span></div>`:''}
      ${v_ship_discount?`<div class="flex justify-between text-emerald-700"><span>Giảm phí vận chuyển</span><span>-${formatPrice(v_ship_discount)}</span></div>`:''}
      <div class="flex justify-between font-semibold text-base mt-1"><span>Tổng thanh toán</span><span>${formatPrice(total)}</span></div>
    </div>
  </div>`;
}
document.getElementById('name')?.addEventListener('input', ()=>renderSummary());
document.getElementById('phone')?.addEventListener('input', ()=>renderSummary());
document.getElementById('address')?.addEventListener('input', ()=>renderSummary());
window.addEventListener('storage', ()=>renderSummary()); // in case other scripts update voucher
document.addEventListener('DOMContentLoaded', ()=>renderSummary());

orderBtn?.addEventListener('click', async () => {
  const btn = orderBtn;
  if(!guardSubmit(btn)) return;
  try{
    const cart = JSON.parse(localStorage.getItem('CART')||'[]');
    if(!cart.length){ orderResult.textContent='Giỏ hàng trống.'; return releaseSubmit(btn); }
    const name = document.getElementById('name').value.trim();
    const phone = document.getElementById('phone').value.trim();
    const address = document.getElementById('address').value.trim();
    if(!name || !phone || !address){ orderResult.textContent='Vui lòng điền đầy đủ Họ tên, SĐT, Địa chỉ.'; return releaseSubmit(btn); }
    if(!VN_PHONE_RE.test(phone)){ orderResult.textContent='SĐT không hợp lệ (VD: 09xxxxxxxx).'; return releaseSubmit(btn); }

    const items = cart.map(it => ({ product_id: it.id, name: it.name, qty: it.qty, price: it.price, variant: it.variant||null }));
    const voucher_code = (localStorage.getItem('voucher_code') || (voucherInput?.value||'').trim() || null);
    const ship_fee = chosen?.fee ?? Number(localStorage.getItem('ship_fee')||0);
    const body = {
      customer_name: name,
      phone, address,
      items,
      voucher_code,
      shipping_fee: ship_fee,
      shipping_name: chosen?.name ?? localStorage.getItem('ship_name') || null,
      shipping_eta: chosen?.eta ?? localStorage.getItem('ship_eta') || null,
      shipping_provider: chosen?.provider || localStorage.getItem('ship_provider') || null,
      shipping_service: chosen?.service_code || localStorage.getItem('ship_service') || null
    };
    const res = await api('/public/orders/create', { method:'POST', body });
    if(res && res.orderId){
      orderResult.textContent = `Đặt hàng thành công: ${res.orderId}`;
      localStorage.removeItem('CART'); // clear cart after order
    }else{
      orderResult.textContent = 'Không tạo được đơn hàng. Vui lòng thử lại.';
    }
  }catch(e){
    console.error(e);
    orderResult.textContent = 'Có lỗi xảy ra khi đặt hàng.';
  }finally{
    try{ renderSummary(); }catch(e){}
    releaseSubmit(btn);
  }
});orderResult.textContent = `Đặt hàng thành công: ${res.orderId || ''}`;
  // Optionally call /shipping/create via backend setting
});
