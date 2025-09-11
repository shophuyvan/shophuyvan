// shv-api/src/modules/products.js

function j(status, data, headers) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...(headers || {}) },
  });
}

// Chuẩn hóa 1 product & ép kiểu an toàn
function normalizeProduct(input = {}) {
  function normalizeVariants(arr){
    if (!Array.isArray(arr)) return [];
    return arr.map(v => ({
      image: String(v.image||'').trim(),
      name:  String(v.name||'').trim(),
      sku:   String(v.sku||'').trim(),
      stock: Number(v.stock||0),
      weight_grams: Number(v.weight_grams||0),
      price: Number(v.price||0),
      // sale_price cho phép null
      sale_price:
        (v.sale_price===undefined || v.sale_price===null || String(v.sale_price).trim?.()==='')
          ? null : Number(v.sale_price),
    })).filter(v => v.name);
  }

  const toNum = (x) => (Number.isFinite(Number(x)) ? Number(x) : 0);
  const toNumOrNull = (x) => {
    if (x === undefined || x === null || String(x).trim?.() === '') return null;
    const n = Number(x);
    return Number.isFinite(n) ? n : null;
  };
  const toArr = (v) => (Array.isArray(v) ? v : []);

  const now = new Date().toISOString();
  const id  = input.id || (crypto?.randomUUID?.() || String(Date.now()));

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

    // CSV rỗng => để true (không tự tắt sản phẩm)
    is_active: (input.is_active === undefined || String(input.is_active).trim?.() === '')
      ? true : !!input.is_active,

    brand:  String(input.brand || ''),
    origin: String(input.origin || ''),

    variants: normalizeVariants(input.variants),
    videos:   toArr(input.videos),
    faq:      toArr(input.faq),
    reviews:  toArr(input.reviews),

    seo: typeof input.seo === 'object'
      ? {
          title:       String(input.seo.title || input.seo_title || ''),
          description: String(input.seo.description || input.seo_description || ''),
          keywords:    String(input.seo.keywords || input.seo_keywords || ''),
        }
      : {
          title:       String(input.seo_title || ''),
          description: String(input.seo_description || ''),
          keywords:    String(input.seo_keywords || ''),
        },

    created_at: input.created_at || now,
    updated_at: now,
  };
}

// Upsert “an toàn”: nếu env hỗ trợ upsert thì dùng, không thì set
async function upsertProduct(fire, product) {
  if (typeof fire.upsert === 'function') {
    await fire.upsert('products', product.id, product);
  } else if (typeof fire.set === 'function') {
    await fire.set('products', product.id, product);
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

// Router /admin/products*
export async function handleProducts(req, env, fire) {
  const url = new URL(req.url);
  const { pathname, searchParams } = url;

  // ------- GET LIST (admin) -------
  // GET /admin/products?limit=&cursor=&q=
  if (req.method === 'GET' && pathname === '/admin/products') {
    const limit  = Math.min(Number(searchParams.get('limit')) || 50, 200);
    const cursor = searchParams.get('cursor') || undefined;
    const q      = (searchParams.get('q') || '').trim().toLowerCase();

    const rs = await fire.list('products', {
      orderBy: ['created_at', 'desc'],
      limit, cursor,
    });

    let items = rs.items || [];
    if (q) {
      items = items.filter(p =>
        String(p.name || '').toLowerCase().includes(q) ||
        String(p.category || '').toLowerCase().includes(q)
      );
    }
    return j(200, { items, nextCursor: rs.nextCursor || null });
  }

  // ------- GET ONE (admin) -------
  // GET /admin/products/:id
  if (req.method === 'GET' && pathname.startsWith('/admin/products/')) {
    const id = pathname.split('/').pop();
    const item = await fire.get('products', id);
    if (!item) return j(404, { error: 'Not Found' });
    return j(200, { item });
  }

  // ------- CREATE/UPDATE -------
  // POST /admin/products  — body: Product
  if (req.method === 'POST' && pathname === '/admin/products') {
    let body;
    try { body = await req.json(); } catch { return j(400, { error: 'Invalid JSON' }); }

    // **MERGE** với dữ liệu cũ để không xoá mảng/field nếu client gửi thiếu
    const current = body?.id ? (await fire.get('products', body.id)) || {} : {};
    const merged  = { ...current, ...body };
    const product = normalizeProduct(merged);

    await upsertProduct(fire, product);
    return j(200, { ok: true, item: product });
  }

  // ------- BULK UPSERT -------
  // POST /admin/products/bulk — body: { items: Product[] }
  if (req.method === 'POST' && pathname === '/admin/products/bulk') {
    let payload;
    try { payload = await req.json(); } catch { return j(400, { error: 'Invalid JSON' }); }

    const items = Array.isArray(payload?.items) ? payload.items : [];
    let ok = 0, fail = 0, details = [];
    for (let i = 0; i < items.length; i++) {
      try {
        const id  = items[i]?.id;
        const cur = id ? (await fire.get('products', id)) || {} : {};
        const p   = normalizeProduct({ ...cur, ...items[i] });
        await upsertProduct(fire, p);
        ok++;
      } catch (e) {
        fail++; details.push({ i, error: String(e?.message || e) });
      }
    }
    return j(200, { ok, fail, details });
  }

  // ------- DELETE -------
  // DELETE /admin/products/:id
  if (req.method === 'DELETE' && pathname.startsWith('/admin/products/')) {
    const id = pathname.split('/').pop();
    await removeProduct(fire, id);
    return j(200, { ok: true });
  }

  return j(405, { error: 'Method Not Allowed' });
}
