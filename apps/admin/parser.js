const Parser = {
  parse(text) {
    const lines = text.split('\n').map(l => l.trim()).filter(l => l);
    if (lines.length < 2) return [];

    const header = lines[0].toLowerCase();
    let platform = 'default';

    // Logic nhận diện sàn dựa trên header đặc trưng
    if (header.includes('phí vận chuyển do người mua trả') || header.includes('số đơn hàng')) platform = 'shopee';
    else if (header.includes('seller sku') || header.includes('order id')) platform = 'lazada';
    else if (header.includes('sku id') || header.includes('giá trị đơn hàng')) platform = 'tiktok';

    const rows = lines.slice(1);
    return rows.map(line => {
      // Regex xử lý CSV phức tạp có chứa dấu phẩy trong ngoặc kép
      const cols = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(c => c.replace(/"/g, ''));
      
      try {
        if (platform === 'shopee') {
          return { order_id: cols[0], date: cols[1], rev: Number(cols[3]) || 0, profit: (Number(cols[3]) || 0) * 0.15, shop: cols[2] || 'Shopee Store', platform: 'shopee' };
        }
        if (platform === 'lazada') {
          return { order_id: cols[0], date: cols[1], rev: Number(cols[10]) || 0, profit: (Number(cols[10]) || 0) * 0.12, shop: 'Lazada Store', platform: 'lazada' };
        }
        if (platform === 'tiktok') {
          return { order_id: cols[0], date: cols[1], rev: Number(cols[12]) || 0, profit: (Number(cols[12]) || 0) * 0.18, shop: 'TikTok Store', platform: 'tiktok' };
        }
      } catch (e) { return null; }
      return null;
    }).filter(Boolean);
  }
};