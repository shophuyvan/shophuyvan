/**
 * SKU Manager - Frontend Logic
 * File: apps/admin/sku-manager.js
 */

class SkuManager {
  constructor() {
    this.currentTab = 'unmapped';
    this.selectedInternalSku = null;
    this.currentMappingData = null;
  }

  // ==================== INIT ====================
  
  init() {
    console.log('[SkuManager] Initializing...');
    
    // Load stats
    this.loadStats();
    
    // Load initial tab data
    this.loadUnmapped();
    
    // Wire events
    this.wireEvents();
  }

  wireEvents() {
    // Tab switching
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const tab = e.target.dataset.tab;
        this.switchTab(tab);
      });
    });

    // Search internal SKU
    const searchInput = document.getElementById('search-internal-sku');
    if (searchInput) {
      let searchTimeout;
      searchInput.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
          this.searchInternalSku(e.target.value);
        }, 300);
      });
    }

    // Confirm map button
    const confirmBtn = document.getElementById('btn-confirm-map');
    if (confirmBtn) {
      confirmBtn.addEventListener('click', () => this.confirmMapping());
    }

    // Close modal on outside click
    const modal = document.getElementById('modal-map');
    if (modal) {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          this.closeMapModal();
        }
      });
    }
  }

  // ==================== TAB SWITCHING ====================
  
  switchTab(tab) {
    console.log('[SkuManager] Switching to tab:', tab);
    
    // Update active button
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tab);
    });
    
    // Update active content
    document.querySelectorAll('.tab-content').forEach(content => {
      content.classList.toggle('active', content.id === `tab-${tab}`);
    });
    
    this.currentTab = tab;
    
    // Load data for tab
    if (tab === 'unmapped') {
      this.loadUnmapped();
    } else if (tab === 'mapped') {
      this.loadMapped();
    } else if (tab === 'auto') {
      this.loadAutoMatched();
    }
  }

  // ==================== LOAD DATA ====================
  
  async loadStats() {
    try {
      const response = await Admin.req('/admin/sku-mapping/stats', { method: 'GET' });
      
      if (!response.ok) {
        console.error('[SkuManager] Failed to load stats');
        return;
      }
      
      const stats = response.stats;
      
      document.getElementById('stat-mapped').textContent = stats.mapped || 0;
      document.getElementById('stat-auto').textContent = stats.auto_matched || 0;
      document.getElementById('stat-unmapped').textContent = stats.unmapped || 0;
      document.getElementById('stat-total').textContent = stats.total || 0;
      document.getElementById('stat-percent').textContent = `${stats.mapped_percent}% hoàn thành`;
      
      // Update counts in tabs
      document.getElementById('count-unmapped').textContent = stats.unmapped || 0;
      document.getElementById('count-mapped').textContent = stats.mapped || 0;
      document.getElementById('count-auto').textContent = stats.auto_matched || 0;
      
    } catch (error) {
      console.error('[SkuManager] Error loading stats:', error);
    }
  }

  async loadUnmapped() {
    const tbody = document.getElementById('list-unmapped');
    tbody.innerHTML = '<tr><td colspan="5" class="loading"><div class="spinner"></div></td></tr>';
    
    try {
      const response = await Admin.req('/admin/sku-mapping/unmapped', { method: 'GET' });
      
      if (!response.ok || !response.items || response.items.length === 0) {
        tbody.innerHTML = `
          <tr>
            <td colspan="5" class="empty-state">
              <div class="empty-state-icon">✅</div>
              <div class="empty-state-title">Tất cả SKU đã được map!</div>
              <div class="empty-state-text">Không có SKU nào cần xử lý</div>
            </td>
          </tr>
        `;
        return;
      }
      
      tbody.innerHTML = response.items.map(item => `
        <tr>
          <td>${this.getChannelBadge(item.channel)}</td>
          <td><code>${this.escapeHtml(item.channel_sku)}</code></td>
          <td><span style="color: #6b7280; font-size: 13px;">${this.escapeHtml(item.channel_item_id)}</span></td>
          <td>${this.formatDate(item.created_at)}</td>
          <td style="text-align: right;">
            <button class="btn btn-primary btn-sm" onclick="skuManager.openMapModal('${this.escapeHtml(item.channel)}', '${this.escapeHtml(item.channel_sku)}')">
              🔗 Map
            </button>
          </td>
        </tr>
      `).join('');
      
    } catch (error) {
      console.error('[SkuManager] Error loading unmapped:', error);
      tbody.innerHTML = `
        <tr>
          <td colspan="5" class="empty-state">
            <div class="empty-state-icon">❌</div>
            <div class="empty-state-title">Lỗi tải dữ liệu</div>
            <div class="empty-state-text">${error.message}</div>
          </td>
        </tr>
      `;
    }
  }

  async loadMapped() {
    const tbody = document.getElementById('list-mapped');
    tbody.innerHTML = '<tr><td colspan="6" class="loading"><div class="spinner"></div></td></tr>';
    
    try {
      const response = await Admin.req('/admin/sku-mapping/mapped', { method: 'GET' });
      
      if (!response.ok || !response.items || response.items.length === 0) {
        tbody.innerHTML = `
          <tr>
            <td colspan="6" class="empty-state">
              <div class="empty-state-icon">📦</div>
              <div class="empty-state-title">Chưa có mapping nào</div>
              <div class="empty-state-text">Hãy bắt đầu map SKU từ tab "Chưa map"</div>
            </td>
          </tr>
        `;
        return;
      }
      
      tbody.innerHTML = response.items.map(item => `
        <tr>
          <td>${this.getChannelBadge(item.channel)}</td>
          <td><code>${this.escapeHtml(item.channel_sku)}</code></td>
          <td><code style="color: #16a34a;">${this.escapeHtml(item.internal_sku)}</code></td>
          <td>
            <div style="font-weight: 500; margin-bottom: 4px;">${this.escapeHtml(item.product_title || '')}</div>
            <div style="font-size: 12px; color: #6b7280;">${this.escapeHtml(item.variant_name || '')}</div>
          </td>
          <td>${this.formatDate(item.updated_at)}</td>
          <td style="text-align: right;">
            <button class="btn btn-sm" onclick="skuManager.editMapping('${this.escapeHtml(item.channel)}', '${this.escapeHtml(item.channel_sku)}')">
              ✏️ Sửa
            </button>
            <button class="btn btn-danger btn-sm" onclick="skuManager.deleteMapping('${this.escapeHtml(item.channel)}', '${this.escapeHtml(item.channel_sku)}')">
              🗑️ Xóa
            </button>
          </td>
        </tr>
      `).join('');
      
    } catch (error) {
      console.error('[SkuManager] Error loading mapped:', error);
      tbody.innerHTML = `
        <tr>
          <td colspan="6" class="empty-state">
            <div class="empty-state-icon">❌</div>
            <div class="empty-state-title">Lỗi tải dữ liệu</div>
            <div class="empty-state-text">${error.message}</div>
          </td>
        </tr>
      `;
    }
  }

  async loadAutoMatched() {
    const tbody = document.getElementById('list-auto');
    tbody.innerHTML = '<tr><td colspan="4" class="loading"><div class="spinner"></div></td></tr>';
    
    try {
      const response = await Admin.req('/admin/sku-mapping/auto-matched', { method: 'GET' });
      
      if (!response.ok || !response.items || response.items.length === 0) {
        tbody.innerHTML = `
          <tr>
            <td colspan="4" class="empty-state">
              <div class="empty-state-icon">🤖</div>
              <div class="empty-state-title">Chưa có SKU tự động match</div>
              <div class="empty-state-text">Hệ thống sẽ tự động match khi SKU sàn trùng với SKU nội bộ</div>
            </td>
          </tr>
        `;
        return;
      }
      
      tbody.innerHTML = response.items.map(item => `
        <tr>
          <td><code>${this.escapeHtml(item.sku)}</code></td>
          <td>${this.escapeHtml(item.variant_name || '')}</td>
          <td>${this.escapeHtml(item.product_title || '')}</td>
          <td><span class="badge badge-success">✅ Active</span></td>
        </tr>
      `).join('');
      
    } catch (error) {
      console.error('[SkuManager] Error loading auto-matched:', error);
      tbody.innerHTML = `
        <tr>
          <td colspan="4" class="empty-state">
            <div class="empty-state-icon">❌</div>
            <div class="empty-state-title">Lỗi tải dữ liệu</div>
            <div class="empty-state-text">${error.message}</div>
          </td>
        </tr>
      `;
    }
  }

  // ==================== MAPPING ACTIONS ====================
  
  openMapModal(channel, channelSku) {
    console.log('[SkuManager] Opening map modal:', { channel, channelSku });
    
    this.currentMappingData = { channel, channel_sku: channelSku };
    this.selectedInternalSku = null;
    
    document.getElementById('modal-channel').value = channel;
    document.getElementById('modal-channel-sku').value = channelSku;
    document.getElementById('search-internal-sku').value = '';
    document.getElementById('search-results').style.display = 'none';
    document.getElementById('search-results').innerHTML = '';
    
    document.getElementById('modal-map').classList.add('show');
  }

  closeMapModal() {
    document.getElementById('modal-map').classList.remove('show');
    this.currentMappingData = null;
    this.selectedInternalSku = null;
  }

  async searchInternalSku(query) {
    const resultsDiv = document.getElementById('search-results');
    
    if (!query || query.trim().length < 2) {
      resultsDiv.style.display = 'none';
      return;
    }
    
    try {
      const response = await Admin.req(`/admin/sku-mapping/search?q=${encodeURIComponent(query)}`, { method: 'GET' });
      
      if (!response.ok || !response.items || response.items.length === 0) {
        resultsDiv.innerHTML = '<div style="padding: 16px; text-align: center; color: #6b7280;">Không tìm thấy SKU</div>';
        resultsDiv.style.display = 'block';
        return;
      }
      
      resultsDiv.innerHTML = response.items.map(item => `
        <div class="search-item" onclick="skuManager.selectInternalSku('${this.escapeHtml(item.sku)}')">
          <input type="radio" name="internal-sku" value="${this.escapeHtml(item.sku)}">
          <div style="display: inline-block; vertical-align: top;">
            <div class="search-item-title">${this.escapeHtml(item.sku)} - ${this.escapeHtml(item.variant_name)}</div>
            <div class="search-item-meta">
              ${this.escapeHtml(item.product_title)} | 
              Giá: ${this.formatPrice(item.price)} | 
              Tồn: ${item.stock || 0}
            </div>
          </div>
        </div>
      `).join('');
      
      resultsDiv.style.display = 'block';
      
    } catch (error) {
      console.error('[SkuManager] Error searching:', error);
      resultsDiv.innerHTML = `<div style="padding: 16px; text-align: center; color: #ef4444;">Lỗi tìm kiếm: ${error.message}</div>`;
      resultsDiv.style.display = 'block';
    }
  }

  selectInternalSku(sku) {
    console.log('[SkuManager] Selected SKU:', sku);
    this.selectedInternalSku = sku;
    
    // Check the radio button
    document.querySelectorAll('input[name="internal-sku"]').forEach(radio => {
      radio.checked = radio.value === sku;
    });
  }

  async confirmMapping() {
    if (!this.selectedInternalSku) {
      Admin.toast('⚠️ Vui lòng chọn SKU nội bộ');
      return;
    }
    
    if (!this.currentMappingData) {
      Admin.toast('❌ Thiếu thông tin mapping');
      return;
    }
    
    try {
      Admin.toast('🔄 Đang map SKU...');
      
      const response = await Admin.req('/admin/sku-mapping/map', {
        method: 'POST',
        body: JSON.stringify({
          channel: this.currentMappingData.channel,
          channel_sku: this.currentMappingData.channel_sku,
          internal_sku: this.selectedInternalSku
        })
      });
      
      if (!response.ok) {
        throw new Error(response.error || 'Failed to map SKU');
      }
      
      Admin.toast('✅ Map thành công!');
      
      this.closeMapModal();
      
      // Reload data
      this.loadStats();
      if (this.currentTab === 'unmapped') {
        this.loadUnmapped();
      } else if (this.currentTab === 'mapped') {
        this.loadMapped();
      }
      
    } catch (error) {
      console.error('[SkuManager] Error mapping:', error);
      Admin.toast('❌ Lỗi: ' + error.message);
    }
  }

  editMapping(channel, channelSku) {
    // Reuse map modal for editing
    this.openMapModal(channel, channelSku);
  }

  async deleteMapping(channel, channelSku) {
    if (!confirm(`Xác nhận xóa mapping cho SKU: ${channelSku}?`)) {
      return;
    }
    
    try {
      Admin.toast('🔄 Đang xóa mapping...');
      
      const response = await Admin.req('/admin/sku-mapping/unmap', {
        method: 'POST',
        body: JSON.stringify({
          channel: channel,
          channel_sku: channelSku
        })
      });
      
      if (!response.ok) {
        throw new Error(response.error || 'Failed to unmap SKU');
      }
      
      Admin.toast('✅ Đã xóa mapping!');
      
      // Reload data
      this.loadStats();
      if (this.currentTab === 'unmapped') {
        this.loadUnmapped();
      } else if (this.currentTab === 'mapped') {
        this.loadMapped();
      }
      
    } catch (error) {
      console.error('[SkuManager] Error unmapping:', error);
      Admin.toast('❌ Lỗi: ' + error.message);
    }
  }

  // ==================== HELPERS ====================
  
  getChannelBadge(channel) {
    const badges = {
      'shopee': '<span class="badge badge-shopee">🟠 Shopee</span>',
      'lazada': '<span class="badge badge-lazada">🔵 Lazada</span>',
      'tiktok': '<span class="badge badge-tiktok">⚫ TikTok</span>'
    };
    return badges[channel] || channel;
  }

  formatDate(timestamp) {
    if (!timestamp) return '-';
    try {
      const date = new Date(Number(timestamp));
      return date.toLocaleDateString('vi-VN') + ' ' + date.toLocaleTimeString('vi-VN');
    } catch {
      return '-';
    }
  }

  formatPrice(price) {
    try {
      return Number(price || 0).toLocaleString('vi-VN') + 'đ';
    } catch {
      return '0đ';
    }
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text || '';
    return div.innerHTML;
  }
}

// Global instance
window.skuManager = new SkuManager();

// Expose closeMapModal globally for onclick
window.closeMapModal = () => window.skuManager.closeMapModal();
