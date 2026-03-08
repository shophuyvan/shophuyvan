export async function saveReports(req, env) {
  try {
    const { reports } = await req.json();
    if (!reports || !Array.isArray(reports)) {
      return new Response(JSON.stringify({ ok: false, error: 'Dữ liệu không hợp lệ' }), { status: 400 });
    }

    const queries = [];
    const now = Math.floor(Date.now() / 1000);

    for (const item of reports) {
      // 1. Lưu hoặc cập nhật đơn hàng chi tiết vào bảng orders
      // Sử dụng INSERT OR REPLACE dựa trên order_number để tránh trùng đơn
      queries.push(env.DB.prepare(`
        INSERT OR REPLACE INTO orders (
          order_number, channel, order_date, total, profit, created_at, updated_at, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'completed')
      `).bind(
        item.order_id || `AUTO-${now}-${Math.random().toString(36).substr(2, 5)}`, 
        item.platform,
        item.date, // Định dạng YYYY-MM-DD
        item.rev,
        item.profit,
        now,
        now
      ));

      // 2. Cập nhật bảng thống kê tổng hợp daily_profit_stats
      queries.push(env.DB.prepare(`
        INSERT INTO daily_profit_stats (date, total_orders, total_revenue, total_profit, updated_at)
        VALUES (?, 1, ?, ?, ?)
        ON CONFLICT(date) DO UPDATE SET
          total_orders = total_orders + 1,
          total_revenue = total_revenue + excluded.total_revenue,
          total_profit = total_profit + excluded.total_profit,
          updated_at = ?
      `).bind(item.date, item.rev, item.profit, now, now));
    }

    // Chạy tất cả lệnh SQL trong 1 phiên (Batch) để tối ưu tốc độ
    await env.DB.batch(queries);

    return new Response(JSON.stringify({ ok: true, message: `Đã lưu ${reports.length} bản ghi` }));
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: err.message }), { status: 500 });
  }
}

export async function getReports(req, env) {
  const url = new URL(req.url);
  const start = url.searchParams.get('start');
  const end = url.searchParams.get('end');

  const results = await env.DB.prepare(`
    SELECT * FROM daily_profit_stats 
    WHERE date BETWEEN ? AND ? 
    ORDER BY date DESC
  `).bind(start, end).all();

  return new Response(JSON.stringify({ ok: true, data: results.results }));
}