// workers/shv-api/src/lib/response.js
export function corsHeaders(req) {
  const origin = req.headers.get('Origin') || '*';
  const reqHdr = req.headers.get('Access-Control-Request-Headers') ||
  'authorization,content-type,x-token,x-customer-token,x-requested-with';
  
  return {
    'Access-Control-Allow-Origin': origin,
    'Vary': 'Origin',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
    'Access-Control-Max-Age': '86400',
    'Access-Control-Allow-Headers': reqHdr,
    'Access-Control-Expose-Headers': 'x-token,x-customer-token',
    'Access-Control-Allow-Credentials': 'true'
  };
}

export function json(data, init = {}, req) {
  return new Response(JSON.stringify(data || {}), {
    status: init.status || 200,
    headers: {
      ...corsHeaders(req),
      'content-type': 'application/json; charset=utf-8'
    }
  });
}

export function errorResponse(error, status = 500, req) {
  return json({ 
    ok: false, 
    error: String(error?.message || error) 
  }, { status }, req);
}