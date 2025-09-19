// Optional CORS middleware if cần gọi thẳng workers.dev (không cần khi dùng proxy /api)
export function corsHeaders(origin) {
  const hdrs = {
    'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Credentials': 'false',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
    'Access-Control-Allow-Origin': '*',
  };
  return hdrs;
}
export function handleOptions(req) {
  const origin = req.headers.get('Origin') || '';
  return new Response(null, { status: 204, headers: corsHeaders(origin) });
}
export function withCors(req, res) {
  const origin = req.headers.get('Origin') || '';
  const base = corsHeaders(origin);
  const h = new Headers(res.headers);
  for (const [k, v] of Object.entries(base)) h.set(k, v);
  return new Response(res.body, { status: res.status, headers: h });
}
