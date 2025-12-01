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
import { Page, useNavigate } from 'zmp-ui';
import { routes } from '@/routes';
import Header from '../components/Header';
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
      product_id: it.productId || it.product_id || it.pid || it.id,
      variant_id: it.variant_id || it.variantId || it.vid || it.variant?.id || '',
      variant_sku: it.variant_sku || it.sku || it.variant?.sku || '',
      variant_name: it.variant_name || it.variantName || it.variant?.name || it.variant?.title || '',
      // nếu client đã có cân nặng biến thể thì gửi luôn cho server dùng trực tiếp
      weight_gram: Number(it.weight_gram ?? it.weight ?? it.variant?.weight_gram ?? 0) || 0,
      qty: Number(it.qty || it.quantity || 1),
    })),
  };
  const data = await api('/shipping/weight', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  const g = Number(
    (data && (data.total_gram ?? data.totalGram)) ??
    (data && data.data && (data.data.total_gram ?? data.data.totalGram)) ??
    0
  );
  if (g > 0) {
    try { localStorage.setItem('cart_weight_gram', String(g)); } catch {}
  }
  return g;
};



export default function Checkout() {
  const navigate = useNavigate();

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
    // ƯU TIÊN key riêng của Mini: shv_checkout_lines
    try {
      const rawMini = localStorage.getItem('shv_checkout_lines');
      if (rawMini) {
        const arr = JSON.parse(rawMini);
        if (Array.isArray(arr) && arr.length) return arr;
      }
    } catch {}

    // Fallback: key cũ dùng chung với FE
    try {
      const ck = JSON.parse(localStorage.getItem('checkout_items') || '[]');
      if (Array.isArray(ck) && ck.length) return ck;
    } catch {}

    // Fallback cuối: lọc theo cart_selected_ids hoặc lấy toàn bộ giỏ
    const all = Array.isArray(st?.lines) ? st.lines : [];
    if (selectedIds.size === 0) return all;
    return all.filter((l: any) => selectedIds.has(String(l?.id)));
  }, [st, selectedIds]);


    // === FORM NHẬN HÀNG ========================================================
  const [selectedAddress, setSelectedAddress] = useState<any>(null);

  const [form, setForm] = useState<any>({
    name: '',
    phone: '',
    province: '',
    district: '',
    ward: '',
    address: '',
    note: '',
  });

    // Đọc địa chỉ đã chọn từ localStorage và tự fill form (gọi lại khi trang được focus/quay lại)
  const loadSelectedAddress = useCallback(() => {
    try {
      const raw = localStorage.getItem('address:selected');
      const a = raw ? JSON.parse(raw) : null;
      setSelectedAddress(a);
      if (a) {
        setForm((f: any) => ({
          ...f,
          name: a.name || f.name,
          phone: a.phone || f.phone,
          province: a.province_code || f.province,
          district: a.district_code || f.district,
          ward: a.ward_code || f.ward,
          address: a.address || f.address,
        }));
      }
    } catch {}
  }, []);

  useEffect(() => {
    loadSelectedAddress();
    const onShow = () => loadSelectedAddress();
    document.addEventListener('visibilitychange', onShow);
    window.addEventListener('pageshow', onShow);
    return () => {
      document.removeEventListener('visibilitychange', onShow);
      window.removeEventListener('pageshow', onShow);
    };
  }, [loadSelectedAddress]);

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

    // subtotal = Σ (price * qty)
  // ✅ ƯU TIÊN các dòng được chọn, nếu không có thì fallback toàn bộ giỏ (st.lines)
  const subtotal = useMemo(
    () => {
      const src = Array.isArray(selectedLines) && selectedLines.length > 0
        ? selectedLines
        : (st.lines || []);

      return (Array.isArray(src) ? src : []).reduce(
        (s: number, it: any) => s + Number(it.price || 0) * Number(it.qty || 1),
        0
      );
    },
    [selectedLines, st.lines]
  );


