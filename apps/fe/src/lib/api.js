
// FE shared API helper (v24) - default export + get/post, x-token, timeout/retry
function withTimeout(promise, ms=25000){
  return new Promise((resolve, reject)=>{
    const id = setTimeout(()=>reject(new Error('timeout')), ms);
    promise.then(v=>{ clearTimeout(id); resolve(v); }, e=>{ clearTimeout(id); reject(e); });
  });
}
async function core(path, init = {}) {
  const fallback = 'https://shv-api.shophuyvan.workers.dev';
  const base = (window.API_BASE || fallback).replace(/\/+$/,'');

  // Chuẩn hoá path: đổi đuôi "product" (số ít) sang "products" (số nhiều)
  // để tránh gọi nhầm /public/product?id=... → 404
  path = String(path)
    .replace(/^\/public\/product(?=$|[/?#])/, '/public/products')
    .replace(/^\/product(?=$|[/?#])/, '/products');

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
  if (!headers.has('Accept')) headers.set('Accept','application/json, text/plain, */*');
  let res;
  try{
    const req = fetch(url, { method: init.method || 'GET', headers, body });
    res = await withTimeout(req, init.timeout || 25000);
  }catch(e){
    if (init._retried!==true){
      await new Promise(r=>setTimeout(r,300));
      return await core(path, { ...init, _retried:true, timeout: (init.timeout||25000)+10000 });
    }
    throw e;
  }
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
