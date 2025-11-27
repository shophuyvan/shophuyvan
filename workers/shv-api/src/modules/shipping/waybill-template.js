// workers/shv-api/src/modules/shipping/waybill-template.js
// ===================================================================
// Waybill Template - Shopee SPX Style (A5 SIZE - BIG & BOLD)
// ===================================================================

export function getWaybillHTML(data) {
  // 1. BẢO VỆ DỮ LIỆU ĐẦU VÀO
  const safeData = data || {};
  const order = safeData.order || {};
  const sender = safeData.sender || {};
  const receiver = safeData.receiver || {};
  const customer = safeData.customer || {};
  const store = safeData.store || {};
  
  const items = Array.isArray(safeData.items) ? safeData.items : [];

  // 2. XỬ LÝ THÔNG TIN
  const trackingCode = order.tracking_code || order.carrier_code || safeData.superaiCode || 'N/A';
  
  // Tính COD
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
  const receiverAddress = String(receiver.address || customer.address || '');
  const receiverPhone = receiver.phone || customer.phone || '';

  // Xử lý District Code
  let districtName = 'HCM';
  try {
    if (receiverAddress.includes(',')) {
      const parts = receiverAddress.split(',');
      if (parts.length >= 2) {
        districtName = parts[parts.length - 2].trim().toUpperCase();
      }
    }
  } catch (e) { districtName = 'HCM'; }

  // Xử lý Ngày tháng
  let dateStr = '';
  try {
    let ts = safeData.createdDate || order.createdAt || order.created_at || Date.now();
    const dateObj = new Date(Number(ts) || ts);
    if (isNaN(dateObj.getTime())) throw new Error('Invalid Date');

    const d = String(dateObj.getDate()).padStart(2, '0');
    const m = String(dateObj.getMonth() + 1).padStart(2, '0');
    const y = dateObj.getFullYear();
    const h = String(dateObj.getHours()).padStart(2, '0');
    const min = String(dateObj.getMinutes()).padStart(2, '0');
    dateStr = `${d}-${m}-${y} ${h}:${min}`;
  } catch (e) {
    dateStr = new Date().toLocaleString('vi-VN');
  }

  // 3. HTML & CSS (A5 SIZE OPTIMIZED)
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Vận đơn A5 - ${trackingCode}</title>
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
      /* KÍCH THƯỚC CHUẨN A5 */
      width: 148mm;
      min-height: 210mm;
      /* VIỀN ĐẬM CỐ ĐỊNH */
      border: 3px solid #000;
      display: flex;
      flex-direction: column;
      position: relative;
    }
    
    .bold { font-weight: bold; }
    
    /* HEADER: Tăng kích thước header */
    .header {
      display: flex;
      border-bottom: 3px solid #000;
      height: 55mm; /* Cao hơn để chứa QR to */
    }
    .header-qr {
      width: 55mm; /* QR to hơn */
      padding: 2mm;
      border-right: 2px solid #000;
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
      padding: 4mm;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
    }
    .spx-logo {
      font-size: 32px; /* Logo to */
      font-weight: 900;
      color: #ee4d2d;
      font-style: italic;
    }
    .tracking-label {
      font-size: 14px;
      margin-top: 5px;
    }
    .tracking-number {
      font-size: 24px; /* Mã vận đơn rất to */
      font-weight: bold;
      font-family: 'Courier New', monospace;
      letter-spacing: 1px;
      word-break: break-all;
      line-height: 1.2;
    }
    .routing-code {
      font-size: 20px;
      font-weight: bold;
      border: 3px solid #000;
      padding: 5px 10px;
      display: inline-block;
      margin-top: 8px;
      align-self: flex-start;
    }

    /* ADDRESS SECTION */
    .address-section {
      display: flex;
      border-bottom: 3px solid #000;
      flex-grow: 1;
    }
    .sender-col {
      width: 40%;
      padding: 4mm;
      border-right: 2px solid #000;
      font-size: 13px; /* Chữ to hơn */
      display: flex;
      flex-direction: column;
    }
    .receiver-col {
      width: 60%;
      padding: 4mm;
      font-size: 14px; /* Chữ to hơn */
      position: relative;
      display: flex;
      flex-direction: column;
    }
    .section-title {
      font-size: 12px;
      font-weight: bold;
      margin-bottom: 5px;
      text-transform: uppercase;
      text-decoration: underline;
    }
    .dest-code-large {
      position: absolute;
      top: 3mm;
      right: 3mm;
      font-size: 36px; /* Mã vùng HCM cực to */
      font-weight: bold;
      border: 3px solid #000;
      padding: 3px 12px;
    }

    /* WARNING */
    .warning-text {
      font-size: 12px;
      padding: 3mm;
      border-bottom: 2px solid #000;
      font-style: italic;
      text-align: center;
      font-weight: 500;
    }

    /* BODY */
    .body-section {
      display: flex;
      border-bottom: 3px solid #000;
      flex-grow: 2;
      min-height: 60mm;
    }
    .items-list {
      flex: 1;
      padding: 4mm;
      border-right: 2px solid #000;
      font-size: 13px;
    }
    .item-row {
      margin-bottom: 8px;
      border-bottom: 1px dashed #999;
      padding-bottom: 4px;
    }
    .item-name {
      font-weight: bold;
      font-size: 14px;
      line-height: 1.3;
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
      height: 45mm; /* Footer cao hơn */
    }
    .footer-left {
      flex: 1;
      padding: 4mm;
      border-right: 2px solid #000;
      font-size: 12px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
    }
    .footer-right {
      width: 55mm;
      padding: 4mm;
      text-align: center;
      display: flex;
      flex-direction: column;
      justify-content: center;
      background: #fff;
    }
    .cod-value {
      font-size: 32px; /* Tiền thu hộ cực to */
      font-weight: 900;
      margin-top: 10px;
    }

    /* BOTTOM LINE */
    .bottom-line {
      padding: 3mm;
      font-size: 11px;
      text-align: center;
      border-top: 2px solid #000;
      font-weight: bold;
    }

    @media print {
      body { margin: 0; padding: 0; background: white; }
      .page { 
        width: 148mm; 
        height: 210mm; /* Cố định chiều cao A5 */
        border: 2px solid #000 !important; /* Bắt buộc in viền */
        margin: 0 auto;
        page-break-after: always;
      }
    }
  </style>
