/* Waybill Creator - Tạo vận đơn (Complete Version)
 * Version: 2.2 - FIXED with Hardcode Mapping
 */

class WaybillCreator {
  constructor() {
    this.baseURL = window.Admin?.getApiBase() || 'https://shv-api.shophuyvan.workers.dev';
    
    // Hardcode mapping cho TP.HCM (mã 01/79)
    // Mapping từ mã nội bộ sang mã SuperAI/VTP chuẩn
    this.districtMapping = {
      // TP.HCM - Các quận nội thành
      '760': '760',  // Quận Bình Tân (mã chuẩn)
	  '767': '776',  // Quận 7 TP.HCM (map sang 776 nếu đúng)
      '279': '760',  // Quận Bình Tân (mã cũ)
      '777': '777',  // Quận 11
      '770': '770',  // Quận 1
      '771': '771',  // Quận 2 (Thủ Đức)
      '772': '772',  // Quận 3
      '773': '773',  // Quận 4
      '774': '774',  // Quận 5
      '775': '775',  // Quận 6
      '776': '776',  // Quận 7
      '778': '778',  // Quận 8
      '780': '780',  // Quận 9 (Thủ Đức)
      '781': '781',  // Quận 10
      '782': '782',  // Quận 12
      '783': '783',  // Quận Bình Thạnh
      '784': '784',  // Quận Gò Vấp
      '785': '785',  // Quận Phú Nhuận
      '786': '786',  // Quận Tân Bình
      '787': '787',  // Quận Tân Phú
      '788': '788',  // Quận Thủ Đức (cũ)
      
      // Các huyện ngoại thành
      '761': '761',  // Huyện Bình Chánh
      '762': '762',  // Huyện Cần Giờ
      '763': '763',  // Huyện Củ Chi
      '764': '764',  // Huyện Hóc Môn
      '765': '765',  // Huyện Nhà Bè
      
      // Thêm các mã khác nếu biết
    };
  }

  // ==================== GET SENDER INFO ====================
  
