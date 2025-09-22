
// FE shared API helper (v24) - default export + get/post, x-token, timeout/retry
function withTimeout(promise, ms=10000){
  return new Promise((resolve, reject)=>{
    const id = setTimeout(()=>reject(new Error('timeout')), ms);
    promise.then(v=>{ clearTimeout(id); resolve(v); }, e=>{ clearTimeout(id); reject(e); });
  });
}
async function core(path, init = {}) {
  const fallback = 'https://shv-api.shophuyvan.workers.dev';
  const base = (window.API_BASE || fallback).replace(/\/+$/,'');
  const url  = `${base}${path.startsWith('/') ? '' : '/'}${path}`;

  const headers = new Headers(init.headers || {});
  const token = (localStorage && localStorage.getItem('x-token')) || '';
  if (token && !headers.has('x-token')) headers.set('x-token', token);

  let body = init.body;
  const isFd = (typeof FormData !== 'undefined') && body instanceof FormData;
  if (body && typeof body === 'object' && !isFd) {
    if (!headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
    body = JSON.stringify(body);
  }
  const req = fetch(url, { method: init.method || 'GET', headers, body });
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

export async function fetchProductByIdOrSlug(idOrSlug) {
  const tryUrls = [
    `/api/products?id=${encodeURIComponent(idOrSlug)}`,
    `/api/products?slug=${encodeURIComponent(idOrSlug)}`,
    `/api/product/${encodeURIComponent(idOrSlug)}`,
  ];
  let lastErr;
  for (const url of tryUrls) {
    try {
      const r = await fetch(url, { headers: { 'Accept': 'application/json' } });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json();
      if (data && (data.id || data._id || data.slug)) return data;
    } catch (e) { lastErr = e; }
  }
  throw new Error(`fetchProduct fail: ${lastErr?.message || 'unknown'}`);
}
