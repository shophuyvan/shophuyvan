// apps/fe/src/checkout.js
// ====== IMPORT API ======
import './pixels.js'; // 🔥 THÊM DÒNG NÀY (Để track InitiateCheckout, Purchase)
import api from './lib/api.js';

// ====== CẤU HÌNH & TIỆN ÍCH ======
const VN_PHONE_RE = /^(03|05|07|08|09)\d{8}$/;
const $ = id => document.getElementById(id);
const fmtVND = v => (Number(v)||0).toLocaleString('vi-VN') + '₫';
const cloudify = (url, t='w_200,h_200,c_fill,q_auto,f_auto') =>
  (!url || !url.includes('res.cloudinary.com')) ? url : url.replace('/upload/','/upload/'+t+'/');
const toHumanWeight = grams => {
  const g = Number(grams||0);
  if (g<=0) return '0 g';
  if (g<1000) return `${g} g`;
  const kg = g/1000;
  return (kg%1===0) ? `${kg.toFixed(0)} kg` : `${kg.toFixed(1)} kg`;
};

// ====== HELPERS AN TOÀN DOM ======
const _el = (id) => document.getElementById(id);
const val = (id) => {
  const el = _el(id);
  if (!el) return '';
  // Phần tử có thuộc tính .value (input/select/textarea…)
  if ('value' in el) return String(el.value ?? '');
  // Fallback cho thẻ không có .value
  const attr = el.getAttribute && el.getAttribute('value');
  const data = el.dataset && el.dataset.value;
  return String(attr ?? data ?? '');
};
const textOfSelect = (id) => {
  const el = _el(id);
  if (!el) return '';
  const sel = /** @type {HTMLSelectElement} */ (el);
  const idx = typeof sel.selectedIndex === 'number' ? sel.selectedIndex : -1;
  const opt = (sel.options && idx >= 0) ? sel.options[idx] : null;
  return (opt && typeof opt.text === 'string') ? opt.text : '';
};

// ====== CART / TÍNH TỔNG ======
function getCart() {
  try {
    // 1) Ưu tiên danh sách đã CHỌN do trang Giỏ hàng lưu sẵn
    const ckRaw = localStorage.getItem('checkout_items');
    if (ckRaw) {
      const ck = JSON.parse(ckRaw);
      if (Array.isArray(ck) && ck.length) return ck;
    }

    // 2) Đọc toàn bộ cart
    const keys = ['shv_cart_v1','cart','CART','shv_cart','shv_cart_items'];
    let all = [];
    for (const k of keys) {
      const raw = localStorage.getItem(k);
      if (!raw) continue;
      const data = JSON.parse(raw);
      if (Array.isArray(data)) { all = data; break; }                 // FE cũ: cart=[]
      if (data && Array.isArray(data.lines)) { all = data.lines; break; } // {lines:[]}
    }

    // 3) Nếu có danh sách id đã chọn → lọc từ cart
    const sidRaw = localStorage.getItem('cart_selected_ids');
    if (sidRaw) {
      const ids = JSON.parse(sidRaw);
      if (Array.isArray(ids) && ids.length) {
        const set = new Set(ids.map(String));
        return (all||[]).filter(it => set.has(String(it?.id)));
      }
    }

    // 4) Fallback: chưa chọn gì → lấy toàn bộ
    return all || [];
  } catch {}
  return [];
}

function clearCart() {
  ['cart','CART','shv_cart','shv_cart_v1','shv_cart_items'].forEach(k=>localStorage.removeItem(k));
  window.dispatchEvent(new Event('storage'));
  window.dispatchEvent(new CustomEvent('shv:cart-changed'));
}
function calcSubtotal(cart) {
  return cart.reduce((s,it)=> s + Number(it.price||0)*Number(it.qty||1), 0);
}
function calcWeight(cart) {
  let g = cart.reduce((s,it)=> s + Number(it.weight_gram||it.weight_grams||it.weight||0)*Number(it.qty||1), 0);
  if (!g) {
    const cache = Number(localStorage.getItem('cart_weight_gram')||0); // cache set tại trang giỏ hàng
    if (cache > 0) g = cache;
  }
  return g;
}

// API: nếu thiếu cân nặng → hỏi server để lấy total_gram thật
async function ensureWeight(cart) {
  // LUON GOI API DE LAY WEIGHT CHINH XAC (khong tin cache local)
  // Tinh can nang tu cart truoc (de log)
  let g = cart.reduce((s, it) => {
    const per = Number(it.weight_gram || it.weight_grams || it.weight || 0);
    return s + per * Number(it.qty || 1);
  }, 0);
  
  console.log('[ensureWeight] Local weight:', g, 'g');
  
  // Du local co > 0 van goi API de dam bao chuan
  if (cart.length === 0) return 0;

  try {
    // chuẩn hoá payload gửi server: product_id + variant info + qty
    const lines = cart.map(it => ({
      product_id: it.productId || it.product_id || it.pid || it.id,
      variant_id: it.variant_id || it.variantId || it.vid || (it.variant && it.variant.id) || '',
      variant_sku: it.variant_sku || it.sku || (it.variant && it.variant.sku) || '',
      variant_name: it.variant_name || it.variantName || (it.variant && (it.variant.name || it.variant.title)) || '',
      weight_gram: Number(it.weight_gram ?? it.weight ?? (it.variant && it.variant.weight_gram) ?? 0) || 0,
      qty: Number(it.qty || 1),
    }));


    const res = await api('/shipping/weight', {
      method: 'POST',
      body: { lines }
    });
    // kỳ vọng server trả { total_gram: number }
    g = Number(res?.total_gram || 0);
    if (g > 0) {
      localStorage.setItem('cart_weight_gram', String(g)); // cache cho lần sau
    }
    return g;
  } catch (e) {
    console.warn('[checkout] ensureWeight failed', e);
    return 0;
  }
}

