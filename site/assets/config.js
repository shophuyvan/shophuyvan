export const SHOP = Object.freeze({
  name: 'SHOP HUY VÂN',
  slogan: 'Đồ gia dụng tiện ích, giá tốt mỗi ngày',
  address: '91/6 Liên Khu 5-11-12, P. Bình Trị Đông, Q. Bình Tân, TP.HCM',
  hotline: '0933 190 000',
  zalo: '0909 128 999'
});

// Product data only comes from the existing Warehouse/Product API. The store
// deliberately has no hard-coded product, category, price, SKU or review data.
export const CATALOG_ENDPOINT = 'https://huyvan-worker-api.nghiemchihuy.workers.dev/api/products';
export const CONTENT_API = 'https://shophuyvan-content-api.shophuyvan.workers.dev';

export function apiUrl(path) {
  return `${CONTENT_API}${path}`;
}
