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

  // ✅ THÊM: Public API - Sản phẩm bán chạy (bestsellers)
  if (path === '/products/bestsellers' && method === 'GET') {
    return getBestsellers(req, env);
  }

  // ✅ THÊM: Public API - Sản phẩm mới (newest)
  if (path === '/products/newest' && method === 'GET') {
    return getNewest(req, env);
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
// Chọn 1 biến thể có GIÁ THẤP NHẤT, giữ nguyên cặp (sale, price) của chính biến thể đó
function computeDisplayPrice(product, tier) {
  try {
    const toNum = (x) =>
      typeof x === 'string'
        ? (Number(x.replace(/[^\d.-]/g, '')) || 0)
        : Number(x || 0);

    const vars = Array.isArray(product?.variants) ? product.variants : [];

    if (!vars.length) {
      return {
        price_display: 0,
        compare_at_display: null,
        price_tier: tier,
        no_variant: true,
      };
    }

    let bestBase = null;
    let bestOrig = null;

    for (const v of vars) {
      // Giá theo tier (wholesale) nếu có
      const svTier =
        tier === 'wholesale'
          ? v.sale_price_wholesale ?? v.wholesale_sale_price ?? null
          : null;
      const rvTier =
        tier === 'wholesale'
          ? v.price_wholesale ?? v.wholesale_price ?? null
          : null;

      const sale = toNum(svTier ?? v.sale_price ?? v.price_sale);
      const reg = toNum(rvTier ?? v.price);

      let base = 0;
      let orig = 0;

      if (sale > 0 && reg > 0 && sale < reg) {
        // Có giảm giá: base = sale, original = price
        base = sale;
        orig = reg;
      } else {
        // Không giảm: base = price, không có compare_at
        base = reg;
        orig = 0;
      }

      if (base > 0) {
        if (bestBase == null || base < bestBase) {
          bestBase = base;
          bestOrig = orig;
        }
      }
    }

    if (bestBase == null) {
      return { price_display: 0, compare_at_display: null, price_tier: tier };
    }

    return {
      price_display: bestBase,
      compare_at_display: bestOrig > 0 ? bestOrig : null,
      price_tier: tier,
    };
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

    // ⚡ CHECK FLASH SALE
    const flashSaleInfo = await getFlashSaleForProduct(env, product.id);
    
    // ✅ Đảm bảo variants có weight + apply Flash Sale
    if (Array.isArray(product.variants)) {
      product.variants = product.variants.map(v => {
        let variant = {
          ...v,
          weight_gram: v.weight_gram || 0,
          weight_grams: v.weight_grams || 0,
          weight: v.weight || 0
        };
        
        // ⚡ Apply Flash Sale discount
        if (flashSaleInfo) {
          variant = applyFlashSaleDiscount(variant, flashSaleInfo);
        }
        
        return variant;
      });
    } else if (flashSaleInfo) {
      // Product không có variants nhưng có Flash Sale
      const basePrice = Number(product.price || product.price_sale || 0);
      if (basePrice > 0) {
        let flashPrice = basePrice;
        
        if (flashSaleInfo.discount_type === 'percent') {
          flashPrice = Math.floor(basePrice * (1 - flashSaleInfo.discount_value / 100));
        } else if (flashSaleInfo.discount_type === 'fixed') {
          flashPrice = Math.max(0, basePrice - flashSaleInfo.discount_value);
        }
        
        product.flash_sale = {
          active: true,
          price: flashPrice,
          original_price: basePrice,
          discount_percent: Math.round((basePrice - flashPrice) / basePrice * 100),
          ends_at: flashSaleInfo.ends_at,
          flash_sale_id: flashSaleInfo.flash_sale_id,
          flash_sale_name: flashSaleInfo.flash_sale_name
        };
      }
    }

    const tier = getCustomerTier(req);
    const priced = { ...product, ...computeDisplayPrice(product, tier) };
    console.log('[PRICE] getProductById', { 
      id: productId, 
      tier, 
      price: priced.price_display, 
      compare_at: priced.compare_at_display,
      flash_sale: flashSaleInfo ? 'active' : 'none'
    });
    
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

        // FIX: Nhan ca weight va weight_gram tu frontend
        // Uu tien: weight_gram > weight > gia tri cu
        let w_gram = 0;
        
        // Buoc 1: Lay gia tri moi tu incoming (uu tien weight_gram, roi moi den weight)
        if (v.weight_gram !== undefined && v.weight_gram !== null && v.weight_gram !== 0) {
          w_gram = v.weight_gram;
        } else if (v.weight !== undefined && v.weight !== null && v.weight !== 0) {
          w_gram = v.weight;
        } else if (oldV) {
          // Buoc 2: Neu khong co gia tri moi thi giu gia tri cu
          w_gram = oldV.weight_gram || oldV.weight_grams || oldV.weight || 0;
        }

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
// ===================================================================
// PUBLIC: Get Bestsellers (sắp xếp theo số lượng bán)
// ===================================================================
async function getBestsellers(req, env) {
  try {
    const url = new URL(req.url);
    const limit = Number(url.searchParams.get('limit') || '12');

    // Lấy danh sách summary
    let data = await listProducts(env);
    let items = Array.isArray(data?.items) ? data.items.slice()
               : Array.isArray(data) ? data.slice() : [];

    // Chỉ lấy sản phẩm active
    items = items.filter(p => p.status !== 0);

    // 🔥 Nạp FULL từ KV để có sold
    const full = [];
    for (const s of items) {
      const id = String(s.id || s.key || '');
      const p  = id ? (await getJSON(env, 'product:' + id, null)) : null;
      full.push(p || s);
    }

    // Sắp xếp theo sold (cao nhất trước)
    full.sort((a, b) => {
      const soldA = Number(a.sold || a.sales || a.sold_count || 0);
      const soldB = Number(b.sold || b.sales || b.sold_count || 0);
      return soldB - soldA;
    });

        // Lấy top N
    const limited = full.slice(0, limit);

    // Dùng chung logic toSummary (giống /public/products) để đồng bộ giá
    const out = limited.map((p) => toSummary(p));

    console.log('[BESTSELLERS] Returned:', out.length, 'products');
    return json({ ok: true, items: out }, {}, req);


  } catch (e) {
    console.error('❌ Error:', e);
    return errorResponse(e, 500, req);
  }
}

// ===================================================================
// PUBLIC: Get Newest (sản phẩm mới trong 14 ngày)
// ===================================================================
async function getNewest(req, env) {
  try {
    const url = new URL(req.url);
    const limit = Number(url.searchParams.get('limit') || '12');

    // Lấy danh sách summary
    let data = await listProducts(env);
    let items = Array.isArray(data?.items) ? data.items.slice()
               : Array.isArray(data) ? data.slice() : [];

    // Chỉ lấy sản phẩm active
    items = items.filter(p => p.status !== 0);

    // 🔥 Nạp FULL từ KV để có createdAt
    const full = [];
    for (const s of items) {
      const id = String(s.id || s.key || '');
      const p  = id ? (await getJSON(env, 'product:' + id, null)) : null;
      full.push(p || s);
    }

    const now = Date.now();
    const DAYS = 14; // Lấy sản phẩm trong 14 ngày gần đây

    // Lọc sản phẩm mới (dựa vào createdAt)
    const newest = full.filter(p => {
      const created = new Date(p.createdAt || p.created_at || 0).getTime();
      if (!created) return false;
      const ageMs = now - created;
      const ageDays = ageMs / (1000 * 60 * 60 * 24);
      return ageDays <= DAYS;
    });

        // Sắp xếp theo createdAt (mới nhất trước)
    newest.sort((a, b) => {
      const dateA = new Date(a.createdAt || a.created_at || 0).getTime();
      const dateB = new Date(b.createdAt || b.created_at || 0).getTime();
      return dateB - dateA;
    });

        // Lấy top N
    const limited = newest.slice(0, limit);

    // Dùng chung logic toSummary (giống /public/products) để đồng bộ giá
    const out = limited.map((p) => toSummary(p));

    console.log('[NEWEST] Returned:', out.length, 'products (in last', DAYS, 'days)');
    return json({ ok: true, items: out }, {}, req);


  } catch (e) {
    console.error('❌ Error:', e);
    return errorResponse(e, 500, req);
  }
}

/**
 * 🔹 EXPORT FEED SẢN PHẨM CHO FACEBOOK (CSV)
 * - 1 dòng / 1 variant
 * - Giá, cân nặng, SKU đều lấy từ variants
 * - Dùng chung data cho FE + Mini
 */
export async function exportFacebookFeedCsv(req, env) {
  try {
    const BASE_URL = 'https://shophuyvan.vn';

    // Lấy danh sách summary
    let data = await listProducts(env);
    let items = Array.isArray(data?.items) ? data.items.slice()
               : Array.isArray(data) ? data.slice() : [];

    // Chỉ lấy sản phẩm đang active
    items = items.filter(p => p.status !== 0);

    // Nạp FULL product (để có variants)
    const fullProducts = [];
    for (const s of items) {
      const id = String(s.id || s.key || '');
      const p  = id ? (await getJSON(env, 'product:' + id, null)) : null;
      fullProducts.push(p || s);
    }

    // Helper escape CSV
    const esc = (val) => {
      if (val === null || val === undefined) return '';
      const s = String(val);
      return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    };

    // Header CSV theo chuẩn đơn giản của Facebook
    const rows = [];
    rows.push([
      'id',
      'item_group_id',
      'title',
      'description',
      'availability',
      'condition',
      'price',
      'link',
      'image_link',
      'brand',
      'sku',
    ]);

    const toNum = (x) =>
      typeof x === 'string'
        ? Number(x.replace(/[^\d.-]/g, '')) || 0
        : Number(x || 0);

    for (const product of fullProducts) {
      const title = product.title || product.name || '';
      const desc =
        product.description ||
        product.short_description ||
        product.summary ||
        '';
      const slug = product.slug || slugify(title || String(product.id || ''));
      const productUrl = `${BASE_URL}/product/${slug}`;
      const defaultImage = Array.isArray(product.images) && product.images.length
        ? product.images[0]
        : '';

      const variants = Array.isArray(product.variants) ? product.variants : [];

      if (variants.length === 0) {
        // Không có variant: fallback 1 dòng / sản phẩm
        const basePrice = toNum(product.price || product.price_sale || 0);
        if (!basePrice) continue;

        const priceStr = `${basePrice.toFixed(0)} VND`;
        rows.push([
          product.id,
          product.id,
          title,
          desc,
          'in stock',
          'new',
          priceStr,
          productUrl,
          defaultImage,
          product.brand || 'Shop Huy Vân',
          product.sku || '',
        ]);
        continue;
      }

      // Có variants: 1 dòng / 1 variant
      variants.forEach((v, idx) => {
        const vid = String(v.id || v.sku || idx + 1);
        if (!vid) return;

        const sale = toNum(v.sale_price ?? v.price_sale);
        const reg = toNum(v.price);
        const priceNum = sale > 0 && sale < reg ? sale : reg;

        if (!priceNum) return;

        const priceStr = `${priceNum.toFixed(0)} VND`;
        const avail =
          toNum(v.stock ?? v.qty ?? product.stock) > 0
            ? 'in stock'
            : 'out of stock';

        const img =
          v.image ||
          (Array.isArray(v.images) && v.images.length ? v.images[0] : null) ||
          defaultImage;

        rows.push([
          `${product.id}_${vid}`, // id duy nhất cho variant
          product.id,             // item_group_id = id product
          title,
          desc,
          avail,
          'new',
          priceStr,
          productUrl,
          img || '',
          product.brand || 'Shop Huy Vân',
          v.sku || '',
        ]);
      });
    }

    const csv = rows.map((r) => r.map(esc).join(',')).join('\n');

    return new Response(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Cache-Control': 'public, max-age=600',
      },
    });
  } catch (e) {
    console.error('[FacebookFeed] error:', e);
    return errorResponse(e, 500, req);
  }
}

/**
 * ⚡ Helper: Check Flash Sale cho product
 */
async function getFlashSaleForProduct(env, productId) {
  try {
    const list = await getJSON(env, 'flash-sales:list', []);
    const now = Date.now();

    for (const id of list) {
      const fs = await getJSON(env, `flash-sale:${id}`, null);
      if (!fs) continue;

      const start = new Date(fs.start_time).getTime();
      const end = new Date(fs.end_time).getTime();

      // Kiểm tra: đang active + trong thời gian
      if (fs.status === 'active' && start <= now && now <= end) {
        // Tìm product trong Flash Sale
        const item = (fs.products || []).find(p => String(p.product_id) === String(productId));
        if (item) {
          return {
            active: true,
            discount_type: item.discount_type,
            discount_value: item.discount_value,
            stock_limit: item.stock_limit || 0,
            ends_at: fs.end_time,
            flash_sale_id: fs.id,
            flash_sale_name: fs.name
          };
        }
      }
    }

    return null;
  } catch (e) {
    console.error('[Flash Sale] Check error:', e);
    return null;
  }
}

/**
 * ⚡ Helper: Apply Flash Sale discount cho variant
 */
function applyFlashSaleDiscount(variant, flashSaleInfo) {
  if (!flashSaleInfo || !flashSaleInfo.active) return variant;

  // ✅ FIX: Ưu tiên sale_price (giá đã giảm) làm base, không phải price gốc
// ⚡ Base FlashSale đúng: lấy price_sale trước, rồi mới tới price
const salePrice = Number(variant.price_sale || variant.sale_price || 0);
const regularPrice = Number(variant.price || 0);
const basePrice = salePrice > 0 ? salePrice : regularPrice;

  
  if (basePrice <= 0) return variant;

  let flashPrice = basePrice;

  if (flashSaleInfo.discount_type === 'percent') {
    const discount = basePrice * (flashSaleInfo.discount_value / 100);
    flashPrice = Math.floor(basePrice - discount);
  } else if (flashSaleInfo.discount_type === 'fixed') {
    flashPrice = Math.max(0, basePrice - flashSaleInfo.discount_value);
  }

  return {
    ...variant,
    flash_sale: {
      active: true,
      price: flashPrice,
      original_price: basePrice, // Giá gạch = giá trước Flash Sale (sale_price)
      discount_percent: flashSaleInfo.discount_type === 'percent' ? flashSaleInfo.discount_value : Math.round((basePrice - flashPrice) / basePrice * 100),
      ends_at: flashSaleInfo.ends_at,
      flash_sale_id: flashSaleInfo.flash_sale_id,
      flash_sale_name: flashSaleInfo.flash_sale_name
    }
  };
}

console.log('✅ products.js loaded - CATEGORY FILTER FIXED + FLASH SALE INTEGRATED');
// <<< Cuối file >>>