// ====== STATE ======
let selectedShipping = null;      // { provider, service_code, fee, name, eta }
let placing = false;
let appliedVoucher = null;        // { code, discount, ship_discount }

// ====== HÀM LẤY THÔNG TIN KHÁCH HÀNG ======
function getCustomerInfo() {
  try {
    if (window.currentCustomer) return window.currentCustomer;
    const raw = localStorage.getItem('customer_info');
    if (!raw) return { tier: 'retail', customer_type: 'retail' };
    return JSON.parse(raw);
  } catch {
    return { tier: 'retail', customer_type: 'retail' };
  }
}

// ====== STATE ĐỊA CHỈ ======
let savedAddresses = [];          // Danh sách địa chỉ đã lưu
let selectedAddress = null;       // Địa chỉ được chọn
let isLoggedIn = false;           // Trạng thái đăng nhập
let editingAddressId = null;      // ID địa chỉ đang edit

// Render section địa chỉ ở đầu trang
function renderAddressSection() {
  const selectedCard = $('selected-address-card');
  const emptyCard = $('empty-address-card');
  
  if (selectedAddress) {
    // Hiển thị địa chỉ đã chọn
    $('addr-name-phone').textContent = `${selectedAddress.name} | ${selectedAddress.phone}`;
    $('addr-full').textContent = `${selectedAddress.address}, ${selectedAddress.ward_name || ''}, ${selectedAddress.district_name || ''}, ${selectedAddress.province_name || ''}`;
    selectedCard.classList.remove('hidden');
    emptyCard.classList.add('hidden');
  } else {
    // Hiển thị empty state
    selectedCard.classList.add('hidden');
    emptyCard.classList.remove('hidden');
  }
}

// ====== RENDER GIỎ HÀNG & SUMMARY ======
function renderCart() {
  const cart = getCart();
  $('cart-count').textContent = cart.length;
  const html = cart.length ? cart.map(it=>{
    const img = cloudify(it.variantImage || it.image || '/icon.png');
    const lineTotal = Number(it.price||0)*Number(it.qty||1);
    return `
      <div class="p-3 flex gap-3 items-start">
        <div class="relative flex-shrink-0">
          <img class="w-20 h-20 rounded-xl object-cover border border-gray-200" src="${img}" alt="${it.name}"
               onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2280%22 height=%2280%22%3E%3Crect fill=%22%23e5e7eb%22 width=%2280%22 height=%2280%22 rx=%228%22/%3E%3C/svg%3E'"/>
          <div class="absolute -top-1 -right-1 bg-rose-500 text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center shadow">${it.qty||1}</div>
        </div>
        <div class="flex-1 min-w-0">
          <div class="font-bold text-sm line-clamp-2 mb-1 text-gray-800">${it.name||'Sản phẩm'}</div>
          ${it.variantName||it.variant ? `<div class="mb-2"><span class="inline-block px-2 py-1 text-xs rounded-lg bg-blue-50 text-blue-700 border border-blue-200">${it.variantName||it.variant}</span></div>` : ''}
          <div class="flex justify-between items-center mt-2">
            <div class="text-sm font-bold text-rose-600">${fmtVND(it.price)}</div>
            <div class="text-sm text-gray-600">x <span class="font-semibold">${it.qty||1}</span></div>
          </div>
        </div>
      </div>
    `;
  }).join('') : `<div class="p-10 text-center text-gray-500">Giỏ hàng trống.</div>`;
  $('cart-items').innerHTML = html;
  $('subtotal').textContent = fmtVND(calcSubtotal(cart));
  const wLocal = calcWeight(cart);
  $('total-weight').textContent = toHumanWeight(wLocal);
  // nếu local = 0g, hỏi server để hiện đúng số gram ngay
  if (!wLocal) {
    ensureWeight(cart).then(g => {
      $('total-weight').textContent = toHumanWeight(g);
    }).catch(()=>{ /* ignore */ });
  }
  updateSummary();
}

function updateSummary() {
  const cart = getCart();
  const subtotal = calcSubtotal(cart);
  
  // ✅ KIỂM TRA KHÁCH SỈ
  const customer = getCustomerInfo();
  const isWholesale = customer.customer_type === 'wholesale' || customer.customer_type === 'si';
  const MIN_WHOLESALE_ORDER = 1000000; // 1 triệu đồng
  
  // ✅ KHÔNG GIẢM GIÁ SHIP CHO KHÁCH SỈ
  const shipOriginal = selectedShipping ? Number(selectedShipping.fee||0) : 0;
  const shipDiscount = (isWholesale ? 0 : (appliedVoucher ? Number(appliedVoucher.ship_discount||0) : 0));
  const prodDiscount = appliedVoucher ? Number(appliedVoucher.discount||0) : 0;
  const bestShipDiscount = Math.max(shipDiscount, 0);
  const shipFee = Math.max(0, shipOriginal - bestShipDiscount);
  const total = Math.max(0, subtotal - prodDiscount + shipFee);

  $('summary-subtotal').textContent = fmtVND(subtotal);
  
  // ✅ HIỂN THỊ CẢNH BÁO NẾU KHÁCH SỈ CHƯA ĐỦ ĐƠN TỐI THIỂU
  const warningBox = $('wholesale-warning');
  if (warningBox) {
    if (isWholesale && subtotal < MIN_WHOLESALE_ORDER) {
      const remaining = MIN_WHOLESALE_ORDER - subtotal;
      warningBox.innerHTML = `
        <div class="p-3 bg-amber-50 border-2 border-amber-300 rounded-xl text-amber-800 text-sm">
          <strong>⚠️ Đơn hàng tối thiểu:</strong> Khách sỉ cần đặt tối thiểu <strong>${fmtVND(MIN_WHOLESALE_ORDER)}</strong>. 
          Bạn cần thêm <strong>${fmtVND(remaining)}</strong> nữa.
        </div>
      `;
      warningBox.classList.remove('hidden');
    } else {
      warningBox.classList.add('hidden');
    }
  }
  
  // ✅ Hiển thị giá gạch ngang khi có giảm ship
  if (bestShipDiscount > 0) {
    $('summary-shipping').innerHTML = `<span class="line-through text-gray-400 mr-2">${fmtVND(shipOriginal)}</span><b class="text-rose-600">${fmtVND(shipFee)}</b>`;
  } else {
    $('summary-shipping').textContent = fmtVND(shipFee);
  }
  
  $('grand-total').textContent = fmtVND(total);
}

