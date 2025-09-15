import { api } from './lib/api.js';
import { formatPrice } from './lib/price.js';

const voucherInput = document.getElementById('voucher');
const applyBtn = document.getElementById('apply-voucher');
const resultEl = document.getElementById('voucher-result');
const summaryEl = document.getElementById('cart-summary');

function getCart(){ try{ return JSON.parse(localStorage.getItem('cart')||'[]'); }catch{return [];} }
function subtotal(items){ return (items||[]).reduce((s, it)=> s + (Number(it.price||0) * Number(it.qty||1)), 0); }

async function applyVoucher(){
  const code = (voucherInput?.value||'').trim();
  if (!code) { resultEl.textContent = 'Nhập mã voucher'; return; }
  const items = getCart();
  const ship_fee = Number(localStorage.getItem('ship_fee')||0);
  const r = await api('/cart/apply-voucher', { method:'POST', body: JSON.stringify({ code, items, shipping_fee: ship_fee }) });
  const data = await r.json();
  if (!r.ok || data.error){ resultEl.textContent = 'Mã không hợp lệ hoặc hết hạn'; return; }
  const sub = subtotal(items);
  const discount = Number(data.discount||0);
  const shipDiscount = Number(data.ship_discount||0);
  const total = sub - discount + Math.max(0, ship_fee - shipDiscount);
  resultEl.innerHTML = `Giảm: -${formatPrice(discount)} ${shipDiscount?`(Freeship: -${formatPrice(shipDiscount)})`:''}`;
  if (summaryEl) summaryEl.innerHTML = `<div>Tạm tính: ${formatPrice(sub)}</div><div>Giảm giá: -${formatPrice(discount)}</div><div>Phí ship: ${formatPrice(Math.max(0, ship_fee - shipDiscount))}</div><div class="font-semibold mt-1">Tổng: ${formatPrice(total)}</div>`;
  localStorage.setItem('voucher_code', code);
  localStorage.setItem('voucher_discount', String(discount));
  localStorage.setItem('voucher_ship_discount', String(shipDiscount));
}
applyBtn?.addEventListener('click', applyVoucher);
