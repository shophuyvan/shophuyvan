// apps/mini/src/pages/Membership.tsx
import React, { useEffect, useState } from 'react';
import { Page, Header } from 'zmp-ui';

const API_BASE = 'https://api.shophuyvan.vn';

interface Customer {
  id: string;
  full_name: string;
  phone: string;
  email: string;
  points: number;
  tier: string;
}

// Định nghĩa các hạng thành viên
const TIERS = [
  {
    name: 'bronze',
    displayName: 'Thành viên Đồng',
    icon: '🥉',
    color: 'from-amber-600 to-orange-700',
    minPoints: 0,
    benefits: [
      'Tích điểm mua hàng',
      'Nhận thông báo khuyến mãi',
      'Hỗ trợ khách hàng ưu tiên',
    ],
  },
  {
    name: 'silver',
    displayName: 'Thành viên Bạc',
    icon: '🥈',
    color: 'from-gray-400 to-gray-600',
    minPoints: 1000,
    benefits: [
      'Tất cả quyền lợi hạng Đồng',
      'Giảm 5% mọi đơn hàng',
      'Ưu tiên giao hàng nhanh',
      'Quà tặng sinh nhật',
    ],
  },
  {
    name: 'gold',
    displayName: 'Thành viên Vàng',
    icon: '🥇',
    color: 'from-yellow-400 to-yellow-600',
    minPoints: 5000,
    benefits: [
      'Tất cả quyền lợi hạng Bạc',
      'Giảm 10% mọi đơn hàng',
      'Miễn phí vận chuyển',
      'Voucher đặc biệt hàng tháng',
      'Tư vấn riêng 1-1',
    ],
  },
  {
    name: 'platinum',
    displayName: 'Thành viên Bạch Kim',
    icon: '💎',
    color: 'from-purple-500 to-pink-600',
    minPoints: 10000,
    benefits: [
      'Tất cả quyền lợi hạng Vàng',
      'Giảm 15% mọi đơn hàng',
      'Ưu tiên mua hàng mới',
      'Sự kiện VIP độc quyền',
      'Hotline hỗ trợ 24/7',
    ],
  },
];

export default function Membership() {
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const token =
    localStorage.getItem('customer_token') ||
    localStorage.getItem('x-customer-token') ||
    localStorage.getItem('x-token') ||
    '';

  useEffect(() => {
    if (!token) {
      setError('Vui lòng đăng nhập để xem hạng thành viên');
      setLoading(false);
      return;
    }
    loadCustomerData();
  }, [token]);

  const loadCustomerData = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/customers/me`, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
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
        <Header title="Hạng thành viên" showBackIcon={true} />
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
        <Header title="Hạng thành viên" showBackIcon={true} />
        <div className="max-w-2xl mx-auto p-4">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-600 text-sm">{error}</p>
          </div>
        </div>
      </Page>
    );
  }

  const currentPoints = customer?.points || 0;
  const currentTierName = (customer?.tier || 'bronze').toLowerCase();
  
  // Tìm hạng hiện tại
  const currentTier = TIERS.find(t => t.name === currentTierName) || TIERS[0];
  
  // Tìm hạng tiếp theo
  const currentIndex = TIERS.findIndex(t => t.name === currentTierName);
  const nextTier = currentIndex < TIERS.length - 1 ? TIERS[currentIndex + 1] : null;
  
  // Tính progress đến hạng tiếp theo
  let progress = 100;
  let pointsNeeded = 0;
  if (nextTier) {
    const pointsInCurrentTier = currentPoints - currentTier.minPoints;
    const pointsToNextTier = nextTier.minPoints - currentTier.minPoints;
    progress = Math.min(100, (pointsInCurrentTier / pointsToNextTier) * 100);
    pointsNeeded = nextTier.minPoints - currentPoints;
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
        <h1 className="text-lg font-semibold">Hạng thành viên</h1>
      </div>
      
      <div className="max-w-2xl mx-auto px-4 pt-2 pb-4 space-y-4">
        {/* Card hạng hiện tại */}
        <div className={`bg-gradient-to-br ${currentTier.color} rounded-2xl p-6 text-white shadow-lg`}>
          <div className="text-center">
            <div className="text-6xl mb-3">{currentTier.icon}</div>
            <div className="text-2xl font-bold mb-2">{currentTier.displayName}</div>
            <div className="text-sm opacity-90">
              {currentPoints.toLocaleString('vi-VN')} điểm
            </div>
          </div>
        </div>

        {/* Tiến độ nâng hạng */}
        {nextTier && (
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <h2 className="text-lg font-bold mb-4">Tiến độ nâng hạng</h2>
            
            <div className="mb-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-600">
                  Còn {pointsNeeded.toLocaleString('vi-VN')} điểm để lên {nextTier.displayName}
                </span>
                <span className="text-sm font-semibold text-blue-600">
                  {Math.round(progress)}%
                </span>
              </div>
              <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-blue-500 to-purple-600 transition-all duration-500"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>

            <div className="flex items-center gap-2 text-sm text-gray-600">
              <span>{currentTier.icon}</span>
              <span>{currentTier.displayName}</span>
              <span>→</span>
              <span>{nextTier.icon}</span>
              <span>{nextTier.displayName}</span>
            </div>
          </div>
        )}

        {/* Quyền lợi hạng hiện tại */}
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <h2 className="text-lg font-bold mb-4">Quyền lợi của bạn</h2>
          
          <div className="space-y-2">
            {currentTier.benefits.map((benefit, index) => (
              <div key={index} className="flex items-start gap-3">
                <div className="w-5 h-5 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-green-600 text-xs">✓</span>
                </div>
                <p className="text-sm text-gray-700">{benefit}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Tất cả hạng thành viên */}
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <h2 className="text-lg font-bold mb-4">Các hạng thành viên</h2>
          
          <div className="space-y-3">
            {TIERS.map((tier, index) => {
              const isCurrentTier = tier.name === currentTierName;
              const isPassed = currentPoints >= tier.minPoints;
              
              return (
                <div
                  key={tier.name}
                  className={`border-2 rounded-lg p-4 ${
                    isCurrentTier
                      ? 'border-blue-500 bg-blue-50'
                      : isPassed
                      ? 'border-green-300 bg-green-50'
                      : 'border-gray-200 bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{tier.icon}</span>
                      <div>
                        <p className="font-bold text-gray-900">{tier.displayName}</p>
                        <p className="text-xs text-gray-600">
                          Từ {tier.minPoints.toLocaleString('vi-VN')} điểm
                        </p>
                      </div>
                    </div>
                    {isCurrentTier && (
                      <span className="bg-blue-600 text-white text-xs px-2 py-1 rounded-full">
                        Hạng hiện tại
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </Page>
  );
}