// ====== TOM SELECT ======
let provinceTS, districtTS, wardTS;
function initTomSelect() {
  if (typeof TomSelect === 'undefined') return;
  provinceTS = new TomSelect('#province', { maxItems:1, allowEmptyOption:false, placeholder:'Chọn Tỉnh/TP' });
  districtTS = new TomSelect('#district', { maxItems:1, allowEmptyOption:false, placeholder:'Chọn Quận/Huyện' });
  wardTS = new TomSelect('#ward', { maxItems:1, allowEmptyOption:false, placeholder:'Chọn Phường/Xã' });
  provinceTS.on('change', (v)=>{
    districtTS.clear(); districtTS.clearOptions(); wardTS.clear(); wardTS.clearOptions();
    districtTS.enable(); wardTS.disable();
    if (v) loadDistricts(v);
    fetchShipping();
  });
  districtTS.on('change', (v)=>{
    wardTS.clear(); wardTS.clearOptions();
    wardTS.enable();
    if (v) loadWards(v);
    fetchShipping();
  });
  wardTS.on('change', ()=>{ fetchShipping(); });
}

async function loadProvinces() {
  try {
    const res = await api('/shipping/provinces', { method:'GET' });
    const arr = res?.data || res?.items || res || [];
    provinceTS.clear(); provinceTS.clearOptions();
    arr.forEach(p => provinceTS.addOption({ value: p.code, text: p.name }));
  } catch (e) { console.error('Load provinces error', e); }
}
async function loadDistricts(provinceCode) {
  try {
    const res = await api('/shipping/districts?province='+provinceCode, { method:'GET' });
    const arr = res?.data || res?.items || res || [];
    districtTS.clear(); districtTS.clearOptions();
    arr.forEach(d => districtTS.addOption({ value: d.code, text: d.name }));
  } catch (e) { console.error('Load districts error', e); }
}
async function loadWards(districtCode) {
  try {
    const res = await api('/shipping/wards?district='+districtCode, { method:'GET' });
    const arr = res?.data || res?.items || res || [];
    wardTS.clear(); wardTS.clearOptions();
    arr.forEach(w => wardTS.addOption({ value: w.code, text: w.name }));
  } catch (e) { console.error('Load wards error', e); }
}

async function fetchShipping() {
  const cart = getCart();
  if (!cart.length) return;
  
  const weight = await ensureWeight(cart);

  // ✅ Dùng địa chỉ đã chọn thay vì form thủ công
  if (!selectedAddress) {
    $('shipping-list').innerHTML = `<div class="text-center py-8 text-gray-400">Vui lòng chọn địa chỉ giao hàng ở phần trên</div>`;
    selectedShipping = null;
    updateSummary();
    return;
  }

  // ✅ TỰ ĐỘNG KIỂM TRA VOUCHER MIỄN SHIP
  await checkAutoFreeShipVoucher();

  try {
    $('shipping-list').innerHTML = `<div class="text-center py-8 text-gray-400">Đang tải phí vận chuyển...</div>`;

        // ✅ LẤY TÊN từ selectedAddress (không dùng select thủ công)
    const provinceName = selectedAddress.province_name || '';
    const districtName = selectedAddress.district_name || '';
    const wardName     = selectedAddress.ward_name || '';

    const res = await api('/shipping/price', {
      method: 'POST',
      body: {
        weight_gram: weight,
        weight: weight,
        receiver_province: provinceName,
        receiver_district: districtName,
        receiver_commune: wardName || '',
        value: calcSubtotal(cart),
        cod: calcSubtotal(cart),
        option_id: '1'
      }
    });

const rawItems = res?.items || [];
    
    // ✅ TÌM ĐƠN VỊ VẬN CHUYỂN GIÁ RẺ NHẤT
    const allItems = rawItems.map(it => ({
      provider: String(it.provider || '').toLowerCase(),
      originalProvider: it.provider,
      name: it.name || it.provider,
      service_code: it.service_code,
      fee: Number(it.fee || 0),
      eta: it.eta || 'Giao hàng tiêu chuẩn',
    }));

    // Tìm item có phí thấp nhất
    const cheapestItem = allItems.reduce((min, item) => 
      (item.fee > 0 && item.fee < min.fee) ? item : min
    , allItems[0] || { fee: Infinity });
    
    // Tạo 1 option duy nhất: "Vận chuyển nhanh" = giá rẻ nhất
    const items = cheapestItem && cheapestItem.fee !== Infinity ? [{
      ...cheapestItem,
      name: 'Vận chuyển nhanh',
      eta: 'HCM: 1-2 ngày | Miền Tây: 1-3 ngày | Miền Trung: 2-4 ngày | Miền Bắc: 3-5 ngày'
    }] : [];
    
    if (!items.length) {
      $('shipping-list').innerHTML = `
        <div class="bg-yellow-50 border-2 border-yellow-200 p-4 rounded-xl text-center">
          <div class="font-semibold text-yellow-700 text-sm">⚠️ Không có đơn vị vận chuyển khả dụng</div>
          <div class="text-yellow-600 text-xs mt-2">Vui lòng liên hệ shop để được hỗ trợ</div>
        </div>`;
      selectedShipping = null;
      updateSummary();
      return;
    }

    // Render 1 option duy nhất (không cần radio vì chỉ có 1 lựa chọn)
    const it = items[0];
    $('shipping-list').innerHTML = `
      <div class="border-2 border-rose-500 bg-rose-50 rounded-xl p-4">
        <div class="flex items-center justify-between">
          <div class="flex-1">
            <div class="flex items-center gap-2 mb-1">
              <span class="text-xl">🚚</span>
              <span class="font-bold text-gray-800 text-base">${it.name}</span>
            </div>
            <div class="text-sm text-gray-600">${it.eta}</div>
            <div class="text-xs text-gray-500 mt-1">Được tối ưu từ ${it.originalProvider || 'đơn vị vận chuyển'}</div>
          </div>
          <div class="font-bold text-rose-600 text-xl ml-3">${fmtVND(it.fee)}</div>
        </div>
      </div>
    `;

    // Tự động chọn option duy nhất
    selectedShipping = {
      provider: it.originalProvider,
      service_code: it.service_code,
      option_id: it.option_id || '1', // Lưu thêm option_id (quan trọng cho SuperAI)
      fee: it.fee,
      eta: it.eta,
      name: it.name
    };
    updateSummary();
  } catch (e) {
    console.error('Get quote error:', e);
    $('shipping-list').innerHTML = `
      <div class="bg-red-50 border-2 border-red-200 p-4 rounded-xl text-center">
        <div class="font-semibold text-red-700 text-sm">❌ Lỗi khi lấy phí vận chuyển từ API.</div>
        <div class="text-red-600 text-xs mt-2">${e.message || 'Vui lòng thử lại sau.'}</div>
      </div>`;
    selectedShipping = null;
    updateSummary();
  }
}

