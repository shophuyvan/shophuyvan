// \apps\fe\src\checkout.js
// --- Phone validation & double-submit guard ---
const VN_PHONE_RE = /^(03|05|07|08|09)\d{8}$/;
let __placing = false;
function guardSubmit(btn){ 
  if(__placing) return false; 
  __placing=true; 
  btn?.setAttribute('disabled','disabled'); 
  return true; 
}
function releaseSubmit(btn){ 
  __placing=false; 
  btn?.removeAttribute('disabled'); 
}

import { api } from './lib/api.js';
import { formatPrice } from './lib/price.js';

// --- Auto Freeship with Caching ---
let applicableFreeshipVoucher = null;
let cachedVouchers = null;
let voucherCacheTime = 0;
const VOUCHER_CACHE_TTL = 60000; // Cache 1 phút

/**
 * Tính toán mức giảm giá từ voucher freeship tự động (với cache)
 * @returns {Promise<number>} Mức giảm giá (VND), 0 nếu không có
 */
async function calculateAutoFreeshipDiscount(subtotal, currentShipFee) {
  try {
    // Sử dụng cache để giảm số lần gọi API
    const now = Date.now();
    if (!cachedVouchers || (now - voucherCacheTime) > VOUCHER_CACHE_TTL) {
      const res = await api('/vouchers');
      cachedVouchers = res.items || [];
      voucherCacheTime = now;
      console.log('[AutoFreeship] Refreshed voucher cache');
    }
    
    // Tìm voucher freeship đủ điều kiện
    const foundVoucher = cachedVouchers.find(v => 
      v.voucher_type === 'auto_freeship' &&
      v.on === true &&
      subtotal >= (v.min_purchase || 0)
    );

    applicableFreeshipVoucher = foundVoucher || null;

    if (applicableFreeshipVoucher) {
      console.log('[AutoFreeship] Applied:', applicableFreeshipVoucher.code);
      // Trả về số tiền được giảm (100% phí ship)
      return currentShipFee;
    }
    
    return 0;

  } catch (error) {
    console.error('[AutoFreeship] Error:', error);
    applicableFreeshipVoucher = null;
    return 0;
  }
}

// Hiển thị khối lượng theo đơn vị thân thiện
function toHumanWeight(g){
  const n = Number(g||0);
  if (n <= 0) return '0 g';
  if (n < 1000) return `${n} g`;
  const kg = n / 1000;
  return (kg % 1 === 0) ? `${kg.toFixed(0)} kg` : `${kg.toFixed(1)} kg`;
}

// === Fixed Shipping Quotes (Fallback) ===
function getFixedQuotes(weightGrams){
  const kg = Math.max(1, Math.ceil(Number(weightGrams||0)/1000));
  const cap = Math.min(kg, 6);
  const table = {
    vtp: { name: 'Viettel Post (Ước tính)', rates: {1:18000,2:23000,3:28000,4:33000,5:38000,6:43000} },
    ghn: { name: 'GHN (Ước tính)', rates: {1:19000,2:19000,3:24000,4:29000,5:34000,6:39000} },
    jt:  { name: 'J&T Express (Ước tính)', rates: {1:20000,2:25000,3:25000,4:30000,5:35000,6:40000} },
  };
  
  function extend(code){
    const r = table[code].rates;
    if(kg<=6) return r[cap];
    const last = r[6], prev = r[5];
    const step = (last - prev) || 5000;
    return last + step*(kg-6);
  }
  
  return Object.entries(table).map(([code,info])=> ({
    provider: code,
    service_code: 'fixed',
    name: info.name,
    fee: extend(code),
    eta: '3-5 ngày'
  }));
}

// DOM Elements
const quoteBtn = document.getElementById('get-quote');
const quoteList = document.getElementById('quote-list');
const testVoucherBtn = document.getElementById('test-voucher');
const voucherInput = document.getElementById('voucher');
const voucherResult = document.getElementById('voucher-result');
const orderBtn = document.getElementById('place-order');
const orderResult = document.getElementById('order-result');
const summaryEl = document.getElementById('cart-summary');

// Expose summary updater
window.__updateSummary = async function(){ 
  try{ await renderSummary(); }catch(e){ console.error('Update summary error:', e); } 
};

let chosen = null;
let lastPricing = null;

function calcWeight(cart){ 
  return cart.reduce((sum,it)=> sum + Number(it.weight_gram||it.weight_grams||it.weight||0)*Number(it.qty||1), 0); 
}

