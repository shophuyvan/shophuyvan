/**
 * Waybill Creator - Tạo vận đơn
 * Version: 2.0
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

      // Helper to get nested value
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
      
      // Province
      province: customer.province || order.province || order.receiver_province || '',
      province_code: customer.province_code || order.receiver_province_code || 
                    order.province_code || order.to_province_code || '',
      
      // District
      district: customer.district || order.district || order.receiver_district || '',
      district_code: customer.district_code || order.receiver_district_code || 
                    order.district_code || order.to_district_code || '',
      
      // Commune/Ward
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
    const items = (order.items || []).map(item => ({
      name: item.name || item.title || 'Sản phẩm',
      qty: Number(item.qty || 1),
      price: Number(item.price || 0),
      weight_grams: Number(item.weight_gram || item.weight_grams || item.weight || 0)
    }));

    // Calculate total weight
    const totalWeight = items.reduce((sum, item) => 
      sum + (item.weight_grams || 0) * (item.qty || 1), 0);

    const payload = {
      // Provider
      provider: (order.shipping_provider || order.provider || 'vtp').toLowerCase(),
      order_id: String(order.id || order._id || ''),
      
      // Sender fields
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
      
      // Receiver fields
      receiver_name: receiver.name.trim(),
      receiver_phone: receiver.phone.replace(/\D+/g, ''),
      receiver_address: receiver.address.trim(),
      receiver_province: receiver.province.trim() || 'Tỉnh/TP',
      receiver_province_code: String(receiver.province_code),
      receiver_district: receiver.district.trim() || 'Quận/Huyện',
      receiver_district_code: String(receiver.district_code),
      receiver_commune: receiver.commune.trim(),
      receiver_commune_code: String(receiver.commune_code),
      receiver_ward_code: String(receiver.ward_code),
      
      // Aliases for backward compatibility
      province_code: String(receiver.province_code),
      district_code: String(receiver.district_code),
      commune_code: String(receiver.commune_code),
      to_province_code: String(receiver.province_code),
      to_district_code: String(receiver.district_code),
      to_commune_code: String(receiver.commune_code),
      
      // Package info
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
      Admin.toast('📄 Đang tạo vận đơn...');

      // 1. Get sender info
      const sender = await this.getSenderInfo();

      // 2. Validate sender
      const senderErrors = this.validateSender(sender);
      if (senderErrors.length > 0) {
        this.showValidationError('NGƯỜI GỬI', senderErrors, sender);
        return;
      }

      // 3. Extract receiver info
      const receiver = this.extractReceiverInfo(order);

      // 4. Validate receiver
      const receiverErrors = this.validateReceiver(receiver);
      if (receiverErrors.length > 0) {
        this.showValidationError('NGƯỜI NHẬN', receiverErrors, receiver);
        return;
      }

      // 5. Build payload
      const payload = this.buildPayload(order, sender, receiver);
      console.log('[WaybillCreator] Payload:', JSON.stringify(payload, null, 2));

      // 6. Call API
      const result = await Admin.req('/admin/shipping/create', {
        method: 'POST',
        body: payload
      });

      console.log('[WaybillCreator] Result:', result);

      // 7. Handle result
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

  // ==================== HANDLE SUCCESS ====================
  
  async handleSuccess(order, result) {
    Admin.toast('✅ Đã tạo vận đơn thành công');
    
    const tracking = result.tracking || result.tracking_code || 
                    result.code || result.waybill_code || '';

    if (tracking) {
      // Update order with tracking code
      try {
        await Admin.req('/admin/orders/upsert', {
          method: 'POST',
          body: {
            id: order.id,
            tracking_code: tracking,
            shipping_provider: result.provider || order.shipping_provider,
            status: 'shipping'
          }
        });
        console.log('[WaybillCreator] ✅ Updated order with tracking:', tracking);
      } catch (e) {
        console.warn('[WaybillCreator] ⚠️ Update order error:', e);
      }

      // Show success message with tracking
      alert(`✅ TẠO VẬN ĐƠN THÀNH CÔNG!\n\n` +
            `Mã vận đơn: ${tracking}\n` +
            `Nhà vận chuyển: ${result.provider || order.shipping_provider || ''}\n\n` +
            `Đơn hàng đã được cập nhật.`);

      // Print waybill if available
      if (window.ordersManager) {
        window.ordersManager.openPrintWaybill(order, tracking);
      }
    } else {
      alert('✅ Tạo vận đơn thành công!\n\nChi tiết:\n' + 
            JSON.stringify(result, null, 2).substring(0, 500));
    }

    // Reload orders list
    setTimeout(() => {
      if (window.ordersManager) {
        window.ordersManager.loadOrders();
      }
    }, 1000);

    // Close modal
    const modal = document.getElementById('modal-detail');
    if (modal) modal.style.display = 'none';
  }

  // ==================== HANDLE ERROR ====================
  
  handleError(result) {
    const errorMsg = result?.error || result?.message || 
                    result?.raw?.message || 'Không rõ lỗi';
    
    console.error('[WaybillCreator] ❌ Failed:', result);
    Admin.toast('❌ Lỗi: ' + errorMsg);

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
    Admin.toast('❌ Lỗi: ' + error.message);
    
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
                `• Tỉnh code: ${data.province_code || '