// ====== VOUCHER ======
// ====== VOUCHER ======

// ✅ TỰ ĐỘNG KIỂM TRA VÀ ÁP DỤNG VOUCHER MIỄN SHIP
async function checkAutoFreeShipVoucher() {
  try {
    const subtotal = calcSubtotal(getCart());
    
    // Lấy danh sách vouchers công khai
    const res = await api('/vouchers', { method: 'GET' });
    const vouchers = res?.items || [];
    
    // Tìm voucher auto_freeship đang active và đủ điều kiện
    const autoFreeShip = vouchers.find(v => 
      v.voucher_type === 'auto_freeship' && 
      v.min_purchase > 0 && 
      subtotal >= v.min_purchase
    );
    
    if (autoFreeShip) {
      // Tự động áp dụng voucher miễn ship
      appliedVoucher = { 
        code: autoFreeShip.code, 
        discount: 0, 
        ship_discount: 999999 // Set giá trị cao để miễn 100% phí ship
      };
      
      // Hiển thị thông báo
      const result = $('voucher-result');
      if (result) {
        result.className = 'mt-3';
        result.innerHTML = `<div class="ok p-3 rounded-xl text-green-800 flex items-center gap-2">
          <span>🎉</span>
          <span><strong>Miễn phí ship!</strong> Đơn hàng từ ${fmtVND(autoFreeShip.min_purchase)}</span>
        </div>`;
      }
      
      console.log('✅ Áp dụng tự động voucher miễn ship:', autoFreeShip.code);
    }
  } catch (e) {
    console.error('Lỗi kiểm tra auto freeship:', e);
  }
}

async function applyVoucher() {
  const result = $('voucher-result');
  const code = val('voucher-input').trim().toUpperCase();


  if (!code) {
    appliedVoucher = null; updateSummary();
    result.className = 'hidden'; result.innerHTML = ''; return;
  }

  result.className = 'mt-3';
  result.innerHTML = `<div class="p-3 rounded-xl border bg-blue-50 text-blue-700">Đang kiểm tra mã…</div>`;

  try {
    const subtotal = calcSubtotal(getCart());
    const res = await api('/vouchers/apply', { method:'POST', body:{ code, subtotal, customer_id:null } });
    if (res.ok === true && res.valid === true) {
      appliedVoucher = { code: res.code, discount: Number(res.discount||0), ship_discount: Number(res.ship_discount||0) };
      const saved = (appliedVoucher.discount||0) + (appliedVoucher.ship_discount||0);
      result.innerHTML = `<div class="ok p-3 rounded-xl text-green-800">Áp dụng thành công – Tiết kiệm ${fmtVND(saved)}</div>`;
    } else {
      appliedVoucher = null;
      result.innerHTML = `<div class="error p-3 rounded-xl text-red-700">${res.message || 'Mã giảm giá không hợp lệ'}</div>`;
    }
  } catch (e) {
    appliedVoucher = null;
    result.innerHTML = `<div class="error p-3 rounded-xl text-red-700">${e.message || 'Có lỗi khi kiểm tra mã'}</div>`;
  } finally {
    updateSummary();
  }
}
$('apply-voucher').addEventListener('click', applyVoucher);

// ====== QUẢN LÝ ĐỊA CHỈ ======

// Check login
function checkLogin() {
  const token = localStorage.getItem('customer_token') || 
                localStorage.getItem('x-customer-token') || 
                localStorage.getItem('x-token');
  isLoggedIn = !!token;
  return isLoggedIn;
}

// Load danh sách địa chỉ từ API
async function loadSavedAddresses() {
  if (!checkLogin()) {
    savedAddresses = [];
    renderAddressSection();
    return;
  }
  
    try {
    const res = await api('/api/addresses', { method: 'GET' });
    // Hỗ trợ nhiều kiểu trả về: {addresses} | {data} | {items}
    savedAddresses = res.addresses || res.data || res.items || [];
    
    // Auto-chọn địa chỉ default
    const defaultAddr = savedAddresses.find(a => a.is_default);

    if (defaultAddr && !selectedAddress) {
      selectAddress(defaultAddr);
    }
    
        renderAddressSection();
    // (ĐÃ BỎ form thủ công)
  } catch (e) {
    console.error('Load addresses error:', e);
    savedAddresses = [];
    renderAddressSection();
  }
}