// totalWeightGram = Σ ( (weight_gram || weight_grams || weight || variant.weight_gram) * qty )
// Nếu item không có cân nặng => tính 0 cho item đó (đúng yêu cầu "không fallback").
// ✅ ƯU TIÊN dòng được chọn, fallback toàn bộ giỏ khi chưa có selectedLines
const totalWeightGram = useMemo(() => {
  const src = Array.isArray(selectedLines) && selectedLines.length > 0
    ? selectedLines
    : (st.lines || []);

  return (Array.isArray(src) ? src : []).reduce((sum: number, it: any) => {
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
}, [selectedLines, st.lines]);


// Nếu thiếu cân nặng ở cart → hỏi server để lấy total_gram thật
const [weightOverride, setWeightOverride] = useState<number | null>(null);

const ensureLocalWeight = useCallback(async () => {
  if (totalWeightGram > 0) { setWeightOverride(null); return; }
  try {
    const src = Array.isArray(selectedLines) ? selectedLines : (st.lines || []);
const lines = src.map((it: any, idx: number) => ({
  product_id: it.productId || it.product_id || it.pid || it.id,
  variant_id: it.variant_id || it.variantId || it.vid || it.variant?.id || '',
  variant_sku: it.variant_sku || it.sku || it.variant?.sku || '',
  variant_name: it.variant_name || it.variantName || it.variant?.name || it.variant?.title || '',
  // nếu client đã có cân nặng biến thể thì gửi luôn cho server dùng trực tiếp
  weight_gram: Number(it.weight_gram ?? it.weight ?? it.variant?.weight_gram ?? 0) || 0,
  qty: Number(it.qty || it.quantity || 1),
}));
    const res = await api('/shipping/weight', {
      method: 'POST',
      body: JSON.stringify({ lines }),
      headers: { 'Content-Type': 'application/json' },
    });
    // đồng bộ cách đọc với PATCH 1
    const g = Number(
      (res && (res.total_gram ?? res.totalGram)) ??
      (res && (res.data?.total_gram ?? res.data?.totalGram)) ??
      0
    );
    if (g > 0) {
      setWeightOverride(g);
      try { localStorage.setItem('cart_weight_gram', String(g)); } catch {}
    }
  } catch { /* ignore */ }
}, [st, totalWeightGram, selectedLines]);

useEffect(() => { ensureLocalWeight(); }, [ensureLocalWeight, selectedLines]);

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

  const disabled =
    !Array.isArray(selectedLines) || selectedLines.length === 0 || submitting;


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
        const list = data.items || data.data || [];
        setProvinces(list);

        // Nếu thiếu province_code nhưng có province_name → tự map
        if (selectedAddress && !form.province && selectedAddress.province_name) {
          const p = list.find((x: any) =>
            String(x.name || '').toLowerCase() === String(selectedAddress.province_name || '').toLowerCase()
          );
          if (p?.code) setForm((f: any) => ({ ...f, province: p.code }));
        }
      } catch (e) {
        console.error('Load provinces error:', e);
      } finally {
        if (alive) setLoadingProvinces(false);
      }
    })();
    return () => { alive = false; };
  }, [selectedAddress]);  // phụ thuộc selectedAddress để map lại khi quay về


    useEffect(() => {
    setDistricts([]); setWards([]);
    if (!form.province) return;
    let alive = true;
    setLoadingDistricts(true);
    (async () => {
      try {
        const data = await api(`/shipping/districts?province_code=${encodeURIComponent(form.province)}`);
        if (!alive) return;
        const list = data.items || data.data || [];
        setDistricts(list);

        // Nếu thiếu district_code nhưng có district_name → tự map
        if (selectedAddress && !form.district && selectedAddress.district_name) {
          const d = list.find((x: any) =>
            String(x.name || '').toLowerCase() === String(selectedAddress.district_name || '').toLowerCase()
          );
          if (d?.code) setForm((f: any) => ({ ...f, district: d.code }));
        }
      } catch (e) {
        console.error('Load districts error:', e);
      } finally {
        if (alive) setLoadingDistricts(false);
      }
    })();
    return () => { alive = false; };
  }, [form.province, selectedAddress]);

    useEffect(() => {
    setWards([]);
    if (!form.district) return;
    let alive = true;
    setLoadingWards(true);
    (async () => {
      try {
        const data = await api(`/shipping/wards?district_code=${encodeURIComponent(form.district)}`);
        if (!alive) return;
        const list = data.items || data.data || [];
        setWards(list);

        // Nếu thiếu ward_code nhưng có ward_name → tự map
        if (selectedAddress && !form.ward && selectedAddress.ward_name) {
          const w = list.find((x: any) =>
            String(x.name || '').toLowerCase() === String(selectedAddress.ward_name || '').toLowerCase()
          );
          if (w?.code) setForm((f: any) => ({ ...f, ward: w.code }));
        }
      } catch (e) {
        console.error('Load wards error:', e);
      } finally {
        if (alive) setLoadingWards(false);
      }
    })();
    return () => { alive = false; };
  }, [form.district, selectedAddress]);

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

                // dùng cân nặng hiệu lực: override từ server > local tính được
        let weightToUse = Number((weightOverride ?? totalWeightGram) || 0);
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
        
        // ✅ TÌM ĐƠN VỊ VẬN CHUYỂN GIÁ RẺ NHẤT
        const allItems = (Array.isArray(rawItems) ? rawItems : []).map((it: any) => ({
          provider: String(it.provider || '').toLowerCase(),
          originalProvider: it.provider,
          name: it.name || it.provider,
          service_code: it.service_code,
          fee: Number(it.fee || 0),
          eta: it.eta || 'Giao hàng tiêu chuẩn',
        }));

        // Tìm item có phí thấp nhất
        const cheapestItem = allItems.reduce((min, item) => 
          (item.fee > 0 && item.fee < min.fee) ? item : min
        , allItems[0] || { fee: Infinity });
        
        // Tạo 1 option duy nhất: "Vận chuyển nhanh" = giá rẻ nhất
        const items = cheapestItem && cheapestItem.fee !== Infinity ? [{
          ...cheapestItem,
          name: 'Vận chuyển nhanh',
          eta: 'HCM: 1-2 ngày | Miền Tây: 1-3 ngày | Miền Trung: 2-4 ngày | Miền Bắc: 3-5 ngày'
        }] : [];

        if (!alive) return;

        setShippingList(items);
        
        // Tự động chọn option duy nhất
        setSelectedShipping(items[0] || null);
        
        if (items.length === 0) {
          setShippingError('Không có gói vận chuyển phù hợp. Vui lòng thử lại sau.');
        }
      } catch (e: any) {
        if (!alive) return;
        console.error('Get shipping quote error:', e);
        setShippingList([]);
        setSelectedShipping(null);
        setShippingError(e.message || 'Không lấy được phí vận chuyển. Vui lòng thử lại sau.');
      } finally {
        if (alive) setShippingLoading(false);
      }
    })();

    return () => { alive = false; };
    }, [form.province, form.district, form.ward, totalWeightGram, weightOverride, subtotal, st.lines, provinces, districts, selectedLines]);

  // 4.a) SERVER PRICING STATE + HELPER
