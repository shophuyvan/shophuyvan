// apps/mini/src/pages/Account.tsx

import React, { useEffect, useState } from 'react';
import { Page, Header, useNavigate } from 'zmp-ui';
import { zmp } from '@/lib/zmp';


// Helper functions for toast and alert
const toast = (message: string) => {
  try {
    zmp.toast.show({ content: message, duration: 2000 });
  } catch (e) {
    console.log(message);
  }
};

const alert = (message: string, title = 'Thông báo') => {
  try {
    zmp.dialog.alert({ title, message });
  } catch (e) {
    window.alert(message);
  }
};

const API_BASE = 'https://api.shophuyvan.vn';

// Đã xóa interface Address vì đã tách sang AddressList.tsx

interface Customer {
  id: string;
  full_name: string;
  phone: string;
  email: string;
  points: number;
  tier: string;
  status: string;
  zalo_id?: string;
  zalo_name?: string;
  zalo_avatar?: string;
}

export default function Account() {
  const navigate = useNavigate();
  const [customer, setCustomer] = useState<Customer | null>(null);
  // Đã xóa state addresses vì không hiển thị trên trang này nữa
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Đã xóa các state quản lý form addresses vì đã tách ra AddressList.tsx và AddressEdit.tsx

    const token =
    localStorage.getItem('customer_token') ||
    localStorage.getItem('x-customer-token') ||
    localStorage.getItem('x-token') ||
    '';

  // Mini app: có thể chưa có token -> không redirect sang /login
  // Nếu chưa có token thì chỉ tắt loading và hiển thị thông tin cơ bản
  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }

    loadCustomerData();
    // Không cần load addresses và provinces nữa vì đã tách sang trang riêng
  }, [token]);


    // Helper gọi API trong trang Tài khoản
  const api = async (path: string, options: any = {}) => {
    const headers: any = {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };

    const response = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: 'Lỗi' }));
      throw new Error(err.message || err.error || 'Lỗi');
    }

    return response.json();
  };


  const loadCustomerData = async () => {
    try {
      const data = await api('/api/customers/me');

      // Backend có thể trả { customer }, { data } hoặc object thẳng
      const c =
        (data && (data.customer || data.data || data)) as Customer | undefined;

      if (c) {
        setCustomer(c);
      } else {
        console.warn('Load customer: response không có customer', data);
      }
    } catch (e: any) {
      console.error('Load customer error:', e);
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('customer_token');
    localStorage.removeItem('x-customer-token');
    localStorage.removeItem('x-token');
localStorage.removeItem('customer_info');
navigate('/'); // ✅ Chuẩn Mini App
};

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-4 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Đang tải...</p>
        </div>
      </div>
    );
  }

  return (
<Page className="bg-gray-50">
  <div className="max-w-2xl mx-auto p-4 space-y-4">
    {/* Customer Info */}
                {customer && (
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <div className="mb-4 pb-4 border-b">
              <p className="text-sm text-gray-600">Tên</p>
              <p className="font-semibold text-lg">{customer.full_name}</p>
            </div>
            <div className="grid grid-cols-2 gap-4 mb-4 pb-4 border-b">
              <div>
                <p className="text-sm text-gray-600">Email</p>
                <p className="font-medium text-sm">{customer.email}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Điểm</p>
                <p className="font-semibold">
                  {(customer.points ?? 0).toLocaleString('vi-VN')}
                </p>
              </div>
            </div>
            <div>
              <p className="text-sm text-gray-600">Hạng thành viên</p>
              <p className="font-semibold text-blue-600 capitalize">
                {customer.tier}
              </p>
            </div>
          </div>
        )}

        {/* Đơn hàng của tôi */}
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold">Đơn hàng của tôi</h2>
            <button
              onClick={() => navigate('/orders')}
              className="text-sm text-blue-600 font-medium"
            >
              Xem lịch sử mua hàng &gt;
            </button>
          </div>
          <div className="grid grid-cols-4 gap-2 text-xs text-center text-gray-700">
            <button
              className="flex flex-col items-center justify-center py-2"
              onClick={() => navigate('/orders?status=pending')}
            >
              <span>Chờ xác nhận</span>
            </button>
            <button
              className="flex flex-col items-center justify-center py-2"
              onClick={() => navigate('/orders?status=shipping')}
            >
              <span>Chờ giao hàng</span>
            </button>
            <button
              className="flex flex-col items-center justify-center py-2"
              onClick={() => navigate('/orders?status=delivering')}
            >
              <span>Đang giao hàng</span>
            </button>
            <button
              className="flex flex-col items-center justify-center py-2"
              onClick={() => navigate('/orders?status=completed')}
            >
              <span>Đánh giá</span>
            </button>
          </div>
        </div>

        {/* Menu List */}
        <div className="bg-white rounded-xl shadow-sm divide-y divide-gray-100">
          {/* Sổ địa chỉ */}
          <button
            onClick={() => navigate('/address/list')}
            className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                <span className="text-xl">📍</span>
              </div>
              <div className="text-left">
                <p className="font-semibold text-gray-900">Sổ địa chỉ</p>
                <p className="text-xs text-gray-500">Địa chỉ nhận hàng</p>
              </div>
            </div>
            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>

          {/* Kho Voucher */}
          <button
            onClick={() => navigate('/vouchers')}
            className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center">
                <span className="text-xl">🎟️</span>
              </div>
              <div className="text-left">
                <p className="font-semibold text-gray-900">Kho Voucher</p>
                <p className="text-xs text-gray-500">Các voucher khuyến mãi</p>
              </div>
            </div>
            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>

          {/* Tích điểm */}
          <button
            onClick={() => navigate('/points')}
            className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-yellow-100 flex items-center justify-center">
                <span className="text-xl">⭐</span>
              </div>
              <div className="text-left">
                <p className="font-semibold text-gray-900">Tích điểm</p>
                <p className="text-xs text-blue-600 font-medium">
                  {customer ? `${customer.points?.toLocaleString() || 0} điểm` : 'Chưa có điểm'}
                </p>
              </div>
            </div>
            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>

          {/* Hạng thành viên */}
          <button
            onClick={() => navigate('/membership')}
            className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
                <span className="text-xl">👑</span>
              </div>
              <div className="text-left">
                <p className="font-semibold text-gray-900">Hạng thành viên</p>
                <p className="text-xs text-purple-600 font-medium capitalize">
                  {customer?.tier || 'Chưa có hạng'}
                </p>
              </div>
            </div>
            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>

          {/* Thông tin tài khoản */}
          <button
            onClick={() => navigate('/profile')}
            className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
                <span className="text-xl">⚙️</span>
              </div>
              <div className="text-left">
                <p className="font-semibold text-gray-900">Thông tin tài khoản</p>
                <p className="text-xs text-gray-500">Cập nhật thông tin định danh</p>
              </div>
            </div>
            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>

          {/* Danh sách cửa hàng */}
          <button
            onClick={() => navigate('/stores')}
            className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                <span className="text-xl">🏪</span>
              </div>
              <div className="text-left">
                <p className="font-semibold text-gray-900">Danh sách cửa hàng</p>
                <p className="text-xs text-gray-500">Vị trí và thông tin cửa hàng</p>
              </div>
            </div>
            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>

          {/* Về chúng tôi */}
          <button
            onClick={() => navigate('/about')}
            className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                <span className="text-xl">📄</span>
              </div>
              <div className="text-left">
                <p className="font-semibold text-gray-900">Về chúng tôi</p>
                <p className="text-xs text-gray-500">Cập nhật chính sách, điều khoản và giới thiệu về chúng tôi</p>
              </div>
            </div>
            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>

          {/* Hỗ trợ và hỏi đáp */}
          <button
            onClick={() => navigate('/support')}
            className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                <span className="text-xl">❓</span>
              </div>
              <div className="text-left">
                <p className="font-semibold text-gray-900">Hỗ trợ và hỏi đáp</p>
                <p className="text-xs text-gray-500">Gặp trực tiếp đội ngũ tư vấn viên</p>
              </div>
            </div>
            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        {/* Logout */}
        <button
          onClick={handleLogout}
          className="w-full bg-red-100 text-red-600 py-3 rounded-xl font-semibold mt-6 hover:bg-red-200"
        >
          Đăng xuất
       </button>
  </div>
</Page> // ✅ Chuẩn Mini App: Đóng thẻ Page
);
}