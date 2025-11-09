// apps/fe/src/account.js
// Quản lý tài khoản và địa chỉ

const API_BASE = window.API_BASE || 'https://api.shophuyvan.vn';

// Config tier
const TIER_CONFIG = {
  retail: { name: 'Thành viên thường', color: '#6b7280', icon: '👤' },
  silver: { name: 'Thành viên bạc', color: '#94a3b8', icon: '🥈' },
  gold: { name: 'Thành viên vàng', color: '#fbbf24', icon: '🥇' },
  diamond: { name: 'Thành viên kim cương', color: '#06b6d4', icon: '💎' }
};

// State
const state = {
  customer: null,
  addresses: [],
  provinces: [],
  districts: [],
  wards: [],
  editingAddressId: null,
  loading: false
};

// DOM Elements
const loadingState = document.getElementById('loadingState');
const errorState = document.getElementById('errorState');
const mainContent = document.getElementById('mainContent');
const errorMessage = document.getElementById('errorMessage');
const customerInfo = document.getElementById('customerInfo');
const addressesList = document.getElementById('addressesList');
const emptyAddresses = document.getElementById('emptyAddresses');
const addressCount = document.getElementById('addressCount');
const addressModal = document.getElementById('addressModal');
const modalTitle = document.getElementById('modalTitle');
const btnAddAddress = document.getElementById('btnAddAddress');
const btnSaveAddress = document.getElementById('btnSaveAddress');
const btnLogout = document.getElementById('btnLogout');

// Email modal elements
const emailModal = document.getElementById('emailModal');
const inputEmail = document.getElementById('inputEmail');
const errorEmail = document.getElementById('errorEmail');
const btnSaveEmail = document.getElementById('btnSaveEmail');

// API Helper
async function api(endpoint, options = {}) {
  const token = localStorage.getItem('customer_token') || 
                localStorage.getItem('x-customer-token') || 
                localStorage.getItem('x-token');
  
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
    headers['x-customer-token'] = token;
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'Lỗi mạng' }));
    throw new Error(err.message || err.error || 'Lỗi không xác định');
  }
  
  return response.json();
}

// Format số
function formatNumber(n) {
  return new Intl.NumberFormat('vi-VN').format(n);
}

// Get tier info
function getTierInfo(tierKey) {
  const key = String(tierKey || 'retail').toLowerCase();
  return TIER_CONFIG[key] || TIER_CONFIG.retail;
}

// Show/Hide states
function showLoading() {
  loadingState.style.display = 'block';
  errorState.style.display = 'none';
  mainContent.style.display = 'none';
}

function showError(msg) {
  errorMessage.textContent = msg;
  errorState.style.display = 'block';
  loadingState.style.display = 'none';
  mainContent.style.display = 'none';
}

function showContent() {
  mainContent.style.display = 'block';
  loadingState.style.display = 'none';
  errorState.style.display = 'none';
}

// Render customer info
function renderCustomerInfo() {
  if (!state.customer) return;
  
  const tierInfo = getTierInfo(state.customer.tier);
  
  customerInfo.innerHTML = `
    <div class="info-item">
      <div class="info-label">Họ và tên</div>
      <div class="info-value">${state.customer.full_name || 'N/A'}</div>
    </div>
	
        <div class="info-item">
      <div class="info-label">Email</div>
      <div class="info-value">
        ${state.customer.email || 'Chưa cập nhật'}
        <button type="button"
          class="btn btn-secondary"
          style="margin-left: 8px; padding: 4px 10px; font-size: 12px;"
          onclick="openEmailModal()">
          Cập nhật
        </button>
      </div>
    </div>

    <div class="info-item">
      <div class="info-label">Số điện thoại</div>
      <div class="info-value">${state.customer.phone || 'Chưa cập nhật'}</div>
    </div>
    <div class="info-item" style="background: linear-gradient(135deg, ${tierInfo.color}20 0%, ${tierInfo.color}10 100%);">
      <div class="info-label">Hạng thành viên</div>
      <div class="info-value" style="color: ${tierInfo.color};">${tierInfo.icon} ${tierInfo.name}</div>
    </div>
    <div class="info-item">
      <div class="info-label">Điểm tích lũy</div>
      <div class="info-value" style="color: #3b82f6;">${formatNumber(state.customer.points || 0)} điểm</div>
    </div>
    <div class="info-item">
      <div class="info-label">Trạng thái</div>
      <div class="info-value" style="color: ${state.customer.status === 'active' ? '#10b981' : '#ef4444'};">
        ${state.customer.status === 'active' ? '✅ Hoạt động' : '❌ Bị khóa'}
      </div>
    </div>
  `;
}

