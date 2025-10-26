// \apps\fe\src\checkout.js
// --- Enhancements: phone validation & double-submit guard ---
const VN_PHONE_RE = /^(03|05|07|08|09)\d{8}$/;
let __placing = false;
function guardSubmit(btn){ if(__placing) return false; __placing=true; btn?.setAttribute('disabled','disabled'); return true; }
function releaseSubmit(btn){ __placing=false; btn?.removeAttribute('disabled'); }

import { api } from './lib/api.js';
import { formatPrice } from './lib/price.js';

// Hiển thị khối lượng theo đơn vị thân thiện (không ép về 1kg)
function toHumanWeight(g){
  const n = Number(g||0);
  if (n <= 0) return '0 g';
  if (n < 1000) return `${n} g`;
  const kg = n / 1000;
  return (kg % 1 === 0) ? `${kg.toFixed(0)} kg` : `${kg.toFixed(1)} kg`;
}


// === Fixed Shipping Rate Table (weight in grams -> VND) ===
function getFixedQuotes(weightGrams){
  const kg = Math.max(1, Math.ceil(Number(weightGrams||0)/1000)); // 1..6+
  const cap = Math.min(kg, 6);
  const table = {
    // index by kg 1..6
    vtp: { name: 'Viettel Post', rates: {1:18000,2:23000,3:28000,4:33000,5:38000,6:43000} },
    spx: { name: 'SPX Express',  rates: {1:15000,2:25000,3:35000,4:45000,5:55000,6:65000} },
    jt:  { name: 'J&T Express',  rates: {1:20000,2:25000,3:25000,4:30000,5:35000,6:40000} },
    lex: { name: 'Lazada Express',rates: {1:19000,2:19000,3:19000,4:24000,5:27000,6:31000} },
    ghn: { name: 'GHN',           rates: {1:19000,2:19000,3:24000,4:29000,5:34000,6:39000} },
    best:{ name: 'BEST Express',  rates: {1:18000,2:18000,3:23000,4:28000,5:33000,6:33000} },
  };
  // if >6kg, extend linearly based on last step where possible
  function extend(code){
    const r = table[code].rates;
    if(kg<=6) return r[cap];
    const last = r[6]; const prev = r[5];
    const step = (last - prev) || 0;
    return last + step*(kg-6);
  }
  const list = Object.entries(table).map(([code,info])=> ({
    provider: code,
    service_code: 'fixed',
    name: info.name,
    fee: kg<=6 ? info.rates[cap] : extend(code),
    eta: ''
  }));
  return list.filter(o=>o.fee>=0);
}


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

function calcWeight(cart){ return cart.reduce((sum,it)=> sum + Number(it.weight_gram||it.weight_grams||it.weight||0)*Number(it.qty||1), 0); }


quoteBtn?.addEventListener('click', async () => { await fetchAndRenderQuote(); });

