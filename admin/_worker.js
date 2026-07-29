const CONTENT_ORIGIN = 'https://shophuyvan-content-api.shophuyvan.workers.dev';
const API_PREFIX = '/api/content';
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
    "window.location.replace('/login_admin?refresh=20260729.8');",
    {
      headers: {
        'Cache-Control': 'no-store, max-age=0',
        'Content-Type': 'application/javascript; charset=utf-8',
        'X-Content-Type-Options': 'nosniff'
      }
    }
  );
}

export default {
  async fetch(request, env) {
    const pathname = new URL(request.url).pathname;
    if (pathname === API_PREFIX || pathname.startsWith(`${API_PREFIX}/`)) return proxyContent(request);
    if (LEGACY_ADMIN_ASSETS.has(pathname)) return legacyAssetRecovery();
    return env.ASSETS.fetch(request);
  }
};