// Render addresses list
function renderAddresses() {
  addressCount.textContent = state.addresses.length;
  
  if (state.addresses.length === 0) {
    addressesList.innerHTML = '';
    emptyAddresses.style.display = 'block';
    return;
  }
  
  emptyAddresses.style.display = 'none';
  
  addressesList.innerHTML = state.addresses.map(addr => `
    <div class="address-card ${addr.is_default ? 'default' : ''}">
      ${addr.is_default ? '<span class="default-badge">Mặc định</span>' : ''}
      
      <div style="font-weight: 600; font-size: 16px; color: #1f2937; margin-bottom: 8px;">
        ${addr.name} - ${addr.phone}
      </div>
      
      <div style="color: #6b7280; font-size: 14px; margin-bottom: 8px;">
        ${addr.address}, ${addr.ward_name || ''}, ${addr.district_name || ''}, ${addr.province_name || ''}
      </div>
      
      ${addr.note ? `<div style="color: #9ca3af; font-size: 12px; margin-bottom: 8px;">Ghi chú: ${addr.note}</div>` : ''}
      
      <div style="display: flex; gap: 8px; margin-top: 12px; flex-wrap: wrap;">
        <button onclick="editAddress('${addr.id}')" class="btn btn-primary" style="padding: 6px 12px; font-size: 13px;">
          ✏️ Sửa
        </button>
        <button onclick="deleteAddress('${addr.id}')" class="btn btn-danger" style="padding: 6px 12px; font-size: 13px;">
          🗑️ Xóa
        </button>
        ${!addr.is_default ? `
        <button onclick="setDefaultAddress('${addr.id}')" class="btn btn-secondary" style="padding: 6px 12px; font-size: 13px;">
          ⭐ Đặt mặc định
        </button>
        ` : ''}
      </div>
    </div>
  `).join('');
}

// Load customer data
async function loadCustomerData() {
  try {
    const data = await api('/api/customers/me');
    if (data.customer) {
      state.customer = data.customer;
      renderCustomerInfo();
    }
  } catch (e) {
    console.error('Load customer error:', e);
    throw e;
  }
}

// Load addresses
async function loadAddresses() {
  try {
    const data = await api('/api/addresses');
    state.addresses = data.addresses || [];
    renderAddresses();
  } catch (e) {
    console.error('Load addresses error:', e);
    state.addresses = [];
    renderAddresses();
  }
}

// Load provinces
async function loadProvinces() {
  try {
    const data = await api('/shipping/provinces');
    state.provinces = data.items || [];
    
    const select = document.getElementById('inputProvince');
    select.innerHTML = '<option value="">Chọn Tỉnh/Thành phố</option>' +
      state.provinces.map(p => `<option value="${p.code}">${p.name}</option>`).join('');
  } catch (e) {
    console.error('Load provinces error:', e);
  }
}

// Load districts
async function loadDistricts(provinceCode) {
  try {
    const data = await api(`/shipping/districts?province_code=${encodeURIComponent(provinceCode)}`);
    state.districts = data.items || [];
    
    const select = document.getElementById('inputDistrict');
    select.innerHTML = '<option value="">Chọn Quận/Huyện</option>' +
      state.districts.map(d => `<option value="${d.code}">${d.name}</option>`).join('');
  } catch (e) {
    console.error('Load districts error:', e);
  }
}

// Load wards
async function loadWards(districtCode) {
  try {
    const data = await api(`/shipping/wards?district_code=${encodeURIComponent(districtCode)}`);
    state.wards = data.items || [];
    
    const select = document.getElementById('inputWard');
    select.innerHTML = '<option value="">Chọn Phường/Xã</option>' +
      state.wards.map(w => `<option value="${w.code}">${w.name}</option>`).join('');
  } catch (e) {
    console.error('Load wards error:', e);
  }
}

// Email modal
window.openEmailModal = function() {
  if (!emailModal) return;
  if (inputEmail) {
    inputEmail.value = (state.customer && state.customer.email) || '';
  }
  if (errorEmail) {
    errorEmail.textContent = '';
    errorEmail.style.display = 'none';
  }
  emailModal.style.display = 'flex';
};

