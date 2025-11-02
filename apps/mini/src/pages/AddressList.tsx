import React, { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";

type Address = {
  id: string;
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

const LS_KEY_SELECTED = "address:selected";

export default function AddressList() {
  const nav = useNavigate();
  const { search } = useLocation();
  const params = new URLSearchParams(search);
  const returnUrl = params.get("return") || "/checkout";

  const [items, setItems] = useState<Address[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let abort = false;
    (async () => {
      try {
        setLoading(true);
        const r = await fetch("https://api.shophuyvan.vn/api/addresses", {
          credentials: "include",
        });
        const data = await r.json();
        if (!abort) setItems(Array.isArray(data?.data) ? data.data : []);
      } catch (e) {
        console.error("[AddressList] load failed", e);
        if (!abort) setItems([]);
      } finally {
        if (!abort) setLoading(false);
      }
    })();
    return () => {
      abort = true;
    };
  }, []);

  const select = (addr: Address) => {
    localStorage.setItem(LS_KEY_SELECTED, JSON.stringify(addr));
    nav(returnUrl, { replace: true });
  };

  const edit = (addr?: Address) => {
    const q = new URLSearchParams();
    if (addr?.id) q.set("id", addr.id);
    q.set("return", returnUrl);
    nav(`/address/edit?${q.toString()}`);
  };

  return (
    <div className="p-4">
      <div className="text-lg font-semibold mb-3">Chọn địa chỉ nhận hàng</div>

      {loading ? (
        <div className="text-gray-500">Đang tải…</div>
      ) : items.length === 0 ? (
        <div className="text-gray-500 mb-3">Chưa có địa chỉ.</div>
      ) : (
        <div className="space-y-3">
          {items.map((a) => (
            <div
              key={a.id}
              className="rounded-xl border p-3 bg-white shadow-sm"
            >
              <div className="flex items-center justify-between">
                <div className="font-semibold">
                  {a.name} <span className="text-gray-500">| {a.phone}</span>
                </div>
                {a.is_default ? (
                  <span className="text-xs px-2 py-1 rounded bg-green-100 text-green-700">
                    Mặc định
                  </span>
                ) : null}
              </div>
              <div className="text-sm text-gray-700 mt-1">
                {a.address}
                {", "}
                {a.ward_name ? a.ward_name + ", " : ""}
                {a.district_name ? a.district_name + ", " : ""}
                {a.province_name || ""}
              </div>
              <div className="flex gap-2 mt-3">
                <button
                  className="px-3 py-2 rounded-lg bg-blue-600 text-white text-sm"
                  onClick={() => select(a)}
                >
                  Dùng địa chỉ này
                </button>
                <button
                  className="px-3 py-2 rounded-lg bg-gray-100 text-gray-800 text-sm"
                  onClick={() => edit(a)}
                >
                  Sửa
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-4">
        <button
          className="w-full py-3 rounded-xl bg-rose-600 text-white font-medium"
          onClick={() => edit(undefined)}
        >
          + Thêm địa chỉ mới
        </button>
      </div>
    </div>
  );
}
