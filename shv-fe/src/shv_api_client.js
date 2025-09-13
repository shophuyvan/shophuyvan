/*! SHV API client (public site) */
export const API_BASE = '/api'; // proxied via Cloudflare Pages -> Worker

export async function apiGet(path) {
  const url = API_BASE.replace(/\/$/, '') + '/' + String(path).replace(/^\/+/, '');
  const res = await fetch(url, { method: 'GET', mode: 'cors', credentials: 'omit', cache: 'no-store' });
  if (!res.ok) throw new Error('API ' + path + ' failed ' + res.status);
  try { return await res.json(); } catch { return await res.text(); }
}
