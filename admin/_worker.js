const CONTENT_ORIGIN = 'https://shophuyvan-content-api.shophuyvan.workers.dev';
const API_PREFIX = '/api/content';
const ADMIN_UI_REVISION = '20260730.2';
const ADMIN_ENTRY_ROUTES = new Set(['/', '/index.html', '/login_admin', '/login']);
const LEGACY_ADMIN_ASSETS = new Set([
  '/assets/admin.js',
  '/assets/admin-20260729.css'
]);

function contentPath(pathname) {
  const path = pathname.slice(API_PREFIX.length) || '/';
  return path.startsWith('/v1/') || path.startsWith('/media/') ? path : null;
}

async function proxyContent(request) {
  const source = new URL(request.url);
  const path = contentPath(source.pathname);
  if (!path) return new Response('Not found', { status: 404 });

  const target = new URL(path, CONTENT_ORIGIN);
  target.search = source.search;
  const headers = new Headers(request.headers);
  headers.delete('host');
  headers.delete('origin');
  const hasBody = !['GET', 'HEAD'].includes(request.method);
  return fetch(new Request(target, {
    method: request.method,
    headers,
    body: hasBody ? request.body : undefined,
    redirect: 'manual'
  }));
}

function legacyAssetRecovery() {
  return new Response(
    "window.location.replace('/login_admin?refresh=20260730.2');",
    {
      headers: {
        'Cache-Control': 'no-store, max-age=0',
        'Content-Type': 'application/javascript; charset=utf-8',
        'X-Content-Type-Options': 'nosniff'
      }
    }
  );
}

function freshAdminEntry(request) {
  const target = new URL(request.url);
  target.searchParams.set('refresh', ADMIN_UI_REVISION);
  return new Response(null, {
    status: 302,
    headers: {
      Location: target.toString(),
      'Cache-Control': 'no-store, max-age=0, must-revalidate'
    }
  });
}

function preventEntryCache(response) {
  const headers = new Headers(response.headers);
  headers.set('Cache-Control', 'no-store, max-age=0, must-revalidate');
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

export default {
  async fetch(request, env) {
    const source = new URL(request.url);
    const pathname = source.pathname;
    if (pathname === API_PREFIX || pathname.startsWith(`${API_PREFIX}/`)) return proxyContent(request);
    if (LEGACY_ADMIN_ASSETS.has(pathname)) return legacyAssetRecovery();
    if (ADMIN_ENTRY_ROUTES.has(pathname) && !source.searchParams.has('refresh')) return freshAdminEntry(request);
    const response = await env.ASSETS.fetch(request);
    return ADMIN_ENTRY_ROUTES.has(pathname) ? preventEntryCache(response) : response;
  }
};