async function fetchAndRenderQuote(){
  const to_province = document.getElementById('province')?.value?.trim() || '';
  const to_district = document.getElementById('district')?.value?.trim() || '';
  const to_ward     = document.getElementById('ward')?.value?.trim() || '';
  const cart = getCart();
  const weight = calcWeight(cart);
  const subtotal = (cart||[]).reduce((s,it)=> s + Number(it.price||0)*Number(it.qty||1), 0);

  try{
    // ==== ENDPOINT-FIRST with FALLBACKS ====
    const payload = {
  // kho gửi
  sender_province:  localStorage.getItem('wh_province') || '',
  sender_district:  localStorage.getItem('wh_district') || '',
  // người nhận
  receiver_province: to_province,
  receiver_district: to_district,
  receiver_commune: to_ward || '',
  // gói hàng (tính từ trọng lượng SP đã lưu khi add-to-cart)
  weight_gram: Number(weight || 0),
  weight:      Number(weight || 0),  // alias cho Worker → SuperAI
  value:       Number(subtotal || 0),// alias cho Worker → SuperAI
  cod:         Number(subtotal || 0),
  option_id: '1'
};
console.log('[Checkout] weight (gram) =', payload.weight_gram, 'items=', (items||[]).map(it=>({w:(it.weight_gram||it.weight_grams||it.weight||0), q:it.qty})));
let arr = [];
try {
  const resEP = await api('/v1/platform/orders/price', {
    method: 'POST',
    body: payload
  });
  arr = (resEP && (resEP.items || resEP.data)) || [];
} catch (e) { arr = []; }

    if (!Array.isArray(arr) || !arr.length) {
  quoteList.innerHTML = '<div class="text-sm text-red-600">Không lấy được giá vận chuyển từ SuperAI.</div>';
  chosen = null;
  localStorage.removeItem('ship_provider');
  localStorage.removeItem('ship_service');
  localStorage.removeItem('ship_name');
  localStorage.removeItem('ship_fee');
  localStorage.removeItem('ship_eta');
  renderSummary();
  return;
}

    // Normalize
    arr = arr.map(o => ({
      provider: o.provider || o.carrier || '',
      service_code: o.service_code || o.service || '',
      name: o.name || o.service_name || ((o.provider||'') + (o.service_code?(' - '+o.service_code):'')),
      fee: Number(o.fee || o.total_fee || o.price || 0),
      eta: o.eta || o.leadtime || o.leadtime_text || ''
    })).filter(o => o.fee >= 0);

    if(arr.length===0){
      quoteList.innerHTML = '<div class="text-sm text-gray-500">Không có gói vận chuyển khả dụng.</div>';
      chosen = null;
      localStorage.removeItem('ship_provider');
      localStorage.removeItem('ship_service');
      localStorage.removeItem('ship_name');
      localStorage.removeItem('ship_fee');
      localStorage.removeItem('ship_eta');
      renderSummary();
      return;
    }

    arr.sort((a,b)=> a.fee - b.fee);
    const best = arr[0];
    chosen = { provider: best.provider, service_code: best.service_code, name: best.name, fee: best.fee, eta: best.eta };
    localStorage.setItem('ship_provider', chosen.provider||'');
    localStorage.setItem('ship_service', chosen.service_code||'');
    localStorage.setItem('ship_name', chosen.name||'');
    localStorage.setItem('ship_fee', String(chosen.fee||0));
    localStorage.setItem('ship_eta', chosen.eta||'');

    lastPricing = arr;
    renderSummary();

    // Render list
    quoteList.innerHTML = arr.map((opt, idx) => `
      <label class="flex items-center gap-3 border rounded p-3 hover:bg-gray-50">
        <input type="radio" name="ship"
               value="${opt.provider}|${opt.service_code}"
               data-fee="${opt.fee}" data-eta="${opt.eta||''}" data-name="${opt.name}"
               ${idx===0 ? 'checked' : ''}/>
        <div class="flex-1">
          <div class="font-medium">${opt.name}</div>
          <div class="text-sm">Phí: ${formatPrice(opt.fee)} • ETA: ${opt.eta || '-'}</div>
        </div>
      </label>
    `).join('');

    // Allow manual change
    quoteList.querySelectorAll('input[name=ship]').forEach(r=>r.onchange=()=>{
      const fee = Number(r.dataset.fee||0), name=r.dataset.name||'', eta=r.dataset.eta||'';
      const [prov,svc] = String(r.value||'').split('|');
      chosen = { provider: prov||'', service_code: svc||'', fee, name, eta };
      localStorage.setItem('ship_provider', chosen.provider||'');
      localStorage.setItem('ship_service', chosen.service_code||'');
      localStorage.setItem('ship_name', name);
      localStorage.setItem('ship_fee', String(fee));
      localStorage.setItem('ship_eta', eta||'');
      renderSummary();
    });

  }catch(e){
    console.error(e);
    quoteList.innerHTML = '<div class="text-sm text-red-600">Không lấy được giá vận chuyển.</div>';
  }
},
      to_province: to_province, to_district: to_district, to_ward: to_ward,
      items: cart.map(it=>({ sku: it.id||it.sku||'', qty: Number(it.qty||1), price: Number(it.price||0), weight_grams: Number(it.weight_gram||it.weight_grams||it.weight||0) })),
      package: { weight_grams: Number(weight||0) },
      total_cod: subtotal
    };
    // let res = await api('/api/shipping/quote', { method:'POST', body: payload });
    if(!Array.isArray(arr) || arr.length===0){
      // Fallback to legacy
      res = await api(`/shipping/quote?to_province=${encodeURIComponent(to_province)}&to_district=${encodeURIComponent(to_district)}&weight=${Number(weight)||0}&cod=${subtotal}`);
      arr = (res?.items || res || []);
    }
    arr = arr.map(o=>({
      provider: o.provider||o.carrier||'',
      service_code: o.service_code || o.service || '',
      name: o.name || o.service_name || (o.provider||'') + (o.service_code?(' - '+o.service_code):''),
      fee: Number(o.fee || o.total_fee || o.price || 0),
      eta: o.eta || o.leadtime || o.leadtime_text || ''
    })).filter(o=>o.fee>=0);

    if(arr.length===0){ quoteList.innerHTML = '<div class="text-sm text-gray-500">Không có gói vận chuyển khả dụng.</div>'; return; }
    arr.sort((a,b)=> a.fee - b.fee);
    const best = arr[0];
    chosen = { provider: best.provider, service_code: best.service_code, name: best.name, fee: best.fee, eta: best.eta };
    localStorage.setItem('ship_provider', chosen.provider||'');
    localStorage.setItem('ship_service', chosen.service_code||'');
    localStorage.setItem('ship_name', chosen.name||'');
    localStorage.setItem('ship_fee', String(chosen.fee||0));
    localStorage.setItem('ship_eta', chosen.eta||'');

    lastPricing = arr;
    renderSummary();

    
