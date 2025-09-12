import api from './lib/api.js';
const $ = s => document.querySelector(s);
const tabs = document.querySelectorAll('.tab[data-view]');
tabs.forEach(t => t.onclick = () => {
  tabs.forEach(x => x.dataset.active = 'false');
  t.dataset.active = 'true';
  document.querySelectorAll('[id^="view-"]').forEach(v => v.classList.add('hidden'));
  $('#view-' + t.dataset.view).classList.remove('hidden');
});

const tokenEl = $('#token');
const btnSaveToken = $('#saveToken');
tokenEl.value = localStorage.getItem('shv_token') || '';
btnSaveToken.onclick = () => { localStorage.setItem('shv_token', tokenEl.value.trim()); alert('Đã lưu token'); };

const bannerList = $('#bannerList');
$('#addBanner').onclick = () => addBannerRow({ image:'', href:'', text:'' });
$('#saveBanners').onclick = saveBanners;

function bannerRowHTML(b,i){
  return `
    <div class="row items-center bg-white/5 p-2 rounded group" data-i="${i}">
      <input placeholder="image (Cloudinary URL)" value="${b.image||''}">
      <input placeholder="href (tuỳ chọn)" value="${b.href||''}">
      <div class="flex items-center gap-2">
        <input class="w-[180px]" placeholder="text (tuỳ chọn)" value="${b.text||''}">
        <button class="px-2 py-1 bg-white/10 rounded remove">X</button>
      </div>
    </div>`;
}
function addBannerRow(b){ bannerList.insertAdjacentHTML('beforeend', bannerRowHTML(b, bannerList.children.length)); bindBannerEvents(); }
function bindBannerEvents(){
  bannerList.querySelectorAll('.remove').forEach(btn => btn.onclick = () => btn.closest('[data-i]').remove());
}
async function loadBanners(){
  try{
    const s = await api('/settings?key=banners');
    const list = Array.isArray(s?.value) ? s.value : (JSON.parse(localStorage.getItem('shv_banners')||'[]'));
    bannerList.innerHTML = '';
    list.forEach(addBannerRow);
    if (!list.length) addBannerRow({image:'',href:'',text:''});
  }catch{
    const list = JSON.parse(localStorage.getItem('shv_banners')||'[]');
    bannerList.innerHTML = '';
    list.forEach(addBannerRow);
    if (!list.length) addBannerRow({image:'',href:'',text:''});
  }
}
async function saveBanners(){
  const rows = [...bannerList.querySelectorAll('[data-i]')];
  const payload = rows.map(r=>{
    const [img, href] = r.querySelectorAll('input');
    const text = r.querySelector('div input:last-child');
    return { image: img.value.trim(), href: href.value.trim(), text: text.value.trim() };
  }).filter(x=>x.image);
  try{
    await api('/settings?key=banners', { method:'PUT', headers:{'content-type':'application/json'}, body: JSON.stringify({ key:'banners', value: payload }) });
    alert('Đã lưu banner lên server');
  }catch{
    localStorage.setItem('shv_banners', JSON.stringify(payload));
    alert('Server chưa hỗ trợ /settings — đã lưu tạm vào localStorage');
  }
}

const voucherList = $('#voucherList');
$('#addVoucher').onclick = () => addVoucherRow({ code:'', type:'percent', value:10, min_order:0, applies_to:'all', expiry:'' });
$('#saveVouchers').onclick = saveVouchers;

function voucherRowHTML(v, i){
  return `
    <div class="grid grid-cols-6 gap-2 bg-white/5 p-2 rounded items-center" data-i="${i}">
      <input placeholder="CODE" value="${v.code||''}">
      <select>
        <option value="percent" ${v.type==='percent'?'selected':''}>percent</option>
        <option value="fixed" ${v.type==='fixed'?'selected':''}>fixed</option>
        <option value="freeship" ${v.type==='freeship'?'selected':''}>freeship</option>
      </select>
      <input placeholder="value" value="${v.value ?? ''}">
      <input placeholder="min_order" value="${v.min_order ?? 0}">
      <input placeholder="applies_to (all | product_id)" value="${v.applies_to || 'all'}">
      <div class="flex items-center gap-2">
        <input class="w-[150px]" placeholder="expiry (yyyy-mm-dd)" value="${v.expiry||''}">
        <button class="px-2 py-1 bg-white/10 rounded remove">X</button>
      </div>
    </div>`;
}
function addVoucherRow(v){ voucherList.insertAdjacentHTML('beforeend', voucherRowHTML(v, voucherList.children.length)); bindVoucherEvents(); }
function bindVoucherEvents(){
  voucherList.querySelectorAll('.remove').forEach(btn => btn.onclick = () => btn.closest('[data-i]').remove());
}
async function loadVouchers(){
  try{
    const s = await api('/settings?key=vouchers');
    const list = Array.isArray(s?.value) ? s.value : (JSON.parse(localStorage.getItem('shv_vouchers')||'[]'));
    voucherList.innerHTML = '';
    list.forEach(addVoucherRow);
    if (!list.length) addVoucherRow({ code:'', type:'percent', value:10, min_order:0, applies_to:'all', expiry:'' });
  }catch{
    const list = JSON.parse(localStorage.getItem('shv_vouchers')||'[]');
    voucherList.innerHTML = '';
    list.forEach(addVoucherRow);
    if (!list.length) addVoucherRow({ code:'', type:'percent', value:10, min_order:0, applies_to:'all', expiry:'' });
  }
}
async function saveVouchers(){
  const rows = [...voucherList.querySelectorAll('[data-i]')];
  const payload = rows.map(r=>{
    const [codeEl,typeEl,valueEl,minEl,applyEl,expEl] = r.querySelectorAll('input,select');
    return {
      code: (codeEl.value||'').trim().toUpperCase(),
      type: typeEl.value,
      value: +valueEl.value || 0,
      min_order: +minEl.value || 0,
      applies_to: (applyEl.value||'all').trim(),
      expiry: expEl.value.trim()
    };
  }).filter(x=>x.code);
  try{
    await api('/settings?key=vouchers', { method:'PUT', headers:{'content-type':'application/json'}, body: JSON.stringify({ key:'vouchers', value: payload }) });
    alert('Đã lưu voucher lên server');
  }catch{
    localStorage.setItem('shv_vouchers', JSON.stringify(payload));
    alert('Server chưa hỗ trợ /settings — đã lưu tạm vào localStorage');
  }
}
(async function(){ await loadBanners(); await loadVouchers(); })();