</head>
<body>
  <div class="page">
    
    <div class="header">
      <div class="header-qr">
        <img src="https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(trackingCode)}" alt="QR">
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
        <div class="bold" style="font-size: 14px; margin-bottom: 4px;">${senderName}</div>
        <div style="margin-bottom: 4px; line-height: 1.3;">${senderAddress}</div>
        <div class="bold">SĐT: ${senderPhone}</div>
      </div>
      <div class="receiver-col">
        <div class="section-title">Đến:</div>
        <div class="dest-code-large">${districtName}</div>
        <div style="margin-top: 12mm;">
          <div class="bold" style="font-size: 18px; margin-bottom: 5px;">${receiverName}</div>
          <div style="margin-bottom: 5px; line-height: 1.3;">${receiverAddress}</div>
          <div class="bold" style="font-size: 15px;">SĐT: ${receiverPhone}</div>
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
            <div style="font-size: 12px; color: #333; margin-top: 2px;">
               ${item.variant ? `Phân loại: ${item.variant} | ` : ''} 
               <strong>SL: ${item.qty || 1}</strong>
            </div>
          </div>
        `).join('') : '<div style="font-style:italic">Không có thông tin sản phẩm</div>'}
      </div>
      <div class="instructions">
        <div class="section-title">Chỉ dẫn:</div>
        <div class="instruction-box">ĐỒNG KIỂM</div>
        <div class="instruction-box">CHO THỬ HÀNG</div>
        <div style="margin-top: 8px; line-height: 1.4;">
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
          <div style="margin-top: 8px;">Chữ ký người nhận:</div>
        </div>
        <div style="font-style:italic; font-size:11px;">Xác nhận hàng nguyên vẹn, không móp méo.</div>
      </div>
      <div class="footer-right">
        <div style="font-size: 13px; font-weight: bold;">Tiền thu Người nhận:</div>
        <div class="cod-value">${codDisplay}</div>
      </div>
    </div>
    
    <div class="bottom-line">
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