const [serverTotals, setServerTotals] = useState<any>(null);

const reprice = useCallback(async () => {
  try {
    const linesForOrder =
      Array.isArray(selectedLines) && selectedLines.length ? selectedLines : (st.lines || []);
    const payload = {
      items: (linesForOrder || []).map((item: any) => ({
        id: item.id,
        sku: item.sku || item.id,
        qty: Number(item.qty || 1),
        price: Number(item.price || 0),
        cost: Number(item.cost || 0),
      })),
      shipping_fee: Number(selectedShipping?.fee || 0),
      voucher_code: appliedVoucher?.code || null,
      totals: {
        subtotal: Number(subtotal || 0),
        shipping_fee: Number(selectedShipping?.fee || 0),
        voucher_code: appliedVoucher?.code || null,
      }
    };
    const data = await api('/orders/price', { method: 'POST', body: JSON.stringify(payload) });
    const t = data?.totals || data || {};
    setServerTotals({
      subtotal: Number(t.subtotal || 0),
      shipping_fee: Number(t.shipping_fee || 0),
      discount: Number(t.discount || 0),
      shipping_discount: Number(t.shipping_discount || 0),
      voucher_code: t.voucher_code || null,
    });
  } catch (e) {
    console.error('orders/price error:', e);
    setServerTotals(null);
  }
}, [selectedLines, st.lines, selectedShipping, appliedVoucher, subtotal]);

