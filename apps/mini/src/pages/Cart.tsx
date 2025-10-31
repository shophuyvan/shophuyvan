// apps/mini/src/pages/Cart.tsx
// =============================================================================
// CART PAGE (MiniApp) — đồng bộ hành vi với FE cart.html
// - Nhóm theo nguồn (Website / MiniApp)
// - Chọn/bỏ chọn tất cả, chọn theo nhóm, chọn từng dòng
// - Tính tạm tính / giảm giá / tổng thanh toán
// - 1 nút "Mua hàng" cố định dưới (sticky)
// - Đồng bộ localStorage + sự kiện 'shv:cart-changed' & 'storage'
// - Lưu "checkout_items" và "applied_voucher" trước khi điều hướng
// =============================================================================

import React, { useEffect, useState, useCallback } from 'react';
import cart from '@shared/cart';
import { fmtVND } from '@shared/utils/fmtVND';
import { cloudify } from '@shared/utils/cloudinary';
import { routes } from '../routes';

// ==== Kiểu dữ liệu 1 dòng trong giỏ ====
interface CartLine {
  id: string | number;
  name: string;
  image?: string;
  variantName?: string;
  variantImage?: string;
  price: number;
  original?: number | null;
  qty: number;
  // lưu ý: có thể kèm field 'source' để nhóm theo nguồn
}

