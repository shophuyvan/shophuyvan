import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "zmp-ui";
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

  const [token, setToken] = useState<string>("");
  const [form, setForm] = useState<AddressForm>({
    name: "",
    phone: "",
    address: "",
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const canSubmit = useMemo(
    () => !!form.name && !!phoneFrom(form.phone) && !!form.address,
    [form]
  );

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
           `${API_BASE}/api/addresses?id=${encodeURIComponent(id)}`,
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

  // ===== RENDER ================================================================
  return (
    <div className="p-4 space-y-4">
      <div className="text-lg font-semibold">
        {id ? "Sửa địa chỉ" : "Thêm địa chỉ mới"}
      </div>

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
              <input
                className="w-full border rounded-lg px-3 py-2"
                value={form.phone}
                onChange={(e) =>
                  setForm((s) => ({ ...s, phone: e.target.value }))
                }
                placeholder="Ví dụ: 09xxxxxxxx"
                inputMode="tel"
              />
            </div>

            <div>
              <label className="block text-sm mb-1">Địa chỉ chi tiết</label>
              <textarea
                className="w-full border rounded-lg px-3 py-2"
                value={form.address}
                onChange={(e) =>
                  setForm((s) => ({ ...s, address: e.target.value }))
                }
                placeholder="Số nhà, đường, phường/xã, quận/huyện, tỉnh/thành…"
                rows={3}
              />
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
