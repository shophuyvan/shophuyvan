export async function handleUsers(req, env, fire) {
  const url = new URL(req.url);
  if (req.method === 'GET') {
    return new Response(JSON.stringify({ items: [], nextCursor: null }), { headers: { 'content-type':'application/json' }});
  }
  return new Response(JSON.stringify({ error: 'Method not allowed' }), { status:405, headers: { 'content-type':'application/json' }});
}
