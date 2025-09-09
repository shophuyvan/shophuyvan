export async function handleVouchers(req, env, fire) {
  if (req.method === 'GET') {
    return new Response(JSON.stringify({ items: [], nextCursor: null }), { headers: { 'content-type':'application/json' }});
  }
  if (req.method === 'POST') {
    const body = await req.json();
    return new Response(JSON.stringify({ ok: true, item: body }), { headers: { 'content-type':'application/json' }});
  }
  if (req.method === 'DELETE') {
    return new Response(JSON.stringify({ ok: true }), { headers: { 'content-type':'application/json' }});
  }
}
