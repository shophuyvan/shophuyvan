// workers/shv-api/src/modules/shipping/waybill-template.js
// ===================================================================
// Waybill HTML Template (SPX Format)
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

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Vận đơn</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      font-family: 'Arial', sans-serif; 
      background: #fff; 
      padding: 0;
      margin: 0;
    }
    .page { 
      width: 148mm; 
      height: 210mm; 
      background: white; 
      padding: 12px;
      position: relative;
      overflow: hidden;
    }
    
    /* HEADER - Logo + Mã vận đơn */
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 10px;
      padding-bottom: 8px;
      border-bottom: 3px solid #ff6b35;
    }
    .logo { 
      width: 50px; 
      height: 50px; 
    }
    .logo img { 
      width: 100%; 
      height: 100%; 
      object-fit: contain; 
    }
    .header-code {
      flex: 1;
      text-align: center;
      margin: 0 15px;
    }
    .header-code .main-code {
      font-size: 20px;
      font-weight: bold;
      letter-spacing: 1px;
      color: #000;
    }
    .header-code .sub-text {
      font-size: 11px;
      color: #666;
      margin-top: 2px;
    }
    .header-date {
      text-align: right;
      font-size: 12px;
    }
    .header-date .time {
      font-weight: bold;
    }
    
    /* BARCODE */
    .barcode-section {
      text-align: center;
      margin-bottom: 8px;
      padding: 6px;
      border: 1px solid #ddd;
    }
    .barcode-img {
      height: 40px;
      margin-bottom: 4px;
    }
    .barcode-text {
      font-size: 13px;
      font-weight: bold;
      letter-spacing: 1px;
    }
    
    /* SENDER/RECEIVER - 2 COLUMN */
    .info-section {
      display: flex;
      gap: 8px;
      margin-bottom: 8px;
    }
    .info-box {
      flex: 1;
      border: 2px solid #333;
      padding: 8px;
      background: #f9f9f9;
    }
    .info-box .label {
      font-size: 12px;
      font-weight: bold;
      background: #ff6b35;
      color: white;
      padding: 3px 5px;
      margin-bottom: 6px;
      display: block;
    }
    .info-box .name {
      font-size: 13px;
      font-weight: bold;
      margin-bottom: 4px;
    }
    .info-box .address {
      font-size: 12px;
      line-height: 1.3;
      margin-bottom: 3px;
      word-wrap: break-word;
    }
    .info-box .phone {
      font-size: 12px;
      font-weight: bold;
      color: #ff6b35;
    }
    
    /* PRODUCT TABLE */
    .items-section {
      margin-bottom: 8px;
      border: 2px solid #333;
    }
    .items-header {
      background: #ff6b35;
      color: white;
      padding: 6px 8px;
      font-size: 12px;
      font-weight: bold;
    }
    .items-table {
      width: 100%;
      font-size: 12px;
      border-collapse: collapse;
    }
    .items-table th {
      background: #f0f0f0;
      padding: 6px 4px;
      font-weight: bold;
      text-align: left;
      border-bottom: 1px solid #ddd;
      font-size: 11px;
    }
    .items-table td {
      padding: 6px 4px;
      border-bottom: 1px solid #ddd;
    }
    .items-table .qty {
      text-align: center;
      font-weight: bold;
    }
    .items-table .price {
      text-align: right;
    }
    
    /* PAYMENT BOX - NỘI BẬT */
    .payment-section {
      background: #fff3cd;
      border: 3px solid #ff6b35;
      padding: 10px;
      margin-bottom: 8px;
      text-align: center;
      border-radius: 4px;
    }
    .payment-title {
      font-size: 13px;
      font-weight: bold;
      color: #000;
      margin-bottom: 6px;
    }
    .payment-amount {
      font-size: 24px;
      font-weight: bold;
      color: #ff6b35;
      letter-spacing: 1px;
      margin-bottom: 4px;
    }
    .payment-note {
      font-size: 11px;
      color: #666;
    }
    
    /* QR CODE */
    .qr-section {
      display: flex;
      gap: 8px;
      margin-bottom: 8px;
    }
    .qr-box {
      flex: 1;
      border: 2px solid #333;
      padding: 6px;
      text-align: center;
    }
    .qr-box img {
      width: 100%;
      max-width: 100px;
      height: auto;
    }
    .qr-label {
      font-size: 11px;
      font-weight: bold;
      margin-top: 4px;
    }
    
    /* FOOTER */
    .footer {
      text-align: center;
      border-top: 1px solid #ddd;
      padding-top: 6px;
      font-size: 11px;
    }
    .footer-note {
      color: #666;
      margin-bottom: 2px;
    }
    .hotline {
      font-weight: bold;
      color: #ff6b35;
      font-size: 12px;
    }
    
    @media print {
      body { margin: 0; padding: 0; background: white; }
      .page { width: 100%; height: 100%; margin: 0; padding: 12px; page-break-after: avoid; }
    }
  </style>
