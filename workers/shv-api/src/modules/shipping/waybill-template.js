// workers/shv-api/src/modules/shipping/waybill-template.js
// ===================================================================
// Waybill Template - Shopee SPX Style (Fix 500 Error & Date NaN)
// ===================================================================

export function getWaybillHTML(data) {
  // 1. BẢO VỆ DỮ LIỆU ĐẦU VÀO (Tránh lỗi 500 do null/undefined)
  const safeData = data || {};
  const order = safeData.order || {};
  const sender = safeData.sender || {};
  const receiver = safeData.receiver || {};
  const customer = safeData.customer || {};
  const store = safeData.store || {};
  
  // Đảm bảo items luôn là mảng để không lỗi .map/.reduce
  const items = Array.isArray(safeData.items) ? safeData.items : [];

  // 2. XỬ LÝ THÔNG TIN CƠ BẢN
  const carrierName = "SPX EXPRESS";
  const trackingCode = order.tracking_code || order.carrier_code || safeData.superaiCode || 'N/A';
  
  // Tính tiền thu hộ (COD) an toàn
  const isPaid = order.payment_status === 'paid';
  const subtotal = Number(order.subtotal || 0);
  const shipFee = Number(order.shipping_fee || 0);
  const discount = Number(order.discount || 0) + Number(order.shipping_discount || 0);
  const codAmount = isPaid ? 0 : Math.max(0, subtotal + shipFee - discount);
  const codDisplay = codAmount > 0 ? codAmount.toLocaleString('vi-VN') + ' VNĐ' : '0 VNĐ';

  const senderName = sender.name || store.name || 'SHOP HUY VÂN';
  const senderAddress = sender.address || store.address || '';
  const senderPhone = sender.phone || store.phone || '';
  
  const receiverName = receiver.name || customer.name || 'Khách lẻ';
  // Ép kiểu về chuỗi để tránh lỗi .split()
  const receiverAddress = String(receiver.address || customer.address || '');
  const receiverPhone = receiver.phone || customer.phone || '';

  // 3. XỬ LÝ MÃ VÙNG (DISTRICT) AN TOÀN
  // Nếu không tách được địa chỉ thì mặc định là HCM để không bị crash
  let districtName = 'HCM';
  try {
    if (receiverAddress.includes(',')) {
      const parts = receiverAddress.split(',');
      if (parts.length >= 2) {
        districtName = parts[parts.length - 2].trim().toUpperCase();
      }
    }
  } catch (e) {
    districtName = 'HCM';
  }

  // 4. SỬA LỖI NGÀY THÁNG (NaN-NaN-NaN) TRIỆT ĐỂ
  let dateStr = '';
  try {
    // Lấy timestamp: ưu tiên createdDate > order.createdAt > Hiện tại
    let ts = safeData.createdDate || order.createdAt || order.created_at;
    
    // Nếu không có hoặc bằng 0 -> lấy giờ hiện tại
    if (!ts) ts = Date.now();
    
    // Chuyển về đối tượng Date
    const dateObj = new Date(Number(ts) || ts);
    
    // Kiểm tra hợp lệ
    if (isNaN(dateObj.getTime())) {
      throw new Error('Invalid Date');
    }

    const d = String(dateObj.getDate()).padStart(2, '0');
    const m = String(dateObj.getMonth() + 1).padStart(2, '0');
    const y = dateObj.getFullYear();
    const h = String(dateObj.getHours()).padStart(2, '0');
    const min = String(dateObj.getMinutes()).padStart(2, '0');
    dateStr = `${d}-${m}-${y} ${h}:${min}`;
  } catch (e) {
    // Fallback cuối cùng: Lấy giờ hệ thống
    const now = new Date();
    // Chỉnh múi giờ VN thủ công nếu server sai giờ
    const d = String(now.getDate()).padStart(2, '0');
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const y = now.getFullYear();
    const h = String(now.getHours()).padStart(2, '0');
    const min = String(now.getMinutes()).padStart(2, '0');
    dateStr = `${d}-${m}-${y} ${h}:${min}`;
  }

  // 5. RENDER HTML
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Vận đơn SPX - ${trackingCode}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      font-family: Arial, Helvetica, sans-serif;
      background: #ccc; 
      padding: 20px;
    }
    .page {
      background: white;
      margin: 0 auto;
      border: 1px solid #000;
      position: relative;
      width: 100%;
      max-width: 100mm; 
      min-height: 150mm;
      display: flex;
      flex-direction: column;
    }
    
    .bold { font-weight: bold; }
    
    /* HEADER */
    .header {
      display: flex;
      border-bottom: 2px solid #000;
      height: 38mm;
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
      font-size: 22px;
      font-weight: 900;
      color: #ee4d2d;
      font-style: italic;
    }
    .tracking-label {
      font-size: 11px;
      margin-top: 2px;
    }
    .tracking-number {
      font-size: 16px;
      font-weight: bold;
      font-family: 'Courier New', monospace;
      letter-spacing: 0.5px;
      word-break: break-all;
    }
    .routing-code {
      font-size: 16px;
      font-weight: bold;
      border: 2px solid #000;
      padding: 3px 6px;
      display: inline-block;
      margin-top: 4px;
      align-self: flex-start;
    }

    /* ADDRESS */
    .address-section {
      display: flex;
      border-bottom: 2px solid #000;
      flex-grow: 1;
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
      font-size: 10px;
      font-weight: bold;
      margin-bottom: 3px;
      text-transform: uppercase;
    }
    .dest-code-large {
      position: absolute;
      top: 2mm;
      right: 2mm;
      font-size: 24px;
      font-weight: bold;
      border: 2px solid #000;
      padding: 2px 8px;
    }

    /* WARNING */
    .warning-text {
      font-size: 10px;
      padding: 1.5mm 2mm;
      border-bottom: 1px solid #000;
      font-style: italic;
      text-align: center;
    }

    /* BODY */
    .body-section {
      display: flex;
      border-bottom: 2px solid #000;
      flex-grow: 2;
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
      width: 38mm;
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
      font-size: 10px;
    }

    /* FOOTER */
    .footer-section {
      display: flex;
      height: 35mm;
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
      font-size: 22px;
      font-weight: bold;
      margin-top: 5px;
    }

    @media print {
      body { margin: 0; padding: 0; background: white; }
      .page { width: 100%; max-width: none; height: 100%; border: none; margin: 0; }
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
        <div style="margin-top: 10mm;">
          <div class="bold" style="font-size: 15px; margin-bottom: 3px;">${receiverName}</div>
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
        ${items.length > 0 ? items.map((item, idx) => `
          <div class="item-row">
            <div class="item-name">${idx + 1}. ${item.name || 'Sản phẩm'}</div>
            <div style="font-size: 10px; color: #333;">
               ${item.variant ? `PL: ${item.variant} | ` : ''} SL: ${item.qty || 1}
            </div>
          </div>
        `).join('') : '<div style="font-style:italic">Không có thông tin sản phẩm</div>'}
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
      setTimeout(() => window.print(), 500);
    };
  </script>
</body>
</html>`;
}