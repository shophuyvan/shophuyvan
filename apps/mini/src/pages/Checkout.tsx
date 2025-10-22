import React, { useEffect, useMemo, useState, useCallback } from 'react';
import cart from '@shared/cart';
import { fmtVND } from '@shared/utils/fmtVND';
import { cloudify } from '@shared/utils/cloudinary';

const API_BASE = 'https://shv-api.shophuyvan.workers.dev';

const FALLBACK_PRICING = {
  'Viettel Post': [{limit:1000,price:18000},{limit:2000,price:23000},{limit:3000,price:28000},{limit:4000,price:33000},{limit:5000,price:38000},{limit:6000,price:43000}],
  'SPX Express': [{limit:1000,price:15000},{limit:2000,price:25000},{limit:3000,price:35000},{limit:4000,price:45000},{limit:5000,price:55000},{limit:6000,price:65000}],
  'J&T Express': [{limit:1000,price:20000},{limit:2000,price:20000},{limit:3000,price:25000},{limit:4000,price:23000},{limit:5000,price:35000},{limit:6000,price:40000}],
};
const CARRIER_ORDER = Object.keys(FALLBACK_PRICING);

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

export default function Checkout() {
  const [st, setSt] = useState(cart.get());
  const [form, setForm] = useState({ 
    name: '', 
    phone: '', 
    province: '', 
    district: '', 
    ward: '', 
    address: '',
    note: ''
  });
  const [done, setDone] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [provinces, setProvinces] = useState<any[]>([]);
  const [districts, setDistricts] = useState<any[]>([]);
  const [wards, setWards] = useState<any[]>([]);
  const [loadingProvinces, setLoadingProvinces] = useState(false);
  const [loadingDistricts, setLoadingDistricts] = useState(false);
  const [loadingWards, setLoadingWards] = useState(false);

  const totalWeightGram = useMemo(
    () => st.lines.reduce((s, l) => s + (l.weight_gram ?? l.weight ?? 0) * (l.qty ?? 1), 0),
    [st]
  );

  const [shippingList, setShippingList] = useState<any[]>([]);
  const [shippingFee, setShippingFee] = useState(0);
  const [selectedShipping, setSelectedShipping] = useState<any>(null);

  const disabled = st.lines.length === 0 || submitting;

  // Load provinces
  useEffect(() => {
    let isMounted = true;
    setLoadingProvinces(true);
    
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/shipping/provinces`);
        if (res.ok && isMounted) {
          const data = await res.json();
          const items = data.items || data.data || [];
          setProvinces(items);
        }
      } catch (e) {
        console.error('Load provinces error:', e);
      } finally {
        if (isMounted) setLoadingProvinces(false);
      }
    })();
    
    return () => { isMounted = false; };
  }, []);

  // Load districts
  useEffect(() => {
    setDistricts([]);
    setWards([]);
    if (!form.province) return;
    
    let isMounted = true;
    setLoadingDistricts(true);
    
    (async () => {
      try {
        const res = await fetch(
          `${API_BASE}/shipping/districts?province_code=${encodeURIComponent(form.province)}`
        );
        if (res.ok && isMounted) {
          const data = await res.json();
          const items = data.items || data.data || [];
          setDistricts(items);
        }
      } catch (e) {
        console.error('Load districts error:', e);
      } finally {
        if (isMounted) setLoadingDistricts(false);
      }
    })();
    
    return () => { isMounted = false; };
  }, [form.province]);

  // Load wards
  useEffect(() => {
    setWards([]);
    if (!form.district) return;
    
    let isMounted = true;
    setLoadingWards(true);
    
    (async () => {
      try {
        const res = await fetch(
          `${API_BASE}/shipping/wards?district_code=${encodeURIComponent(form.district)}`
        );
        if (res.ok && isMounted) {
          const data = await res.json();
          const items = data.items || data.data || [];
          setWards(items);
        }
      } catch (e) {
        console.error('Load wards error:', e);
      } finally {
        if (isMounted) setLoadingWards(false);
      }
    })();
    
    return () => { isMounted = false; };
  }, [form.district]);

  // Calculate shipping
  useEffect(() => {
    const timer = setTimeout(() => {
      (async () => {
        if (!form.province || !form.district) {
          const arr = CARRIER_ORDER.map(c => ({
            provider: c,
            name: c,
            service_code: 'standard',
            fee: calcFallbackFee(totalWeightGram || 500, c),
            eta: 'Giao hàng tiêu chuẩn'
          }));
          setShippingList(arr);
          setSelectedShipping(arr[0]);
          setShippingFee(arr[0]?.fee || 0);
          return;
        }

        try {
          const weight = totalWeightGram || 500;
          
          const res = await fetch(`${API_BASE}/shipping/price`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              receiver_province: form.province,
              receiver_district: form.district,
              weight_gram: weight,
              cod: 0
            })
          });

          if (res.ok) {
            const data = await res.json();
            const items = data.items || data.data || [];
            
            if (items.length > 0) {
              const mapped = items.map(item => ({
                provider: item.provider,
                name: item.name || item.provider,
                service_code: item.service_code,
                fee: Number(item.fee || 0),
                eta: item.eta || 'Giao hàng tiêu chuẩn'
              }));
              
              setShippingList(mapped);
              setSelectedShipping(mapped[0]);
              setShippingFee(mapped[0].fee);
              return;
            }
          }
        } catch (e) {
          console.error('Get shipping quote error:', e);
        }

        // Fallback
        const arr = CARRIER_ORDER.map(c => ({
          provider: c,
          name: c,
          service_code: 'standard',
          fee: calcFallbackFee(totalWeightGram || 500, c),
          eta: 'Giao hàng tiêu chuẩn'
        }));
        setShippingList(arr);
        setSelectedShipping(arr[0]);
        setShippingFee(arr[0]?.fee || 0);
      })();
    }, 300);

    return () => clearTimeout(timer);
  }, [form.province, form.district, totalWeightGram]);

  const grandTotal = st.total + (shippingFee || 0);

  // Place order
  const submit = useCallback(async () => {
    setError(null);
    setSubmitting(true);
    
    if (!form.name || !form.phone) {
      setError('Vui lòng nhập họ tên và số điện thoại');
      setSubmitting(false);
      return;
    }
    
    if (!form.province || !form.district || !form.ward) {
      setError('Vui lòng chọn đầy đủ địa chỉ');
      setSubmitting(false);
      return;
    }
    
    if (!form.address.trim()) {
      setError('Vui lòng nhập địa chỉ chi tiết');
      setSubmitting(false);
      return;
    }
    
    if (!selectedShipping) {
      setError('Vui lòng chọn phương thức vận chuyển');
      setSubmitting(false);
      return;
    }

    const payload = {
      customer: {
        name: form.name,
        phone: form.phone.replace(/\D/g, ''),
        address: form.address,
        province_code: form.province,
        district_code: form.district,
        commune_code: form.ward,
        ward_code: form.ward
      },
      items: st.lines.map(item => ({
        id: item.id,
        sku: item.sku || item.id,
        name: item.name,
        price: Number(item.price || 0),
        cost: Number(item.cost || 0),
        qty: Number(item.qty || 1),
        weight_gram: Number(item.weight_gram || item.weight || 0),
        variant: item.variantName || '',
        image: item.variantImage || item.image || ''
      })),
      totals: {
        subtotal: st.subtotal,
        shipping_fee: shippingFee,
        discount: 0,
        shipping_discount: 0,
        total: grandTotal
      },
      shipping_provider: selectedShipping.provider,
      shipping_service: selectedShipping.service_code,
      shipping_name: selectedShipping.name,
      shipping_eta: selectedShipping.eta,
      shipping_fee: shippingFee,
      discount: 0,
      shipping_discount: 0,
      voucher_code: '',
      note: form.note || '',
      source: 'mini',
      status: 'pending'
    };

    console.log('[INV-TRACE] MINI.checkout: createOrder payload', payload);

    try {
      const res = await fetch(`${API_BASE}/api/orders`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Idempotency-Key': 'order-' + Date.now() + '-' + Math.random().toString(36).slice(2)
        },
        body: JSON.stringify(payload)
      });
      
      const data = await res.json();
	  console.log('[INV-TRACE] MINI.checkout: createOrder response', { ok: data?.ok, id: data?.id, raw: data });
      
      if (data.ok || data.id) {
        setDone({ 
          kind: 'server', 
          data, 
          endpoint: '/api/orders',
          orderId: data.id || data.order_id 
        });
        cart.clear();
        setSt(cart.get());
        return;
      } else {
        throw new Error(data.error || data.message || 'Đặt hàng thất bại');
      }
    } catch (e: any) {
      console.error('Place order error:', e);
      setError(e.message || 'Có lỗi xảy ra khi đặt hàng');
    } finally {
      setSubmitting(false);
    }
  }, [form, selectedShipping, shippingFee, st, grandTotal]);

  // Optimize image for checkout
  const getItemImage = useCallback((item: any) => {
    const rawImg = item.variantImage || item.image || '/icon.png';
    return cloudify(rawImg, 'w_200,h_200,c_fill,q_auto,f_auto');
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="max-w-4xl mx-auto p-3 pb-20">
        <h1 className="text-xl font-bold mb-3">Thanh toán</h1>
        
        {st.lines.length === 0 && !done && (
          <div className="text-center text-gray-500 py-8">Giỏ hàng trống.</div>
        )}
        
        {done ? (
          <div className="bg-white rounded-2xl p-6 shadow">
            <div className="text-center">
              <div className="text-6xl mb-4">✅</div>
              <div className="text-xl font-bold mb-2">Đặt hàng thành công!</div>
              <div className="text-sm text-gray-600 mb-1">
                Đã gửi đơn lên máy chủ ({done.endpoint})
              </div>
              {done.orderId && (
                <div className="text-sm text-gray-500 mb-4">
                  Mã đơn hàng: <span className="font-mono font-semibold">{done.orderId}</span>
                </div>
              )}
              <div className="text-gray-700 mb-6">Cảm ơn bạn đã mua hàng.</div>
              <a 
                href="/" 
                className="inline-block px-8 py-3 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-colors font-semibold"
              >
                Về trang chủ
              </a>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* ===== ENHANCED ORDER SUMMARY ===== */}
            <div className="bg-white rounded-2xl p-4 shadow">
              <div className="font-semibold mb-3">Đơn hàng ({st.lines.length} sản phẩm)</div>
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {st.lines.map((l) => (
                  <div key={String(l.id)} className="flex gap-3 p-3 border rounded-xl hover:bg-gray-50 transition-colors">
                    {/* Product Image */}
                    <img
                      src={getItemImage(l)}
                      className="w-24 h-24 rounded-xl object-cover flex-shrink-0 border"
                      alt={l.name}
                      loading="lazy"
                    />

                    {/* Product Details */}
                    <div className="flex-1 min-w-0">
                      {/* Name */}
                      <div className="font-semibold text-sm line-clamp-2 mb-1">
                        {l.name}
                      </div>

                      {/* Variant Badge */}
                      {l.variantName && (
                        <div className="mb-2">
                          <span className="inline-block px-2 py-1 text-xs rounded-lg bg-blue-50 text-blue-700 border border-blue-200">
                            {l.variantName}
                          </span>
                        </div>
                      )}

                      {/* Price & Quantity */}
                      <div className="flex items-center justify-between">
                        <div className="text-rose-600 font-semibold">
                          {fmtVND(l.price)}
                        </div>
                        <div className="text-sm text-gray-600">
                          Số lượng: <span className="font-semibold">{l.qty}</span>
                        </div>
                      </div>

                      {/* Total for this item */}
                      <div className="mt-2 text-right">
                        <span className="text-sm text-gray-500">Thành tiền: </span>
                        <span className="font-bold text-emerald-600">
                          {fmtVND(l.price * l.qty)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Subtotal */}
              <div className="flex justify-between py-3 border-t mt-3 font-semibold text-lg">
                <span>Tạm tính</span>
                <span className="text-rose-600">{fmtVND(st.total)}</span>
              </div>
            </div>

            {/* Contact form */}
            <div className="bg-white rounded-2xl p-4 shadow space-y-3">
              <div className="font-semibold text-lg">Địa chỉ nhận hàng</div>
              
              <input
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                placeholder="Họ tên *"
                className="w-full rounded-xl border border-gray-300 px-4 py-3 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                required
              />
              
              <input
                value={form.phone}
                onChange={e => setForm({ ...form, phone: e.target.value })}
                placeholder="Số điện thoại *"
                type="tel"
                className="w-full rounded-xl border border-gray-300 px-4 py-3 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                required
              />
              
              <select
                value={form.province}
                onChange={e => setForm({ ...form, province: e.target.value, district: '', ward: '' })}
                className="w-full rounded-xl border border-gray-300 px-4 py-3 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                disabled={loadingProvinces}
              >
                <option value="">-- Chọn Tỉnh/Thành phố *</option>
                {provinces.map((p) => (
                  <option key={p.code || p.id} value={p.code || p.id}>
                    {p.name || p.label}
                  </option>
                ))}
              </select>
              
              <select
                value={form.district}
                onChange={e => setForm({ ...form, district: e.target.value, ward: '' })}
                className="w-full rounded-xl border border-gray-300 px-4 py-3 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                disabled={!form.province || loadingDistricts}
              >
                <option value="">
                  {loadingDistricts ? 'Đang tải...' : '-- Chọn Quận/Huyện *'}
                </option>
                {districts.map((d) => (
                  <option key={d.code || d.id} value={d.code || d.id}>
                    {d.name || d.label}
                  </option>
                ))}
              </select>
              
              <select
                value={form.ward}
                onChange={e => setForm({ ...form, ward: e.target.value })}
                className="w-full rounded-xl border border-gray-300 px-4 py-3 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                disabled={!form.district || loadingWards}
              >
                <option value="">
                  {loadingWards ? 'Đang tải...' : '-- Chọn Phường/Xã *'}
                </option>
                {wards.map((w) => (
                  <option key={w.code || w.id} value={w.code || w.id}>
                    {w.name || w.label}
                  </option>
                ))}
              </select>
              
              <input
                value={form.address}
                onChange={e => setForm({ ...form, address: e.target.value })}
                placeholder="Địa chỉ chi tiết (số nhà, tên đường) *"
                className="w-full rounded-xl border border-gray-300 px-4 py-3 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                required
              />
              
              <input
                value={form.note}
                onChange={e => setForm({ ...form, note: e.target.value })}
                placeholder="Ghi chú (không bắt buộc)"
                className="w-full rounded-xl border border-gray-300 px-4 py-3 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
              />
            </div>

            {/* Shipping options */}
            <div className="bg-white rounded-2xl p-4 shadow space-y-3">
              <div className="font-semibold text-lg">Vận chuyển</div>
              <div className="text-sm text-gray-600">
                Khối lượng: {Math.max(1, Math.ceil((totalWeightGram || 0) / 1000))} kg
              </div>
              
              {shippingList.length > 0 ? (
                <div className="space-y-2">
                  {shippingList.map((item, idx) => (
                    <label
                      key={idx}
                      className={`flex items-center justify-between border rounded-xl p-4 cursor-pointer transition-all ${
                        selectedShipping?.provider === item.provider 
                          ? 'border-emerald-500 bg-emerald-50' 
                          : 'border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center gap-3 flex-1">
                        <input
                          type="radio"
                          name="ship_opt"
                          checked={selectedShipping?.provider === item.provider}
                          onChange={() => {
                            setSelectedShipping(item);
                            setShippingFee(item.fee);
                          }}
                          className="w-4 h-4 text-emerald-600"
                        />
                        <div>
                          <div className="font-semibold">{item.name}</div>
                          <div className="text-sm text-gray-600">{item.eta}</div>
                        </div>
                      </div>
                      <div className="font-bold text-emerald-600 text-lg">
                        {fmtVND(item.fee)}
                      </div>
                    </label>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-gray-500 py-4 text-center">
                  Vui lòng chọn địa chỉ để xem phí vận chuyển
                </div>
              )}
            </div>

            {/* Total and submit */}
            <div className="bg-white rounded-2xl p-4 shadow">
              <div className="font-semibold mb-3">Chi tiết thanh toán</div>
              
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Tổng sản phẩm:</span>
                  <span>{fmtVND(st.total)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Phí vận chuyển:</span>
                  <span className="text-emerald-600 font-semibold">{fmtVND(shippingFee)}</span>
                </div>
              </div>
              
              <div className="flex justify-between py-3 border-t mt-3 text-lg font-bold">
                <span>Tổng thanh toán:</span>
                <span className="text-emerald-600 text-xl">{fmtVND(grandTotal)}</span>
              </div>
              
              {error && (
                <div className="text-red-600 text-sm mt-3 bg-red-50 p-3 rounded-lg border border-red-200">
                  ⚠️ {error}
                </div>
              )}
              
              <button
                disabled={disabled}
                onClick={submit}
                className="w-full rounded-xl bg-emerald-600 disabled:bg-gray-300 text-white py-4 mt-4 font-bold text-lg hover:bg-emerald-700 transition-colors disabled:cursor-not-allowed shadow-lg"
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
