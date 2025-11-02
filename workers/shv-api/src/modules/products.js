// ===================================================================
// modules/products.js - Products Module (FIXED CATEGORY)
// Đường dẫn: workers/shv-api/src/modules/products.js
// ===================================================================

import { json, errorResponse } from '../lib/response.js';
import { adminOK } from '../lib/auth.js';
import { getJSON, putJSON } from '../lib/kv.js';
import { readBody, slugify } from '../lib/utils.js';

/**
 * Main handler for all product routes
 */
export async function handle(req, env, ctx) {
  const url = new URL(req.url);
  const path = url.pathname;
  const method = req.method;

  // ===== PUBLIC ROUTES =====

  // Public: Get single product by ID (query param)
  if (path === '/products' && method === 'GET') {
    const productId = url.searchParams.get('id');
    if (productId) {
      return getProductById(req, env, productId);
    }
    return listPublicProducts(req, env);
  }

  // Public: Get product by ID (path param)
  if (path.startsWith('/products/') && method === 'GET') {
    const id = decodeURIComponent(path.split('/')[2] || '').trim();
    if (!id) {
      return errorResponse('No product ID provided', 400, req);
    }
    return getProductById(req, env, id);
  }

  // Public: Get product by ID (alternative path)
  if (path.startsWith('/public/products/') && method === 'GET') {
    const id = decodeURIComponent(path.split('/')[3] || '').trim();
    if (!id) {
      return errorResponse('No product ID provided', 400, req);
    }
    return getProductById(req, env, id);
  }

  // Public: List products with filters
  if (path === '/public/products' && method === 'GET') {
    const productId = url.searchParams.get('id');
    if (productId) {
      return getProductById(req, env, productId);
    }
    return listPublicProductsFiltered(req, env);
  }

  // ===== ADMIN ROUTES =====

  // Admin: List all products
  // FIX: Handle both /admin/products AND /admin/products/list
  if ((path === '/admin/products' || path === '/admin/products/list') && method === 'GET') {
    return listAdminProducts(req, env);
  }

  // Admin: Get single product
  if ((path === '/admin/products/get' || path === '/product') && method === 'GET') {
    return getAdminProduct(req, env);
  }

  // Admin: Upsert product
  if ((path === '/admin/products/upsert' || path === '/admin/product') && method === 'POST') {
    return upsertProduct(req, env);
  }

  // Admin: Delete product
  if (path === '/admin/products/delete' && method === 'POST') {
    return deleteProduct(req, env);
  }

  return errorResponse('Route not found', 404, req);
}

// ===================================================================
// HELPER FUNCTIONS
// ===================================================================

/**
 * ✅ Convert product to summary (lightweight version)
 * Tính giá hiển thị từ variants để FE + Mini luôn có giá ở list (không phụ thuộc price cấp product).
 */
    function toSummary(product) {
      // Tinh theo tier 'retail' de hien thi cong khai
      const priced = computeDisplayPrice(product, 'retail'); // { price_display, compare_at_display }
    
      // FALLBACK: Neu variants khong co gia -> dung gia cap product (tuong thich cu)
      let legacyPrice   = Number(priced.price_display || 0);
      let legacyCompare = Number(priced.compare_at_display || 0);
      
      if (legacyPrice === 0 && priced.no_variant) {
        // Khong co variant -> lay gia truc tiep tu product (neu co)
        legacyPrice = Number(product.price || product.price_sale || 0);
        if (product.price && product.price_sale && product.price_sale < product.price) {
          legacyCompare = Number(product.price);
          legacyPrice = Number(product.price_sale);
        }
      }
    
      return {
        id: product.id,
        title: product.title || product.name || '',
        name: product.title || product.name || '',
        slug: product.slug || slugify(product.title || product.name || ''),
        sku: product.sku || '',
    
        // Gia chuan dung cho UI moi
        price_display: legacyPrice,
        compare_at_display: legacyCompare > 0 ? legacyCompare : null,
    
        // Tuong thich UI cu (card/list dang doc product.price)
        price: legacyPrice,
        price_sale: 0, // bo dung; de 0 de tranh nham
        price_wholesale: product.price_wholesale || 0,
    
        stock: product.stock || 0,
        images: product.images || [],
        category: product.category || '',
        category_slug: product.category_slug || product.category || '',
        status: (product.status === 0 ? 0 : 1),
        weight_gram: product.weight_gram || 0,
        weight_grams: product.weight_grams || 0,
        weight: product.weight || 0,
    
        // THEM: Dong bo sold, rating, reviews
        sold: Number(product.sold || product.sales || product.sold_count || 0),
        rating: Number(product.rating || product.rating_avg || product.rating_average || 5.0),
        rating_count: Number(product.rating_count || product.reviews_count || product.review_count || 0)
      };
    }

