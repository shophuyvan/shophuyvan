// workers/shv-api/src/modules/shipping/waybill-template.js
// ===================================================================
// Waybill Template - Shopee SPX Style (Black & White)
// ===================================================================

export function getWaybillHTML(data) {
  const {
    superaiCode,
    logo,
    sender,
    receiver,
    customer,
    items,
    order,
    createdDate,
    barcodeSrc,
    store
  } = data;

  const carrierName = order.carrier_name || order.shipping_provider || 'SHOP HUY VÂN';
  const trackingCode = order.tracking_code || order.carrier_code || superaiCode || 'N/A';
  const totalAmount = Number((order.subtotal || 0) + (order.shipping_fee || 0));
  const senderName = sender.name || store.name || 'SHOP HUY VÂN';
  const senderAddress = sender.address || store.address || '91/6 Liên Khu 5-11-12, Bình Trị Đông, Bình Tân, TPHCM';
  const senderPhone = sender.phone || store.phone || '0909128999';
  const receiverName = receiver.name || customer.name || 'Khách';
  const receiverAddress = receiver.address || customer.address || '';
  const receiverPhone = receiver.phone || customer.phone || '';

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Vận đơn ${trackingCode}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    
    body { 
      font-family: Arial, sans-serif;
      background: white;
      margin: 0;
      padding: 0;
    }
    
    .page {
      width: 100mm;
      min-height: 150mm;
      background: white;
      border: 3px solid #000;
      padding: 0;
      margin: 0 auto;
    }
    
    /* HEADER - Logo + Tên ĐV + Barcode */
    .header {
      border-bottom: 2px solid #000;
      padding: 3mm;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    
    .carrier-name {
      font-size: 20px;
      font-weight: bold;
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    
    .barcode-section {
      text-align: center;
    }
    
    .barcode-section img {
      height: 12mm;
      margin-bottom: 1mm;
    }
    
    .barcode-text {
      font-size: 10px;
      font-family: 'Courier New', monospace;
    }
    
    /* 2 CỘT: TỪ - ĐẾN */
    .address-row {
      display: flex;
      border-bottom: 2px dashed #000;
    }
    
    .address-col {
      flex: 1;
      padding: 3mm;
      border-right: 2px dashed #000;
    }
    
    .address-col:last-child {
      border-right: none;
    }
    
    .address-label {
      font-size: 11px;
      font-weight: bold;
      margin-bottom: 2mm;
      text-transform: uppercase;
    }
    
    .address-name {
      font-size: 14px;
      font-weight: bold;
      margin-bottom: 1mm;
    }
    
    .address-detail {
      font-size: 12px;
      line-height: 1.3;
      margin-bottom: 1mm;
    }
    
    .address-phone {
      font-size: 13px;
      font-weight: bold;
      margin-top: 1mm;
    }
    
    /* SẢN PHẨM + QR */
    .content-section {
      display: flex;
      border-bottom: 2px solid #000;
    }
    
    .items-col {
      flex: 1;
      padding: 3mm;
      border-right: 2px solid #000;
    }
    
    .items-title {
      font-size: 12px;
      font-weight: bold;
      margin-bottom: 2mm;
      text-transform: uppercase;
    }
    
    .item-row {
      font-size: 11px;
      line-height: 1.4;
      margin-bottom: 2mm;
      padding-bottom: 2mm;
      border-bottom: 1px solid #ddd;
    }
    
    .item-row:last-child {
      border-bottom: none;
    }
    
    .item-number {
      font-weight: bold;
      margin-right: 1mm;
    }
    
    .item-name {
      color: #333;
    }
    
    .item-variant {
      font-weight: bold;
      margin-top: 0.5mm;
      color: #000;
    }
    
    .item-meta {
      font-size: 10px;
      color: #666;
      margin-top: 0.5mm;
    }
    
    .qr-col {
      width: 30mm;
      padding: 3mm;
      text-align: center;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
    }
    
    .qr-col img {
      width: 25mm;
      height: 25mm;
      border: 2px solid #000;
      padding: 1mm;
    }
    
    /* NOTE SECTION */
    .note-section {
      padding: 2mm 3mm;
      font-size: 10px;
      line-height: 1.4;
      border-bottom: 2px solid #000;
      background: #f9f9f9;
    }
    
    /* TỔNG TIỀN - TO NHƯ SPX */
    .total-section {
      padding: 4mm 3mm;
      border-bottom: 2px solid #000;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    
    .total-label {
      font-size: 11px;
      font-weight: bold;
      text-align: right;
    }
    
    .total-label-main {
      font-size: 12px;
      margin-bottom: 1mm;
    }
    
    .total-label-sub {
      font-size: 10px;
      color: #666;
    }
    
    .total-amount-box {
      text-align: center;
    }
    
    .total-amount {
      font-size: 36px;
      font-weight: bold;
      font-family: 'Courier New', monospace;
      letter-spacing: 1px;
      line-height: 1;
    }
    
    .total-currency {
      font-size: 14px;
      font-weight: bold;
      margin-top: 1mm;
    }
    
    /* MÃ VẬN ĐƠN TO - GIỐNG SPX */
    .tracking-section {
      padding: 4mm 3mm;
      text-align: center;
      border-bottom: 2px solid #000;
    }
    
    .tracking-code {
      font-size: 32px;
      font-weight: bold;
      font-family: 'Courier New', monospace;
      letter-spacing: 2px;
    }
    
    /* FOOTER - ĐEN */
    .footer {
      background: #000;
      color: white;
      padding: 3mm;
      text-align: center;
    }
    
    .footer-text {
      font-size: 13px;
      font-weight: bold;
      margin-bottom: 1mm;
    }
    
    @media print {
      body { margin: 0; padding: 0; }
      .page { 
        width: 100mm;
        border: none;
        margin: 0;
      }
    }
  </style>
</head>
<body>
  <div class="page">
    
    <!-- HEADER: TÊN ĐƠN VỊ + BARCODE -->
    <div class="header">
      <div class="carrier-name">${carrierName}</div>
      <div class="barcode-section">
        <img src="https://barcode.tec-it.com/barcode.ashx?data=${encodeURIComponent(trackingCode)}&code=Code128&multiplebarcodes=false&translate-esc=false&unit=Fit&dpi=96&imagetype=Gif&rotation=0&color=%23000000&bgcolor=%23ffffff&qunit=Mm&quiet=0" alt="Barcode">
        <div class="barcode-text">Mã vận đơn: ${trackingCode}</div>
      </div>
    </div>
    
    <!-- 2 CỘT: TỪ - ĐẾN -->
    <div class="address-row">
      <!-- TỪ -->
      <div class="address-col">
        <div class="address-label">Từ:</div>
        <div class="address-name">${senderName}</div>
        <div class="address-detail">${senderAddress}</div>
        <div class="address-phone">SĐT: ${senderPhone}</div>
      </div>
      
      <!-- ĐẾN -->
      <div class="address-col">
        <div class="address-label">Đến:</div>
        <div class="address-name">${receiverName}</div>
        <div class="address-detail">${receiverAddress}</div>
        <div class="address-phone">SĐT: ${receiverPhone}</div>
      </div>
    </div>
    
    <!-- SẢN PHẨM + QR CODE -->
    <div class="content-section">
      <div class="items-col">
        <div class="items-title">Nội dung hàng (Tổng SL sản phẩm: ${items.length})</div>
        ${items.slice(0, 5).map((item, idx) => `
          <div class="item-row">
            <span class="item-number">${idx + 1}.</span>
            <span class="item-name">${item.name || 'Sản phẩm'}</span>
            ${item.variant ? `<div class="item-variant">${item.variant}</div>` : ''}
            <div class="item-meta">SL: ${item.qty || 1} | Giá: ${Number(item.price || 0).toLocaleString('vi-VN')}₫</div>
          </div>
        `).join('')}
        ${items.length > 5 ? `<div style="font-size:10px; color:#666; margin-top:2mm;">...và ${items.length - 5} sản phẩm khác</div>` : ''}
      </div>
      
      <div class="qr-col">
        <img src="https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(trackingCode)}" alt="QR">
      </div>
    </div>
    
    <!-- GHI CHÚ -->
    <div class="note-section">
      Kiểm tra kĩ tên sản phẩm và số chi tiết <strong>Mã vận đơn</strong> và <strong>Mã đơn hàng</strong>. 
      Tiền thu từ <strong>Bên gửi/Shopee</strong> trước khi ký nhận và chỉ ký vào sổ sách 
      (phần có chữ ký xác nhận của khách hàng)
    </div>
    
    <!-- TỔNG TIỀN -->
    <div class="total-section">
      <div class="total-label">
        <div class="total-label-main">Khối lượng tới đa: ${(items.reduce((sum, item) => sum + (Number(item.qty || 1) * 400), 0) / 1000).toFixed(1)} kg</div>
        <div class="total-label-sub">Chú ký người nhận<br>Xác nhận hàng nguyên vẹn, không móp/méo,<br>hàng đ</div>
      </div>
      <div class="total-amount-box">
        <div class="total-amount">${totalAmount.toLocaleString('vi-VN')}</div>
        <div class="total-currency">VND</div>
      </div>
    </div>
    
    <!-- MÃ VẬN ĐƠN TO -->
    <div class="tracking-section">
      <div class="tracking-code">${trackingCode}</div>
    </div>
    
    <!-- FOOTER -->
    <div class="footer">
      <div class="footer-text">Hotline khiếu nại và đổi trả sản phẩm | 0909128999</div>
      <div class="footer-text">💬 Zalo: 0909128999 | 🌐 shophuyvan.vn</div>
    </div>
    
  </div>

  <script>
    window.onload = function() {
      setTimeout(() => window.print(), 500);
    };
  </script>
</body>
</html>`;
}