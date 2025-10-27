// File: apps/admin/costs-manager.js

class CostsManager {
  constructor() {
    this.costs = [];
  }

  // ==================== HELPERS ====================
  $(id) {
    return document.getElementById(id);
  }

  formatMoney(n) {
    return Number(n || 0).toLocaleString('vi-VN') + 'đ';
  }

 // ==================== INIT ====================
  async init() {
    console.log('[CostsManager] Initializing...');

    try {
      // Chờ cho 'Admin' object sẵn sàng
      await this.waitForAdmin(); 
      
      console.log('[CostsManager] Admin object is ready.');
      Admin.ensureAuth();
      await this.loadCosts();
      console.log('[CostsManager] Initialized ✅');

    } catch (error) {
      console.error('Admin object failed to load:', error);
      alert('Lỗi nghiêm trọng: Không thể tải mô-đun API. Vui lòng tải lại trang.');
    }
  }

  // Hàm mới để chờ Admin
  waitForAdmin(timeout = 5000) {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      const interval = setInterval(() => {
        if (window.Admin) {
          clearInterval(interval);
          resolve();
        } else if (Date.now() - startTime > timeout) {
          clearInterval(interval);
          reject(new Error('Admin object timed out'));
        }
      }, 50); // Check every 50ms
    });
  }

  // ==================== API ====================
  async loadCosts() {
    try {
      const data = await Admin.req('/admin/costs');
      this.costs = data.costs || [];
      console.log('[Costs] Loaded:', this.costs);
      this.renderCostList();
    } catch (error) {
      console.error('Failed to load costs:', error);
      alert('Lỗi tải danh sách chi phí: ' + error.message);
    }
  }

  async saveCosts() {
    const btn = this.$('btnSave');
    btn.disabled = true;
    btn.textContent = 'Đang lưu...';

    try {
      const data = await Admin.req('/admin/costs', {
        method: 'POST',
        body: JSON.stringify({ costs: this.costs })
      });
      
      this.costs = data.costs || this.costs;
      this.renderCostList();
      alert('Đã lưu chi phí thành công!');

    } catch (error) {
      console.error('Failed to save costs:', error);
      alert('Lỗi lưu chi phí: ' + error.message);
    } finally {
      btn.disabled = false;
      btn.innerHTML = '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V3"></path></svg> Lưu thay đổi';
    }
  }

  // ==================== UI ACTIONS ====================
  addCost() {
    const name = this.$('costName').value.trim();
    const amount = parseFloat(this.$('costAmount').value) || 0;
    const type = document.querySelector('input[name="costType"]:checked').value;
    
    if (!name || amount <= 0) {
      alert('Vui lòng nhập đầy đủ thông tin chi phí');
      return;
    }
    
    this.costs.push({ name, amount, type, id: 'new_' + Date.now() });
    
    this.$('costName').value = '';
    this.$('costAmount').value = '';
    
    this.renderCostList();
  }

  deleteCost(id) {
    if (!confirm('Xác nhận xóa chi phí này?')) return;
    this.costs = this.costs.filter(c => c.id !== id);
    this.renderCostList();
  }

  renderCostList() {
    const container = this.$('costListContainer');
    
    if (this.costs.length === 0) {
      container.innerHTML = '<div style="text-align:center;color:#999;padding:40px">Chưa có chi phí nào</div>';
      return;
    }
    
    container.innerHTML = this.costs.map(c => `
      <div class="cost-item">
        <div>
          <strong>${c.name}</strong>
          <div class="cost-item-type">${c.type === 'monthly' ? 'Chi phí hàng tháng' : 'Chi phí theo đơn hàng'}</div>
        </div>
        <div classs="cost-item-amount">${this.formatMoney(c.amount)}</div>
        <div classs="cost-item-amount">${c.type === 'monthly' ? '/ tháng' : '/ đơn'}</div>
        <div class="cost-item-actions">
          <button class="btn danger" onclick="window.manager.deleteCost('${c.id}')">Xóa</button>
        </div>
      </div>
    `).join('');
  }
}