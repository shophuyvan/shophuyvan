/**
 * Waybill Creator - Tạo vận đơn (Complete Version)
 * Version: 2.1 - FIXED
 */

class WaybillCreator {
  constructor() {
    this.baseURL = window.Admin?.getApiBase() || 'https://shv-api.shophuyvan.workers.dev';
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

    console.log('[WaybillCreator] Receiver info:', receiver);
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

    return errors;
  }

  // ==================== BUILD PAYLOAD ====================
  
  buildPayload(order, sender, receiver) {
    const items = (order.items || []).map((item, idx) => {
      // Fix weight - default 500g per item if missing
      let weight = Number(item.weight_gram || item.weight_grams || item.weight || 0);
      if (weight <= 0) {
        weight = 500; // Default 500g
      }
      
      // Fix name - truncate if too long
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
        price: Number(item.price || 0),
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
      service_code: order.shipping_service || order.service_code || ''
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

      const payload = this.buildPayload(order, sender, receiver);
      console.log('[WaybillCreator] Payload:', JSON.stringify(payload, null, 2));

      const result = await this.callAPI('/admin/shipping/create', payload);
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
    const token = localStorage.getItem('x-token') || '';
    
    const response = await fetch(this.baseURL + endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-token': token
      },
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
    
    const tracking = result.tracking || result.tracking_code || 
                    result.code || result.waybill_code || '';

    if (tracking) {
      try {
        await this.callAPI('/admin/orders/upsert', {
          id: order.id,
          tracking_code: tracking,
          shipping_provider: result.provider || order.shipping_provider,
          status: 'shipping'
        });
        console.log('[WaybillCreator] ✅ Updated order with tracking:', tracking);
      } catch (e) {
        console.warn('[WaybillCreator] ⚠️ Update order error:', e);
      }

      alert(`✅ TẠO VẬN ĐƠN THÀNH CÔNG!\n\n` +
            `Mã vận đơn: ${tracking}\n` +
            `Nhà vận chuyển: ${result.provider || order.shipping_provider || ''}\n\n` +
            `Đơn hàng đã được cập nhật.`);

      if (window.ordersManager) {
        window.ordersManager.openPrintWaybill(order, tracking);
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
}

// Global instance
window.waybillCreator = new WaybillCreator();
window.WaybillCreator = WaybillCreator;

console.log('[WaybillCreator] Initialized ✅');