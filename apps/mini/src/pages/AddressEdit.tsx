import React, { useEffect, useMemo, useState } from "react";
// (bỏ react-router-dom – dùng location.*)

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

export default function AddressEdit() {
  const params = new URLSearchParams(location.search);
  const id = params.get("id") || "";
  const returnUrl = params.get("return") || "/checkout";


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

  // load when editing
  useEffect(() => {
    let abort = false;
    (async () => {
      if (!id) return;
      setLoading(true);
      try {
        const r = await fetch(
          `https://api.shophuyvan.vn/api/addresses?id=${encodeURIComponent(id)}`,
          { credentials: "include" }
        );
        const data = await r.json();
        const a = Array.isArray(data?.data) ? data.data[0] : data?.data;
        if (!abort && a) setForm({ ...form, ...a });
      } catch (e) {
        console.error("[AddressEdit] load failed", e);
      } finally {
        if (!abort) setLoading(false);
      }
    })();
    return () => {
      abort = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const pasteSmart = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (!text) return;

      // tách SĐT
      const phone = phoneFrom(text);

      // tách tên (chuỗi trước số ĐT nếu có)
      const maybeName = text.split(phone)[0]?.trim() || "";

      // tách địa chỉ phần sau
      const after = text.split(phone)[1]?.trim() || text.trim();

      setForm((s) => ({
        ...s,
        name: s.name || maybeName,
        phone: s.phone || phone,
        address: s.address || after,
      }));
    } catch (e) {
      console.warn("Không đọc được clipboard:", e);
    }
  };

  const save = async () => {
    if (!canSubmit) return;
    setSaving(true);
    try {
      const method = id ? "PUT" : "POST";
      const r = await fetch("https://api.shophuyvan.vn/api/addresses", {
        method,
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(form),
      });
      const data = await r.json();
            if (data?.success) {
        location.href = "/address?return=" + encodeURIComponent(returnUrl);
      } else {
        alert("Lưu địa chỉ thất bại");
      }
    } catch (e) {
      console.error("[AddressEdit] save failed", e);
      alert("Lưu địa chỉ thất bại");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-4">
      <div className="text-lg font-semibold mb-3">
        {id ? "Sửa địa chỉ" : "Địa chỉ mới"}
      </div>

      {/* Dán & nhập nhanh */}
      <div className="rounded-xl border p-3 bg-amber-50 mb-3">
        <div className="text-sm font-medium mb-2">
          Dán &amp; nhập nhanh (tự tách tên / SĐT / địa chỉ)
        </div>
        <div className="flex gap-2">
          <button
            className="px-3 py-2 rounded-lg bg-gray-100 text-gray-800 text-sm"
            onClick={pasteSmart}
          >
            Dán từ Clipboard
          </button>
        </div>
      </div>

      <div className="space-y-3">
        <input
          className="w-full border rounded-xl px-4 py-3"
          placeholder="Họ và tên"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />
        <input
          className="w-full border rounded-xl px-4 py-3"
          placeholder="Số điện thoại"
          value={form.phone}
          onChange={(e) => setForm({ ...form, phone: e.target.value })}
        />
        <textarea
          className="w-full border rounded-xl px-4 py-3"
          rows={3}
          placeholder="Địa chỉ (đường, phường/xã, quận/huyện, tỉnh/thành)"
          value={form.address}
          onChange={(e) => setForm({ ...form, address: e.target.value })}
        />
      </div>

      <div className="mt-4 space-y-2">
        <button
          disabled={!canSubmit || saving}
          className="w-full py-3 rounded-xl bg-rose-600 disabled:opacity-50 text-white font-medium"
          onClick={save}
        >
          {saving ? "Đang lưu…" : "Hoàn thành"}
        </button>
        <button
          className="w-full py-3 rounded-xl bg-gray-100 text-gray-800"
          onClick={() =>
  (location.href = "/address?return=" + encodeURIComponent(returnUrl))
        }
        >
          Huỷ
        </button>
      </div>
    </div>
  );
}
