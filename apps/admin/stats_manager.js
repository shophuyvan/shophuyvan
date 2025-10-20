/**
 * Stats Manager - Quản lý Thống kê
 * Version: 2.0 - Separated from HTML
 */

class StatsManager {
  constructor() {
    this.costs = [];
    this.statsData = {};
    this.orderChart = null;
    this.revenueChart = null;
  }

  // ==================== HELPERS ====================
  $(id) {
    return document.getElementById(id);
  }

  formatMoney(n) {
    return Number(n || 0).toLocaleString('vi-VN') + 'đ';
  }

  formatPercent(n) {
    return Number(n || 0).toFixed(1) + '%';
  }

  // ==================== DATE FILTERS ====================
  setToday() {
    const today = new Date().toISOString().split('T')[0];
    this.$('fromDate').value = today;
    this.$('toDate').value = today;
    this.loadStats();
  }

  setThisWeek() {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const monday = new Date(today);
    monday.setDate(today.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
    
    this.$('fromDate').value = monday.toISOString().split('T')[0];
    this.$('toDate').value = new Date().toISOString().split('T')[0];
    this.loadStats();
  }

  setThisMonth() {
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    
    this.$('fromDate').value = firstDay.toISOString().split('T')[0];
    this.$('toDate').value = new Date().toISOString().split('T')[0];
    this.loadStats();
  }

  // ==================== COST MANAGEMENT ====================
  showCostModal() {
    this.$('costModal').classList.add('show');
    this.renderCostList();
  }

  closeCostModal() {
    this.$('costModal').classList.remove('show');
  }

  addCost() {
    const name = this.$('costName').value.trim();
    const amount = parseFloat(this.$('costAmount').value) || 0;
    const type = document.querySelector('input[name="costType"]:checked').value;
    
    if (!name || amount <= 0) {
      alert('Vui lòng nhập đầy đủ thông tin chi phí');
      return;
    }
    
    this.costs.push({ name, amount, type, id: Date.now() });
    
    this.$('costName').value = '';
    this.$('costAmount').value = '';
    
    this.saveCosts();
  }

  deleteCost(id) {
    if (!confirm('Xác nhận xóa chi phí này?')) return;
    this.costs = this.costs.filter(c => c.id !== id);
    this.saveCosts();
  }

  saveCosts() {
    this.renderCostList();
    this.updateStats();
  }

  renderCostList() {
    const container = this.$('costListContainer');
    
    if (this.costs.length === 0) {
      container.innerHTML = '<div style="text-align:center;color:#999;padding:20px">Chưa có chi phí nào</div>';
      return;
    }
    
    container.innerHTML = this.costs.map(c => `
      <div class="cost-item">
        <div class="cost-info">
          <div class="cost-name">${c.name}</div>
          <div class="cost-detail">${c.type === 'monthly' ? 'Theo tháng' : 'Theo mỗi đơn'}</div>
        </div>
        <div class="cost-amount">${this.formatMoney(c.amount)}</div>
        <button class="btn-delete" onclick="window.statsManager.deleteCost(${c.id})">×</button>
      </div>
    `).join('');
  }

  calculateTotalCosts(orderCount) {
    let total = 0;
    this.costs.forEach(c => {
      if (c.type === 'monthly') {
        total += c.amount;
      } else {
        total += c.amount * orderCount;
      }
    });
    return total;
  }

  // ==================== LOAD STATS ====================
  async loadStats() {
    try {
      console.log('[Stats] Loading stats...');
      const fromDate = this.$('fromDate').value;
      const toDate = this.$('toDate').value;
      
      const ordersRes = await Admin.req('/admin/orders', { method: 'GET' });
      let orders = ordersRes.items || ordersRes.data || ordersRes.orders || [];
      console.log('[Stats] Total orders:', orders.length);
      
      // Filter by date range
      if (fromDate || toDate) {
        const fromTime = fromDate ? new Date(fromDate + 'T00:00:00+07:00').getTime() : 0;
        const toTime = toDate ? new Date(toDate + 'T23:59:59+07:00').getTime() : Date.now();
        
        orders = orders.filter(o => {
          const orderTime = o.createdAt || o.created_at || o.timestamp || o.date;
          const time = typeof orderTime === 'number' ? orderTime : new Date(orderTime).getTime();
          return time >= fromTime && time <= toTime;
        });
        console.log('[Stats] Filtered orders:', orders.length);
      }
      
      // Calculate statistics
      let totalOrders = orders.length;
      let cancelOrders = 0;
      let returnOrders = 0;
      let confirmedOrders = 0;
      let totalRevenue = 0;
      let totalCostPrice = 0;
      
      const platformStats = {
        'Website': { orders: 0, revenue: 0, cost_price: 0, profit: 0, success: 0, cancel: 0, return: 0 },
        'Zalo MiniApp': { orders: 0, revenue: 0, cost_price: 0, profit: 0, success: 0, cancel: 0, return: 0 }
      };
      
      const productStats = {};
      
      orders.forEach(order => {
        const status = (order.status || '').toLowerCase();
        const source = (order.source || '').toLowerCase();
        
        const platform = source.includes('zalo') || source.includes('mini') || source.includes('zmp') 
          ? 'Zalo MiniApp' 
          : 'Website';
        
        platformStats[platform].orders++;
        
        if (status.includes('cancel') || status.includes('hủy') || status.includes('huy') || status === 'cancelled') {
          cancelOrders++;
          platformStats[platform].cancel++;
        } else if (status.includes('return') || status.includes('trả') || status.includes('tra') || status === 'returned') {
          returnOrders++;
          platformStats[platform].return++;
        } else if (status.includes('confirm') || status === 'confirmed' || status.includes('deliver') || status.includes('completed')) {
          confirmedOrders++;
          platformStats[platform].success++;
        }
        
        if (!status.includes('cancel') && !status.includes('hủy') && !status.includes('huy') && status !== 'cancelled') {
          const orderRevenue = order.revenue || order.subtotal || order.total || 0;
          const orderProfit = order.profit || 0;
          const orderCost = orderRevenue - orderProfit;
          
          totalRevenue += orderRevenue;
          totalCostPrice += orderCost;
          
          platformStats[platform].revenue += orderRevenue;
          platformStats[platform].cost_price += orderCost;
          platformStats[platform].profit += orderProfit;
          
          const items = order.items || [];
          items.forEach(item => {
            const productName = item.title || item.name || item.product_name || 'Unknown';
            const qty = item.qty || item.quantity || 1;
            const price = item.price || item.unit_price || 0;
            
            if (!productStats[productName]) {
              productStats[productName] = { name: productName, qty: 0, revenue: 0 };
            }
            productStats[productName].qty += qty;
            productStats[productName].revenue += price * qty;
          });
        }
      });
      
      const topProducts = Object.values(productStats)
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 10);
      
      this.statsData = {
        orders: totalOrders,
        cancels: cancelOrders,
        returns: returnOrders,
        confirmed: confirmedOrders,
        revenue: totalRevenue,
        cost_price: totalCostPrice,
        platforms: [
          { name: 'Website', ...platformStats['Website'], color: '#1976d2' },
          { name: 'Zalo MiniApp', ...platformStats['Zalo MiniApp'], color: '#7b1fa2' }
        ],
        top_products: topProducts
      };
      
      console.log('[Stats] Calculated stats:', this.statsData);
      
      this.updateStats();
      this.updateCharts();
      this.updateTables();
    } catch (error) {
      console.error('[Stats] Error loading stats:', error);
      alert('Lỗi tải dữ liệu thống kê: ' + error.message);
    }
  }

