import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [site, admin, adminWorker, worker, adminScript, adminRender, adminDashboardCss, siteConfig, siteScript, redirects, baseCss, mobileCss] = await Promise.all([
  readFile(new URL('../site/index.html', import.meta.url), 'utf8'),
  readFile(new URL('../admin/index.html', import.meta.url), 'utf8'),
  readFile(new URL('../admin/_worker.js', import.meta.url), 'utf8'),
  readFile(new URL('../services/content-api/src/index.js', import.meta.url), 'utf8'),
  readFile(new URL('../admin/assets/content-admin/main.js', import.meta.url), 'utf8'),
  readFile(new URL('../admin/assets/content-admin/render.js', import.meta.url), 'utf8'),
  readFile(new URL('../admin/assets/content-admin/dashboard.css', import.meta.url), 'utf8'),
  readFile(new URL('../site/assets/config.js', import.meta.url), 'utf8'),
  readFile(new URL('../site/assets/app.js', import.meta.url), 'utf8'),
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
assert.match(siteScript, /\$\{product\.id\} \$\{product\.name\}/);
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
assert.match(baseCss, /\.gallery\s*\{[^}]*align-items:\s*start;/);
assert.match(baseCss, /\.thumbs\s*\{[^}]*max-height:\s*560px;[^}]*overflow-y:\s*auto;/);
assert.match(baseCss, /\.main-picture\s*\{[^}]*aspect-ratio:\s*1\s*\/\s*1;/);
assert.match(mobileCss, /\.hero\s*\{[^}]*height:\s*370px;/);
assert.match(mobileCss, /\.main-picture\s*\{[^}]*min-height:\s*0;/);
