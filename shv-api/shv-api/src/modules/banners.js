
export async function handleBanners(req, env, fire) {
  const url = new URL(req.url);
  const idParam = url.searchParams.get('id');
  const parts = url.pathname.split('/').filter(Boolean); // ["admin","banners",":id?"]
  const idFromPath = parts.length >= 3 ? parts[2] : null;
  const id = idFromPath || idParam || null;

  if (req.method === 'GET') {
    if (id){
      const item = await fire.get('banners', id);
      return new Response(JSON.stringify({ item }), { headers:{'content-type':'application/json'} });
    }
    const limit = Math.min(Number(url.searchParams.get('limit')||50), 200);
    const cursor = url.searchParams.get('cursor') || null;
    const rs = await fire.list('banners', { orderBy:['order','asc'], limit, cursor });
    return new Response(JSON.stringify({ items: rs.items, nextCursor: rs.nextCursor||null }), { headers:{'content-type':'application/json'} });
  }

  if (req.method === 'POST' || req.method === 'PUT') {
    const body = await req.json().catch(()=>({}));
    const now = Date.now();
    // normalise fields
    const item = {
      id: String(body.id || id || Math.random().toString(36).slice(2)),
      title: body.title || body.name || '',
      image_url: body.image_url || body.image || body.img || '',
      link_url: body.link_url || body.link || '',
      order: Number(body.order ?? 0),
      is_active: body.is_active ?? body.active ?? true,
      updated_at: now,
    };
    await fire.set('banners', item.id, item);
    return new Response(JSON.stringify({ ok:true, item }), { headers:{'content-type':'application/json'} });
  }

  if (req.method === 'DELETE') {
    if (!id) return new Response(JSON.stringify({ ok:false, error:'missing_id' }), { status:400, headers:{'content-type':'application/json'} });
    await fire.remove('banners', id);
    return new Response(JSON.stringify({ ok:true }), { headers:{'content-type':'application/json'} });
  }

  return new Response(JSON.stringify({ ok:false, error:'method_not_allowed' }), { status:405, headers:{'content-type':'application/json'} });
}
