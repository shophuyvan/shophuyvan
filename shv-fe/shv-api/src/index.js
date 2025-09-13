// Cloudflare Worker: add /admin/login for username/password → returns {token}
/* SHV admin login route */
async function handleAdminLogin(request, env){
  const url = new URL(request.url);
  const u = url.searchParams.get('u')||'';
  const p = url.searchParams.get('p')||'';
  const ok = (!!env.ADMIN_USER && !!env.ADMIN_PASS && u===env.ADMIN_USER && p===env.ADMIN_PASS);
  if (!ok) return new Response(JSON.stringify({error:'unauthorized'}), {status:401, headers:{'content-type':'application/json'}});
  const token = env.ADMIN_TOKEN || env.ADMIN_KEY || env.ADMIN_SECRET || env.TOKEN || '';
  if (!token) return new Response(JSON.stringify({error:'missing token in env'}), {status:500, headers:{'content-type':'application/json'}});
  return new Response(JSON.stringify({token}), {status:200, headers:{'content-type':'application/json'}});
}

addEventListener('fetch', event => {
  event.respondWith((async (req, env, ctx)=>{
    const url = new URL(event.request.url);
    if (url.pathname==='/admin/login') return handleAdminLogin(event.request, env);
    // fallthrough to your existing handler (replace with your app's logic if needed)
    return fetch(event.request);
  })(event.request, event.target && event.target.env, event));
});
