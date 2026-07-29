import { apiUrl } from './config.js';

const emptyContent = Object.freeze({ settings: {}, banners: [], product_overrides: {} });

export async function loadWebsiteContent() {
  try {
    const response = await fetch(apiUrl('/v1/public/content'), { headers: { accept: 'application/json' } });
    if (!response.ok) return emptyContent;
    const payload = await response.json();
    return {
      settings: payload.settings || {},
      banners: Array.isArray(payload.banners) ? payload.banners : [],
      product_overrides: payload.product_overrides || {}
    };
  } catch {
    return emptyContent;
  }
}

export function mergeWebsiteOverride(product, override) {
  if (!override || override.published === false) return product;
  const variantNames = String(override.variants || '').split(/\r?\n/).map((value) => value.trim()).filter(Boolean);
  const priceText = String(override.display_price || '').replace(/[^0-9]/g, '');
  return {
    ...product,
    name: override.display_title || product.name,
    category: override.category || product.category,
    price: priceText ? Number(priceText) : product.price,
    image: override.primary_image || product.image,
    images: override.primary_image ? [override.primary_image, ...product.images.filter((image) => image !== override.primary_image)] : product.images,
    video: override.video_url || product.video,
    description: override.description || product.description,
    shortDescription: override.short_description || '',
    variants: variantNames.length ? variantNames.map((name, index) => ({ id: `website-${index}`, name, sku: '', price: null, stock: null })) : product.variants
  };
}