</head>
<body>
  <div class="page">
    <!-- HEADER -->
    <div class="header">
      <div class="logo">
        <img src="${logo}" alt="Logo" onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22%3E%3Crect fill=%22%23f0f0f0%22 width=%22100%22 height=%22100%22/%3E%3Ctext x=%2250%22 y=%2250%22 font-size=%2216%22 fill=%22%23999%22 text-anchor=%22middle%22 dominant-baseline=%22middle%22%3ELogo%3C/text%3E%3C/svg%3E'">
      </div>
      <div class="header-code">
        <div class="main-code">${superaiCode}</div>
        <div class="sub-text">Mã vận đơn</div>
      </div>
      <div class="header-date">
        <div class="time">${createdDate.split(' ')[0]}</div>
        <div style="font-size:11px">${createdDate.split(' ')[1] || ''}</div>
      </div>
    </div>

    <!-- BARCODE -->
    <div class="barcode-section">
      <img src="${barcodeSrc}" alt="Barcode" class="barcode-img" onerror="this.style.display='none'">
      <div class="barcode-text">${superaiCode}</div>
    </div>

    <!-- SENDER / RECEIVER -->
    <div class="info-section">
      <div class="info-box">
        <span class="label">👤 NGƯỜI GỬI</span>
        <div class="name">${sender.name || store.name || 'Shop'}</div>
        <div class="address">${sender.address || store.address || ''}</div>
        <div class="phone">☎️ ${sender.phone || store.phone || ''}</div>
      </div>
      <div class="info-box">
        <span class="label">📦 NGƯỜI NHẬN</span>
        <div class="name">${receiver.name || customer.name || 'Khách'}</div>
        <div class="address">${receiver.address || customer.address || ''}</div>
        <div class="phone">☎️ ${receiver.phone || customer.phone || ''}</div>
      </div>
    </div>

    <!-- PRODUCTS -->
    <div class="items-section">
      <div class="items-header">📦 NỘI DUNG HÀNG (${items.length} sản phẩm)</div>
      <table class="items-table">
        <thead>
          <tr>
            <th style="width:50%">Sản phẩm</th>
            <th style="width:15%; text-align:center">SL</th>
            <th style="width:35%; text-align:right">Giá</th>
          </tr>
        </thead>
        <tbody>
          ${items.map((item, idx) => `
            <tr>
              <td>
                <strong>${item.name || 'SP'}</strong>
                ${item.variant ? `<div style="font-size:11px; color:#666">${item.variant}</div>` : ''}
              </td>
              <td class="qty">${item.qty || 1}</td>
              <td class="price">${Number(item.price || 0).toLocaleString('vi-VN')} đ</td>
            </tr>
          `).join('') || '<tr><td colspan="3" style="text-align:center; color:#999; padding:8px">Không có sản phẩm</td></tr>'}
        </tbody>
      </table>
    </div>

    <!-- PAYMENT BOX -->
    <div class="payment-section">
      <div class="payment-title">💰 TỔNG TIỀN THU TỪ NGƯỜI NHẬN</div>
      <div class="payment-amount">${Number((order.subtotal || 0) + (order.shipping_fee || 0)).toLocaleString('vi-VN')} đ</div>
      <div class="payment-note">${order.cod ? '(Thu hộ - COD)' : '(Thanh toán)'}</div>
    </div>

    <!-- QR CODE -->
    <div class="qr-section">
      <div class="qr-box">
        <img src="https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(order.tracking_code || superaiCode)}" alt="QR Code">
        <div class="qr-label">Mã tracking</div>
      </div>
    </div>

    <!-- FOOTER -->
    <div class="footer">
      <div class="footer-note">Vui lòng kiểm tra lại thông tin trước khi gửi</div>
      <div class="hotline">Hotline: 0909128999 - 0933190000</div>
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