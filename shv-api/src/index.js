export default {
  async fetch(request, env, ctx) {
    try {
      return await handle(request, env, ctx);
    } catch (e) {
      return withCORS(new Response(JSON.stringify({ ok:false, error: String(e) }), {
        status: 500, headers: { 'content-type':'application/json' }
      }));
    }
  }
};

function withCORS(res) {
  const h = new Headers(res.headers);
  h.set('Access-Control-Allow-Origin', '*');
  h.set('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  h.set('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  h.set('Vary', 'Origin');
  return new Response(res.body, { status: res.status, headers: h });
}

async function handle(request, env, ctx) {
  const url = new URL(request.url);

  // Preflight
  if (request.method === 'OPTIONS') {
    return withCORS(new Response('ok', { status: 200 }));
  }

  // --- /admin/login (POST JSON hoặc GET query) ---
  if (url.pathname.startsWith('/admin/login')) {
    let u='', p='';
    if (request.method === 'POST') {
      const b = await request.json().catch(()=> ({}));
      u = b.u || ''; p = b.p || '';
    } else if (request.method === 'GET') {
      u = url.searchParams.get('u') || '';
      p = url.searchParams.get('p') || '';
    } else {
      return withCORS(new Response('Method Not Allowed', { status: 405 }));
    }
    const out = await doLogin(u, p, env);
    return withCORS(new Response(JSON.stringify(out), {
      headers: { 'content-type': 'application/json' }
    }));
  }

  // --- /admin/me (xác thực token) ---
  if (url.pathname.startsWith('/admin/me')) {
    const token = (request.headers.get('Authorization') || '').replace(/^Bearer\s+/i,'').trim();
    const ok = await verifyToken(token, env);
    return withCORS(new Response(JSON.stringify({ ok }), {
      status: ok ? 200 : 401,
      headers: { 'content-type': 'application/json' }
    }));
  }

  // Các route khác có thể giữ nguyên dịch vụ cũ của bạn.
  return withCORS(new Response(JSON.stringify({ ok:true, msg:'worker alive' }), {
    headers: { 'content-type':'application/json' }
  }));
}

async function doLogin(u, p, env) {
  // TODO: kiểm tra trong AUTH_KV nếu bạn đang lưu user/pass
  // Tạm thời chấp nhận bất kỳ mật khẩu nào cho user 'admin' để demo đăng nhập.
  if (u === 'admin' && p && p.length > 0) {
    const token = cryptoRandom32();
    // Nếu muốn lưu kiểm soát token theo TTL:
    // await env.AUTH_KV.put('TOKEN:'+token, JSON.stringify({u, ts:Date.now()}), { expirationTtl: 86400 });
    return { ok: true, token };
  }
  return { ok:false, error:'invalid credentials' };
}

async function verifyToken(token, env) {
  if (!token || token.length !== 32) return false;
  // Nếu bạn lưu token trong KV, thì đọc ra và kiểm tra tại đây.
  // const v = await env.AUTH_KV.get('TOKEN:'+token);
  // return !!v;
  return true;
}

function cryptoRandom32(){
  // 16 bytes -> 32 hex
  const a = new Uint8Array(16);
  crypto.getRandomValues(a);
  return [...a].map(x => x.toString(16).padStart(2,'0')).join('');
}