function getCart(){
  try{
    const lower = JSON.parse(localStorage.getItem('cart')||'[]');
    if(Array.isArray(lower) && lower.length) return lower;
    const upper = JSON.parse(localStorage.getItem('CART')||'[]');
    return Array.isArray(upper) ? upper : [];
  }catch{ return []; }
}

function calcSubtotal(items){ 
  return (items||[]).reduce((s,it)=> s + Number(it.price||0)*Number(it.qty||1), 0); 
}

// === Fetch & Render Shipping Quotes ===
async function fetchAndRenderQuote(){
  const to_province = document.getElementById('province')?.value?.trim() || '';
  const to_district = document.getElementById('district')?.value?.trim() || '';
  const to_ward = document.getElementById('ward')?.value?.trim() || '';
  const cart = getCart();
  const weight = calcWeight(cart);
  const subtotal = calcSubtotal(cart);

  try{
    const payload = {
      sender_province: localStorage.getItem('wh_province') || '',
      sender_district: localStorage.getItem('wh_district') || '',
      receiver_province: to_province,
      receiver_district: to_district,
      receiver_commune: to_ward || '',
      weight_gram: Number(weight || 0),
      weight: Number(weight || 0),
      value: Number(subtotal || 0),
      cod: Number(subtotal || 0),
      option_id: '1'
    };
    
    console.log('[Checkout] Fetching quotes, weight:', payload.weight_gram, 'g');
    
    let arr = [];
    try {
      const resEP = await api('/shipping/price', { method: 'POST', body: payload });
      arr = (resEP && (resEP.items || resEP.data)) || [];
    } catch (e) {
      console.error('[SHIPPING API FAILED]', e);
      arr = [];
    }

    // ✅ FIX: Sử dụng fallback nếu API thất bại
    if (!Array.isArray(arr) || !arr.length) {
      console.warn('[Checkout] Using fixed fallback quotes');
      arr = getFixedQuotes(payload.weight_gram);
    }

    // Normalize
    arr = arr.map(o => ({
      provider: o.provider || o.carrier || '',
      service_code: o.service_code || o.service || o.carrier_id || '',
      name: o.name || o.service_name || ((o.provider||'') + (o.service_code?(' - '+o.service_code):'')),
      fee: Number(o.fee || o.total_fee || o.price || 0),
      eta: o.eta || o.leadtime || o.leadtime_text || ''
    })).filter(o => o.fee >= 0);

    if(arr.length === 0){
      quoteList.innerHTML = '<div class="text-sm text-gray-500">Không có gói vận chuyển khả dụng.</div>';
      chosen = null;
      ['ship_provider','ship_service','ship_name','ship_fee','ship_eta'].forEach(k => localStorage.removeItem(k));
      await renderSummary();
      return;
    }

    // Sort và chọn gói rẻ nhất
    arr.sort((a,b)=> a.fee - b.fee);
    const best = arr[0];
    chosen = { 
      provider: best.provider, 
      service_code: best.service_code, 
      name: best.name, 
      fee: best.fee, 
      eta: best.eta 
    };
    
    localStorage.setItem('ship_provider', chosen.provider||'');
    localStorage.setItem('ship_service', chosen.service_code||'');
    localStorage.setItem('ship_name', chosen.name||'');
    localStorage.setItem('ship_fee', String(chosen.fee||0));
    localStorage.setItem('ship_eta', chosen.eta||'');

    lastPricing = arr;
    await renderSummary();

    // Render danh sách
    quoteList.innerHTML = arr.map((opt, idx) => `
      <label class="flex items-center gap-3 border rounded p-3 hover:bg-gray-50 cursor-pointer">
        <input type="radio" name="ship"
               value="${opt.provider}|${opt.service_code}"
               data-fee="${opt.fee}" 
               data-eta="${opt.eta||''}" 
               data-name="${opt.name}"
               ${idx===0 ? 'checked' : ''}/>
        <div class="flex-1">
          <div class="font-medium">${opt.name}</div>
          <div class="text-sm text-gray-600">Phí: ${formatPrice(opt.fee)} • Giao: ${opt.eta || '3-5 ngày'}</div>
        </div>
      </label>
    `).join('');

    // ✅ FIX: Callback phải là async để dùng await
    quoteList.querySelectorAll('input[name=ship]').forEach(r => {
      r.onchange = async () => {
        const fee = Number(r.dataset.fee||0);
        const name = r.dataset.name||'';
        const eta = r.dataset.eta||'';
        const [prov, svc] = String(r.value||'').split('|');
        
        chosen = { provider: prov||'', service_code: svc||'', fee, name, eta };
        localStorage.setItem('ship_provider', chosen.provider||'');
        localStorage.setItem('ship_service', chosen.service_code||'');
        localStorage.setItem('ship_name', name);
        localStorage.setItem('ship_fee', String(fee));
        localStorage.setItem('ship_eta', eta||'');
        
        await renderSummary();
      };
    });

  } catch(e) {
    console.error('[fetchAndRenderQuote] Error:', e);
    quoteList.innerHTML = '<div class="text-sm text-red-600">Không lấy được giá vận chuyển.</div>';
  }
} // ✅ FIX: Xóa dấu phẩy thừa

