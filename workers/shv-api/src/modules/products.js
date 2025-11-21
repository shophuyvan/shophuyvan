// ===================================================================
// modules/products.js - Products Module (FIXED CATEGORY)
// Đường dẫn: workers/shv-api/src/modules/products.js
// ===================================================================

import { json, errorResponse } from '../lib/response.js';
import { adminOK } from '../lib/auth.js';
import { getJSON, putJSON } from '../lib/kv.js';
import { readBody } from '../lib/utils.js';

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

  // ✅ THÊM: Public API - Home Sections (Gộp Bestseller + 4 Categories + Cache)
  if (path === '/products/home-sections' && method === 'GET') {
    return getHomeSections(req, env);
  }

  // ✅ THÊM: Public API - Sản phẩm giá rẻ (cheap)
  if (path === '/products/cheap' && method === 'GET') {
    return getCheapProducts(req, env);
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

  // Admin: Get ALL products with variants (NO pagination) - For stats/reports
  if (path === '/admin/products/summary' && method === 'GET') {
    return listAllProductsWithVariants(req, env);
  }

  // Admin: Batch get products (POST with product_ids array)
  if (path === '/admin/products/batch' && method === 'POST') {
    return getProductsBatch(req, env);
  }

  // Admin: List all products (with pagination)
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
        rating_count: Number(product.rating_count || product.reviews_count || product.review_count || 0),
        
        // ✅ QUAN TRỌNG: Trả về variants để Frontend tính giá chính xác (Sỉ/Lẻ/Tier)
        variants: product.variants || []
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
        sold, rating, rating_count, stock,
        created_at, updated_at
      FROM products
      ORDER BY created_at DESC
    `).all();

    if (!products.results || products.results.length === 0) {
      console.log('[listProducts] ⚠️ Không có sản phẩm nào');
      return [];
    }

    console.log(`[listProducts] ✅ Tìm thấy ${products.results.length} sản phẩm`);

    // 🔍 DEBUG: Query variants stock để so sánh
    const debugStockInfo = [];

    // Convert sang format summary (tương thích với code cũ)
    const items = await Promise.all(products.results.map(async (p) => {
      // Parse JSON fields
      const images = p.images ? JSON.parse(p.images) : [];
      
      // 🔍 DEBUG: Query variants stock của product này
      const variantsResult = await env.DB.prepare(`
        SELECT id, sku, stock FROM variants WHERE product_id = ?
      `).bind(p.id).all();
      
      const variants = variantsResult.results || [];
      const variantsStockSum = variants.reduce((sum, v) => sum + (Number(v.stock) || 0), 0);
      const productStock = Number(p.stock) || 0;
      
      // Log nếu có mismatch
      if (productStock !== variantsStockSum) {
        const debugInfo = {
          product_id: p.id,
          product_title: p.title,
          product_stock: productStock,
          variants_stock_sum: variantsStockSum,
          variants: variants.map(v => ({ id: v.id, sku: v.sku, stock: v.stock })),
          mismatch: true
        };
        console.log('[listProducts] ⚠️ STOCK MISMATCH:', debugInfo);
        debugStockInfo.push(debugInfo);
      } else {
        console.log(`[listProducts] ✅ Product ${p.id}: stock=${productStock} (variants sum=${variantsStockSum})`);
      }
      
      return {
        id: p.id,
        title: p.title,
        slug: p.slug,
        shortDesc: p.shortDesc || '',
        category_slug: p.category_slug || '',
        images,
        status: p.status || 'active',
        on_website: p.on_website || 0,
        on_mini: p.on_mini || 0,
        sold: p.sold || 0,
        rating: p.rating || 5.0,
        rating_count: p.rating_count || 0,
        stock: p.stock || 0,
        created_at: p.created_at,
        updated_at: p.updated_at,
        // 🔍 DEBUG: Thêm debug info vào response
        _debug_variants_stock: variantsStockSum,
        _debug_stock_match: productStock === variantsStockSum
      };
    }));

    // Log tổng kết
    if (debugStockInfo.length > 0) {
      console.log(`[listProducts] 🚨 Found ${debugStockInfo.length} products with stock mismatch`);
    }

    // 🔍 DEBUG: Log top 10 products để check
    const top10 = items.slice(0, 10).map(item => ({
      id: item.id,
      title: item.title?.substring(0, 30),
      product_stock: item.stock,
      variants_stock: item._debug_variants_stock,
      match: item._debug_stock_match
    }));
    console.log('[listProducts] 📊 Top 10 products stock:', JSON.stringify(top10, null, 2));

    return items;
  } catch (error) {
    console.error('[listProducts] ❌ Error:', error);
    return [];
  }
}

/**
 * ✅ Category matching helper (FIXED)
 */
function toSlug(input) {
  const text = String(input || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
}
// ✅ FIX: Gán alias để tránh lỗi 'slugify is not defined'
const slugify = toSlug;

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

      // ✅ Chỉ thêm sản phẩm còn hàng
      const totalStock = product.variants.reduce((sum, v) => sum + Number(v.stock || 0), 0);
      if (totalStock > 0) {
        full.push(product);
      }
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

// ===================================================================
// PUBLIC: Search & List Products (CORRECT SCHEMA v10 - Fix 500 Error)
// ===================================================================
async function listPublicProductsFiltered(req, env) {
  try {
    const url = new URL(req.url);
    
    // 1. LẤY THAM SỐ
    const category = url.searchParams.get('category') || 
                     url.searchParams.get('cat') || 
                     url.searchParams.get('category_slug') || 
                     url.searchParams.get('c') || '';
    
    const searchRaw = (url.searchParams.get('q') || 
                       url.searchParams.get('search') || 
                       url.searchParams.get('keyword') || '').trim();
    
    const page = Math.max(1, Number(url.searchParams.get('page') || '1'));
    const limit = Math.min(50, Number(url.searchParams.get('limit') || '24'));
    const offset = (page - 1) * limit;

    console.log(`[SEARCH v10] Q="${searchRaw}" Cat="${category}"`);

    // 2. QUERY PRODUCTS (Chuẩn theo file database.sql: KHÔNG SELECT PRICE)
    let sql = `
      SELECT id, title, slug, images, category_slug, status, sold, rating, rating_count, created_at, stock
      FROM products
      WHERE status = 'active'
    `;
    const params = [];

    // Xử lý tìm kiếm
    if (searchRaw) {
       sql += ` AND (slug LIKE ? OR title LIKE ?)`;
       // Tự xử lý slug tại chỗ để không phụ thuộc hàm bên ngoài
       const s = searchRaw.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-');
       params.push(`%${s}%`, `%${searchRaw}%`);
    }

    // Xử lý danh mục
    if (category) {
      sql += ` AND category_slug = ?`;
      params.push(category);
    }

    sql += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    // Chạy query Products
    const productRes = await env.DB.prepare(sql).bind(...params).all();
    const products = productRes.results || [];

    if (products.length === 0) {
      return json({ ok: true, items: [], pagination: { page, limit, count: 0 } }, {}, req);
    }

    // 3. QUERY VARIANTS (Lấy giá từ bảng variants theo database.sql)
    const productIds = products.map(p => p.id);
    const placeholders = productIds.map(() => '?').join(',');
    
    const variantRes = await env.DB.prepare(`
      SELECT id, product_id, sku, name, price, price_sale, stock 
      FROM variants 
      WHERE product_id IN (${placeholders})
    `).bind(...productIds).all();
    
    const allVariants = variantRes.results || [];

    // 4. HÀM XỬ LÝ SỐ LIỆU AN TOÀN
    const parseNum = (val) => {
      if (!val) return 0;
      if (typeof val === 'number') return val;
      // Xử lý trường hợp giá lưu dạng "15.000" hoặc "15,000"
return Number(String(val).replace(/[^0-9]/g, '')) || 0;
    };

    // 5. GHÉP GIÁ VÀO SẢN PHẨM
    const items = [];

    for (const p of products) {
      const pVariants = allVariants.filter(v => v.product_id === p.id);
      
      let minPrice = 0;
      let maxOriginal = 0;
      let totalStock = 0;

      if (pVariants.length > 0) {
        for (const v of pVariants) {
          const reg = parseNum(v.price);
          const sale = parseNum(v.price_sale);
          const stock = parseNum(v.stock);

          // Giá thực bán: Nếu có sale hợp lệ (< giá gốc) thì lấy sale
          const realPrice = (sale > 0 && sale < reg) ? sale : reg;

          // Tìm giá thấp nhất để hiển thị "Từ..."
          if (realPrice > 0) {
            if (minPrice === 0 || realPrice < minPrice) minPrice = realPrice;
          }
          
          // Tìm giá gốc cao nhất để gạch
          if (reg > maxOriginal) maxOriginal = reg;
          
          totalStock += stock;
        }
      } else {
        // Trường hợp sản phẩm không có variant (nếu có logic này)
        // Mặc định hiển thị Liên hệ (0đ) hoặc check nếu anh có lưu giá tạm đâu đó
        // Nhưng theo schema thì giá nằm hết ở variants
      }

      // ✅ LỌC HIỂN THỊ: Nếu giá = 0 HOẶC tồn kho = 0 -> Bỏ qua, không hiển thị
      if (minPrice <= 0 || totalStock <= 0) continue;

      const images = p.images ? JSON.parse(p.images) : [];
        
      items.push({
        id: p.id,
        title: p.title,
        name: p.title,
        slug: p.slug,
        images: images,
        image: images[0] || null,
        category_slug: p.category_slug,
        sold: Number(p.sold || 0),
        rating: Number(p.rating || 5.0),
        rating_count: Number(p.rating_count || 0),
        stock: totalStock > 0 ? totalStock : Number(p.stock || 0),
        variants: pVariants, // ✅ Trả về variants để Frontend tính giá
        
        // ✅ GIÁ CUỐI CÙNG
        price: minPrice,
        price_display: minPrice,
        compare_at_display: maxOriginal > minPrice ? maxOriginal : null,
        
        price_tier: 'retail',
        price_sale: 0
      });
    }

    return json({ 
      ok: true, 
      items: items,
      pagination: { page, limit, count: items.length }
    }, { 
      headers: { 'cache-control': 'public, max-age=5' } 
    }, req);

  } catch (e) {
    console.error('[SEARCH ERROR]', e);
    return json({ ok: false, error: e.message }, { status: 500 }, req);
  }
}
// ===================================================================
// ADMIN: List All Products (WITH PAGINATION)
// ===================================================================

async function listAdminProducts(req, env) {
  try {
    const url = new URL(req.url);
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'));
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '24')));
    const offset = (page - 1) * limit;
    
    // ✅ NEW: Search & Filter parameters
    const search = (url.searchParams.get('search') || url.searchParams.get('q') || '').trim();
    const filter = (url.searchParams.get('filter') || '').trim(); // uncategorized, missing_price

    console.log('[listAdminProducts] 📄 Page:', page, 'Limit:', limit, 'Search:', search, 'Filter:', filter);

    // ✅ NEW: Build Dynamic WHERE clause
    let conditions = [];
    let queryParams = [];

    // 1. Search (Title, Slug, ID, OR SKU in variants)
    if (search) {
      conditions.push(`(
        title LIKE ? OR 
        slug LIKE ? OR 
        CAST(id AS TEXT) LIKE ? OR
        id IN (SELECT product_id FROM variants WHERE sku LIKE ?)
      )`);
      const pattern = `%${search}%`;
      queryParams.push(pattern, pattern, pattern, pattern);
    }

    // 2. Filter: Uncategorized
    if (filter === 'uncategorized') {
      conditions.push(`(category_slug IS NULL OR category_slug = '')`);
    }

    // 3. Filter: Missing Price (Check variants max price is 0 or null)
    if (filter === 'missing_price') {
       conditions.push(`(
         id IN (
           SELECT product_id FROM variants 
           GROUP BY product_id 
           HAVING MAX(price) = 0 OR MAX(price) IS NULL
         )
         OR 
         (stock > 0 AND NOT EXISTS (SELECT 1 FROM variants WHERE product_id = products.id))
       )`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // ✅ Query stats với search filter
    const statsResult = await env.DB.prepare(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN stock > 0 THEN 1 ELSE 0 END) as in_stock,
        SUM(CASE WHEN stock = 0 THEN 1 ELSE 0 END) as out_of_stock
      FROM products
      ${whereClause}
    `).bind(...queryParams).first();

    const total = statsResult?.total || 0;
    const totalPages = Math.ceil(total / limit);

    // ✅ Query paginated products với search
    const productsQuery = `
      SELECT 
        id, title, slug, shortDesc, category_slug,
        images, status, on_website, on_mini,
        sold, rating, rating_count, stock,
        created_at, updated_at
      FROM products
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `;
    
    const productsResult = await env.DB.prepare(productsQuery)
      .bind(...queryParams, limit, offset)
      .all();

    const products = productsResult.results || [];
    console.log(`[listAdminProducts] ✅ Found ${products.length}/${total} products`);

    // Load variants cho products hiện tại (batch query)
    const productIds = products.map(p => p.id);
    
    let variantsResult = { results: [] };
    if (productIds.length > 0) {
      const placeholders = productIds.map(() => '?').join(',');
      variantsResult = await env.DB.prepare(`
        SELECT * FROM variants 
        WHERE product_id IN (${placeholders})
        ORDER BY product_id, id ASC
      `).bind(...productIds).all();
    }

    // Group variants by product_id
    const variantsByProduct = {};
    (variantsResult.results || []).forEach(v => {
      if (!variantsByProduct[v.product_id]) {
        variantsByProduct[v.product_id] = [];
      }
      variantsByProduct[v.product_id].push({
        id: v.id,
        sku: v.sku,
        name: v.name,
        price: v.price,
        price_sale: v.price_sale,
        price_wholesale: v.price_wholesale,
        cost_price: v.cost_price,
        stock: v.stock,
        weight: v.weight,
        status: v.status,
        image: v.image
      });
    });

    // Map products với variants
    const items = products.map(p => ({
      id: p.id,
      title: p.title,
      slug: p.slug,
      shortDesc: p.shortDesc || '',
      category_slug: p.category_slug || '',
      images: p.images ? JSON.parse(p.images) : [],
      status: p.status || 'active',
      on_website: p.on_website || 0,
      on_mini: p.on_mini || 0,
      sold: p.sold || 0,
      rating: p.rating || 5.0,
      rating_count: p.rating_count || 0,
      stock: p.stock || 0,
      created_at: p.created_at,
      updated_at: p.updated_at,
      variants: variantsByProduct[p.id] || []
    }));

    return json({ 
      ok: true, 
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
      },
      stats: {
        total: statsResult?.total || 0,
        in_stock: statsResult?.in_stock || 0,
        out_of_stock: statsResult?.out_of_stock || 0
      },
      search: search || null
    }, {}, req);
  } catch (e) {
    console.error('[listAdminProducts] ❌ Error:', e);
    return errorResponse(e, 500, req);
  }
}

