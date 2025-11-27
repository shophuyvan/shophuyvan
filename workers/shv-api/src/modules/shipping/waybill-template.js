// workers/shv-api/src/modules/shipping/waybill-template.js
// ===================================================================
// Waybill HTML Template A6 - Black & White Optimized
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

  const carrierName = order.carrier_name || order.shipping_provider || 'VẬN CHUYỂN';
  const trackingCode = order.tracking_code || order.carrier_code || superaiCode || 'N/A';
  const totalAmount = Number((order.subtotal || 0) + (order.shipping_fee || 0));

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Vận đơn ${trackingCode}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      font-family: 'Arial', 'Helvetica', sans-serif; 
      background: #fff; 
      padding: 0;
      margin: 0;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    
    /* A6 SIZE - 105mm x 148mm (portrait) */
    .page { 
      width: 105mm; 
      height: 148mm; 
      background: white; 
      padding: 4mm;
      position: relative;
      overflow: hidden;
      border: 2px solid #000;
    }
    
    /* ====== HEADER: TÊN ĐƠN VỊ + MÃ VẬN ĐƠN + QR ====== */
    .top-section {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 3mm;
      padding-bottom: 2mm;
      border-bottom: 3px solid #000;
    }
    
    .carrier-info {
      flex: 1;
      padding-right: 2mm;
    }
    
    .carrier-name {
      font-size: 16px;
      font-weight: bold;
      text-transform: uppercase;
      margin-bottom: 2px;
      letter-spacing: 0.5px;
    }
    
    .tracking-code {
      font-size: 22px;
      font-weight: bold;
      letter-spacing: 1.5px;
      font-family: 'Courier New', monospace;
      margin-top: 1px;
    }
    
    .qr-box {
      flex-shrink: 0;
      text-align: center;
      border: 2px solid #000;
      padding: 2mm;
    }
    
    .qr-box img {
      width: 18mm;
      height: 18mm;
      display: block;
    }
    
    /* ====== NGƯỜI GỬI ====== */
    .sender-section {
      border: 2px solid #000;
      padding: 2mm;
      margin-bottom: 2mm;
      background: #f5f5f5;
    }
    
    .section-title {
      font-size: 11px;
      font-weight: bold;
      background: #000;
      color: white;
      padding: 1mm 2mm;
      margin: -2mm -2mm 2mm -2mm;
      text-transform: uppercase;
    }
    
    .info-row {
      font-size: 11px;
      line-height: 1.3;
      margin-bottom: 1mm;
    }
    
    .info-row strong {
      font-weight: bold;
      min-width: 60px;
      display: inline-block;
    }
    
    .phone-number {
      font-size: 13px;
      font-weight: bold;
      margin-top: 1mm;
    }
    
    /* ====== NGƯỜI NHẬN ====== */
    .receiver-section {
      border: 3px solid #000;
      padding: 2mm;
      margin-bottom: 2mm;
      background: #f5f5f5;
    }
    
    .receiver-name {
      font-size: 14px;
      font-weight: bold;
      margin-bottom: 1mm;
    }
    
    .receiver-address {
      font-size: 11px;
      line-height: 1.3;
      margin-bottom: 1mm;
    }
    
    .receiver-phone {
      font-size: 13px;
      font-weight: bold;
    }
    
    /* ====== SẢN PHẨM ====== */
    .items-section {
      border: 2px solid #000;
      margin-bottom: 2mm;
      max-height: 30mm;
      overflow: hidden;
    }
    
    .items-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 10px;
    }
    
    .items-table th {
      background: #000;
      color: white;
      padding: 1mm;
      font-weight: bold;
      text-align: left;
      font-size: 10px;
    }
    
    .items-table td {
      padding: 1mm;
      border-bottom: 1px solid #ddd;
      vertical-align: top;
    }
    
    .product-name {
      font-size: 9px;
      color: #666;
      line-height: 1.2;
    }
    
    .variant-name {
      font-size: 12px;
      font-weight: bold;
      margin-top: 0.5mm;
      line-height: 1.2;
    }
    
    .item-qty {
      text-align: center;
      font-weight: bold;
      font-size: 11px;
    }
    
    .item-price {
      text-align: right;
      font-weight: bold;
      font-size: 11px;
    }
    
    /* ====== TỔNG TIỀN - NỔI BẬT ====== */
    .payment-section {
      background: #000;
      color: white;
      padding: 2mm;
      text-align: center;
      margin-bottom: 2mm;
      border: 3px solid #000;
    }
    
    .payment-title {
      font-size: 11px;
      font-weight: bold;
      margin-bottom: 1mm;
    }
    
    .payment-amount {
      font-size: 20px;
      font-weight: bold;
      letter-spacing: 1px;
      font-family: 'Courier New', monospace;
    }
    
    .payment-note {
      font-size: 9px;
      margin-top: 1mm;
      opacity: 0.9;
    }
    
    /* ====== FOOTER ====== */
    .footer {
      text-align: center;
      border-top: 2px solid #000;
      padding-top: 1mm;
      font-size: 10px;
      position: absolute;
      bottom: 4mm;
      left: 4mm;
      right: 4mm;
    }
    
    .footer-line {
      margin-bottom: 0.5mm;
    }
    
    .footer-bold {
      font-weight: bold;
      font-size: 11px;
    }
    
    @media print {
      body { 
        margin: 0; 
        padding: 0; 
        background: white; 
      }
      .page { 
        width: 105mm; 
        height: 148mm; 
        margin: 0; 
        padding: 4mm; 
        page-break-after: avoid;
        border: none;
      }
    }
  </style>
