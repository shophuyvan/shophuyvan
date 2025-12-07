// apps/admin/orders/orders-manager.js
import { renderStatusTabs, renderSourceFilter, renderOrderDetail, renderOrderRow } from './order-render.js';
import { editOrderPrice, cancelOrder, confirmOrder, deleteOrder, printOrder, cancelWaybill } from './order-actions.js';
import { updateBulkToolbar, printSelectedOrders, cancelSelectedOrders, confirmSelectedOrders } from './order-bulk.js';
import { formatPrice } from './order-utils.js';

class OrdersManager {
  constructor() {
    this.allOrders = [];
    this.orders = [];
    this.selectedOrders = new Set();
    this.currentStatusFilter = 'all';
    this.currentSourceFilter = 'all';
  }

  async init() {
    console.log('[OrdersManager] Initializing (ES Modules)...');
    await this.loadOrders();
    this.wireGlobalEvents();
    this.startAutoRefresh();
  }

  async loadOrders() {
    Admin.toast('🔄 Đang tải đơn hàng...');
    try {
      const response = await Admin.req('/api/orders', { method: 'GET' });
      this.allOrders = response?.items || [];
      Admin.toast(`✅ Tải xong ${this.allOrders.length} đơn.`);
      
      renderStatusTabs(this.allOrders, this.currentStatusFilter, (status) => {
        this.currentStatusFilter = status;
        this.filterAndRender();
      });
      
      renderSourceFilter(this.currentSourceFilter, (source) => {
        this.currentSourceFilter = source;
        this.filterAndRender();
      });

      this.filterAndRender();
    } catch (e) {
      console.error(e);
      document.getElementById('list').innerHTML = '<tr><td colspan="3">Lỗi tải dữ liệu</td></tr>';
    }
  }

  filterAndRender() {
    const statusKey = this.currentStatusFilter;
    const sourceKey = this.currentSourceFilter;

    this.orders = this.allOrders.filter(order => {
      const s = String(order.status || 'unknown').toLowerCase();
      let statusMatch = (statusKey === 'all') || (s === statusKey);
      
      // Map status group
      if (statusKey === 'pending' && (s === 'unpaid' || s === 'new')) statusMatch = true;
      if (statusKey === 'processing' && (s === 'confirmed' || s === 'picking' || s === 'ready_to_ship')) statusMatch = true;
      if (statusKey === 'shipping' && (s === 'delivering')) statusMatch = true;
      if (statusKey === 'delivered' && (s === 'completed')) statusMatch = true;
      if (statusKey === 'cancelled' && (s === 'cancel')) statusMatch = true;

      let rawSource = String(order.source || order.channel || 'web').toLowerCase();
      let normSource = 'website';
      if (rawSource.includes('shopee')) normSource = 'shopee';
      else if (rawSource.includes('lazada')) normSource = 'lazada';
      else if (rawSource.includes('tiktok')) normSource = 'tiktok';
      else if (rawSource.includes('zalo') || rawSource.includes('mini')) normSource = 'zalo';
      else if (rawSource.includes('pos')) normSource = 'pos';

      const sourceMatch = (sourceKey === 'all') || (normSource === sourceKey);
      return statusMatch && sourceMatch;
    });

    this.renderList();
  }

  renderList() {
    const tbody = document.getElementById('list');
    this.selectedOrders.clear();
    updateBulkToolbar(0);
    
    // Checkbox header
    const theadFirstTh = document.querySelector('thead th:first-child');
    if (theadFirstTh) {
        theadFirstTh.innerHTML = `<input type="checkbox" id="select-all-orders" style="cursor:pointer">`;
        document.getElementById('select-all-orders').addEventListener('change', (e) => {
            const checked = e.target.checked;
            document.querySelectorAll('.order-checkbox').forEach(cb => {
                cb.checked = checked;
                const id = cb.dataset.orderId;
                if (checked) this.selectedOrders.add(id); else this.selectedOrders.delete(id);
            });
            updateBulkToolbar(this.selectedOrders.size);
        });
    }

    if (this.orders.length === 0) {
      tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;padding:20px">Không có đơn hàng</td></tr>';
      return;
    }

    tbody.innerHTML = this.orders.map(order => renderOrderRow(order)).join('');
    this.wireRowEvents();
  }

  wireRowEvents() {
    // Checkbox row
    document.querySelectorAll('.order-checkbox').forEach(cb => {
      cb.addEventListener('change', (e) => {
        const id = e.target.dataset.orderId;
        if (e.target.checked) this.selectedOrders.add(id); else this.selectedOrders.delete(id);
        updateBulkToolbar(this.selectedOrders.size);
      });
    });

    // Action Buttons
    const bindClick = (selector, action) => {
      document.querySelectorAll(selector).forEach(btn => {
        btn.onclick = () => action(btn.getAttribute(selector.replace('[', '').replace(']', '')));
      });
    };

    bindClick('[data-confirm]', (id) => confirmOrder(id, this.orders, () => this.loadOrders()));
    bindClick('[data-edit]', (id) => editOrderPrice(id, this.orders, () => this.loadOrders()));
    bindClick('[data-cancel-order]', (id) => cancelOrder(id, () => this.loadOrders()));
    bindClick('[data-print]', (id) => printOrder(id, this.orders));
    bindClick('[data-cancel]', (id) => cancelWaybill(id, this.orders, () => this.loadOrders()));
    bindClick('[data-delete]', (id) => deleteOrder(id, () => this.loadOrders()));
  }

  wireGlobalEvents() {
    const bind = (id, action) => {
        const el = document.getElementById(id);
        if (el) el.onclick = (e) => { e.preventDefault(); action(); };
    };

    bind('bulk-print-btn', () => printSelectedOrders(this.selectedOrders, this.orders));
    bind('bulk-cancel-btn', () => cancelSelectedOrders(this.selectedOrders, this.orders, () => this.loadOrders()));
    bind('bulk-confirm-btn', () => confirmSelectedOrders(this.selectedOrders, this.orders, () => this.loadOrders()));
    bind('reload-orders', () => this.loadOrders());
  }

  startAutoRefresh() {
    setInterval(async () => {
      if (this.selectedOrders.size > 0) return;
      try {
        const res = await Admin.req('/api/orders', { method: 'GET' });
        const newOrders = res?.items || [];
        if (newOrders.length !== this.allOrders.length) {
            this.allOrders = newOrders;
            this.filterAndRender();
        }
      } catch (e) {}
    }, 30000);
  }
}

// Init Global
window.ordersManager = new OrdersManager();
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => window.ordersManager.init());
} else {
  window.ordersManager.init();
}