  async loadInventoryValue() {
    try {
      const res = await Admin.req('/admin/products', { method: 'GET' });
      const products = res.items || res.data || res.products || [];
      
      let totalValue = 0;
      products.forEach(p => {
        const variants = Array.isArray(p.variants) ? p.variants :
                         Array.isArray(p.options) ? p.options :
                         Array.isArray(p.skus) ? p.skus : [];
        
        if (variants.length > 0) {
          variants.forEach(v => {
            const stock = v.stock ?? v.inventory ?? v.quantity ?? 0;
            const costPrice = v.cost_price ?? v.import_price ?? v.price_import ?? v.cost ?? 0;
            totalValue += stock * costPrice;
          });
        } else {
          const stock = p.stock ?? p.inventory ?? p.quantity ?? 0;
          const costPrice = p.cost_price ?? p.import_price ?? p.price_import ?? p.cost ?? 0;
          totalValue += stock * costPrice;
        }
      });
      
      this.$('inventoryValue').textContent = this.formatMoney(totalValue);
      console.log('[Stats] Inventory value:', totalValue);
    } catch (error) {
      console.error('[Stats] Error loading inventory:', error);
      this.$('inventoryValue').textContent = '0đ';
    }
  }

  // ==================== UPDATE UI ====================
  updateStats() {
    const totalOrders = this.statsData.orders || 0;
    const returnOrders = this.statsData.returns || 0;
    const cancelOrders = this.statsData.cancels || 0;
    const soldOrders = totalOrders - cancelOrders;
    
    const revenue = this.statsData.revenue || 0;
    const costPrice = this.statsData.cost_price || 0;
    const extraCosts = this.calculateTotalCosts(soldOrders);
    const profit = revenue - costPrice - extraCosts;
    
    this.$('totalOrders').textContent = totalOrders;
    this.$('returnOrders').textContent = returnOrders;
    this.$('cancelOrders').textContent = cancelOrders;
    this.$('cancelRate').textContent = this.formatPercent(totalOrders > 0 ? (cancelOrders / totalOrders * 100) : 0);
    this.$('soldOrders').textContent = soldOrders;
    this.$('soldRate').textContent = this.formatPercent(totalOrders > 0 ? (soldOrders / totalOrders * 100) : 0);
    this.$('revenue').textContent = this.formatMoney(revenue);
    this.$('extraCost').textContent = this.formatMoney(extraCosts);
    this.$('costPrice').textContent = this.formatMoney(costPrice);
    this.$('profit').textContent = this.formatMoney(profit);
  }