// 4.b) TRIGGER REPRICE KHI LINES/SHIP/VOUCHER ĐỔI
useEffect(() => {
  if (selectedShipping) reprice();
}, [selectedShipping, appliedVoucher, st.lines, selectedLines, subtotal, reprice]);

// 4) TÍNH TỔNG (bám FE, dùng subtotal thực)

    const calculatedTotals = useMemo(() => {
  // ✅ ƯU TIÊN TỔNG TỪ SERVER (orders/price)
  if (serverTotals) {
    const originalShippingFee = selectedShipping?.fee || 0;
    const finalShippingFee = Math.max(0, (serverTotals.shipping_fee || 0) - (serverTotals.shipping_discount || 0));
    const grandTotal = Math.max(0, (serverTotals.subtotal || 0) + finalShippingFee - (serverTotals.discount || 0));
    return {
      subtotal: serverTotals.subtotal ?? subtotal ?? 0,
      originalShippingFee,
      finalShippingFee,
      manualProductDiscount: serverTotals.discount || 0,
      bestShippingDiscount: serverTotals.shipping_discount || 0,
      grandTotal,
      isAutoFreeshipApplied: (serverTotals.shipping_discount || 0) >= originalShippingFee,
      isManualShipApplied: (serverTotals.shipping_discount || 0) > 0,
      appliedVoucherCode: serverTotals.voucher_code || appliedVoucher?.code || null,
    };
  }


  // Fallback: logic cũ của bạn
    const originalShippingFee = selectedShipping?.fee || 0;
  const manualProductDiscount = appliedVoucher?.discount || 0;
  const manualShippingDiscount = appliedVoucher?.ship_discount || 0;

  let autoShippingDiscount = 0;
  let autoVoucherCode: string | null = null;
  const eligibleAuto = autoVouchers.find((v: any) => subtotal >= (v.min_purchase || 0));
  if (eligibleAuto) {
    autoShippingDiscount = originalShippingFee;
    autoVoucherCode = eligibleAuto.code;
  }

  const bestShippingDiscount = Math.max(manualShippingDiscount, autoShippingDiscount);
  const isAutoFreeshipApplied = autoShippingDiscount >= manualShippingDiscount && autoShippingDiscount > 0;
  const isManualShipApplied = manualShippingDiscount > autoShippingDiscount && manualShippingDiscount > 0;

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
}, [serverTotals, subtotal, selectedShipping, appliedVoucher, autoVouchers]);


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
        await reprice(); // ✅ cập nhật tổng theo server
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

    // Chỉ gửi những dòng đang được chọn; nếu vì lý do nào đó không có selectedLines thì fallback toàn bộ giỏ
    const linesForOrder =
      Array.isArray(selectedLines) && selectedLines.length
        ? selectedLines
        : (st.lines || []);

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
     // [FIX-MINI-FINAL] Đồng bộ chính xác 100% với checkout.js (Web)
      items: (linesForOrder || []).map((item: any) => ({
        // Web gửi key 'id' -> MiniApp cũng phải gửi key 'id' thì Admin mới nhận
        id: item.id || item.product_id || item.productId || item.sku || '', 
        
        sku: item.sku || item.id || '',
        name: item.name || item.title,
        
        // Web gửi key 'variant' -> MiniApp cũng phải gửi key 'variant'
        variant: item.variantName || item.variant || '', 
        
        // Web gửi cả 2 trường ảnh -> MiniApp copy y hệt
        variantImage: item.variantImage || item.image || '',
        image: item.variantImage || item.image || '',
        
        qty: Number(item.qty || item.quantity || 1),
        price: Number(item.sale_price || item.price || 0),
        cost: Number(item.cost || 0),
        
        // Web gửi cả 3 key cân nặng -> MiniApp làm theo cho chắc
        weight_gram: Number(item.weight_gram || item.weight_grams || item.weight || 0),
        weight_grams: Number(item.weight_gram || item.weight_grams || item.weight || 0),
        weight: Number(item.weight_gram || item.weight_grams || item.weight || 0)
      })),
            totals: {
        subtotal: serverTotals?.subtotal ?? sub,
        shipping_fee: serverTotals?.shipping_fee ?? originalShippingFee,
        discount: serverTotals?.discount ?? manualProductDiscount,
        shipping_discount: serverTotals?.shipping_discount ?? bestShippingDiscount,
        total: serverTotals
          ? Math.max(0, (serverTotals.subtotal||0) + Math.max(0,(serverTotals.shipping_fee||0)-(serverTotals.shipping_discount||0)) - (serverTotals.discount||0))
          : grandTotal,
        voucher_code: (serverTotals?.voucher_code ?? appliedVoucherCode) || '',
      },


      shipping_provider: selectedShipping.originalProvider || selectedShipping.provider,
      shipping_service: selectedShipping.service_code,
      shipping_name: selectedShipping.name,
      shipping_eta: selectedShipping.eta,
      shipping_fee: serverTotals?.shipping_fee ?? originalShippingFee,
      discount: serverTotals?.discount ?? manualProductDiscount,
      shipping_discount: serverTotals?.shipping_discount ?? bestShippingDiscount,
      voucher_code: (serverTotals?.voucher_code ?? appliedVoucherCode) || '',

      note: form.note || '',
      // ✅ THÊM CHO XEM HÀNG
      allow_inspection: allowInspection,
      cod_amount: allowInspection ? grandTotal : 0,
      source: 'mini',
      status: 'placed',
      total_weight_gram: Number(serverWeight || totalWeightGram || 0),
      totalWeightGram: Number(serverWeight || totalWeightGram || 0),
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
    }, [form, selectedShipping, st, selectedLines, subtotal, totalWeightGram, serverWeight, provinces, districts, wards, calculatedTotals]);


  // === ẢNH SẢN PHẨM ==========================================================
  const getItemImage = useCallback((item: any) => {
    const rawImg = item.variantImage || item.image || '/icon.png';
    return cloudify(rawImg, 'w_200,h_200,c_fill,q_auto,f_auto');
  }, []);

    // === TỰ ĐỘNG CHUYỂN VỀ ACCOUNT SAU 5S KHI ĐẶT HÀNG THÀNH CÔNG ============
  useEffect(() => {
    if (done) {
      const timer = setTimeout(() => {
        navigate('/account');
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [done, navigate]);

  // === UI ====================================================================
    return (
        <Page className="bg-gray-50">
      <Header
        forceShow
        variant="mini"
        showBack
        onBack={() => navigate('/cart')}
      />

      <main className="max-w-4xl mx-auto p-3 pb-3">


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
                            <button
                onClick={() => navigate('/account')}
                className="inline-block px-8 py-3 bg-rose-600 text-white rounded-xl hover:bg-rose-700 transition-colors font-semibold"
              >
                Quản lý đơn hàng
              </button>
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

                        {/* === ĐỊA CHỈ NHẬN HÀNG (TRANG RIÊNG) ============================ */}
            <div className="bg-white rounded-2xl p-4 shadow space-y-3">
              <div className="flex items-center justify-between">
                <div className="font-semibold text-lg">Địa chỉ nhận hàng</div>
                <button
                  className="text-blue-600 text-sm font-medium"
                  onClick={() => navigate(`${routes.addressList}?return=/checkout`)}
                >
                  Thay đổi
                </button>
              </div>

              {selectedAddress ? (
                <div className="rounded-xl border p-3 bg-gray-50">
                  <div className="font-semibold">
                    {selectedAddress.name} <span className="text-gray-500">| {selectedAddress.phone}</span>
                  </div>
                  <div className="text-sm text-gray-700 mt-1">
                    {selectedAddress.address}
                    {selectedAddress.ward_name ? `, ${selectedAddress.ward_name}` : ''}
                    {selectedAddress.district_name ? `, ${selectedAddress.district_name}` : ''}
                    {selectedAddress.province_name ? `, ${selectedAddress.province_name}` : ''}
                  </div>
                </div>
              ) : (
                <div className="text-sm text-gray-600">
                  Chưa có địa chỉ giao hàng.{" "}
                   <button
                    className="text-blue-600 underline"
                    onClick={() => navigate(`${routes.addressList}?return=/checkout`)}
                  >
                    Thêm địa chỉ
                  </button>
                </div>
              )}

              {/* vẫn giữ ô ghi chú nếu bạn muốn dùng */}
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
                {Number((weightOverride ?? totalWeightGram) || 0) <= 0 && (
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
                <div>
                  {shippingList.map((item, idx) => (
                    <div
                      key={idx}
                      className="border-2 border-rose-500 bg-rose-50 rounded-xl p-4"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xl">🚚</span>
                            <span className="font-bold text-gray-800 text-base">{item.name}</span>
                          </div>
                          <div className="text-sm text-gray-600">{item.eta}</div>
                          <div className="text-xs text-gray-500 mt-1">
                            Được tối ưu từ {item.originalProvider || 'đơn vị vận chuyển'}
                          </div>
                        </div>
                        <div className="font-bold text-rose-600 text-xl ml-3">{fmtVND(item.fee)}</div>
                      </div>
                    </div>
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

              {/* ✅ BẢNG CHI TIẾT TIỀN */}
              <div className="mt-1 space-y-1 text-sm">
                <div className="flex justify-between">
                  <span>Tiền hàng</span>
                  <span className="font-medium">
                    {fmtVND(calculatedTotals.subtotal)}
                  </span>
                </div>

                <div className="flex justify-between">
                  <span>Phí vận chuyển</span>
                  <span className="font-medium">
                    {fmtVND(calculatedTotals.finalShippingFee)}
                  </span>
                </div>

                {(calculatedTotals.manualProductDiscount > 0 ||
                  calculatedTotals.bestShippingDiscount > 0) && (
                  <div className="flex justify-between text-emerald-700">
                    <span>
                      Giảm giá
                      {calculatedTotals.appliedVoucherCode
                        ? ` (${calculatedTotals.appliedVoucherCode})`
                        : ''}
                    </span>
                    <span className="font-medium">
                      -
                      {fmtVND(
                        (calculatedTotals.manualProductDiscount || 0) +
                          (calculatedTotals.bestShippingDiscount || 0),
                      )}
                    </span>
                  </div>
                )}
              </div>

              {/* ✅ TỔNG THANH TOÁN CUỐI CÙNG */}
              <div className="flex justify-between py-3 border-t mt-3 text-lg font-bold">
                <span>Tổng thanh toán:</span>
                <span className="text-rose-600 text-xl">
                  {fmtVND(calculatedTotals.grandTotal)}
                </span>
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
    </Page>
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
