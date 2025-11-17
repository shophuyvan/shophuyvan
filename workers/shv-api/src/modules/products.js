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
  // ✅ NEW: Get product channels mapping
  if (path.match(/^\/api\/products\/[^\/]+\/channels$/) && method === 'GET') {
    const id = decodeURIComponent(path.split('/')[3]);
    return getProductChannels(req, env, id);
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

  // ===== METRICS ROUTES (PUBLIC) =====
  
  // Get metrics for multiple products (batch)
  if (path === '/api/products/metrics' && method === 'POST') {
    return getProductsMetricsBatch(req, env);
  }
  
  // Get metrics for single product
  if (path.match(/^\/api\/products\/[^\/]+\/metrics$/) && method === 'GET') {
    const id = decodeURIComponent(path.split('/')[3]);
    return getProductMetrics(req, env, id);
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
 * Build products list from D1
 */
async function listProducts(env) {
  console.log('[listProducts] 🚀 Đọc từ D1...');
  
  try {
    // Query tất cả products (chỉ lấy summary fields)
    const products = await env.DB.prepare(`
      SELECT 
        id, title, slug, shortDesc, category_slug,
        images, status, on_website, on_mini,
        created_at, updated_at
      FROM products
      ORDER BY created_at DESC
    `).all();

    if (!products.results || products.results.length === 0) {
      console.log('[listProducts] ⚠️ Không có sản phẩm nào');
      return [];
    }

    console.log(`[listProducts] ✅ Tìm thấy ${products.results.length} sản phẩm`);

    // Convert sang format summary (tương thích với code cũ)
    const items = products.results.map(p => {
      // Parse JSON fields
      const images = p.images ? JSON.parse(p.images) : [];
      
      return {
        id: p.id,
        title: p.title,
        name: p.title,
        slug: p.slug,
        images: images,
        category_slug: p.category_slug,
        status: p.status === 'active' ? 1 : 0,
        
        // Placeholder fields (sẽ được override khi load full product)
        price_display: 0,
        compare_at_display: null,
        price: 0,
        stock: 0,
        sold: 0,
        rating: 5.0,
        rating_count: 0,
        
        created_at: p.created_at,
        updated_at: p.updated_at
      };
    });

    return items;

  } catch (e) {
    console.error('[listProducts] 💥 Lỗi D1:', e);
    throw e;
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
    console.log('[getProductById] 🔍 Tìm product:', productId);
    
    // Query product từ D1
    const productResult = await env.DB.prepare(`
      SELECT * FROM products WHERE id = ? OR slug = ?
    `).bind(productId, productId).first();

    if (!productResult) {
      return json({ 
        ok: false, 
        error: 'Product not found' 
      }, { status: 404 }, req);
    }

    // Parse JSON fields
    const product = {
      ...productResult,
      images: productResult.images ? JSON.parse(productResult.images) : [],
      keywords: productResult.keywords ? JSON.parse(productResult.keywords) : [],
      faq: productResult.faq ? JSON.parse(productResult.faq) : [],
      reviews: productResult.reviews ? JSON.parse(productResult.reviews) : []
    };

    // Query variants của product này
    const variantsResult = await env.DB.prepare(`
      SELECT * FROM variants WHERE product_id = ? ORDER BY id ASC
    `).bind(product.id).all();

    product.variants = (variantsResult.results || []).map(v => ({
      id: v.id,
      sku: v.sku,
      name: v.name,
      price: v.price,
      price_sale: v.price_sale,
      price_wholesale: v.price_wholesale,
      cost_price: v.cost_price,
      price_silver: v.price_silver,
      price_gold: v.price_gold,
      price_diamond: v.price_diamond,
      stock: v.stock,
      weight: v.weight,
      weight_gram: v.weight,
      weight_grams: v.weight,
      status: v.status,
      image: v.image,
      created_at: v.created_at,
      updated_at: v.updated_at
    }));

    console.log(`[getProductById] ✅ Tìm thấy product với ${product.variants.length} variants`);

    // ⚡ CHECK FLASH SALE
    const flashSaleInfo = await getFlashSaleForProduct(env, product.id);
    
    // ✅ Apply Flash Sale cho variants
    if (Array.isArray(product.variants)) {
      product.variants = product.variants.map(v => {
        let variant = { ...v };
        
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
    console.error('[getProductById] ❌ Lỗi:', e);
    return errorResponse(e, 500, req);
  }
}

// ===================================================================
// PUBLIC: List Products
// ===================================================================

async function listPublicProducts(req, env) {
  try {
    // Lấy danh sách summary
    const list = await listProducts(env);
    const actives = list.filter(p => p.status !== 0);

    // 🔥 Nạp FULL từ D1 theo từng id để có variants
    const full = [];
    for (const s of actives) {
      const id = Number(s.id);
      if (!id) {
        full.push(s);
        continue;
      }

      // Query product + variants từ D1
      const productResult = await env.DB.prepare(`
        SELECT * FROM products WHERE id = ?
      `).bind(id).first();

      if (!productResult) {
        full.push(s);
        continue;
      }

      const variantsResult = await env.DB.prepare(`
        SELECT * FROM variants WHERE product_id = ? ORDER BY id ASC
      `).bind(id).all();

      const product = {
        ...productResult,
        images: productResult.images ? JSON.parse(productResult.images) : [],
        variants: (variantsResult.results || []).map(v => ({
          id: v.id,
          sku: v.sku,
          name: v.name,
          price: v.price,
          price_sale: v.price_sale,
          stock: v.stock,
          weight: v.weight
        }))
      };

      full.push(product);
    }

    // Tính giá từ variants
    const tier = getCustomerTier(req);
    const items = full.map(p => ({ ...p, ...computeDisplayPrice(p, tier) }));

    console.log('[PRICE] listPublicProducts', { tier, count: items.length, sample: { id: items[0]?.id, price: items[0]?.price_display } });
    return json({ ok: true, items }, {}, req);
  } catch (e) {
    console.error('[listPublicProducts] Error:', e);
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

    // 🔥 Nạp FULL từ D1 cho các item hiển thị (sau filter)
    const limited = items.slice(0, limit);
    const full = [];
    for (const s of limited) {
      const id = Number(s.id);
      if (!id) {
        full.push(s);
        continue;
      }

      // Query product + variants từ D1
      const productResult = await env.DB.prepare(`
        SELECT * FROM products WHERE id = ?
      `).bind(id).first();

      if (!productResult) {
        full.push(s);
        continue;
      }

      const variantsResult = await env.DB.prepare(`
        SELECT * FROM variants WHERE product_id = ? ORDER BY id ASC
      `).bind(id).all();

      const product = {
        ...productResult,
        images: productResult.images ? JSON.parse(productResult.images) : [],
        variants: (variantsResult.results || []).map(v => ({
          id: v.id,
          sku: v.sku,
          name: v.name,
          price: v.price,
          price_sale: v.price_sale,
          stock: v.stock,
          weight: v.weight
        }))
      };

      full.push(product);
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
    console.log('[getAdminProduct] 🔍 Query:', { id, slug });

    // Query product từ D1 (by ID hoặc slug)
    let productResult;
    if (id) {
      productResult = await env.DB.prepare(`
        SELECT * FROM products WHERE id = ?
      `).bind(id).first();
    } else if (slug) {
      productResult = await env.DB.prepare(`
        SELECT * FROM products WHERE slug = ?
      `).bind(slug).first();
    }

    if (!productResult) {
      return json({ 
        ok: false, 
        error: 'Product not found' 
      }, { status: 404 }, req);
    }

    // Parse JSON fields
    const product = {
      ...productResult,
      images: productResult.images ? JSON.parse(productResult.images) : [],
      keywords: productResult.keywords ? JSON.parse(productResult.keywords) : [],
      faq: productResult.faq ? JSON.parse(productResult.faq) : [],
      reviews: productResult.reviews ? JSON.parse(productResult.reviews) : []
    };

    // Query variants
    const variantsResult = await env.DB.prepare(`
      SELECT * FROM variants WHERE product_id = ? ORDER BY id ASC
    `).bind(product.id).all();

    product.variants = variantsResult.results || [];

    console.log('[getAdminProduct] ✅ Found product with', product.variants.length, 'variants');

    return json({ ok: true, data: product }, {}, req);
  } catch (e) {
    console.error('[getAdminProduct] ❌ Error:', e);
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
    console.log('💾 Upsert product D1:', incoming.id || 'new');

    const now = Date.now();
    let productId = incoming.id ? Number(incoming.id) : null;
    
    // 1) Load bản cũ từ D1 (nếu đang sửa)
    let old = null;
    if (productId) {
      old = await env.DB.prepare(`SELECT * FROM products WHERE id = ?`).bind(productId).first();
    }

    // 2) Chuẩn hóa slug/category_slug
    if (!incoming.slug && (incoming.title || incoming.name)) {
      incoming.slug = slugify(incoming.title || incoming.name);
    }
    if (!incoming.category_slug && incoming.category) {
      incoming.category_slug = toSlug(incoming.category);
    }

    // 3) Prepare product data
    const productData = {
      title: incoming.title || incoming.name || 'Untitled',
      slug: incoming.slug || slugify(incoming.title || incoming.name || 'untitled'),
      shortDesc: incoming.shortDesc || incoming.short_description || '',
      desc: incoming.desc || incoming.description || '',
      category_slug: incoming.category_slug || null,
      seo_title: incoming.seo_title || null,
      seo_desc: incoming.seo_desc || null,
      keywords: incoming.keywords ? JSON.stringify(incoming.keywords) : '[]',
      faq: incoming.faq ? JSON.stringify(incoming.faq) : '[]',
      reviews: incoming.reviews ? JSON.stringify(incoming.reviews) : '[]',
      images: incoming.images ? JSON.stringify(incoming.images) : '[]',
      video: incoming.video || null,
      status: incoming.status || 'active',
      on_website: incoming.on_website !== undefined ? incoming.on_website : 1,
      on_mini: incoming.on_mini !== undefined ? incoming.on_mini : 1,
      created_at: old ? old.created_at : now,
      updated_at: now
    };

    // 4) Insert hoặc Update product
    if (old) {
      // UPDATE existing product
      await env.DB.prepare(`
        UPDATE products SET
          title = ?, slug = ?, shortDesc = ?, desc = ?,
          category_slug = ?, seo_title = ?, seo_desc = ?,
          keywords = ?, faq = ?, reviews = ?,
          images = ?, video = ?, status = ?,
          on_website = ?, on_mini = ?, updated_at = ?
        WHERE id = ?
      `).bind(
        productData.title, productData.slug, productData.shortDesc, productData.desc,
        productData.category_slug, productData.seo_title, productData.seo_desc,
        productData.keywords, productData.faq, productData.reviews,
        productData.images, productData.video, productData.status,
        productData.on_website, productData.on_mini, productData.updated_at,
        productId
      ).run();
      
      console.log('✅ Updated product:', productId);
    } else {
      // INSERT new product
      const result = await env.DB.prepare(`
        INSERT INTO products (
          title, slug, shortDesc, desc, category_slug,
          seo_title, seo_desc, keywords, faq, reviews,
          images, video, status, on_website, on_mini,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        RETURNING id
      `).bind(
        productData.title, productData.slug, productData.shortDesc, productData.desc,
        productData.category_slug, productData.seo_title, productData.seo_desc,
        productData.keywords, productData.faq, productData.reviews,
        productData.images, productData.video, productData.status,
        productData.on_website, productData.on_mini,
        productData.created_at, productData.updated_at
      ).first();
      
      productId = result.id;
      console.log('✅ Inserted new product:', productId);
    }

    // 5) Xử lý variants
    // 5) Xử lý variants
    const incomingVariants = Array.isArray(incoming.variants) ? incoming.variants : [];
    
    if (incomingVariants.length > 0) {
      // Load variants hiện tại từ D1
      const existingVariants = await env.DB.prepare(`
        SELECT * FROM variants WHERE product_id = ?
      `).bind(productId).all();
      
      // ✅ FIX: Map theo SKU thay vì ID để tránh duplicate
      const existingMapBySKU = new Map();
      const existingMapByID = new Map();
      (existingVariants.results || []).forEach(v => {
        if (v.sku) existingMapBySKU.set(v.sku, v);
        existingMapByID.set(v.id, v);
      });

      // Process từng variant
      for (const v of incomingVariants) {
        const incomingSKU = v.sku || `SKU-${productId}-${Date.now()}`;
        
        // ✅ Check theo SKU trước, rồi mới đến ID
        let oldVariant = existingMapBySKU.get(incomingSKU);
        if (!oldVariant && v.id) {
          oldVariant = existingMapByID.get(Number(v.id));
        }

    // 6) Load lại full product để trả về
    const saved = await env.DB.prepare(`SELECT * FROM products WHERE id = ?`).bind(productId).first();
    const savedVariants = await env.DB.prepare(`SELECT * FROM variants WHERE product_id = ?`).bind(productId).all();
    
    const result = {
      ...saved,
      id: productId,
      images: saved.images ? JSON.parse(saved.images) : [],
      keywords: saved.keywords ? JSON.parse(saved.keywords) : [],
      faq: saved.faq ? JSON.parse(saved.faq) : [],
      reviews: saved.reviews ? JSON.parse(saved.reviews) : [],
      variants: savedVariants.results || []
    };

    console.log('✅ Product saved to D1:', productId);

    return json({ ok: true, data: result }, {}, req);
  } catch (e) {
    console.error('❌ Save error (D1 upsert):', e);
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

    console.log('🗑️ Deleting product from D1:', id);

    // Check if product exists
    const product = await env.DB.prepare(`
      SELECT id FROM products WHERE id = ?
    `).bind(id).first();

    if (!product) {
      return errorResponse('Product not found', 404, req);
    }

    // DELETE product (CASCADE sẽ tự động xóa variants, order_items, channel_products)
    await env.DB.prepare(`
      DELETE FROM products WHERE id = ?
    `).bind(id).run();

    console.log('✅ Product deleted:', id);

    return json({ ok: true, deleted: id }, {}, req);
  } catch (e) {
    console.error('❌ Delete error:', e);
    return errorResponse(e, 500, req);
  }
}
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

// ===================================================================
// PUBLIC: Get Product Metrics (sold, rating)
// ===================================================================

/**
 * Lấy metrics của 1 sản phẩm (sold, rating, rating_count)
 * GET /api/products/{id}/metrics
 */
async function getProductMetrics(req, env, productId) {
  try {
    const product = await getJSON(env, 'product:' + productId, null);
    
    if (!product) {
      return json({
        ok: false,
        error: 'Product not found'
      }, { status: 404 }, req);
    }

    // Đọc metrics từ product
    const metrics = {
      product_id: productId,
      sold: Number(product.sold || product.sold_count || product.sales || 0),
      rating: Number(product.rating || product.rating_avg || product.rating_average || 5.0),
      rating_count: Number(product.rating_count || product.reviews_count || product.review_count || 0)
    };

    return json({
      ok: true,
      metrics
    }, {}, req);

  } catch (e) {
    console.error('[METRICS] Error:', e);
    return errorResponse(e, 500, req);
  }
}

/**
 * Lấy metrics của nhiều sản phẩm (batch)
 * POST /api/products/metrics
 * Body: { product_ids: ['id1', 'id2', ...] }
 */
async function getProductsMetricsBatch(req, env) {
  try {
    const body = await readBody(req) || {};
    const productIds = body.product_ids || body.ids || [];

    if (!Array.isArray(productIds) || productIds.length === 0) {
      return json({
        ok: false,
        error: 'product_ids array is required'
      }, { status: 400 }, req);
    }

    // Giới hạn tối đa 50 sản phẩm mỗi request
    const ids = productIds.slice(0, 50);
    const results = [];

    for (const id of ids) {
      try {
        const product = await getJSON(env, 'product:' + id, null);
        
        if (product) {
          results.push({
            product_id: id,
            sold: Number(product.sold || product.sold_count || product.sales || 0),
            rating: Number(product.rating || product.rating_avg || product.rating_average || 5.0),
            rating_count: Number(product.rating_count || product.reviews_count || product.review_count || 0)
          });
        }
      } catch (e) {
        console.warn('[METRICS] Error loading product:', id, e);
        // Skip sản phẩm lỗi, không fail toàn bộ request
      }
    }

    return json({
      ok: true,
      metrics: results
    }, {}, req);

  } catch (e) {
    console.error('[METRICS BATCH] Error:', e);
    return errorResponse(e, 500, req);
  }
}

// ===================================================================
// PUBLIC/ADMIN: Get Product Channels Mapping
// ===================================================================

/**
 * Lấy danh sách channel mappings của 1 product
 * GET /api/products/:id/channels
 */
async function getProductChannels(req, env, productId) {
  try {
    console.log('[getProductChannels] 🔍 Product:', productId);

    // Query channel mappings
    const result = await env.DB.prepare(`
      SELECT 
        cp.*,
        v.sku as variant_sku,
        v.name as variant_name
      FROM channel_products cp
      LEFT JOIN variants v ON cp.variant_id = v.id
      WHERE cp.product_id = ?
      ORDER BY cp.channel, cp.created_at DESC
    `).bind(productId).all();

    const channels = (result.results || []).map(row => ({
      id: row.id,
      channel: row.channel,
      channel_item_id: row.channel_item_id,
      channel_model_id: row.channel_model_id,
      channel_sku: row.channel_sku,
      variant_id: row.variant_id,
      variant_sku: row.variant_sku,
      variant_name: row.variant_name,
      channel_price: row.channel_price,
      channel_price_sale: row.channel_price_sale,
      is_active: row.is_active,
      last_sync_at: row.last_sync_at,
      created_at: row.created_at,
      updated_at: row.updated_at
    }));

    console.log(`[getProductChannels] ✅ Found ${channels.length} mappings`);

    return json({
      ok: true,
      product_id: productId,
      channels
    }, {}, req);

  } catch (e) {
    console.error('[getProductChannels] ❌ Error:', e);
    return errorResponse(e, 500, req);
  }
}

console.log('✅ products.js loaded - CATEGORY FILTER FIXED + FLASH SALE INTEGRATED + METRICS API');
// <<< Cuối file >>>