// Toggle form nhập thủ công
function toggleManualForm() {
  const manualSection = $('manual-address-section');
  if (!manualSection) return;
  
  if (selectedAddress) {
    // Đã chọn địa chỉ → ẩn form thủ công
    manualSection.style.display = 'none';
  } else {
    // Chưa chọn → hiện form thủ công cho guest
    if (!isLoggedIn) {
      manualSection.style.display = 'block';
    }
  }
}

// Chọn địa chỉ
function selectAddress(addr) {
  selectedAddress = addr;

  // Không còn form thủ công → chỉ cần gọi lại shipping
  try { fetchShipping(); } catch {}

  // Render lại khối địa chỉ đã chọn
  try { renderAddressSection(); } catch {}

  // Không còn form để toggle; gọi có điều kiện cho an toàn
  try { typeof toggleManualForm === 'function' && toggleManualForm(); } catch {}
}


// Mở modal quản lý địa chỉ
window.openAddressManager = function() {
  const modal = $('addressManagerModal');
  modal.style.display = 'flex';
  
  $('addr-modal-loading').classList.remove('hidden');
  $('addr-list-container').innerHTML = '';
  $('addr-form-container').classList.add('hidden');
  $('addr-empty').classList.add('hidden');
  
  // Reload addresses
  loadSavedAddresses().then(() => {
    $('addr-modal-loading').classList.add('hidden');
    renderAddressList();
  });
};

// Đóng modal
window.closeAddressManager = function() {
  $('addressManagerModal').style.display = 'none';
  cancelAddressForm();
};

// Render danh sách địa chỉ trong modal
function renderAddressList() {
  const container = $('addr-list-container');
  const empty = $('addr-empty');
  
  if (savedAddresses.length === 0) {
    container.innerHTML = '';
    empty.classList.remove('hidden');
    return;
  }
  
  empty.classList.add('hidden');
  
  container.innerHTML = savedAddresses.map(addr => `
    <label class="border-2 rounded-xl p-4 cursor-pointer transition-all hover:border-blue-500 hover:bg-blue-50 ${
      selectedAddress?.id === addr.id ? 'border-blue-600 bg-blue-50' : 'border-gray-200'
    }">
      <div class="flex items-start gap-3">
        <input 
          type="radio" 
          name="addr_radio" 
          value="${addr.id}"
          ${selectedAddress?.id === addr.id ? 'checked' : ''}
          onchange="selectAddressById('${addr.id}')"
          class="mt-1 w-4 h-4 text-blue-600"
        />
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2 mb-1">
            <span class="font-bold text-gray-900">${addr.name}</span>
            <span class="text-gray-600">|</span>
            <span class="text-gray-700">${addr.phone}</span>
            ${addr.is_default ? '<span class="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full font-semibold">Mặc định</span>' : ''}
          </div>
          <div class="text-sm text-gray-600 mb-2">
            ${addr.address}, ${addr.ward_name || ''}, ${addr.district_name || ''}, ${addr.province_name || ''}
          </div>
          ${addr.note ? `<div class="text-xs text-gray-500 mb-2">📝 ${addr.note}</div>` : ''}
          <div class="flex gap-2 mt-2">
            <button onclick="event.stopPropagation(); editAddressById('${addr.id}')" class="text-blue-600 text-sm font-semibold hover:text-blue-800">
              ✏️ Sửa
            </button>
            <button onclick="event.stopPropagation(); deleteAddressById('${addr.id}')" class="text-red-600 text-sm font-semibold hover:text-red-800">
              🗑️ Xóa
            </button>
          </div>
        </div>
      </div>
    </label>
  `).join('');
}

// Chọn địa chỉ theo ID
window.selectAddressById = function(id) {
  const addr = savedAddresses.find(a => a.id === id);
  if (addr) selectAddress(addr);
};

// Hiển thị form thêm địa chỉ
window.showAddressForm = function() {
  editingAddressId = null;
  $('addr-form-title').textContent = 'Thêm địa chỉ mới';
  $('edit-address-id').value = '';
  $('edit-name').value = '';
  $('edit-phone').value = '';
  $('edit-province').value = '';
  $('edit-district').innerHTML = '<option value="">-- Chọn Quận/Huyện *</option>';
  $('edit-ward').innerHTML = '<option value="">-- Chọn Phường/Xã *</option>';
  $('edit-address').value = '';
  $('edit-note').value = '';
  
  // Hide errors
  ['err-edit-name', 'err-edit-phone', 'err-edit-province', 'err-edit-district', 'err-edit-ward', 'err-edit-address'].forEach(id => {
    $(id).classList.add('hidden');
  });
  
  $('addr-list-container').classList.add('hidden');
  $('addr-empty').classList.add('hidden');
  $('btnShowAddForm').classList.add('hidden');
  $('addr-form-container').classList.remove('hidden');
  
  // Load provinces for form
  loadProvincesForForm();
};

// Load provinces cho form edit
async function loadProvincesForForm() {
  try {
    const res = await api('/shipping/provinces', { method: 'GET' });
    const arr = res?.data || res?.items || res || [];
    const sel = $('edit-province');
    sel.innerHTML = '<option value="">-- Chọn Tỉnh/TP *</option>' + 
      arr.map(p => `<option value="${p.code}">${p.name}</option>`).join('');
  } catch (e) {
    console.error('Load provinces for form error:', e);
  }
}

// Edit địa chỉ theo ID
window.editAddressById = async function(id) {
  const addr = savedAddresses.find(a => a.id === id);
  if (!addr) return;
  
  editingAddressId = id;
  $('addr-form-title').textContent = 'Chỉnh sửa địa chỉ';
  $('edit-address-id').value = id;
  $('edit-name').value = addr.name || '';
  $('edit-phone').value = addr.phone || '';
  $('edit-address').value = addr.address || '';
  $('edit-note').value = addr.note || '';
  
  await loadProvincesForForm();
  
  if (addr.province_code) {
    $('edit-province').value = addr.province_code;
    await loadDistrictsForForm(addr.province_code);
    
    if (addr.district_code) {
      $('edit-district').value = addr.district_code;
      await loadWardsForForm(addr.district_code);
      
      if (addr.ward_code) {
        $('edit-ward').value = addr.ward_code;
      }
    }
  }
  
  $('addr-list-container').classList.add('hidden');
  $('addr-empty').classList.add('hidden');
  $('btnShowAddForm').classList.add('hidden');
  $('addr-form-container').classList.remove('hidden');
};