window.closeEmailModal = function() {
  if (!emailModal) return;
  emailModal.style.display = 'none';
};

async function saveEmail() {
  if (!inputEmail || !errorEmail) return;

  const email = inputEmail.value.trim();
  errorEmail.style.display = 'none';
  errorEmail.textContent = '';

  if (!email) {
    errorEmail.textContent = 'Vui lòng nhập email';
    errorEmail.style.display = 'block';
    return;
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    errorEmail.textContent = 'Email không hợp lệ';
    errorEmail.style.display = 'block';
    return;
  }

  try {
    const res = await api('/api/customers/me', {
      method: 'PUT',
      body: JSON.stringify({ email })
    });

    if (res && res.ok) {
      const customer = res.customer || state.customer || {};
      state.customer = { ...customer, email };
      renderCustomerInfo();
      window.closeEmailModal();
      alert('✅ Cập nhật email thành công!');
    } else {
      throw new Error(res && res.message ? res.message : 'Cập nhật thất bại');
    }
  } catch (e) {
    console.error('Update email error:', e);
    errorEmail.textContent = e.message || 'Có lỗi xảy ra, vui lòng thử lại';
    errorEmail.style.display = 'block';
  }
}

// Open add address modal
window.openAddAddressModal = function() {

  state.editingAddressId = null;
  modalTitle.textContent = 'Thêm địa chỉ mới';
  
  // Reset form
  document.getElementById('editingAddressId').value = '';
  document.getElementById('inputName').value = '';
  document.getElementById('inputPhone').value = '';
  document.getElementById('inputProvince').value = '';
  document.getElementById('inputDistrict').innerHTML = '<option value="">Chọn Quận/Huyện</option>';
  document.getElementById('inputWard').innerHTML = '<option value="">Chọn Phường/Xã</option>';
  document.getElementById('inputAddress').value = '';
  document.getElementById('inputAddressType').value = 'home';
  document.getElementById('inputNote').value = '';
  
  // Hide errors
  ['errorName', 'errorPhone', 'errorProvince', 'errorDistrict', 'errorWard', 'errorAddress'].forEach(id => {
    document.getElementById(id).style.display = 'none';
    document.getElementById(id).textContent = '';
  });
  
  addressModal.style.display = 'flex';
  document.getElementById('modalForm').style.display = 'block';
  document.getElementById('modalLoading').style.display = 'none';
  document.getElementById('modalError').style.display = 'none';
};

// Edit address
window.editAddress = async function(addressId) {
  const address = state.addresses.find(a => a.id === addressId);
  if (!address) return;
  
  state.editingAddressId = addressId;
  modalTitle.textContent = 'Chỉnh sửa địa chỉ';
  
  // Fill form
  document.getElementById('editingAddressId').value = addressId;
  document.getElementById('inputName').value = address.name || '';
  document.getElementById('inputPhone').value = address.phone || '';
  document.getElementById('inputAddress').value = address.address || '';
  document.getElementById('inputAddressType').value = address.address_type || 'home';
  document.getElementById('inputNote').value = address.note || '';
  
  // Load location data
  if (address.province_code) {
    document.getElementById('inputProvince').value = address.province_code;
    await loadDistricts(address.province_code);
    
    if (address.district_code) {
      document.getElementById('inputDistrict').value = address.district_code;
      await loadWards(address.district_code);
      
      if (address.ward_code) {
        document.getElementById('inputWard').value = address.ward_code;
      }
    }
  }
  
  // Hide errors
  ['errorName', 'errorPhone', 'errorProvince', 'errorDistrict', 'errorWard', 'errorAddress'].forEach(id => {
    document.getElementById(id).style.display = 'none';
  });
  
  addressModal.style.display = 'flex';
  document.getElementById('modalForm').style.display = 'block';
  document.getElementById('modalLoading').style.display = 'none';
  document.getElementById('modalError').style.display = 'none';
};

// Close modal
window.closeAddressModal = function() {
  addressModal.style.display = 'none';
  state.editingAddressId = null;
};

