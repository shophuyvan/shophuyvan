// src/ui-pdp.js
// Product detail page logic (excerpt) — IMPORTANT: default import
import api from './lib/api.js';   // <- changed from { api } to default import

async function start() {
  // Example: load product & settings
  const qs = new URLSearchParams(location.search);
  const id = qs.get('id');
  if (!id) return;
  const product = await api(`products?id=${encodeURIComponent(id)}`);
  // ... render your existing UI here
  console.log('Loaded product', product);
}
start().catch(console.error);