async function loadDistrictsForForm(provinceCode) {
  try {
    const res = await api('/shipping/districts?province_code=' + provinceCode, { method: 'GET' });
    const arr = res?.data || res?.items || res || [];
    const sel = $('edit-district');
    sel.innerHTML = '<option value="">-- Chọn Quận/Huyện *</option>' + 
      arr.map(d => `<option value="${d.code}">${d.name}</option>`).join('');
    sel.disabled = false;
  } catch (e) {
    console.error('Load districts for form error:', e);
  }
}

async function loadWardsForForm(districtCode) {
  try {
    const res = await api('/shipping/wards?district_code=' + districtCode, { method: 'GET' });
    const arr = res?.data || res?.items || res || [];
    const sel = $('edit-ward');
    sel.innerHTML = '<option value="">-- Chọn Phường/Xã *</option>' + 
      arr.map(w => `<option value="${w.code}">${w.name}</option>`).join('');
    sel.disabled = false;
  } catch (e) {
    console.error('Load wards for form error:', e);
  }
}

// Hủy form
window.cancelAddressForm = function() {
  $('addr-form-container').classList.add('hidden');
  $('addr-list-container').classList.remove('hidden');
  $('btnShowAddForm').classList.remove('hidden');
  
  if (savedAddresses.length === 0) {
    $('addr-empty').classList.remove('hidden');
  }
};

// Validate form
function validateAddressFormInModal() {
  const name = $('edit-name').value.trim();
  const phone = $('edit-phone').value.trim();
  const province = $('edit-province').value;
  const district = $('edit-district').value;
  const ward = $('edit-ward').value;
  const address = $('edit-address').value.trim();
  
  let hasError = false;
  
  // Reset errors
  ['err-edit-name', 'err-edit-phone', 'err-edit-province', 'err-edit-district', 'err-edit-ward', 'err-edit-address'].forEach(id => {
    $(id).classList.add('hidden');
  });
  
  if (!name) {
    $('err-edit-name').textContent = 'Vui lòng nhập họ và tên';
    $('err-edit-name').classList.remove('hidden');
    hasError = true;
  }
  
  const phoneRegex = /^(03|05|07|08|09)\d{8}$/;
  if (!phone) {
    $('err-edit-phone').textContent = 'Vui lòng nhập số điện thoại';
    $('err-edit-phone').classList.remove('hidden');
    hasError = true;
  } else if (!phoneRegex.test(phone.replace(/\D/g, ''))) {
    $('err-edit-phone').textContent = 'Số điện thoại không hợp lệ (VD: 0912345678)';
    $('err-edit-phone').classList.remove('hidden');
    hasError = true;
  }
  
  if (!province) {
    $('err-edit-province').textContent = 'Vui lòng chọn Tỉnh/Thành phố';
    $('err-edit-province').classList.remove('hidden');
    hasError = true;
  }
  
  if (!district) {
    $('err-edit-district').textContent = 'Vui lòng chọn Quận/Huyện';
    $('err-edit-district').classList.remove('hidden');
    hasError = true;
  }
  
  if (!ward) {
    $('err-edit-ward').textContent = 'Vui lòng chọn Phường/Xã';
    $('err-edit-ward').classList.remove('hidden');
    hasError = true;
  }
  
  if (!address) {
    $('err-edit-address').textContent = 'Vui lòng nhập địa chỉ chi tiết';
    $('err-edit-address').classList.remove('hidden');
    hasError = true;
  } else if (address.length < 10) {
    $('err-edit-address').textContent = 'Địa chỉ quá ngắn (tối thiểu 10 ký tự)';
    $('err-edit-address').classList.remove('hidden');
    hasError = true;
  }
  
  return !hasError;
}

// Lưu địa chỉ
window.saveAddressInModal = async function() {
  if (!validateAddressFormInModal()) return;
  
  try {
    const token = localStorage.getItem('customer_token') || 
                  localStorage.getItem('x-customer-token') || 
                  localStorage.getItem('x-token');
    
    if (!token) {
      alert('⚠️ Vui lòng đăng nhập để lưu địa chỉ');
      return;
    }
    
    // Get province/district/ward names
    const provinceCode = $('edit-province').value;
    const districtCode = $('edit-district').value;
    const wardCode = $('edit-ward').value;
    
    const provinceName = $('edit-province').selectedOptions[0]?.text || '';
    const districtName = $('edit-district').selectedOptions[0]?.text || '';
    const wardName = $('edit-ward').selectedOptions[0]?.text || '';
    
    const payload = {
      name: $('edit-name').value.trim(),
      phone: $('edit-phone').value.trim().replace(/\D/g, ''),
      province_code: provinceCode,
      province_name: provinceName,
      district_code: districtCode,
      district_name: districtName,
      ward_code: wardCode,
      ward_name: wardName,
      address: $('edit-address').value.trim(),
      note: $('edit-note').value.trim()
    };
    
    const isEdit = !!editingAddressId;
    const endpoint = isEdit ? `/api/addresses/${editingAddressId}` : '/api/addresses';
    
    const data = await api(endpoint, {
      method: isEdit ? 'PUT' : 'POST',
      body: payload
    });
    
    if (data && data.ok) {
      alert(isEdit ? '✅ Cập nhật địa chỉ thành công!' : '✅ Thêm địa chỉ thành công!');
      cancelAddressForm();
      await loadSavedAddresses();
      renderAddressList();
    } else {
      throw new Error(data.message || 'Lưu địa chỉ thất bại');
    }
  } catch (e) {
    console.error('Save address error:', e);
    alert('❌ ' + (e.message || 'Có lỗi xảy ra. Vui lòng thử lại.'));
  }
};