export default function CartPage() {
  // ==== STATE CHÍNH CỦA GIỎ ====
  const [state, setState] = useState(cart.get());

  // ==== DANH SÁCH ĐÃ CHỌN (dưới dạng Set<string>) ====
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());

  // (đã bỏ voucher)

  // -----------------------------------------------------------------------------
  // EVENT BUS: thông báo cho các tab/component khác (đồng bộ theo FE)
  // -----------------------------------------------------------------------------
  const notify = useCallback(() => {
    try {
      // FE sử dụng 'shv:cart-changed' => giữ nguyên để tương thích
      window.dispatchEvent(new Event('shv:cart-changed'));
    } catch {}
  }, []);

  // -----------------------------------------------------------------------------
  // SUBSCRIBE CÁC SỰ KIỆN: storage / custom event / focus / visibility
  // -----------------------------------------------------------------------------
  useEffect(() => {
    const refresh = () => setState(cart.get());

    const onStorage = (e: StorageEvent) => {
      // đồng bộ khi khóa localStorage của giỏ thay đổi
      if (!e.key || (typeof e.key === 'string' && e.key.includes('shv_cart'))) {
        refresh();
      }
    };

    const onChanged = () => refresh();
    const onFocusOrVisible = () => refresh();

    window.addEventListener('storage', onStorage);
    window.addEventListener('shv:cart-changed', onChanged);
    window.addEventListener('focus', onFocusOrVisible);
    document.addEventListener('visibilitychange', onFocusOrVisible);

    refresh(); // tải lần đầu

    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('shv:cart-changed', onChanged);
      window.removeEventListener('focus', onFocusOrVisible);
      document.removeEventListener('visibilitychange', onFocusOrVisible);
    };
  }, []);

  // -----------------------------------------------------------------------------
  // CẬP NHẬT STATE SAU KHI SỬA GIỎ (wrapper)
  // -----------------------------------------------------------------------------
  const update = useCallback(() => {
    setState(cart.get());
  }, []);

  // -----------------------------------------------------------------------------
  // HANDLERS: tăng/giảm số lượng, xóa dòng, toggle chọn
  // -----------------------------------------------------------------------------
  const handleQtyChange = useCallback(
    (lineId: any, newQty: number) => {
      // FE: không cho qty < 1
      cart.setQty(lineId, Math.max(1, newQty));
      update();
      notify();
    },
    [update, notify]
  );

  const handleRemove = useCallback(
    (lineId: any) => {
      if (confirm('Bạn có chắc muốn xóa sản phẩm này?')) {
        cart.remove(lineId);

        // đồng bộ bỏ chọn nếu dòng đang được chọn
        const newSelected = new Set(selectedItems);
        newSelected.delete(String(lineId));
        setSelectedItems(newSelected);

        update();
        notify();
      }
    },
    [update, notify, selectedItems]
  );

  const toggleItem = useCallback(
    (lineId: string) => {
      const next = new Set(selectedItems);
      if (next.has(lineId)) next.delete(lineId);
      else next.add(lineId);
      setSelectedItems(next);
    },
    [selectedItems]
  );

  const toggleAll = useCallback(() => {
    if (selectedItems.size === state.lines.length) {
      // nếu đang chọn hết => bỏ chọn tất cả
      setSelectedItems(new Set());
    } else {
      // chọn tất cả
      setSelectedItems(new Set(state.lines.map(l => String(l.id))));
    }
  }, [selectedItems, state.lines]);

 // (đã bỏ voucher)
  // -----------------------------------------------------------------------------
  // IMAGE (đồng bộ FE): ưu tiên ảnh biến thể → ảnh sản phẩm → '/icon.png'
  // -----------------------------------------------------------------------------
  const getLineImage = useCallback((l: CartLine) => {
    const rawImg = l.variantImage || l.image || '/icon.png';
    return cloudify(rawImg, 'w_160,q_auto:eco,f_auto,c_fill');
  }, []);

  // -----------------------------------------------------------------------------
  // TÍNH TỔNG QUAN: subtotal / discount / total (áp dụng voucher)
  // -----------------------------------------------------------------------------
  // ✅ Chỉ cộng tiền theo giá đang bán, KHÔNG tính giảm giá
  const calculateSummary = useCallback(() => {
    let subtotal = 0;
    selectedItems.forEach(id => {
      const item = state.lines.find(l => String(l.id) === id);
      if (item) subtotal += item.price * item.qty;
    });
    const discount = 0; // không hiển thị giảm giá
    const total = subtotal;
    return { subtotal, discount, total };
  }, [selectedItems, state.lines]);

    // -----------------------------------------------------------------------------
  // CHECKOUT: lưu items (và set sẵn cân nặng tổng) rồi điều hướng
  // -----------------------------------------------------------------------------
  const handleCheckout = useCallback(() => {
    if (selectedItems.size === 0) {
      alert('Vui lòng chọn ít nhất 1 sản phẩm');
      return;
    }

    const selectedCartItems = state.lines.filter(l => selectedItems.has(String(l.id)));
    localStorage.setItem('checkout_items', JSON.stringify(selectedCartItems));

    // ✅ set sẵn tổng cân nặng theo mục đã chọn (gram)
    try {
      const totalWeight = selectedCartItems.reduce((s, it: any) => {
        const w = Number((it as any).weight_gram || (it as any).weight_grams || (it as any).weight || 0);
        return s + w * Number((it as any).qty || 1);
      }, 0);
      localStorage.setItem('cart_weight_gram', String(totalWeight));
    } catch {}

    // điều hướng
    window.location.href = routes.checkout;
  }, [selectedItems, state.lines]);


  // -----------------------------------------------------------------------------
  // PHÂN NHÓM: Website vs MiniApp (giống FE)
  // -----------------------------------------------------------------------------
  const isEmpty = !state || state.lines.length === 0;
  const summary = calculateSummary();
  const allSelected = state.lines.length > 0 && selectedItems.size === state.lines.length;

  const websiteItems = state.lines.filter((l: any) => {
    const source = l.source || 'website';
    return !source.includes('mini') && !source.includes('zalo');
  });

  const miniAppItems = state.lines.filter((l: any) => {
    const source = l.source || 'website';
    return source.includes('mini') || source.includes('zalo');
  });

  // -----------------------------------------------------------------------------
  // RENDER 1 NHÓM (Header checkbox nhóm + list item)
  // -----------------------------------------------------------------------------
  const renderGroup = (groupName: string, items: CartLine[]) => {
    if (items.length === 0) return null;

    // (bỏ chọn theo nhóm)

    return (
      <div className="bg-white rounded-2xl shadow mb-3 overflow-hidden">
        {/* ==== GROUP HEADER (không checkbox) ==== */}
        <div className="p-3 border-b">
          <span className="font-medium text-sm">{groupName}</span>
        </div>

        {/* ==== GROUP ITEMS ==== */}
        {items.map(l => {
          const lineId = String(l.id);
          const isSelected = selectedItems.has(lineId);

          return (
            <div
              key={lineId}
              className="p-3 border-b last:border-b-0 flex gap-3 items-start hover:bg-gray-50 transition-colors"
            >
              {/* Checkbox từng dòng */}
              <input
                type="checkbox"
                checked={isSelected}
                onChange={() => toggleItem(lineId)}
                className="w-4 h-4 mt-1 flex-shrink-0"
              />

              {/* Ảnh */}
              <img
                src={getLineImage(l)}
                className="w-20 h-20 rounded-xl object-cover flex-shrink-0"
                alt={l.variantName ? `${l.name} — ${l.variantName}` : l.name}
                loading="lazy"
              />

              {/* Chi tiết */}
              <div className="flex-1 min-w-0">

                {/* ==== NAME + VARIANT BADGE (như FE) ==== */}
                <div className="font-medium text-sm leading-5 mb-1">
                  <span className="block line-clamp-2">{l.name}</span>
                  {l.variantName && (
                    <span
                      className="inline-block mt-0.5 px-2 py-0.5 text-xs rounded bg-gray-100 text-gray-600"
                      title={l.variantName}
                    >
                      {l.variantName}
                    </span>
                  )}
                </div>

                {/* ==== PRICE (giá hiện hành + gạch giá gốc nếu có) ==== */}
                <div className="text-sm mb-2">
                  <span className="text-rose-600 font-semibold mr-2">
                    {fmtVND(l.price)}
                  </span>
                  {l.original && l.original > l.price && (
                    <span className="line-through text-gray-400 text-xs">
                      {fmtVND(l.original)}
                    </span>
                  )}
                </div>

                {/* ==== SỐ LƯỢNG + THAO TÁC + THÀNH TIỀN + XÓA ==== */}
                <div className="flex items-center justify-between">
                  {/* +/- số lượng */}
                  <div className="flex items-center border rounded-lg overflow-hidden">
                    <button
                      onClick={() => handleQtyChange(l.id, l.qty - 1)}
                      disabled={l.qty <= 1}
                      className="px-3 py-1 hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      −
                    </button>
                    <input
                      type="number"
                      min={1}
                      value={l.qty}
                      onChange={e => handleQtyChange(l.id, Number(e.target.value || 1))}
                      className="w-12 text-center border-x py-1 outline-none text-sm"
                    />
                    <button
                      onClick={() => handleQtyChange(l.id, l.qty + 1)}
                      className="px-3 py-1 hover:bg-gray-100 transition-colors"
                    >
                      +
                    </button>
                  </div>

                  {/* Thành tiền theo dòng */}
                  <div className="text-rose-600 font-semibold text-sm">
                    {fmtVND(l.price * l.qty)}
                  </div>

                  {/* Xóa dòng */}
                  <button
                    onClick={() => handleRemove(l.id)}
                    className="text-gray-500 hover:text-rose-600 transition-colors text-sm px-2"
                  >
                    Xóa
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  // -----------------------------------------------------------------------------
  // UI CHÍNH
  // -----------------------------------------------------------------------------
  return (
    <div className="min-h-screen bg-gray-50 pb-32">
      <main className="max-w-4xl mx-auto p-3">
        <h1 className="text-xl font-bold mb-3">Giỏ hàng</h1>

        {isEmpty ? (
          // ==== EMPTY STATE ====
          <div className="bg-white rounded-2xl p-8 shadow text-center">
            <div className="text-6xl mb-3">🛒</div>
            <div className="text-gray-500 mb-4">Giỏ hàng trống.</div>
            <a
              href="/"
              className="inline-block px-6 py-2 bg-sky-500 text-white rounded-xl hover:bg-sky-600 transition-colors"
            >
              Tiếp tục mua sắm
            </a>
          </div>
        ) : (
          <>
            {/* ==== WEBSITE GROUP ==== */}
            {renderGroup('🌐 Shop Huy Vân', websiteItems)}

            {/* ==== MINIAPP GROUP ==== */}
            {renderGroup('📱 Zalo MiniApp', miniAppItems)}

            {/* ==== SUMMARY (STICKY BOTTOM) ==== */}
            <div className="bg-white rounded-2xl p-4 shadow fixed bottom-0 left-0 right-0 z-50 max-w-4xl mx-auto">
              {/* Tạm tính */}
              <div className="flex justify-between text-sm mb-2">
                <span className="text-gray-600">
                  Tạm tính ({selectedItems.size} sản phẩm):
                </span>
                <span className="font-medium">{fmtVND(summary.subtotal)}</span>
              </div>

              {/* Tổng thanh toán */}
              <div className="flex justify-between text-lg font-semibold border-t pt-3 mb-3">
                <span>Tổng thanh toán:</span>
                <span className="text-rose-600">{fmtVND(summary.total)}</span>
              </div>

              {/* Chọn tất cả + Mua hàng */}
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="selectAll"
                    checked={allSelected}
                    onChange={toggleAll}
                    className="w-4 h-4"
                  />
                  <label htmlFor="selectAll" className="text-sm">
                    Chọn tất cả ({state.lines.length})
                  </label>
                </div>

                <button
                  onClick={handleCheckout}
                  disabled={selectedItems.size === 0}
                  className="flex-1 max-w-xs py-3 bg-rose-600 text-white rounded-xl font-semibold hover:bg-rose-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
                >
                  Mua hàng ({selectedItems.size})
                </button>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