// Validate form
function validateAddressForm() {
  const name = document.getElementById('inputName').value.trim();
  const phone = document.getElementById('inputPhone').value.trim();
  const province = document.getElementById('inputProvince').value;
  const district = document.getElementById('inputDistrict').value;
  const ward = document.getElementById('inputWard').value;
  const address = document.getElementById('inputAddress').value.trim();
  
  let hasError = false;
  
  // Reset errors
  ['errorName', 'errorPhone', 'errorProvince', 'errorDistrict', 'errorWard', 'errorAddress'].forEach(id => {
    document.getElementById(id).style.display = 'none';
  });
  
  // Validate name
  if (!name) {
    document.getElementById('errorName').textContent = 'Vui lòng nhập họ và tên';
    document.getElementById('errorName').style.display = 'block';
    hasError = true;
  }
  
  // Validate phone
  const phoneRegex = /^(03|05|07|08|09)\d{8}$/;
  if (!phone) {
    document.getElementById('errorPhone').textContent = 'Vui lòng nhập số điện thoại';
    document.getElementById('errorPhone').style.display = 'block';
    hasError = true;
  } else if (!phoneRegex.test(phone.replace(/\D/g, ''))) {
    document.getElementById('errorPhone').textContent = 'Số điện thoại không hợp lệ (VD: 0912345678)';
    document.getElementById('errorPhone').style.display = 'block';
    hasError = true;
  }
  
  // Validate province
  if (!province) {
    document.getElementById('errorProvince').textContent = 'Vui lòng chọn Tỉnh/Thành phố';
    document.getElementById('errorProvince').style.display = 'block';
    hasError = true;
  }
  
  // Validate district
  if (!district) {
    document.getElementById('errorDistrict').textContent = 'Vui lòng chọn Quận/Huyện';
    document.getElementById('errorDistrict').style.display = 'block';
    hasError = true;
  }
  
  // Validate ward (optional but recommended)
  if (!ward) {
    document.getElementById('errorWard').textContent = 'Vui lòng chọn Phường/Xã';
    document.getElementById('errorWard').style.display = 'block';
    hasError = true;
  }
  
  // Validate address
  if (!address) {
    document.getElementById('errorAddress').textContent = 'Vui lòng nhập địa chỉ chi tiết';
    document.getElementById('errorAddress').style.display = 'block';
    hasError = true;
  } else if (address.length < 10) {
    document.getElementById('errorAddress').textContent = 'Địa chỉ quá ngắn (tối thiểu 10 ký tự)';
    document.getElementById('errorAddress').style.display = 'block';
    hasError = true;
  }
  
  return !hasError;
}

