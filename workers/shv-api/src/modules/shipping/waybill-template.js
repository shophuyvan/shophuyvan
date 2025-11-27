// workers/shv-api/src/modules/shipping/waybill-template.js
// ===================================================================
// Waybill Template - Shopee SPX Clone Style
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

  // Xử lý dữ liệu hiển thị
  const carrierName = "SPX EXPRESS"; // Cố định theo style Shopee
  const trackingCode = order.tracking_code || order.carrier_code || superaiCode || 'N/A';
  
  // Tính tiền thu hộ (COD)
  // Nếu đã thanh toán (payment_status = paid) -> COD = 0
  const isPaid = order.payment_status === 'paid';
  const codAmount = isPaid ? 0 : Number((order.subtotal || 0) + (order.shipping_fee || 0) - (order.discount || 0) - (order.shipping_discount || 0));
  const codDisplay = codAmount > 0 ? codAmount.toLocaleString('vi-VN') + ' VNĐ' : '0 VNĐ';
  
  const senderName = sender.name || store.name || 'SHOP HUY VÂN';
  const senderAddress = sender.address || store.address || '';
  const senderPhone = sender.phone || store.phone || '';
  
  const receiverName = receiver.name || customer.name || 'Khách lẻ';
  const receiverAddress = receiver.address || customer.address || '';
  const receiverPhone = receiver.phone || customer.phone || '';

  // Lấy Quận/Huyện để làm mã to (Giả lập Routing Code của SPX)
  const districtName = (receiverAddress.split(',').slice(-2, -1)[0] || '').trim().toUpperCase() || 'HCM';

  // Ngày tạo đơn
  const dateObj = createdDate ? new Date(createdDate) : new Date();
  const dateStr = `${dateObj.getDate()}-${dateObj.getMonth() + 1}-${dateObj.getFullYear()} ${dateObj.getHours()}:${dateObj.getMinutes()}`;

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Vận đơn SPX - ${trackingCode}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      font-family: Arial, Helvetica, sans-serif;
      background: #eee;
      padding: 20px;
    }
    .page {
      width: 100mm;
      min-height: 150mm;
      background: white;
      margin: 0 auto;
      border: 1px solid #000;
      position: relative;
    }
    
    /* UTILS */
    .bold { font-weight: bold; }
    .uppercase { text-transform: uppercase; }
    .text-center { text-align: center; }
    .text-right { text-align: right; }
    .flex { display: flex; }
    
    /* HEADER SECTION: QR + LOGO + TRACKING */
    .header {
      display: flex;
      border-bottom: 2px solid #000;
      height: 35mm;
    }
    .header-qr {
      width: 35mm;
      padding: 2mm;
      border-right: 1px solid #000;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .header-qr img {
      width: 100%;
      height: auto;
    }
    .header-info {
      flex: 1;
      padding: 2mm;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
    }
    .spx-logo {
      font-size: 24px;
      font-weight: 900;
      color: #ee4d2d; /* Shopee Orange */
      font-style: italic;
    }
    .tracking-label {
      font-size: 10px;
      margin-top: 2px;
    }
    .tracking-number {
      font-size: 18px;
      font-weight: bold;
      font-family: 'Courier New', monospace;
      letter-spacing: 1px;
    }
    /* Routing code giả lập (HCB...) */
    .routing-code {
      font-size: 14px;
      font-weight: bold;
      border: 2px solid #000;
      padding: 2px 5px;
      display: inline-block;
      margin-top: 3px;
    }

    /* ADDRESS SECTION */
    .address-section {
      display: flex;
      border-bottom: 2px solid #000;
    }
    .sender-col {
      width: 40%;
      padding: 2mm;
      border-right: 1px solid #000;
      font-size: 11px;
    }
    .receiver-col {
      width: 60%;
      padding: 2mm;
      font-size: 12px;
      position: relative;
    }
    .section-title {
      font-size: 10px;
      font-weight: bold;
      margin-bottom: 2px;
      text-transform: uppercase;
    }
    /* Big Destination Code (Giống QGV-P15...) */
    .dest-code-large {
      position: absolute;
      top: 2mm;
      right: 2mm;
      font-size: 20px;
      font-weight: bold;
      border: 2px solid #000;
      padding: 2px 5px;
    }

    /* WARNING TEXT */
    .warning-text {
      font-size: 9px;
      padding: 1mm 2mm;
      border-bottom: 1px solid #000;
      font-style: italic;
    }

    /* CONTENT & INSTRUCTIONS */
    .body-section {
      display: flex;
      border-bottom: 2px solid #000;
      min-height: 40mm;
    }
    .items-list {
      flex: 1;
      padding: 2mm;
      border-right: 1px solid #000;
      font-size: 11px;
    }
    .item-row {
      margin-bottom: 3px;
      border-bottom: 1px dashed #ccc;
      padding-bottom: 2px;
    }
    .instructions {
      width: 35mm;
      padding: 2mm;
      font-size: 10px;
      display: flex;
      flex-direction: column;
    }
    .instruction-box {
      border: 1px solid #000;
      padding: 2px;
      margin-bottom: 2px;
      font-weight: bold;
      text-align: center;
    }

    /* FOOTER / COD */
    .footer-section {
      display: flex;
    }
    .footer-left {
      flex: 1;
      padding: 2mm;
      border-right: 1px solid #000;
      font-size: 10px;
    }
    .footer-right {
      width: 40mm;
      padding: 2mm;
      text-align: center;
      display: flex;
      flex-direction: column;
      justify-content: center;
    }
    .cod-label {
      font-size: 11px;
      font-weight: bold;
      margin-bottom: 2mm;
    }
    .cod-value {
      font-size: 20px;
      font-weight: bold;
    }

    /* PRINT RESET */
    @media print {
      body { margin: 0; padding: 0; background: white; }
      .page { width: 100mm; height: 150mm; border: none; margin: 0; }
    }
  </style>