  updateCharts() {
    const platforms = this.statsData.platforms || [];
    
    if (this.orderChart) this.orderChart.destroy();
    if (this.revenueChart) this.revenueChart.destroy();
    
    const orderCtx = document.getElementById('orderChart').getContext('2d');
    this.orderChart = new Chart(orderCtx, {
      type: 'doughnut',
      data: {
        labels: platforms.map(p => p.name),
        datasets: [{
          data: platforms.map(p => p.orders),
          backgroundColor: platforms.map(p => p.color),
          borderWidth: 0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '70%',
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => `${ctx.label}: ${ctx.parsed} đơn`
            }
          }
        }
      }
    });
    
    const revenueCtx = document.getElementById('revenueChart').getContext('2d');
    this.revenueChart = new Chart(revenueCtx, {
      type: 'doughnut',
      data: {
        labels: platforms.map(p => p.name),
        datasets: [{
          data: platforms.map(p => p.revenue),
          backgroundColor: platforms.map(p => p.color),
          borderWidth: 0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '70%',
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => `${ctx.label}: ${this.formatMoney(ctx.parsed)}`
            }
          }
        }
      }
    });
    
    this.updateLegends(platforms);
  }

  updateLegends(platforms) {
    const orderLegend = platforms.map(p => `
      <div class="legend-item">
        <div class="legend-color" style="background:${p.color}"></div>
        <span>${p.name}</span>
      </div>
    `).join('');
    
    this.$('orderLegend').innerHTML = orderLegend;
    this.$('revenueLegend').innerHTML = orderLegend;
  }

  updateTables() {
    const platforms = this.statsData.platforms || [];
    
    const platformTable = this.$('platformTable');
    platformTable.innerHTML = platforms.map(p => {
      const profit = (p.revenue || 0) - (p.cost_price || 0);
      const badgeClass = p.name === 'Website' ? 'website' : 'miniapp';
      
      return `
        <tr>
          <td><span class="platform-badge ${badgeClass}">${p.name}</span></td>
          <td style="text-align:right">${p.orders || 0}</td>
          <td style="text-align:right">${this.formatMoney(p.revenue)}</td>
          <td style="text-align:right">${this.formatMoney(profit)}</td>
          <td style="text-align:right">${p.success || 0}</td>
          <td style="text-align:right">${p.cancel || 0}</td>
          <td style="text-align:right">${p.return || 0}</td>
        </tr>
      `;
    }).join('');
    
    const topProducts = this.statsData.top_products || [];
    const topProductsTable = this.$('topProducts');
    
    if (topProducts.length === 0) {
      topProductsTable.innerHTML = '<tr><td colspan="4" style="text-align:center;color:#999">Chưa có dữ liệu</td></tr>';
      return;
    }
    
    topProductsTable.innerHTML = topProducts.map((p, idx) => `
      <tr>
        <td>${idx + 1}</td>
        <td>
          <div class="product-item">
            <img class="product-img" src="./no-image.svg" alt="" onerror="this.src='./no-image.svg'"/>
            <span>${p.name || ''}</span>
          </div>
        </td>
        <td style="text-align:right">${p.qty || 0}</td>
        <td style="text-align:right">${this.formatMoney(p.revenue)}</td>
      </tr>
    `).join('');
  }

  // ==================== INIT ====================
  init() {
    console.log('[StatsManager] Initializing...');

    // Bind events
    this.$('applyFilter').addEventListener('click', () => this.loadStats());
    this.$('btnToday').addEventListener('click', () => this.setToday());
    this.$('btnThisWeek').addEventListener('click', () => this.setThisWeek());
    this.$('btnThisMonth').addEventListener('click', () => this.setThisMonth());
    this.$('costCard').addEventListener('click', () => this.showCostModal());
    this.$('closeModal').addEventListener('click', () => this.closeCostModal());
    this.$('btnAddCost').addEventListener('click', () => this.addCost());
    
    this.$('costModal').addEventListener('click', (e) => {
      if (e.target.id === 'costModal') this.closeCostModal();
    });

    // Initialize auth
    if (window.Admin) {
      Admin.ensureAuth();
    }

    // Load initial data
    setTimeout(() => {
      this.setToday();
      this.loadInventoryValue();
    }, 500);

    console.log('[StatsManager] Initialized ✅');
  }
}

// Global instance
window.StatsManager = StatsManager;
window.statsManager = new StatsManager();

// Auto-init when DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => window.statsManager.init());
} else {
  window.statsManager.init();
}