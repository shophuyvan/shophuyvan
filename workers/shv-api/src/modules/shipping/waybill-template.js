// workers/shv-api/src/modules/shipping/waybill-template.js
// ===================================================================
// Waybill HTML Template (SPX Format) - UPDATED: Larger Font + Single Row Layout
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
      padding: 10px;
      position: relative;
      overflow: hidden;
    }
    
    /* HEADER - Logo + Mã vận đơn */
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
      padding-bottom: 6px;
      border-bottom: 3px solid #ff6b35;
    }
    .logo { 
      width: 45px; 
      height: 45px; 
    }
    .logo img { 
      width: 100%; 
      height: 100%; 
      object-fit: contain; 
    }
    .header-code {
      flex: 1;
      text-align: center;
      margin: 0 12px;
    }
    .header-code .main-code {
      font-size: 22px;
      font-weight: bold;
      letter-spacing: 1px;
      color: #000;
    }
    .header-code .sub-text {
      font-size: 12px;
      color: #666;
      margin-top: 1px;
    }
    .header-date {
      text-align: right;
      font-size: 13px;
    }
    .header-date .time {
      font-weight: bold;
    }
    
    /* BARCODE */
    .barcode-section {
      text-align: center;
      margin-bottom: 6px;
      padding: 4px;
      border: 1px solid #ddd;
    }
    .barcode-img {
      height: 35px;
      margin-bottom: 2px;
    }
    .barcode-text {
      font-size: 21px;
      font-weight: bold;
      letter-spacing: 1px;
    }
    
    /* SENDER - SINGLE ROW */
    .sender-section {
      border: 2px solid #333;
      padding: 6px;
      background: #f9f9f9;
      margin-bottom: 6px;
    }
    .sender-label {
      font-size: 13px;
      font-weight: bold;
      background: #ff6b35;
      color: white;
      padding: 2px 4px;
      margin-bottom: 4px;
      display: inline-block;
    }
    .sender-content {
      display: flex;
      gap: 15px;
    }
    .sender-name {
      font-size: 16px;
      font-weight: bold;
      min-width: 120px;
    }
    .sender-address {
      font-size: 15px;
      line-height: 1.2;
      flex: 1;
    }
    .sender-phone {
      font-size: 15px;
      font-weight: bold;
      color: #ff6b35;
      min-width: 100px;
    }
    
    /* RECEIVER - SINGLE ROW */
    .receiver-section {
      border: 2px solid #333;
      padding: 6px;
      background: #f9f9f9;
      margin-bottom: 6px;
    }
    .receiver-label {
      font-size: 13px;
      font-weight: bold;
      background: #ff6b35;
      color: white;
      padding: 2px 4px;
      margin-bottom: 4px;
      display: inline-block;
    }
    .receiver-content {
      display: flex;
      gap: 15px;
    }
    .receiver-name {
      font-size: 16px;
      font-weight: bold;
      min-width: 120px;
    }
    .receiver-address {
      font-size: 15px;
      line-height: 1.2;
      flex: 1;
    }
    .receiver-phone {
      font-size: 15px;
      font-weight: bold;
      color: #ff6b35;
      min-width: 100px;
    }
    
    /* PRODUCT TABLE */
    .items-section {
      margin-bottom: 6px;
      border: 2px solid #333;
    }
    .items-header {
      background: #ff6b35;
      color: white;
      padding: 5px 6px;
      font-size: 13px;
      font-weight: bold;
    }
    .items-table {
      width: 100%;
      font-size: 15px;
      border-collapse: collapse;
    }
    .items-table th {
      background: #f0f0f0;
      padding: 5px 4px;
      font-weight: bold;
      text-align: left;
      border-bottom: 1px solid #ddd;
      font-size: 13px;
    }
    .items-table td {
      padding: 5px 4px;
      border-bottom: 1px solid #ddd;
    }
    .items-table .qty {
      text-align: center;
      font-weight: bold;
      font-size: 15px;
    }
    .items-table .price {
      text-align: right;
      font-size: 15px;
    }
    
    /* PAYMENT BOX - NỘI BẬT */
    .payment-section {
      background: #fff3cd;
      border: 3px solid #ff6b35;
      padding: 8px;
      margin-bottom: 6px;
      text-align: center;
      border-radius: 4px;
    }
    .payment-title {
      font-size: 14px;
      font-weight: bold;
      color: #000;
      margin-bottom: 4px;
    }
    .payment-amount {
      font-size: 26px;
      font-weight: bold;
      color: #ff6b35;
      letter-spacing: 1px;
      margin-bottom: 2px;
    }
    .payment-note {
      font-size: 12px;
      color: #666;
    }
    
    /* QR CODE - TO HƠN */
    .qr-section {
      display: flex;
      justify-content: center;
      margin-bottom: 6px;
    }
    .qr-box {
      border: 2px solid #333;
      padding: 8px;
      text-align: center;
    }
    .qr-box img {
      width: 140px;
      height: 140px;
    }
    .qr-label {
      font-size: 13px;
      font-weight: bold;
      margin-top: 4px;
    }
    
    /* FOOTER */
    .footer {
      text-align: center;
      border-top: 1px solid #ddd;
      padding-top: 4px;
      font-size: 12px;
    }
    .footer-note {
      color: #666;
      margin-bottom: 1px;
      font-size: 12px;
    }
    .hotline {
      font-weight: bold;
      color: #ff6b35;
      font-size: 13px;
    }
    
    @media print {
      body { margin: 0; padding: 0; background: white; }
      .page { width: 100%; height: 100%; margin: 0; padding: 10px; page-break-after: avoid; }
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
        <div style="font-size:12px">${createdDate.split(' ')[1] || ''}</div>
      </div>
    </div>

    <!-- BARCODE -->
    <div class="barcode-section">
      <img src="${barcodeSrc}" alt="Barcode" class="barcode-img" onerror="this.style.display='none'">
      <div class="barcode-text">${superaiCode}</div>
    </div>

    <!-- SENDER - SINGLE ROW -->
    <div class="sender-section">
      <span class="sender-label">👤 NGƯỜI GỬI</span>
      <div class="sender-content">
        <div class="sender-name">${sender.name || store.name || 'Shop'}</div>
        <div class="sender-address">${sender.address || store.address || ''}</div>
        <div class="sender-phone">☎️ ${sender.phone || store.phone || ''}</div>
      </div>
    </div>

    <!-- RECEIVER - SINGLE ROW -->
    <div class="receiver-section">
      <span class="receiver-label">📦 NGƯỜI NHẬN</span>
      <div class="receiver-content">
        <div class="receiver-name">${receiver.name || customer.name || 'Khách'}</div>
        <div class="receiver-address">${receiver.address || customer.address || ''}</div>
        <div class="receiver-phone">☎️ ${receiver.phone || customer.phone || ''}</div>
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
                ${item.variant ? `<div style="font-size:12px; color:#666">${item.variant}</div>` : ''}
              </td>
              <td class="qty">${item.qty || 1}</td>
              <td class="price">${Number(item.price || 0).toLocaleString('vi-VN')} đ</td>
            </tr>
          `).join('') || '<tr><td colspan="3" style="text-align:center; color:#999; padding:6px">Không có sản phẩm</td></tr>'}
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
        <img src="https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${encodeURIComponent(order.tracking_code || superaiCode)}" alt="QR Code">
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