</head>
<body>
  <div class="page">
    
    <div class="header">
      <div class="header-qr">
        <img src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(trackingCode)}" alt="QR">
      </div>
      <div class="header-info">
        <div class="spx-logo">SPX EXPRESS</div>
        <div>
          <div class="tracking-label">Mã vận đơn:</div>
          <div class="tracking-number">${trackingCode}</div>
        </div>
        <div class="routing-code">${districtName}-HUB</div>
      </div>
    </div>

    <div class="address-section">
      <div class="sender-col">
        <div class="section-title">Từ:</div>
        <div class="bold">${senderName}</div>
        <div>${senderAddress}</div>
        <div class="bold">SĐT: ${senderPhone}</div>
      </div>
      <div class="receiver-col">
        <div class="section-title">Đến:</div>
        <div class="dest-code-large">${districtName}</div>
        <div style="margin-top: 10mm;">
          <div class="bold" style="font-size: 14px;">${receiverName}</div>
          <div>${receiverAddress}</div>
          <div class="bold">SĐT: ${receiverPhone}</div>
        </div>
      </div>
    </div>

    <div class="warning-text">
      *** Người gửi cam kết hàng hóa có đầy đủ hóa đơn, chứng từ theo quy định.
    </div>

    <div class="body-section">
      <div class="items-list">
        <div class="section-title">Nội dung hàng (Tổng SL: ${items.reduce((s,i)=>s+(i.qty||1),0)})</div>
        ${items.map((item, idx) => `
          <div class="item-row">
            <span class="bold">${idx + 1}. ${item.name}</span>
            <br>
            <span>${item.variant ? item.variant + ' | ' : ''}SL: ${item.qty || 1}</span>
          </div>
        `).join('')}
      </div>
      <div class="instructions">
        <div class="section-title">Chỉ dẫn giao hàng:</div>
        <div class="instruction-box">ĐỒNG KIỂM</div>
        <div class="instruction-box">CHO THỬ HÀNG</div>
        <div>
          - Chuyển hoàn sau 3 lần phát<br>
          - Lưu kho 24h dù KH từ chối<br>
          - Gọi người gửi nếu không giao được
        </div>
      </div>
    </div>

    <div class="footer-section">
      <div class="footer-left">
        <div class="bold">Ngày tạo: ${dateStr}</div>
        <div style="margin-top: 5px;">Chữ ký người nhận:</div>
        <div style="height: 15mm;"></div>
        <div style="font-style:italic; font-size:9px;">Xác nhận hàng nguyên vẹn, không móp méo.</div>
      </div>
      <div class="footer-right">
        <div class="cod-label">Tiền thu Người nhận:</div>
        <div class="cod-value">${codDisplay}</div>
      </div>
    </div>
    
    <div style="padding: 2mm; font-size: 9px; text-align: center; border-top: 1px solid #000;">
      Tuyển NV Giao hàng/ NV Bưu cục thu nhập hấp dẫn. Hotline: 1900 6885
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