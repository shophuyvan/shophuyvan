
// src/lib/api.js
// Helper to call your Worker API with token-aware JSON handling.
// Exposes BOTH a named export `api` and default export for compatibility.
export async function api(path, init = {}) {
  const el = document.querySelector('#api-base');
  const fallback = 'https://shv-api.shophuyvan.workers.dev';
  const base = (el?.value || fallback).replace(/\/+$/, '');
  // normalize path
  const p = String(path || '').replace(/^\/+/, '');
  const url = `${base}/${p}`;

  let headers = new Headers(init.headers || {});
  let body = init.body;
  if (body && typeof body === 'object' && !(body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
    init = { ...init, headers, body: JSON.stringify(body) };
  } else {
    init = { ...init, headers };
  }

  const res = await fetch(url, init);
  const ct = res.headers.get('content-type') || '';
  const raw = await res.text().catch(() => '');
  if (!res.ok) {
    let msg = raw;
    try { const j = JSON.parse(raw); msg = j.error || j.message || raw; } catch {}
    throw new Error(`HTTP ${res.status}: ${msg}`);
  }
  return ct.includes('application/json') ? (raw ? JSON.parse(raw) : null) : raw;
}
export default api;

// Expose for quick testing in console (will not throw if window undefined)
try { window.api = api } catch {}
