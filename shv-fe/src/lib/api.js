const API_BASE = import.meta.env.VITE_API_BASE || 'https://shv-api.shophuyvan.workers.dev';

export function authHeader() {
  const t = localStorage.getItem('ADMIN_TOKEN');
  return t ? { 'Authorization': `Bearer ${t}` } : {};
}

export async function api(path, opts={}) {
  const url = path.startsWith('http') ? path : API_BASE + path;
  const headers = { 'Content-Type': 'application/json', ...(opts.admin? authHeader():{}), ...(opts.headers||{}) };
  const method = opts.method || 'GET';
  const body = opts.body ? JSON.stringify(opts.body) : undefined;
  const res = await fetch(url, { method, headers, body });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}
