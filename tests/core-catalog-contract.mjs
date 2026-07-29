import assert from 'node:assert/strict';

const catalogUrl = 'https://huyvan-worker-api.nghiemchihuy.workers.dev/api/core/products/public-catalog?limit=2';
const response = await fetch(catalogUrl, { headers: { accept: 'application/json' } });
assert.equal(response.ok, true, 'public catalog must be readable');
const payload = await response.json();
const product = (payload.products || payload.items || payload.data || [])[0];

assert.ok(product?.id, 'catalog product must have a stable id');
assert.equal(typeof product.price, 'number', 'catalog product must expose display price');
assert.equal(typeof product.category, 'string', 'catalog product must expose category');
assert.ok(Array.isArray(product.variants), 'catalog product must expose variants');
assert.ok(Array.isArray(product.images), 'catalog product must expose images');

const reviews = await fetch(`https://huyvan-worker-api.nghiemchihuy.workers.dev/api/core/products/public-catalog/${encodeURIComponent(product.id)}/reviews?limit=1&media=1`, { headers: { accept: 'application/json' } });
assert.equal(reviews.ok, true, 'public product reviews must be readable');
const reviewPayload = await reviews.json();
assert.ok(Array.isArray(reviewPayload.reviews), 'review response must expose an array');

console.log('public catalog and review contract passed');
