//location.replace('/'); // disabled redirect
import { formatPrice } from './lib/price.js';

const list = document.getElementById('cart-list');

function render() {
  const cart = JSON.parse(localStorage.getItem('cart')||'[]');
  if (!cart.length) { 
    list.innerHTML = '<div class="p-4 text-sm">Giỏ hàng trống.</div>'; 
    localStorage.setItem('cart_weight_gram', '0'); 
    return; 
  }
  let total = 0;
  let weightTotal = 0;
  list.innerHTML = cart.map((it, idx) => {
    total += Number(it.price||0) * Number(it.qty||1);
    weightTotal += Number(it.weight_gram || it.weight_grams || it.weight || 0) * Number(it.qty||1);
    const vname = (it.variantName || it.variant || '');
    return `<div class="flex items-center justify-between p-3 border-b">
      <div class="text-sm w-2/3">
        <div class="font-medium">${it.name}${vname?` - ${vname}`:''}</div>
        <div>${formatPrice(it.price)} x ${it.qty}</div>
      </div>
      <div class="flex items-center gap-2">
        <button data-i="${idx}" class="dec border rounded px-2">-</button>
        <button data-i="${idx}" class="inc border rounded px-2">+</button>
        <button data-i="${idx}" class="rm border rounded px-2">X</button>
      </div>
    </div>`;
  }).join('') + `<div class="p-3 text-right font-semibold">Tạm tính: ${formatPrice(total)}</div>`;

  localStorage.setItem('cart_weight_gram', String(weightTotal));

list.querySelectorAll('.dec').forEach(b=>b.onclick=()=>changeQty(+b.dataset.i,-1));
  list.querySelectorAll('.inc').forEach(b=>b.onclick=()=>changeQty(+b.dataset.i,1));
  list.querySelectorAll('.rm').forEach(b=>b.onclick=()=>remove(+b.dataset.i));
}
function changeQty(i, d){ const cart = JSON.parse(localStorage.getItem('cart')||'[]'); cart[i].qty=Math.max(1,(cart[i].qty||1)+d); localStorage.setItem('cart',JSON.stringify(cart)); render(); }
function remove(i){ const cart = JSON.parse(localStorage.getItem('cart')||'[]'); cart.splice(i,1); localStorage.setItem('cart',JSON.stringify(cart)); render(); }

render();
