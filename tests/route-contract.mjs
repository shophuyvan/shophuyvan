import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [site, admin, adminWorker, worker, adminScript, siteConfig, siteScript, redirects] = await Promise.all([
  readFile(new URL('../site/index.html', import.meta.url), 'utf8'),
  readFile(new URL('../admin/index.html', import.meta.url), 'utf8'),
  readFile(new URL('../admin/_worker.js', import.meta.url), 'utf8'),
  readFile(new URL('../services/content-api/src/index.js', import.meta.url), 'utf8'),
  readFile(new URL('../admin/assets/admin.js', import.meta.url), 'utf8'),
  readFile(new URL('../site/assets/config.js', import.meta.url), 'utf8'),
  readFile(new URL('../site/assets/app.js', import.meta.url), 'utf8'),
  readFile(new URL('../site/_redirects', import.meta.url), 'utf8')
]);

assert.match(site, /assets\/desktop\.css/);
assert.match(site, /assets\/mobile\.css/);
assert.match(site, /assets\/app\.js/);
assert.match(admin, /assets\/admin-20260729\.css/);
assert.match(admin, /assets\/admin\.js/);
assert.match(adminWorker, /\/api\/content/);
assert.match(adminWorker, /env\.ASSETS\.fetch/);
assert.match(adminScript, /const API = '\/api\/content'/);
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
