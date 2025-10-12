import React, { useEffect, useMemo, useState, useCallback } from 'react';
import cart from '@shared/cart';
import { fmtVND } from '@shared/utils/fmtVND';

const API_BASE = import.meta.env.VITE_API_BASE;
const API_TOKEN = (import.meta.env.VITE_API_TOKEN || '');

const FALLBACK_PRICING = {
  'Viettel Post': [{limit:1000,price:18000},{limit:2000,price:23000},{limit:3000,price:28000},{limit:4000,price:33000},{limit:5000,price:38000},{limit:6000,price:43000}],
  'SPX Express': [{limit:1000,price:15000},{limit:2000,price:25000},{limit:3000,price:35000},{limit:4000,price:45000},{limit:5000,price:55000},{limit:6000,price:65000}],
  'J&T Express': [{limit:1000,price:20000},{limit:2000,price:20000},{limit:3000,price:25000},{limit:4000,price:23000},{limit:5000,price:35000},{limit:6000,price:40000}],
  'Lazada Express': [{limit:1000,price:19000},{limit:2000,price:19000},{limit:3000,price:19000},{limit:4000,price:23000},{limit:5000,price:27000},{limit:6000,price:31000}],
  'GHN': [{limit:1000,price:19000},{limit:2000,price:19000},{limit:3000,price:24000},{limit:4000,price:29000},{limit:5000,price:34000},{limit:6000,price:39000}],
  'BEST Express': [{limit:1000,price:18000},{limit:2000,price:18000},{limit:3000,price:18000},{limit:4000,price:23000},{limit:5000,price:28000},{limit:6000,price:33000}],
};
const CARRIER_ORDER = Object.keys(FALLBACK_PRICING);

// Memoize calculation
function calcFallbackFee(weightGram: number, carrier: string): number {
  const arr = FALLBACK_PRICING[carrier] || [];
  for (const step of arr) {
    if (weightGram <= step.limit) return step.price;
  }
  if (arr.length) {
    const last = arr[arr.length - 1];
    const extra = Math.ceil((weightGram - last.limit) / 500) * 5000;
    return last.price + Math.max(0, extra);
  }
  return 0;
}

// Cache cho API calls
const apiCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 phút

async function cachedFetch(url: string, options?: RequestInit): Promise<Response> {
  const cacheKey = `${url}-${JSON.stringify(options)}`;
  const cached = apiCache.get(cacheKey);
  
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return new Response(JSON.stringify(cached.data), { status: 200 });
  }
  
  const response = await fetch(url, options);
  if (response.ok) {
    const data = await response.json();
    apiCache.set(cacheKey, { data, timestamp: Date.now() });
  }
  
  return response;
}

