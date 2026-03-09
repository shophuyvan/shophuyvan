export async function saveReports(req, env) {

  try {

    const { reports } = await req.json();
    const now = Math.floor(Date.now() / 1000);
    const queries = [];

    for (const item of reports) {

      const shop = item.shop || "default";
      const channel = `${item.platform}_${shop}`;

      queries.push(
        env.DB.prepare(`
          INSERT OR REPLACE INTO orders (
            order_number,
            channel,
            order_date,
            total,
            profit,
            created_at,
            updated_at,
            status
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, 'completed')
        `).bind(
          item.order_id,
          channel,
          item.date,
          item.rev,
          item.profit,
          now,
          now
        )
      );

      queries.push(
        env.DB.prepare(`
          INSERT INTO daily_profit_stats
          (date, channel, total_orders, total_revenue, total_profit, updated_at)

          VALUES (?, ?, 1, ?, ?, ?)

          ON CONFLICT(date, channel) DO UPDATE SET
            total_orders = total_orders + 1,
            total_revenue = total_revenue + excluded.total_revenue,
            total_profit = total_profit + excluded.total_profit,
            updated_at = ?
        `).bind(
          item.date,
          channel,
          item.rev,
          item.profit,
          now,
          now
        )
      );
    }

    await env.DB.batch(queries);

    return Response.json({
      ok: true,
      total: reports.length
    });

  } catch (err) {

    return Response.json({
      ok: false,
      error: err.message
    });

  }
}