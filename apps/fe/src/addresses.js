// addresses.js – Trang riêng quản lý/chọn địa chỉ cho FE
const API = 'https://api.shophuyvan.vn/api/addresses';
const LS_SELECTED = 'address:selected';
const PROVINCE_API = 'https://api.shophuyvan.vn/shipping';

// Helper: thêm header Authorization từ token đăng nhập
function buildAuthHeaders(extra = {}) {
  const token =
    localStorage.getItem('customer_token') ||
    localStorage.getItem('x-customer-token') ||
    localStorage.getItem('x-token');

  if (!token) return extra;

  return {
    ...extra,
    Authorization: `Bearer ${token}`,
    'x-customer-token': token,
  };
}


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
  $('btn-quick-input').onclick = quickAddressInput;

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

// === API Địa chỉ Việt Nam (SuperAI) ===
async function loadProvinces() {
  try {
    const r = await fetch(`${PROVINCE_API}/provinces`);
    const data = await r.json();
    state.provinces = data.items || data.data || [];
    renderProvinceOptions();
  } catch (e) {
    console.error('Load provinces failed', e);
    alert('Không thể tải danh sách Tỉnh/Thành phố. Vui lòng thử lại.');
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
    const r = await fetch(`${PROVINCE_API}/districts?province_code=${encodeURIComponent(code)}`);
    const data = await r.json();
    state.districts = data.items || data.data || [];
    renderDistrictOptions();
    $('f-district').disabled = false;
  } catch (e) {
    console.error('Load districts failed', e);
    alert('Không thể tải danh sách Quận/Huyện.');
  }
}

async function handleDistrictChange() {
  const code = $('f-district').value;
  state.wards = [];
  
  $('f-ward').disabled = true;
  $('f-ward').innerHTML = '<option value="">Chọn Phường/Xã *</option>';
  
  if (!code) return;
  
  try {
    const r = await fetch(`${PROVINCE_API}/wards?district_code=${encodeURIComponent(code)}`);
    const data = await r.json();
    state.wards = data.items || data.data || [];
    renderWardOptions();
    $('f-ward').disabled = false;
  } catch (e) {
    console.error('Load wards failed', e);
    alert('Không thể tải danh sách Phường/Xã.');
  }
}

function renderProvinceOptions() {
  const sel = $('f-province');
  sel.innerHTML = '<option value="">Chọn Tỉnh/Thành phố *</option>';
  state.provinces.forEach(p => {
    sel.appendChild(ce('option', { 
      value: p.code || p.province_id, 
      innerText: p.name || p.province_name 
    }));
  });
}

function renderDistrictOptions() {
  const sel = $('f-district');
  sel.innerHTML = '<option value="">Chọn Quận/Huyện *</option>';
  state.districts.forEach(d => {
    sel.appendChild(ce('option', { 
      value: d.code || d.district_id, 
      innerText: d.name || d.district_name 
    }));
  });
}

function renderWardOptions() {
  const sel = $('f-ward');
  sel.innerHTML = '<option value="">Chọn Phường/Xã *</option>';
  state.wards.forEach(w => {
    sel.appendChild(ce('option', { 
      value: w.code || w.ward_id, 
      innerText: w.name || w.ward_name 
    }));
  });
}

// === Quản lý danh sách địa chỉ ===
async function loadList() {
  try {
    const r = await fetch(API, {
      credentials: 'include',
      headers: buildAuthHeaders(),
    });
    
    // Nếu 401, có thể user chưa đăng nhập
    if (r.status === 401) {
      console.warn('User chưa đăng nhập');
      alert('Bạn cần đăng nhập để quản lý địa chỉ');
      location.href = '/login.html?return=' + encodeURIComponent(state.returnUrl || '/checkout');
      state.list = [];
      return;
    }

    
       const j = await r.json();

    // Nếu API chưa có (404 / Route not found) → coi như chưa có địa chỉ
    if (!r.ok) {
      const msg = String(j?.error || j?.message || '').toLowerCase();
      if (
        r.status === 404 ||
        msg.includes('route not found') ||
        msg.includes('not found')
      ) {
        state.list = [];
        return;
      }

      console.error('[addresses] loadList failed', j);
      state.list = [];
      return;
    }

    // Chuẩn hoá kiểu dữ liệu trả về từ backend
    state.list = Array.isArray(j?.data)
      ? j.data
      : (j?.items || j?.addresses || []);
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
  
  // Lấy tên từ dropdowns
  const provinceName = state.provinces.find(p => (p.code || p.province_id) == provinceCode)?.name || state.provinces.find(p => (p.code || p.province_id) == provinceCode)?.province_name || '';
  const districtName = state.districts.find(d => (d.code || d.district_id) == districtCode)?.name || state.districts.find(d => (d.code || d.district_id) == districtCode)?.district_name || '';
  const wardName = state.wards.find(w => (w.code || w.ward_id) == wardCode)?.name || state.wards.find(w => (w.code || w.ward_id) == wardCode)?.ward_name || '';
  
  const body = {
    id: state.editing?.id,
    name: $('f-name').value.trim(),
    phone: $('f-phone').value.trim(),
    address: $('f-address').value.trim(),
    province_code: provinceCode,
    district_code: districtCode,
    ward_code: wardCode,
    province_name: provinceName,
    district_name: districtName,
    ward_name: wardName,
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
      headers: buildAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(body),
    });
    
    if (r.status === 401) {
      alert('Bạn cần đăng nhập để lưu địa chỉ');
      location.href = '/login.html?return=' + encodeURIComponent(state.returnUrl || '/checkout');
      return;
    }

    
        const j = await r.json();
    if (!j?.ok && !j?.success && !j?.address && !j?.data) {
      throw new Error(j?.error || j?.message || 'save failed');
    }

    await loadList();
    renderList();
    closeForm();

  } catch (e) {
    console.error('[addresses] saveForm failed', e);
    alert('Lưu địa chỉ thất bại. Vui lòng thử lại.');
  }
}

