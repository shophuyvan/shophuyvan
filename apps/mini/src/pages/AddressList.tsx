import React, { useEffect, useState } from "react";
import { useNavigate } from "zmp-ui";
import { storage } from "@/lib/storage";

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
  const navigate = useNavigate();
  
  const handleBack = () => {
    navigate('/account');
  };
  const params = new URLSearchParams(location.search);
  const returnUrl = params.get("return") || "/checkout";

  const [items, setItems] = useState<Address[]>([]);
  const [loading, setLoading] = useState(true);

    useEffect(() => {
    let abort = false;
    (async () => {
      try {
        setLoading(true);

        // Lấy token từ storage (thuần Mini)
        const token =
          (await storage.get<string>("customer_token")) ||
          (await storage.get<string>("x-customer-token")) ||
          (await storage.get<string>("x-token"));

        if (!token) {
          if (!abort) {
            setItems([]);
            setLoading(false);
          }
          return;
        }

        const r = await fetch("https://api.shophuyvan.vn/api/addresses", {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          credentials: "include",
        });

        const data = await r.json();
        const rawList = data?.addresses || data?.data;
        if (!abort) setItems(Array.isArray(rawList) ? rawList : []);
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
    navigate(returnUrl || "/checkout");
  };

  const edit = (addr?: Address) => {
    const q = new URLSearchParams();
    if (addr?.id) q.set("id", addr.id);
    q.set("return", returnUrl);
    navigate(`/address/edit?${q.toString()}`);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b px-4 py-3 flex items-center gap-3 sticky top-0">
        <button onClick={handleBack} className="p-1 hover:bg-gray-100 rounded-full">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-lg font-semibold">Chọn địa chỉ nhận hàng</h1>
      </div>
      
      <div className="p-4">

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
    </div>
  );
}