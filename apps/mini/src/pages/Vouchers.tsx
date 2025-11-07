// apps/mini/src/pages/Vouchers.tsx
import React, { useEffect, useState } from 'react';
import { Page } from 'zmp-ui';
import { api } from '@shared/api';

interface Voucher {
  code: string;
  voucher_type: string;
  off: number;
  min_purchase: number;
  on: boolean;
  starts_at?: number;
  expires_at?: number;
  usage_limit_per_user?: number;
  usage_limit_total?: number;
  usage_count?: number;
}

const API_BASE = 'https://api.shophuyvan.vn';

export default function Vouchers() {
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadVouchers();
  }, []);

  const loadVouchers = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE}/vouchers`, {
        credentials: 'include',
      });
      
      if (!response.ok) {
        throw new Error('Không thể tải danh sách voucher');
      }

      const data = await response.json();
      const items = data.items || data.vouchers || data.data || [];
      
      // Chỉ lấy voucher đang ON và chưa hết hạn
      const activeVouchers = items.filter((v: Voucher) => {
        const isActive = v.on !== false;
        const notExpired = !v.expires_at || v.expires_at > Date.now();
        return isActive && notExpired;
      });

      setVouchers(activeVouchers);
    } catch (e: any) {
      console.error('Load vouchers error:', e);
      setError(e.message || 'Lỗi tải voucher');
    } finally {
      setLoading(false);
    }
  };

  const copyCode = (code: string) => {
    // Sao chép mã voucher
    if (navigator.clipboard) {
      navigator.clipboard.writeText(code).then(() => {
        alert(`Đã sao chép mã: ${code}`);
      }).catch(() => {
        alert(`Mã voucher: ${code}`);
      });
    } else {
      alert(`Mã voucher: ${code}`);
    }
  };

  const formatPrice = (n: number) => {
    return Number(n || 0).toLocaleString('vi-VN') + 'đ';
  };

  const formatDate = (timestamp?: number) => {
    if (!timestamp) return '-';
    try {
      return new Date(timestamp).toLocaleDateString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });
    } catch {
      return '-';
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
        <h1 className="text-lg font-semibold">Kho Voucher</h1>
      </div>
      
      <div className="max-w-2xl mx-auto p-4">
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
            <p className="text-red-600 text-sm">{error}</p>
          </div>
        )}

        {!error && vouchers.length === 0 && (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">🎟️</div>
            <p className="text-gray-600 text-sm">Chưa có voucher khả dụng</p>
          </div>
        )}

        <div className="space-y-3">
          {vouchers.map((voucher) => (
            <div
              key={voucher.code}
              className="bg-white rounded-xl shadow-sm overflow-hidden"
            >
              <div className="bg-gradient-to-r from-orange-500 to-pink-500 p-4 text-white">
                <div className="flex items-center justify-between">
                  <div>
                    {voucher.voucher_type === 'auto_freeship' ? (
                      <>
                        <div className="text-2xl font-bold">🚚 FREESHIP</div>
                        <div className="text-sm opacity-90 mt-1">
                          Đơn từ {formatPrice(voucher.min_purchase)}
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="text-3xl font-bold">
                          {voucher.off}% OFF
                        </div>
                        <div className="text-sm opacity-90">Giảm giá</div>
                      </>
                    )}
                  </div>
                  <button
                    onClick={() => copyCode(voucher.code)}
                    className="bg-white text-orange-600 px-4 py-2 rounded-lg font-semibold text-sm hover:bg-orange-50"
                  >
                    Sao chép
                  </button>
                </div>
              </div>

              <div className="p-4 space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Mã voucher:</span>
                  <span className="font-mono font-semibold text-blue-600">
                    {voucher.code}
                  </span>
                </div>

                {voucher.expires_at && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Hạn sử dụng:</span>
                    <span className="text-gray-900">
                      {formatDate(voucher.expires_at)}
                    </span>
                  </div>
                )}

                {voucher.usage_limit_per_user && voucher.usage_limit_per_user > 0 && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Giới hạn:</span>
                    <span className="text-gray-900">
                      {voucher.usage_limit_per_user} lần/người
                    </span>
                  </div>
                )}

                {voucher.usage_limit_total && voucher.usage_limit_total > 0 && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Còn lại:</span>
                    <span className="text-gray-900">
                      {voucher.usage_limit_total - (voucher.usage_count || 0)} lượt
                    </span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </Page>
  );
}
