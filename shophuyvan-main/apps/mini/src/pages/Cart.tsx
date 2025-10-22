import React, { useEffect, useState, useCallback } from 'react';
import cart from '@shared/cart';
import { fmtVND } from '@shared/utils/fmtVND';
import { cloudify } from '@shared/utils/cloudinary';
import { routes } from '../routes';

interface CartLine {
  id: string | number;
  name: string;
  image?: string;
  variantName?: string;
  variantImage?: string;
  price: number;
  original?: number | null;
  qty: number;
}

export default function CartPage() {
  const [state, setState] = useState(cart.get());
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [appliedVoucher, setAppliedVoucher] = useState<any>(null);
  const [voucherCode, setVoucherCode] = useState('');
  const [voucherMessage, setVoucherMessage] = useState('');

  const notify = useCallback(() => {
    try {
      window.dispatchEvent(new Event('shv:cart-changed'));
    } catch {}
  }, []);

  useEffect(() => {
    const refresh = () => {
      setState(cart.get());
    };

    const onStorage = (e: StorageEvent) => {
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

    refresh();

    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('shv:cart-changed', onChanged);
      window.removeEventListener('focus', onFocusOrVisible);
      document.removeEventListener('visibilitychange', onFocusOrVisible);
    };
  }, []);

  const update = useCallback(() => {
    setState(cart.get());
  }, []);

  const handleQtyChange = useCallback(
    (lineId: any, newQty: number) => {
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
      const newSelected = new Set(selectedItems);
      if (newSelected.has(lineId)) {
        newSelected.delete(lineId);
      } else {
        newSelected.add(lineId);
      }
      setSelectedItems(newSelected);
    },
    [selectedItems]
  );

  const toggleAll = useCallback(() => {
    if (selectedItems.size === state.lines.length) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(state.lines.map(l => String(l.id))));
    }
  }, [selectedItems, state.lines]);

  const applyVoucher = useCallback(() => {
    if (!voucherCode.trim()) {
      setVoucherMessage('Vui lòng nhập mã voucher');
      return;
    }

    // Mock voucher validation - replace with API
    const vouchers: any = {
      GIAM10: { type: 'percent', value: 10, description: 'Giảm 10%' },
      GIAM50K: { type: 'fixed', value: 50000, description: 'Giảm 50.000đ' },
      FREESHIP: { type: 'shipping', value: 0, description: 'Miễn phí vận chuyển' },
    };

    const voucher = vouchers[voucherCode.toUpperCase()];

    if (voucher) {
      setAppliedVoucher(voucher);
      setVoucherMessage(`✓ Áp dụng thành công: ${voucher.description}`);
    } else {
      setAppliedVoucher(null);
      setVoucherMessage('Mã voucher không hợp lệ');
    }
  }, [voucherCode]);

  const getLineImage = useCallback((l: CartLine) => {
    const rawImg = l.variantImage || l.image || '/icon.png';
    return cloudify(rawImg, 'w_160,q_auto:eco,f_auto,c_fill');
  }, []);

  const calculateSummary = useCallback(() => {
    let subtotal = 0;
    let discount = 0;

    selectedItems.forEach(id => {
      const item = state.lines.find(l => String(l.id) === id);
      if (item) {
        subtotal += item.price * item.qty;
        if (item.original && item.original > item.price) {
          discount += (item.original - item.price) * item.qty;
        }
      }
    });

    // Apply voucher
    if (appliedVoucher) {
      if (appliedVoucher.type === 'percent') {
        discount += subtotal * (appliedVoucher.value / 100);
      } else if (appliedVoucher.type === 'fixed') {
        discount += appliedVoucher.value;
      }
    }

    const total = Math.max(0, subtotal - discount);

    return { subtotal, discount, total };
  }, [selectedItems, state.lines, appliedVoucher]);

  const handleCheckout = useCallback(() => {
    if (selectedItems.size === 0) {
      alert('Vui lòng chọn ít nhất 1 sản phẩm');
      return;
    }

    const selectedCartItems = state.lines.filter(l => selectedItems.has(String(l.id)));
    localStorage.setItem('checkout_items', JSON.stringify(selectedCartItems));

    if (appliedVoucher) {
      localStorage.setItem('applied_voucher', JSON.stringify(appliedVoucher));
    }

    window.location.href = routes.checkout;
  }, [selectedItems, state.lines, appliedVoucher]);

  const isEmpty = !state || state.lines.length === 0;
  const summary = calculateSummary();
  const allSelected = state.lines.length > 0 && selectedItems.size === state.lines.length;

  // Group items by source
  const websiteItems = state.lines.filter((l: any) => {
    const source = l.source || 'website';
    return !source.includes('mini') && !source.includes('zalo');
  });

  const miniAppItems = state.lines.filter((l: any) => {
    const source = l.source || 'website';
    return source.includes('mini') || source.includes('zalo');
  });

  const renderGroup = (groupName: string, items: CartLine[]) => {
    if (items.length === 0) return null;

    const groupSelected = items.every(l => selectedItems.has(String(l.id)));

    const toggleGroup = () => {
      const newSelected = new Set(selectedItems);
      items.forEach(l => {
        const id = String(l.id);
        if (groupSelected) {
          newSelected.delete(id);
        } else {
          newSelected.add(id);
        }
      });
      setSelectedItems(newSelected);
    };

    return (
      <div className="bg-white rounded-2xl shadow mb-3 overflow-hidden">
        {/* Group Header */}
        <div className="p-3 border-b flex items-center gap-2">
          <input
            type="checkbox"
            checked={groupSelected}
            onChange={toggleGroup}
            className="w-4 h-4"
          />
          <span className="font-medium text-sm">{groupName}</span>
        </div>

        {/* Items */}
        {items.map(l => {
          const lineId = String(l.id);
          const isSelected = selectedItems.has(lineId);

          return (
            <div
              key={lineId}
              className="p-3 border-b last:border-b-0 flex gap-3 items-start hover:bg-gray-50 transition-colors"
            >
              {/* Checkbox */}
              <input
                type="checkbox"
                checked={isSelected}
                onChange={() => toggleItem(lineId)}
                className="w-4 h-4 mt-1 flex-shrink-0"
              />

              {/* Image */}
              <img
                src={getLineImage(l)}
                className="w-20 h-20 rounded-xl object-cover flex-shrink-0"
                alt={l.variantName ? `${l.name} — ${l.variantName}` : l.name}
                loading="lazy"
              />

              
              {/* Details */}
              <div className="flex-1 min-w-0">

                {/* ==== START PATCH: name + variant badge ==== */}
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
                {/* ==== END PATCH ==== */}

                {/* Price */}
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

                {/* Quantity & Actions */}
                <div className="flex items-center justify-between">
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

                  {/* Total Price */}
                  <div className="text-rose-600 font-semibold text-sm">
                    {fmtVND(l.price * l.qty)}
                  </div>

                  {/* Delete */}
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

  return (
    <div className="min-h-screen bg-gray-50 pb-32">
      <main className="max-w-4xl mx-auto p-3">
        <h1 className="text-xl font-bold mb-3">Giỏ hàng</h1>

        {isEmpty ? (
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
            {/* Website Items */}
            {renderGroup('🌐 Website', websiteItems)}

            {/* MiniApp Items */}
            {renderGroup('📱 Zalo MiniApp', miniAppItems)}

            {/* Voucher Section */}
            <div className="bg-white rounded-2xl p-4 shadow mb-3">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-lg">🎟️</span>
                <span className="font-medium text-sm">Shop Voucher</span>
              </div>
              <div className="flex gap-2 mb-2">
                <input
                  type="text"
                  value={voucherCode}
                  onChange={e => setVoucherCode(e.target.value)}
                  placeholder="Nhập mã voucher"
                  className="flex-1 px-3 py-2 border rounded-lg text-sm outline-none focus:border-sky-500"
                />
                <button
                  onClick={applyVoucher}
                  className="px-4 py-2 border border-rose-600 text-rose-600 rounded-lg hover:bg-rose-600 hover:text-white transition-colors text-sm font-medium"
                >
                  Áp dụng
                </button>
              </div>
              {voucherMessage && (
                <div
                  className={`text-xs p-2 rounded-lg ${
                    appliedVoucher
                      ? 'bg-blue-50 text-blue-600 border border-blue-200'
                      : 'bg-red-50 text-red-600 border border-red-200'
                  }`}
                >
                  {voucherMessage}
                </div>
              )}
            </div>

            {/* Summary - Sticky Bottom */}
            <div className="bg-white rounded-2xl p-4 shadow fixed bottom-0 left-0 right-0 z-50 max-w-4xl mx-auto">
              <div className="flex justify-between text-sm mb-2">
                <span className="text-gray-600">
                  Tạm tính ({selectedItems.size} sản phẩm):
                </span>
                <span className="font-medium">{fmtVND(summary.subtotal)}</span>
              </div>

              {summary.discount > 0 && (
                <div className="flex justify-between text-sm mb-2 text-green-600">
                  <span>Giảm giá:</span>
                  <span>-{fmtVND(summary.discount)}</span>
                </div>
              )}

              <div className="flex justify-between text-lg font-semibold border-t pt-3 mb-3">
                <span>Tổng thanh toán:</span>
                <span className="text-rose-600">{fmtVND(summary.total)}</span>
              </div>

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
