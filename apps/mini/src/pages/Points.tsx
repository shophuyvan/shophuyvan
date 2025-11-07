// apps/mini/src/pages/Points.tsx
import React, { useEffect, useState } from 'react';
import { Page } from 'zmp-ui';
import { storage } from '@/lib/storage';

const API_BASE = 'https://api.shophuyvan.vn';

interface Customer {
  id: string;
  full_name: string;
  phone: string;
  email: string;
  points: number;
  tier: string;
}

export default function Points() {
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

    const [token, setToken] = useState<string>('');

  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      const storedToken =
        (await storage.get<string>('customer_token')) ||
        (await storage.get<string>('x-customer-token')) ||
        (await storage.get<string>('x-token'));

      if (cancelled) return;

      if (!storedToken) {
        setError('Vui lòng đăng nhập để xem điểm');
        setLoading(false);
        return;
      }

      setToken(storedToken);
      loadCustomerData(storedToken);
    };

    init();

    return () => {
      cancelled = true;
    };
  }, []);


  const loadCustomerData = async (authToken?: string) => {
    try {
      const response = await fetch(`${API_BASE}/api/customers/me`, {
        headers: {
                  'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken || token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Không thể tải thông tin tài khoản');
      }

      const data = await response.json();
      const c = (data && (data.customer || data.data || data)) as Customer | undefined;

      if (c) {
        setCustomer(c);
      } else {
        throw new Error('Không tìm thấy thông tin tài khoản');
      }
    } catch (e: any) {
      console.error('Load customer error:', e);
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

    if (loading) {
    return (
      <Page className="bg-gray-50">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Đang tải...</p>
          </div>
        </div>
      </Page>
    );
  }

    if (error) {
    return (
      <Page className="bg-gray-50">
        <div className="max-w-2xl mx-auto p-4">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-600 text-sm">{error}</p>
          </div>
        </div>
      </Page>
    );
  }


  const points = customer?.points || 0;

  return (
    <Page className="bg-gray-50">
      <div className="bg-white border-b px-4 py-3 flex items-center gap-3">
        <button
          onClick={() => window.history.back()}
          className="p-1 hover:bg-gray-100 rounded-full"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-lg font-semibold">Tích điểm</h1>
      </div>
      
      <div className="max-w-2xl mx-auto p-4 space-y-4 mt-2">
        {/* Card điểm */}
        <div className="bg-gradient-to-br from-yellow-400 to-orange-500 rounded-2xl p-6 text-white shadow-lg">
          <div className="text-sm opacity-90 mb-2">Điểm hiện tại</div>
          <div className="text-5xl font-bold mb-4">
            {points.toLocaleString('vi-VN')}
          </div>
          <div className="flex items-center text-sm">
            <span className="mr-2">⭐</span>
            <span>Shop Huy Vân Rewards</span>
          </div>
        </div>

        {/* Thông tin tích điểm */}
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <h2 className="text-lg font-bold mb-4">Cách tích điểm</h2>
          
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                <span className="text-xl">🛍️</span>
              </div>
              <div>
                <p className="font-semibold text-gray-900">Mua sắm</p>
                <p className="text-sm text-gray-600">
                  Nhận 1 điểm cho mỗi 1.000đ chi tiêu
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                <span className="text-xl">🎂</span>
              </div>
              <div>
                <p className="font-semibold text-gray-900">Sinh nhật</p>
                <p className="text-sm text-gray-600">
                  Nhận điểm thưởng đặc biệt vào ngày sinh nhật
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0">
                <span className="text-xl">✍️</span>
              </div>
              <div>
                <p className="font-semibold text-gray-900">Đánh giá</p>
                <p className="text-sm text-gray-600">
                  Nhận điểm khi đánh giá sản phẩm đã mua
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Quy đổi điểm */}
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <h2 className="text-lg font-bold mb-4">Quy đổi điểm</h2>
          
          <div className="bg-gradient-to-r from-blue-50 to-cyan-50 rounded-lg p-4 mb-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">100 điểm</p>
                <p className="text-2xl font-bold text-blue-600">= 10.000đ</p>
              </div>
              <div className="text-4xl">💰</div>
            </div>
          </div>

          <p className="text-xs text-gray-500">
            * Điểm có thể dùng để giảm giá đơn hàng khi thanh toán
          </p>
        </div>

        {/* Lịch sử tích điểm (placeholder) */}
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <h2 className="text-lg font-bold mb-4">Lịch sử tích điểm</h2>
          
          <div className="text-center py-8">
            <div className="text-5xl mb-3">📊</div>
            <p className="text-gray-500 text-sm">
              Lịch sử chi tiết đang được cập nhật
            </p>
          </div>
        </div>
      </div>
    </Page>
  );
}