/**
 * Build products list from KV
 */
async function listProducts(env) {
  const LIST_KEY = 'products:list';
  const DETAIL_PREFIX = 'product:';
  console.log('[listProducts] 🚀 Bắt đầu...'); // LOG MỚI

  try { // THÊM TRY...CATCH BAO QUANH
    // Try to get cached list first
    console.log(`[listProducts] Đang đọc danh sách cache: ${LIST_KEY}`); // LOG MỚI
    let list = null;
    try { // TRY...CATCH RIÊNG CHO getJSON LIST
      list = await getJSON(env, LIST_KEY, null);
    } catch (e) {
      console.error(`[listProducts] ❌ Lỗi khi đọc danh sách cache ${LIST_KEY}:`, e.message); // LOG MỚI
      list = null; // Đảm bảo list là null nếu lỗi
    }

    if (list && Array.isArray(list) && list.length > 0) {
      console.log(`[listProducts] ✅ Trả về ${list.length} sản phẩm từ cache`); // LOG MỚI
      return list;
    } else {
      console.log(`[listProducts] ⚠️ Cache trống hoặc không hợp lệ, sẽ tạo lại từ chi tiết`); // LOG MỚI
    }

    // Fallback: build from individual product keys
    const items = [];
    let cursor = undefined; // KHỞI TẠO CURSOR = undefined

    console.log(`[listProducts] 🔍 Bắt đầu liệt kê các key có tiền tố '${DETAIL_PREFIX}'`); // LOG MỚI
    let iteration = 0; // Đếm số lần lặp

    do {
      iteration++;
      console.log(`[listProducts]   - Lần lặp ${iteration}, cursor: ${cursor ? '...' : 'none'}`); // LOG MỚI
      let result = null;
      try { // TRY...CATCH RIÊNG CHO LIST KEYS
        result = await env.SHV.list({ prefix: DETAIL_PREFIX, cursor: cursor });
      } catch (e) {
        console.error(`[listProducts] ❌ Lỗi khi liệt kê key (lần lặp ${iteration}):`, e.message); // LOG MỚI
        throw new Error(`Lỗi khi liệt kê key KV: ${e.message}`); // Ném lỗi để dừng lại
      }

      console.log(`[listProducts]   - Tìm thấy ${result.keys.length} key, list_complete: ${result.list_complete}`); // LOG MỚI

      for (const key of result.keys) {
        try { // TRY...CATCH RIÊNG CHO getJSON DETAIL
          const product = await getJSON(env, key.name, null);
          if (product) {
            product.id = product.id || key.name.slice(DETAIL_PREFIX.length);
            items.push(toSummary(product));
          } else {
            console.warn(`[listProducts]     - ⚠️ Dữ liệu cho key ${key.name} bị trống`); // LOG MỚI
          }
        } catch (e) {
          console.error(`[listProducts]     - ❌ Lỗi khi đọc sản phẩm ${key.name}:`, e.message); // LOG MỚI
          continue; // Bỏ qua sản phẩm lỗi
        }
      }

      cursor = result.list_complete ? null : result.cursor;
    } while (cursor);

    console.log(`[listProducts] ✅ Đã tạo lại ${items.length} sản phẩm từ chi tiết`); // LOG MỚI

    // Cache the list
    if (items.length > 0) {
      try { // TRY...CATCH RIÊNG CHO putJSON LIST
        console.log(`[listProducts] 💾 Đang lưu danh sách đã tạo vào cache ${LIST_KEY}`); // LOG MỚI
        await putJSON(env, LIST_KEY, items);
        console.log(`[listProducts] ✅ Lưu cache thành công`); // LOG MỚI
      } catch (e) {
        console.error(`[listProducts] ❌ Lỗi khi lưu cache:`, e.message); // LOG MỚI
        // Không ném lỗi, vẫn trả về danh sách đã tạo
      }
    }

    return items;

  } catch (e) { // CATCH CHO TOÀN BỘ HÀM
    console.error(`[listProducts] 💥 Xảy ra lỗi nghiêm trọng:`, e); // LOG MỚI
throw e; // Ném lại lỗi để hàm gọi (listAdminProducts) bắt được và trả về 500
  }
} 