// Render list
    quoteList.innerHTML = arr.map(opt => `
      <label class="flex items-center gap-3 border rounded p-3">
        <input type="radio" name="ship" value="${opt.provider}|${opt.service_code}" data-fee="${opt.fee}" data-eta="${opt.eta||''}" data-name="${opt.name}" ${opt===best?'checked':''}/>
        <div class="flex-1"><div class="font-medium">${opt.name}</div><div class="text-sm">Phí: ${formatPrice(opt.fee)} • ETA: ${opt.eta || '-'}</div></div>
      </label>
    `).join('');

    // Allow manual change
    quoteList.querySelectorAll('input[name=ship]').forEach(r=>r.onchange=()=>{
      const fee = Number(r.dataset.fee||0), name=r.dataset.name||'', eta=r.dataset.eta||'';
      const [prov,svc] = String(r.value||'').split('|');
      chosen = { provider: prov||'', service_code: svc||'', fee, name, eta };
      localStorage.setItem('ship_provider', chosen.provider||'');
      localStorage.setItem('ship_service', chosen.service_code||'');
      localStorage.setItem('ship_name', name);
      localStorage.setItem('ship_fee', String(fee));
      localStorage.setItem('ship_eta', eta||'');
      renderSummary();
    });

  }catch(e){
    console.error(e);
    quoteList.innerHTML = '<div class="text-sm text-red-600">Không lấy được giá vận chuyển.</div>';
  }
}
testVoucherBtn?.addEventListener('click', async ()=> {
  const cart = getCart();
  const items = cart.map(it => ({ id: it.id, category: '', price: it.price, qty: it.qty }));
  const res = await api('/pricing/preview', { method:'POST', body: { items, shipping_fee: chosen?.fee||0, voucher_code: voucherInput.value||null } });
  lastPricing = res;
  voucherResult.textContent = `Tạm tính: ${formatPrice(res.subtotal)} | Giảm: ${formatPrice((res.discount_product||0)+(res.discount_shipping||0))} | Tổng: ${formatPrice(res.total)}`;
});


