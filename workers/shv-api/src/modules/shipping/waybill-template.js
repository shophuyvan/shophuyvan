// workers/shv-api/src/modules/shipping/waybill-template.js
// ===================================================================
// Waybill HTML Template A6 - FULL PAGE BLACK & WHITE
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
    :root {
      /* === FONT SIZES === */
      --font-carrier: 24px;
      --font-tracking: 32px;
      --font-section-title: 15px;
      --font-info: 15px;
      --font-phone: 18px;
      --font-receiver-name: 20px;
      --font-product-name: 13px;
      --font-variant: 17px;
      --font-qty-price: 16px;
      --font-cod-title: 16px;
      --font-cod-amount: 32px;
      --font-footer: 14px;
      --font-footer-bold: 16px;
      
      /* === SPACING === */
      --page-padding: 5mm;
      --section-margin: 3mm;
      --section-padding: 3mm;
      
      /* === SIZES === */
      --qr-size: 22mm;
    }
    
    * { margin: 0; padding: 0; box-sizing: border-box; }
    
    body { 
      font-family: 'Arial', 'Helvetica', sans-serif; 
      background: #fff; 
      padding: 0;
      margin: 0;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    
    /* A6 SIZE - 105mm x 148mm (portrait) - FULL PAGE */
    .page { 
      width: 105mm; 
      height: 148mm; 
      background: white; 
      padding: var(--page-padding);
      position: relative;
      overflow: hidden;
      border: 3px solid #000;
      display: flex;
      flex-direction: column;
    }
    
    /* ====== HEADER: ĐƠN VỊ + MÃ + QR ====== */
    .top-section {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: var(--section-margin);
      padding-bottom: 3mm;
      border-bottom: 4px solid #000;
      flex-shrink: 0;
    }
    
    .carrier-info {
      flex: 1;
      padding-right: 3mm;
    }
    
    .carrier-name {
      font-size: var(--font-carrier);
      font-weight: bold;
      text-transform: uppercase;
      margin-bottom: 2px;
      letter-spacing: 1px;
    }
    
    .tracking-code {
      font-size: var(--font-tracking);
      font-weight: bold;
      letter-spacing: 2px;
      font-family: 'Courier New', monospace;
      margin-top: 2px;
    }
    
    .qr-box {
      flex-shrink: 0;
      text-align: center;
      border: 3px solid #000;
      padding: 2mm;
    }
    
    .qr-box img {
      width: var(--qr-size);
      height: var(--qr-size);
      display: block;
    }
    
    /* ====== NGƯỜI GỬI ====== */
    .sender-section {
      border: 3px solid #000;
      padding: var(--section-padding);
      margin-bottom: var(--section-margin);
      background: #f5f5f5;
      flex-shrink: 0;
    }
    
    .section-title {
      font-size: var(--font-section-title);
      font-weight: bold;
      background: #000;
      color: white;
      padding: 2mm 3mm;
      margin: calc(var(--section-padding) * -1) calc(var(--section-padding) * -1) 2mm;
      text-transform: uppercase;
    }
    
    .info-row {
      font-size: var(--font-info);
      line-height: 1.4;
      margin-bottom: 2mm;
    }
    
    .info-row strong {
      font-weight: bold;
    }
    
    .phone-number {
      font-size: var(--font-phone);
      font-weight: bold;
      margin-top: 2mm;
    }
    
    /* ====== NGƯỜI NHẬN ====== */
    .receiver-section {
      border: 4px solid #000;
      padding: var(--section-padding);
      margin-bottom: var(--section-margin);
      background: #f5f5f5;
      flex-shrink: 0;
    }
    
    .receiver-name {
      font-size: var(--font-receiver-name);
      font-weight: bold;
      margin-bottom: 2mm;
    }
    
    .receiver-address {
      font-size: var(--font-info);
      line-height: 1.4;
      margin-bottom: 2mm;
    }
    
    .receiver-phone {
      font-size: var(--font-phone);
      font-weight: bold;
    }
    
    /* ====== SẢN PHẨM - FLEXIBLE HEIGHT ====== */
    .items-section {
      border: 3px solid #000;
      margin-bottom: var(--section-margin);
      flex: 1;
      display: flex;
      flex-direction: column;
      min-height: 35mm;
      overflow: hidden;
    }
    
    .items-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 14px;
    }
    
    .items-table th {
      background: #000;
      color: white;
      padding: 2mm;
      font-weight: bold;
      text-align: left;
      font-size: 14px;
    }
    
    .items-table td {
      padding: 2mm 1.5mm;
      border-bottom: 2px solid #ddd;
      vertical-align: top;
    }
    
    .product-name {
      font-size: var(--font-product-name);
      color: #666;
      line-height: 1.3;
    }
    
    .variant-name {
      font-size: var(--font-variant);
      font-weight: bold;
      margin-top: 1mm;
      line-height: 1.3;
    }
    
    .item-qty {
      text-align: center;
      font-weight: bold;
      font-size: var(--font-qty-price);
    }
    
    .item-price {
      text-align: right;
      font-weight: bold;
      font-size: var(--font-qty-price);
      white-space: nowrap;
    }
    
    /* ====== TỔNG TIỀN - SUPER NỔI BẬT ====== */
    .payment-section {
      background: #000;
      color: white;
      padding: 4mm;
      text-align: center;
      margin-bottom: var(--section-margin);
      border: 4px solid #000;
      flex-shrink: 0;
    }
    
    .payment-title {
      font-size: var(--font-cod-title);
      font-weight: bold;
      margin-bottom: 2mm;
      text-transform: uppercase;
    }
    
    .payment-amount {
      font-size: var(--font-cod-amount);
      font-weight: bold;
      letter-spacing: 2px;
      font-family: 'Courier New', monospace;
    }
    
    .payment-note {
      font-size: 13px;
      margin-top: 2mm;
      opacity: 0.9;
    }
    
    /* ====== FOOTER - ALWAYS AT BOTTOM ====== */
    .footer {
      text-align: center;
      border-top: 3px solid #000;
      padding-top: 3mm;
      font-size: var(--font-footer);
      flex-shrink: 0;
    }
    
    .footer-line {
      margin-bottom: 1.5mm;
      line-height: 1.4;
    }
    
    .footer-bold {
      font-weight: bold;
      font-size: var(--font-footer-bold);
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
        padding: var(--page-padding);
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
        <img src="https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(trackingCode)}" alt="QR">
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

    <!-- SẢN PHẨM - TỰ ĐỘNG MỞ RỘNG -->
    <div class="items-section">
      <table class="items-table">
        <thead>
          <tr>
            <th style="width: 55%">Sản phẩm</th>
            <th style="width: 20%; text-align: center">SL</th>
            <th style="width: 25%; text-align: right">Giá</th>
          </tr>
        </thead>
        <tbody>
          ${items.slice(0, 5).map(item => `
            <tr>
              <td>
                <div class="product-name">${item.name || 'Sản phẩm'}</div>
                ${item.variant ? `<div class="variant-name">${item.variant}</div>` : ''}
              </td>
              <td class="item-qty">${item.qty || 1}</td>
              <td class="item-price">${Number(item.price || 0).toLocaleString('vi-VN')}₫</td>
            </tr>
          `).join('')}
          ${items.length > 5 ? `<tr><td colspan="3" style="text-align:center; font-size:12px; padding:2mm; color:#666; font-weight:bold">+ ${items.length - 5} sản phẩm khác</td></tr>` : ''}
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
      <div class="footer-line footer-bold">💬 Zalo: 0909128999</div>
      <div class="footer-line footer-bold">🌐 shophuyvan.vn</div>
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