// Xóa địa chỉ
window.deleteAddressById = async function(id) {
  const addr = savedAddresses.find(a => a.id === id);
  if (!addr) return;
  
  if (!confirm(`Bạn có chắc muốn xóa địa chỉ này?\n\n${addr.name} - ${addr.phone}\n${addr.address}`)) {
    return;
  }
  
  try {
    const token = localStorage.getItem('customer_token') || 
                  localStorage.getItem('x-customer-token') || 
                  localStorage.getItem('x-token');
    
    const res = await fetch(`${API_BASE || 'https://api.shophuyvan.vn'}/api/addresses/${id}`, {
      method: 'DELETE',
	  headers: {
        'Authorization': `Bearer ${token}`,
        'x-customer-token': token,
        'Content-Type': 'application/json'
      }
    });
    
    if (!res.ok) throw new Error('Xóa địa chỉ thất bại');
    
    const data = await res.json();
    
    if (data && data.ok) {
      alert('✅ Đã xóa địa chỉ thành công');
      
      // Nếu đang chọn địa chỉ này thì clear
      if (selectedAddress?.id === id) {
        selectedAddress = null;
        renderAddressSection();
      }
      
      await loadSavedAddresses();
      renderAddressList();
    } else {
      throw new Error('Xóa địa chỉ thất bại');
    }
  } catch (e) {
    console.error('Delete address error:', e);
    alert('❌ ' + (e.message || 'Có lỗi xảy ra. Vui lòng thử lại.'));
  }
};

    // Event listeners cho form edit trong modal
    $('edit-province')?.addEventListener('change', async (e) => {
      const provinceCode = e.target.value;
      $('edit-district').innerHTML = '<option value="">-- Chọn Quận/Huyện *</option>';
      $('edit-ward').innerHTML = '<option value="">-- Chọn Phường/Xã *</option>';
      $('edit-district').disabled = true;
      $('edit-ward').disabled = true;
    
      if (provinceCode) {
        await loadDistrictsForForm(provinceCode);
      }
    });
    
    $('edit-district')?.addEventListener('change', async (e) => {
      const districtCode = e.target.value;
      $('edit-ward').innerHTML = '<option value="">-- Chọn Phường/Xã *</option>';
      $('edit-ward').disabled = true;
    
      if (districtCode) {
        await loadWardsForForm(districtCode);
      }
    });


const goAddressPage = () => { location.href = '/addresses.html?return=/checkout'; };

// ====== KHỞI TẠO ======
(async function init(){

  console.log('[Checkout] Init started');
  
    renderCart();

    // ✅ Lấy selectedAddress từ localStorage nếu có (trả về từ /addresses.html)
  try {
    const raw = localStorage.getItem('address:selected');
    const a = raw ? JSON.parse(raw) : null;
    if (a) {
      selectedAddress = a;
      renderAddressSection();
      // Gọi phí ship ngay khi đã có địa chỉ
      try { await fetchShipping(); } catch {}
    }
  } catch {}


  // ✅ GỌI API WEIGHT NGAY KHI LOAD
  const cart = getCart();
  console.log('[Checkout] Cart items:', cart.length, cart);
  
  if (cart.length > 0) {
    try {
      console.log('[Checkout] Calling ensureWeight...');
      const weight = await ensureWeight(cart);
      $('total-weight').textContent = toHumanWeight(weight);
      console.log('[Checkout] Initial weight loaded:', weight, 'g');
    } catch (e) {
      console.error('[Checkout] Failed to load weight:', e);
    }
  } else {
    console.warn('[Checkout] Cart is empty, skipping weight API call');
  }

  // Các select thủ công có thể đã bị remove
  if (document.getElementById('province')) {
    initTomSelect();
    try { await loadProvinces(); } catch {}
  }

  // ✅ LOAD ĐỊA CHỈ ĐÃ LƯU
  await loadSavedAddresses();
 
    // Event listeners cho các nút địa chỉ → chuyển sang trang /addresses.html
  $('btnChangeAddress')?.addEventListener('click', goAddressPage);
  $('btnAddFirstAddress')?.addEventListener('click', goAddressPage);
  
  console.log('[Checkout] Init completed');
})();
// ====== ĐẶT HÀNG ======
function showError(msg) {
  const box = $('error-message');
  box.className = 'error p-3 rounded-xl';
  box.innerHTML = `<div class="text-red-700 font-semibold">${msg}</div>`;
  setTimeout(()=> { box.classList.add('hidden'); }, 4000);
}