  async getSenderInfo() {
    try {
      const response = await fetch(this.baseURL + '/public/settings', {
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      const settings = data.settings || data;

      const get = (path, defaultValue = '') => {
        return path.split('.').reduce((obj, key) => 
          (obj || {})[key], settings) || defaultValue;
      };

      const sender = {
        name: get('shipping.sender_name', ''),
        phone: get('shipping.sender_phone', '').replace(/\D+/g, ''),
        address: get('shipping.sender_address', ''),
        province: get('shipping.sender_province', ''),
        province_code: get('shipping.sender_province_code', ''),
        district: get('shipping.sender_district', ''),
        district_code: get('shipping.sender_district_code', ''),
        commune: get('shipping.sender_commune', ''),
        commune_code: get('shipping.sender_commune_code', ''),
        ward_code: get('shipping.sender_commune_code', '')
      };

      console.log('[WaybillCreator] Sender info:', sender);
      return sender;
    } catch (error) {
      console.error('[WaybillCreator] Error loading sender:', error);
      throw new Error('Không thể tải thông tin người gửi: ' + error.message);
    }
  }

  // ==================== VALIDATE & MAP DISTRICT CODE ====================
  
  validateAndMapDistrictCode(districtCode, provinceName = '') {
  const code = String(districtCode || '').trim();
  
  // Check if mapping exists
  if (this.districtMapping[code]) {
    const mappedCode = this.districtMapping[code];
    console.log(`[WaybillCreator] 🔄 Mapped district: ${code} → ${mappedCode}`);
    return {
      code: mappedCode,
      name: this.getDistrictName(mappedCode)
    };
  }
  
  // If code is already 3 digits, return as-is
  if (/^\d{3}$/.test(code)) {
    console.log(`[WaybillCreator] ✅ District code OK: ${code}`);
    return {
      code: code,
      name: this.getDistrictName(code)
    };
  }
  
  // Warn about suspicious code
  if (code.length > 3) {
    console.warn(`[WaybillCreator] ⚠️ District code too long: ${code}`);
  }
  
  return {
    code: code,
    name: ''
  };
}
// ==================== GET DISTRICT NAME FROM CODE ====================

getDistrictName(code) {
  const districtNames = {
    '760': 'Quận Bình Tân',
    '761': 'Huyện Bình Chánh',
    '762': 'Huyện Cần Giờ',
    '763': 'Huyện Củ Chi',
    '764': 'Huyện Hóc Môn',
    '765': 'Huyện Nhà Bè',
    '770': 'Quận 1',
    '771': 'Quận 2',
    '772': 'Quận 3',
    '773': 'Quận 4',
    '774': 'Quận 5',
    '775': 'Quận 6',
    '776': 'Quận 7',
    '777': 'Quận 11',
    '778': 'Quận 8',
    '780': 'Quận 9',
    '781': 'Quận 10',
    '782': 'Quận 12',
    '783': 'Quận Bình Thạnh',
    '784': 'Quận Gò Vấp',
    '785': 'Quận Phú Nhuận',
    '786': 'Quận Tân Bình',
    '787': 'Quận Tân Phú',
    '788': 'Quận Thủ Đức'
  };
  
  return districtNames[code] || '';
}
  // ==================== VALIDATE SENDER ====================
  
  validateSender(sender) {
    const errors = [];

    if (!sender.name || sender.name.trim() === '') {
      errors.push('Tên người gửi không được để trống');
    }

    if (!sender.phone || sender.phone.trim() === '') {
      errors.push('SĐT người gửi không được để trống');
    }

    if (!sender.address || sender.address.trim() === '') {
      errors.push('Địa chỉ người gửi không được để trống');
    }

    if (!sender.province_code) {
      errors.push('Chưa chọn Tỉnh/Thành của người gửi');
    }

    if (!sender.district_code) {
      errors.push('Chưa chọn Quận/Huyện của người gửi');
    }

    return errors;
  }

  // ==================== EXTRACT RECEIVER INFO ====================
  
  extractReceiverInfo(order) {
    const customer = order.customer || {};

    const receiver = {
      name: customer.name || order.customer_name || order.name || order.receiver_name || 'Khách',
      phone: customer.phone || order.phone || order.customer_phone || order.receiver_phone || '',
      address: customer.address || order.address || order.receiver_address || '',
      
      province: customer.province || order.province || order.receiver_province || '',
      province_code: customer.province_code || order.receiver_province_code || 
                    order.province_code || order.to_province_code || '',
      
      district: customer.district || order.district || order.receiver_district || '',
      district_code: customer.district_code || order.receiver_district_code || 
                    order.district_code || order.to_district_code || '',
      
      commune: customer.commune || customer.ward || order.commune || order.ward || 
              order.receiver_commune || '',
      commune_code: customer.commune_code || customer.ward_code || 
                   order.receiver_commune_code || order.commune_code || 
                   order.ward_code || order.to_commune_code || '',
      ward_code: customer.ward_code || order.ward_code || order.receiver_ward_code || ''
    };

 console.log('[WaybillCreator] Receiver info (raw):', receiver);

// ✅ VALIDATE & MAP DISTRICT CODE
const originalCode = receiver.district_code;
const validated = this.validateAndMapDistrictCode(
  receiver.district_code, 
  receiver.province
);

receiver.district_code = validated.code;

// ✅ NẾU TÊN QUẬN BỊ RỖNG, TỰ ĐỘNG ĐIỀN
if (!receiver.district || receiver.district.trim() === '') {
  receiver.district = validated.name;
  console.log(`[WaybillCreator] ✅ Auto-filled district name: "${validated.name}"`);
}

if (originalCode !== receiver.district_code) {
  console.log(`[WaybillCreator] ✅ District code mapped: ${originalCode} → ${receiver.district_code}`);
}

return receiver;
} 
  // ==================== VALIDATE RECEIVER ====================
  
  validateReceiver(receiver) {
    const errors = [];

    if (!receiver.name || receiver.name.trim() === '') {
      errors.push('Tên người nhận không được để trống');
    }

    if (!receiver.phone || receiver.phone.trim() === '') {
      errors.push('SĐT người nhận không được để trống');
    }

    if (!receiver.address || receiver.address.trim() === '') {
      errors.push('Địa chỉ người nhận không được để trống');
    }

    if (!receiver.province_code) {
      errors.push('Chưa có mã Tỉnh/Thành phố người nhận');
    }

    if (!receiver.district_code) {
  errors.push('Chưa có mã Quận/Huyện người nhận');
}

// BẮT BUỘC WARD/COMMUNE CODE
if (!receiver.commune_code) {
  errors.push('Chưa có mã Phường/Xã (ward/commune) người nhận');
}
    return errors;
  }

  // ==================== BUILD PAYLOAD ====================
  
  buildPayload(order, sender, receiver) {
    const items = (order.items || []).map((item, idx) => {
      let weight = Number(item.weight_gram || item.weight_grams || item.weight || 0);
      if (weight <= 0) {
        weight = 500;
      }
      
      let name = String(item.name || item.title || `Sản phẩm ${idx + 1}`).trim();
      if (name.length > 100) {
        name = name.substring(0, 97) + '...';
      }
      if (!name) {
        name = `Sản phẩm ${idx + 1}`;
      }
      
      return {
        name: name,
        qty: Number(item.qty || 1),
        // Ưu tiên giá từ variants
        price: Number(
          (item.variant_price ?? (item.variant?.price)) ??
          item.price ?? 0
        ),
        weight_grams: weight
      };
    });

    const totalWeight = items.reduce((sum, item) => 
      sum + (item.weight_grams || 500) * (item.qty || 1), 0);

    const payload = {
      provider: (order.shipping_provider || order.provider || 'vtp').toLowerCase(),
      order_id: String(order.id || order._id || ''),
      
      sender_name: sender.name.trim(),
      sender_phone: sender.phone,
      sender_address: sender.address.trim(),
      sender_province: sender.province.trim(),
      sender_province_code: String(sender.province_code),
      sender_district: sender.district.trim(),
      sender_district_code: String(sender.district_code),
      sender_commune: sender.commune.trim(),
      sender_commune_code: String(sender.commune_code),
      sender_ward_code: String(sender.ward_code),
      
      receiver_name: receiver.name.trim(),
      receiver_phone: receiver.phone.replace(/\D+/g, ''),
      receiver_address: receiver.address.trim(),
      receiver_province: receiver.province.trim() || '',
      receiver_province_code: String(receiver.province_code),
      receiver_district: receiver.district.trim() || '',
      receiver_district_code: String(receiver.district_code),
      receiver_commune: receiver.commune.trim(),
      receiver_commune_code: String(receiver.commune_code),
      receiver_ward_code: String(receiver.ward_code),
      
      province_code: String(receiver.province_code),
      district_code: String(receiver.district_code),
      commune_code: String(receiver.commune_code),
      to_province_code: String(receiver.province_code),
      to_district_code: String(receiver.district_code),
      to_commune_code: String(receiver.commune_code),
      
      items: items,
      cod: Number(order.cod || 0),
      weight_gram: totalWeight || 500,
      note: order.note || '',
      service_code: String(order.service_code || order.shipping_service || order.service || '').trim()
    };

    return payload;
  }

  // ==================== CREATE WAYBILL ====================
  
  async createWaybill(order) {
    try {
      console.log('[WaybillCreator] Creating waybill for order:', order.id);
      
      if (window.Admin && window.Admin.toast) {
        Admin.toast('📄 Đang tạo vận đơn...');
      }

      const sender = await this.getSenderInfo();
      const senderErrors = this.validateSender(sender);
      if (senderErrors.length > 0) {
        this.showValidationError('NGƯỜI GỬI', senderErrors, sender);
        return;
      }

      const receiver = this.extractReceiverInfo(order);
      const receiverErrors = this.validateReceiver(receiver);
      if (receiverErrors.length > 0) {
        this.showValidationError('NGƯỜI NHẬN', receiverErrors, receiver);
        return;
      }

      console.log('[WaybillCreator] ✅ Receiver with validated codes:', receiver);

      const payload = this.buildPayload(order, sender, receiver);
console.log('[WaybillCreator] Payload:', JSON.stringify(payload, null, 2));
console.log('[WaybillCreator] >>> Sending codes:', {
  receiver_province_code: payload.receiver_province_code,
  receiver_district_code: payload.receiver_district_code
});

 // TỰ ĐỘNG LẤY SERVICE CODE NẾU TRỐNG (gọi SuperAI /v1/platform/orders/price)
 if (!payload.service_code || String(payload.service_code).trim() === '') {
   const fromOrder = String(order.service_code || order.shipping_service || order.service || '').trim();
   payload.service_code = fromOrder;

   if (!payload.service_code) {
     payload.service_code = await this.autoPickService(sender, receiver, order);
     if (payload.service_code) {
       // Lưu lại để lần sau không phải gọi lại
       order.service_code = payload.service_code;
     } else {
       this.handleException(new Error('Không lấy được service_code tự động (orders/price). Vui lòng chọn thủ công.'));
       return;
     }
   }
 }
// CHẶN KHI THIẾU WARD/COMMUNE CODE
if (!payload.receiver_commune_code || String(payload.receiver_commune_code).trim() === '') {
  this.handleException(new Error('Thiếu mã Phường/Xã (receiver_commune_code)'));
  return;
}

      const result = await this.callAPI('/shipping/create', payload);
      console.log('[WaybillCreator] Result:', result);

      if (result && result.ok) {
        await this.handleSuccess(order, result);
      } else {
        this.handleError(result);
      }

    } catch (error) {
      console.error('[WaybillCreator] Exception:', error);
      this.handleException(error);
    }
  }

  // ==================== CALL API ====================
  
  async callAPI(endpoint, payload) {
  // Super key duy nhất dùng cho API vận chuyển
  const SUPER_KEY = 'FxXOoDz2qlTN5joDCsBGQFqKmm1UNvOw7YPwkzm5';

  // Nếu là nhóm /shipping/* thì bắt buộc dùng SUPER_KEY
  const isShipping = /^\/shipping\//.test(endpoint);

  // Với các endpoint khác có thể dùng token đăng nhập (nếu cần)
  const loginToken =
    (localStorage.getItem('super_token') ||
     localStorage.getItem('x-token') || ''
    ).trim();

  // Quy tắc: /shipping/* => chỉ gửi Token = SUPER_KEY (không gửi Authorization)
  const headers = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'Token': isShipping ? SUPER_KEY : (loginToken || SUPER_KEY)
  };

  const response = await fetch(this.baseURL + endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`HTTP ${response.status}: ${text}`);
  }
  return await response.json();
}

