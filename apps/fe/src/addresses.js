// addresses.js – Trang riêng quản lý/chọn địa chỉ cho FE
const API = 'https://api.shophuyvan.vn/api/addresses';
const LS_SELECTED = 'address:selected';

const $ = (id) => document.getElementById(id);
const qs = (s, p = document) => p.querySelector(s);
const ce = (t, props = {}) => Object.assign(document.createElement(t), props);

const state = {
  list: [],
  editing: null,   // object địa chỉ đang sửa, hoặc null khi thêm mới
  returnUrl: new URLSearchParams(location.search).get('return') || '/checkout',
};

init().catch(console.error);

async function init() {
  // nút quay lại
  $('btn-back').onclick = () => (location.href = state.returnUrl);

  // dán & nhập nhanh
  $('btn-paste').onclick = pasteSmart;

  // thêm mới
  $('btn-add').onclick = () => openForm(null);

  // form buttons
  $('btn-cancel').onclick = () => closeForm();
  $('btn-save').onclick = saveForm;
  $('btn-delete').onclick = removeCurrent;

  await loadList();
  renderList();
}

async function loadList() {
  try {
    const r = await fetch(API, { credentials: 'include' });
    const j = await r.json();
    state.list = Array.isArray(j?.data) ? j.data : (j?.items || []);
  } catch (e) {
    console.error('[addresses] loadList failed', e);
    state.list = [];
  }
}

function renderList() {
  const wrap = $('addr-list');
  wrap.innerHTML = '';
  $('addr-empty').style.display = state.list.length ? 'none' : '';

  state.list.forEach((a) => {
    const card = ce('div', { className: 'card', style: 'padding:12px' });

    const top = ce('div', { className: 'row', style: 'justify-content:space-between;align-items:center' });
    const name = ce('div', { innerHTML: `<b>${esc(a.name)}</b> <span class="muted">| ${esc(a.phone)}</span>` });
    const badge = a.is_default ? ce('span', { className: 'muted', innerText: 'Mặc định' }) : null;
    top.appendChild(name);
    if (badge) top.appendChild(badge);

    const addr = ce('div', { className: 'muted', style: 'margin:6px 0 10px 0' });
    addr.innerText = [
      a.address,
      a.ward_name, a.district_name, a.province_name
    ].filter(Boolean).join(', ');

    const actions = ce('div', { className: 'row' });
    const btnUse = ce('button', { className: 'btn btn-primary', innerText: 'Dùng địa chỉ này' });
    const btnEdit = ce('button', { className: 'btn', innerText: 'Sửa' });

    btnUse.onclick = () => selectAddress(a);
    btnEdit.onclick = () => openForm(a);

    actions.append(btnUse, btnEdit);
    card.append(top, addr, actions);
    wrap.appendChild(card);
  });
}

function esc(s) { return String(s ?? '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }

function selectAddress(a) {
  try { localStorage.setItem(LS_SELECTED, JSON.stringify(a)); } catch {}
  location.href = state.returnUrl;
}

function openForm(a) {
  state.editing = a ? { ...a } : { name: '', phone: '', address: '', is_default: false };
  $('form-title').innerText = a ? 'Sửa địa chỉ' : 'Địa chỉ mới';
  $('f-name').value = state.editing.name || '';
  $('f-phone').value = state.editing.phone || '';
  $('f-address').value = state.editing.address || '';
  $('f-default').checked = !!state.editing.is_default;
  $('btn-delete').style.display = a?.id ? '' : 'none';

  $('form-wrap').style.display = '';
  // focus
  setTimeout(() => $('f-name').focus(), 0);
}

function closeForm() {
  state.editing = null;
  $('form-wrap').style.display = 'none';
}

async function saveForm() {
  const body = {
    id: state.editing?.id,
    name: $('f-name').value.trim(),
    phone: $('f-phone').value.trim(),
    address: $('f-address').value.trim(),
    is_default: $('f-default').checked,
  };
  if (!body.name || !body.phone || !body.address) {
    alert('Vui lòng nhập đủ Họ tên / SĐT / Địa chỉ');
    return;
  }

  try {
    const method = body.id ? 'PUT' : 'POST';
    const r = await fetch(API, {
      method,
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const j = await r.json();
    if (!j?.success && !j?.data) throw new Error('save failed');
    await loadList();
    renderList();
    closeForm();
  } catch (e) {
    console.error('[addresses] saveForm failed', e);
    alert('Lưu địa chỉ thất bại');
  }
}

async function removeCurrent() {
  if (!state.editing?.id) return;
  if (!confirm('Xoá địa chỉ này?')) return;
  try {
    const r = await fetch(API + '?id=' + encodeURIComponent(state.editing.id), {
      method: 'DELETE',
      credentials: 'include',
    });
    const j = await r.json();
    if (!j?.success) throw new Error('delete failed');
    await loadList();
    renderList();
    closeForm();
  } catch (e) {
    console.error('[addresses] removeCurrent failed', e);
    alert('Xoá địa chỉ thất bại');
  }
}

// --- Dán & nhập nhanh: tách tên/SĐT/địa chỉ từ clipboard ---
async function pasteSmart() {
  try {
    const text = await navigator.clipboard.readText();
    if (!text) return;

    const phone = (text.match(/(0|\+84)\d{8,11}/g) || [''])[0].replace(/\D/g, '').replace(/^84/, '0');
    const parts = text.split(phone);
    const maybeName = (parts[0] || '').trim();
    const after = (parts[1] || text).trim();

    // nếu đang sửa thì điền vào form; nếu chưa mở form → tạo mới
    if (!state.editing) openForm(null);
    $('f-name').value = $('f-name').value || maybeName;
    $('f-phone').value = $('f-phone').value || phone;
    $('f-address').value = $('f-address').value || after;
  } catch (e) {
    console.warn('Không đọc được clipboard:', e);
    alert('Trình duyệt không cấp quyền đọc Clipboard.');
  }
}