// ===================================================================
// ADMIN: List ALL Products with Variants (NO Pagination - For Stats)
// ===================================================================

async function listAllProductsWithVariants(req, env) {
  try {
    console.log('[listAllProductsWithVariants] 🚀 Loading ALL products with variants...');

    // ✅ FIX: Query trực tiếp với JOIN thay vì map variables
    const result = await env.DB.prepare(`
      SELECT 
        p.id, p.title, p.slug, p.shortDesc, p.desc, p.category_slug,
        p.images, p.keywords, p.faq, p.reviews, p.video,
        p.status, p.on_website, p.on_mini,
        p.sold, p.rating, p.rating_count, p.stock,
        p.created_at, p.updated_at,
        v.id as variant_id,
        v.sku as variant_sku,
        v.name as variant_name,
        v.price as variant_price,
        v.price_sale as variant_price_sale,
        v.price_wholesale as variant_price_wholesale,
        v.cost_price as variant_cost_price,
        v.price_silver as variant_price_silver,
        v.price_gold as variant_price_gold,
        v.price_diamond as variant_price_diamond,
        v.stock as variant_stock,
        v.weight as variant_weight,
        v.status as variant_status,
        v.image as variant_image
      FROM products p
      LEFT JOIN variants v ON p.id = v.product_id
      ORDER BY p.created_at DESC, v.id ASC
    `).all();

    const rows = result.results || [];
    console.log(`[listAllProductsWithVariants] ✅ Found ${rows.length} rows (products + variants)`);

    if (rows.length === 0) {
      return json({ 
        ok: true, 
        items: [],
        total: 0
      }, {}, req);
    }

    // ✅ Group rows thành products với variants
    const productsMap = new Map();
    
    rows.forEach(row => {
      const productId = row.id;
      
      // Khởi tạo product nếu chưa có
      if (!productsMap.has(productId)) {
        productsMap.set(productId, {
          id: row.id,
          title: row.title,
          slug: row.slug,
          shortDesc: row.shortDesc || '',
          desc: row.desc || '',
          category_slug: row.category_slug || '',
          images: row.images ? JSON.parse(row.images) : [],
          keywords: row.keywords ? JSON.parse(row.keywords) : [],
          faq: row.faq ? JSON.parse(row.faq) : [],
          reviews: row.reviews ? JSON.parse(row.reviews) : [],
          video: row.video || null,
          status: row.status || 'active',
          on_website: row.on_website || 0,
          on_mini: row.on_mini || 0,
          sold: row.sold || 0,
          rating: row.rating || 5.0,
          rating_count: row.rating_count || 0,
          stock: row.stock || 0,
          created_at: row.created_at,
          updated_at: row.updated_at,
          variants: []
        });
      }
      
      // Thêm variant nếu có
      if (row.variant_id) {
        const product = productsMap.get(productId);
        product.variants.push({
          id: row.variant_id,
          sku: row.variant_sku,
          name: row.variant_name,
          price: row.variant_price,
          price_sale: row.variant_price_sale,
          price_wholesale: row.variant_price_wholesale,
          cost_price: row.variant_cost_price,
          price_silver: row.variant_price_silver,
          price_gold: row.variant_price_gold,
          price_diamond: row.variant_price_diamond,
          stock: row.variant_stock,
          weight: row.variant_weight,
          status: row.variant_status,
          image: row.variant_image
        });
      }
    });

    const items = Array.from(productsMap.values());
    console.log(`[listAllProductsWithVariants] ✅ Completed: ${items.length} products`);

    return json({ 
      ok: true, 
      items,
      total: items.length,
      has_variants: true
    }, {}, req);

  } catch (e) {
    console.error('[listAllProductsWithVariants] ❌ Error:', e);
    return errorResponse(e, 500, req);
  }
}

