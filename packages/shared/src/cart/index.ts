import { numLike, pickLowestPrice } from '../utils/price';

export type CartLine = {
  id: string | number;
  name: string;
  image?: string;
  variantName?: string;
  variantImage?: string;
  price: number;        // unit price
  original?: number | null;
  qty: number;
};

export type CartState = {
  lines: CartLine[];
  subtotal: number;
  savings: number;
  total: number;
};

const LS_KEY = 'shv_cart_v1';

function read(): CartState {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { lines: [], subtotal: 0, savings: 0, total: 0 };
}

function write(state: CartState) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(state)); } catch {}
}

function recalc(lines: CartLine[]): CartState {
  const subtotal = lines.reduce((s, l) => s + (l.price * l.qty), 0);
  const compare = lines.reduce((s, l) => s + ((l.original && l.original > l.price ? l.original : l.price) * l.qty), 0);
  const savings = compare - subtotal;
  const total = subtotal; // shipping/discount can be added later
  return { lines, subtotal, savings, total };
}

export const cart = {
  get(): CartState {
    return recalc(read().lines);
  },
  count(): number {
    return read().lines.reduce((c, l) => c + l.qty, 0);
  },
  add(p: any, qty = 1) {
const st = read();
const pricePair = p?.price ? p.price : pickLowestPrice(p);
const price = numLike(pricePair?.base);
const original = pricePair?.original ?? null;

// Determine product id
const baseId = p.id ?? p._id ?? p.code ?? p.productId ?? p.product_id ?? null;

// Variant key from multiple fields
const vKey =
  p.variantId ?? p.variant_id ?? p.variant?.id ??
  p.variantSku ?? p.variant_sku ?? p.variant?.sku ??
  p.variantName ?? p.variant_name ?? p.variant?.name ?? '';

const productId = baseId ?? (p.product?.id ?? p.spuId ?? p.sku ?? p.name ?? 'unknown');
const id = vKey ? `${productId}::${vKey}` : String(productId);

const baseName = p.name ?? p.title ?? 'Sản phẩm';
const variantLabel = (p.variantName ?? p.variant?.name ?? p.variant?.sku ?? '');
const name = variantLabel ? `${baseName} — ${variantLabel}` : baseName;
const variantName = variantLabel || undefined;
const variantImage = p.variantImage || (p.variant?.image) || (Array.isArray(p.variant?.images) ? p.variant.images[0] : undefined);

const image = variantImage || p.image || (Array.isArray(p.images) ? p.images[0] : p.thumbnail);
if (!id) return;
const ix = st.lines.findIndex(l => String(l.id) === String(id));
if (ix >= 0) {
  st.lines[ix].qty += qty;
} else {
  st.lines.push({ id, name, image, variantName, variantImage, price, original, qty });
}
    write(recalc(st.lines));
  },
  setQty(id: string | number, qty: number) {
    const st = read();
    const lines = st.lines.map(l => String(l.id) === String(id) ? { ...l, qty: Math.max(1, qty) } : l);
    write(recalc(lines));
  },
  remove(id: string | number) {
    const st = read();
    const lines = st.lines.filter(l => String(l.id) != String(id));
    write(recalc(lines));
  },
  clear() { write({ lines: [], subtotal: 0, savings: 0, total: 0 }); },
};
export default cart;
