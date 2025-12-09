// workers/shv-api/src/modules/shipping/waybill-template.js
// ===================================================================
// Waybill Template - Shopee SPX Style (A5 FULL - FIXED QR CODE)
// ===================================================================

export function getWaybillHTML(data) {
  // 1. BẢO VỆ DỮ LIỆU
  const safeData = data || {};
  const order = safeData.order || {};
  const sender = safeData.sender || {};
  const receiver = safeData.receiver || {};
  const customer = safeData.customer || {};
  const store = safeData.store || {};
  const items = Array.isArray(safeData.items) ? safeData.items : [];

  // 2. XỬ LÝ TEXT
  const trackingCode = order.tracking_code || order.carrier_code || safeData.superaiCode || 'N/A';
  
  // COD
  const isPaid = order.payment_status === 'paid';
  // ✅ LOGIC CHUẨN: Lấy Revenue từ Core (180k) + Ship nếu khách trả (nhưng Revenue đã xử lý trừ ship rồi)
  // Đơn giản nhất: Lấy TOTAL (Tổng khách phải trả) làm COD.
  // Vì ở Core: Total = Revenue + Ship.
  // - Đơn nhỏ: Revenue(120) + Ship(18) = Total(138).
  // - Đơn to: Revenue(180) + Ship(15) = Total(195).
  // => Lấy Total là chuẩn nhất cho COD.
  const codAmount = (order.payment_status === 'paid' || order.payment_method !== 'cod') ? 0 : Number(order.total || 0);
  const codDisplay = codAmount > 0 ? codAmount.toLocaleString('vi-VN') + ' VNĐ' : '0 VNĐ';

  const senderName = sender.name || store.name || 'SHOP HUY VÂN';
  const senderAddress = sender.address || store.address || '';
  const senderPhone = sender.phone || store.phone || '';
  
  const receiverName = receiver.name || customer.name || 'Khách lẻ';
  const receiverAddress = String(receiver.address || customer.address || '');
  const receiverPhone = receiver.phone || customer.phone || '';

  let districtName = 'HCM';
  try {
    if (receiverAddress.includes(',')) {
      const parts = receiverAddress.split(',');
      if (parts.length >= 2) districtName = parts[parts.length - 2].trim().toUpperCase();
    }
  } catch (e) {}

  let dateStr = '';
  try {
    let ts = safeData.createdDate || order.createdAt || order.created_at || Date.now();
    const dateObj = new Date(Number(ts) || ts);
    if (isNaN(dateObj.getTime())) throw new Error();
    const d = String(dateObj.getDate()).padStart(2, '0');
    const m = String(dateObj.getMonth() + 1).padStart(2, '0');
    const y = dateObj.getFullYear();
    const h = String(dateObj.getHours()).padStart(2, '0');
    const min = String(dateObj.getMinutes()).padStart(2, '0');
    dateStr = `${d}-${m}-${y} ${h}:${min}`;
  } catch (e) { dateStr = new Date().toLocaleString('vi-VN'); }

  // 3. HTML FULL SIZE A5
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>In Vận Đơn - ${trackingCode}</title>
  <style>
    /* RESET MẶC ĐỊNH */
    * { margin: 0; padding: 0; box-sizing: border-box; }
    
    /* CẤU HÌNH TRANG IN */
    @page {
      size: A5 portrait; /* Cố định khổ A5 dọc */
      margin: 0;
    }

    body { 
      font-family: Arial, Helvetica, sans-serif;
      background: #fff;
      width: 148mm; 
      height: 208mm; /* Giảm 1mm để tránh nhảy trang */
      overflow: hidden; /* Cắt bỏ phần dư thừa */
      margin: 0 auto; /* Canh giữa nếu in trên A4 */
    }
    
    .page {
      width: 100%;
      height: 100%;
      border: 3px solid #000; 
      display: flex;
      flex-direction: column;
      position: relative;
    }
    
    .bold { font-weight: bold; }
    
    /* HEADER */
    .header {
      display: flex;
      border-bottom: 3px solid #000;
      height: 55mm;
    }
    .header-qr {
      width: 55mm;
      padding: 1mm;
      border-right: 2px solid #000;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    /* Đảm bảo ảnh QR luôn hiển thị */
    .header-qr img { 
      width: 100%; 
      height: auto; 
      display: block; 
      max-height: 53mm;
    }
    
    .header-info {
      flex: 1;
      padding: 3mm 4mm;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
    }
    .spx-logo {
      font-size: 30px;
      font-weight: 900;
      color: #ee4d2d;
      font-style: italic;
    }
    .tracking-label { font-size: 13px; margin-top: 5px; }
    .tracking-number {
      font-size: 24px;
      font-weight: bold;
      font-family: 'Courier New', monospace;
      letter-spacing: 0.5px;
      line-height: 1.1;
      word-break: break-all;
    }
    .routing-code {
      font-size: 20px;
      font-weight: bold;
      border: 3px solid #000;
      padding: 4px 10px;
      display: inline-block;
      margin-top: 5px;
      align-self: flex-start;
    }

    /* ADDRESS */
    .address-section {
      display: flex;
      border-bottom: 3px solid #000;
      flex-grow: 1; 
    }
    .sender-col {
      width: 38%;
      padding: 3mm;
      border-right: 2px solid #000;
      font-size: 13px;
      display: flex;
      flex-direction: column;
    }
    .receiver-col {
      width: 62%;
      padding: 3mm;
      font-size: 14px;
      position: relative;
      display: flex;
      flex-direction: column;
    }
    .section-title {
      font-size: 11px;
      font-weight: bold;
      margin-bottom: 4px;
      text-transform: uppercase;
      text-decoration: underline;
    }
    .dest-code-large {
      position: absolute;
      top: 3mm;
      right: 3mm;
      font-size: 34px;
      font-weight: bold;
      border: 3px solid #000;
      padding: 2px 10px;
    }

    /* WARNING */
    .warning-text {
      font-size: 11px;
      padding: 2mm;
      border-bottom: 2px solid #000;
      font-style: italic;
      text-align: center;
    }

    /* BODY ITEMS */
    .body-section {
      display: flex;
      border-bottom: 3px solid #000;
      flex-grow: 2; 
      min-height: 60mm;
    }
    .items-list {
      flex: 1;
      padding: 3mm;
      border-right: 2px solid #000;
      font-size: 13px;
    }
    .item-row {
      margin-bottom: 6px;
      border-bottom: 1px dashed #999;
      padding-bottom: 3px;
    }
    .item-name {
      font-weight: bold;
      font-size: 14px;
      line-height: 1.2;
    }
    .instructions {
      width: 45mm;
      padding: 3mm;
      font-size: 11px;
      display: flex;
      flex-direction: column;
    }
    .instruction-box {
      border: 2px solid #000;
      padding: 5px;
      margin-bottom: 5px;
      font-weight: bold;
      text-align: center;
      font-size: 12px;
    }

    /* FOOTER */
    .footer-section {
      display: flex;
      height: 45mm;
      border-bottom: 2px solid #000;
    }
    .footer-left {
      flex: 1;
      padding: 3mm;
      border-right: 2px solid #000;
      font-size: 12px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
    }
    .footer-right {
      width: 55mm;
      padding: 3mm;
      text-align: center;
      display: flex;
      flex-direction: column;
      justify-content: center;
      background: #fff;
    }
    .cod-value {
      font-size: 34px;
      font-weight: 900;
      margin-top: 8px;
    }

    /* BOTTOM TEXT */
    .bottom-line {
      padding: 2mm;
      font-size: 10px;
      text-align: center;
      font-weight: bold;
    }

    @media print {
      body { width: 148mm; height: 209mm; }
      .page { border: 3px solid #000 !important; margin: 0; }
    }
  </style>
</head>
<body>
  <div class="page">
    
    <div class="header">
      <div class="header-qr">
        <img src="https://quickchart.io/qr?text=${encodeURIComponent(trackingCode)}&size=300&ecLevel=M&margin=1" alt="QR" loading="eager">
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
        <div class="bold" style="font-size: 14px; margin-bottom: 3px;">${senderName}</div>
        <div style="margin-bottom: 3px; line-height: 1.2;">${senderAddress}</div>
        <div class="bold">SĐT: ${senderPhone}</div>
      </div>
      <div class="receiver-col">
        <div class="section-title">Đến:</div>
        <div class="dest-code-large">${districtName}</div>
        <div style="margin-top: 12mm;">
          <div class="bold" style="font-size: 18px; margin-bottom: 5px;">${receiverName}</div>
          <div style="margin-bottom: 4px; line-height: 1.3;">${receiverAddress}</div>
          <div class="bold" style="font-size: 16px;">SĐT: ${receiverPhone}</div>
        </div>
      </div>
    </div>
	
    <div class="body-section">
      <div class="items-list">
        <div class="section-title">Nội dung hàng (Tổng SL: ${items.reduce((s,i)=>s+(Number(i.qty)||1),0)})</div>
        ${items.length > 0 ? items.map((item, idx) => `
          <div class="item-row">
            <div class="item-name">${idx + 1}. ${item.name || 'Sản phẩm'}</div>
            <div style="font-size: 12px; color: #333; margin-top: 2px;">
               ${item.variant ? `PL: ${item.variant} | ` : ''} 
               <strong>SL: ${item.qty || 1}</strong>
            </div>
          </div>
        `).join('') : '<div style="font-style:italic">Không có thông tin sản phẩm</div>'}
      </div>
      <div class="instructions">
        <div class="section-title">Chỉ dẫn:</div>
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
          <div style="margin-top: 10px;">Chữ ký người nhận:</div>
        </div>
        <div style="font-style:italic; font-size:11px;">Xác nhận hàng nguyên vẹn, không móp méo.</div>
      </div>
      <div class="footer-right">
        <div style="font-size: 13px; font-weight: bold;">Tiền thu Người nhận:</div>
        <div class="cod-value">${codDisplay}</div>
      </div>
    </div>
  </div>
  <script>
    window.onload = function() {
      // Tăng thời gian chờ lên 1.5 giây để ảnh QR tải xong
      setTimeout(() => window.print(), 1500);
    };
  </script>
</body>
</html>`;
}