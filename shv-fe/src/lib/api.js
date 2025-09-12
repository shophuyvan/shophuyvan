export default async function api(path, init = {}){
  const el = document.querySelector('#api-base');
  const fallback = 'https://shv-api.shophuyvan.workers.dev';
  const base = (el?.value || fallback).trim().replace(/\/$/, '');
  const url = `${base}${path.startsWith('/') ? '' : '/'}${path}`;
  const headers = new Headers(init.headers || {});
  const body = init.body;
  if (body && typeof body === 'object' && !(body instanceof FormData)){
    if (!headers.has('content-type')) headers.set('content-type', 'application/json');
    init = { ...init, body: JSON.stringify(body) };
  }
  const res = await fetch(url, { ...init, headers });
  if (!res.ok){
    const text = await res.text().catch(()=>''); 
    throw new Error(`HTTP ${res.status} - ${text || url}`);
  }
  const ct = res.headers.get('content-type') || '';
  return ct.includes('application/json') ? res.json() : res.text();
}
window.api = api;
