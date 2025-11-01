/**
 * Shipping Providers Manager
 * Quản lý bật/tắt các đơn vị vận chuyển
 */

class ProvidersManager {
  constructor() {
    this.baseURL = 'https://api.shophuyvan.vn';
    this.providers = [];
    this.enabledProviders = new Set();
  }

  // ==================== HELPERS ====================
  $(id) {
    return document.getElementById(id);
  }

  getToken() {
    // ✅ Ưu tiên super_token cho SuperAI API
    return localStorage.getItem('super_token') || 
           localStorage.getItem('x-token') || 
           localStorage.getItem('admin_token') || 
           'FxXOoDz2qlTN5joDCsBGQFqKmm1UNvOw7YPwkzm5'; // Fallback token
  }

  toast(msg, type = 'success') {
    if (window.Admin?.toast) {
      window.Admin.toast(msg);
    } else {
      alert(msg);
    }
  }

  showLoading() {
    this.$('loading').style.display = 'block';
    this.$('providers-container').style.display = 'none';
    this.$('empty-state').style.display = 'none';
  }

  hideLoading() {
    this.$('loading').style.display = 'none';
  }

  // ==================== API CALLS ====================
  async apiCall(path, options = {}) {
    try {
      const url = path.startsWith('http') ? path : this.baseURL + path;
      const token = this.getToken();

      const headers = {
        'Content-Type': 'application/json'
      };

      if (token) {
        headers['Token'] = token.trim();
        headers['x-token'] = token.trim();
      }

      const config = {
        method: options.method || 'GET',
        headers
      };

      if (options.body && config.method !== 'GET') {
        config.body = JSON.stringify(options.body);
      }

      console.log(`[API] ${config.method} ${path}`);

      const response = await fetch(url, config);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || `HTTP ${response.status}`);
      }

      return data;
    } catch (error) {
      console.error('[API Error]', path, error);
      throw error;
    }
  }

  // ==================== LOAD PROVIDERS ====================
  async loadProviders() {
    try {
      this.showLoading();

      // ✅ GỌI QUA BACKEND API thay vì trực tiếp SuperAI
      const data = await this.apiCall('/shipping/carriers/list');
      this.providers = data?.data || data?.items || [];

      // Load cấu hình đã lưu
      await this.loadSavedConfig();

      // Render
      this.renderProviders();

      this.hideLoading();
    } catch (error) {
      console.error('[Load Error]', error);
      this.hideLoading();
      this.$('empty-state').style.display = 'block';
      this.toast('❌ Lỗi: ' + error.message, 'error');
    }
  }

  // ==================== LOAD SAVED CONFIG ====================
  async loadSavedConfig() {
    try {
      const response = await this.apiCall('/public/settings');
      const settings = response?.settings || response || {};
      
      const enabled = settings?.shipping?.enabled_providers || [];
      this.enabledProviders = new Set(Array.isArray(enabled) ? enabled : []);

      console.log('[Config] Loaded enabled providers:', Array.from(this.enabledProviders));
    } catch (error) {
      console.warn('[Config] Could not load saved config:', error);
      // Default: enable all
      this.enabledProviders = new Set(this.providers.map(p => p.code));
    }
  }

  // ==================== RENDER PROVIDERS ====================
  renderProviders() {
    const container = this.$('providers-container');
    if (!container) return;

    if (!this.providers.length) {
      container.style.display = 'none';
      this.$('empty-state').style.display = 'block';
      return;
    }

    container.innerHTML = '';
    container.style.display = 'grid';

    // Sort theo tên
    const sorted = [...this.providers].sort((a, b) => 
      (a.name || '').localeCompare(b.name || '')
    );

    sorted.forEach(provider => {
      const card = this.createProviderCard(provider);
      container.appendChild(card);
    });
  }

  // ==================== CREATE CARD ====================
  createProviderCard(provider) {
    const code = String(provider.code || '');
    const name = provider.name || 'Unknown';
    const isEnabled = this.enabledProviders.has(code);

    const card = document.createElement('div');
    card.className = `provider-card ${isEnabled ? 'active' : 'inactive'}`;
    card.dataset.code = code;

    card.innerHTML = `
      <div class="provider-header">
        <div>
          <div class="provider-name">${this.escapeHtml(name)}</div>
          <div class="provider-code">Code: ${this.escapeHtml(code)}</div>
        </div>
        <label class="toggle-switch">
          <input type="checkbox" ${isEnabled ? 'checked' : ''} data-code="${this.escapeHtml(code)}">
          <span class="slider"></span>
        </label>
      </div>

      <div class="provider-info">
        <div class="info-row">
          <span class="info-label">Trạng thái:</span>
          <span class="status-badge ${isEnabled ? 'status-active' : 'status-inactive'}">
            ${isEnabled ? '✓ Đang bật' : '✗ Đang tắt'}
          </span>
        </div>
        <div class="info-row">
          <span class="info-label">ID:</span>
          <span class="info-value">${provider.id || 'N/A'}</span>
        </div>
      </div>
    `;

    // Wire toggle event
    const toggle = card.querySelector('input[type="checkbox"]');
    if (toggle) {
      toggle.addEventListener('change', (e) => {
        const code = e.target.dataset.code;
        if (e.target.checked) {
          this.enabledProviders.add(code);
          card.classList.add('active');
          card.classList.remove('inactive');
          card.querySelector('.status-badge').className = 'status-badge status-active';
          card.querySelector('.status-badge').textContent = '✓ Đang bật';
        } else {
          this.enabledProviders.delete(code);
          card.classList.remove('active');
          card.classList.add('inactive');
          card.querySelector('.status-badge').className = 'status-badge status-inactive';
          card.querySelector('.status-badge').textContent = '✗ Đang tắt';
        }
        console.log('[Toggle]', code, e.target.checked);
      });
    }

    return card;
  }

  // ==================== SAVE CONFIG ====================
  async saveConfig() {
    try {
      const enabled = Array.from(this.enabledProviders);
      
      console.log('[Save] Saving enabled providers:', enabled);

      // Lưu vào settings
      await window.Admin.req('/admin/settings/upsert', {
        method: 'POST',
        body: {
          path: 'shipping.enabled_providers',
          value: enabled
        }
      });

      this.toast('✅ Đã lưu cấu hình đơn vị vận chuyển');
    } catch (error) {
      console.error('[Save Error]', error);
      this.toast('❌ Lỗi lưu: ' + error.message, 'error');
    }
  }

  // ==================== HELPERS ====================
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // ==================== WIRE EVENTS ====================
  wireEvents() {
    const refreshBtn = this.$('refresh-providers');
    if (refreshBtn) {
      refreshBtn.onclick = () => this.loadProviders();
    }

    const saveBtn = this.$('save-providers');
    if (saveBtn) {
      saveBtn.onclick = () => this.saveConfig();
    }
  }

  // ==================== INIT ====================
  async init() {
    this.wireEvents();
    await this.loadProviders();
    console.log('[ProvidersManager] Initialized');
  }
}

// Global instance
window.providersManager = new ProvidersManager();

// Auto-init when DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => window.providersManager.init());
} else {
  window.providersManager.init();
}