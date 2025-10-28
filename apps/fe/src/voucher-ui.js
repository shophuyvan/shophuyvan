import api from './lib/api.js';
import { formatPrice } from './lib/price.js';

const voucherInput = document.getElementById('voucher');
const applyBtn = document.getElementById('apply-voucher');
const resultEl = document.getElementById('voucher-result');
const summaryEl = document.getElementById('cart-summary');

function getCart(){ try{ return JSON.parse(localStorage.getItem('cart')||'[]'); }catch{return [];} }
function subtotal(items){ return (items||[]).reduce((s, it)=> s + (Number(it.price||0) * Number(it.qty||1)), 0); }

async function applyVoucher(){
  const code = (voucherInput?.value||'').trim().toUpperCase(); // Lấy mã, bỏ khoảng trắng, viết hoa
  if (!code) {
    resultEl.textContent = 'Vui lòng nhập mã voucher';
    resultEl.style.color = 'red';
    return;
  }

  const items = getCart();
  const sub = subtotal(items); // Tính tổng tiền hàng

  // Lấy customer ID từ localStorage (nếu khách đã đăng nhập)
  let customerId = null;
  try {
    const customerInfo = JSON.parse(localStorage.getItem('customer_info') || 'null');
    customerId = customerInfo?.id || null;
  } catch {}

  // Xóa thông tin voucher cũ trong localStorage trước khi thử áp dụng mã mới
  localStorage.removeItem('voucher_code');
  localStorage.removeItem('voucher_discount');
  localStorage.removeItem('voucher_ship_discount');
  resultEl.textContent = 'Đang kiểm tra...'; // Thông báo đang xử lý
  resultEl.style.color = 'gray';
  applyBtn.disabled = true; // Vô hiệu hóa nút tạm thời

  try {
    // Gọi API endpoint MỚI: /vouchers/apply
    const data = await api('/vouchers/apply', {
      method:'POST',
      body: {
        code: code,
        customer_id: customerId,
        subtotal: sub
      }
    });

    // Kiểm tra kết quả
    if (!data || !data.ok) {
      // Nếu có lỗi, ném lỗi với thông báo từ API
      throw new Error(data.error || 'Mã không hợp lệ hoặc đã hết hạn/lượt dùng');
    }

    // Nếu API trả về thành công (data.ok === true)
    const discount = Number(data.discount || 0); // Số tiền giảm giá sản phẩm
    const shipDiscount = Number(data.ship_discount || 0); // Số tiền giảm giá ship

    // Hiển thị thông báo thành công
    resultEl.innerHTML = `✅ Áp dụng thành công! Giảm: -${formatPrice(discount)} ${shipDiscount > 0 ? `(Phí ship: -${formatPrice(shipDiscount)})` : ''}`;
    resultEl.style.color = 'green';

    // Lưu thông tin voucher đã áp dụng vào localStorage để checkout.js sử dụng
    localStorage.setItem('voucher_code', code); // Lưu lại mã đã áp dụng thành công
    localStorage.setItem('voucher_discount', String(discount));
    localStorage.setItem('voucher_ship_discount', String(shipDiscount));

  } catch (error) {
    // Nếu có lỗi xảy ra (từ API hoặc mạng)
    console.error('[ApplyVoucher] Error:', error);
    // Hiển thị thông báo lỗi
    resultEl.textContent = `❌ ${error.message || 'Có lỗi xảy ra'}`;
    resultEl.style.color = 'red';
    // Đảm bảo xóa sạch thông tin voucher cũ nếu áp dụng thất bại
    localStorage.removeItem('voucher_code');
    localStorage.removeItem('voucher_discount');
    localStorage.removeItem('voucher_ship_discount');
  } finally {
    // Luôn bật lại nút Apply
    applyBtn.disabled = false;
    // Luôn cập nhật lại phần tóm tắt đơn hàng (để hiển thị giảm giá hoặc xóa giảm giá cũ)
    if (window.__updateSummary) {
      window.__updateSummary(); // Gọi hàm cập nhật summary trong checkout.js
    }
  }
}

// Đảm bảo các hàm phụ trợ có sẵn hoặc được import
// function getCart(){ try{ return JSON.parse(localStorage.getItem('cart')||'[]'); }catch{return [];} }
// function subtotal(items){ return (items||[]).reduce((s, it)=> s + (Number(it.price||0) * Number(it.qty||1)), 0); }
// import { formatPrice } from './lib/price.js'; // Nếu chưa có
applyBtn?.addEventListener('click', applyVoucher);
