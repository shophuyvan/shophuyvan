import React, { useEffect, useState } from 'react';
import Header from '../components/Header';
import Footer from '../components/Footer';

interface OrderItem {
  id: string;
  product_name: string;
  quantity: number;
  price: number;
  image?: string;
}

interface Order {
  id: string;
  order_number?: string;
  status: string;
  total: number;
  created_at: string;
  items: OrderItem[];
  shipping_address?: string;
  payment_method?: string;
}

const OrderHistory: React.FC = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<string>('all'); // all, pending, shipping, completed

  useEffect(() => {
    loadOrders();
  }, []);

  const loadOrders = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('x-token') || '';
      
      // Thử nhiều endpoint
      const endpoints = [
        '/orders/my',
        '/customer/orders',
        '/public/orders/my',
        '/api/orders/customer'
      ];

      let response = null;
      for (const endpoint of endpoints) {
        try {
          const API_BASE = 'https://api.shophuyvan.vn';
          const res = await fetch(`${API_BASE}${endpoint}`, {
            headers: {
              'x-token': token,
              'Content-Type': 'application/json'
            }
          });
          
          if (res.ok) {
            const data = await res.json();
            response = data;
            break;
          }
        } catch (e) {
          continue;
        }
      }

      if (response) {
        const orderList = response.orders || response.items || response.data || [];
        setOrders(orderList);
      } else {
        setError('Chưa đăng nhập hoặc không có đơn hàng');
      }
    } catch (err) {
      setError('Không thể tải đơn hàng');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    const s = status.toLowerCase();
    if (s.includes('pending') || s.includes('cho')) return 'text-orange-600 bg-orange-50';
    if (s.includes('shipping') || s.includes('giao')) return 'text-blue-600 bg-blue-50';
    if (s.includes('completed') || s.includes('hoan')) return 'text-green-600 bg-green-50';
    if (s.includes('cancelled') || s.includes('huy')) return 'text-red-600 bg-red-50';
    return 'text-gray-600 bg-gray-50';
  };

  const getStatusText = (status: string) => {
    const s = status.toLowerCase();
    if (s.includes('pending') || s.includes('cho')) return 'Chờ xác nhận';
    if (s.includes('shipping') || s.includes('giao')) return 'Đang giao hàng';
    if (s.includes('completed') || s.includes('hoan')) return 'Hoàn thành';
    if (s.includes('cancelled') || s.includes('huy')) return 'Đã hủy';
    return status;
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND'
    }).format(price);
  };

  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('vi-VN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dateStr;
    }
  };

  const filteredOrders = orders.filter(order => {
    if (filter === 'all') return true;
    const s = order.status.toLowerCase();
    if (filter === 'pending') return s.includes('pending') || s.includes('cho');
    if (filter === 'shipping') return s.includes('shipping') || s.includes('giao');
    if (filter === 'completed') return s.includes('completed') || s.includes('hoan');
    return true;
  });

  return (
    <div className="pb-24 bg-gray-50 min-h-screen">
      <Header />
      
      <div className="safe-x my-4">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold text-gray-900">Đơn hàng của tôi</h1>
          <button 
            onClick={loadOrders}
            className="text-blue-600 text-sm"
          >
            🔄 Làm mới
          </button>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
          {[
            { key: 'all', label: 'Tất cả' },
            { key: 'pending', label: 'Chờ xác nhận' },
            { key: 'shipping', label: 'Đang giao' },
            { key: 'completed', label: 'Hoàn thành' }
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                filter === tab.key
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-600 hover:bg-gray-100'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Loading state */}
        {loading && (
          <div className="text-center py-12">
            <div className="inline-block w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            <p className="mt-2 text-gray-600">Đang tải...</p>
          </div>
        )}

        {/* Error state */}
        {error && !loading && (
          <div className="brand-card p-6 text-center">
            <div className="text-4xl mb-2">😕</div>
            <p className="text-gray-600">{error}</p>
            <button
              onClick={loadOrders}
              className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-lg"
            >
              Thử lại
            </button>
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && filteredOrders.length === 0 && (
          <div className="brand-card p-6 text-center">
            <div className="text-4xl mb-2">📦</div>
            <p className="text-gray-600 mb-4">Chưa có đơn hàng nào</p>
            <a
              href="/"
              className="inline-block px-6 py-2 bg-blue-600 text-white rounded-lg"
            >
              Mua sắm ngay
            </a>
          </div>
        )}

        {/* Orders list */}
        {!loading && filteredOrders.length > 0 && (
          <div className="space-y-3">
            {filteredOrders.map(order => (
              <div key={order.id} className="brand-card overflow-hidden">
                {/* Order header */}
                <div className="p-4 bg-gray-50 border-b flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-900">
                      Đơn hàng #{order.order_number || order.id.slice(0, 8)}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {formatDate(order.created_at)}
                    </p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(order.status)}`}>
                    {getStatusText(order.status)}
                  </span>
                </div>

                {/* Order items */}
                <div className="p-4 space-y-3">
                  {order.items?.map((item, idx) => (
                    <div key={idx} className="flex gap-3">
                      <div className="w-16 h-16 flex-shrink-0 bg-gray-100 rounded-lg overflow-hidden">
                        {item.image ? (
                          <img
                            src={item.image}
                            alt={item.product_name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-gray-400">
                            📦
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {item.product_name}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          x{item.quantity}
                        </p>
                        <p className="text-sm font-semibold text-blue-600 mt-1">
                          {formatPrice(item.price * item.quantity)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Order footer */}
                <div className="p-4 bg-gray-50 border-t flex items-center justify-between">
                  <div className="text-sm">
                    <span className="text-gray-600">Tổng cộng: </span>
                    <span className="font-bold text-blue-600 text-lg">
                      {formatPrice(order.total)}
                    </span>
                  </div>
                  <button
                    onClick={() => {
                      // Navigate to order detail (implement later)
                      alert(`Chi tiết đơn hàng #${order.id}`);
                    }}
                    className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Xem chi tiết
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Footer />
    </div>
  );
};

export default OrderHistory;
