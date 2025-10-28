import api from './lib/api.js';
import { formatPrice } from './lib/price.js';

const voucherInput = document.getElementById('voucher');
const applyBtn = document.getElementById('apply-voucher');
const resultEl = document.getElementById('voucher-result');

// Lấy giỏ hàng từ localStorage
function getCart() {
  try {
    return JSON.parse(localStorage.getItem('cart') || '[]');
  } catch {
    return [];
  }
}

// Tính tổng tiền hàng
function getSubtotal(items) {
  return (items || []).reduce(
    (sum, item) => sum + Number(item.price || 0) * Number(item.qty || 1),
    0
  );
}

// Lấy customer ID nếu đã đăng nhập
function getCustomerId() {
  try {
    const customerInfo = JSON.parse(localStorage.getItem('customer_info') || 'null');
    return customerInfo?.id || null;
  } catch {
    return null;
  }
}

// Xóa thông tin voucher cũ
function clearVoucherData() {
  localStorage.removeItem('voucher_code');
  localStorage.removeItem('voucher_discount');
  localStorage.removeItem('voucher_ship_discount');
}

// Lưu thông tin voucher mới
function saveVoucherData(code, discount, shipDiscount) {
  localStorage.setItem('voucher_code', code);
  localStorage.setItem('voucher_discount', String(discount));
  localStorage.setItem('voucher_ship_discount', String(shipDiscount));
}

// Hiển thị thông báo
function showResult(message, color = 'black') {
  resultEl.textContent = message;
  resultEl.style.color = color;
}

// Hiển thị thông báo thành công (có thể có giảm giá ship)
function showSuccess(discount, shipDiscount) {
  resultEl.innerHTML = `✅ Áp dụng thành công! Giảm: -${formatPrice(discount)}${shipDiscount > 0 ? ` (Phí ship: -${formatPrice(shipDiscount)})` : ''}`;
  resultEl.style.color = 'green';
}

// Hàm áp dụng voucher
async function applyVoucher() {
  const code = (voucherInput?.value || '').trim().toUpperCase();
  if (!code) {
    showResult('Vui lòng nhập mã voucher', 'red');
    return;
  }

  const items = getCart();
  const subtotal = getSubtotal(items);
  const customerId = getCustomerId();

  clearVoucherData();
  showResult('Đang kiểm tra...', 'gray');
  applyBtn.disabled = true;

  try {
    const data = await api('/vouchers/apply', {
      method: 'POST',
      body: {
        code,
        customer_id: customerId,
        subtotal,
      },
    });

    if (!data?.ok) {
      throw new Error(data?.error || 'Mã không hợp lệ hoặc đã hết hạn/lượt dùng');
    }

    const discount = Number(data.discount || 0);
    const shipDiscount = Number(data.ship_discount || 0);

    showSuccess(discount, shipDiscount);
    saveVoucherData(code, discount, shipDiscount);
  } catch (error) {
    showResult(`❌ ${error.message || 'Có lỗi xảy ra'}`, 'red');
    clearVoucherData();
  } finally {
    applyBtn.disabled = false;
    if (typeof window.__updateSummary === 'function') {
      window.__updateSummary();
    }
  }
}

// Sự kiện click nút áp dụng voucher
applyBtn?.addEventListener('click', (event) => {
  event.preventDefault();
  applyVoucher();
});

// Xóa thông báo khi người dùng nhập lại mã
voucherInput?.addEventListener('input', () => {
  if (resultEl.textContent) resultEl.textContent = '';
});

// Hỗ trợ nhấn Enter để áp dụng voucher
voucherInput?.addEventListener('keypress', (event) => {
  if (event.key === 'Enter') {
    event.preventDefault();
    applyVoucher();
  }
});