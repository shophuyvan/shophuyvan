const ProfitEngine = {
  // Thống kê theo SKU để vẽ biểu đồ Top SKU
  bySKU(orders) {
    const map = {};
    orders.forEach(o => {
      const key = o.sku || o.order_id; // Fallback nếu chưa map SKU
      if (!map[key]) map[key] = { sku: key, revenue: 0, cost: 0, profit: 0, count: 0 };
      map[key].revenue += Number(o.rev || 0);
      map[key].profit += Number(o.profit || 0);
      map[key].count += 1;
    });
    return Object.values(map).sort((a, b) => b.profit - a.profit).slice(0, 10);
  },

  // Thống kê theo tháng từ dữ liệu API daily_profit_stats
  byMonth(dailyStats) {
    const months = {};
    dailyStats.forEach(item => {
      const monthKey = item.date.substring(0, 7); // Lấy YYYY-MM
      if (!months[monthKey]) {
        months[monthKey] = { label: monthKey, revenue: 0, profit: 0, orders: 0 };
      }
      months[monthKey].revenue += Number(item.total_revenue || 0);
      months[monthKey].profit += Number(item.total_profit || 0);
      months[monthKey].orders += Number(item.total_orders || 0);
    });
    return Object.values(months).sort((a, b) => a.label.localeCompare(b.label));
  }
};