export default function Checkout() {
  const [st, setSt] = useState(cart.get());
  const [form, setForm] = useState({ 
    name: '', 
    phone: '', 
    province: '', 
    district: '', 
    ward: '', 
    address: '' 
  });
  const [done, setDone] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [provinces, setProvinces] = useState<any[]>([]);
  const [districts, setDistricts] = useState<any[]>([]);
  const [wards, setWards] = useState<any[]>([]);

  const totalWeightGram = useMemo(
    () => st.lines.reduce((s, l) => s + (l.weight_gram ?? l.weight ?? 0) * (l.qty ?? 1), 0),
    [st]
  );

  const [shippingList, setShippingList] = useState<any[]>([]);
  const [shippingFee, setShippingFee] = useState(0);
  const [carrier, setCarrier] = useState('');

  const disabled = st.lines.length === 0 || submitting;

  // Load provinces một lần
  useEffect(() => {
    let isMounted = true;
    
    (async () => {
      try {
        const r = await cachedFetch(API_BASE + '/v1/platform/areas/province', {
          headers: { 'Authorization': 'Bearer ' + API_TOKEN }
        });
        if (r.ok && isMounted) {
          const js = await r.json();
          const arr = Array.isArray(js?.data) ? js.data : (Array.isArray(js) ? js : []);
          setProvinces(arr);
        }
      } catch (e) {
        console.error('Failed to load provinces:', e);
      }
    })();
    
    return () => { isMounted = false; };
  }, []);

  // Load districts khi province thay đổi
  useEffect(() => {
    setDistricts([]);
    setWards([]);
    if (!form.province) return;
    
    let isMounted = true;
    
    (async () => {
      try {
        const r = await cachedFetch(
          API_BASE + '/v1/platform/areas/district?province_code=' + encodeURIComponent(form.province),
          { headers: { 'Authorization': 'Bearer ' + API_TOKEN } }
        );
        if (r.ok && isMounted) {
          const js = await r.json();
          const arr = Array.isArray(js?.data) ? js.data : (Array.isArray(js) ? js : []);
          setDistricts(arr);
        }
      } catch (e) {
        console.error('Failed to load districts:', e);
      }
    })();
    
    return () => { isMounted = false; };
  }, [form.province]);

  // Load wards khi district thay đổi
  useEffect(() => {
    setWards([]);
    if (!form.district) return;
    
    let isMounted = true;
    
    (async () => {
      try {
        const r = await cachedFetch(
          API_BASE + '/v1/platform/areas/commune?district_code=' + encodeURIComponent(form.district),
          { headers: { 'Authorization': 'Bearer ' + API_TOKEN } }
        );
        if (r.ok && isMounted) {
          const js = await r.json();
          const arr = Array.isArray(js?.data) ? js.data : (Array.isArray(js) ? js : []);
          setWards(arr);
        }
      } catch (e) {
        console.error('Failed to load wards:', e);
      }
    })();
    
    return () => { isMounted = false; };
  }, [form.district]);

  // Calculate shipping với debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      (async () => {
        if (!form.province || !form.district || totalWeightGram <= 0) {
          const arr = CARRIER_ORDER.map(c => ({
            carrier: c,
            fee: calcFallbackFee(totalWeightGram || 1000, c)
          }));
          setShippingList(arr);
          setCarrier(arr[0]?.carrier || '');
          setShippingFee(arr[0]?.fee || 0);
          return;
        }

        try {
          const r = await fetch(API_BASE + '/v1/platform/orders/price', {
            method: 'POST',
            headers: {
              'content-type': 'application/json',
              'Authorization': 'Bearer ' + API_TOKEN
            },
            body: JSON.stringify({
              to_province: form.province,
              to_district: form.district,
              weight_gram: totalWeightGram
            })
          });

          if (r.ok) {
            const js = await r.json();
            const items = Array.isArray(js?.data) ? js.data : (Array.isArray(js) ? js : []);
            const mapped = items.map(x => ({
              carrier: x?.carrier_name || x?.carrier || 'Khác',
              fee: Number(x?.fee || x?.price || 0)
            }));
            
            if (mapped.length) {
              setShippingList(mapped);
              setCarrier(mapped[0].carrier);
              setShippingFee(mapped[0].fee);
              return;
            }
          }
        } catch (e) {
          console.error('Failed to calculate shipping:', e);
        }

        // Fallback
        const arr = CARRIER_ORDER.map(c => ({
          carrier: c,
          fee: calcFallbackFee(totalWeightGram, c)
        }));
        setShippingList(arr);
        setCarrier(arr[0]?.carrier || '');
        setShippingFee(arr[0]?.fee || 0);
      })();
    }, 300); // Debounce 300ms

    return () => clearTimeout(timer);
  }, [form.province, form.district, totalWeightGram]);

  const grandTotal = st.total + (shippingFee || 0);

  const submit = useCallback(async () => {
    setError(null);
    setSubmitting(true);
    
    if (!form.name || !form.phone) {
      setError('Vui lòng nhập họ tên và số điện thoại');
      setSubmitting(false);
      return;
    }
    if (!carrier) {
      setError('Vui lòng chọn đơn vị vận chuyển');
      setSubmitting(false);
      return;
    }

    const order = {
      contact: {
        name: form.name,
        phone: form.phone,
        province: form.province,
        district: form.district,
        ward: form.ward,
        address: form.address
      },
      lines: st.lines,
      shipping: { carrier, fee: shippingFee, weight_gram: totalWeightGram },
      totals: { subtotal: st.subtotal, savings: st.savings, shipping: shippingFee, total: grandTotal },
      createdAt: new Date().toISOString(),
    };

    try {
      const res = await fetch(API_BASE + '/v1/platform/orders/create', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'Authorization': 'Bearer ' + API_TOKEN
        },
        body: JSON.stringify(order)
      });
      
      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        setDone({ kind: 'server', data, endpoint: '/v1/platform/orders/create' });
        cart.clear();
        setSt(cart.get());
        return;
      }
    } catch (e) {
      console.error('Order submission failed:', e);
    }

    // Fallback endpoints
    const candidates = ['/orders', '/api/orders', '/v1/orders', '/checkout/order'];
    for (const p of candidates) {
      try {
        const res = await fetch((window.API_BASE ? window.API_BASE.replace(/\/+$/, '') + p : p), {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(order)
        });
        
        if (res.ok) {
          const data = await res.json().catch(() => ({}));
          setDone({ kind: 'server', data, endpoint: p });
          cart.clear();
          setSt(cart.get());
          return;
        }
      } catch {}
    }

    // Last resort: localStorage
    try {
      localStorage.setItem('shv_last_order', JSON.stringify(order));
    } catch {}
    
    setDone({ kind: 'local', data: order });
    cart.clear();
    setSt(cart.get());
    setSubmitting(false);
  }, [form, carrier, shippingFee, st, totalWeightGram, grandTotal]);

  return (
    <div>
      <main className="max-w-4xl mx-auto p-3">
        <h1 className="text-xl font-bold mb-3">Thanh toán</h1>
        
        {st.lines.length === 0 && !done && (
          <div className="text-center text-gray-500 py-8">Giỏ hàng trống.</div>
        )}
        
        {done ? (
          <div className="bg-white rounded-2xl p-4 shadow">
            <div className="text-center">
              <div className="text-5xl mb-3">✅</div>
              <div className="text-lg font-semibold mb-2">Đặt hàng thành công!</div>
              {done.kind === 'server' ? (
                <div className="text-sm text-gray-600">Đã gửi đơn lên máy chủ ({done.endpoint}).</div>
              ) : (
                <div className="text-sm text-gray-600">Đơn tạm lưu trong máy (chưa gửi server).</div>
              )}
              <div className="mt-3 text-sm">Cảm ơn bạn đã mua hàng.</div>
              <a href="/" className="mt-4 inline-block px-6 py-2 bg-sky-500 text-white rounded-xl hover:bg-sky-600 transition-colors">
                Về trang chủ
              </a>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Order summary */}
            <div className="bg-white rounded-2xl p-3 shadow">
              <div className="font-semibold mb-2">Đơn hàng ({st.lines.length} sản phẩm)</div>
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {st.lines.map((l) => (
                  <div key={String(l.id)} className="flex justify-between py-1 text-sm">
                    <span className="line-clamp-1 pr-2">{l.name} × {l.qty}</span>
                    <span className="font-medium">{fmtVND(l.price * l.qty)}</span>
                  </div>
                ))}
              </div>
              <div className="flex justify-between py-2 border-t mt-2 font-semibold">
                <span>Tạm tính</span>
                <span>{fmtVND(st.total)}</span>
              </div>
            </div>

            {/* Contact form */}
            <div className="bg-white rounded-2xl p-3 shadow space-y-2">
              <div className="font-semibold">Thông tin nhận hàng</div>
              <input
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                placeholder="Họ tên *"
                className="w-full rounded-xl border px-3 py-2 focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none"
                required
              />
              <input
                value={form.phone}
                onChange={e => setForm({ ...form, phone: e.target.value })}
                placeholder="Số điện thoại *"
                type="tel"
                className="w-full rounded-xl border px-3 py-2 focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none"
                required
              />
              <div className="grid grid-cols-3 gap-2">
                <select
                  value={form.province}
                  onChange={e => setForm({ ...form, province: e.target.value, district: '', ward: '' })}
                  className="rounded-xl border px-2 py-2 focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none"
                >
                  <option value="">Tỉnh/Thành</option>
                  {provinces.map((p) => (
                    <option key={p.code || p.id} value={p.code || p.id}>
                      {p.name || p.label}
                    </option>
                  ))}
                </select>
                <select
                  value={form.district}
                  onChange={e => setForm({ ...form, district: e.target.value, ward: '' })}
                  className="rounded-xl border px-2 py-2 focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none"
                  disabled={!form.province}
                >
                  <option value="">Quận/Huyện</option>
                  {districts.map((d) => (
                    <option key={d.code || d.id} value={d.code || d.id}>
                      {d.name || d.label}
                    </option>
                  ))}
                </select>
                <select
                  value={form.ward}
                  onChange={e => setForm({ ...form, ward: e.target.value })}
                  className="rounded-xl border px-2 py-2 focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none"
                  disabled={!form.district}
                >
                  <option value="">Phường/Xã</option>
                  {wards.map((w) => (
                    <option key={w.code || w.id} value={w.code || w.id}>
                      {w.name || w.label}
                    </option>
                  ))}
                </select>
              </div>
              <input
                value={form.address}
                onChange={e => setForm({ ...form, address: e.target.value })}
                placeholder="Địa chỉ chi tiết"
                className="w-full rounded-xl border px-3 py-2 focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none"
              />
            </div>

            {/* Shipping options */}
            <div className="bg-white rounded-2xl p-3 shadow space-y-2">
              <div className="font-semibold">Vận chuyển</div>
              <div className="text-xs text-gray-500">
                Khối lượng: {Math.max(1, Math.ceil((totalWeightGram || 0) / 1000))} kg
              </div>
              {shippingList.length > 0 ? (
                <div className="grid grid-cols-1 gap-2">
                  {shippingList.map((x, idx) => (
                    <label
                      key={idx}
                      className="flex items-center justify-between rounded-xl border p-3 cursor-pointer hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="ship"
                          checked={carrier === x.carrier}
                          onChange={() => {
                            setCarrier(x.carrier);
                            setShippingFee(x.fee);
                          }}
                          className="w-4 h-4"
                        />
                        <span className="text-sm">{x.carrier}</span>
                      </div>
                      <div className="font-semibold text-sky-600">{fmtVND(x.fee)}</div>
                    </label>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-gray-500 py-2">
                  Đang tính phí vận chuyển...
                </div>
              )}
            </div>

            {/* Total and submit */}
            <div className="bg-white rounded-2xl p-3 shadow">
              <div className="flex justify-between py-1 text-sm">
                <span>Tạm tính</span>
                <span>{fmtVND(st.total)}</span>
              </div>
              <div className="flex justify-between py-1 text-sm">
                <span>Phí vận chuyển</span>
                <span className="text-sky-600">{fmtVND(shippingFee)}</span>
              </div>
              <div className="flex justify-between py-2 border-t mt-2 text-lg font-semibold">
                <span>Tổng cộng</span>
                <span className="text-rose-600">{fmtVND(grandTotal)}</span>
              </div>
              
              {error && (
                <div className="text-red-600 text-sm mt-2 bg-red-50 p-2 rounded-lg">
                  {error}
                </div>
              )}
              
              <button
                disabled={disabled}
                onClick={submit}
                className="w-full rounded-2xl bg-sky-500 disabled:bg-gray-300 text-white py-3 mt-3 font-semibold hover:bg-sky-600 transition-colors disabled:cursor-not-allowed"
              >
                {submitting ? 'Đang xử lý...' : 'Đặt hàng'}
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}