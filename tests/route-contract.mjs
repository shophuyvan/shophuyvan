import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [site, admin, adminWorker, worker, adminScript] = await Promise.all([
  readFile(new URL('../site/index.html', import.meta.url), 'utf8'),
  readFile(new URL('../admin/index.html', import.meta.url), 'utf8'),
  readFile(new URL('../admin/_worker.js', import.meta.url), 'utf8'),
  readFile(new URL('../services/content-api/src/index.js', import.meta.url), 'utf8'),
  readFile(new URL('../admin/assets/admin.js', import.meta.url), 'utf8')
]);

assert.match(site, /assets\/desktop\.css/);
assert.match(site, /assets\/mobile\.css/);
assert.match(site, /assets\/app\.js/);
assert.match(admin, /assets\/admin-20260729\.css/);
assert.match(admin, /assets\/admin\.js/);
assert.match(adminWorker, /\/api\/content/);
assert.match(adminWorker, /env\.ASSETS\.fetch/);
assert.match(adminScript, /const API = '\/api\/content'/);
assert.match(worker, /\/v1\/session/);
assert.match(worker, /website_product_overrides/);
