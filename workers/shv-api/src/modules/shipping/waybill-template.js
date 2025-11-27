// workers/shv-api/src/modules/shipping/waybill-template.js
// ===================================================================
// Waybill Template - Shopee SPX Clone Style (Responsive Fix)
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

  // 1. Xử lý dữ liệu hiển thị
  const carrierName = "SPX EXPRESS";
  const trackingCode = order.tracking_code || order.carrier_code || superaiCode || 'N/A';
  
  // 2. Tính tiền thu hộ (COD)
  const isPaid = order.payment_status === 'paid';
  const codAmount = isPaid ? 0 : Number((order.subtotal || 0) + (order.shipping_fee || 0) - (order.discount || 0) - (order.shipping_discount || 0));
  const codDisplay = codAmount > 0 ? codAmount.toLocaleString('vi-VN') + ' VNĐ' : '0 VNĐ';
  
  const senderName = sender.name || store.name || 'SHOP HUY VÂN';
  const senderAddress = sender.address || store.address || '';
  const senderPhone = sender.phone || store.phone || '';
  
  const receiverName = receiver.name || customer.name || 'Khách lẻ';
  const receiverAddress = receiver.address || customer.address || '';
  const receiverPhone = receiver.phone || customer.phone || '';

  // 3. Lấy Quận/Huyện làm mã to
  const districtName = (receiverAddress.split(',').slice(-2, -1)[0] || '').trim().toUpperCase() || 'HCM';

  [cite_start]// 4. SỬA LỖI NGÀY THÁNG (NaN) [cite: 64]
  let dateStr = '';
  try {
    // Ưu tiên dùng createdDate truyền vào, hoặc order.createdAt, hoặc thời điểm hiện tại
    const rawDate = createdDate || order.createdAt || order.created_at || Date.now();
    const dateObj = new Date(Number(rawDate) || rawDate); // Chấp nhận cả timestamp số và string
    
    if (!isNaN(dateObj.getTime())) {
      const d = String(dateObj.getDate()).padStart(2, '0');
      const m = String(dateObj.getMonth() + 1).padStart(2, '0');
      const y = dateObj.getFullYear();
      const h = String(dateObj.getHours()).padStart(2, '0');
      const min = String(dateObj.getMinutes()).padStart(2, '0');
      dateStr = `${d}-${m}-${y} ${h}:${min}`;
    } else {
      dateStr = new Date().toLocaleString('vi-VN');
    }
  } catch (e) {
    dateStr = new Date().toLocaleString('vi-VN');
  }

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Vận đơn SPX - ${trackingCode}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      font-family: Arial, Helvetica, sans-serif;
      background: #ccc; /* Nền xám để dễ nhìn vùng giấy khi preview */
      padding: 20px;
    }
    .page {
      background: white;
      margin: 0 auto;
      border: 1px solid #000;
      position: relative;
      /* FIX: Dùng max-width thay vì width cứng để linh hoạt */
      width: 100%;
      max-width: 100mm; 
      min-height: 150mm;
      display: flex;
      flex-direction: column;
    }
    
    /* UTILS */
    .bold { font-weight: bold; }
    .uppercase { text-transform: uppercase; }
    
    /* HEADER SECTION */
    .header {
      display: flex;
      border-bottom: 2px solid #000;
      height: 38mm; /* Tăng nhẹ chiều cao header */
    }
    .header-qr {
      width: 38mm;
      padding: 1mm;
      border-right: 1px solid #000;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .header-qr img {
      width: 100%;
      height: auto;
      display: block;
    }
    .header-info {
      flex: 1;
      padding: 2mm 3mm;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
    }
    .spx-logo {
      font-size: 22px; [cite_start]/* [cite: 48, 49] */
      font-weight: 900;
      color: #ee4d2d;
      font-style: italic;
    }
    .tracking-label {
      font-size: 11px;
      margin-top: 2px;
    }
    .tracking-number {
      font-size: 16px; [cite_start]/* [cite: 50] */
      font-weight: bold;
      font-family: 'Courier New', monospace;
      letter-spacing: 0.5px;
      word-break: break-all;
    }
    .routing-code {
      font-size: 16px; [cite_start]/* [cite: 51] */
      font-weight: bold;
      border: 2px solid #000;
      padding: 3px 6px;
      display: inline-block;
      margin-top: 4px;
      align-self: flex-start;
    }

    /* ADDRESS SECTION */
    .address-section {
      display: flex;
      border-bottom: 2px solid #000;
      flex-grow: 1; /* Cho phép giãn nếu nội dung dài */
    }
    .sender-col {
      width: 40%;
      padding: 2mm;
      border-right: 1px solid #000;
      font-size: 11px;
      display: flex;
      flex-direction: column;
    }
    .receiver-col {
      width: 60%;
      padding: 2mm;
      font-size: 12px;
      position: relative;
      display: flex;
      flex-direction: column;
    }
    .section-title {
      font-size: 10px; [cite_start]/* [cite: 47, 55] */
      font-weight: bold;
      margin-bottom: 3px;
      text-transform: uppercase;
    }
    .dest-code-large {
      position: absolute;
      top: 2mm;
      right: 2mm;
      font-size: 24px; [cite_start]/* [cite: 57] To hơn để giống mẫu */
      font-weight: bold;
      border: 2px solid #000;
      padding: 2px 8px;
    }

    /* WARNING TEXT */
    .warning-text {
      font-size: 10px; [cite_start]/* [cite: 59] */
      padding: 1.5mm 2mm;
      border-bottom: 1px solid #000;
      font-style: italic;
      text-align: center;
    }

    /* BODY: ITEMS & INSTRUCTIONS */
    .body-section {
      display: flex;
      border-bottom: 2px solid #000;
      flex-grow: 2; /* Chiếm phần lớn diện tích còn lại */
    }
    .items-list {
      flex: 1;
      padding: 2mm;
      border-right: 1px solid #000;
      font-size: 11px;
    }
    .item-row {
      margin-bottom: 4px;
      border-bottom: 1px dashed #ddd;
      padding-bottom: 2px;
    }
    .item-name {
      font-weight: bold;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
    .instructions {
      width: 38mm; /* Cố định chiều rộng cột chỉ dẫn */
      padding: 2mm;
      font-size: 10px;
      display: flex;
      flex-direction: column;
      justify-content: flex-start;
    }
    .instruction-box {
      border: 1px solid #000;
      padding: 3px;
      margin-bottom: 3px;
      font-weight: bold;
      text-align: center;
      font-size: 10px; [cite_start]/* [cite: 66] */
    }

    /* FOOTER */
    .footer-section {
      display: flex;
      height: 35mm; /* Chiều cao cố định cho footer */
    }
    .footer-left {
      flex: 1;
      padding: 2mm;
      border-right: 1px solid #000;
      font-size: 10px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
    }
    .footer-right {
      width: 45mm;
      padding: 2mm;
      text-align: center;
      display: flex;
      flex-direction: column;
      justify-content: center;
      background: #fff;
    }
    .cod-value {
      font-size: 22px; [cite_start]/* [cite: 69] To rõ */
      font-weight: bold;
      margin-top: 5px;
    }

    /* PRINT RESET - FIX LỖI KHOẢNG TRẮNG */
    @media print {
      body { 
        margin: 0; 
        padding: 0; 
        background: white; 
      }
      .page { 
        /* QUAN TRỌNG: Full khổ giấy in */
        width: 100%; 
        max-width: none;
        height: 100%; /* Fill chiều dọc */
        border: none; 
        margin: 0; 
      }
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
        <div style="flex: 1; display: flex; flex-direction: column; justify-content: center;">
          <div class="tracking-label">Mã vận đơn:</div>
          <div class="tracking-number">${trackingCode}</div>
        </div>
        <div class="routing-code">${districtName}-HUB</div>
      </div>
    </div>

    <div class="address-section">
      <div class="sender-col">
        <div class="section-title">Từ:</div>
        <div class="bold" style="font-size: 12px; margin-bottom: 2px;">${senderName}</div>
        <div style="margin-bottom: 2px;">${senderAddress}</div>
        <div class="bold">SĐT: ${senderPhone}</div>
      </div>
      <div class="receiver-col">
        <div class="section-title">Đến:</div>
        <div class="dest-code-large">${districtName}</div>
        <div style="margin-top: 10mm;"> <div class="bold" style="font-size: 15px; margin-bottom: 3px;">${receiverName}</div>
          <div style="margin-bottom: 3px;">${receiverAddress}</div>
          <div class="bold">SĐT: ${receiverPhone}</div>
        </div>
      </div>
    </div>

    <div class="warning-text">
      *** Người gửi cam kết hàng hóa có đầy đủ hóa đơn, chứng từ theo quy định.
    </div>

    <div class="body-section">
      <div class="items-list">
        <div class="section-title">Nội dung hàng (Tổng SL: ${items.reduce((s,i)=>s+(Number(i.qty)||1),0)})</div>
        ${items.map((item, idx) => `
          <div class="item-row">
            <div class="item-name">${idx + 1}. ${item.name}</div>
            <div style="font-size: 10px; color: #333;">
               ${item.variant ? `PL: ${item.variant} | ` : ''} SL: ${item.qty || 1}
            </div>
          </div>
        `).join('')}
      </div>
      <div class="instructions">
        <div class="section-title">Chỉ dẫn giao hàng:</div>
        <div class="instruction-box">ĐỒNG KIỂM</div>
        <div class="instruction-box">CHO THỬ HÀNG</div>
        <div style="margin-top: 5px; line-height: 1.3;">
          - Chuyển hoàn sau 3 lần phát<br>
          - Lưu kho 24h dù KH từ chối<br>
          - Gọi người gửi nếu không giao được
        </div>
      </div>
    </div>

    <div class="footer-section">
      <div class="footer-left">
        <div>
          <div class="bold">Ngày tạo: ${dateStr}</div>
          <div style="margin-top: 5px;">Chữ ký người nhận:</div>
        </div>
        <div style="font-style:italic; font-size:9px;">Xác nhận hàng nguyên vẹn, không móp méo.</div>
      </div>
      <div class="footer-right">
        <div style="font-size: 11px; font-weight: bold;">Tiền thu Người nhận:</div>
        <div class="cod-value">${codDisplay}</div>
      </div>
    </div>
    
    <div style="padding: 2mm; font-size: 9px; text-align: center; border-top: 1px solid #000;">
      Tuyển NV Giao hàng/ NV Bưu cục thu nhập hấp dẫn. Hotline: 1900 6885
    </div>

  </div>
  <script>
    window.onload = function() {
      // Tự động in sau khi tải xong
      setTimeout(() => window.print(), 500);
    };
  </script>
</body>
</html>`;
}