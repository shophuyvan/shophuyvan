// shv-api/src/modules/products.js

function j(status, data, headers) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...(headers || {}) },
  });
}

// ✅ HÀM TÍNH GIÁ THẤP NHẤT TỪ VARIANTS
function calculateMinPrices(product) {
  const variants = Array.isArray(product.variants) ? product.variants : [];
  
  if (variants.length === 0) {
    return product;
  }
  
  let minSale = null;
  let minRegular = null;
  let minCost = null;
  
  for (const v of variants) {
    const sale = Number(v.sale_price ?? v.price_sale) || null;
    const regular = Number(v.price) || null;
    const cost = Number(v.cost ?? v.cost_price ?? v.import_price ?? v.price_import ?? v.purchase_price) || null;
    
    if (sale !== null && sale > 0) {
      minSale = (minSale === null) ? sale : Math.min(minSale, sale);
    }
    
    if (regular !== null && regular > 0) {
      minRegular = (minRegular === null) ? regular : Math.min(minRegular, regular);
    }
    
    if (cost !== null && cost > 0) {
      minCost = (minCost === null) ? cost : Math.min(minCost, cost);
    }
  }
  
  return {
    ...product,
    price: minRegular || product.price || 0,
    sale_price: minSale || product.sale_price || null,
    cost: minCost || product.cost || 0,
    variants: variants
  };
}

