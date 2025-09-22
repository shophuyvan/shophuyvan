const API = "https://shv-api.shophuyvan.workers.dev/products";

const q  = document.getElementById("q");
const rows = document.getElementById("rows");
const btnReload = document.getElementById("btn-upload");

function tr(p){
  const img = (p.images||[])[0];
  const price = (Number(p.sale_price || p.price || 0)).toLocaleString("vi-VN");
  const slug = p.slug || "";
  return `<tr>
    <td><img class="row-img" src="${img}" loading="lazy" alt="${p.title}"></td>
    <td>
      <div class="row-title">${p.title}</div>
      <div class="row-sub">${p.sku || ""}</div>
    </td>
    <td>${price ? price + "đ" : "0đ"}</td>
    <td class="row-sub">${slug}</td>
    <td class="action">
      <a class="icon" title="Xem" target="_blank" href="/product/${encodeURIComponent(slug||p.id)}">👁</a>
      <a class="icon" title="Sửa" href="/admin/product-edit.html?id=${encodeURIComponent(p.id)}">✏️</a>
    </td>
  </tr>`;
}

let all = [];
async function load(){
  rows.innerHTML = `<tr><td colspan="5" class="muted">Đang tải…</td></tr>`;
  try{
    const r = await fetch(API, { headers: { "accept":"application/json" }});
    const data = await r.json();
    all = Array.isArray(data) ? data : (data.items || []);
    render(all);
  }catch(e){
    rows.innerHTML = `<tr><td colspan="5" class="muted">Không tải được dữ liệu</td></tr>`;
  }
}

function render(list){
  if(!list.length){ rows.innerHTML = `<tr><td colspan="5" class="muted">Không có dữ liệu</td></tr>`; return; }
  rows.innerHTML = list.map(tr).join("");
}

q?.addEventListener("input", () => {
  const k = q.value.trim().toLowerCase();
  const f = !k ? all : all.filter(p => {
    const s = `${p.title||""} ${p.slug||""} ${p.sku||""}`.toLowerCase();
    return s.includes(k);
  });
  render(f);
});
btnReload?.addEventListener("click", load);

document.readyState !== "loading" ? load() : document.addEventListener("DOMContentLoaded", load);
