// shv-api/modules/products.js
const cors = () => ({
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization,content-type',
  'access-control-allow-methods': 'GET,POST,DELETE,OPTIONS'
});
const json = (status, data) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json', ...cors() } });

export async function handleProducts(req, env, fire) {
  const url = new URL(req.url);

  // Tạo/Cập nhật 1 sản phẩm
  if (req.method === 'POST' && url.pathname === '/admin/products') {
    const body = await req.json();
    const id = body.id || crypto.randomUUID();
    const now = Date.now();

    body.id = id;
    body.createdAt = body.createdAt || now;
    body.updatedAt = now;

    // Fire là wrapper Firestore đã có trong repo
    await fire.set('products', id, body);

    return json(200, { ok: true, id });
  }

  // Danh sách sản phẩm (admin)
  if (req.method === 'GET' && url.pathname === '/admin/products') {
    const limit = Number(url.searchParams.get('limit') || 20);
    const cursor = url.searchParams.get('cursor') || null;
    const rs = await fire.list('products', { limit, cursor, orderBy: ['createdAt', 'desc'] });
    return json(200, rs);
  }

  // Xoá 1 sản phẩm (admin)
  if (req.method === 'DELETE' && url.pathname.startsWith('/admin/products/')) {
    const id = url.pathname.split('/').pop();
    await fire.delete('products', id);
    return json(200, { ok: true });
  }

  return json(404, { error: 'Not Found' });
}
