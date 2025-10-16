/**
 * Sender Helper - Module lấy thông tin người gửi
 * Đảm bảo tất cả các API call đều có đầy đủ thông tin sender
 */

class SenderHelper {
  constructor() {
    this.baseURL = window.Admin?.getApiBase() || 'https://shv-api.shophuyvan.workers.dev';
    this.cachedSender = null;
    this.cacheTime = 0;
    this.CACHE_DURATION = 5 * 60 * 1000; // 5 phút
  }

  /**
   * Lấy thông tin sender từ settings
   * @returns {Promise<Object>} Sender object
   */
  async getSender() {
    // Kiểm tra cache
    const now = Date.now();
    if (this.cachedSender && (now - this.cacheTime) < this.CACHE_DURATION) {
      console.log('[SenderHelper] Using cached sender');
      return this.cachedSender;
    }

    try {
      console.log('[SenderHelper] Fetching sender from settings...');
      
      const response = await fetch(this.baseURL + '/public/settings', {
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      const settings = data.settings || data;

      // Helper để lấy giá trị nested
      const get = (path, defaultValue = '') => {
        return path.split('.').reduce((obj, key) => 
          (obj || {})[key], settings) || defaultValue;
      };

      // Lấy thông tin sender
      const sender = {
        // Thông tin cơ bản (REQUIRED)
        name: get('shipping.sender_name', ''),
        phone: get('shipping.sender_phone', ''),
        address: get('shipping.sender_address', ''),

        // Tỉnh/Thành
        province: get('shipping.sender_province', ''),
        province_code: get('shipping.sender_province_code', ''),

        // Quận/Huyện
        district: get('shipping.sender_district', ''),
        district_code: get('shipping.sender_district_code', ''),

        // Phường/Xã
        commune: get('shipping.sender_commune', ''),
        commune_code: get('shipping.sender_commune_code', ''),
        ward_code: get('shipping.sender_commune_code', ''), // Alias

        // Option ID
        option_id: get('shipping.option_id', '1')
      };

      // Validation
      if (!sender.name || sender.name.trim() === '') {
        console.warn('[SenderHelper] ⚠️ Sender name is empty!');
        throw new Error('Chưa cấu hình tên người gửi. Vui lòng vào trang Vận chuyển để cấu hình.');
      }

      if (!sender.phone || sender.phone.trim() === '') {
        console.warn('[SenderHelper] ⚠️ Sender phone is empty!');
        throw new Error('Chưa cấu hình SĐT người gửi. Vui lòng vào trang Vận chuyển để cấu hình.');
      }

      if (!sender.province_code || !sender.district_code) {
        console.warn('[SenderHelper] ⚠️ Sender province/district code is empty!');
        throw new Error('Chưa cấu hình địa chỉ người gửi. Vui lòng vào trang Vận chuyển để cấu hình.');
      }

      console.log('[SenderHelper] ✅ Sender loaded:', {
        name: sender.name,
        phone: sender.phone,
        province: sender.province,
        district: sender.district
      });

      // Cache
      this.cachedSender = sender;
      this.cacheTime = now;

      return sender;
    } catch (error) {
      console.error('[SenderHelper] ❌ Error loading sender:', error);
      throw error;
    }
  }

  /**
   * Format sender cho API create waybill
   * @returns {Promise<Object>} Formatted sender object
   */
  async getFormattedSender() {
    const sender = await this.getSender();
    
    return {
      name: sender.name.trim(),
      phone: sender.phone.replace(/\D+/g, ''), // Chỉ giữ số
      address: sender.address.trim(),
      province: sender.province.trim(),
      province_code: sender.province_code.trim(),
      district: sender.district.trim(),
      district_code: sender.district_code.trim(),
      commune: sender.commune.trim(),
      commune_code: sender.commune_code.trim(),
      ward_code: sender.commune_code.trim() // Alias
    };
  }

  /**
   * Validate sender trước khi tạo vận đơn
   * @returns {Promise<{valid: boolean, errors: string[]}>}
   */
  async validateSender() {
    const errors = [];

    try {
      const sender = await this.getSender();

      if (!sender.name || sender.name.trim() === '') {
        errors.push('Tên người gửi không được để trống');
      }

      if (!sender.phone || sender.phone.trim() === '') {
        errors.push('SĐT người gửi không được để trống');
      } else if (!/^\d{9,11}$/.test(sender.phone.replace(/\D+/g, ''))) {
        errors.push('SĐT người gửi không hợp lệ (9-11 chữ số)');
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

      return {
        valid: errors.length === 0,
        errors
      };
    } catch (error) {
      return {
        valid: false,
        errors: [error.message]
      };
    }
  }

  /**
   * Hiển thị thông báo lỗi validation
   * @param {string[]} errors 
   */
  showValidationErrors(errors) {
    const message = '❌ Lỗi cấu hình người gửi:\n\n' + 
      errors.map((err, i) => `${i + 1}. ${err}`).join('\n') +
      '\n\n👉 Vui lòng vào trang "Vận chuyển" để cấu hình đầy đủ thông tin người gửi.';
    
    alert(message);
  }

  /**
   * Clear cache (dùng sau khi cập nhật sender)
   */
  clearCache() {
    this.cachedSender = null;
    this.cacheTime = 0;
    console.log('[SenderHelper] Cache cleared');
  }

  /**
   * Hiển thị thông tin sender (debug)
   */
  async debug() {
    try {
      const sender = await this.getSender();
      console.table(sender);
      alert('Thông tin sender:\n\n' + JSON.stringify(sender, null, 2));
    } catch (error) {
      console.error(error);
      alert('Lỗi: ' + error.message);
    }
  }
}

// Global instance
window.senderHelper = new SenderHelper();

// Export cho ES6 modules (nếu cần)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = SenderHelper;
}

console.log('[SenderHelper] Module loaded ✅');