  // ==================== HANDLE SUCCESS ====================
  
  async handleSuccess(order, result) {
    if (window.Admin && window.Admin.toast) {
      Admin.toast('✅ Đã tạo vận đơn thành công');
    }
    
    // SỬA: Lấy mã SuperAI và mã NV (carrier) riêng biệt
  const carrier_code = result.carrier_code || result.tracking || result.code || '';
  const superai_code = result.superai_code || '';

  if (carrier_code || superai_code) { // Sửa: Check cả 2 mã
    try {
      await this.callAPI('/admin/orders/upsert', {
        id: order.id,
        tracking_code: carrier_code, // Sửa: Dùng carrier_code cho tracking
        superai_code: superai_code,  // THÊM: Lưu mã SuperAI để in
        shipping_provider: result.provider || order.shipping_provider,
        status: 'shipping'
      });
      console.log('[WaybillCreator] ✅ Updated order with codes:', { carrier_code, superai_code }); // Sửa log
      } catch (e) {
        console.warn('[WaybillCreator] ⚠️ Update order error:', e);
      }

      alert(`✅ TẠO VẬN ĐƠN THÀNH CÔNG!\n\n` +
          `Mã vận đơn: ${carrier_code}\n` + // Sửa: Hiển thị mã NV
          `Nhà vận chuyển: ${result.provider || order.shipping_provider || ''}\n\n` +
          `Đơn hàng đã được cập nhật.`);

    if (window.ordersManager && superai_code) { // Sửa: Check superai_code
      // Sửa: Gửi mã SuperAI (superai_code) đi để in
      window.ordersManager.openPrintWaybill(order, superai_code); 
    } else if (window.ordersManager) {
       console.warn('[WaybillCreator] Không có superai_code để mở cửa sổ in.');
    }
    } else {
      alert('✅ Tạo vận đơn thành công!\n\nChi tiết:\n' + 
            JSON.stringify(result, null, 2).substring(0, 500));
    }

    setTimeout(() => {
      if (window.ordersManager) {
        window.ordersManager.loadOrders();
      }
    }, 1000);

    const modal = document.getElementById('modal-detail');
    if (modal) modal.style.display = 'none';
  }

