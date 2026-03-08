export async function saveReports(req, env) {
  try {
    const { reports } = await req.json();
    if (!reports || !Array.isArray(reports)) {
      return new Response(JSON.stringify({ ok: false, error: 'Dữ liệu không hợp lệ' }), { status: 400 });
    }

    const queries = [];
    const now = Math.floor(Date.now() / 1000);

    for (const item of reports) {
      // 1. Kiểm tra đơn hàng cũ để trừ đi doanh thu cũ trong bảng tổng hợp (nếu ghi đè)
      const oldOrder = await env.DB.prepare(`SELECT total, profit, order_date FROM orders WHERE order_number = ?`).bind(item.order_id).first();
      
      if (oldOrder) {
        // Nếu có đơn cũ, tạo lệnh trừ doanh thu cũ khỏi ngày cũ
        queries.push(env.DB.prepare(`
          UPDATE daily_profit_stats SET 
            total_orders = total_orders - 1,
            total_revenue = total_revenue - ?,
            total_profit = total_profit - ?
          WHERE date = ?
        `).bind(oldOrder.total, oldOrder.profit, oldOrder.order_date));
      }

      // 2. Ghi đè đơn hàng chi tiết vào bảng orders
      queries.push(env.DB.prepare(`
        INSERT OR REPLACE INTO orders (
          order_number, channel, order_date, total, profit, created_at, updated_at, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'completed')
      `).bind(item.order_id, item.platform, item.date, item.rev, item.profit, now, now));

      // 3. Cộng doanh thu mới vào bảng daily_profit_stats
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

    await env.DB.batch(queries);
    return new Response(JSON.stringify({ ok: true, message: `Đã xử lý (ghi đè) ${reports.length} bản ghi` }));
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