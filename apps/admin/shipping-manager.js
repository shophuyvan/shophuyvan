/**
 * Shipping Manager - Quản lý vận chuyển và warehouse
 * Version: 2.0
 */

class ShippingManager {
  constructor() {
    this.baseURL = 'https://api.shophuyvan.vn';
    this.saveTimer = null;
    this.lastSaved = {};
  }

  // ==================== HELPERS ====================
  $(id) {
    return document.getElementById(id);
  }

  getToken() {
    const token = this.$('super_key')?.value || 
                  localStorage.getItem('x-token') || 
                  localStorage.getItem('super_token') || '';
    return token.trim();
  }

  toast(msg) {
    if (window.Admin?.toast) {
      window.Admin.toast(msg);
    } else {
      alert(msg);
    }
  }

  normalize(text) {
    return (text || '').toString()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/[^a-z0-9 ]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  findByName(list, searchName) {
    const normalized = this.normalize(searchName);
    return list.find(item => 
      this.normalize(item.name || item.label || '') === normalized
    );
  }

  // ==================== API CALLS ====================
  async apiCall(path, options = {}) {
    try {
      const url = path.startsWith('http') ? path : this.baseURL + path;
      const token = this.getToken();
      
      // CRITICAL: Luôn gửi token trong header
      const headers = {
  'Content-Type': 'application/json'
};

if (token) {
  headers['Token'] = token.trim();
  // (tuỳ chọn) vẫn giữ x-token nếu bạn dùng cho mục đích khác
  headers['x-token'] = token.trim();
}

      const config = {
        method: options.method || 'GET',
        headers,
        credentials: 'include'
      };

      if (options.body && config.method === 'POST') {
        config.body = JSON.stringify(options.body);
      }

      console.log(`[API] ${config.method} ${path}`, { hasToken: !!token });

      const response = await fetch(url, config);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || `HTTP ${response.status}`);
      }

      return data;
    } catch (error) {
      console.error('[API Error]', path, error);
      return { ok: false, error: true, message: error.message };
    }
  }

  // ==================== LOAD AREAS ====================
  async loadProvinces(selectedCode = '') {
    const data = await this.apiCall('/shipping/provinces');
    const sel = this.$('sender_province_sel');
    if (!sel) return [];

    sel.innerHTML = '<option value="">— Chọn Tỉnh/Thành —</option>';
    const items = data?.items || [];
    
    items.sort((a, b) => a.name.localeCompare(b.name));
    items.forEach(item => {
      const opt = document.createElement('option');
      opt.value = item.code;
      opt.textContent = item.name;
      if (item.code === selectedCode) opt.selected = true;
      sel.appendChild(opt);
    });

    sel.disabled = false;
    return items;
  }

  async loadDistricts(provinceCode, selectedCode = '') {
    if (!provinceCode) return [];
    
    const data = await this.apiCall(`/shipping/districts?province_code=${provinceCode}`);
    const sel = this.$('sender_district_sel');
    if (!sel) return [];

    sel.innerHTML = '<option value="">— Chọn Quận/Huyện —</option>';
    const items = data?.items || [];
    
    items.sort((a, b) => a.name.localeCompare(b.name));
    items.forEach(item => {
      const opt = document.createElement('option');
      opt.value = item.code;
      opt.textContent = item.name;
      if (item.code === selectedCode) opt.selected = true;
      sel.appendChild(opt);
    });

    sel.disabled = false;
    return items;
  }

  async loadWards(districtCode, selectedCode = '') {
    if (!districtCode) return [];
    
    const data = await this.apiCall(`/shipping/wards?district_code=${districtCode}`);
    const sel = this.$('sender_commune_sel');
    if (!sel) return [];

    sel.innerHTML = '<option value="">— Chọn Phường/Xã —</option>';
    const items = data?.items || [];
    
    items.sort((a, b) => a.name.localeCompare(b.name));
    items.forEach(item => {
      const opt = document.createElement('option');
      opt.value = item.code;
      opt.textContent = item.name;
      if (item.code === selectedCode) opt.selected = true;
      sel.appendChild(opt);
    });

    sel.disabled = false;
    return items;
  }

  // ==================== SYNC FROM WAREHOUSES ====================
  async syncFromWarehouses() {
    try {
      // Kiểm tra token trước khi sync
      const token = this.getToken();
      if (!token) {
        alert('⚠️ Vui lòng nhập và lưu Super Token trước khi đồng bộ!');
        return;
      }

      console.log('[Sync] Starting warehouse sync with token:', token.substring(0, 20) + '...');

      let response = await this.apiCall('/shipping/warehouses');
      let warehouses = response?.items || response?.data || [];

      // Retry với POST nếu GET thất bại
      if (!warehouses.length) {
        console.log('[Sync] Retrying with POST method...');
        response = await this.apiCall('/shipping/warehouses', { method: 'POST' });
        warehouses = response?.items || response?.data || [];
      }

      if (!warehouses.length) {
        alert('❌ Không lấy được thông tin warehouse.\n\nKiểm tra:\n1. Token đã đúng chưa?\n2. API có hoạt động không?\n\nChi tiết: ' + JSON.stringify(response).substring(0, 200));
        return;
      }

      const warehouse = warehouses[0];
      console.log('[Sync] Warehouse data:', warehouse);

      // Lấy thông tin từ warehouse
      const name = warehouse.name || warehouse.contact_name || warehouse.wh_name || '';
      const phone = warehouse.phone || warehouse.contact_phone || warehouse.mobile || '';
      const address = warehouse.addr || warehouse.address || warehouse.formatted_address || '';

      let provinceCode = warehouse.province_code || warehouse.provinceId || warehouse.province?.code || '';
      let districtCode = warehouse.district_code || warehouse.districtId || warehouse.district?.code || '';
      let wardCode = warehouse.ward_code || warehouse.commune_code || warehouse.ward?.code || '';

      const provinceName = warehouse.province_name || warehouse.province?.name || '';
      const districtName = warehouse.district_name || warehouse.district?.name || '';
      const wardName = warehouse.ward_name || warehouse.commune_name || warehouse.ward?.name || '';

      console.log('[Sync] 🔍 Warehouse location data:', {
        provinceCode, provinceName,
        districtCode, districtName,
        wardCode, wardName
      });

      // ✅ FIX CRITICAL: Nếu thiếu mã tỉnh/quận, bắt buộc phải map từ tên
      if (!provinceCode && !provinceName) {
        alert('⚠️ Warehouse thiếu thông tin tỉnh/thành phố!');
        return;
      }

      if (!districtCode && !districtName) {
        alert('⚠️ Warehouse thiếu thông tin quận/huyện!');
        return;
      }

      // ✅ FIX: Nếu thiếu province_code, tìm theo tên
      if (!provinceCode && provinceName) {
        console.log('[Sync] Province code missing, searching by name:', provinceName);
      }
      
      // ✅ FIX: Nếu thiếu district_code, tìm theo tên
      if (!districtCode && districtName) {
        console.log('[Sync] District code missing, searching by name:', districtName);
      }

      // Fill vào form
      if (this.$('sender_name')) this.$('sender_name').value = name;
      if (this.$('sender_phone')) this.$('sender_phone').value = phone;
      if (this.$('sender_address')) this.$('sender_address').value = address;

      // ✅ Load và select province - BẮT BUỘC phải có
      console.log('[Sync] Loading provinces list...');
      const provinces = await this.loadProvinces();
      
      // ✅ LUÔN LUÔN map theo tên nếu thiếu mã
      if (!provinceCode && provinceName) {
        console.log('[Sync] 🔍 Mapping province by name:', provinceName);
        const match = this.findByName(provinces, provinceName);
        if (match) {
          provinceCode = match.code;
          console.log('[Sync] ✅ Found province code:', provinceCode);
        } else {
          console.error('[Sync] ❌ Cannot find province code for:', provinceName);
          alert(`❌ Không tìm thấy mã tỉnh cho: ${provinceName}\n\nVui lòng kiểm tra lại!`);
          return;
        }
      }
      
      if (!provinceCode) {
        alert('❌ Không xác định được mã tỉnh/thành phố!');
        return;
      }
          console.log('[Sync] ✅ Found province code by name:', provinceName, '→', provinceCode);
        } else {
          console.warn('[Sync] ⚠️ Cannot find province code for:', provinceName);
        }
      }

      if (provinceCode) {
        this.$('sender_province_sel').value = provinceCode;
        if (this.$('sender_province_code')) this.$('sender_province_code').value = provinceCode;
        if (this.$('sender_province')) {
          this.$('sender_province').value = provinceName || 
            provinces.find(p => p.code === provinceCode)?.name || '';
        }

        // ✅ Load districts - BẮT BUỘC phải có
        console.log('[Sync] Loading districts for province:', provinceCode);
        const districts = await this.loadDistricts(provinceCode);
        
        // ✅ LUÔN LUÔN map theo tên nếu thiếu mã
        if (!districtCode && districtName) {
          console.log('[Sync] 🔍 Mapping district by name:', districtName);
          const match = this.findByName(districts, districtName);
          if (match) {
            districtCode = match.code;
            console.log('[Sync] ✅ Found district code:', districtCode);
          } else {
            console.error('[Sync] ❌ Cannot find district code for:', districtName);
            alert(`❌ Không tìm thấy mã quận/huyện cho: ${districtName}\n\nVui lòng chọn thủ công!`);
            // Không return, để user có thể chọn thủ công
          }
        }
        
        if (!districtCode) {
          console.warn('[Sync] ⚠️ District code missing, user needs to select manually');
        }

        if (districtCode) {
          this.$('sender_district_sel').value = districtCode;
          if (this.$('sender_district_code')) this.$('sender_district_code').value = districtCode;
          if (this.$('sender_district')) {
            this.$('sender_district').value = districtName || 
              districts.find(d => d.code === districtCode)?.name || '';
          }

          // Load wards
          const wards = await this.loadWards(districtCode);
          if (!wardCode && wardName) {
            const match = this.findByName(wards, wardName);
            if (match) wardCode = match.code;
          }

          if (wardCode) {
            this.$('sender_commune_sel').value = wardCode;
            if (this.$('sender_commune_code')) this.$('sender_commune_code').value = wardCode;
          }
        }
      }

      // Trigger change events
      ['sender_province_sel', 'sender_district_sel', 'sender_commune_sel'].forEach(id => {
        const el = this.$(id);
        if (el) el.dispatchEvent(new Event('change', { bubbles: true }));
      });

      // Auto-save
      await this.saveSender();

      this.toast('✅ Đã đồng bộ và lưu thông tin người gửi');
    } catch (error) {
      console.error('[Sync Error]', error);
      alert('❌ Lỗi đồng bộ warehouse:\n' + error.message);
    }
  }

  // ==================== SAVE SENDER ====================
  async saveSender() {
    try {
      const phone = (this.$('sender_phone')?.value || '').replace(/\D+/g, '');
      const provCode = this.$('sender_province_sel')?.value || '';
      const distCode = this.$('sender_district_sel')?.value || '';

      // Validation
      if (!phone) {
        alert('Vui lòng nhập SĐT người gửi (chỉ số).');
        return false;
      }
      if (!provCode) {
        alert('Vui lòng chọn Tỉnh/Thành của người gửi.');
        return false;
      }
      if (!distCode) {
        alert('Vui lòng chọn Quận/Huyện của người gửi.');
        return false;
      }

      const pairs = [
        ['shipping.sender_name', this.$('sender_name')?.value?.trim() || ''],
        ['shipping.sender_phone', phone],
        ['shipping.sender_address', this.$('sender_address')?.value?.trim() || ''],
        ['shipping.sender_province', this.$('sender_province')?.value?.trim() || ''],
        ['shipping.sender_district', this.$('sender_district')?.value?.trim() || ''],
        ['shipping.sender_commune', (this.$('sender_commune_sel')?.selectedOptions?.[0]?.textContent || '').trim()],
        ['shipping.sender_province_code', provCode],
        ['shipping.sender_district_code', distCode],
        ['shipping.sender_commune_code', this.$('sender_commune_sel')?.value || ''],
        ['shipping.warehouse_code', this.$('warehouse_code')?.value?.trim() || ''],
        ['shipping.option_id', this.$('option_id')?.value?.trim() || '1']
      ];

      for (const [path, value] of pairs) {
        await window.Admin.req('/admin/settings/upsert', {
          method: 'POST',
          body: { path, value }
        });
      }

      this.toast('✅ Đã lưu thông tin người gửi');
      return true;
    } catch (error) {
      console.error('[Save Error]', error);
      this.toast('❌ Lỗi lưu: ' + error.message);
      return false;
    }
  }

  // ==================== DEBOUNCED AUTO-SAVE ====================
  autoSave() {
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => this.saveSender(), 800);
  }

  // ==================== LOAD SETTINGS ====================
  async loadSettings() {
    try {
      const response = await fetch(this.baseURL + '/public/settings');
      const data = await response.json();
      
      const get = (path, defaultVal = '') => {
        return path.split('.').reduce((obj, key) => 
          (obj || {})[key], data.settings || data) || defaultVal;
      };

      // Fill form
      const set = (id, val) => {
        const el = this.$(id);
        if (el && !el.value) el.value = val || '';
      };

      set('sender_name', get('shipping.sender_name'));
      set('sender_phone', get('shipping.sender_phone'));
      set('sender_address', get('shipping.sender_address'));
      set('sender_province', get('shipping.sender_province'));
      set('sender_district', get('shipping.sender_district'));
      set('warehouse_code', get('shipping.warehouse_code'));
      set('option_id', get('shipping.option_id', '1'));
      set('sender_province_code', get('shipping.sender_province_code'));
      set('sender_district_code', get('shipping.sender_district_code'));
      set('sender_commune_code', get('shipping.sender_commune_code'));
      set('super_key', get('shipping.super_key') || localStorage.getItem('x-token'));

      // Load cascading selects
      const provCode = get('shipping.sender_province_code');
      const distCode = get('shipping.sender_district_code');
      const wardCode = get('shipping.sender_commune_code');

      await this.loadProvinces(provCode);
      
      if (provCode) {
        this.$('sender_province_sel').value = provCode;
        await this.loadDistricts(provCode, distCode);
      }

      if (distCode) {
        this.$('sender_district_sel').value = distCode;
        await this.loadWards(distCode, wardCode);
      }

      if (wardCode) {
        this.$('sender_commune_sel').value = wardCode;
      }
    } catch (error) {
      console.error('[Load Settings Error]', error);
    }
  }

  // ==================== WIRE EVENTS ====================
  wireEvents() {
    // Sync button
    const syncBtn = this.$('sync-warehouses');
    if (syncBtn) {
      syncBtn.onclick = () => this.syncFromWarehouses();
    }

    // Save button
    const saveBtn = this.$('save_sender');
    if (saveBtn) {
      saveBtn.onclick = (e) => {
        e.preventDefault();
        this.saveSender();
      };
    }

    // Province change
    const provSel = this.$('sender_province_sel');
    if (provSel) {
      provSel.onchange = async () => {
        const code = provSel.value;
        if (this.$('sender_province_code')) this.$('sender_province_code').value = code;
        if (this.$('sender_province')) {
          this.$('sender_province').value = provSel.selectedOptions[0]?.textContent || '';
        }
        await this.loadDistricts(code);
        this.autoSave();
      };
    }

    // District change
    const distSel = this.$('sender_district_sel');
    if (distSel) {
      distSel.onchange = async () => {
        const code = distSel.value;
        if (this.$('sender_district_code')) this.$('sender_district_code').value = code;
        if (this.$('sender_district')) {
          this.$('sender_district').value = distSel.selectedOptions[0]?.textContent || '';
        }
        await this.loadWards(code);
        this.autoSave();
      };
    }

    // Ward change
    const wardSel = this.$('sender_commune_sel');
    if (wardSel) {
      wardSel.onchange = () => {
        const code = wardSel.value;
        if (this.$('sender_commune_code')) this.$('sender_commune_code').value = code;
        this.autoSave();
      };
    }

    // Auto-save on input change
    ['sender_phone', 'sender_address', 'sender_name'].forEach(id => {
      const el = this.$(id);
      if (el) {
        el.addEventListener('blur', () => this.autoSave());
      }
    });

    // Save token button
    const tokenBtn = this.$('save_super');
    if (tokenBtn) {
      tokenBtn.onclick = async () => {
        const key = this.$('super_key')?.value?.trim() || '';
        
        if (!key) {
          alert('⚠️ Vui lòng nhập API Super Key');
          return;
        }
        
        try {
          // Lưu token
          await window.Admin.req('/admin/settings/upsert', {
            method: 'POST',
            body: { path: 'shipping.super_key', value: key }
          });
          
          // Lưu vào localStorage để API sử dụng
          localStorage.setItem('x-token', key);
          localStorage.setItem('super_token', key);
          
          this.toast('✅ Đã lưu token, đang đồng bộ warehouse...');
          
          // Tự động đồng bộ warehouse
          await this.syncFromWarehouses();
          
        } catch (e) {
          console.error('[Save Token Error]', e);
          alert('❌ Lỗi khi lưu token: ' + e.message);
        }
      };
    }
  }

  // ==================== INIT ====================
  async init() {
    await this.loadSettings();
    this.wireEvents();
    console.log('[ShippingManager] Initialized');
  }
}

// Global instance
window.shippingManager = new ShippingManager();

// Auto-init when DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => window.shippingManager.init());
} else {
  window.shippingManager.init();
}