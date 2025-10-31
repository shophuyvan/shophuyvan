//location.replace('/'); // disabled redirect
import { formatPrice } from './lib/price.js';

const list = document.getElementById('cart-list');

function getSelectedIds(cart){
  // ưu tiên id biến thể; fallback theo chỉ số
  const saved = JSON.parse(localStorage.getItem('cart_selected_ids')||'null');
  if (Array.isArray(saved) && saved.length) return new Set(saved.map(String));
  // mặc định chọn tất cả khi lần đầu
  return new Set(cart.map(it => String(it.id ?? 'idx:' + Math.random())));
}

function render() {
  const cart = JSON.parse(localStorage.getItem('cart')||'[]');
  if (!cart.length) { 
    list.innerHTML = '<div class="p-4 text-sm">Giỏ hàng trống.</div>'; 
    localStorage.setItem('cart_weight_gram', '0'); 
    localStorage.removeItem('cart_selected_ids');
    localStorage.removeItem('checkout_items');
    return; 
  }

  // === trạng thái chọn hiện tại ===
  const selected = getSelectedIds(cart);

  // === build UI từng dòng (thêm checkbox) ===
  let total = 0;
  let weightTotal = 0;

  list.innerHTML = cart.map((it, idx) => {
    const id = String(it.id ?? idx);
    const isOn = selected.has(id);
    if (isOn) {
      total += Number(it.price||0) * Number(it.qty||1);
      weightTotal += Number(it.weight_gram || it.weight_grams || it.weight || 0) * Number(it.qty||1);
    }
    const vname = (it.variantName || it.variant || '');
    return `<div class="flex items-center justify-between p-3 border-b">
      <label class="flex items-center gap-2 text-sm w-2/3">
        <input type="checkbox" class="sel" data-id="${id}" ${isOn?'checked':''}/>
        <div>
          <div class="font-medium">${it.name}${vname?` - ${vname}`:''}</div>
          <div>${formatPrice(it.price)} x ${it.qty}</div>
        </div>
      </label>
      <div class="flex items-center gap-2">
        <button data-i="${idx}" class="dec border rounded px-2">-</button>
        <button data-i="${idx}" class="inc border rounded px-2">+</button>
        <button data-i="${idx}" class="rm border rounded px-2">X</button>
      </div>
    </div>`;
  }).join('') + `<div class="p-3 text-right font-semibold">Tạm tính: ${formatPrice(total)}</div>`;

  // === lưu trạng thái phục vụ Checkout ===
  localStorage.setItem('cart_weight_gram', String(weightTotal));
  localStorage.setItem('cart_selected_ids', JSON.stringify(Array.from(selected)));

  // dựng danh sách item đã chọn để checkout.js dùng ngay
  const checkoutItems = cart.filter((it, idx) => selected.has(String(it.id ?? idx)));
  localStorage.setItem('checkout_items', JSON.stringify(checkoutItems));

  // === gắn sự kiện ===
  list.querySelectorAll('.dec').forEach(b=>b.onclick=()=>changeQty(+b.dataset.i,-1));
  list.querySelectorAll('.inc').forEach(b=>b.onclick=()=>changeQty(+b.dataset.i,1));
  list.querySelectorAll('.rm').forEach(b=>b.onclick=()=>remove(+b.dataset.i));
  list.querySelectorAll('.sel').forEach(ch=>{
    ch.onchange = () => {
      const id = ch.getAttribute('data-id');
      const next = new Set(getSelectedIds(cart));
      if (ch.checked) next.add(id); else next.delete(id);
      localStorage.setItem('cart_selected_ids', JSON.stringify(Array.from(next)));
      render(); // re-calc total + weight theo chọn mới
    };
  });

  // nếu có nút thanh toán ở FE: tự gắn handler lưu checkout_items theo chọn
  const btn = document.getElementById('checkout-btn');
  if (btn) btn.onclick = () => {
    const latest = JSON.parse(localStorage.getItem('cart')||'[]');
    const picked = latest.filter((it, idx) => getSelectedIds(latest).has(String(it.id ?? idx)));
    localStorage.setItem('checkout_items', JSON.stringify(picked));
    // trang checkout.js sẽ đọc checkout_items + cart_weight_gram
    location.href = '/checkout';
  };
}

function changeQty(i, d){ const cart = JSON.parse(localStorage.getItem('cart')||'[]'); cart[i].qty=Math.max(1,(cart[i].qty||1)+d); localStorage.setItem('cart',JSON.stringify(cart)); render(); }
function remove(i){ const cart = JSON.parse(localStorage.getItem('cart')||'[]'); cart.splice(i,1); localStorage.setItem('cart',JSON.stringify(cart)); render(); }

render();
