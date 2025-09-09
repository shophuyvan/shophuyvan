// shv-api/src/modules/products.js

// Trả JSON tiện dụng
function j(status, data, headers) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...(headers || {}) },
  });
}

// Chuẩn hoá dữ liệu product từ body
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

    // mở rộng (nếu FE có gửi)
    brand: String(input.brand || ''),
    origin: String(input.origin || ''),
    variants: toArr(input.variants), // [{name, sku, price, sale_price, stock, weight_grams, image}, ...]

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

// Tầng lưu trữ qua wrapper Fire của bạn
async function upsertProduct(fire, product) {
  // Fire trong dự án của bạn đã dùng fire.list/ fire.get ở banners,
  // thường cũng có fire.set(collection, id, data)
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

// Router cho /admin/products*
export async function handleProducts(req, env, fire) {
  const url = new URL(req.url);
  const { pathname } = url;

  // POST /admin/products  — tạo/cập nhật 1 sản phẩm
  if (req.method === 'POST' && pathname === '/admin/products') {
    let body;
    try { body = await req.json(); } catch { return j(400, { error: 'Invalid JSON' }); }

    const product = normalizeProduct(body);
    await upsertProduct(fire, product);
    return j(200, { ok: true, item: product });
  }

  // POST /admin/products/bulk  — nhận { items: Product[] }
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

  // DELETE /admin/products/:id
  if (req.method === 'DELETE' && pathname.startsWith('/admin/products/')) {
    const id = pathname.split('/').pop();
    if (!id) return j(400, { error: 'Missing id' });
    await removeProduct(fire, id);
    return j(200, { ok: true });
  }

  // Nếu path/method không khớp
  return j(405, { error: 'Method Not Allowed' });
}
