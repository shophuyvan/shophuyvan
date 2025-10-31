// apps/mini/src/pages/Checkout.tsx
// ============================================================================
// ✅ ĐỒNG BỘ VỚI FE (KHÔNG FALLBACK):
// - Màu sắc/typography theo FE (rose).
// - Ảnh sản phẩm: w-20 h-20, badge biến thể, layout giống FE.
// - TÍNH TRỌNG LƯỢNG: chỉ dùng dữ liệu thực (weight_gram || weight_grams || weight
//   || variant.weight_gram) × qty. Thiếu => 0 (KHÔNG tự đặt mặc định).
// - Vận chuyển: gọi API thực /shipping/price với weight_gram & value = subtotal.
//   Nếu thiếu cân nặng => KHÔNG gọi API, báo lỗi rõ ràng.
// - Voucher: giữ đầy đủ như FE (auto-freeship + mã tay).
// - Đặt hàng: gửi totals chuẩn + Idempotency-Key.
// - Comment đánh dấu từng khối để bạn tra cứu/sửa nhanh.
// ============================================================================

import React, { useEffect, useMemo, useState, useCallback } from 'react';
import cart from '@shared/cart';
import { fmtVND } from '@shared/utils/fmtVND';
import { cloudify } from '@shared/utils/cloudinary';

const API_BASE = 'https://api.shophuyvan.vn';

