export const SHOP = Object.freeze({
  name: 'SHOP HUY VÂN',
  slogan: 'Đồ gia dụng tiện ích, giá tốt mỗi ngày',
  address: '91/6 Liên Khu 5-11-12, P. Bình Trị Đông, Q. Bình Tân, TP.HCM',
  hotline: '0933 190 000',
  zalo: '0909 128 999'
});

// Product data only comes from the existing Warehouse/Product API. The store
// deliberately has no hard-coded product, category, price, SKU or review data.
export const CATALOG_API = 'https://huyvan-worker-api.nghiemchihuy.workers.dev/api/core/products/public-catalog';
export const CATALOG_ENDPOINT = `${CATALOG_API}?limit=110`;
export const CONTENT_API = 'https://shophuyvan-content-api.shophuyvan.workers.dev';

export function catalogProductUrl(id) {
  return `${CATALOG_API}/${encodeURIComponent(id)}`;
}

export function catalogSearchUrl(query) {
  return `${CATALOG_API}?q=${encodeURIComponent(query)}&limit=110`;
}

export function catalogReviewsUrl(id) {
  return `${catalogProductUrl(id)}/reviews?limit=8&media=1`;
}

export function apiUrl(path) {
  return `${CONTENT_API}${path}`;
}
