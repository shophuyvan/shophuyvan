export async function handleBanners(req, env, fire) {
  if (req.method === 'GET') {
    // Public fetch in FE uses same route (without admin header) in this starter
    return new Response(JSON.stringify({ items: [] }), { headers: { 'content-type': 'application/json' }});
  }
  if (req.method === 'POST') {
    const body = await req.json();
    // TODO: upsert Firestore
    return new Response(JSON.stringify({ ok: true, item: body }), { headers: { 'content-type':'application/json' }});
  }
  if (req.method === 'DELETE') {
    return new Response(JSON.stringify({ ok: true }), { headers: { 'content-type':'application/json' }});
  }
}
