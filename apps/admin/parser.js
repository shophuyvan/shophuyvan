const Parser = {
  parse(text) {
    const lines = text.split('\n').map(l => l.trim()).filter(l => l);
    if (lines.length < 2) return [];

    // Chuẩn hóa header để nhận diện sàn
    const header = lines[0].toLowerCase();
    let platform = '';

    if (header.includes('phí vận chuyển do người mua trả') || header.includes('số đơn hàng')) {
      platform = 'shopee';
    } else if (header.includes('seller sku') || header.includes('tên sản phẩm')) {
      platform = 'lazada';
    } else if (header.includes('sku id') || header.includes('giá trị đơn hàng')) {
      platform = 'tiktok';
    } else {
      platform = 'default';
    }

    console.log('[Parser] Detected platform:', platform);

    const rows = lines.slice(1);
    return rows.map(line => {
      // Xử lý CSV cơ bản (tách dấu phẩy, bỏ ngoặc kép)
      const cols = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(c => c.replace(/"/g, ''));
      
      if (platform === 'shopee') {
        return {
          order_id: cols[0],
          date: cols[1],
          rev: Number(cols[3]) || 0,
          profit: (Number(cols[3]) || 0) * 0.2, // Giả định profit 20% nếu chưa có cost
          shop: cols[2] || 'shopee_store',
          platform: 'shopee'
        };
      }
      if (platform === 'lazada') {
        return {
          order_id: cols[0],
          date: cols[1],
          rev: Number(cols[10]) || 0,
          profit: (Number(cols[10]) || 0) * 0.15,
          shop: 'lazada_store',
          platform: 'lazada'
        };
      }
      if (platform === 'tiktok') {
        return {
          order_id: cols[0],
          date: cols[1],
          rev: Number(cols[12]) || 0,
          profit: (Number(cols[12]) || 0) * 0.18,
          shop: 'tiktok_store',
          platform: 'tiktok'
        };
      }
      return null;
    }).filter(Boolean);
  }
};