// ===================================================================
// ADMIN: Batch Get Products (Lấy nhiều products cùng lúc)
// ===================================================================

async function getProductsBatch(req, env) {
  try {
    const body = await readBody(req) || {};
    const productIds = body.product_ids || body.ids || [];

    if (!Array.isArray(productIds) || productIds.length === 0) {
      return json({
        ok: false,
        error: 'product_ids array is required'
      }, { status: 400 }, req);
    }

    // Giới hạn tối đa 100 products mỗi request
    const ids = productIds.slice(0, 100);
    console.log('[getProductsBatch] 📦 Batch loading', ids.length, 'products');

    // Query products
    const placeholders = ids.map(() => '?').join(',');
    const productsResult = await env.DB.prepare(`
      SELECT * FROM products WHERE id IN (${placeholders})
    `).bind(...ids).all();

    const products = productsResult.results || [];

    // Query variants cho tất cả products
    // ✅ FIX: Check empty array
    let variantsResult = { results: [] };
    if (ids.length > 0) {
      variantsResult = await env.DB.prepare(`
        SELECT * FROM variants 
        WHERE product_id IN (${placeholders})
        ORDER BY product_id, id ASC
      `).bind(...ids).all();
    }

    // Group variants by product_id
    const variantsByProduct = {};
    (variantsResult.results || []).forEach(v => {
      if (!variantsByProduct[v.product_id]) {
        variantsByProduct[v.product_id] = [];
      }
      variantsByProduct[v.product_id].push(v);
    });

    // Map products với variants
    const items = products.map(p => ({
      ...p,
      images: p.images ? JSON.parse(p.images) : [],
      keywords: p.keywords ? JSON.parse(p.keywords) : [],
      faq: p.faq ? JSON.parse(p.faq) : [],
      reviews: p.reviews ? JSON.parse(p.reviews) : [],
      variants: variantsByProduct[p.id] || []
    }));

    console.log(`[getProductsBatch] ✅ Loaded ${items.length} products with variants`);

    return json({
      ok: true,
      items,
      count: items.length
    }, {}, req);

  } catch (e) {
    console.error('[getProductsBatch] ❌ Error:', e);
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

        // Chuẩn bị variant data
        const variantData = {
          product_id: productId,
          sku: incomingSKU,
          name: v.name || v.title || 'Default',
          price: Number(v.price || 0),
          price_sale: v.price_sale ? Number(v.price_sale) : null,
          price_wholesale: v.price_wholesale ? Number(v.price_wholesale) : null,
          cost_price: v.cost_price ? Number(v.cost_price) : null,
          price_silver: v.price_silver ? Number(v.price_silver) : null,
          price_gold: v.price_gold ? Number(v.price_gold) : null,
          price_diamond: v.price_diamond ? Number(v.price_diamond) : null,
          stock: v.stock !== undefined ? Number(v.stock) : (oldVariant ? oldVariant.stock : 0),
          weight: Number(v.weight || v.weight_gram || v.weight_grams || 0),
          status: v.status || 'active',
          image: v.image || null,
          created_at: oldVariant ? oldVariant.created_at : now,
          updated_at: now
        };

        if (oldVariant) {
          // UPDATE existing variant
          await env.DB.prepare(`
            UPDATE variants SET
              sku = ?, name = ?, price = ?, price_sale = ?,
              price_wholesale = ?, cost_price = ?,
              price_silver = ?, price_gold = ?, price_diamond = ?,
              stock = ?, weight = ?, status = ?, image = ?,
              updated_at = ?
            WHERE id = ?
          `).bind(
            variantData.sku, variantData.name, variantData.price, variantData.price_sale,
            variantData.price_wholesale, variantData.cost_price,
            variantData.price_silver, variantData.price_gold, variantData.price_diamond,
            variantData.stock, variantData.weight, variantData.status, variantData.image,
            variantData.updated_at, oldVariant.id
          ).run();
        } else {
          // INSERT new variant
          await env.DB.prepare(`
            INSERT INTO variants (
              product_id, sku, name, price, price_sale,
              price_wholesale, cost_price,
              price_silver, price_gold, price_diamond,
              stock, weight, status, image,
              created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).bind(
            variantData.product_id, variantData.sku, variantData.name,
            variantData.price, variantData.price_sale,
            variantData.price_wholesale, variantData.cost_price,
            variantData.price_silver, variantData.price_gold, variantData.price_diamond,
            variantData.stock, variantData.weight, variantData.status, variantData.image,
            variantData.created_at, variantData.updated_at
          ).run();
        }
      }
      
      console.log(`✅ Processed ${incomingVariants.length} variants`);
    }

    // 6) ✅ AUTO-UPDATE products.stock từ tổng variants.stock
    const stockResult = await env.DB.prepare(`
      SELECT COALESCE(SUM(stock), 0) as total_stock 
      FROM variants 
      WHERE product_id = ?
    `).bind(productId).first();
    
    const totalStock = stockResult?.total_stock || 0;
    
    await env.DB.prepare(`
      UPDATE products 
      SET stock = ?, updated_at = ?
      WHERE id = ?
    `).bind(totalStock, now, productId).run();
    
    console.log(`✅ Auto-updated products.stock = ${totalStock} for product ${productId}`);

    // 7) Load lại full product để trả về
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

    console.log('[BESTSELLERS] 🚀 Query D1 with sold + stock...');

    // ✅ FIX: Query trực tiếp từ D1 với sold + stock check
    const result = await env.DB.prepare(`
      SELECT 
        p.id, p.title, p.slug, p.images, p.category_slug,
        p.status, p.sold, p.rating, p.rating_count,
        COALESCE(SUM(v.stock), 0) as total_stock
      FROM products p
      LEFT JOIN variants v ON p.id = v.product_id
      WHERE p.status = 'active'
      GROUP BY p.id
      HAVING total_stock > 0
      ORDER BY p.sold DESC, p.created_at DESC
      LIMIT ?
    `).bind(limit).all();

    const items = (result.results || []).map(p => {
      const images = p.images ? JSON.parse(p.images) : [];
      
      return {
        id: p.id,
        title: p.title,
        name: p.title,
        slug: p.slug,
        images: images,
        category_slug: p.category_slug,
        status: 1,
        sold: Number(p.sold || 0),
        rating: Number(p.rating || 5.0),
        rating_count: Number(p.rating_count || 0),
        stock: Number(p.total_stock || 0)
      };
    });

    // 🔥 Load FULL variants để tính giá
    const full = [];
    for (const item of items) {
      const productResult = await env.DB.prepare(`
        SELECT * FROM products WHERE id = ?
      `).bind(item.id).first();

      if (!productResult) continue;

      const variantsResult = await env.DB.prepare(`
        SELECT * FROM variants WHERE product_id = ?
      `).bind(item.id).all();

      const product = {
        ...productResult,
        ...item,
        images: item.images,
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
  const now = Date.now(); // ✅ THÊM DÒNG NÀY
  try {
    const url = new URL(req.url);
    const limit = Number(url.searchParams.get('limit') || '12');
    const DAYS = 14; // Lấy sản phẩm trong 14 ngày gần đây

    console.log('[NEWEST] 🚀 Query D1 with created_at + stock...');

    const cutoffTime = Date.now() - (DAYS * 24 * 60 * 60 * 1000);

    // ✅ FIX: Query trực tiếp từ D1 với created_at + stock check
    const result = await env.DB.prepare(`
      SELECT 
        p.id, p.title, p.slug, p.images, p.category_slug,
        p.status, p.sold, p.rating, p.rating_count, p.created_at,
        COALESCE(SUM(v.stock), 0) as total_stock
      FROM products p
      LEFT JOIN variants v ON p.id = v.product_id
      WHERE p.status = 'active' 
        AND p.created_at >= ?
      GROUP BY p.id
      HAVING total_stock > 0
      ORDER BY p.created_at DESC
      LIMIT ?
    `).bind(cutoffTime, limit).all();

    const items = (result.results || []).map(p => {
      const images = p.images ? JSON.parse(p.images) : [];
      
      return {
        id: p.id,
        title: p.title,
        name: p.title,
        slug: p.slug,
        images: images,
        category_slug: p.category_slug,
        status: 1,
        sold: Number(p.sold || 0),
        rating: Number(p.rating || 5.0),
        rating_count: Number(p.rating_count || 0),
        stock: Number(p.total_stock || 0),
        created_at: p.created_at
      };
    });

    // 🔥 Load FULL variants để tính giá
    const full = [];
    for (const item of items) {
      const productResult = await env.DB.prepare(`
        SELECT * FROM products WHERE id = ?
      `).bind(item.id).first();

      if (!productResult) continue;

      const variantsResult = await env.DB.prepare(`
        SELECT * FROM variants WHERE product_id = ?
      `).bind(item.id).all();

      const product = {
        ...productResult,
        ...item,
        images: item.images,
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

// ===================================================================
// PUBLIC: Get Home Sections (Optimized: 1 Query Batch + KV Cache)
// ===================================================================
async function getHomeSections(req, env) {
  try {
    // 1. CẤU HÌNH CACHE KV
    const CACHE_KEY = 'home_sections_data_v1';
    const CACHE_TTL = 300; // 5 phút

    // 2. KIỂM TRA CACHE
    const cached = await getJSON(env, CACHE_KEY);
    if (cached) {
      return json({
        ok: true,
        source: 'cache',
        data: cached
      }, { 
        headers: { 'x-cache-status': 'HIT' } 
      }, req);
    }

    console.log('[HOME] 🚀 Cache Miss -> Querying D1 Parallel...');

    // 3. PREPARE QUERIES (Logic mới: Lấy variants riêng để tính giá chính xác)
    const sqlTemplate = (condition, orderBy, limit) => `
      SELECT id, title, slug, images, category_slug, status, sold, rating, rating_count
      FROM products 
      WHERE status = 'active' ${condition ? 'AND ' + condition : ''}
      ORDER BY ${orderBy}
      LIMIT ${limit}
    `;

    // Chạy 5 query song song lấy danh sách sản phẩm
    const [resBest, resDien, resNha, resHoa, resDung] = await Promise.all([
      env.DB.prepare(sqlTemplate('', 'sold DESC', 10)).all(),
      env.DB.prepare(sqlTemplate("category_slug = 'thiet-bi-dien-nuoc'", 'created_at DESC', 8)).all(),
      env.DB.prepare(sqlTemplate("category_slug = 'nha-cua-doi-song'", 'created_at DESC', 8)).all(),
      env.DB.prepare(sqlTemplate("category_slug = 'hoa-chat-gia-dung'", 'created_at DESC', 8)).all(),
      env.DB.prepare(sqlTemplate("category_slug = 'dung-cu-tien-ich'", 'created_at DESC', 8)).all()
    ]);

    // 4. GỘP ID VÀ LẤY VARIANTS (Để tính giá chuẩn xác từ bảng variants)
    const allRows = [
      ...(resBest.results || []), ...(resDien.results || []),
      ...(resNha.results || []), ...(resHoa.results || []),
      ...(resDung.results || [])
    ];
    const uniqueIds = [...new Set(allRows.map(p => p.id))];
    
    let allVariants = [];
    if (uniqueIds.length > 0) {
      const placeholders = uniqueIds.map(() => '?').join(',');
      // ✅ Lấy đủ thông tin variants để trả về frontend
      const vRes = await env.DB.prepare(`
        SELECT id, product_id, sku, name, price, price_sale, stock 
        FROM variants WHERE product_id IN (${placeholders})
      `).bind(...uniqueIds).all();
      allVariants = vRes.results || [];
    }

    // 5. FORMAT VÀ LỌC (Ẩn giá 0đ và hết hàng)
    const parseNum = (x) => Number(String(x).replace(/[^0-9]/g, '')) || 0;

    const processSection = (rows) => {
      const result = [];
      for (const p of (rows || [])) {
        const pVars = allVariants.filter(v => v.product_id === p.id);
        
        let minPrice = 0;
        let maxOriginal = 0;
        let totalStock = 0;

        if (pVars.length > 0) {
          for (const v of pVars) {
            const reg = parseNum(v.price);
            const sale = parseNum(v.price_sale);
            const stock = parseNum(v.stock);
            const real = (sale > 0 && sale < reg) ? sale : reg;
            
            if (real > 0 && (minPrice === 0 || real < minPrice)) minPrice = real;
            if (reg > maxOriginal) maxOriginal = reg;
            totalStock += stock;
          }
        }
        
        // 🔥 ĐIỀU KIỆN LỌC: Ẩn nếu giá = 0 HOẶC hết hàng (theo yêu cầu)
        if (minPrice <= 0 || totalStock <= 0) continue;

        const images = p.images ? JSON.parse(p.images) : [];
        
        // Map lại variants với giá đã parse số (để frontend dùng)
        const variantsParsed = pVars.map(v => ({
           ...v, 
           price: parseNum(v.price), 
           price_sale: parseNum(v.price_sale) 
        }));

        result.push({
          id: p.id, title: p.title, name: p.title, slug: p.slug,
          images, image: images[0] || null,
          category_slug: p.category_slug,
          sold: Number(p.sold||0), rating: Number(p.rating||5),
          stock: totalStock,
          price_display: minPrice,
          compare_at_display: maxOriginal > minPrice ? maxOriginal : null,
          variants: variantsParsed, // ✅ Gửi variants xuống cho frontend
          price_tier: 'retail'
        });
      }
      return result;
    };

    const responseData = {
      bestsellers: processSection(resBest.results),
      cat_dien_nuoc: processSection(resDien.results),
      cat_nha_cua: processSection(resNha.results),
      cat_hoa_chat: processSection(resHoa.results),
      cat_dung_cu: processSection(resDung.results)
    };

    // 6. LƯU CACHE KV (background)
    // Lưu ý: Hàm putJSON cần await hoặc ctx.waitUntil nếu có
    await putJSON(env, CACHE_KEY, responseData, CACHE_TTL);

    console.log('[HOME] ✅ Done. Saved to Cache.');

    return json({
      ok: true,
      source: 'database',
      data: responseData
    }, { 
      headers: { 'x-cache-status': 'MISS' } 
    }, req);

  } catch (e) {
    console.error('[HOME] ❌ Error:', e);
    return errorResponse(e, 500, req);
  }
}

// ===================================================================
// PUBLIC: Get Cheap Products (sản phẩm giá rẻ <= 15.000đ)
// ===================================================================
async function getCheapProducts(req, env) {
  try {
    const url = new URL(req.url);
    const limit = Number(url.searchParams.get('limit') || '15');
    const maxPrice = Number(url.searchParams.get('max_price') || '15000');

    console.log('[CHEAP] 🚀 Query D1 with price <=', maxPrice);

    // ✅ Query trực tiếp từ D1: variants có giá <= maxPrice VÀ còn hàng
    const result = await env.DB.prepare(`
      SELECT DISTINCT
        p.id, p.title, p.slug, p.images, p.category_slug,
        p.status, p.sold, p.rating, p.rating_count,
        MIN(CASE WHEN v.price_sale > 0 AND v.price_sale < v.price THEN v.price_sale ELSE v.price END) as min_price,
        COALESCE(SUM(v.stock), 0) as total_stock
      FROM products p
      INNER JOIN variants v ON p.id = v.product_id
      WHERE p.status = 'active'
        AND v.stock > 0
        AND (
          (v.price_sale > 0 AND v.price_sale <= ?) 
          OR (v.price_sale IS NULL AND v.price <= ?)
          OR (v.price_sale = 0 AND v.price <= ?)
        )
      GROUP BY p.id
      HAVING total_stock > 0 AND min_price > 0 AND min_price <= ?
      ORDER BY min_price ASC, p.sold DESC
      LIMIT ?
    `).bind(maxPrice, maxPrice, maxPrice, maxPrice, limit).all();

    const items = (result.results || []).map(p => {
      const images = p.images ? JSON.parse(p.images) : [];
      
      return {
        id: p.id,
        title: p.title,
        name: p.title,
        slug: p.slug,
        images: images,
        category_slug: p.category_slug,
        status: 1,
        sold: Number(p.sold || 0),
        rating: Number(p.rating || 5.0),
        rating_count: Number(p.rating_count || 0),
        stock: Number(p.total_stock || 0),
        min_price: Number(p.min_price || 0)
      };
    });

    // 🔥 Load FULL variants để tính giá chính xác
    const full = [];
    for (const item of items) {
      const variantsResult = await env.DB.prepare(`
        SELECT * FROM variants WHERE product_id = ? AND stock > 0
      `).bind(item.id).all();

      const product = {
        ...item,
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

    // Dùng toSummary để đồng bộ format với các API khác
    const out = full.map(p => toSummary(p));

    console.log('[CHEAP] ✅ Returned:', out.length, 'products (price <=', maxPrice, ')');
    
    return json({ 
      ok: true, 
      items: out,
      max_price: maxPrice
    }, { 
      headers: { 
        'cache-control': 'public, max-age=300, s-maxage=300',
        'cdn-cache-control': 'max-age=300'
      } 
    }, req);

  } catch (e) {
    console.error('[CHEAP] ❌ Error:', e);
    return errorResponse(e, 500, req);
  }
}

console.log('✅ products.js loaded - CATEGORY FILTER FIXED + FLASH SALE INTEGRATED + METRICS API + CHEAP PRODUCTS');
// <<< Cuối file >>>