  // ==================== HANDLE ERROR ====================
  
  handleError(result) {
    const errorMsg = result?.error || result?.message || 
                    result?.raw?.message || 'Không rõ lỗi';
    
    console.error('[WaybillCreator] ❌ Failed:', result);
    
    if (window.Admin && window.Admin.toast) {
      Admin.toast('❌ Lỗi: ' + errorMsg);
    }

    alert(`❌ TẠO VẬN ĐƠN THẤT BẠI\n\n` +
          `Lỗi: ${errorMsg}\n\n` +
          `Chi tiết:\n${JSON.stringify(result, null, 2).substring(0, 400)}\n\n` +
          `Kiểm tra:\n` +
          `1. Thông tin người gửi đã đầy đủ?\n` +
          `2. Thông tin người nhận có đúng?\n` +
          `3. API token còn hiệu lực?\n` +
          `4. Nhà vận chuyển có hoạt động?`);
  }

  // ==================== HANDLE EXCEPTION ====================
  
  handleException(error) {
    if (window.Admin && window.Admin.toast) {
      Admin.toast('❌ Lỗi: ' + error.message);
    }
    
    alert(`❌ LỖI TẠO VẬN ĐƠN\n\n` +
          `Message: ${error.message}\n\n` +
          `Vui lòng kiểm tra Console (F12) để xem chi tiết.`);
  }

