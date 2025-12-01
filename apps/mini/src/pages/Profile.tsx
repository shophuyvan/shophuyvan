import React, { useEffect, useState } from "react";
import { Page, useNavigate } from "zmp-ui";
import { getUserInfo } from "zmp-sdk/apis"; // ✅ API Zalo
import { storage } from "@/lib/storage";
import { zmp } from "@/lib/zmp";

const API_BASE = "https://api.shophuyvan.vn";

export default function Profile() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [token, setToken] = useState("");
  
  // Form data
  const [formData, setFormData] = useState({
    full_name: "",
    phone: "",
    email: "",
    zalo_name: "",
    zalo_avatar: ""
  });

  // Load Token
  useEffect(() => {
    (async () => {
      const t = await storage.get<string>("customer_token") || 
                await storage.get<string>("x-customer-token");
      if (t) {
        setToken(t);
        loadProfile(t);
      } else {
        setLoading(false);
      }
    })();
  }, []);

  // Load dữ liệu khách hàng
  const loadProfile = async (authToken: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/customers/me`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      const data = await res.json();
      const c = data.customer || data.data || {};
      
      setFormData({
        full_name: c.full_name || "",
        phone: c.phone || "",
        email: c.email || "",
        zalo_name: c.zalo_name || "",
        zalo_avatar: c.zalo_avatar || ""
      });
    } catch (e) {
      console.error("Load profile err:", e);
    } finally {
      setLoading(false);
    }
  };

  // ✅ Hàm Đồng bộ thông tin từ Zalo (Tên & Avatar)
  const syncZaloProfile = async () => {
    try {
      const { userInfo } = await getUserInfo({ avatarType: "normal" });
      if (userInfo) {
        setFormData(prev => ({
          ...prev,
          full_name: userInfo.name || prev.full_name, // Ưu tiên tên Zalo nếu tên cũ trống
          zalo_name: userInfo.name,
          zalo_avatar: userInfo.avatar
        }));
        zmp.toast.show({ content: "Đã lấy thông tin từ Zalo!", duration: 2000 });
      }
    } catch (error) {
      console.error("Sync Zalo error:", error);
      zmp.toast.show({ content: "Lỗi đồng bộ Zalo", duration: 2000 });
    }
  };

  // Lưu thay đổi
  const handleSave = async () => {
    if (!token) return;
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/api/customers/profile`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      });
      
      if (res.ok) {
        zmp.toast.show({ content: "Cập nhật thành công!", duration: 2000 });
        navigate("/account"); // Quay về trang Account
      } else {
        zmp.toast.show({ content: "Lỗi cập nhật", duration: 2000 });
      }
    } catch (e) {
      zmp.toast.show({ content: "Có lỗi xảy ra", duration: 2000 });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Page className="bg-gray-50 min-h-screen">
      <div className="bg-white sticky top-0 border-b px-4 py-3 flex items-center gap-3 z-10">
        <button onClick={() => navigate(-1)} className="p-1 hover:bg-gray-100 rounded-full">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        </button>
        <h1 className="text-lg font-semibold">Thông tin cá nhân</h1>
      </div>

      <div className="p-4 space-y-4">
        {/* Avatar Section */}
        <div className="flex flex-col items-center gap-3 py-4">
          <div className="w-20 h-20 rounded-full bg-gray-200 overflow-hidden border-2 border-white shadow">
            {formData.zalo_avatar ? (
              <img src={formData.zalo_avatar} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-2xl text-gray-500">
                {(formData.full_name || "U").charAt(0).toUpperCase()}
              </div>
            )}
          </div>
          <button 
            type="button"
            onClick={syncZaloProfile}
            className="text-sm text-blue-600 font-medium flex items-center gap-1 bg-blue-50 px-3 py-1.5 rounded-full"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
            Đồng bộ từ Zalo
          </button>
        </div>

        {/* Form */}
        <div className="bg-white rounded-xl p-4 shadow-sm space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Họ và tên</label>
            <input 
              value={formData.full_name}
              onChange={e => setFormData({...formData, full_name: e.target.value})}
              className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="Nhập họ tên"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Số điện thoại</label>
            <input 
              value={formData.phone}
              disabled
              className="w-full border rounded-lg px-3 py-2 bg-gray-100 text-gray-500"
              placeholder="Chưa liên kết SĐT"
            />
            <p className="text-xs text-gray-400 mt-1">* SĐT được quản lý qua liên kết Zalo</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input 
              value={formData.email}
              onChange={e => setFormData({...formData, email: e.target.value})}
              className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="example@gmail.com"
              inputMode="email"
            />
          </div>
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full py-3 bg-rose-600 text-white rounded-xl font-bold shadow-lg hover:bg-rose-700 transition-all disabled:opacity-70"
        >
          {saving ? "Đang lưu..." : "Cập nhật thông tin"}
        </button>
      </div>
    </Page>
  );
}