// Chuẩn hóa dữ liệu product
function normalizeProduct(input = {}) {
  function normalizeVariants(arr){
    if (!Array.isArray(arr)) return [];
    return arr.map(v => ({
      image: String(v.image||'').trim(),
      name: String(v.name||'').trim(),
      sku: String(v.sku||'').trim(),
      stock: Number(v.stock||0),
      weight_grams: Number(v.weight_grams||0),
      price: Number(v.price||0),
      sale_price: (v.sale_price===undefined || v.sale_price===null || String(v.sale_price).trim?.()==='') ? null : Number(v.sale_price),
      cost: Number((v.cost ?? v.cost_price ?? v.import_price ?? v.price_import ?? v.purchase_price) ?? 0)
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
  const id = input.id || (crypto?.randomUUID?.() || String(Date.now()));

  return {
    id,
    name: String(input.name || '').trim(),
    description: String(input.description || ''),
    price: toNum(input.price),
    sale_price: toNumOrNull(input.sale_price),
    cost: toNum(input.cost ?? input.cost_price ?? input.import_price ?? input.price_import ?? input.purchase_price),
    stock: toNum(input.stock),
    category: String(input.category || 'default'),
    weight_grams: toNum(input.weight_grams),
    images: toArr(input.images),
    image_alts: toArr(input.image_alts),
    is_active: (input.is_active === undefined || String(input.is_active).trim?.() === '') ? true : !!input.is_active,

    brand: String(input.brand || ''),
    origin: String(input.origin || ''),
    variants: normalizeVariants(input.variants),
    videos: toArr(input.videos),
    faq: toArr(input.faq),
    reviews: toArr(input.reviews),

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

// ============================================
// MAIN ROUTER
// ============================================
export async function handle(req, env, ctx) {
  const url = new URL(req.url);
  const { pathname, searchParams } = url;

  // KV-based fire object implementation
  const fire = {
    list: async (table, opts = {}) => {
      try {
        const prefix = `${table}:`;
        const list = await env.SHV.list({ prefix });
        const items = [];
        
        for (const key of list.keys) {
          const data = await env.SHV.get(key.name);
          if (data) {
            try {
              items.push(JSON.parse(data));
            } catch {}
          }
        }
        
        // Sort by created_at desc if specified
        if (opts.orderBy?.[0] === 'created_at' && opts.orderBy?.[1] === 'desc') {
          items.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
        }
        
        // Apply limit
        const limit = opts.limit || 50;
        return { items: items.slice(0, limit), nextCursor: null };
      } catch (e) {
        console.error('fire.list error:', e);
        return { items: [], nextCursor: null };
      }
    },
    
    get: async (table, id) => {
      try {
        const data = await env.SHV.get(`${table}:${id}`);
        return data ? JSON.parse(data) : null;
      } catch (e) {
        console.error('fire.get error:', e);
        return null;
      }
    },
    
    set: async (table, id, data) => {
      try {
        await env.SHV.put(`${table}:${id}`, JSON.stringify(data));
      } catch (e) {
        console.error('fire.set error:', e);
        throw e;
      }
    },
    
    delete: async (table, id) => {
      try {
        await env.SHV.delete(`${table}:${id}`);
      } catch (e) {
        console.error('fire.delete error:', e);
        throw e;
      }
    }
  };

  // ============================================
  // PUBLIC ROUTES
  // ============================================

  // GET /public/products?limit=&cursor=&category=&q=
  if (req.method === 'GET' && pathname === '/public/products') {
    const limit = Math.min(Number(searchParams.get('limit')) || 50, 200);
    const cursor = searchParams.get('cursor') || undefined;
    const category = searchParams.get('category') || '';
    const q = (searchParams.get('q') || '').trim().toLowerCase();

    const rs = await fire.list('products', {
      orderBy: ['created_at', 'desc'],
      limit,
      cursor,
    });

    let items = (rs.items || []).filter(p => p.is_active !== false);

    if (category) {
      items = items.filter(p => String(p.category || '').toLowerCase() === category.toLowerCase());
    }

    if (q) {
      items = items.filter(p =>
        String(p.name || '').toLowerCase().includes(q) ||
        String(p.category || '').toLowerCase().includes(q)
      );
    }

    // ✅ TỰ ĐỘNG TÍNH GIÁ THẤP NHẤT
    items = items.map(calculateMinPrices);

    return j(200, { items, nextCursor: rs.nextCursor || null });
  }

  // GET /public/products/:id HOẶC /public/product?id=xxx
  if (req.method === 'GET' && (pathname.startsWith('/public/products/') || pathname === '/public/product')) {
    let id = '';
    
    if (pathname.startsWith('/public/products/')) {
      id = pathname.replace('/public/products/', '');
    } else if (pathname === '/public/product') {
      id = searchParams.get('id') || '';
    }

    if (!id) return j(400, { error: 'Missing product id' });

    let item = await fire.get('products', id);
    if (!item) return j(404, { error: 'Product not found' });
    if (item.is_active === false) return j(404, { error: 'Product not found' });

    // ✅ TỰ ĐỘNG TÍNH GIÁ
    item = calculateMinPrices(item);

    return j(200, { item });
  }

  // GET /products (legacy support)
  if (req.method === 'GET' && pathname === '/products') {
    const limit = Math.min(Number(searchParams.get('limit')) || 50, 200);
    const cursor = searchParams.get('cursor') || undefined;

    const rs = await fire.list('products', {
      orderBy: ['created_at', 'desc'],
      limit,
      cursor,
    });

    let items = (rs.items || []).filter(p => p.is_active !== false);
    
    // ✅ TỰ ĐỘNG TÍNH GIÁ
    items = items.map(calculateMinPrices);

    return j(200, { items, nextCursor: rs.nextCursor || null });
  }

  // GET /products/:id HOẶC /product?id=xxx (legacy)
  if (req.method === 'GET' && (pathname.startsWith('/products/') || pathname === '/product')) {
    let id = '';
    
    if (pathname.startsWith('/products/')) {
      id = pathname.replace('/products/', '');
    } else if (pathname === '/product') {
      id = searchParams.get('id') || '';
    }

    if (!id) return j(400, { error: 'Missing product id' });

    let item = await fire.get('products', id);
    if (!item) return j(404, { error: 'Product not found' });

    // ✅ TỰ ĐỘNG TÍNH GIÁ
    item = calculateMinPrices(item);

    return j(200, { item });
  }

  // ============================================
  // ADMIN ROUTES
  // ============================================

  // GET /admin/products?limit=&cursor=&q=
  if (req.method === 'GET' && pathname === '/admin/products') {
    const limit = Math.min(Number(searchParams.get('limit')) || 50, 200);
    const cursor = searchParams.get('cursor') || undefined;
    const q = (searchParams.get('q') || '').trim().toLowerCase();

    const rs = await fire.list('products', {
      orderBy: ['created_at', 'desc'],
      limit,
      cursor,
    });

    let items = rs.items || [];
    if (q) {
      items = items.filter(p =>
        String(p.name || '').toLowerCase().includes(q) ||
        String(p.category || '').toLowerCase().includes(q)
      );
    }

    // ✅ TỰ ĐỘNG TÍNH GIÁ
    items = items.map(calculateMinPrices);

    return j(200, { items, nextCursor: rs.nextCursor || null });
  }

  // GET /admin/products/:id
  if (req.method === 'GET' && pathname.startsWith('/admin/products/')) {
    const id = pathname.split('/').pop();
    let item = await fire.get('products', id);
    if (!item) return j(404, { error: 'Not Found' });

    // ✅ TỰ ĐỘNG TÍNH GIÁ
    item = calculateMinPrices(item);

    return j(200, { item });
  }

  // POST /admin/products – body: Product
  if (req.method === 'POST' && pathname === '/admin/products') {
    let body;
    try { body = await req.json(); } catch { return j(400, { error: 'Invalid JSON' }); }
    let product = normalizeProduct(body);

    // ✅ TỰ ĐỘNG TÍNH GIÁ
    product = calculateMinPrices(product);

    await upsertProduct(fire, product);
    return j(200, { ok: true, item: product });
  }

  // POST /admin/products/bulk – body: { items: Product[] }
  if (req.method === 'POST' && pathname === '/admin/products/bulk') {
    let payload;
    try { payload = await req.json(); } catch { return j(400, { error: 'Invalid JSON' }); }

    const items = Array.isArray(payload?.items) ? payload.items : [];
    let ok = 0, fail = 0, details = [];
    for (let i = 0; i < items.length; i++) {
      try {
        let p = normalizeProduct(items[i]);
        // ✅ TỰ ĐỘNG TÍNH GIÁ
        p = calculateMinPrices(p);
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
    await removeProduct(fire, id);
    return j(200, { ok: true });
  }

  return j(405, { error: 'Method Not Allowed' });
}