$('place-order').addEventListener('click', async () => {
  if (placing) return;
  placing = true; $('place-order').setAttribute('disabled','disabled');
  $('order-result').textContent = '';

  try {
    const cart = getCart();
    if (!cart.length) return showError('Giỏ hàng trống.');

    if (!selectedAddress)           return showError('Vui lòng chọn địa chỉ giao hàng.');
    if (!selectedShipping)          return showError('Vui lòng chọn phương thức vận chuyển.');
    
    // ✅ KIỂM TRA ĐƠN TỐI THIỂU CHO KHÁCH SỈ
    const customer = getCustomerInfo();
    const isWholesale = customer.customer_type === 'wholesale' || customer.customer_type === 'si';
    const MIN_WHOLESALE_ORDER = 1000000;
    const subtotal = calcSubtotal(cart);
    
    if (isWholesale && subtotal < MIN_WHOLESALE_ORDER) {
      const remaining = MIN_WHOLESALE_ORDER - subtotal;
      return showError(`Khách sỉ cần đặt tối thiểu ${fmtVND(MIN_WHOLESALE_ORDER)}. Bạn cần thêm ${fmtVND(remaining)} nữa.`);
    }
    
    const name    = selectedAddress.name || '';
    const phone   = selectedAddress.phone || '';
    const address = selectedAddress.address || '';
    if (!VN_PHONE_RE.test((phone||'').replace(/\D/g,''))) {
      return showError('SĐT không hợp lệ (VD: 0912345678).');
    }
    const shipOriginal = Number(selectedShipping.fee||0);
    const prodDiscount = appliedVoucher ? Number(appliedVoucher.discount||0) : 0;
    
    // ✅ KHÔNG GIẢM PHÍ SHIP CHO KHÁCH SỈ
    const shipDiscount = (isWholesale ? 0 : (appliedVoucher ? Number(appliedVoucher.ship_discount||0) : 0));
    const bestShipDiscount = Math.max(shipDiscount, 0);
    const shipFee = Math.max(0, shipOriginal - bestShipDiscount);
    const grandTotal = Math.max(0, subtotal - prodDiscount + shipFee);

    // ✅ Lấy trạng thái cho xem hàng
    const allowInspection = document.getElementById('allow-inspection')?.checked ?? true;
    
    // ✅ FIX: COD amount = tổng thực tế khách phải trả
    const codAmount = allowInspection ? grandTotal : 0;
    
    // ✅ Tính tổng cân nặng thực tế từ cart
    const totalWeightGram = await ensureWeight(cart);
    
    const payload = {
            customer: {
        name, phone, address,
        province_code: selectedAddress?.province_code || '',
        district_code: selectedAddress?.district_code || '',
        commune_code:  selectedAddress?.ward_code     || '',
        province:      selectedAddress?.province_name || '',
        district:      selectedAddress?.district_name || '',
        commune:       selectedAddress?.ward_name     || ''
      },
      items: cart.map(it => ({
        id: it.id||it.sku||'', 
        sku: it.sku||it.id||'',
        name: it.name,
        variant: it.variantName || it.variant || '',
        variantImage: it.variantImage || it.image || '',
        image: it.variantImage || it.image || '',
        qty: Number(it.qty||1),
        price: Number(it.price||0),
        cost: Number(it.cost||0),
        weight_gram: Number(it.weight_gram||it.weight_grams||it.weight||0),
        weight_grams: Number(it.weight_gram||it.weight_grams||it.weight||0),
        weight: Number(it.weight_gram||it.weight_grams||it.weight||0)
      })),
      note: val('note') || '',
      // ✅ THÊM TRƯỜNG NÀY
      allow_inspection: allowInspection,
      cod_amount: codAmount,
      shipping_provider: selectedShipping.provider,
      shipping_service: selectedShipping.service_code,
      shipping_option_id: selectedShipping.option_id || '1', // Gửi option_id lên server
      shipping_name: selectedShipping.name || '',
      shipping_eta: selectedShipping.eta || '',
      totals: {
        shipping_fee: shipOriginal,
        discount: prodDiscount,
        shipping_discount: bestShipDiscount
      },
      total_weight_gram: totalWeightGram,
      source: 'website',
      status: 'placed'
    };

    const idemKey = localStorage.getItem('idem_order') || 
                    (() => { 
                      const v = 'idem-' + Date.now() + '-' + Math.random().toString(36).slice(2); 
                      localStorage.setItem('idem_order', v); 
                      return v; 
                    })();

    const res = await api.post('/api/orders', payload, {
      headers: { 'Idempotency-Key': idemKey }
    });

    // 🔍 DEBUG: Log response để kiểm tra
    console.log('[CHECKOUT-DEBUG] Raw response:', res);
    console.log('[CHECKOUT-DEBUG] Type:', typeof res);
    console.log('[CHECKOUT-DEBUG] Is string?', typeof res === 'string');
    
    // 🔧 FIX: Nếu response là string JSON, parse lại
    let parsedRes = res;
    if (typeof res === 'string') {
      try {
        parsedRes = JSON.parse(res);
        console.log('[CHECKOUT-DEBUG] Parsed response:', parsedRes);
      } catch (e) {
        console.error('[CHECKOUT-DEBUG] JSON parse failed:', e);
      }
    }

    if (parsedRes && parsedRes.ok && parsedRes.id) {
      // Xoá giỏ hàng & idempotency
      clearCart();
      localStorage.removeItem('idem_order');

      // Hiển thị màn hình thành công (overlay)
      const ov   = document.getElementById('success-overlay');
      const oid  = document.getElementById('success-order-id');
      const btn  = document.getElementById('success-btn');
      const sec  = document.getElementById('success-countdown');

      if (ov) {
        if (oid) oid.textContent = String(parsedRes.id || '');
        ov.classList.remove('hidden');
        
        // ✅ TRIGGER CHO PRODUCT TOUR - Hoàn thành hướng dẫn
        document.dispatchEvent(new Event('order-success'));

        // Button chuyển đến trang quản lý đơn
        const gotoOrders = () => { window.location.href = '/myorders'; };
        if (btn) btn.addEventListener('click', gotoOrders);

        // Tự động chuyển sau 5s
        let t = 5;
        const timer = setInterval(() => {
          t -= 1;
          if (sec) sec.textContent = String(t);
          if (t <= 0) { clearInterval(timer); gotoOrders(); }
        }, 1000);
      } else {
        // Fallback: nếu không có overlay, vẫn báo thành công ngắn gọn
        $('order-result').innerHTML =
          `<div class="ok p-3 rounded-xl text-green-800">Đặt hàng thành công! Mã đơn: <b>${parsedRes.id||''}</b></div>`;
      }

      // Cập nhật UI giỏ hàng phía dưới (không bắt buộc, nhưng an toàn)
      renderCart();
    } else {
      console.error('[CHECKOUT-DEBUG] Condition failed:', { 
        parsedRes, 
        hasOk: parsedRes?.ok, 
        hasId: parsedRes?.id 
      });
      showError(parsedRes?.message || res?.message || 'Đặt hàng thất bại');
    }
  } catch (e) {
    showError(e.message || 'Có lỗi xảy ra khi đặt hàng');
  } finally {
    placing = false; $('place-order').removeAttribute('disabled');
  }
});