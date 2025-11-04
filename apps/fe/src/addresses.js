// addresses.js – Trang riêng quản lý/chọn địa chỉ cho FE
const API = 'https://api.shophuyvan.vn/api/addresses';
const LS_SELECTED = 'address:selected';
const PROVINCE_API = 'https://provinces.open-api.vn/api';

const $ = (id) => document.getElementById(id);
const qs = (s, p = document) => p.querySelector(s);
const ce = (t, props = {}) => Object.assign(document.createElement(t), props);

const state = {
  list: [],
  editing: null,
  returnUrl: new URLSearchParams(location.search).get('return') || '/checkout',
  provinces: [],
  districts: [],
  wards: [],
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

  // địa chỉ dropdowns
  $('f-province').onchange = handleProvinceChange;
  $('f-district').onchange = handleDistrictChange;

  // load tỉnh/thành phố
  await loadProvinces();
  await loadList();
  renderList();
}

// === API Địa chỉ Việt Nam ===
async function loadProvinces() {
  try {
    const r = await fetch(`${PROVINCE_API}/p/`);
    state.provinces = await r.json();
    renderProvinceOptions();
  } catch (e) {
    console.error('Load provinces failed', e);
  }
}

async function handleProvinceChange() {
  const code = $('f-province').value;
  state.districts = [];
  state.wards = [];
  
  $('f-district').disabled = true;
  $('f-ward').disabled = true;
  $('f-district').innerHTML = '<option value="">Chọn Quận/Huyện *</option>';
  $('f-ward').innerHTML = '<option value="">Chọn Phường/Xã *</option>';
  
  if (!code) return;
  
  try {
    const r = await fetch(`${PROVINCE_API}/p/${code}?depth=2`);
    const data = await r.json();
    state.districts = data.districts || [];
    renderDistrictOptions();
    $('f-district').disabled = false;
  } catch (e) {
    console.error('Load districts failed', e);
  }
}

async function handleDistrictChange() {
  const code = $('f-district').value;
  state.wards = [];
  
  $('f-ward').disabled = true;
  $('f-ward').innerHTML = '<option value="">Chọn Phường/Xã *</option>';
  
  if (!code) return;
  
  try {
    const r = await fetch(`${PROVINCE_API}/d/${code}?depth=2`);
    const data = await r.json();
    state.wards = data.wards || [];
    renderWardOptions();
    $('f-ward').disabled = false;
  } catch (e) {
    console.error('Load wards failed', e);
  }
}

function renderProvinceOptions() {
  const sel = $('f-province');
  sel.innerHTML = '<option value="">Chọn Tỉnh/Thành phố *</option>';
  state.provinces.forEach(p => {
    sel.appendChild(ce('option', { value: p.code, innerText: p.name }));
  });
}

function renderDistrictOptions() {
  const sel = $('f-district');
  sel.innerHTML = '<option value="">Chọn Quận/Huyện *</option>';
  state.districts.forEach(d => {
    sel.appendChild(ce('option', { value: d.code, innerText: d.name }));
  });
}

function renderWardOptions() {
  const sel = $('f-ward');
  sel.innerHTML = '<option value="">Chọn Phường/Xã *</option>';
  state.wards.forEach(w => {
    sel.appendChild(ce('option', { value: w.code, innerText: w.name }));
  });
}

// === Quản lý danh sách địa chỉ ===
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

async function openForm(a) {
  state.editing = a ? { ...a } : { 
    name: '', 
    phone: '', 
    address: '', 
    province_code: '',
    district_code: '',
    ward_code: '',
    is_default: false 
  };
  
  $('form-title').innerText = a ? 'Sửa địa chỉ' : 'Địa chỉ mới';
  $('f-name').value = state.editing.name || '';
  $('f-phone').value = state.editing.phone || '';
  $('f-address').value = state.editing.address || '';
  $('f-default').checked = !!state.editing.is_default;
  $('btn-delete').style.display = a?.id ? '' : 'none';

  // Reset dropdowns
  $('f-province').value = '';
  $('f-district').innerHTML = '<option value="">Chọn Quận/Huyện *</option>';
  $('f-ward').innerHTML = '<option value="">Chọn Phường/Xã *</option>';
  $('f-district').disabled = true;
  $('f-ward').disabled = true;

  // Nếu đang sửa và có sẵn mã tỉnh/quận/phường
  if (a?.province_code) {
    $('f-province').value = a.province_code;
    await handleProvinceChange();
    
    if (a?.district_code) {
      $('f-district').value = a.district_code;
      await handleDistrictChange();
      
      if (a?.ward_code) {
        $('f-ward').value = a.ward_code;
      }
    }
  }

  $('form-wrap').style.display = '';
  setTimeout(() => $('f-name').focus(), 0);
}

function closeForm() {
  state.editing = null;
  $('form-wrap').style.display = 'none';
}

async function saveForm() {
  const provinceCode = $('f-province').value;
  const districtCode = $('f-district').value;
  const wardCode = $('f-ward').value;
  
  const body = {
    id: state.editing?.id,
    name: $('f-name').value.trim(),
    phone: $('f-phone').value.trim(),
    address: $('f-address').value.trim(),
    province_code: provinceCode,
    district_code: districtCode,
    ward_code: wardCode,
    province_name: state.provinces.find(p => p.code == provinceCode)?.name || '',
    district_name: state.districts.find(d => d.code == districtCode)?.name || '',
    ward_name: state.wards.find(w => w.code == wardCode)?.name || '',
    is_default: $('f-default').checked,
  };
  
  if (!body.name || !body.phone || !body.address || !provinceCode || !districtCode || !wardCode) {
    alert('Vui lòng nhập đủ thông tin (Họ tên, SĐT, Tỉnh/Quận/Phường, Địa chỉ cụ thể)');
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
    if (!state.editing) await openForm(null);
    $('f-name').value = $('f-name').value || maybeName;
    $('f-phone').value = $('f-phone').value || phone;
    $('f-address').value = $('f-address').value || after;
  } catch (e) {
    console.warn('Không đọc được clipboard:', e);
    alert('Trình duyệt không cấp quyền đọc Clipboard.');
  }
}