/**
 * ✅ Category matching helper (FIXED)
 */
function toSlug(input) {
  const text = String(input || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
}

function collectCategoryValues(product) {
  const values = [];
  const push = (v) => { 
    if (v !== undefined && v !== null && v !== '') values.push(v); 
  };

  // ✅ FIX: Lấy từ product trực tiếp trước
  push(product.category);
  push(product.category_slug);
  push(product.cate);
  push(product.categoryId);
  
  const raw = (product && product.raw) || {};
  const meta = product?.meta || raw?.meta || {};

  [raw, meta].forEach(obj => {
    if (!obj) return;
    push(obj.category);
    push(obj.category_slug);
    push(obj.cate);
    push(obj.categoryId);
    push(obj.group);
    push(obj.group_slug);
    push(obj.type);
    push(obj.collection);
  });

  if (Array.isArray(product?.categories)) values.push(...product.categories);
  if (Array.isArray(raw?.categories)) values.push(...raw.categories);
  if (Array.isArray(product?.tags)) values.push(...product.tags);
  if (Array.isArray(raw?.tags)) values.push(...raw.tags);

  return values.flatMap(v => {
    if (Array.isArray(v)) {
      return v.map(x => toSlug(x?.slug || x?.code || x?.name || x?.title || x?.label || x?.text || x));
    }
    if (typeof v === 'object') {
      return [toSlug(v?.slug || v?.code || v?.name || v?.title || v?.label || v?.text)];
    }
    return [toSlug(v)];
  }).filter(Boolean);
}

function matchCategoryStrict(product, category) {
  if (!category) return true;

  const want = toSlug(category);
  
  // Category aliases for Vietnamese
  const alias = {
    'dien-nuoc': ['điện & nước', 'điện nước', 'dien nuoc', 'thiet bi dien nuoc'],
    'nha-cua-doi-song': ['nhà cửa đời sống', 'nha cua doi song', 'do gia dung'],
    'hoa-chat-gia-dung': ['hoá chất gia dụng', 'hoa chat gia dung', 'hoa chat'],
    'dung-cu-thiet-bi-tien-ich': ['dụng cụ thiết bị tiện ích', 'dung cu thiet bi tien ich', 'dung cu tien ich']
  };

  const wants = [want, ...(alias[want] || []).map(toSlug)];
  const candidates = collectCategoryValues(product);

  console.log('🔍 Matching:', { 
    productId: product.id, 
    want, 
    candidates: candidates.slice(0, 5),
    match: candidates.some(v => wants.includes(v))
  });

  return candidates.some(v => wants.includes(v));
}
// ---- Price Tier Helpers (variant-only pricing) ----
function getCustomerTier(req) {
  try {
    const url = new URL(req.url);
    const h = (req.headers.get('x-customer-tier') || req.headers.get('x-price-tier') || '').toLowerCase().trim();
    if (h) return h;
    const q = (url.searchParams.get('tier') || '').toLowerCase().trim();
    if (q) return q;
    return 'retail';
  } catch { return 'retail'; }
}

// Only compute from variants; no product-level fallback
function computeDisplayPrice(product, tier) {
  try {
    const toNum = (x) => (typeof x === 'string' ? (Number(x.replace(/[^\d.-]/g, '')) || 0) : Number(x || 0));
    const vars = Array.isArray(product?.variants) ? product.variants : [];

    if (!vars.length) {
      return { price_display: 0, compare_at_display: null, price_tier: tier, no_variant: true };
    }

    let minSale = null;
    let minReg  = null;

    for (const v of vars) {
      // Nếu có field dành cho wholesale ở biến thể, tự phát hiện; nếu không có vẫn dùng sale_price/price
      const svTier = (tier === 'wholesale')
        ? (v.sale_price_wholesale ?? v.wholesale_sale_price ?? null)
        : null;
      const rvTier = (tier === 'wholesale')
        ? (v.price_wholesale ?? v.wholesale_price ?? null)
        : null;

      const sv = toNum(svTier ?? v.sale_price ?? v.price_sale);
      const rv = toNum(rvTier ?? v.price);

      if (sv > 0) minSale = (minSale == null ? sv : Math.min(minSale, sv));
      if (rv > 0) minReg  = (minReg  == null ? rv : Math.min(minReg,  rv));
    }

    if (minSale != null && minReg != null && minSale < minReg) {
      return { price_display: minSale, compare_at_display: minReg, price_tier: tier };
    }

    const price = (minSale != null ? minSale : (minReg != null ? minReg : 0));
    return { price_display: price, compare_at_display: null, price_tier: tier };
  } catch {
    return { price_display: 0, compare_at_display: null, price_tier: tier };
  }
}

// ===================================================================
// PUBLIC: Get Product by ID
// ===================================================================

async function getProductById(req, env, productId) {
  try {
    // Try to get from KV directly
    let product = await getJSON(env, 'product:' + productId, null);

    if (!product) {
      // Fallback: search in list
      const list = await listProducts(env);
      product = list.find(p => String(p.id || p.key || '') === String(productId));

      if (product) {
        // Try to get full version from KV
        const cached = await getJSON(env, 'product:' + product.id, null);
        if (cached) product = cached;
      }
    }

    if (!product) {
      return json({ 
        ok: false, 
        error: 'Product not found' 
      }, { status: 404 }, req);
    }

    // âœ… Äáº£m báº£o variants cÃ³ weight
    if (Array.isArray(product.variants)) {
      product.variants = product.variants.map(v => ({
        ...v,
        weight_gram: v.weight_gram || 0,
        weight_grams: v.weight_grams || 0,
        weight: v.weight || 0
      }));
    }

    cconst tier = getCustomerTier(req);
    const priced = { ...product, ...computeDisplayPrice(product, tier) };
    console.log('[PRICE] getProductById', { id: productId, tier, price: priced.price_display, compare_at: priced.compare_at_display });
    
    // ✅ FIX: Trả về cả item và data để tương thích frontend
    return json({ 
      ok: true, 
      item: priced,   // Dùng cho orders-manager.js
      data: priced    // Dùng cho các endpoint khác
    }, {}, req);
  } catch (e) {
    return errorResponse(e, 500, req);
  }
}

// ===================================================================
// PUBLIC: List Products
// ===================================================================

async function listPublicProducts(req, env) {
  try {
    // Lấy danh sách summary (id, title, ...)
    const list = await listProducts(env);
    const actives = list.filter(p => p.status !== 0);

    // 🔥 Nạp FULL từ KV theo từng id để có variants
    const full = [];
    for (const s of actives) {
      const id = String(s.id || s.key || '');
      const p  = id ? (await getJSON(env, 'product:' + id, null)) : null;
      full.push(p || s); // nếu thiếu full thì dùng summary
    }

    // Tính giá từ variants
    const tier  = getCustomerTier(req);
    const items = full.map(p => ({ ...p, ...computeDisplayPrice(p, tier) }));

    console.log('[PRICE] listPublicProducts', { tier, count: items.length, sample: { id: items[0]?.id, price: items[0]?.price_display } });
    return json({ ok: true, items }, {}, req);
  } catch (e) {
    return errorResponse(e, 500, req);
  }
}

async function listPublicProductsFiltered(req, env) {
  try {
    const url = new URL(req.url);
    const category = url.searchParams.get('category') ||
                     url.searchParams.get('cat') ||
                     url.searchParams.get('category_slug') ||
                     url.searchParams.get('c') || '';
    const limit = Number(url.searchParams.get('limit') || '24');

    // Lấy danh sách summary
    let data  = await listProducts(env);
    let items = Array.isArray(data?.items) ? data.items.slice()
               : Array.isArray(data) ? data.slice() : [];

    // Lọc theo category (nếu có)
    if (category) {
      const before = items.length;
      items = items.filter(product => matchCategoryStrict(product, category));
      console.log(`✅ Category "${category}": ${before} → ${items.length}`);
    }

    // Chỉ lấy sản phẩm active
    items = items.filter(p => p.status !== 0);

    // 🔥 Nạp FULL từ KV cho các item hiển thị (sau filter)
    const limited = items.slice(0, limit);
    const full = [];
    for (const s of limited) {
      const id = String(s.id || s.key || '');
      const p  = id ? (await getJSON(env, 'product:' + id, null)) : null;
      full.push(p || s);
    }

    // Tính giá từ variants
    const tier = getCustomerTier(req);
    const out  = full.map(p => ({ ...p, ...computeDisplayPrice(p, tier) }));

    console.log('[PRICE] listPublicProductsFiltered', { tier, in: items.length, out: out.length, cat: category, sample: { id: out[0]?.id, price: out[0]?.price_display } });
    return json({ ok: true, items: out }, {}, req);
  } catch (e) {
    console.error('❌ Error:', e);
    return errorResponse(e, 500, req);
  }
}

// ===================================================================
// ADMIN: List All Products
// ===================================================================

async function listAdminProducts(req, env) {
  // ⚠️ Tạm bỏ xác thực khi nạp dữ liệu
  // if (!(await adminOK(req, env))) {
  //   return errorResponse('Unauthorized', 401, req);
  // }

  try {
    const list = await listProducts(env);
    return json({ ok: true, items: list }, {}, req);
  } catch (e) {
    return errorResponse(e, 500, req);
  }
}


// ===================================================================
// ADMIN: Get Single Product
// ===================================================================

async function getAdminProduct(req, env) {
  const url = new URL(req.url);
  const id = url.searchParams.get('id');
  const slug = url.searchParams.get('slug');

  if (!id && !slug) {
    return errorResponse('Missing id or slug parameter', 400, req);
  }

  try {
    let product = null;

    // Try to get by ID first
    if (id) {
      product = await getJSON(env, 'product:' + id, null);
    }

    // Fallback: search by slug
    if (!product && slug) {
      const list = await listProducts(env);
      const item = list.find(p => p.slug === slug);
      if (item) {
        product = await getJSON(env, 'product:' + item.id, null);
      }
    }

    if (!product) {
      return json({ 
        ok: false, 
        error: 'Product not found' 
      }, { status: 404 }, req);
    }

    return json({ ok: true, data: product }, {}, req);
  } catch (e) {
    return errorResponse(e, 500, req);
  }
}

// ===================================================================
// ADMIN: Upsert Product
// ===================================================================

async function upsertProduct(req, env) {
  if (!(await adminOK(req, env))) {
    return errorResponse('Unauthorized', 401, req);
  }

  try {
    const incoming = await readBody(req) || {};

    // 1) Bảo đảm có id
    const id = (incoming.id && String(incoming.id).trim()) || crypto.randomUUID().replace(/-/g, '');
    incoming.id = id;

    // 2) Load bản cũ (nếu có) để MERGE an toàn
    const old = await getJSON(env, 'product:' + id, null) || null;

    // 3) Chuẩn hoá slug/category_slug
    if (!incoming.slug && (incoming.title || incoming.name)) {
      incoming.slug = slugify(incoming.title || incoming.name);
    }
    if (!incoming.category_slug && incoming.category) {
      incoming.category_slug = toSlug(incoming.category);
    }

    // 4) Merge variants theo id (không reset nếu không gửi mới)
    function mergeVariants(oldVars, newVars) {
      const ov = Array.isArray(oldVars) ? oldVars : [];
      const nv = Array.isArray(newVars) ? newVars : null; // nếu null → giữ nguyên ov

      if (!nv) return ov.slice();

      const byId = new Map();
      for (const v of ov) {
        const key = String(v?.id ?? v?.sku ?? '');
        if (key) byId.set(key, v);
      }

      const out = [];
      for (const v of nv) {
        const key = String(v?.id ?? v?.sku ?? '');
        if (key && byId.has(key)) {
          // merge giữ số liệu cũ phía variant nếu FE không gửi
          const prev = byId.get(key);
          out.push({ ...prev, ...v });
        } else {
          out.push({ ...v });
        }
      }
      return out;
    }

    // 5) Danh sách TRƯỜNG THỐNG KÊ/ĐỌC-CHỈ cần bảo toàn nếu incoming không gửi
    const readOnlyStats = [
      'createdAt', 'created_by',
      'sold', 'sold_count', 'sales',
      'rating', 'rating_avg', 'rating_count',
      'reviews', 'reviews_count'
    ];

    // Helper: xác định "rỗng"
    const isEmptyLike = (val) => (
      val === undefined || val === null ||
      (Array.isArray(val) && val.length === 0) ||
      (typeof val === 'object' && !Array.isArray(val) && Object.keys(val).length === 0)
    );

    // 6) Tao merged - UU TIEN DU LIEU CU
    const base = old ? { ...old } : {};
    const merged = { ...base, ...incoming };

    // 6.1) BAO TOAN TRUONG THONG KE/DOC-CHI (CHAT CHE)
    // Ket cung: Neu dang SUA (co old) thi GIU NGUYEN cac truong nay
    if (old) {
      for (const k of readOnlyStats) {
        if (old[k] !== undefined && old[k] !== null) {
          merged[k] = old[k]; // GHI DE gia tri cu, khong de incoming ghi de
        }
      }
    }

    // 6.2) createdAt: CHI GIU GIA TRI CU (neu co old)
    if (old && old.createdAt) {
      merged.createdAt = old.createdAt; // Bao toan createdAt cu
    } else {
      // Neu la san pham moi (khong co old)
      merged.createdAt = merged.createdAt || Date.now();
    }

    // 6.3) updatedAt: Luon cap nhat khi save
    merged.updatedAt = Date.now();

    // 6.4) THEM: Xac dinh "san pham moi" (trong 30 ngay)
    if (merged.createdAt) {
      const ageMs = Date.now() - merged.createdAt;
      const ageDays = ageMs / (1000 * 60 * 60 * 24);
      merged.isNewProduct = ageDays <= 1; // Tu dong danh dau "moi" neu < 1 ngay
    }

    // 6.4) variants: merge theo id/sku
    merged.variants = mergeVariants(old?.variants, incoming?.variants);

    // 6.5) Dam bao can nang o variants (UU TIEN GIU GIA TRI CU)
    if (Array.isArray(merged.variants)) {
      const oldVariantsMap = new Map();
      if (old && Array.isArray(old.variants)) {
        old.variants.forEach(v => {
          const key = String(v?.id ?? v?.sku ?? '');
          if (key) oldVariantsMap.set(key, v);
        });
      }

      merged.variants = merged.variants.map(v => {
        const key = String(v?.id ?? v?.sku ?? '');
        const oldV = key ? oldVariantsMap.get(key) : null;

        // Neu incoming khong co weight va old co weight -> giu weight cu
        const w_gram = (v.weight_gram !== undefined && v.weight_gram !== null && v.weight_gram !== 0)
          ? v.weight_gram
          : (oldV?.weight_gram || oldV?.weight_grams || oldV?.weight || 0);

        return {
          ...v,
          weight_gram: w_gram,
          weight_grams: w_gram,
          weight: w_gram
        };
      });
    }

    console.log('💾 Saving product (MERGE):', {
      id: merged.id,
      name: merged.title || merged.name,
      category: merged.category,
      category_slug: merged.category_slug
    });

    // 7) Cập nhật danh sách summary
    const list = await listProducts(env);
    const summary = toSummary(merged);
    const index = list.findIndex(p => p.id === id);
    if (index >= 0) {
      list[index] = summary;
    } else {
      list.unshift(summary);
    }

    // 8) Lưu KV (list + detail + legacy)
    await putJSON(env, 'products:list', list);
    await putJSON(env, 'product:' + id, merged);
    await putJSON(env, 'products:' + id, summary); // legacy

    console.log('✅ Product saved (merged)');

    return json({ ok: true, data: merged }, {}, req);
  } catch (e) {
    console.error('❌ Save error (merged upsert):', e);
    return errorResponse(e, 500, req);
  }
}

// ===================================================================
// ADMIN: Delete Product
// ===================================================================

async function deleteProduct(req, env) {
  if (!(await adminOK(req, env))) {
    return errorResponse('Unauthorized', 401, req);
  }

  try {
    const body = await readBody(req) || {};
    const id = body.id;

    if (!id) {
      return errorResponse('Product ID is required', 400, req);
    }

    // Get current list
    const list = await listProducts(env);
    
    // Filter out deleted product
    const newList = list.filter(p => p.id !== id);

    // Save updated list
    await putJSON(env, 'products:list', newList);
    
    // Delete from KV
    await env.SHV.delete('product:' + id);
    await env.SHV.delete('products:' + id);

    return json({ ok: true, deleted: id }, {}, req);
  } catch (e) {
    return errorResponse(e, 500, req);
  }
} // <<< THÊM DẤU } NÀY ĐỂ ĐÓNG HÀM deleteProduct

console.log('✅ products.js loaded - CATEGORY FILTER FIXED');
// <<< Cuối file >>>