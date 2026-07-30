import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createStorefrontListing } from '../site/assets/storefront-listing.js';

const [site, admin, adminWorker, worker, adminScript, adminRender, adminDashboardCss, siteConfig, siteScript, storefrontListing, redirects, baseCss, mobileCss] = await Promise.all([
  readFile(new URL('../site/index.html', import.meta.url), 'utf8'),
  readFile(new URL('../admin/index.html', import.meta.url), 'utf8'),
  readFile(new URL('../admin/_worker.js', import.meta.url), 'utf8'),
  readFile(new URL('../services/content-api/src/index.js', import.meta.url), 'utf8'),
  readFile(new URL('../admin/assets/content-admin/main.js', import.meta.url), 'utf8'),
  readFile(new URL('../admin/assets/content-admin/render.js', import.meta.url), 'utf8'),
  readFile(new URL('../admin/assets/content-admin/dashboard.css', import.meta.url), 'utf8'),
  readFile(new URL('../site/assets/config.js', import.meta.url), 'utf8'),
  readFile(new URL('../site/assets/app.js', import.meta.url), 'utf8'),
  readFile(new URL('../site/assets/storefront-listing.js', import.meta.url), 'utf8'),
  readFile(new URL('../site/_redirects', import.meta.url), 'utf8'),
  readFile(new URL('../site/assets/base.css', import.meta.url), 'utf8'),
  readFile(new URL('../site/assets/mobile.css', import.meta.url), 'utf8')
]);

assert.match(site, /assets\/desktop\.css/);
assert.match(site, /assets\/mobile\.css/);
assert.match(site, /assets\/app\.js/);
assert.match(admin, /assets\/content-admin\/dashboard\.css/);
assert.match(admin, /assets\/content-admin\/main\.js/);
assert.match(adminWorker, /\/api\/content/);
assert.match(adminWorker, /env\.ASSETS\.fetch/);
assert.match(adminWorker, /LEGACY_ADMIN_ASSETS/);
assert.match(adminWorker, /window\.location\.replace/);
assert.match(adminWorker, /Cache-Control': 'no-store, max-age=0/);
assert.match(adminScript, /const API = '\/api\/content'/);
assert.match(adminScript, /render as renderPage/);
assert.match(adminRender, /Sản phẩm website/);
assert.match(adminRender, /Banner/);
assert.match(adminRender, /Dữ liệu gốc từ hệ thống/);
assert.doesNotMatch(adminRender, /Đơn hàng|Voucher|Quảng cáo|Tồn kho sàn/);
assert.match(adminDashboardCss, /\.ca-admin-shell/);
assert.match(adminDashboardCss, /@media \(max-width: 680px\)/);
assert.match(siteConfig, /api\/core\/products\/public-catalog/);
assert.match(adminScript, /api\/core\/products\/public-catalog/);
assert.match(siteScript, /payload\.products/);
assert.match(siteScript, /loadProductForRoute/);
assert.match(siteScript, /state\.selectedVariantId && activeVariant\?\.image/);
assert.match(siteConfig, /catalogSearchUrl/);
assert.match(siteScript, /loadSearchResultsForRoute/);
assert.match(siteScript, /createStorefrontListing/);
assert.match(storefrontListing, /\$\{product\.id\} \$\{product\.name\}/);
assert.match(siteScript, /loadProductReviews/);
assert.match(siteScript, /catalogReviewsUrl/);
assert.match(siteScript, /selectedVariant/);
assert.match(siteScript, /\['\/product', '\/product\.html'\]/);
assert.match(redirects, /^\/product \/product\.html 302$/m);
assert.doesNotMatch(await readFile(new URL('../site/assets/content.js', import.meta.url), 'utf8'), /website-\$\{index\}/);
assert.match(worker, /\/v1\/session/);
assert.match(worker, /website_product_overrides/);
assert.match(baseCss, /\.home-grid\s*\{[^}]*align-items:\s*start;/);
assert.match(baseCss, /\.hero\s*\{[^}]*height:\s*clamp\(390px,\s*35vw,\s*430px\);/);
assert.match(baseCss, /\.hero-image\s*\{[^}]*object-fit:\s*contain;/);
assert.match(baseCss, /\.hero-products\s*\{/);
assert.match(storefrontListing, /MIN_CATEGORY_PRODUCT_COUNT = 3/);
assert.match(storefrontListing, /OTHER_CATEGORY_LABEL = 'Khác'/);
assert.match(storefrontListing, /hero-visual-products/);
assert.match(storefrontListing, /rotateHeroBanner/);
assert.match(baseCss, /\.gallery\s*\{[^}]*align-items:\s*start;/);
assert.match(baseCss, /\.thumbs\s*\{[^}]*max-height:\s*560px;[^}]*overflow-y:\s*auto;/);
assert.match(baseCss, /\.main-picture\s*\{[^}]*aspect-ratio:\s*1\s*\/\s*1;/);
assert.match(mobileCss, /\.hero\s*\{[^}]*height:\s*370px;/);
assert.match(mobileCss, /\.hero-visual\s*\{[^}]*height:\s*42%;/);
assert.match(mobileCss, /\.main-picture\s*\{[^}]*min-height:\s*0;/);

const listingState = {
  bannerSlide: 0,
  content: { banners: [], product_overrides: {} },
  products: [
    { id: 'large-1', name: 'Nhóm lớn 1', category: 'Nhóm lớn', image: '', price: 10000, stock: 2, sold: 6, variants: [] },
    { id: 'large-2', name: 'Nhóm lớn 2', category: 'Nhóm lớn', image: '', price: 10000, stock: 2, sold: 5, variants: [] },
    { id: 'large-3', name: 'Nhóm lớn 3', category: 'Nhóm lớn', image: '', price: 10000, stock: 2, sold: 4, variants: [] },
    { id: 'small-1', name: 'Nhóm nhỏ 1', category: 'Nhóm nhỏ A', image: '', price: 10000, stock: 2, sold: 3, variants: [] },
    { id: 'small-2', name: 'Nhóm nhỏ 2', category: 'Nhóm nhỏ A', image: '', price: 10000, stock: 2, sold: 2, variants: [] },
    { id: 'small-3', name: 'Nhóm nhỏ 3', category: 'Nhóm nhỏ B', image: '', price: 10000, stock: 2, sold: 1, variants: [] },
    { id: 'other-1', name: 'Nhóm Khác sẵn có', category: 'Khác', image: '', price: 10000, stock: 2, sold: 1, variants: [] }
  ],
  searchResults: { query: '', items: [] }
};
globalThis.location = new URL('https://shophuyvan.vn/san-pham?category=__other__');
const listing = createStorefrontListing({
  state: listingState,
  shop: { name: 'Shop Huy Vân', address: 'Địa chỉ', hotline: '0900', zalo: '0900' },
  icons: ['⚡'],
  escapeHtml: (value) => String(value),
  titleCase: (value) => value,
  formatMoney: (value) => `${value}đ`,
  currentPath: () => '/san-pham'
});
const otherCategoryPage = listing.catalogPage();
assert.match(otherCategoryPage, /Nhóm nhỏ 1/);
assert.match(otherCategoryPage, /Nhóm nhỏ 2/);
assert.match(otherCategoryPage, /Nhóm nhỏ 3/);
assert.match(otherCategoryPage, /Nhóm Khác sẵn có/);
assert.doesNotMatch(otherCategoryPage, /Nhóm lớn 1/);
assert.equal((otherCategoryPage.match(/\/san-pham\?category=__other__/g) || []).length, 1);
assert.match(listing.homePage(), /hero-visual-products/);
