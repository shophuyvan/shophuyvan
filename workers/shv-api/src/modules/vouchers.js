// ===================================================================
// modules/vouchers.js - Vouchers Module
// ===================================================================

import { json, errorResponse } from '../lib/response.js';
import { adminOK } from '../lib/auth.js';
import { getJSON, putJSON } from '../lib/kv.js';
import { readBody } from '../lib/utils.js'; // THÊM DÒNG NÀY

/**
 * Public: Get all vouchers
 */
async function getPublicVouchers(req, env) {
  try {
    const list = await getJSON(env, 'vouchers', []);
    return json({ items: list }, {}, req);
  } catch (e) {
    return errorResponse(e, 500, req);
  }
}

/**
 * Admin: List all vouchers
 */
async function listAdminVouchers(req, env) {
  try {
    const list = await getJSON(env, 'vouchers', []);
    return json({ items: list }, {}, req);
  } catch (e) {
    return errorResponse(e, 500, req);
  }
}

/**
 * Admin: Create or update voucher
 */
async function upsertVoucher(req, env) {
  try {
    const body = await readBody(req) || {};
    const list = await getJSON(env, 'vouchers', []);

    const code = String(body.code || '').toUpperCase();
    if (!code) {
      return errorResponse('Voucher code is required', 400, req);
    }

    const index = list.findIndex(v => 
      (v.code || '').toUpperCase() === code
    );

    // Dữ liệu cơ bản
    let voucherData = {
      code: code, 
      on: body.on === true || String(body.on) === 'true', 
      voucher_type: body.voucher_type === 'auto_freeship' ? 'auto_freeship' : 'code',
      // Thêm các trường mới từ body
      usage_limit_per_user: Math.max(0, parseInt(body.usage_limit_per_user || '0')), // Đảm bảo >= 0
      usage_limit_total: Math.max(0, parseInt(body.usage_limit_total || '0')), // Đảm bảo >= 0
      expires_at: body.expires_at ? Number(body.expires_at) : null, // Lưu timestamp
      // usage_count sẽ được giữ lại từ voucher cũ nếu là cập nhật
    };

    // Dữ liệu tùy theo loại
    if (voucherData.voucher_type === 'code') {
      voucherData.off = Math.max(0, Math.min(100, Number(body.off || 0))); // % giảm
      // Reset các trường không liên quan
      voucherData.min_purchase = 0; 
    } else { // auto_freeship
      voucherData.min_purchase = Math.max(0, Number(body.min_purchase || 0)); // Điều kiện
      // Reset các trường không liên quan
      voucherData.off = 0; 
    }

    if (index >= 0) {
      // Cập nhật: Giữ lại usage_count cũ và các trường không gửi lên
      list[index] = { 
        ...list[index], // Giữ lại trường cũ (quan trọng là usage_count)
        ...voucherData  // Ghi đè bằng dữ liệu mới
      }; 
    } else {
      // Tạo mới: Thêm usage_count = 0
      voucherData.usage_count = 0; 
      list.push(voucherData);
    }

    await putJSON(env, 'vouchers', list);
    // DÒNG NÀY VÀ 4 DÒNG SAU ĐÓ BỊ DƯ THỪA - ĐÃ XÓA
    return json({ ok: true, items: list }, {}, req);
  } catch (e) {
    return errorResponse(e, 500, req);
  }
}

/**
 * Admin: Delete voucher
 */
async function deleteVoucher(req, env) {
  if (!(await adminOK(req, env))) {
    return errorResponse('Unauthorized', 401, req);
  }

  try {
    const body = await readBody(req) || {};
    const code = String(body.code || '').toUpperCase();

    if (!code) {
      return errorResponse('Voucher code is required', 400, req);
    }

    const list = await getJSON(env, 'vouchers', []);
    const newList = list.filter(v => 
      (v.code || '').toUpperCase() !== code
    );

    await putJSON(env, 'vouchers', newList);
    return json({ ok: true, deleted: code }, {}, req);
  } catch (e) {
    return errorResponse(e, 500, req);
  }
} // <-- THÊM DẤU NGOẶC ĐÓNG HÀM TẠI ĐÂY
  // ===================================================================
