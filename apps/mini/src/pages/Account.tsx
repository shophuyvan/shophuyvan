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

interface Address {
  id: string;
  name: string;
  phone: string;
  province_code: string;
  province_name: string;
  district_code: string;
  district_name: string;
  ward_code: string;
  ward_name: string;
  address: string;
  address_type: string;
  is_default: boolean;
  note: string;
}

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
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [editingAddress, setEditingAddress] = useState<Address | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    province_code: '',
    province_name: '',
    district_code: '',
    district_name: '',
    ward_code: '',
    ward_name: '',
    address: '',
    address_type: 'home',
    note: ''
  });
  const [provinces, setProvinces] = useState<any[]>([]);
  const [districts, setDistricts] = useState<any[]>([]);
  const [wards, setWards] = useState<any[]>([]);

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
    loadAddresses();
    loadProvinces();
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
      if (data.customer) {
        setCustomer(data.customer);
      }
    } catch (e: any) {
      console.error('Load customer error:', e);
      setError(e.message);
    }
  };

  const loadAddresses = async () => {
    try {
      const data = await api('/api/addresses');
      setAddresses(data.addresses || []);
    } catch (e: any) {
      console.error('Load addresses error:', e);
    } finally {
      setLoading(false);
    }
  };

  const loadProvinces = async () => {
    try {
      const data = await api('/shipping/provinces');
      setProvinces(data.items || []);
    } catch (e) {
      console.error('Load provinces error:', e);
    }
  };

  const loadDistricts = async (provinceCode: string) => {
    try {
      const data = await api(`/shipping/districts?province_code=${encodeURIComponent(provinceCode)}`);
      setDistricts(data.items || []);
    } catch (e) {
      console.error('Load districts error:', e);
    }
  };

  const loadWards = async (districtCode: string) => {
    try {
      const data = await api(`/shipping/wards?district_code=${encodeURIComponent(districtCode)}`);
      setWards(data.items || []);
    } catch (e) {
      console.error('Load wards error:', e);
    }
  };

  const handleProvinceChange = (code: string) => {
    const province = provinces.find(p => p.code === code);
    setFormData({
      ...formData,
      province_code: code,
      province_name: province?.name || '',
      district_code: '',
      district_name: '',
      ward_code: '',
      ward_name: ''
    });
    setDistricts([]);
    setWards([]);
    if (code) loadDistricts(code);
  };

  const handleDistrictChange = (code: string) => {
    const district = districts.find(d => d.code === code);
    setFormData({
      ...formData,
      district_code: code,
      district_name: district?.name || '',
      ward_code: '',
      ward_name: ''
    });
    setWards([]);
    if (code) loadWards(code);
  };

  const handleWardChange = (code: string) => {
    const ward = wards.find(w => w.code === code);
    setFormData({
      ...formData,
      ward_code: code,
      ward_name: ward?.name || ''
    });
  };

  const handleSaveAddress = async () => {
    if (!formData.name || !formData.phone || !formData.province_code || !formData.address) {
      alert('Vui lòng điền đầy đủ thông tin');
      return;
    }

    try {
      if (editingAddress) {
        await api(`/api/addresses/${editingAddress.id}`, {
      method: 'PUT',
      body: JSON.stringify(formData)
    });
    toast('Cập nhật địa chỉ thành công'); // ✅ Chuẩn Mini App
  } else {
    await api('/api/addresses', {
      method: 'POST',
      body: JSON.stringify(formData)
    });
    toast('Thêm địa chỉ thành công'); // ✅ Chuẩn Mini App
  }
      setShowAddressForm(false);
      setEditingAddress(null);
      setFormData({
        name: '',
        phone: '',
        province_code: '',
        province_name: '',
        district_code: '',
        district_name: '',
        ward_code: '',
        ward_name: '',
        address: '',
        address_type: 'home',
        note: ''
      });
      loadAddresses();
    } catch (e: any) {
      alert('Lỗi: ' + e.message);
    }
  };

  const handleEditAddress = (address: Address) => {
    setEditingAddress(address);
    setFormData({
      name: address.name,
      phone: address.phone,
      province_code: address.province_code,
      province_name: address.province_name,
      district_code: address.district_code,
      district_name: address.district_name,
      ward_code: address.ward_code,
      ward_name: address.ward_name,
      address: address.address,
      address_type: address.address_type,
      note: address.note
    });
    setShowAddressForm(true);
    if (address.province_code) {
      loadDistricts(address.province_code);
      if (address.district_code) {
        loadWards(address.district_code);
      }
    }
  };

  const handleDeleteAddress = async (id: string) => {
// ✅ Chuẩn Mini App: Dùng zmp.dialog.confirm
zmp.dialog.confirm({
  title: 'Xác nhận',
  message: 'Bạn có chắc muốn xóa địa chỉ này?',
  onConfirm: async () => {
    try {
      await api(`/api/addresses/${id}`, { method: 'DELETE' });
      toast('Xóa địa chỉ thành công'); // ✅ Dùng toast
      loadAddresses();
    } catch (e: any) {
      alert('Lỗi: ' + e.message, 'Lỗi'); // ✅ Dùng alert hook
    }
  },
});
};

  const handleSetDefault = async (id: string) => {
    try {
      await api(`/api/addresses/${id}/default`, { method: 'PUT' });
      loadAddresses();
    } catch (e: any) {
      alert('Lỗi: ' + e.message);
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
// ✅ Chuẩn Mini App: Bọc trong Page
<Page className="bg-gray-50">
  {/* ✅ Chuẩn Mini App: Dùng Header chuẩn, tự có nút back */}
  <Header title="Tài khoản của tôi" showBackIcon={true} />

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
              <p className="font-semibold text-blue-600 capitalize">{customer.tier}</p>
            </div>
          </div>
        )}

        {/* Addresses */}
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold">📍 Số địa chỉ ({addresses.length})</h2>
            <button
              onClick={() => {
                setEditingAddress(null);
                setFormData({
                  name: '',
                  phone: '',
                  province_code: '',
                  province_name: '',
                  district_code: '',
                  district_name: '',
                  ward_code: '',
                  ward_name: '',
                  address: '',
                  address_type: 'home',
                  note: ''
                });
                setShowAddressForm(true);
              }}
              className="bg-blue-600 text-white px-3 py-1 rounded-lg text-sm font-semibold hover:bg-blue-700"
            >
              + Thêm
            </button>
          </div>

          {addresses.length === 0 ? (
            <p className="text-gray-500 text-center py-4">Chưa có địa chỉ nào</p>
          ) : (
            <div className="space-y-2">
              {addresses.map(addr => (
                <div key={addr.id} className="border rounded-lg p-3 relative">
                  {addr.is_default && (
                    <span className="absolute top-2 right-2 bg-green-100 text-green-700 text-xs px-2 py-1 rounded">
                      Mặc định
                    </span>
                  )}
                  <p className="font-semibold">{addr.name} - {addr.phone}</p>
                  <p className="text-sm text-gray-600">
                    {addr.address}, {addr.ward_name}, {addr.district_name}, {addr.province_name}
                  </p>
                  {addr.note && <p className="text-xs text-gray-500 mt-1">Ghi chú: {addr.note}</p>}
                  <div className="flex gap-2 mt-2">
                    <button
                      onClick={() => handleEditAddress(addr)}
                      className="flex-1 bg-blue-100 text-blue-600 py-1 rounded text-sm font-medium hover:bg-blue-200"
                    >
                      Sửa
                    </button>
                    <button
                      onClick={() => handleDeleteAddress(addr.id)}
                      className="flex-1 bg-red-100 text-red-600 py-1 rounded text-sm font-medium hover:bg-red-200"
                    >
                      Xóa
                    </button>
                    {!addr.is_default && (
                      <button
                        onClick={() => handleSetDefault(addr.id)}
                        className="flex-1 bg-gray-100 text-gray-600 py-1 rounded text-sm font-medium hover:bg-gray-200"
                      >
                        Đặt mặc định
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Address Form Modal */}
        {showAddressForm && (
          <div className="fixed inset-0 bg-black/50 flex items-end z-50">
            <div className="w-full bg-white rounded-t-2xl p-4 max-h-[90vh] overflow-y-auto">
              <h3 className="text-lg font-bold mb-4">
                {editingAddress ? 'Sửa địa chỉ' : 'Thêm địa chỉ mới'}
              </h3>

              <div className="space-y-3">
                <input
                  type="text"
                  placeholder="Tên người nhận *"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                />

                <input
                  type="tel"
                  placeholder="Số điện thoại *"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                />

                <select
                  value={formData.province_code}
                  onChange={(e) => handleProvinceChange(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                >
                  <option value="">Chọn Tỉnh/Thành phố *</option>
                  {provinces.map(p => (
                    <option key={p.code} value={p.code}>{p.name}</option>
                  ))}
                </select>

                {formData.province_code && (
                  <select
                    value={formData.district_code}
                    onChange={(e) => handleDistrictChange(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  >
                    <option value="">Chọn Quận/Huyện *</option>
                    {districts.map(d => (
                      <option key={d.code} value={d.code}>{d.name}</option>
                    ))}
                  </select>
                )}

                {formData.district_code && (
                  <select
                    value={formData.ward_code}
                    onChange={(e) => handleWardChange(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  >
                    <option value="">Chọn Phường/Xã *</option>
                    {wards.map(w => (
                      <option key={w.code} value={w.code}>{w.name}</option>
                    ))}
                  </select>
                )}

                <input
                  type="text"
                  placeholder="Địa chỉ chi tiết (số nhà, tên đường) *"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                />

                <select
                  value={formData.address_type}
                  onChange={(e) => setFormData({ ...formData, address_type: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                >
                  <option value="home">Nhà riêng</option>
                  <option value="office">Cơ quan</option>
                  <option value="other">Khác</option>
                </select>

                <input
                  type="text"
                  placeholder="Ghi chú (VD: giao lúc 9-11h sáng)"
                  value={formData.note}
                  onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                />

                <div className="flex gap-2 pt-4">
                  <button
                    onClick={() => setShowAddressForm(false)}
                    className="flex-1 bg-gray-200 text-gray-700 py-3 rounded-lg font-semibold hover:bg-gray-300"
                  >
                    Hủy
                  </button>
                  <button
                    onClick={handleSaveAddress}
                    className="flex-1 bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700"
                  >
                    Lưu
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

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