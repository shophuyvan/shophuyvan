// apps/fe/src/checkout.js
// ====== CẤU HÌNH & TIỆN ÍCH ======
const API_BASE = 'https://api.shophuyvan.vn';
const VN_PHONE_RE = /^(03|05|07|08|09)\d{8}$/;
const $ = id => document.getElementById(id);
const fmtVND = v => (Number(v)||0).toLocaleString('vi-VN') + '₫';
const cloudify = (url, t='w_200,h_200,c_fill,q_auto,f_auto') =>
  (!url || !url.includes('res.cloudinary.com')) ? url : url.replace('/upload/','/upload/'+t+'/');

async function api(path, opts = {}) {
  const url = `${API_BASE}${path.startsWith('/')?'':'/'}${path}`;
  const headers = { ...opts.headers };
  let body = opts.body;
  if (body && typeof body === 'object' && !(body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(body);
  }
  const res = await fetch(url, { method: opts.method || 'GET', headers, body });
  const ctype = res.headers.get('content-type')||'';
  const data = ctype.includes('application/json') ? await res.json() : await res.text();
  if (!res.ok) throw new Error((data && data.message) || 'Request failed');
  return data;
}

const toHumanWeight = grams => {
  const g = Number(grams||0);
  if (g<=0) return '0 g';
  if (g<1000) return `${g} g`;
  const kg = g/1000;
  return (kg%1===0) ? `${kg.toFixed(0)} kg` : `${kg.toFixed(1)} kg`;
};

// ====== HELPERS AN TOÀN DOM ======
const val = (id) => {
  const el = document.getElementById(id);
  return (el && typeof el.value !== 'undefined') ? String(el.value) : '';
};
const textOfSelect = (id) => {
  const el = document.getElementById(id);
  if (!el) return '';
  const opt = el.options && el.options[el.selectedIndex];
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
  // ❗ Không dùng cache local để quyết định có gọi API hay không
  // Tính cân nặng "thật" chỉ từ từng dòng (weight_gram/weight_grams/weight)
  let g = cart.reduce((s, it) => {
    const per = Number(it.weight_gram || it.weight_grams || it.weight || 0);
    return s + per * Number(it.qty || 1);
  }, 0);
  if (g > 0) return g;

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
  const shipOriginal = selectedShipping ? Number(selectedShipping.fee||0) : 0;
  const shipDiscount = appliedVoucher ? Number(appliedVoucher.ship_discount||0) : 0;
  const prodDiscount = appliedVoucher ? Number(appliedVoucher.discount||0) : 0;
  const bestShipDiscount = Math.max(shipDiscount, 0);
  const shipFee = Math.max(0, shipOriginal - bestShipDiscount);
  const total = Math.max(0, subtotal - prodDiscount + shipFee);

  $('summary-subtotal').textContent = fmtVND(subtotal);
  
  // ✅ Hiển thị giá gạch ngang khi có giảm ship
  if (bestShipDiscount > 0) {
    $('summary-shipping').innerHTML = `<span class="line-through text-gray-400 mr-2">${fmtVND(shipOriginal)}</span><b class="text-rose-600">${fmtVND(shipFee)}</b>`;
  } else {
    $('summary-shipping').innerHTML = `<span class="text-gray-700">${fmtVND(shipFee)}</span>`;
  }
  
  $('grand-total').textContent = fmtVND(total);
}

// ====== ĐỊA CHỈ (Tom Select) ======
let tsProvince, tsDistrict, tsWard;
function initTomSelect() {
  tsProvince = new TomSelect('#province', { create:false, maxOptions:500, persist:false, allowEmptyOption:true, placeholder:'-- Tỉnh/Thành phố *' });
  tsDistrict = new TomSelect('#district', { create:false, maxOptions:500, persist:false, allowEmptyOption:true, placeholder:'-- Quận/Huyện *', disabled:true });
  tsWard     = new TomSelect('#ward',     { create:false, maxOptions:500, persist:false, allowEmptyOption:true, placeholder:'-- Phường/Xã *', disabled:true });

  // Province -> load districts
  if (tsProvince && typeof tsProvince.on === 'function') {
    tsProvince.on('change', async (code) => {
      selectedShipping = null;
      $('shipping-list').innerHTML = '<div class="py-8 text-center text-gray-400">Chọn đủ địa chỉ để xem phí vận chuyển</div>';
      if (!code) { if (tsDistrict) tsDistrict.disable(); if (tsWard) tsWard.disable(); return; }
      try {
        const res = await api(`/shipping/districts?province_code=${encodeURIComponent(code)}`);
        const districts = (res.items||res.data||[]).map(d=>({value:d.code, text:d.name}));
        if (tsDistrict) { tsDistrict.clear(); tsDistrict.clearOptions(); tsDistrict.addOptions(districts); tsDistrict.enable(); tsDistrict.setValue(''); }
        if (tsWard) { tsWard.clear(); tsWard.clearOptions(); tsWard.disable(); }
      } catch {}
    });
  }

  // District -> load wards
  if (tsDistrict && typeof tsDistrict.on === 'function') {
    tsDistrict.on('change', async (code) => {
      selectedShipping = null;
      $('shipping-list').innerHTML = '<div class="py-8 text-center text-gray-400">Chọn đủ địa chỉ để xem phí vận chuyển</div>';
      if (!code) { if (tsWard) tsWard.disable(); return; }
      try {
        const res = await api(`/shipping/wards?district_code=${encodeURIComponent(code)}`);
        const wards = (res.items||res.data||[]).map(w=>({value:w.code, text:w.name}));
        if (tsWard) { tsWard.clear(); tsWard.clearOptions(); tsWard.addOptions(wards); tsWard.enable(); tsWard.setValue(''); }
      } catch {}
    });
  }

  // Ward -> fetch shipping price
  if (tsWard && typeof tsWard.on === 'function') {
    tsWard.on('change', () => { fetchShippingQuote(); });
  }
}


async function loadProvinces() {
  const res = await api('/shipping/provinces');
  const items = res.items||res.data||[];
  tsProvince.addOptions(items.map(p=>({ value:p.code, text:p.name })));
}

// ====== PHÍ VẬN CHUYỂN (KHÔNG FALLBACK) ======
async function fetchShippingQuote() {
  // Đọc code từ TomSelect (nếu có), fallback về <select> gốc
  var provinceSel = document.getElementById('province');
  var districtSel = document.getElementById('district');
  var wardSel     = document.getElementById('ward');

  var hasTsProvince = (typeof tsProvince !== 'undefined') && tsProvince && (typeof tsProvince.getValue === 'function');
  var hasTsDistrict = (typeof tsDistrict !== 'undefined') && tsDistrict && (typeof tsDistrict.getValue === 'function');
  var hasTsWard     = (typeof tsWard     !== 'undefined') && tsWard     && (typeof tsWard.getValue     === 'function');

  var provinceCode = hasTsProvince ? tsProvince.getValue() : (provinceSel ? provinceSel.value : '');
  var districtCode = hasTsDistrict ? tsDistrict.getValue() : (districtSel ? districtSel.value : '');
  var wardCode     = hasTsWard     ? tsWard.getValue()     : (wardSel     ? wardSel.value     : '');

  function getTextFrom(ts, code, sel) {
    if (ts && typeof ts.getOption === 'function' && code) {
      var opt = ts.getOption(code);
      if (opt && typeof opt.textContent === 'string') return opt.textContent;
    }
    if (sel && sel.options && sel.selectedIndex >= 0) {
      var op = sel.options[sel.selectedIndex];
      if (op && typeof op.text === 'string') return op.text;
    }
    return '';
  }

  var provinceName = getTextFrom(tsProvince, provinceCode, provinceSel);
  var districtName = getTextFrom(tsDistrict, districtCode, districtSel);
  var wardName     = getTextFrom(tsWard,     wardCode,     wardSel);

  // Chưa đủ địa chỉ => không gọi API phí ship
  if (!provinceCode || !districtCode || !wardCode) {
    var box = document.getElementById('shipping-list');
    if (box) box.innerHTML = '<div class="py-8 text-center text-gray-400">Chọn đủ địa chỉ để xem phí vận chuyển</div>';
    selectedShipping = null;
    updateSummary();
    return;
  }

  try {
    // Tính tổng & khối lượng thực từ giỏ hàng (API thật, không fallback)
    const cart = getCart();
    const subtotal = calcSubtotal(cart);
    let   weight   = calcWeight(cart);
    if (!weight) weight = await ensureWeight(cart);   // ← hỏi server nếu 0g
    $('total-weight').textContent = toHumanWeight(weight);

    const res = await api('/shipping/price', {
      method:'POST',
      body: {
        receiver_province: provinceName,
        receiver_district: districtName,
        receiver_commune: wardName,   // ✅ không còn đọc .options
        weight_gram: weight,
        weight: weight,
        value: subtotal,
        cod: subtotal,
        option_id: '1'
      }
    });

    // ✅ DANH SÁCH PROVIDERS MUỐN ẨN (có thể chỉnh sửa)
    const HIDDEN_PROVIDERS = ['VTP']; // Ví dụ: ẩn Viettel Post
    
    let items = (res.items||res.data||[])
      .filter(o => {
        const provider = (o.provider || o.carrier || '').toUpperCase();
        return !HIDDEN_PROVIDERS.includes(provider);
      })
      .map(o => ({
        provider: o.provider || o.carrier || '',
        service_code: o.service_code || o.service || '',
        name: o.name || o.service_name || o.provider,
        fee: Number(o.fee || o.total_fee || 0),
        eta: o.eta || o.leadtime || ''
      }))
      .filter(o => o.fee > 0)
      .sort((a,b)=> a.fee - b.fee);

    if (!items.length) {
      $('shipping-list').innerHTML = `
        <div class="bg-yellow-50 border-2 border-yellow-200 p-4 rounded-xl text-center">
          <div class="font-semibold text-yellow-700 text-sm">⚠️ Không có đơn vị vận chuyển khả dụng.</div>
          <div class="text-yellow-600 text-xs mt-2">Vui lòng thử lại sau hoặc liên hệ shop.</div>
        </div>`;
      selectedShipping = null;
      updateSummary();
      return;
    }

    $('shipping-list').innerHTML = items.map((it, idx)=>`
      <label class="flex items-center justify-between p-4 border-2 rounded-xl cursor-pointer transition-all ${
        idx===0 
          ? 'border-rose-500 bg-rose-50' 
          : 'border-gray-200 hover:border-rose-300 hover:bg-gray-50'
      }">
        <div class="flex items-center gap-3 flex-1">
          <input type="radio" name="ship_opt" value="${idx}" ${idx===0?'checked':''}
                 data-provider="${it.provider}" data-service="${it.service_code}"
                 data-fee="${it.fee}" data-eta="${it.eta||''}" data-name="${it.name}"
                 class="w-5 h-5 text-rose-600 focus:ring-2 focus:ring-rose-500"/>
          <div class="flex-1">
            <div class="font-bold text-sm text-gray-800">${it.name}</div>
            <div class="text-xs text-gray-600 mt-1">${it.eta || 'Giao tiêu chuẩn'}</div>
          </div>
        </div>
        <div class="font-bold text-rose-600 text-lg ml-3">${fmtVND(it.fee)}</div>
      </label>
    `).join('');

    document.querySelectorAll('input[name="ship_opt"]').forEach(r => {
      r.addEventListener('change', () => {
        document.querySelectorAll('label:has(input[name="ship_opt"])').forEach(el => {
          el.classList.remove('border-rose-500', 'bg-rose-50');
          el.classList.add('border-gray-200');
        });
        r.closest('label')?.classList.add('border-rose-500', 'bg-rose-50');
        r.closest('label')?.classList.remove('border-gray-200');
        
        selectedShipping = {
          provider: r.dataset.provider,
          service_code: r.dataset.service,
          fee: Number(r.dataset.fee||0),
          eta: r.dataset.eta||'',
          name: r.dataset.name||''
        };
        updateSummary();
      });
    });

    // Chọn mặc định rẻ nhất
    const first = document.querySelector('input[name="ship_opt"]');
    if (first) {
      selectedShipping = {
        provider: first.dataset.provider,
        service_code: first.dataset.service,
        fee: Number(first.dataset.fee||0),
        eta: first.dataset.eta||'',
        name: first.dataset.name||''
      };
      updateSummary();
    }
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
async function applyVoucher() {
  const input = $('voucher-input');
  const result = $('voucher-result');
  const code = (input.value||'').trim().toUpperCase();

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

// ====== KHỞI TẠO ======
(async function init(){
  console.log('[Checkout] Init started');
  
  renderCart();
  
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
  
  initTomSelect();
  try { await loadProvinces(); } catch {}
  
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

    const name = val('name').trim();
    const phone = val('phone').trim();
    const address = val('address').trim();
    if (!name || !phone || !address) return showError('Vui lòng điền đủ Họ tên, SĐT, Địa chỉ.');
    if (!VN_PHONE_RE.test(phone))   return showError('SĐT không hợp lệ (VD: 0912345678).');
    if (!selectedShipping)          return showError('Vui lòng chọn phương thức vận chuyển.');

    const subtotal = calcSubtotal(cart);
    const shipOriginal = Number(selectedShipping.fee||0);
    const prodDiscount = appliedVoucher ? Number(appliedVoucher.discount||0) : 0;
    const shipDiscount = appliedVoucher ? Number(appliedVoucher.ship_discount||0) : 0;
    const bestShipDiscount = Math.max(shipDiscount, 0);
    const shipFee = Math.max(0, shipOriginal - bestShipDiscount);
    const grandTotal = Math.max(0, subtotal - prodDiscount + shipFee);

    // ✅ Lấy trạng thái cho xem hàng
    const allowInspection = document.getElementById('allow-inspection')?.checked ?? true;
    
    const payload = {
      customer: {
        name, phone, address,
        province_code: val('province'),
        district_code: val('district'),
        commune_code: val('ward'),
        province: textOfSelect('province'),
        district: textOfSelect('district'),
        commune: textOfSelect('ward')
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
      note: $('#note').value || '',
      // ✅ THÊM TRƯỜNG NÀY
      allow_inspection: allowInspection,
      cod_amount: allowInspection ? grandTotal : 0, // Nếu cho xem hàng → COD = tổng tiền
      shipping_provider: selectedShipping.provider,
      shipping_service: selectedShipping.service_code,
      shipping_name: selectedShipping.name || '',
      shipping_eta: selectedShipping.eta || '',
      totals: {
        shipping_fee: shipOriginal,
        discount: prodDiscount,
        shipping_discount: bestShipDiscount
      },
      source: 'website',
      status: 'placed'
    };

    const res = await api('/api/orders', {
      method:'POST',
      headers: {
        'Idempotency-Key': (
          localStorage.getItem('idem_order') ||
          (()=>{ const v='idem-'+Date.now()+'-'+Math.random().toString(36).slice(2); localStorage.setItem('idem_order', v); return v; })()
        )
      },
      body: payload
    });

    if (res && (res.id || res.success || res.status==='ok')) {
      $('order-result').innerHTML = `<div class="ok p-3 rounded-xl text-green-800">Đặt hàng thành công! Mã đơn: <b>${res.id||''}</b></div>`;
      clearCart(); localStorage.removeItem('idem_order');
      renderCart();
    } else {
      showError(res?.message || 'Đặt hàng thất bại');
    }
  } catch (e) {
    showError(e.message || 'Có lỗi xảy ra khi đặt hàng');
  } finally {
    placing = false; $('place-order').removeAttribute('disabled');
  }
});