// API: Apply Voucher (Called by Checkout)
// ===================================================================
export async function applyVoucher(req, env) {
  try {
    // Đọc dữ liệu gửi lên từ checkout.js
    const body = await readBody(req) || {};
    const code = String(body.code || '').toUpperCase(); // Mã voucher khách nhập
    const customerId = body.customer_id || null; // ID khách hàng (nếu đã đăng nhập)
    const subtotal = Number(body.subtotal || 0); // Tổng tiền hàng (để check min_purchase sau này nếu cần)

    console.log('[ApplyVoucher] Request:', { code, customerId, subtotal }); // Log để debug

    if (!code) {
      return errorResponse('Vui lòng nhập mã voucher', 400, req);
    }

    // Lấy danh sách tất cả voucher từ KV
    const list = await getJSON(env, 'vouchers', []);
    // Tìm voucher khớp với mã khách nhập (không phân biệt hoa thường)
    const voucher = list.find(v => (v.code || '').toUpperCase() === code);

    // --- BẮT ĐẦU KIỂM TRA ĐIỀU KIỆN ---

    // 1. Mã không tồn tại?
    if (!voucher) {
      console.log('[ApplyVoucher] Fail: Not found');
      return errorResponse('Mã voucher không tồn tại', 404, req);
    }

    // 2. Voucher đang TẮT (OFF)?
    if (voucher.on !== true) {
      console.log('[ApplyVoucher] Fail: Not active (on=false)');
      return errorResponse('Mã voucher không hoạt động', 400, req);
    }

    // 3. Voucher đã hết hạn? (So sánh timestamp hiện tại với expires_at)
    if (voucher.expires_at && Date.now() > voucher.expires_at) {
      console.log('[ApplyVoucher] Fail: Expired', { now: Date.now(), expires: voucher.expires_at });
      return errorResponse('Mã voucher đã hết hạn', 400, req);
    }

    // 4. Voucher đã hết tổng lượt sử dụng?
    if (voucher.usage_limit_total > 0 && (voucher.usage_count || 0) >= voucher.usage_limit_total) {
      console.log('[ApplyVoucher] Fail: Total usage limit reached', { count: voucher.usage_count, limit: voucher.usage_limit_total });
      return errorResponse('Mã voucher đã hết lượt sử dụng', 400, req);
    }

    // 5. Khách hàng này đã dùng quá số lần cho phép? (Chỉ kiểm tra nếu có customerId)
    if (customerId && voucher.usage_limit_per_user > 0) {
      const historyKey = `customer_voucher_history:${customerId}`;
      const history = await getJSON(env, historyKey, []); // Lấy lịch sử dùng voucher của khách
      // Đếm xem mã này đã có trong lịch sử bao nhiêu lần
      const timesUsed = history.filter(usedCode => (usedCode || '').toUpperCase() === code).length;

      if (timesUsed >= voucher.usage_limit_per_user) {
        console.log('[ApplyVoucher] Fail: User usage limit reached', { customerId, timesUsed, limit: voucher.usage_limit_per_user });
        return errorResponse(`Bạn đã sử dụng mã voucher này ${timesUsed} lần rồi`, 400, req);
      }
    }

    // --- KẾT THÚC KIỂM TRA ĐIỀU KIỆN ---

    // --- TÍNH TOÁN GIẢM GIÁ (NẾU TẤT CẢ ĐIỀU KIỆN OK) ---
    let discount = 0;          // Giảm giá tiền hàng
    let ship_discount = 0;    // Giảm giá phí ship

    if (voucher.voucher_type === 'code' && voucher.off > 0) {
      // Đây là voucher giảm % tiền hàng
      discount = Math.floor(subtotal * (voucher.off / 100));
      // TODO: Thêm logic kiểm tra min_order, max_discount nếu bạn có cài đặt chúng
      // Ví dụ: if (subtotal < voucher.min_order) return errorResponse(...)
      // Ví dụ: if (discount > voucher.max_discount) discount = voucher.max_discount;
      console.log(`[ApplyVoucher] Success (Code %): Calculated discount = ${discount}`);
    } else if (voucher.voucher_type === 'auto_freeship') {
      // Loại này thường không áp dụng bằng tay, nhưng nếu có thể, nó sẽ giảm ship
      // Logic miễn ship phức tạp hơn và thường được xử lý ở checkout.js
      // Ở đây chỉ trả về là mã hợp lệ, việc giảm ship sẽ do frontend quyết định
      console.log('[ApplyVoucher] Note: Auto-Freeship voucher applied manually? Ship discount handled by frontend.');
      // ship_discount = some_calculated_ship_fee; // Nếu muốn API tự tính giảm ship
    } else {
       console.log('[ApplyVoucher] Success (Code with no discount defined?)');
       // Voucher hợp lệ nhưng không có % giảm? (Có thể là voucher tặng quà?)
       // discount = 0; ship_discount = 0;
    }

    // --- TRẢ KẾT QUẢ VỀ CHO CHECKOUT.JS ---
    // Lưu ý: KHÔNG cập nhật usage_count hay lịch sử ở đây. Việc đó chỉ xảy ra KHI đơn hàng HOÀN THÀNH.
    return json({
      ok: true,
      code: voucher.code,
      discount: discount,          // Số tiền giảm giá sản phẩm
      ship_discount: ship_discount, // Số tiền giảm giá ship
      message: 'Áp dụng voucher thành công'
      // Có thể trả về thêm thông tin voucher nếu cần
      // voucher_info: { type: voucher.voucher_type, off: voucher.off, ... }
    }, {}, req);

  } catch (e) {
    console.error('[ApplyVoucher] Exception:', e);
    return errorResponse(e, 500, req);
  }
}
// Helper (có thể đặt ở utils.js nếu dùng nhiều nơi)
function formatPrice(n) { return Number(n||0).toLocaleString('vi-VN') + 'đ'; }

// ===================================================================
// Main Handler (Thêm route mới)
// ===================================================================

  export async function handle(req, env, ctx) {
  const url = new URL(req.url);
  const path = url.pathname;
  const method = req.method;

  // Public: Get all vouchers
  if (path === '/vouchers' && method === 'GET') {
    return getPublicVouchers(req, env);
  }

  // Admin: List all vouchers
  if (path === '/admin/vouchers/list' && method === 'GET') {
    return listAdminVouchers(req, env);
  }
  // FIX: Admin list cũng có thể gọi qua /admin/vouchers
  if (path === '/admin/vouchers' && method === 'GET') {
    return listAdminVouchers(req, env);
  }

  // Admin: Upsert voucher
  if ((path === '/admin/vouchers/upsert' || path === '/admin/voucher') && method === 'POST') {
     return upsertVoucher(req, env);
  }

  // Admin: Delete voucher (optional, if needed)
  if (path === '/admin/vouchers/delete' && method === 'POST') {
    return deleteVoucher(req, env);
  }

  // THÊM: Endpoint mới để checkout gọi kiểm tra voucher
  if (path === '/vouchers/apply' && method === 'POST') {
    return applyVoucher(req, env);
  }
  return errorResponse('Route not found', 404, req);
}