// shv-api/src/modules/products.js

// Helper trả JSON
function j(status, data, headers) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...(headers || {}) },
  });
}

// Chuẩn hoá dữ liệu product từ body FE
function normalizeProduct(input = {}) {
  const toNum = (x) => {
    const n = Number(x);
    return Number.isFinite(n) ? n : 0;
  };
  const toNumOrNull = (x) => {
    if (x === undefined || x === null || String(x).trim?.() === '') return null;
    const n = Number(x);
    return Number.isFinite(n) ? n : null;
  };
  const toArr = (v) => (Array.isArray(v) ? v : []);

  const now = new Date().toISOString();
  const id = input.id || crypto.randomUUID();

  return {
    id,
    name: String(input.name || '').trim(),
    description: String(input.description || ''),
    price: toNum(input.price),
    sale_price: toNumOrNull(input.sale_price),
    stock: toNum(input.stock),
    category: String(input.category || 'default'),
    weight_grams: toNum(input.weight_grams),
    images: toArr(input.images),
    image_alts: toArr(input.image_alts),
    is_active: !!input.is_active,

    // mở rộng
    brand: String(input.brand || ''),
    origin: String(input.origin || ''),
    variants: toArr(input.variants || []),

    seo: typeof input.seo === 'object'
      ? {
          title: String(input.seo.title || input.seo_title || ''),
          description: String(input.seo.description || input.seo_description || ''),
          keywords: String(input.seo.keywords || input.seo_keywords || ''),
        }
      : {
          title: String(input.seo_title || ''),
          description: String(input.seo_description || ''),
          keywords: String(input.seo_keywords || ''),
        },

    created_at: input.created_at || now,
    updated_at: now,
  };
}

// Tầng lưu trữ qua wrapper Fire
async function upsertProduct(fire, product) {
  if (typeof fire.set === 'function') {
    await fire.set('products', product.id, product);
  } else if (typeof fire.upsert === 'function') {
    await fire.upsert('products', product.id, product);
  } else {
    throw new Error('Fire: missing set/upsert(products)');
  }
}
async function removeProduct(fire, id) {
  if (!id) throw new Error('Missing id');
  if (typeof fire.remove === 'function') {
    await fire.remove('products', id);
  } else if (typeof fire.delete === 'function') {
    await fire.delete('products', id);
  } else {
    throw new Error('Fire: missing remove/delete(products)');
  }
}

// Router cho /admin/products* (cần token đã check ngoài index.js)
export async function handleProducts(req, env, fire) {
  const url = new URL(req.url);
  const { pathname } = url;

  // ===== ADMIN: GET list (cả active & inactive)
  if (req.method === 'GET' && pathname === '/admin/products') {
    const limit = Math.min(Number(url.searchParams.get('limit') || 50), 200);
    const cursor = url.searchParams.get('cursor') || '';
    // nếu Fire của bạn hỗ trợ where/orderBy/cursor như banners:
    const rs = await fire.list('products', {
      orderBy: ['created_at', 'desc'],
      limit,
      cursor,
    });
    return j(200, { items: rs.items || [], nextCursor: rs.nextCursor || null });
  }

  // ===== ADMIN: GET 1 item
  if (req.method === 'GET' && pathname.startsWith('/admin/products/')) {
    const id = pathname.split('/').pop();
    const item = await fire.get('products', id);
    if (!item) return j(404, { error: 'Not found' });
    return j(200, { item });
  }

  // ===== ADMIN: POST upsert 1 item
  if (req.method === 'POST' && pathname === '/admin/products') {
    let body;
    try { body = await req.json(); } catch { return j(400, { error: 'Invalid JSON' }); }
    const product = normalizeProduct(body);
    await upsertProduct(fire, product);
    return j(200, { ok: true, item: product });
  }

  // ===== ADMIN: BULK upsert
  if (req.method === 'POST' && pathname === '/admin/products/bulk') {
    let payload;
    try { payload = await req.json(); } catch { return j(400, { error: 'Invalid JSON' }); }
    const items = Array.isArray(payload?.items) ? payload.items : [];
    let ok = 0, fail = 0, details = [];
    for (let i = 0; i < items.length; i++) {
      try {
        const p = normalizeProduct(items[i]);
        await upsertProduct(fire, p);
        ok++;
      } catch (e) {
        fail++; details.push({ i, error: String(e?.message || e) });
      }
    }
    return j(200, { ok, fail, details });
  }

  // ===== ADMIN: DELETE 1 item
  if (req.method === 'DELETE' && pathname.startsWith('/admin/products/')) {
    const id = pathname.split('/').pop();
    await removeProduct(fire, id);
    return j(200, { ok: true });
  }

  return j(405, { error: 'Method Not Allowed' });
}
