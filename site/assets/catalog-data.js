const mojibakePattern = new RegExp('[\\u00c3\\u00c4]|\\u00e1[\\u00ba\\u00bb]');

function rawText(value) {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

export function toText(value) {
  let repaired = rawText(value);
  if (!mojibakePattern.test(repaired)) return repaired;
  for (let index = 0; index < 2; index += 1) {
    try {
      const bytes = Uint8Array.from(Array.from(repaired), (char) => char.codePointAt(0) & 255);
      const next = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
      if (!next || next.includes('�') || next === repaired) break;
      repaired = next;
      if (!mojibakePattern.test(repaired)) break;
    } catch { break; }
  }
  return repaired;
}

export function parseJson(value, fallback = []) {
  if (Array.isArray(value)) return value;
  if (typeof value !== 'string' || !value.trim()) return fallback;
  try { return JSON.parse(value); } catch { return fallback; }
}

export function toNumber(value) {
  const numeric = Number(String(value ?? '').replace(/[^0-9.-]/g, ''));
  return Number.isFinite(numeric) ? numeric : 0;
}

export function toOptionalNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const numeric = Number(String(value).replace(/[^0-9.-]/g, ''));
  return Number.isFinite(numeric) ? numeric : null;
}

export function normalizeProduct(item) {
  const images = parseJson(item.images).map(toText).filter(Boolean);
  const extraImages = [...parseJson(item.product_images), ...parseJson(item.detail_images)].map(toText).filter(Boolean);
  const variants = Array.isArray(item.variants) ? item.variants : parseJson(item.variants);
  const explicitPrice = item.price_display ?? item.price_final ?? item.price_sale ?? item.price ?? item.sale_price ?? null;
  const explicitCategory = item.category_name ?? item.category ?? item.category_slug ?? '';
  return {
    id: toText(item.id ?? item.product_id ?? item.sku),
    sku: toText(item.sku),
    name: toText(item.name ?? item.title ?? item.product_name) || 'Sản phẩm chưa có tên',
    description: toText(item.description ?? item.shortDesc ?? item.short_desc),
    category: toText(explicitCategory),
    image: toText(item.image ?? item.image_url ?? images[0]),
    images: [...new Set([toText(item.image ?? item.image_url), ...images, ...extraImages].filter(Boolean))],
    video: toText(item.video_url ?? item.video),
    price: toOptionalNumber(explicitPrice),
    compareAt: toOptionalNumber(item.compare_at_display ?? item.price_original ?? item.compare_at),
    stock: item.stock === undefined || item.stock === null ? null : toNumber(item.stock),
    sold: toNumber(item.sold ?? item.sold_count),
    rating: toNumber(item.rating),
    ratingCount: toNumber(item.rating_count ?? item.review_count),
    variants: variants.map((variant) => ({
      id: toText(variant.id ?? variant.sku ?? variant.name),
      name: toText(variant.name ?? variant.title ?? variant.sku),
      sku: toText(variant.sku),
      price: toOptionalNumber(variant.price_sale ?? variant.sale_price ?? variant.price),
      stock: toOptionalNumber(variant.stock ?? variant.qty ?? variant.quantity),
      image: toText(variant.image ?? parseJson(variant.images)[0])
    })),
    reviewMedia: Array.isArray(item.review_media) ? item.review_media : parseJson(item.review_media)
  };
}

export function normalizeReview(item) {
  return {
    rating: toOptionalNumber(item.rating),
    text: toText(item.text),
    images: parseJson(item.images).map(toText).filter(Boolean),
    videos: parseJson(item.videos).map(toText).filter(Boolean)
  };
}
