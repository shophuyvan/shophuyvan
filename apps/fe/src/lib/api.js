// apps/fe/src/lib/api.js
// FE shared API helper (v24) - default export + get/post, x-token, timeout/retry
function withTimeout(promise, ms=10000){
  return new Promise((resolve, reject)=>{
    const id = setTimeout(()=>reject(new Error('timeout')), ms);
    promise.then(v=>{ clearTimeout(id); resolve(v); }, e=>{ clearTimeout(id); reject(e); });
  });
}
async function core(path, init = {}) {
  const fallback = 'https://api.shophuyvan.vn';
  const base = (window.API_BASE || fallback).replace(/\/+$/,'');
  const url  = `${base}${path.startsWith('/') ? '' : '/'}${path}`;

  const headers = new Headers(init.headers || {});

// Token đăng nhập khách/nhân viên (nếu có) – vẫn giữ để dùng cho các API khác
const loginToken = (localStorage && (
  localStorage.getItem('x-customer-token') ||
  localStorage.getItem('customer_token')   ||
  localStorage.getItem('x-token')
)) || '';

// Static API Token của SuperAI
const superToken = (
  (localStorage && (localStorage.getItem('super_token') || localStorage.getItem('x-token'))) ||
  'FxXOoDz2qlTN5joDCsBGQFqKmm1UNvOw7YPwkzm5' // Fallback bắt buộc
).trim();

// Nếu không phải /shipping/* thì dùng như cũ
if (!/^\/(shipping|areas|orders\/(price|optimize|create))/.test(path)) {
  if (loginToken) {
    if (!headers.has('x-customer-token')) headers.set('x-customer-token', loginToken);
    if (!headers.has('Authorization'))     headers.set('Authorization', 'Bearer ' + loginToken);
  }
} else {
  // Với SuperAI shipping, BẮT BUỘC header Token
  headers.set('Token', superToken);

  // Tránh nhầm lẫn ủy quyền: bỏ các header Bearer cũ nếu có
  headers.delete('Authorization');
  headers.delete('x-customer-token');
}


  let body = init.body;
  const isFd = (typeof FormData !== 'undefined') && body instanceof FormData;
  if (body && typeof body === 'object' && !isFd) {
    if (!headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
    body = JSON.stringify(body);
  }
  const req = fetch(url, { method: init.method || 'GET', headers, body, credentials: 'include' });
  const res = await withTimeout(req, init.timeout || 10000);
  if (res.status >= 500 && (init._retried!==true)) {
    return await core(path, { ...init, _retried:true });
  }
  const ctype = res.headers.get('content-type') || '';
  if (ctype.includes('application/json')) return await res.json();
  return await res.text();
}
function get(path, opts){ return core(path, { ...(opts||{}), method:'GET' }); }
function post(path, body, opts){ return core(path, { ...(opts||{}), method:'POST', body }); }
const api = Object.assign(core, { get, post });
export default api;
export { core as api, get, post };