// Save address
async function saveAddress() {
  if (!validateAddressForm()) return;
  
  // Show loading
  document.getElementById('modalForm').style.display = 'none';
  document.getElementById('modalLoading').style.display = 'block';
  document.getElementById('modalError').style.display = 'none';
  
  try {
    const province = state.provinces.find(p => p.code === document.getElementById('inputProvince').value);
    const district = state.districts.find(d => d.code === document.getElementById('inputDistrict').value);
    const ward = state.wards.find(w => w.code === document.getElementById('inputWard').value);
    
    const payload = {
      name: document.getElementById('inputName').value.trim(),
      phone: document.getElementById('inputPhone').value.trim().replace(/\D/g, ''),
      province_code: document.getElementById('inputProvince').value,
      province_name: province?.name || '',
      district_code: document.getElementById('inputDistrict').value,
      district_name: district?.name || '',
      ward_code: document.getElementById('inputWard').value,
      ward_name: ward?.name || '',
      address: document.getElementById('inputAddress').value.trim(),
      address_type: document.getElementById('inputAddressType').value,
      note: document.getElementById('inputNote').value.trim()
    };
    
    let response;
    if (state.editingAddressId) {
      // Update
      response = await api(`/api/addresses/${state.editingAddressId}`, {
        method: 'PUT',
        body: JSON.stringify(payload)
      });
    } else {
      // Create
      response = await api('/api/addresses', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
    }
    
    if (response && response.ok) {
      alert(state.editingAddressId ? '✅ Cập nhật địa chỉ thành công!' : '✅ Thêm địa chỉ thành công!');
      closeAddressModal();
      await loadAddresses();
    } else {
      throw new Error(response.message || 'Lưu địa chỉ thất bại');
    }
  } catch (error) {
    console.error('Save address error:', error);
    document.getElementById('modalLoading').style.display = 'none';
    document.getElementById('modalForm').style.display = 'block';
    document.getElementById('modalError').textContent = '❌ ' + (error.message || 'Có lỗi xảy ra. Vui lòng thử lại.');
    document.getElementById('modalError').style.display = 'block';
  }
}

// Delete address
window.deleteAddress = async function(addressId) {
  const address = state.addresses.find(a => a.id === addressId);
  if (!address) return;
  
  if (!confirm(`Bạn có chắc muốn xóa địa chỉ này?\n\n${address.name} - ${address.phone}\n${address.address}`)) {
    return;
  }
  
  try {
    const response = await api(`/api/addresses/${addressId}`, {
      method: 'DELETE'
    });
    
    if (response && response.ok) {
      alert('✅ Đã xóa địa chỉ thành công');
      await loadAddresses();
    } else {
      throw new Error('Xóa địa chỉ thất bại');
    }
  } catch (error) {
    console.error('Delete address error:', error);
    alert('❌ ' + (error.message || 'Có lỗi xảy ra. Vui lòng thử lại.'));
  }
};

// Set default address
window.setDefaultAddress = async function(addressId) {
  try {
    const response = await api(`/api/addresses/${addressId}/default`, {
      method: 'PUT'
    });
    
    if (response && response.ok) {
      await loadAddresses();
    } else {
      throw new Error('Đặt địa chỉ mặc định thất bại');
    }
  } catch (error) {
    console.error('Set default error:', error);
    alert('❌ ' + (error.message || 'Có lỗi xảy ra. Vui lòng thử lại.'));
  }
};

// Logout
function handleLogout() {
  if (!confirm('Bạn có chắc muốn đăng xuất?')) return;
  
  localStorage.removeItem('customer_token');
  localStorage.removeItem('x-customer-token');
  localStorage.removeItem('x-token');
  localStorage.removeItem('customer_info');
  
  window.location.href = '/login.html';
}

// Init
async function init() {
  showLoading();
  
  try {
    const token = localStorage.getItem('customer_token') || 
                  localStorage.getItem('x-customer-token') || 
                  localStorage.getItem('x-token');
    
    if (!token) {
      showError('Vui lòng đăng nhập để xem thông tin tài khoản');
      return;
    }
    
    // Load all data
    await Promise.all([
      loadCustomerData(),
      loadAddresses(),
      loadProvinces()
    ]);
    
    showContent();
    
  } catch (error) {
    console.error('Init error:', error);
    showError('Lỗi khi tải thông tin: ' + error.message);
  }
}

// Event listeners (check tồn tại để tránh lỗi ở trang không có modal địa chỉ)
if (btnAddAddress) {
  btnAddAddress.addEventListener('click', openAddAddressModal);
}
if (btnSaveAddress) {
  btnSaveAddress.addEventListener('click', saveAddress);
}
if (btnLogout) {
  btnLogout.addEventListener('click', handleLogout);
}

if (btnSaveEmail) {
  btnSaveEmail.addEventListener('click', saveEmail);
}

if (emailModal) {
  emailModal.addEventListener('click', (e) => {
    if (e.target === emailModal) {
      window.closeEmailModal();
    }
  });
}



// Province change
const provinceSelect = document.getElementById('inputProvince');
if (provinceSelect) {
  provinceSelect.addEventListener('change', async (e) => {
    const provinceCode = e.target.value;
    const districtSelect = document.getElementById('inputDistrict');
    const wardSelect = document.getElementById('inputWard');

    if (districtSelect) {
      districtSelect.innerHTML = '<option value="">Chọn Quận/Huyện</option>';
    }
    if (wardSelect) {
      wardSelect.innerHTML = '<option value="">Chọn Phường/Xã</option>';
    }

    if (provinceCode) {
      await loadDistricts(provinceCode);
    }
  });
}

// District change
const districtSelect = document.getElementById('inputDistrict');
if (districtSelect) {
  districtSelect.addEventListener('change', async (e) => {
    const districtCode = e.target.value;
    const wardSelect = document.getElementById('inputWard');
    
    if (wardSelect) {
      wardSelect.innerHTML = '<option value="">Chọn Phường/Xã</option>';
    }
    
    if (districtCode) {
      await loadWards(districtCode);
    }
  });
}

// Close modal on background click
if (addressModal) {
  addressModal.addEventListener('click', (e) => {
    if (e.target.id === 'addressModal') {
      closeAddressModal();
    }
  });
}

// Initialize
document.addEventListener('DOMContentLoaded', init);