  // ==================== SHOW VALIDATION ERROR ====================
  
  showValidationError(type, errors, data) {
    const errorList = errors.map((err, i) => `${i + 1}. ${err}`).join('\n');
    
    let dataInfo = '';
    if (type === 'NGƯỜI GỬI') {
      dataInfo = `Thông tin hiện tại:\n` +
                `• Tên: ${data.name || 'CHƯA CÓ'}\n` +
                `• SĐT: ${data.phone || 'CHƯA CÓ'}\n` +
                `• Địa chỉ: ${data.address || 'CHƯA CÓ'}\n` +
                `• Tỉnh code: ${data.province_code || 'CHƯA CÓ'}\n` +
                `• Quận code: ${data.district_code || 'CHƯA CÓ'}\n\n` +
                `👉 Vui lòng cập nhật trong Settings → Shipping`;
    } else {
      dataInfo = `Thông tin hiện tại:\n` +
                `• Tên: ${data.name || 'CHƯA CÓ'}\n` +
                `• SĐT: ${data.phone || 'CHƯA CÓ'}\n` +
                `• Địa chỉ: ${data.address || 'CHƯA CÓ'}\n` +
                `• Tỉnh code: ${data.province_code || 'CHƯA CÓ'}\n` +
                `• Quận code: ${data.district_code || 'CHƯA CÓ'}`;
    }
    
    alert(`⚠️ LỖI THÔNG TIN ${type}\n\n` +
          `Các lỗi:\n${errorList}\n\n` +
          `${dataInfo}`);
    
    if (window.Admin && window.Admin.toast) {
      Admin.toast(`❌ Lỗi thông tin ${type}`);
    }
  }
  // --- AUTO PICK SERVICE (SuperAI /v1/platform/orders/price) ---
  async autoPickService(sender, receiver, order) {
    try {
      const url = this.baseURL + '/v1/platform/orders/price';

      const headers = {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      };

      // Tính cân nặng & giá trị đơn
      const totalWeight =
        Number(order.weight_gram || order.weight || 0) ||
        (Array.isArray(order.items)
          ? order.items.reduce((s, it) => s + Number(it.weight_grams || it.weight || 0), 0)
          : 0) || 500;

      // --- Lấy TÊN (Names) trực tiếp từ sender/receiver objects ---
      // (Không cần tra cứu API vì TÊN đã có sẵn trong đơn hàng)
      let senderProvinceName = (sender.province || sender.province_name || '').trim();
      let senderDistrictName = (sender.district || sender.district_name || '').trim();
      let receiverProvinceName = (receiver.province || receiver.province_name || '').trim();
      let receiverDistrictName = (receiver.district || receiver.district_name || '').trim();
      
      // Log nếu thiếu tên
      if (!senderProvinceName || !senderDistrictName) {
        console.warn('[WaybillCreator] autoPickService: Thiếu TÊN Tỉnh/Huyện người gửi.');
      }
      if (!receiverProvinceName || !receiverDistrictName) {
        console.warn('[WaybillCreator] autoPickService: Thiếu TÊN Tỉnh/Huyện người nhận.');
      }

      // Body gọi orders/price (cần TÊN tỉnh/huyện)
      const body = {
        sender_province:  senderProvinceName,
        sender_district:  senderDistrictName,
        receiver_province: receiverProvinceName,
        receiver_district: receiverDistrictName,
        weight: totalWeight,
        value: Number(order.amount || order.value || 0)
      };

      const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
      const json = await res.json();
      // SỬA: Worker trả về { data: [items] } chứ không phải { data: { services: [...] } }
      const services = (json && Array.isArray(json.data)) ? json.data : [];

      if (!Array.isArray(services) || services.length === 0) {
        console.warn('[WaybillCreator] autoPickService: No services');
        return '';
      }

      // Chọn rẻ nhất theo shipment_fee
      services.sort((a, b) => Number(a.shipment_fee || 0) - Number(b.shipment_fee || 0));
      const best = services[0];

      // SuperAI trả về carrier_id; dùng carrier_id làm service_code
      return String(best.carrier_id || best.carrier_code || '').trim();
    } catch (e) {
      console.warn('[WaybillCreator] autoPickService failed:', e);
      return '';
    }
  }

}
 
// Global instance

window.waybillCreator = new WaybillCreator();
window.WaybillCreator = WaybillCreator;

console.log('[WaybillCreator] Initialized ✅ (with hardcode district mapping)');
