// shv-fe/src/lib/api.js
// Helper gọi API đọc base URL từ #api-base và GIỮ nguyên mọi headers (kể cả Authorization)

export async function api(path, init = {}) {
  const baseEl = document.querySelector('#api-base');
  if (!baseEl) throw new Error('#api-base not found in admin.html');

  const base = baseEl.value.trim().replace(/\/+$/, '');
  const url = `${base}${path.startsWith('/') ? '' : '/'}${path}`;

  // giữ headers mà caller truyền vào (Authorization v.v.)
  const headers = new Headers(init.headers || {});

  // Nếu body là object -> stringify + set Content-Type
  let body = init.body;
  const isFormData = (typeof FormData !== 'undefined') && (body instanceof FormData);
  if (body && typeof body === 'object' && !isFormData) {
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
