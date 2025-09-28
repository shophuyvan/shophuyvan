//location.replace('/'); // disabled redirect
import { formatPrice } from './lib/price.js';

const list = document.getElementById('cart-list');

function render() {
  const cart = JSON.parse(localStorage.getItem('cart')||'[]');
  if (!cart.length) { list.innerHTML = '<div class="p-4 text-sm">Giỏ hàng trống.</div>'; return; }
  let total = 0;
  list.innerHTML = cart.map((it, idx) => {
    total += it.price*it.qty;
    return `<div class="flex items-center justify-between p-3 border-b">
      <div class="text-sm w-2/3">
        <div class="font-medium">${it.name}${it.variant?` - ${it.variant}`:''}</div>
        <div>${formatPrice(it.price)} x ${it.qty}</div>
      </div>
      <div class="flex items-center gap-2">
        <button data-i="${idx}" class="dec border rounded px-2">-</button>
        <button data-i="${idx}" class="inc border rounded px-2">+</button>
        <button data-i="${idx}" class="rm border rounded px-2">X</button>
      </div>
    </div>`;
  }).join('') + `<div class="p-3 text-right font-semibold">Tạm tính: ${formatPrice(total)}</div>`;

  list.querySelectorAll('.dec').forEach(b=>b.onclick=()=>changeQty(+b.dataset.i,-1));
  list.querySelectorAll('.inc').forEach(b=>b.onclick=()=>changeQty(+b.dataset.i,1));
  list.querySelectorAll('.rm').forEach(b=>b.onclick=()=>remove(+b.dataset.i));
}
function changeQty(i, d){ const cart = JSON.parse(localStorage.getItem('cart')||'[]'); cart[i].qty=Math.max(1,(cart[i].qty||1)+d); localStorage.setItem('cart',JSON.stringify(cart)); render(); }
function remove(i){ const cart = JSON.parse(localStorage.getItem('cart')||'[]'); cart.splice(i,1); localStorage.setItem('cart',JSON.stringify(cart)); render(); }

render();