// === Test Voucher ===
testVoucherBtn?.addEventListener('click', async (event)=> {
  event.preventDefault();
  
  const code = voucherInput.value?.trim() || null;
  voucherResult.textContent = 'Đang kiểm tra...';
  voucherResult.style.color = '#888';
  
  if (!code) {
    ['voucher_code','voucher_discount','voucher_ship_discount'].forEach(k => localStorage.removeItem(k));
    voucherResult.textContent = 'Vui lòng nhập mã voucher.';
    voucherResult.style.color = 'red';
    await window.__updateSummary();
    return;
  }
  
  try {
    const cart = getCart();
    const items = cart.map(it => ({ 
      id: it.id, 
      category: '', 
      price: it.price, 
      qty: it.qty 
    }));
    const current_ship_fee = chosen?.fee ?? Number(localStorage.getItem('ship_fee')||0);
    
    const res = await api('/vouchers/apply', { 
     method:'POST', 
     body: { 
       code: code,
       subtotal: calcSubtotal(cart),
       customer_id: null
     } 
    );
    
    if (res.ok !== true || res.valid !== true) {
  throw new Error(res.message || 'Mã voucher không hợp lệ');
}

// Lưu kết quả
lastPricing = res;
localStorage.setItem('voucher_code', code);
localStorage.setItem('voucher_discount', String(res.discount || 0));
localStorage.setItem('voucher_ship_discount', String(res.ship_discount || 0));

const totalDiscount = (res.discount || 0) + (res.ship_discount || 0);
    
    if (totalDiscount > 0) {
      voucherResult.textContent = `✓ Áp dụng thành công! Giảm: ${formatPrice(totalDiscount)}`;
      voucherResult.style.color = 'green';
    } else {
      voucherResult.textContent = 'Mã hợp lệ, nhưng chưa đủ điều kiện áp dụng.';
      voucherResult.style.color = '#888'; 
    }

  } catch (err) {
    ['voucher_code','voucher_discount','voucher_ship_discount'].forEach(k => localStorage.removeItem(k));
    voucherResult.textContent = '✗ ' + (err.message || 'Mã voucher không hợp lệ');
    voucherResult.style.color = 'red';
    console.error('[Voucher Error]', err);
    
  } finally {
    await window.__updateSummary();
  }
});

// === Render Summary ===
async function renderSummary(){
  if(!summaryEl) return;
  
  const items = getCart();
  const subtotal = calcSubtotal(items);
  const original_ship_fee = chosen?.fee ?? Number(localStorage.getItem('ship_fee')||0);
  const ship_name = chosen?.name ?? (localStorage.getItem('ship_name')||'Chưa chọn');
  const ship_eta = chosen?.eta ?? (localStorage.getItem('ship_eta')||'');
  
  // ✅ FIX: Tính toán giảm giá ship ĐÚNG CÁCH (chọn mức tốt nhất, không cộng dồn)
  const auto_freeship_discount = await calculateAutoFreeshipDiscount(subtotal, original_ship_fee);
  const manual_product_discount = Number(localStorage.getItem('voucher_discount')||0);
  const manual_ship_discount = Number(localStorage.getItem('voucher_ship_discount')||0);

  // Chọn mức giảm giá ship TỐT NHẤT (không cộng dồn)
  const best_ship_discount = Math.max(auto_freeship_discount, manual_ship_discount);
  const final_ship_fee = Math.max(0, original_ship_fee - best_ship_discount);

  // Xác định voucher nào đang được áp dụng
  const isAutoFreeshipApplied = best_ship_discount > 0 && auto_freeship_discount >= manual_ship_discount;
  const isManualShipApplied = best_ship_discount > 0 && manual_ship_discount > auto_freeship_discount;
  
  // Tính tổng
  const total = Math.max(0, subtotal - manual_product_discount + final_ship_fee);

  // Render items
  const itemsHtml = items.map(it=>`
    <div class="flex justify-between text-sm py-1">
      <div class="w-2/3 pr-2">
        ${it.name}${it.variant?` - ${it.variant}`:''} 
        <span class="text-gray-500">×${it.qty}</span>
      </div>
      <div class="text-right font-medium">${formatPrice(Number(it.price||0)*Number(it.qty||1))}</div>
    </div>
  `).join('') || '<div class="text-sm text-gray-500">Giỏ hàng trống.</div>';

  summaryEl.innerHTML = `
  <div class="space-y-3">
    <div>
      <div class="font-semibold mb-1">Địa chỉ nhận hàng</div>
      <div class="text-sm">
        ${document.getElementById('name')?.value || '-'} 
        ${document.getElementById('phone')?.value ? `• ${document.getElementById('phone')?.value}` : ''}
      </div>
      <div class="text-sm">${document.getElementById('address')?.value || '-'}</div>
    </div>

    <div>
      <div class="font-semibold mb-1">Thông tin sản phẩm</div>
      ${itemsHtml}
    </div>

    <div>
      <div class="font-semibold mb-1">Vận chuyển</div>
      <div class="text-sm">Khối lượng: ${toHumanWeight(calcWeight(items))}</div>
      <div class="text-sm">${ship_name}${ship_eta?` • ${ship_eta}`:''}</div>
    </div>

    <div class="border-t pt-2 text-sm space-y-1">
      <div class="flex justify-between"><span>Tổng tiền hàng</span><span>${formatPrice(subtotal)}</span></div>
      
      <div class="flex justify-between">
        <span>Phí vận chuyển</span>
        <span>
          ${best_ship_discount > 0 ? `<span class="line-through opacity-60 mr-2">${formatPrice(original_ship_fee)}</span>` : ''}
          ${formatPrice(final_ship_fee)}
        </span>
      </div>

      ${isAutoFreeshipApplied ? `
        <div class="flex justify-between text-emerald-600">
          <span>🎁 Miễn ship tự động (${applicableFreeshipVoucher.code})</span>
          <span>-${formatPrice(auto_freeship_discount)}</span>
        </div>
      ` : ''}

      ${manual_product_discount > 0 ? `
        <div class="flex justify-between text-emerald-600">
          <span>🎟️ Giảm giá sản phẩm (Mã)</span>
          <span>-${formatPrice(manual_product_discount)}</span>
        </div>
      ` : ''}

      ${isManualShipApplied ? `
        <div class="flex justify-between text-emerald-600">
          <span>🎟️ Giảm phí ship (Mã)</span>
          <span>-${formatPrice(manual_ship_discount)}</span>
        </div>
      ` : ''}
      
      <div class="flex justify-between font-semibold text-base mt-2 pt-2 border-t">
        <span>Tổng thanh toán</span>
        <span class="text-blue-600">${formatPrice(total)}</span>
      </div>
    </div>
  </div>`;
}

// === Place Order ===
orderBtn?.addEventListener('click', async () => {
  const btn = orderBtn;
  if(!guardSubmit(btn)) return;
  
  orderResult.textContent = '';
  orderResult.style.color = '';
  
  try{
    const cart = getCart();
    if(!cart.length){ 
      orderResult.textContent='Giỏ hàng trống.'; 
      orderResult.style.color='red';
      return releaseSubmit(btn); 
    }
    
    const name = document.getElementById('name')?.value?.trim() || '';
    const phone = document.getElementById('phone')?.value?.trim() || '';
    const address = document.getElementById('address')?.value?.trim() || '';
    
    if(!name || !phone || !address){ 
      orderResult.textContent='Vui lòng điền đầy đủ Họ tên, SĐT, Địa chỉ.'; 
      orderResult.style.color='red';
      return releaseSubmit(btn); 
    }
    
    if(!VN_PHONE_RE.test(phone)){ 
      orderResult.textContent='SĐT không hợp lệ (VD: 0912345678).'; 
      orderResult.style.color='red';
      return releaseSubmit(btn); 
    }

    // ✅ Validate shipping provider
    const ship_provider = chosen?.provider || localStorage.getItem('ship_provider') || '';
    if (!ship_provider) {
      orderResult.textContent='Vui lòng chọn đơn vị vận chuyển.';
      orderResult.style.color='red';
      return releaseSubmit(btn);
    }

    // Tính toán lại totals (để đảm bảo đúng)
    const subtotal = calcSubtotal(cart);
    const original_ship_fee = chosen?.fee ?? Number(localStorage.getItem('ship_fee')||0);
    const auto_freeship_discount = await calculateAutoFreeshipDiscount(subtotal, original_ship_fee);
    const manual_product_discount = Number(localStorage.getItem('voucher_discount')||0);
    const manual_ship_discount = Number(localStorage.getItem('voucher_ship_discount')||0);
    const best_ship_discount = Math.max(auto_freeship_discount, manual_ship_discount);

    const body = {
      customer: { 
        name, 
        phone, 
        address,
        province: document.getElementById('province')?.value||'',
        district: document.getElementById('district')?.value||'',
        commune: document.getElementById('ward')?.value||''
      },
      items: cart.map(it=>({ 
        id: it.id||it.sku||'', 
        sku: it.sku||it.id||'', 
        name: it.name, 
        qty: Number(it.qty||1), 
        price: Number(it.price||0), 
        cost: Number(it.cost||0||null), 
        weight_grams: Number(it.weight_gram||it.weight_grams||it.weight||0) 
      })),
      note: document.getElementById('note')?.value || '',
      shipping: { 
        provider: ship_provider, 
        service_code: (chosen?.service_code || localStorage.getItem('ship_service') || '') 
      },
      totals: { 
        shipping_fee: Number(original_ship_fee||0), 
        discount: manual_product_discount, 
        shipping_discount: best_ship_discount 
      },
      source: 'website',
      status: 'placed'
    };
    
    console.log('[INV-TRACE] FE.checkout: createOrder payload', body);
    
    const res = await api('/api/orders', {
      method: 'POST',
      headers: {
        'Idempotency-Key': (
          localStorage.getItem('idem_order') ||
          (() => {
            const v = 'idem-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
            localStorage.setItem('idem_order', v);
            return v;
          })()
        )
      },
      body
    });
    
    console.log('[INV-TRACE] FE.checkout: createOrder response', res);

    if (res && (res.id || res.success || res.status === 'ok')) {
      orderResult.textContent = `✓ Đặt hàng thành công! Mã đơn: ${res.id || ''}`;
      orderResult.style.color = 'green';
      
      // Xóa giỏ hàng
      ['cart', 'CART', 'shv_cart_v1', 'shv_cart', 'shv_cart_items'].forEach(k => localStorage.removeItem(k));
      localStorage.setItem('cart_cleared', Date.now().toString());
      window.dispatchEvent(new Event('shv:cart-changed'));

      // Xóa idempotency key cũ
      localStorage.removeItem('idem_order');
      
      // Cập nhật UI
      await renderSummary();
      if (document.getElementById('cart-list')) {
        document.getElementById('cart-list').innerHTML = '<div class="p-4 text-sm">Giỏ hàng trống.</div>';
      }
      
      // Optional: Redirect sau 2s
      // setTimeout(() => window.location.href = '/', 2000);

    } else {
      orderResult.textContent = '✗ ' + (res.message || 'Không tạo được đơn hàng. Vui lòng thử lại.');
      orderResult.style.color = 'red';
    }
    
  } catch(e) {
    console.error('[Place Order Error]', e);
    orderResult.textContent = '✗ Có lỗi xảy ra: ' + (e.message || 'Vui lòng thử lại.');
    orderResult.style.color = 'red';
  } finally {
    releaseSubmit(btn);
  }
});

// === Event Listeners ===
quoteBtn?.addEventListener('click', async () => { await fetchAndRenderQuote(); });

['name','phone','address'].forEach(id=>{
  document.getElementById(id)?.addEventListener('input', async () => {
    await renderSummary();
  });
});

['province','district','ward'].forEach(id=>{
  const elem = document.getElementById(id);
  if(elem){ 
    elem.addEventListener('change', async () => {
      await fetchAndRenderQuote();
    });
  }
});

window.addEventListener('storage', async () => { await renderSummary(); });

document.addEventListener('DOMContentLoaded', async () => { 
  await renderSummary();
  await fetchAndRenderQuote();
});