// === API client gọn ===
const api = async (path: string, options: RequestInit = {}) => {
  const url = `${API_BASE}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.message || errData.error || 'API request failed');
  }
    return res.json();
};

/**
 * ensureWeight(): nếu giỏ hàng chưa có cân nặng → gọi /shipping/weight
 * Body: { lines: [{ product_id, variant_name, qty }] }
 * Response: { total_gram: number }
 */
  const fetchServerWeight = async (lines: any[]): Promise<number> => {
  const payload = {
    lines: lines.map((it: any) => ({
      product_id: it.productId || it.id,
      variant_name: it.variant_name || it.variantName || '',
      qty: Number(it.qty || it.quantity || 1),
    })),
  };
  const data = await api('/shipping/weight', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  const g = Number(data?.total_gram || 0);
  if (g > 0) {
    try { localStorage.setItem('cart_weight_gram', String(g)); } catch {}
  }
  return g;
};


export default function Checkout() {
 // === GIỎ HÀNG ==============================================================
  const [st, setSt] = useState<any>(cart.get());
  const [serverWeight, setServerWeight] = useState<number | null>(null);

  // Lọc các dòng đã CHỌN: ưu tiên checkout_items; sau đó cart_selected_ids; fallback = tất cả
  const selectedIds = useMemo(() => {
    try {
      const raw = localStorage.getItem('cart_selected_ids');
      if (!raw) return new Set<string>();
      const arr = JSON.parse(raw);
      if (Array.isArray(arr) && arr.length) return new Set<string>(arr.map(String));
    } catch {}
    return new Set<string>();
  }, [st]);

  const selectedLines = useMemo(() => {
    try {
      const ck = JSON.parse(localStorage.getItem('checkout_items') || '[]');
      if (Array.isArray(ck) && ck.length) return ck;
    } catch {}
    const all = Array.isArray(st?.lines) ? st.lines : [];
    if (selectedIds.size === 0) return all;
    return all.filter((l: any) => selectedIds.has(String(l?.id)));
  }, [st, selectedIds]);

  // === FORM NHẬN HÀNG ========================================================

  const [form, setForm] = useState<any>({
    name: '',
    phone: '',
    province: '',
    district: '',
    ward: '',
    address: '',
    note: '',
  });

  // === TRẠNG THÁI SUBMIT =====================================================
  const [done, setDone] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // === ĐỊA LÝ ================================================================
  const [provinces, setProvinces] = useState<any[]>([]);
  const [districts, setDistricts] = useState<any[]>([]);
  const [wards, setWards] = useState<any[]>([]);
  const [loadingProvinces, setLoadingProvinces] = useState(false);
  const [loadingDistricts, setLoadingDistricts] = useState(false);
  const [loadingWards, setLoadingWards] = useState(false);

  // subtotal = Σ (price * qty) — chỉ theo dòng đã chọn
  const subtotal = useMemo(
    () => (Array.isArray(selectedLines) ? selectedLines : []).reduce(
      (s: number, it: any) => s + Number(it.price || 0) * Number(it.qty || 1),
      0
    ),
    [selectedLines]
  );

// totalWeightGram = Σ ( (weight_gram || weight_grams || weight || variant.weight_gram) * qty )
// Nếu item không có cân nặng => tính 0 cho item đó (đúng yêu cầu "không fallback").
const totalWeightGram = useMemo(() => {
  const src = Array.isArray(selectedLines) ? selectedLines : [];
  return src.reduce((sum: number, it: any) => {
    const w = Number(
      it.weight_gram ??
      it.weight_grams ??
      it.weight ??
      it.variant?.weight_gram ??
      0
    );
    const q = Number(it.qty || 1);
    return sum + (w > 0 ? w * q : 0);
  }, 0);
}, [selectedLines]);

// Nếu thiếu cân nặng ở cart → hỏi server để lấy total_gram thật
const [weightOverride, setWeightOverride] = useState<number | null>(null);

  const ensureLocalWeight = useCallback(async () => {
  if (totalWeightGram > 0) { setWeightOverride(null); return; }
  try {
    const src = Array.isArray(selectedLines) ? selectedLines : (st.lines || []);
    const lines = src.map((it: any) => ({
      product_id: it.productId || it.id,
      variant_name: it.variant_name || it.variantName || '',
      qty: Number(it.qty || it.quantity || 1),
    }));
    const res = await api('/shipping/weight', {
      method: 'POST',
      body: JSON.stringify({ lines }),
      headers: { 'Content-Type': 'application/json' },
    });
    const g = Number((res as any)?.total_gram || 0);
    if (g > 0) {
      setWeightOverride(g);
      try { localStorage.setItem('cart_weight_gram', String(g)); } catch {}
    }
  } catch { /* ignore */ }
}, [st, totalWeightGram]);

useEffect(() => { ensureLocalWeight(); }, [ensureLocalWeight]);

// Cân nặng dùng để tính ship/UI
const effectiveWeightGram = (weightOverride ?? totalWeightGram);

// === VẬN CHUYỂN (API thật) ================================================
  const [shippingList, setShippingList] = useState<any[]>([]);
  const [selectedShipping, setSelectedShipping] = useState<any>(null);
  const [shippingError, setShippingError] = useState<string | null>(null);
  const [shippingLoading, setShippingLoading] = useState(false);

  // === VOUCHER ===============================================================
  const [autoVouchers, setAutoVouchers] = useState<any[]>([]); // auto_freeship
  const [voucherCode, setVoucherCode] = useState('');
  const [appliedVoucher, setAppliedVoucher] = useState<any>(null);
  const [voucherLoading, setVoucherLoading] = useState(false);
  const [voucherError, setVoucherError] = useState<string | null>(null);

  // === CHO XEM HÀNG ==========================================================
  const [allowInspection, setAllowInspection] = useState(true); // ✅ MẶC ĐỊNH = TRUE

  const disabled = st.lines.length === 0 || submitting;

  // 1) LOAD auto freeship
  useEffect(() => {
    (async () => {
      try {
        const res = await api('/vouchers');
        const items = res.items || [];
        const auto = items.filter((v: any) => v.voucher_type === 'auto_freeship' && v.on === true);
        setAutoVouchers(auto);
      } catch (e) {
        console.error('[AutoFreeship] load error:', e);
      }
    })();
  }, []);

  // 2) LOAD địa lý
  useEffect(() => {
    let alive = true;
    setLoadingProvinces(true);
    (async () => {
      try {
        const data = await api('/shipping/provinces');
        if (!alive) return;
        setProvinces(data.items || data.data || []);
      } catch (e) {
        console.error('Load provinces error:', e);
      } finally {
        if (alive) setLoadingProvinces(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    setDistricts([]); setWards([]);
    if (!form.province) return;
    let alive = true;
    setLoadingDistricts(true);
    (async () => {
      try {
        const data = await api(`/shipping/districts?province_code=${encodeURIComponent(form.province)}`);
        if (!alive) return;
        setDistricts(data.items || data.data || []);
      } catch (e) {
        console.error('Load districts error:', e);
      } finally {
        if (alive) setLoadingDistricts(false);
      }
    })();
    return () => { alive = false; };
  }, [form.province]);

  useEffect(() => {
    setWards([]);
    if (!form.district) return;
    let alive = true;
    setLoadingWards(true);
    (async () => {
      try {
        const data = await api(`/shipping/wards?district_code=${encodeURIComponent(form.district)}`);
        if (!alive) return;
        setWards(data.items || data.data || []);
      } catch (e) {
        console.error('Load wards error:', e);
      } finally {
        if (alive) setLoadingWards(false);
      }
    })();
    return () => { alive = false; };
  }, [form.district]);

    // 3) LẤY PHÍ SHIP — nếu thiếu cân nặng local → hỏi server trước
  useEffect(() => {
    // Reset khi thiếu địa chỉ
    if (!form.province || !form.district) {
      setShippingList([]); setSelectedShipping(null); setShippingError(null);
      return;
    }

    let alive = true;
    setShippingLoading(true);
    setShippingError(null);

    (async () => {
      try {
        const provinceName = provinces.find(p => p.code === form.province)?.name || form.province;
        const districtName = districts.find(d => d.code === form.district)?.name || form.district;

        let weightToUse = Number(totalWeightGram || 0);
        if (weightToUse <= 0) {
          const g = await fetchServerWeight(selectedLines || []);
          if (!alive) return;
          if (g > 0) {
            setServerWeight(g);
            weightToUse = g;
          } else {
            setShippingList([]); setSelectedShipping(null);
            setShippingError('Thiếu trọng lượng sản phẩm. Không thể tính phí vận chuyển.');
            return;
          }
        }

        const data = await api('/shipping/price', {
          method: 'POST',
          body: JSON.stringify({
            receiver_province: provinceName,
            receiver_district: districtName,
            receiver_commune: form.ward || '',
            weight_gram: Number(weightToUse),
            weight: Number(weightToUse),
            value: Number(subtotal || 0),
            cod: Number(subtotal || 0),
            option_id: '1',
          }),
        });

        const rawItems = data.data || data.items || [];
        const items = (Array.isArray(rawItems) ? rawItems : []).map((it: any) => ({
          provider: it.provider,
          name: it.name || it.provider,
          service_code: it.service_code,
          fee: Number(it.fee || 0),
          eta: it.eta || 'Giao hàng tiêu chuẩn',
        })).sort((a: any, b: any) => a.fee - b.fee);

        if (!alive) return;

        setShippingList(items);
        setSelectedShipping(items[0] || null);
        if (items.length === 0) {
          setShippingError('Không có gói vận chuyển phù hợp. Vui lòng thử lại sau.');
        }
      } catch (e: any) {
        if (!alive) return;
        console.error('Get shipping quote error:', e);
        setShippingList([]); setSelectedShipping(null);
        setShippingError(e.message || 'Không lấy được phí vận chuyển. Vui lòng thử lại sau.');
      } finally {
        if (alive) setShippingLoading(false);
      }
    })();

    return () => { alive = false; };
  }, [form.province, form.district, form.ward, totalWeightGram, subtotal, st.lines, provinces, districts]);

  // 4) TÍNH TỔNG (bám FE, dùng subtotal thực)
  const calculatedTotals = useMemo(() => {
    const originalShippingFee = selectedShipping?.fee || 0;

    const manualProductDiscount = appliedVoucher?.discount || 0;
    const manualShippingDiscount = appliedVoucher?.ship_discount || 0;

    // auto freeship
    let autoShippingDiscount = 0;
    let autoVoucherCode: string | null = null;
    const eligibleAuto = autoVouchers.find((v: any) => subtotal >= (v.min_purchase || 0));
    if (eligibleAuto) {
      autoShippingDiscount = originalShippingFee;
      autoVoucherCode = eligibleAuto.code;
    }

    const bestShippingDiscount = Math.max(autoShippingDiscount, manualShippingDiscount);
    const isAutoFreeshipApplied = bestShippingDiscount > 0 && autoShippingDiscount >= manualShippingDiscount;
    const isManualShipApplied = bestShippingDiscount > 0 && manualShippingDiscount > autoShippingDiscount;

    const finalShippingFee = Math.max(0, originalShippingFee - bestShippingDiscount);
    const grandTotal = Math.max(0, subtotal - manualProductDiscount + finalShippingFee);

    return {
      subtotal,
      originalShippingFee,
      finalShippingFee,
      manualProductDiscount,
      bestShippingDiscount,
      grandTotal,
      isAutoFreeshipApplied,
      isManualShipApplied,
      appliedVoucherCode: isAutoFreeshipApplied ? autoVoucherCode : appliedVoucher?.code,
    };
  }, [subtotal, selectedShipping, appliedVoucher, autoVouchers]);

  // 5) ÁP MÃ VOUCHER TAY (API thật)
  const handleApplyVoucher = useCallback(async () => {
    if (!voucherCode.trim()) {
      setVoucherError('Vui lòng nhập mã voucher');
      return;
    }
    setVoucherLoading(true);
    setVoucherError(null);
    setAppliedVoucher(null);
    try {
      const res = await api('/vouchers/apply', {
        method: 'POST',
        body: JSON.stringify({
          code: voucherCode,
          subtotal,          // dùng subtotal thực
          customer_id: null,
        }),
      });
      if (res.ok && res.valid) {
        setAppliedVoucher(res);
      } else {
        throw new Error(res.message || 'Mã voucher không hợp lệ');
      }
    } catch (e: any) {
      setVoucherError(e.message || 'Mã voucher không hợp lệ');
      setAppliedVoucher(null);
    } finally {
      setVoucherLoading(false);
    }
  }, [voucherCode, subtotal]);

  const clearVoucher = () => {
    setVoucherCode('');
    setAppliedVoucher(null);
    setVoucherError(null);
  };

  // 6) ĐẶT HÀNG (API thật) — chặn double submit, validate chặt
  const submit = useCallback(async (): Promise<void> => {
    setError(null);
    setSubmitting(true);

    if (!form.name || !form.phone) {
      setError('Vui lòng nhập họ tên và số điện thoại'); setSubmitting(false); return;
    }
    const phoneRegex = /^(03|05|07|08|09)\d{8}$/;
    if (!phoneRegex.test(form.phone.replace(/\D/g, ''))) {
      setError('Số điện thoại không hợp lệ'); setSubmitting(false); return;
    }
    if (!form.province || !form.district || !form.ward) {
      setError('Vui lòng chọn đầy đủ địa chỉ'); setSubmitting(false); return;
    }
    if (!form.address.trim() || form.address.trim().length < 10) {
      setError('Vui lòng nhập địa chỉ chi tiết (số nhà, tên đường) tối thiểu 10 ký tự');
      setSubmitting(false); return;
    }
    const localW = (() => { try { return Number(localStorage.getItem('cart_weight_gram') || 0); } catch { return 0; } })();
    const effWeight = Number(serverWeight || localW || totalWeightGram || 0);
    if (effWeight <= 0) {
      setError('Thiếu trọng lượng sản phẩm. Vui lòng bổ sung cân nặng trước khi đặt.');
      setSubmitting(false); return;
    }
    if (!selectedShipping) {
      setError('Vui lòng chọn phương thức vận chuyển'); setSubmitting(false); return;
    }

    const {
      subtotal: sub,
      originalShippingFee,
      manualProductDiscount,
      bestShippingDiscount,
      grandTotal,
      appliedVoucherCode,
    } = calculatedTotals;

    const payload = {
      customer: {
        name: form.name,
        phone: form.phone.replace(/\D/g, ''),
        address: form.address,
        province_code: form.province,
        district_code: form.district,
        commune_code: form.ward,
        ward_code: form.ward,
        province: provinces.find((p) => p.code === form.province)?.name || '',
        district: districts.find((d) => d.code === form.district)?.name || '',
        commune: wards.find((w) => w.code === form.ward)?.name || '',
      },
      items: st.lines.map((item: any) => ({
        id: item.id,
        sku: item.sku || item.id,
        name: item.name,
        price: Number(item.price || 0),
        cost: Number(item.cost || 0),
        qty: Number(item.qty || 1),
        weight_gram: Number(
          item.weight_gram ??
          item.weight_grams ??
          item.weight ??
          item.variant?.weight_gram ??
          0
        ),
        variant: item.variantName || '',
        image: item.variantImage || item.image || '',
      })),
      totals: {
        subtotal: sub,
        shipping_fee: originalShippingFee,
        discount: manualProductDiscount,
        shipping_discount: bestShippingDiscount,
        total: grandTotal,
      },
      shipping_provider: selectedShipping.provider,
      shipping_service: selectedShipping.service_code,
      shipping_name: selectedShipping.name,
      shipping_eta: selectedShipping.eta,
      shipping_fee: originalShippingFee,
      discount: manualProductDiscount,
      shipping_discount: bestShippingDiscount,
      voucher_code: appliedVoucherCode || '',
      note: form.note || '',
      // ✅ THÊM CHO XEM HÀNG
      allow_inspection: allowInspection,
      cod_amount: allowInspection ? grandTotal : 0,
      source: 'mini',
      status: 'placed',
    };

    try {
      const data = await api('/api/orders', {
        method: 'POST',
        headers: {
          'Idempotency-Key': 'order-' + Date.now() + '-' + Math.random().toString(36).slice(2),
        },
        body: JSON.stringify(payload),
      });

      if (data.ok || data.id) {
        setDone({ kind: 'server', data, endpoint: '/api/orders', orderId: data.id || data.order_id });
        cart.clear();
        setSt(cart.get());
      } else {
        throw new Error(data.error || data.message || 'Đặt hàng thất bại');
      }
    } catch (e: any) {
      setError(e.message || 'Có lỗi xảy ra khi đặt hàng');
    } finally {
      setSubmitting(false);
    }
  }, [form, selectedShipping, st, subtotal, totalWeightGram, serverWeight, provinces, districts, wards, calculatedTotals]);

  // === ẢNH SẢN PHẨM ==========================================================
  const getItemImage = useCallback((item: any) => {
    const rawImg = item.variantImage || item.image || '/icon.png';
    return cloudify(rawImg, 'w_200,h_200,c_fill,q_auto,f_auto');
  }, []);

  // === UI ====================================================================
  return (
    <div className="min-h-screen bg-gray-50">
      <main className="max-w-4xl mx-auto p-3 pb-20">
        <h1 className="text-xl font-bold mb-3">Thanh toán</h1>

        {st.lines.length === 0 && !done && (
          <div className="text-center text-gray-500 py-8">Giỏ hàng trống.</div>
        )}

        {done ? (
          // === THÀNH CÔNG =====================================================
          <div className="bg-white rounded-2xl p-6 shadow">
            <div className="text-center">
              <div className="text-6xl mb-4">✅</div>
              <div className="text-xl font-bold mb-2">Đặt hàng thành công!</div>
              <div className="text-sm text-gray-600 mb-1">Đã gửi đơn lên máy chủ ({done.endpoint})</div>
              {done.orderId && (
                <div className="text-sm text-gray-500 mb-4">
                  Mã đơn hàng: <span className="font-mono font-semibold">{done.orderId}</span>
                </div>
              )}
              <div className="text-gray-700 mb-6">Cảm ơn bạn đã mua hàng.</div>
              <a
                href="/"
                className="inline-block px-8 py-3 bg-rose-600 text-white rounded-xl hover:bg-rose-700 transition-colors font-semibold"
              >
                Về trang chủ
              </a>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* === ĐƠN HÀNG ===================================================== */}
            <div className="bg-white rounded-2xl p-4 shadow">
              <div className="font-semibold mb-3">Đơn hàng ({(selectedLines||[]).length} sản phẩm)</div>
             <div className="space-y-3 max-h-96 overflow-y-auto">
                {(selectedLines||[]).map((l: any) => (
                  <div key={String(l.id)} className="flex gap-3 p-3 border rounded-xl">
                    <img
                      src={getItemImage(l)}
                      className="w-20 h-20 rounded-xl object-cover flex-shrink-0 border"
                      alt={l.name}
                      loading="lazy"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm line-clamp-2 mb-1">{l.name}</div>
                      {l.variantName && (
                        <div className="mb-2">
                          <span className="inline-block px-2 py-1 text-xs rounded-lg bg-blue-50 text-blue-700 border border-blue-200">
                            {l.variantName}
                          </span>
                        </div>
                      )}
                      <div className="flex items-center justify-between">
                        <div className="text-rose-600 font-semibold">{fmtVND(l.price)}</div>
                        <div className="text-sm text-gray-600">
                          x <span className="font-semibold">{l.qty}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* === ĐỊA CHỈ NHẬN HÀNG =========================================== */}
            <div className="bg-white rounded-2xl p-4 shadow space-y-3">
              <div className="font-semibold text-lg">Địa chỉ nhận hàng</div>

              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Họ tên *"
                className="w-full rounded-xl border border-gray-300 px-4 py-3 focus:ring-2 focus:ring-rose-500 focus:border-rose-500 outline-none"
                required
              />

              <input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="Số điện thoại *"
                type="tel"
                className="w-full rounded-xl border border-gray-300 px-4 py-3 focus:ring-2 focus:ring-rose-500 focus:border-rose-500 outline-none"
                required
              />

              <select
                value={form.province}
                onChange={(e) => setForm({ ...form, province: e.target.value, district: '', ward: '' })}
                className="w-full rounded-xl border border-gray-300 px-4 py-3 focus:ring-2 focus:ring-rose-500 focus:border-rose-500 outline-none"
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
                onChange={(e) => setForm({ ...form, district: e.target.value, ward: '' })}
                className="w-full rounded-xl border border-gray-300 px-4 py-3 focus:ring-2 focus:ring-rose-500 focus:border-rose-500 outline-none"
                disabled={!form.province || loadingDistricts}
              >
                <option value="">{loadingDistricts ? 'Đang tải...' : '-- Chọn Quận/Huyện *'}</option>
                {districts.map((d) => (
                  <option key={d.code || d.id} value={d.code || d.id}>
                    {d.name || d.label}
                  </option>
                ))}
              </select>

              <select
                value={form.ward}
                onChange={(e) => setForm({ ...form, ward: e.target.value })}
                className="w-full rounded-2xl border border-gray-300 px-4 py-3 focus:ring-2 focus:ring-rose-500 focus:border-rose-500 outline-none"
                disabled={!form.district || loadingWards}
              >
                <option value="">{loadingWards ? 'Đang tải...' : '-- Chọn Phường/Xã *'}</option>
                {wards.map((w) => (
                  <option key={w.code || w.id} value={w.code || w.id}>
                    {w.name || w.label}
                  </option>
                ))}
              </select>

              <input
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                placeholder="Địa chỉ chi tiết (số nhà, tên đường) *"
                className="w-full rounded-xl border border-gray-300 px-4 py-3 focus:ring-2 focus:ring-rose-500 focus:border-rose-500 outline-none"
                required
              />

              <input
                value={form.note}
                onChange={(e) => setForm({ ...form, note: e.target.value })}
                placeholder="Ghi chú (không bắt buộc)"
                className="w-full rounded-xl border border-gray-300 px-4 py-3 focus:ring-2 focus:ring-rose-500 focus:border-rose-500 outline-none"
              />
            </div>

            {/* === VẬN CHUYỂN (API thật, không fallback) ======================= */}
            <div className="bg-white rounded-2xl p-4 shadow space-y-3">
              <div className="font-semibold text-lg">Vận chuyển</div>
              <div className="text-sm text-gray-600">
                Khối lượng: {toHumanWeight(effectiveWeightGram)}
              </div>
                          {(
              Number(serverWeight || 0) <= 0 &&
              Number((() => { try { return localStorage.getItem('cart_weight_gram'); } catch { return '0'; } })()) <= 0 &&
              totalWeightGram <= 0
            ) && (
              <div className="text-sm text-red-600 mt-2">
                ⚠️ Thiếu trọng lượng sản phẩm. Không thể tính phí vận chuyển.
              </div>
            )}


              {!form.province || !form.district ? (
                <div className="text-sm text-gray-500 py-4 text-center">
                  Vui lòng chọn tỉnh / quận để xem phí vận chuyển
                </div>
              ) : shippingLoading ? (
                <div className="text-sm text-gray-500 py-4 text-center">Đang lấy phí vận chuyển…</div>
              ) : shippingError ? (
                <div className="text-sm text-red-600 py-4 text-center">{shippingError}</div>
              ) : shippingList.length > 0 ? (
                <div className="space-y-2">
                  {shippingList.map((item, idx) => (
                    <label
                      key={idx}
                      className={`flex items-center justify-between border rounded-xl p-4 cursor-pointer transition-all ${
                        selectedShipping?.provider === item.provider &&
                        selectedShipping?.service_code === item.service_code
                          ? 'border-rose-500 bg-rose-50'
                          : 'border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center gap-3 flex-1">
                        <input
                          type="radio"
                          name="ship_opt"
                          checked={
                            selectedShipping?.provider === item.provider &&
                            selectedShipping?.service_code === item.service_code
                          }
                          onChange={() => setSelectedShipping(item)}
                          className="w-4 h-4 text-rose-600"
                        />
                        <div>
                          <div className="font-semibold">{item.name}</div>
                          <div className="text-sm text-gray-600">{item.eta}</div>
                        </div>
                      </div>
                      <div className="font-bold text-rose-600 text-lg">{fmtVND(item.fee)}</div>
                    </label>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-gray-500 py-4 text-center">
                  Không có gói vận chuyển phù hợp.
                </div>
              )}
            </div>

            {/* === VOUCHER ===================================================== */}
            <div className="bg-white rounded-2xl p-4 shadow space-y-3">
              <div className="font-semibold text-lg">Mã giảm giá</div>
              {appliedVoucher ? (
                <div className="bg-green-50 border border-green-200 rounded-xl p-3">
                  <div className="flex justify-between items-center">
                    <div className="text-green-700 font-semibold">✓ Đã áp dụng: {appliedVoucher.code}</div>
                    <button onClick={clearVoucher} className="text-red-500 font-semibold text-sm">
                      Gỡ
                    </button>
                  </div>
                  <div className="text-sm text-green-600 mt-1">
                    {appliedVoucher.message || 'Áp dụng thành công'}
                  </div>
                </div>
              ) : (
                <div className="flex gap-2">
                  <input
                    value={voucherCode}
                    onChange={(e) => setVoucherCode(e.target.value.toUpperCase())}
                    placeholder="Nhập mã giảm giá"
                    className="flex-1 w-full rounded-xl border border-gray-300 px-4 py-3 focus:ring-2 focus:ring-rose-500 focus:border-rose-500 outline-none"
                    disabled={voucherLoading}
                  />
                  <button
                    onClick={handleApplyVoucher}
                    disabled={voucherLoading}
                    className="px-5 py-3 bg-rose-600 text-white rounded-xl font-semibold hover:bg-rose-700 disabled:bg-gray-300"
                  >
                    {voucherLoading ? 'Đang…' : 'Áp dụng'}
                  </button>
                </div>
              )}
              {voucherError && !appliedVoucher && (
                <div className="text-red-600 text-sm mt-2">{voucherError}</div>
              )}
            </div>

            {/* === CHI TIẾT THANH TOÁN ======================================== */}
            <div className="bg-white rounded-2xl p-4 shadow">
              <div className="font-semibold mb-3 text-lg">Chi tiết thanh toán</div>

              {/* ✅ CHECKBOX CHO XEM HÀNG */}
              <label className="flex items-start gap-3 p-3 mb-3 border-2 border-blue-200 bg-blue-50 rounded-xl cursor-pointer">
                <input
                  type="checkbox"
                  checked={allowInspection}
                  onChange={(e) => setAllowInspection(e.target.checked)}
                  className="w-5 h-5 mt-0.5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                />
                <div className="flex-1">
                  <div className="font-semibold text-sm text-blue-900">✓ Cho xem hàng trước khi thanh toán</div>
                  <div className="text-xs text-blue-700 mt-1">
                    Bạn có thể kiểm tra hàng trước khi thanh toán cho shipper
                  </div>
                </div>
              </label>

              <div className="flex justify-between py-3 border-t mt-3 text-lg font-bold">
                <span>Tổng thanh toán:</span>
                <span className="text-rose-600 text-xl">{fmtVND(calculatedTotals.grandTotal)}</span>
              </div>

              {/* ✅ HIỂN THỊ TRẠNG THÁI COD */}
              {allowInspection && (
                <div className="text-sm text-blue-700 bg-blue-50 p-3 rounded-lg border border-blue-200 mt-2">
                  💰 Thanh toán khi nhận hàng (COD): <span className="font-bold">{fmtVND(calculatedTotals.grandTotal)}</span>
                </div>
              )}

              {error && (
                <div className="text-red-600 text-sm mt-3 bg-red-50 p-3 rounded-lg border border-red-200">
                  ⚠️ {error}
                </div>
              )}

              <button
                disabled={disabled}
                onClick={submit}
                className="w-full rounded-xl bg-rose-600 disabled:bg-gray-300 text-white py-4 mt-4 font-bold text-lg hover:bg-rose-700 transition-colors disabled:cursor-not-allowed shadow-lg"
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

// === UTIL: hiển thị khối lượng đẹp ==========================================
function toHumanWeight(grams: number) {
  const g = Number(grams || 0);
  if (g <= 0) return '0 g';
  if (g < 1000) return `${g} g`;
  const kg = g / 1000;
  return kg % 1 === 0 ? `${kg.toFixed(0)} kg` : `${kg.toFixed(1)} kg`;
}