function getCart(){
  try{
    const lower = JSON.parse(localStorage.getItem('cart')||'[]');
    if(Array.isArray(lower) && lower.length) return lower;
    const upper = JSON.parse(localStorage.getItem('CART')||'[]');
    return Array.isArray(upper) ? upper : [];
  }catch{ return []; }
}
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
      <div class="text-sm">Khối lượng: ${toHumanWeight((items||[]).reduce((s,it)=> s + Number(it.weight_gram||it.weight_grams||it.weight||0)*Number(it.qty||1), 0))}</div>
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
    const cart = getCart();
    if(!cart.length){ orderResult.textContent='Giỏ hàng trống.'; return releaseSubmit(btn); }
    const name = document.getElementById('name').value.trim();
    const phone = document.getElementById('phone').value.trim();
    const address = document.getElementById('address').value.trim();
    if(!name || !phone || !address){ orderResult.textContent='Vui lòng điền đầy đủ Họ tên, SĐT, Địa chỉ.'; return releaseSubmit(btn); }
    if(!VN_PHONE_RE.test(phone)){ orderResult.textContent='SĐT không hợp lệ (VD: 09xxxxxxxx).'; return releaseSubmit(btn); }

    const items = cart.map(it => ({ product_id: it.id, name: it.name, qty: it.qty, price: it.price, variant: it.variant||null }));
    const voucher_code = (localStorage.getItem('voucher_code') || (voucherInput?.value||'').trim() || null);
    const ship_fee = chosen?.fee ?? Number(localStorage.getItem('ship_fee')||0);
    // legacy body removed; using consolidated payload below
    const body = {
      customer: { name, phone, address,
        province_code: document.getElementById('province')?.value||'',
        district_code: document.getElementById('district')?.value||'',
        commune_code: document.getElementById('ward')?.value||''
      },
      items: cart.map(it=>({ id: it.id||it.sku||'', sku: it.sku||it.id||'', name: it.name, qty: Number(it.qty||1), price: Number(it.price||0), cost: Number(it.cost||0||null), weight_grams: Number(it.weight_gram||it.weight_grams||it.weight||0) })),
      note: '',
      shipping: { provider: (chosen?.provider || localStorage.getItem('ship_provider') || ''), service_code: (chosen?.service_code || localStorage.getItem('ship_service') || '') },
      totals: { shipping_fee: Number(ship_fee||0), discount: Number(localStorage.getItem('voucher_discount')||0), shipping_discount: Number(localStorage.getItem('voucher_ship_discount')||0) }
	  // [BẮT ĐẦU CHÈN - checkout.js]
  source: 'website',
  status: 'placed'
  // [KẾT THÚC CHÈN - checkout.js]
    };
	console.log('[INV-TRACE] FE.checkout: createOrder payload', body);
    const res = await api('/api/orders', {
  method: 'POST',
  headers: {
    'Idempotency-Key': (
      localStorage.getItem('idem_order') ||
      (() => {
        const v = 'idem-' + Date.now();
        localStorage.setItem('idem_order', v);
        return v;
      })()
    )
  },
  body
});
console.log('[INV-TRACE] FE.checkout: createOrder response', res);
// ✅ Kiểm tra phản hồi đúng cách
if (res && (res.id || res.success || res.status === 'ok')) {
  orderResult.textContent = `Đặt hàng thành công: ${res.id || ''}`;
  // Xoá giỏ hàng
  // Xóa toàn bộ giỏ hàng sau khi đặt đơn
['cart', 'CART', 'shv_cart_v1', 'shv_cart', 'shv_cart_items'].forEach(k => localStorage.removeItem(k));

// Ngăn sync ghi lại dữ liệu cũ
localStorage.setItem('cart_cleared', Date.now().toString());

// Cập nhật lại giao diện
window.dispatchEvent(new Event('shv:cart-changed'));
  // Làm sạch token idempotent cũ
  localStorage.removeItem('idem_order');
  // Cập nhật lại giao diện
  renderSummary();
  if (document.getElementById('cart-list')) {
    document.getElementById('cart-list').innerHTML = '<div class="p-4 text-sm">Giỏ hàng trống.</div>';
  }
} else {
  orderResult.textContent = 'Không tạo được đơn hàng. Vui lòng thử lại.';
}
}
  catch(e){
    console.error(e);
    orderResult.textContent = 'Có lỗi xảy ra khi đặt hàng.';
  }finally{
    try{ renderSummary(); }catch(e){}
    releaseSubmit(btn);
  }
});

;['province','district','ward','address'].forEach(id=>{
  const E = document.getElementById(id);
  if(E){ ['change','blur','keyup'].forEach(ev=> E.addEventListener(ev, ()=>{ try{ fetchAndRenderQuote(); }catch(e){} })); }
});
document.addEventListener('DOMContentLoaded', ()=>{ try{ fetchAndRenderQuote(); }catch(e){} });

