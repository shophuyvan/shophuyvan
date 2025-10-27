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
  async loadCosts() {
    try {
      const data = await Admin.req('/admin/costs');
      this.costs = data.costs || [];
      console.log('[Stats] Costs loaded:', this.costs.length);
    } catch (error) {
      console.error('Failed to load costs for stats:', error);
      this.costs = [];
    }
  }

  calculateTotalCosts(orderCount) {
    let total = 0;

    // Lấy số ngày trong khoảng
    const fromDateStr = this.$('fromDate').value;
    const toDateStr = this.$('toDate').value;
    
    if (!fromDateStr || !toDateStr) {
      return 0; // Chưa chọn ngày
    }

    const fromDate = new Date(fromDateStr + 'T00:00:00+07:00');
    const toDate = new Date(toDateStr + 'T23:59:59+07:00');
    
    // Tính số ngày trong khoảng (tối thiểu là 1)
    const timeDiff = toDate.getTime() - fromDate.getTime();
    const daysInRange = Math.max(1, Math.round(timeDiff / (1000 * 60 * 60 * 24)));
    
    // Lấy số ngày trong tháng của ngày BẮT ĐẦU
    const daysInMonth = new Date(fromDate.getFullYear(), fromDate.getMonth() + 1, 0).getDate();
    
    this.costs.forEach(c => {
      if (c.type === 'monthly') {
        // Chia chi phí tháng ra theo ngày, rồi nhân với số ngày trong khoảng
        const dailyCost = (c.amount || 0) / daysInMonth;
        total += dailyCost * daysInRange;
      } else {
        // Chi phí theo đơn
        total += (c.amount || 0) * orderCount;
      }
    });
    return total;
  }

  // ==================== LOAD STATS ====================
  async loadStats() {
  try {
    await this.loadCosts(); // Tải lại chi phí mỗi khi lọc
    console.log('[Stats] Loading stats...');
    const fromDate = this.$('fromDate').value;
    const toDate = this.$('toDate').value;
    
    if (!fromDate || !toDate) {
      console.warn('[Stats] Missing date range');
      return;
    }

    // Chuyển đổi sang timestamp
    const fromTime = new Date(fromDate + 'T00:00:00+07:00').getTime();
    const toTime = new Date(toDate + 'T23:59:59+07:00').getTime();
    
    console.log('[Stats] Date range:', { fromTime, toTime });
	// Helper chuẩn hóa số tiền — ĐƯA LÊN TRƯỚC KHI buildCostMap DÙNG
const toNum = (x) => {
  if (typeof x === 'string') return Number(x.replace(/[^\d.-]/g, '')) || 0;
  return Number(x || 0);
};
// ==== Fallback cost map from Products (product/variant import_price) ====
// Dùng helper toNum đã có sẵn trong file, KHÔNG khai báo thêm ở đây.

const buildCostMap = async () => {
  const plist = await Admin.tryPaths([
    '/admin/products',
    '/admin/product/list',
    '/admin/products/list'
  ]);
  const prows = plist?.items || plist?.data || plist?.products || plist?.rows || plist?.list || [];
  const costMap = Object.create(null);

  const fetchDetail = async (id) => {
    try {
      const detail = await Admin.tryPaths([
        `/admin/products/get?id=${encodeURIComponent(id)}`,
        `/admin/product/get?id=${encodeURIComponent(id)}`,
        `/admin/products/detail?id=${encodeURIComponent(id)}`,
        `/admin/product/detail?id=${encodeURIComponent(id)}`,
        `/admin/product?id=${encodeURIComponent(id)}`
      ]);
      return detail?.item || detail?.data || detail || null;
    } catch {
      return null;
    }
  };

  // duyệt danh sách sản phẩm -> lấy biến thể và đẩy vào costMap
  for (const it of prows) {
    const pid = it?.id || it?._id;
    if (!pid) continue;

    const p = await fetchDetail(pid);
    if (!p) continue;

    const variants = Array.isArray(p.variants) ? p.variants
                  : Array.isArray(p.options)  ? p.options
                  : Array.isArray(p.skus)     ? p.skus
                  : [];

    if (variants.length) {
      for (const v of variants) {
        const vid   = v.id || v._id || v.variant_id || v.sku_id || v.sku || v.code;
        const cost  = toNum(v.cost ?? v.cost_price ?? v.import_price ?? v.price_import ?? v.purchase_price);
        if (vid) costMap[vid] = cost;                    // map theo variant id
      }
    }

    // map theo product id & title (phòng khi line không có variant)
    const pcost = toNum(
      p.cost ?? p.cost_price ?? p.import_price ?? p.price_import ?? p.purchase_price
    );
    if (pid && pcost) costMap[pid] = pcost;

    const ptitle = (p.title || p.name || '').toLowerCase().trim();
    if (ptitle && pcost) costMap[ptitle] = pcost;
  }

  return costMap;
};

const COST_MAP = await buildCostMap();
// ==== END cost map ====

    // GỌI BACKEND API để lấy stats (backend đã tính cost từ variants)
    const backendStats = await Admin.req(`/admin/stats?from=${fromTime}&to=${toTime}`);
    console.log('[Stats] Backend stats:', backendStats);

    // Lấy orders để tính thêm platform breakdown và top products
    const ordersRes = await Admin.req('/admin/orders');
    let orders = ordersRes.items || ordersRes.data || ordersRes.orders || [];
    
    // Filter theo date range
    orders = orders.filter(o => {
      const orderTime = o.createdAt || o.created_at || o.timestamp || o.date;
      const time = typeof orderTime === 'number' ? orderTime : new Date(orderTime).getTime();
      return time >= fromTime && time <= toTime;
    });
    
    console.log('[Stats] Filtered orders:', orders.length);

    // Tính platform stats
    let totalOrders = orders.length;
    let cancelOrders = 0;
    let returnOrders = 0;
    let confirmedOrders = 0;
    
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
      
      // Chỉ tính revenue/cost cho đơn không cancel
      if (
        !status.includes('cancel') &&
        !status.includes('hủy') &&
        !status.includes('huy') &&
        status !== 'cancelled'
      ) {
        const orderRevenue = toNum(order.revenue || order.subtotal || order.total || 0);
        platformStats[platform].revenue += orderRevenue;

        const lines = Array.isArray(order.items) ? order.items
                    : Array.isArray(order.order_items) ? order.order_items
                    : Array.isArray(order.lines) ? order.lines
                    : [];

        // Tính cost_price cho platform (từ items.cost nếu có)
        let orderCost = 0;
lines.forEach(it => {
  const qty = toNum(it.qty ?? it.quantity ?? it.count ?? 1);

  // 1) ưu tiên cost có sẵn trên line
  let unitCost = toNum(
    it.cost ?? it.cost_price ?? it.import_price ?? it.price_import ?? 0
  );

  // 2) nếu chưa có, fallback từ COST_MAP:
  if (!unitCost) {
    const vid = it.variant_id || it.sku_id || it.sku || it.variantId || it.variant;
    const pid = it.product_id || it.productId || it.pid || it.id;
    const keyTitle = (it.title || it.name || it.product_name || '').toLowerCase().trim();

    unitCost = toNum(
      (vid && COST_MAP[vid]) ??
      (pid && COST_MAP[pid]) ??
      (keyTitle && COST_MAP[keyTitle]) ?? 0
    );
  }

  orderCost += qty * unitCost;
});

platformStats[platform].cost_price += orderCost;

        // Top products
        lines.forEach(item => {
          const productName = item.title || item.name || item.product_name || 'Unknown';
          const qty = toNum(item.qty ?? item.quantity ?? 1);
          const price = toNum(item.price ?? item.unit_price ?? 0);

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
    
    // Tổng theo platform
const web  = platformStats['Website']     || { orders: 0, revenue: 0, cost_price: 0 };
const mini = platformStats['Zalo MiniApp'] || { orders: 0, revenue: 0, cost_price: 0 };

// Dùng cost từ backend (đã tính theo variants)
const backendCost = Number(
  backendStats?.cost_price ?? backendStats?.goods_cost ?? 0
);
const computedCost = (web.cost_price || 0) + (mini.cost_price || 0);

this.statsData = {
  orders: totalOrders,
  cancels: cancelOrders,
  returns: returnOrders,
  confirmed: confirmedOrders,

  // Doanh thu = tổng revenue của 2 platform
  revenue: (web.revenue + mini.revenue),

  // Giá nhập = số backend đã tính từ variants
  cost_price: (backendCost > 0 ? backendCost : computedCost),

  // Bảng nền tảng: giữ cost theo items đã cộng ở trên
  platforms: [
    { name: 'Website',     orders: web.orders,  revenue: web.revenue,  cost_price: web.cost_price,  color: '#3b82f6' },
    { name: 'Zalo MiniApp', orders: mini.orders, revenue: mini.revenue, cost_price: mini.cost_price, color: '#7c3aed' }
  ],

  // Top sản phẩm đã gom ở trên
  top_products: topProducts
};
    
    console.log('[Stats] Final stats data:', this.statsData);
    
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
      const listRes = await Admin.tryPaths([
        '/admin/products',
        '/admin/product/list',
        '/admin/products/list'
      ]);
      const items = listRes?.items || listRes?.data || listRes?.products || listRes?.rows || listRes?.list || [];
      console.log('[Stats] products length:', items.length);

      const toNum = (x) => {
        if (typeof x === 'string') return Number(x.replace(/[^\d.-]/g, '')) || 0;
        return Number(x || 0);
      };

      const fetchDetail = async (id) => {
        try {
          const detail = await Admin.tryPaths([
            `/admin/products/get?id=${encodeURIComponent(id)}`,
            `/admin/product/get?id=${encodeURIComponent(id)}`,
            `/admin/products/detail?id=${encodeURIComponent(id)}`,
            `/admin/product/detail?id=${encodeURIComponent(id)}`,
            `/admin/product?id=${encodeURIComponent(id)}`
          ]);
          return detail?.item || detail?.data || detail || null;
        } catch (e) {
          console.warn('[Stats] detail not found for', id, e);
          return null;
        }
      };

      let totalValue = 0;

      for (const it of items) {
        const id = it?.id || it?._id;
        if (!id) continue;

        const p = await fetchDetail(id);
        if (!p) continue;

        const variants = Array.isArray(p.variants) ? p.variants
                      : Array.isArray(p.options)  ? p.options
                      : Array.isArray(p.skus)     ? p.skus
                      : [];

        if (variants.length > 0) {
          for (const v of variants) {
            const stock = toNum(v.stock ?? v.inventory ?? v.quantity);
            const cost  = toNum(v.cost ?? v.cost_price ?? v.import_price ?? v.price_import ?? v.purchase_price);
            totalValue += stock * cost;
          }
        } else {
          const stock = toNum(p.stock ?? p.inventory ?? p.quantity);
          const cost  = toNum(p.cost ?? p.cost_price ?? p.import_price ?? p.price_import ?? p.purchase_price);
          totalValue += stock * cost;
        }
      }

      this.$('inventoryValue').textContent = this.formatMoney(totalValue);
      console.log('[Stats] Inventory value:', totalValue);
    } catch (error) {
      console.error('[Stats] Error loading inventory value:', error);
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
	this.$('costCard').style.cursor = 'default';

    // Initialize auth
    if (window.Admin) {
      Admin.ensureAuth();
    }

    // Load initial data
    setTimeout(async () => {
      await this.loadCosts(); // Tải chi phí trước
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