async function removeCurrent() {
  if (!state.editing?.id) return;
  if (!confirm('Xoá địa chỉ này?')) return;
    try {
        const r = await fetch(`${API}/${encodeURIComponent(state.editing.id)}`, {
      method: 'DELETE',
      credentials: 'include',
      headers: buildAuthHeaders(),
    });
    
    if (r.status === 401) {
      alert('Bạn cần đăng nhập');
      location.href = '/login.html?return=' + encodeURIComponent(state.returnUrl || '/checkout');
      return;
    }

    const j = await r.json();
    if (!j?.ok && !j?.success) {
      throw new Error(j?.error || j?.message || 'delete failed');
    }
    
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

// === Quick Address Input - Phân tích địa chỉ thông minh ===
async function quickAddressInput() {
  const name = $('quick-name').value.trim();
  const phone = $('quick-phone').value.trim();
  const fullAddress = $('quick-address').value.trim();
  
  if (!name || !phone || !fullAddress) {
    alert('Vui lòng nhập đầy đủ thông tin');
    return;
  }
  
  // Mở form trước
  await openForm(null);
  
  // Điền thông tin cơ bản
  $('f-name').value = name;
  $('f-phone').value = phone;
  
  // Chuẩn hóa text (bỏ dấu, lower)
  const normalize = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  const addressNorm = normalize(fullAddress);
  
  // ===== BƯỚC 1: TÌM TỈNH/THÀNH PHỐ =====
  let foundProvince = false;
  let provinceName = '';
  
  // Map từ khóa viết tắt → tên đầy đủ để tìm trong dropdown
  const provinceMapping = {
    'hcm': ['ho chi minh', 'thanh pho ho chi minh', 'tp ho chi minh', 'sai gon'],
    'hn': ['ha noi', 'thanh pho ha noi'],
    'dn': ['da nang', 'thanh pho da nang'],
    'hp': ['hai phong', 'thanh pho hai phong'],
    'ct': ['can tho', 'thanh pho can tho']
  };
  
  // Tìm từ khóa viết tắt trước
  let searchTerms = [];
  for (const [abbr, fullNames] of Object.entries(provinceMapping)) {
    if (addressNorm.includes(abbr)) {
      searchTerms = fullNames;
      break;
    }
  }
  
  // Nếu không có viết tắt, thử tìm trực tiếp tên đầy đủ
  if (searchTerms.length === 0) {
    const allProvinces = [
      'ho chi minh', 'ha noi', 'da nang', 'hai phong', 'can tho', 'bien hoa', 'vung tau', 'nha trang',
      'bac giang', 'bac kan', 'bac lieu', 'bac ninh', 'ba ria', 'ben tre',
      'binh dinh', 'binh duong', 'binh phuoc', 'binh thuan', 'ca mau',
      'cao bang', 'dak lak', 'dak nong', 'dien bien', 'dong nai', 'dong thap',
      'gia lai', 'ha giang', 'ha nam', 'ha tinh', 'hai duong', 'hau giang',
      'hoa binh', 'hung yen', 'khanh hoa', 'kien giang', 'kon tum',
      'lai chau', 'lam dong', 'lang son', 'lao cai', 'long an',
      'nam dinh', 'nghe an', 'ninh binh', 'ninh thuan', 'phu tho', 'phu yen',
      'quang binh', 'quang nam', 'quang ngai', 'quang ninh', 'quang tri',
      'soc trang', 'son la', 'tay ninh', 'thai binh', 'thai nguyen',
      'thanh hoa', 'thua thien hue', 'tien giang', 'tra vinh', 'tuyen quang',
      'vinh long', 'vinh phuc', 'yen bai'
    ];
    
    for (const prov of allProvinces) {
      if (addressNorm.includes(prov)) {
        searchTerms = [prov];
        break;
      }
    }
  }
  
  // Tìm trong dropdown
  if (searchTerms.length > 0) {
    for (const term of searchTerms) {
      const provinceOption = Array.from($('f-province').options).find(opt => 
        normalize(opt.text).includes(term)
      );
      if (provinceOption) {
        $('f-province').value = provinceOption.value;
        provinceName = provinceOption.text;
        foundProvince = true;
        await handleProvinceChange();
        break;
      }
 }
  }
  
  if (!foundProvince) {
    alert('Không tìm thấy Tỉnh/Thành phố. Vui lòng chọn thủ công.');
    $('f-address').value = fullAddress;
    return;
  }
  
  // Đợi load xong districts
  await new Promise(r => setTimeout(r, 300));
  
  // ===== BƯỚC 2: TÌM QUẬN/HUYỆN =====
  let foundDistrict = false;
  let districtName = '';
  
  // Thử parse với từ khóa "quận", "huyện"
  let districtMatch = fullAddress.match(/(?:quan|q\.|huyen|h\.)\s*([a-zA-ZÀ-ỹ\s]+?)(?:\s|,|$)/i);
  
  if (!districtMatch) {
    // Không có từ khóa → thử match trực tiếp với danh sách quận
    const districtOptions = Array.from($('f-district').options).slice(1); // Bỏ option đầu
    for (const opt of districtOptions) {
      const optNorm = normalize(opt.text.replace(/^(quan|huyen|thi xa|thanh pho)\s+/i, ''));
      if (optNorm && addressNorm.includes(optNorm)) {
        $('f-district').value = opt.value;
        districtName = opt.text;
        foundDistrict = true;
        await handleDistrictChange();
        break;
      }
    }
  } else {
    const parsedDistrictName = normalize(districtMatch[1]);
    const districtOption = Array.from($('f-district').options).find(opt => 
      normalize(opt.text).includes(parsedDistrictName) || parsedDistrictName.includes(normalize(opt.text).replace(/^(quan|huyen)\s+/i, ''))
    );
    if (districtOption) {
      $('f-district').value = districtOption.value;
      districtName = districtOption.text;
      foundDistrict = true;
      await handleDistrictChange();
    }
  }
  
  if (!foundDistrict) {
    alert('Không tìm thấy Quận/Huyện. Vui lòng chọn thủ công.');
    $('f-address').value = fullAddress;
    return;
  }
  
  // Đợi load xong wards
  await new Promise(r => setTimeout(r, 300));
  
  // ===== BƯỚC 3: TÌM PHƯỜNG/XÃ =====
  let foundWard = false;
  let wardName = '';
  
  // Thử parse với từ khóa "phường", "xã"
  let wardMatch = fullAddress.match(/(?:phuong|p\.|xa|x\.|thi tran|tt\.)\s*([a-zA-ZÀ-ỹ\s0-9]+?)(?:\s|,|$)/i);
  
  if (!wardMatch) {
    // Không có từ khóa → thử match trực tiếp với danh sách phường
    const wardOptions = Array.from($('f-ward').options).slice(1);
    for (const opt of wardOptions) {
      const optNorm = normalize(opt.text.replace(/^(phuong|xa|thi tran)\s+/i, ''));
      if (optNorm && addressNorm.includes(optNorm)) {
        $('f-ward').value = opt.value;
        wardName = opt.text;
        foundWard = true;
        break;
      }
    }
  } else {
    const parsedWardName = normalize(wardMatch[1]);
    const wardOption = Array.from($('f-ward').options).find(opt => 
      normalize(opt.text).includes(parsedWardName) || parsedWardName.includes(normalize(opt.text).replace(/^(phuong|xa)\s+/i, ''))
    );
    if (wardOption) {
      $('f-ward').value = wardOption.value;
      wardName = wardOption.text;
      foundWard = true;
    }
  }
  
  // ===== BƯỚC 4: TRÍCH XUẤT ĐỊA CHỈ CHI TIẾT =====
  let detailAddress = fullAddress;
  
  // Loại bỏ tên tỉnh, quận, phường đã parse
  if (provinceName) {
    detailAddress = detailAddress.replace(new RegExp(provinceName.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), 'gi'), '');
    detailAddress = detailAddress.replace(/(?:tp\.|thanh pho|tinh)\s*hcm|ho chi minh|sai gon/gi, '');
  }
  if (districtName) {
    detailAddress = detailAddress.replace(new RegExp(districtName.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), 'gi'), '');
  }
  if (wardName) {
    detailAddress = detailAddress.replace(new RegExp(wardName.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), 'gi'), '');
  }
  
  // Loại bỏ các từ khóa thừa
  detailAddress = detailAddress.replace(/(?:quan|q\.|huyen|h\.|phuong|p\.|xa|x\.|thi tran|tt\.)/gi, '');
  detailAddress = detailAddress.replace(/,+/g, ',').replace(/^,|,$/g, '').trim();
  
  $('f-address').value = detailAddress || fullAddress;
  
  // Clear quick input
  $('quick-name').value = '';
  $('quick-phone').value = '';
  $('quick-address').value = '';
  
  // ✅ TỰ ĐỘNG LƯU địa chỉ sau khi parse xong
  setTimeout(async () => {
    try {
      await saveForm();
      console.log('[Quick Input] Đã tự động lưu địa chỉ');
    } catch (e) {
      console.error('[Quick Input] Lỗi tự động lưu:', e);
      alert('Đã điền thông tin vào form. Vui lòng kiểm tra và bấm "Hoàn thành" để lưu.');
    }
  }, 500);
}