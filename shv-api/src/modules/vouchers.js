/* SHV safe patch header */

export async function handleVouchers(req, env, fire) {
  const url = new URL(req.url);
  const idParam = url.searchParams.get('id');
  const parts = url.pathname.split('/').filter(Boolean); // ["admin","vouchers",":id?"]
  const idFromPath = parts.length >= 3 ? parts[2] : null;
  const id = (idFromPath || idParam || '').toUpperCase();

  if (req.method === 'GET') {
    if (id){
      const item = await fire.get('vouchers', id);
      return new Response(JSON.stringify({ item }), { headers:{'content-type':'application/json'} });
    }
    const limit = Math.min(Number(url.searchParams.get('limit')||100), 500);
    const cursor = url.searchParams.get('cursor') || null;
    const rs = await fire.list('vouchers', { orderBy:['updated_at','desc'], limit, cursor });
    return new Response(JSON.stringify({ items: rs.items, nextCursor: rs.nextCursor||null }), { headers:{'content-type':'application/json'} });
  }

  if (req.method === 'POST' || req.method === 'PUT') {
    const body = await req.json().catch(()=>({}));
    const code = String(body.code || id || '').toUpperCase();
    if (!code) return new Response(JSON.stringify({ ok:false, error:'missing_code' }), { status:400, headers:{'content-type':'application/json'} });
    const now = Date.now();
    const item = {
      id: code,
      code,
      type: (body.type || body.kind || 'amount').toLowerCase(), // 'percent' | 'amount' | 'ship'
      value: Number(body.value ?? body.discount ?? body.off ?? 0),
      min_order: Number(body.min_order ?? body.min ?? 0),
      product_ids: Array.isArray(body.product_ids) ? body.product_ids : (String(body.product_ids||'').split(',').map(s=>s.trim()).filter(Boolean)),
      starts_at: body.starts_at ? Number(body.starts_at) : (body.starts ? Date.parse(body.starts) : null),
      ends_at: body.ends_at ? Number(body.ends_at) : (body.expiry ? Date.parse(body.expiry) : null),
      is_active: body.is_active ?? body.active ?? true,
      updated_at: now,
    };
    await fire.set('vouchers', code, item);
    return new Response(JSON.stringify({ ok:true, item }), { headers:{'content-type':'application/json'} });
  }

  if (req.method === 'DELETE') {
    if (!id) return new Response(JSON.stringify({ ok:false, error:'missing_code' }), { status:400, headers:{'content-type':'application/json'} });
    await fire.remove('vouchers', id);
    return new Response(JSON.stringify({ ok:true }), { headers:{'content-type':'application/json'} });
  }

  return new Response(JSON.stringify({ ok:false, error:'method_not_allowed' }), { status:405, headers:{'content-type':'application/json'} });
}
