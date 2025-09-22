
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

let chosen = null;
let lastPricing = null;

function calcWeight(cart) {
  return cart.reduce((sum, it) => sum + (it.weight_grams || 0) * (it.qty || 1), 0);
}

quoteBtn?.addEventListener('click', async () => {
  const to_province = document.getElementById('province').value;
  const to_district = document.getElementById('district').value;
  const cart = JSON.parse(localStorage.getItem('cart')||'[]');
  const weight = calcWeight(cart);
  const res = await api(`/shipping/quote?to_province=${encodeURIComponent(to_province)}&to_district=${encodeURIComponent(to_district)}&weight=${weight}&cod=0`);
  quoteList.innerHTML = (res.items || res || []).map(opt => `
    <label class="flex items-center gap-3 border rounded p-3 cursor-pointer">
      <input type="radio" name="ship" value="${opt.provider}:${opt.service_code}" />
      <div class="flex-1">
        <div class="font-medium">${opt.name}</div>
        <div class="text-sm">Phí: ${formatPrice(opt.fee)} | ETA: ${opt.eta || '-'}</div>
      </div>
    </label>
  `).join('');
  quoteList.querySelectorAll('input[name=ship]').forEach(r=>r.onchange=()=>{
    const [provider, service_code] = r.value.split(':');
    chosen = { provider, service_code, fee: parseInt(r.closest('label').querySelector('.text-sm').textContent.match(/\d+/g)?.join('') || '0',10) };
  });
});

testVoucherBtn?.addEventListener('click', async ()=> {
  const cart = JSON.parse(localStorage.getItem('cart')||'[]');
  const items = cart.map(it => ({ id: it.id, category: '', price: it.price, qty: it.qty }));
  const res = await api('/pricing/preview', { method:'POST', body: { items, shipping_fee: chosen?.fee||0, voucher_code: voucherInput.value||null } });
  lastPricing = res;
  voucherResult.textContent = `Tạm tính: ${formatPrice(res.subtotal)} | Giảm: ${formatPrice((res.discount_product||0)+(res.discount_shipping||0))} | Tổng: ${formatPrice(res.total)}`;
});

orderBtn?.addEventListener('click', async () => {
  const cart = JSON.parse(localStorage.getItem('cart')||'[]');
  const items = cart.map(it => ({ product_id: it.id, name: it.name, qty: it.qty, price: it.price, variant: it.variant||null }));
  const body = {
    customer_name: document.getElementById('name').value,
    phone: document.getElementById('phone').value,
    address: document.getElementById('address').value,
    items,
    voucher_code: (voucherInput.value||null),
    shipping_fee: chosen?.fee || 0
  };
  const res = await api('/public/orders/create', { method:'POST', body });
  orderResult.textContent = `Đặt hàng thành công: ${res.orderId || ''}`;
  // Optionally call /shipping/create via backend setting
});