</head>
<body>
  <div class="page">
    <!-- TOP: ĐƠN VỊ VẬN CHUYỂN + MÃ VẬN ĐƠN + QR CODE -->
    <div class="top-section">
      <div class="carrier-info">
        <div class="carrier-name">${carrierName}</div>
        <div class="tracking-code">${trackingCode}</div>
      </div>
      <div class="qr-box">
        <img src="https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(trackingCode)}" alt="QR">
      </div>
    </div>

    <!-- NGƯỜI GỬI -->
    <div class="sender-section">
      <div class="section-title">👤 NGƯỜI GỬI</div>
      <div class="info-row"><strong>${sender.name || store.name || 'SHOP HUY VÂN'}</strong></div>
      <div class="info-row">${sender.address || store.address || '91/6 Liên Khu 5-11-12, Bình Trị Đông, Bình Tân, TPHCM'}</div>
      <div class="phone-number">☎ ${sender.phone || store.phone || '0909128999'}</div>
    </div>

    <!-- NGƯỜI NHẬN -->
    <div class="receiver-section">
      <div class="section-title">📦 NGƯỜI NHẬN</div>
      <div class="receiver-name">${receiver.name || customer.name || 'Khách'}</div>
      <div class="receiver-address">${receiver.address || customer.address || ''}</div>
      <div class="receiver-phone">☎ ${receiver.phone || customer.phone || ''}</div>
    </div>

    <!-- SẢN PHẨM -->
    <div class="items-section">
      <table class="items-table">
        <thead>
          <tr>
            <th style="width: 60%">Sản phẩm</th>
            <th style="width: 20%; text-align: center">SL</th>
            <th style="width: 20%; text-align: right">Giá</th>
          </tr>
        </thead>
        <tbody>
          ${items.slice(0, 4).map(item => `
            <tr>
              <td>
                <div class="product-name">${item.name || 'Sản phẩm'}</div>
                ${item.variant ? `<div class="variant-name">${item.variant}</div>` : ''}
              </td>
              <td class="item-qty">${item.qty || 1}</td>
              <td class="item-price">${Number(item.price || 0).toLocaleString('vi-VN')}₫</td>
            </tr>
          `).join('')}
          ${items.length > 4 ? `<tr><td colspan="3" style="text-align:center; font-size:9px; padding:1mm; color:#666">...và ${items.length - 4} sản phẩm khác</td></tr>` : ''}
        </tbody>
      </table>
    </div>

    <!-- TỔNG TIỀN -->
    <div class="payment-section">
      <div class="payment-title">💰 TỔNG TIỀN THU TỪ NGƯỜI NHẬN</div>
      <div class="payment-amount">${totalAmount.toLocaleString('vi-VN')} ₫</div>
      <div class="payment-note">(Thu hộ - COD)</div>
    </div>

    <!-- FOOTER -->
    <div class="footer">
      <div class="footer-line footer-bold">☎ Hotline: 0909128999 | 0933190000</div>
      <div class="footer-line">💬 Zalo: 0909128999</div>
      <div class="footer-line">🌐 shophuyvan.vn</div>
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