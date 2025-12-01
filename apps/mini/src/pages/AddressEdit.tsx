import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "zmp-ui";
import { getPhoneNumber, getLocation } from "zmp-sdk/apis";
import { storage } from "../lib/storage";

// Form địa chỉ đơn giản – có thể mở rộng thêm nếu cần
type AddressForm = {
  id?: string;
  name: string;
  phone: string;
  address: string;
  province_name?: string;
  district_name?: string;
  ward_name?: string;
  province_code?: string;
  district_code?: string;
  ward_code?: string;
  is_default?: boolean;
};

const phoneFrom = (s: string) => (s || "").replace(/\D/g, "").slice(-10);
const LS_KEY_SELECTED = "address:selected";

const API_BASE = "https://api.shophuyvan.vn";

export default function AddressEdit() {
  const navigate = useNavigate();
  const params = new URLSearchParams(location.search);
  const id = params.get("id") || "";
  const returnUrl = params.get("return") || "/checkout";
  const quickName = params.get("name") || "";
  const quickPhone = params.get("phone") || "";
  const quickAddress = params.get("address") || "";

  const [token, setToken] = useState<string>("");
  const [form, setForm] = useState<AddressForm>({
    name: quickName,
    phone: quickPhone,
    address: quickAddress,
  });

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [areas, setAreas] = useState<any[]>([]);
  const [selectedProvince, setSelectedProvince] = useState("");
  const [selectedDistrict, setSelectedDistrict] = useState("");
  const [selectedWard, setSelectedWard] = useState("");

  // Map selected codes to form
  useEffect(() => {
    const province = areas.find(p => p.code === selectedProvince);
    const district = province?.districts?.find((d: any) => d.code === selectedDistrict);
    
    setForm(prev => ({
      ...prev,
      province_code: selectedProvince,
      province_name: province?.name || "",
      district_code: selectedDistrict,
      district_name: district?.name || "",
      ward_code: selectedWard,
      ward_name: "", // Will be filled from communes if needed
    }));
  }, [selectedProvince, selectedDistrict, selectedWard, areas]);

  const districts = areas.find(p => p.code === selectedProvince)?.districts || [];
  
  const canSubmit = useMemo(
    () => !!form.name && !!phoneFrom(form.phone) && !!form.address && 
          !!selectedProvince && !!selectedDistrict && !!selectedWard,
    [form, selectedProvince, selectedDistrict, selectedWard]
  );

  // ===== LOAD AREAS =============================================================
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`${API_BASE}/public/shipping/areas`);
        const data = await r.json();
        setAreas(data?.areas || data?.data || []);
      } catch (e) {
        console.error("[AddressEdit] load areas failed", e);
      }
    })();
  }, []);

  // ===== LOAD TOKEN =============================================================
  useEffect(() => {
    (async () => {
      try {
        const tokens = await Promise.all([
          storage.get("customer_token"),
          storage.get("x-customer-token"),
          storage.get("x-token"),
        ]);
        const t = tokens.find(Boolean) || "";
        setToken(t);
      } catch (e) {
        console.error("[AddressEdit] load token failed", e);
      }
    })();
  }, []);

  // ===== LOAD ĐỊA CHỈ KHI SỬA ====================================================
  useEffect(() => {
    let abort = false;
    (async () => {
      if (!id || !token) return;
      setLoading(true);
      try {
        const r = await fetch(
         `${API_BASE}/api/addresses/${encodeURIComponent(id)}`,
         {
           credentials: "include",
           headers: {
             Authorization: `Bearer ${token}`,
           },
         }
       );


        const data = await r.json();
        const a = Array.isArray(data?.data) ? data.data[0] : data?.data;
        if (!abort && a) {
          setForm((prev) => ({
            ...prev,
            ...a,
          }));
        }
      } catch (e) {
        console.error("[AddressEdit] load failed", e);
        alert("Không tải được địa chỉ, vui lòng thử lại.");
      } finally {
        if (!abort) setLoading(false);
      }
    })();

    return () => {
      abort = true;
    };
  }, [id, token]);

  // ===== DÁN THÔNG MINH TỪ CLIPBOARD ============================================
  const pasteSmart = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (!text) return;

      // tách SĐT
      const phone = phoneFrom(text);

      // tách tên (chuỗi trước số ĐT nếu có)
      const maybeName = phone ? text.split(phone)[0]?.trim() || "" : "";

      // tách địa chỉ phần sau
      const after = phone
        ? text.split(phone)[1]?.trim() || text.trim()
        : text.trim();

      setForm((s) => ({
        ...s,
        name: s.name || maybeName,
        phone: s.phone || phone,
        address: s.address || after,
      }));
    } catch (e) {
      console.warn("Không đọc được clipboard:", e);
      alert("Không đọc được nội dung clipboard.");
    }
  };

  // ===== LƯU ĐỊA CHỈ ============================================================
  const save = async () => {
    if (!canSubmit || saving) return;
    
    if (!token) {
      alert("Vui lòng đăng nhập để lưu địa chỉ.");
      return;
    }

    setSaving(true);
    try {
      const method = id ? "PUT" : "POST";
      const url =
      `${API_BASE}/api/addresses` +
      (id ? `/${encodeURIComponent(id)}` : "");
    
    const res = await fetch(url, {
      method,
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(form),
    });

      const data = await res.json();

      if (!res.ok) {
        console.error("[AddressEdit] save failed", data);
        alert(data?.message || "Không lưu được địa chỉ, vui lòng thử lại.");
        return;
      }

      // Lưu lại địa chỉ vừa tạo/cập nhật để Checkout tự fill
      const saved =
        data?.data || {
          ...form,
          id: id || data?.id,
        };

      try {
        localStorage.setItem(LS_KEY_SELECTED, JSON.stringify(saved));
      } catch (e) {
        console.warn("Không set được address:selected", e);
      }

            // Quay về trang trước (mặc định: /checkout)
      if (returnUrl) {
        navigate(returnUrl);
      } else {
        navigate("/checkout");
      }
    } catch (e) {
      console.error("[AddressEdit] save error", e);
      alert("Có lỗi khi lưu địa chỉ.");
    } finally {
      setSaving(false);
    }
  };

  // Quick input handler
  const quickInput = () => {
    const nameEl = document.getElementById('quick-name') as HTMLInputElement;
    const phoneEl = document.getElementById('quick-phone') as HTMLInputElement;
    const addressEl = document.getElementById('quick-address') as HTMLTextAreaElement;
    
    if (!nameEl?.value || !phoneEl?.value || !addressEl?.value) {
      alert('Vui lòng nhập đầy đủ thông tin');
      return;
    }
    
    const fullAddress = addressEl.value;
    
    // Parse địa chỉ cơ bản
    let province = '';
    let district = '';
    let ward = '';
    let street = fullAddress;
    
    // Tìm TP/Tỉnh
    if (/hồ chí minh|hcm|sài gòn|tp\.hcm/i.test(fullAddress)) {
      province = 'Hồ Chí Minh';
      street = street.replace(/(?:tp\.?|thành phố)?\s*(?:hồ chí minh|hcm|sài gòn)/gi, '');
    }
    
    // Tìm Quận/Huyện
    const districtMatch = fullAddress.match(/(?:quận|q\.|huyện|h\.)\s*([^,]+)/i);
    if (districtMatch) {
      district = districtMatch[1].trim();
      street = street.replace(districtMatch[0], '');
    }
    
    // Tìm Phường/Xã
    const wardMatch = fullAddress.match(/(?:phường|p\.|xã|x\.)\s*([^,]+)/i);
    if (wardMatch) {
      ward = wardMatch[1].trim();
      street = street.replace(wardMatch[0], '');
    }
    
    // Clean up street address
    street = street.replace(/,+/g, ',').replace(/^,|,$/g, '').trim();
    
    // Update form
    setForm(s => ({
      ...s,
      name: nameEl.value,
      phone: phoneEl.value,
      address: street || fullAddress,
      province_name: province,
      district_name: district,
      ward_name: ward
    }));
    
    // Clear quick inputs
    nameEl.value = '';
    phoneEl.value = '';
    addressEl.value = '';
  };

  // ===== ZALO APIS & PERMISSIONS =====
  const [gettingPhone, setGettingPhone] = useState(false);
  const [gettingLocation, setGettingLocation] = useState(false);

  const handleGetZaloPhone = async () => {
    try {
      setGettingPhone(true);
      const data = await getPhoneNumber({});
      const token = data.token;
      
      if (token) {
        // Lưu ý: Token này cần gửi về Backend để giải mã thành số điện thoại thực.
        // Tạm thời hiển thị thông báo thành công để xác nhận quyền đã hoạt động.
        console.log("Zalo Phone Token:", token);
        alert("Đã lấy được quyền SĐT! (Cần Backend để giải mã token này)");
        
        // Nếu có API giải mã, bạn sẽ gọi ở đây:
        // const res = await fetch(API_BASE + '/auth/zalo-phone', { body: JSON.stringify({ token }) ... });
      }
    } catch (error) {
      console.error("Lỗi lấy SĐT Zalo:", error);
    } finally {
      setGettingPhone(false);
    }
  };

  const handleGetLocation = async () => {
    try {
      setGettingLocation(true);
      const { latitude, longitude } = await getLocation({});
      
      if (latitude && longitude) {
         // Sử dụng OpenStreetMap (Miễn phí) để chuyển tọa độ thành tên đường
         const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`);
         const data = await res.json();
         
         if (data && data.display_name) {
           setForm(prev => ({
             ...prev,
             address: data.display_name
           }));
           
           // Tự động đoán Tỉnh/Thành phố từ kết quả (nếu có)
           const city = data.address?.city || data.address?.state;
           if (city && areas.length > 0) {
              const foundProvince = areas.find(p => 
                city.toLowerCase().includes(p.name.toLowerCase()) || 
                p.name.toLowerCase().includes(city.toLowerCase())
              );
              if (foundProvince) {
                setSelectedProvince(foundProvince.code);
                // Reset quận/huyện để người dùng chọn lại cho chính xác
                setSelectedDistrict("");
                setSelectedWard("");
              }
           }
         }
      }
    } catch (error) {
      console.error("Lỗi lấy vị trí:", error);
      alert("Không lấy được vị trí. Vui lòng kiểm tra lại quyền GPS.");
    } finally {
      setGettingLocation(false);
    }
  };

  // ===== RENDER ================================================================
  return (
    <div className="p-4 space-y-4">
      <div className="text-lg font-semibold">
        {id ? "Sửa địa chỉ" : "Thêm địa chỉ mới"}
      </div>

      {/* Quick Input Box */}
      {!id && (
        <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-3 space-y-2">
          <div className="font-semibold text-blue-900">📝 Nhập nhanh địa chỉ</div>
          <input
            id="quick-name"
            className="w-full border rounded-lg px-3 py-2"
            placeholder="Họ và tên"
          />
          <input
            id="quick-phone"
            className="w-full border rounded-lg px-3 py-2"
            placeholder="Số điện thoại"
            inputMode="tel"
          />
          <textarea
            id="quick-address"
            className="w-full border rounded-lg px-3 py-2"
            placeholder="Địa chỉ đầy đủ (VD: 91/6 Liên Khu 5-11-12 Quận Bình Tân TP.HCM)"
            rows={2}
          />
          <button
            type="button"
            className="w-full px-4 py-2 rounded-lg bg-blue-600 text-white font-medium"
            onClick={quickInput}
          >
            Nhập nhanh
          </button>
        </div>
      )}

      {loading ? (
        <div className="text-gray-500">Đang tải địa chỉ…</div>
      ) : (
        <>
          <div className="space-y-3">
            <div>
              <label className="block text-sm mb-1">Họ tên</label>
              <input
                className="w-full border rounded-lg px-3 py-2"
                value={form.name}
                onChange={(e) =>
                  setForm((s) => ({ ...s, name: e.target.value }))
                }
                placeholder="Người nhận hàng"
              />
            </div>

            <div>
              <label className="block text-sm mb-1">Số điện thoại</label>
              <div className="flex gap-2">
                <input
                  className="w-full border rounded-lg px-3 py-2"
                  value={form.phone}
                  onChange={(e) =>
                    setForm((s) => ({ ...s, phone: e.target.value }))
                  }
                  placeholder="Ví dụ: 09xxxxxxxx"
                  inputMode="tel"
                />
                <button
                  type="button"
                  onClick={handleGetZaloPhone}
                  disabled={gettingPhone}
                  className="whitespace-nowrap px-3 py-2 rounded-lg bg-green-50 text-green-700 border border-green-200 text-sm font-medium hover:bg-green-100"
                >
                  {gettingPhone ? "Đang lấy..." : "Lấy SĐT Zalo"}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm mb-1">Tỉnh/Thành phố</label>
              <select
                className="w-full border rounded-lg px-3 py-2"
                value={selectedProvince}
                onChange={(e) => {
                  setSelectedProvince(e.target.value);
                  setSelectedDistrict("");
                  setSelectedWard("");
                }}
              >
                <option value="">Chọn Tỉnh/Thành phố</option>
                {areas.map(p => (
                  <option key={p.code} value={p.code}>{p.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm mb-1">Quận/Huyện</label>
              <select
                className="w-full border rounded-lg px-3 py-2"
                value={selectedDistrict}
                onChange={(e) => {
                  setSelectedDistrict(e.target.value);
                  setSelectedWard("");
                }}
                disabled={!selectedProvince}
              >
                <option value="">Chọn Quận/Huyện</option>
                {districts.map((d: any) => (
                  <option key={d.code} value={d.code}>{d.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm mb-1">Phường/Xã (tạm thời nhập tay)</label>
              <input
                className="w-full border rounded-lg px-3 py-2"
                value={selectedWard}
                onChange={(e) => setSelectedWard(e.target.value)}
                placeholder="Nhập mã phường/xã"
                disabled={!selectedDistrict}
              />
            </div>

            <div>
              <label className="block text-sm mb-1">Địa chỉ chi tiết</label>
              <div className="relative">
                <textarea
                  className="w-full border rounded-lg px-3 py-2 pb-8"
                  value={form.address}
                  onChange={(e) =>
                    setForm((s) => ({ ...s, address: e.target.value }))
                  }
                  placeholder="Số nhà, đường..."
                  rows={3}
                />
                <button
                  type="button"
                  onClick={handleGetLocation}
                  disabled={gettingLocation}
                  className="absolute right-2 bottom-2 px-2 py-1 rounded bg-blue-50 text-blue-600 text-xs font-medium border border-blue-100 hover:bg-blue-100 flex items-center gap-1"
                >
                  {gettingLocation ? (
                    <span>⏳ Đang định vị...</span>
                  ) : (
                    <>
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                      <span>Lấy vị trí hiện tại</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 pt-4">
            <button
              type="button"
              className="px-4 py-2 rounded-lg bg-rose-600 text-white font-medium disabled:opacity-60"
              disabled={!canSubmit || saving}
              onClick={save}
            >
              {saving ? "Đang lưu..." : "Lưu địa chỉ"}
            </button>

            <button
              type="button"
              className="px-4 py-2 rounded-lg bg-gray-100 text-gray-800"
              onClick={() => navigate(returnUrl || "/checkout")}
            >
              Hủy
            </button>

            <button
              type="button"
              className="px-4 py-2 rounded-lg bg-blue-100 text-blue-700"
              onClick={pasteSmart}
            >
              Dán thông minh
            </button>
          </div>
        </>
      )}
    </div>
  );
}
