// shv-fe/src/lib/api.js
// API helper dùng chung cho cả FE & Admin. Không bắt buộc #api-base.
// Nếu không có #api-base thì fallback về domain Worker của bạn.

export async function api(path, init = {}) {
  const el = document.querySelector('#api-base');
  const fallback = 'https://shv-api.shophuyvan.workers.dev';
  const base = (el?.value || fallback).trim().replace(/\/+$/, '');
  let url  = `${base}${path.startsWith('/') ? '' : '/'}${path}`;
  const t = (typeof localStorage !== 'undefined' && (localStorage.getItem('admin_token') || ''))
           || (document.querySelector('#tokenInput')?.value || '');
  if (t) {
    const u = new URL(url, typeof location !== 'undefined' ? location.href : 'https://dummy');
    u.searchParams.set('token', t);
    url = u.toString();
  }

  const headers = new Headers(init.headers || {});
  // stringify body nếu là object (không phải FormData/Blob)
  let body = init.body;
  const isFd = (typeof FormData !== 'undefined') && body instanceof FormData;
  if (body && typeof body === 'object' && !isFd) {
    if (!headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
    body = JSON.stringify(body);
  }

  const res = await fetch(url, { ...init, headers, body });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status} at ${url}\n${text}`);
  }
  const ct = res.headers.get('content-type') || '';
  return ct.includes('application/json') ? res.json() : res.text();
}

// tiện test trong Console
window.api = api;
