// apps/mini/src/pages/Account.tsx

import React, { useEffect, useState } from 'react';
import { Page, Header, useNavigate } from 'zmp-ui';
import { zmp } from '@/lib/zmp';
import { storage } from '@/lib/storage';


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

  const [token, setToken] = useState<string>('');
  const [zaloInfo, setZaloInfo] = useState<any>(null);
  const [activating, setActivating] = useState(false);

  // Load Zalo info khi vào app
  useEffect(() => {
    let cancelled = false;

    const loadZaloInfo = async () => {
      try {
        const userInfo = await new Promise<any>((resolve) => {
          zmp.getUserInfo({
            success: (res: any) => resolve(res.userInfo),
            fail: () => resolve(null),
          });
        });

        if (!cancelled && userInfo) {
          setZaloInfo(userInfo);
          console.log('[Account] Zalo info loaded:', userInfo);
        }
      } catch (e) {
        console.error('[Account] Load Zalo info failed:', e);
      }
    };

    loadZaloInfo();

    return () => {
      cancelled = true;
    };
  }, []);

  // Mini app: có thể chưa có token -> thử activation
  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      const storedToken =
        (await storage.get<string>('customer_token')) ||
        (await storage.get<string>('x-customer-token')) ||
        (await storage.get<string>('x-token'));

      if (cancelled) return;

      if (!storedToken) {
        // Không có token: kiểm tra có Zalo info không
        // Nếu có thì tự động activate
        if (zaloInfo?.id) {
          console.log('[Account] No token, auto-activating with Zalo info...');
          await handleActivation();
        } else {
          setLoading(false);
        }
        return;
      }

      setToken(storedToken);
    };

    init();

    return () => {
      cancelled = true;
    };
  }, [zaloInfo]);

  useEffect(() => {
    if (!token) return;

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
      const message = err.message || err.error || 'Lỗi';

      // Token không hợp lệ -> xoá token, chuyển về guest
      if (
        response.status === 401 &&
        typeof message === 'string' &&
        message.toLowerCase().includes('invalid token')
      ) {
        console.warn('[Account] Invalid token, clearing state');
        await Promise.all([
          storage.remove('customer_token'),
          storage.remove('x-customer-token'),
          storage.remove('x-token'),
        ]);
        setToken('');
        setCustomer(null);
        setError(null);
        throw new Error('INVALID_TOKEN_INTERNAL');
      }

      throw new Error(message);
    }

    return response.json();
  };

  // Kích hoạt tài khoản qua Zalo (không OTP, cố gắng lấy SĐT nếu có)
  const handleActivation = async () => {
    if (!zaloInfo?.id || activating) return;

    setActivating(true);
    try {
      // Check localStorage xem đã activate chưa
      const storedUserId = await storage.get<string>('user_id');

      if (storedUserId) {
        console.log('[Account] Already activated with user_id:', storedUserId);
        // Load lại token
        const storedToken =
          (await storage.get<string>('customer_token')) ||
          (await storage.get<string>('x-customer-token')) ||
          (await storage.get<string>('x-token'));

        if (storedToken) {
          setToken(storedToken);
          setActivating(false);
          return;
        }
      }

      // Lấy SĐT từ Zalo (nếu user cho phép)
      let phone: string | undefined = undefined;
      try {
        const phoneRes: any = await new Promise((resolve) => {
          (zmp as any).getPhoneNumber({
            success: (res: any) => resolve(res),
            fail: (err: any) => {
              console.warn('[Account] getPhoneNumber fail:', err);
              resolve(null);
            },
          });
        });

        if (phoneRes) {
          phone =
            phoneRes.phoneNumber ||
            phoneRes.phone ||
            phoneRes.number ||
            undefined;
        }
      } catch (e) {
        console.warn('[Account] getPhoneNumber error:', e);
      }

      // Gọi API activation Zalo -> tạo / gắn customer + token dài ngày
      console.log('[Account] Calling /auth/zalo/activate-phone with:', {
        zalo_id: zaloInfo.id,
        zalo_name: zaloInfo.name,
        phone,
      });

      const response = await fetch(`${API_BASE}/auth/zalo/activate-phone`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          zalo_id: zaloInfo.id,
          zalo_name: zaloInfo.name || 'Zalo User',
          zalo_avatar: zaloInfo.avatar || '',
          full_name: zaloInfo.name || 'Zalo User',
          // phone optional – nếu không lấy được thì backend vẫn tạo khách
          phone,
        }),
      });

      const data = await response.json().catch(() => ({} as any));

      if (!response.ok || !data) {
        throw new Error(
          data?.message || data?.error || 'Kích hoạt tài khoản không thành công',
        );
      }

      const newToken =
        data.token ||
        data.customer_token ||
        data.data?.token ||
        data.data?.customer_token;
      const userId =
        data.customer?.id ||
        data.user?.id ||
        data.data?.id ||
        data.data?.customer?.id;

      if (newToken) {
        await storage.set('x-token', newToken);
        await storage.set('customer_token', newToken);
        if (userId) {
          await storage.set('user_id', userId);
        }
        setToken(newToken);
        toast('Kích hoạt tài khoản thành công!');
      } else {
        console.warn('[Account] No token in activation response', data);
        alert('Kích hoạt tài khoản không thành công');
      }
    } catch (e: any) {
      console.error('[Account] Activation failed:', e);
      alert(
        'Kích hoạt tài khoản thất bại: ' +
          (e?.message || 'Lỗi không xác định'),
      );
    } finally {
      setActivating(false);
      setLoading(false);
    }
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
      if (e?.message === 'INVALID_TOKEN_INTERNAL') {
        console.warn('[Account] Customer token invalid, switched to guest');
        // giữ trạng thái guest, không hiện lỗi
      } else {
        console.error('Load customer error:', e);
        setError(e.message);
      }
    } finally {
      setLoading(false);
    }
  };


    const handleLogout = async () => {
    await Promise.all([
      storage.remove('customer_token'),
      storage.remove('x-customer-token'),
      storage.remove('x-token'),
    ]);
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem('customer_info');
      }
    } catch (e) {
      console.warn('Không thể xóa customer_info khỏi localStorage:', e);
    }
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
    {/* Guest/Activation Box */}
    {!customer && !loading && (
      <div className="bg-gradient-to-br from-blue-50 to-indigo-100 rounded-xl p-6 shadow-sm border-2 border-blue-200">
        <div className="text-center mb-4">
          <div className="text-4xl mb-2">👋</div>
          <h3 className="text-lg font-bold text-gray-900 mb-1">
            Chào {zaloInfo?.name || 'bạn'}!
          </h3>
          <p className="text-sm text-gray-600">
            Kích hoạt tài khoản để tích điểm và nhận ưu đãi
          </p>
        </div>
        
        {zaloInfo?.id && (
          <button
            onClick={handleActivation}
            disabled={activating}
            className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-3 rounded-xl font-semibold hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {activating ? '⏳ Đang kích hoạt...' : '✨ Kích hoạt tài khoản'}
          </button>
        )}
      </div>
    )}

        {/* Customer Info */}
    {customer && (
      <div className="bg-white rounded-xl p-4 shadow-sm space-y-4">
        {/* Header: avatar + tên + trạng thái Zalo */}
        <div className="flex items-center gap-3 pb-4 border-b">
          <div className="w-14 h-14 rounded-full bg-blue-100 overflow-hidden flex items-center justify-center text-2xl font-semibold text-blue-700">
            {customer.zalo_avatar ? (
              // Avatar Zalo nếu có
              <img
                src={customer.zalo_avatar}
                alt={customer.full_name || customer.zalo_name || 'Avatar'}
                className="w-full h-full object-cover"
              />
            ) : (
              (customer.full_name?.charAt(0) ||
                customer.zalo_name?.charAt(0) ||
                'U'
              ).toUpperCase()
            )}
          </div>
          <div className="flex-1">
            <p className="text-xs text-gray-400 mb-1 truncate">
              ID: {customer.id}
            </p>
            <p className="font-semibold text-lg">
              {customer.full_name || customer.zalo_name || 'Khách hàng'}
            </p>
            <p className="text-xs mt-1">
              {customer.zalo_id ? (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-green-50 text-green-700">
                  Đã liên kết Zalo
                </span>
              ) : (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-gray-100 text-gray-600">
                  Chưa liên kết Zalo
                </span>
              )}
            </p>
          </div>
        </div>

        {/* Thông tin liên lạc */}
        <div className="grid grid-cols-2 gap-4 pb-4 border-b">
          <div>
            <p className="text-sm text-gray-600">Số điện thoại</p>
            <p className="font-medium text-sm">
              {customer.phone || 'Chưa cập nhật'}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Email</p>
            <p className="font-medium text-sm">
              {customer.email || 'Chưa cập nhật'}
            </p>
          </div>
        </div>

        {/* Điểm & hạng */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-gray-600">Điểm tích lũy</p>
            <p className="font-semibold">
              {(customer.points ?? 0).toLocaleString('vi-VN')} điểm
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Hạng thành viên</p>
            <p className="font-semibold text-blue-600 capitalize">
              {customer.tier || 'dong'}
            </p>
          </div>
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
            onClick={() => navigate('/address/list?return=/account')}
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
                  {customer ? `${customer.points?.toLocaleString() || 0} điểm` : 'Kích hoạt để tích điểm'}
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