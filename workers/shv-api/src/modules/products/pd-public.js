// workers/shv-api/src/modules/products/pd-public.js
// Chứa API phục vụ Client (Web Frontend & Zalo Mini App)

import { loadProductNormalized, normalizeVietnamese, normalizeProduct } from '../../core/product-core.js'; // Import thêm normalizeProduct nếu cần cho toSummary
import { getJSON, putJSON } from '../../lib/kv.js';
import { json, errorResponse } from '../../lib/response.js';
import {
  safeParseImages,
  safeParseJSON,
  toSummary,
  getCustomerTier,
  computeDisplayPrice,
  getFlashSaleForProduct,
  applyFlashSaleDiscount
} from './pd-utils.js';

// ===================================================================
// INTERNAL HELPER: List Products (Dùng cho cả Feed)
// ===================================================================
export async function listProducts(env) {
  console.log('[listProducts] 🚀 Đọc từ D1...');
  
  try {
    const products = await env.DB.prepare(`
      SELECT 
        id, title, slug, shortDesc, category_slug,
        images, status, on_website, on_mini,
        sold, rating, rating_count, stock,
        created_at, updated_at
      FROM products
      ORDER BY created_at DESC
    `).all();

    if (!products.results || products.results.length === 0) return [];

    const items = await Promise.all(products.results.map(async (p) => {
      return {
        id: p.id,
        title: p.title,
        slug: p.slug,
        shortDesc: p.shortDesc || '',
        category_slug: p.category_slug || '',
        images: safeParseImages(p.images),
        status: p.status || 'active',
        on_website: p.on_website || 0,
        on_mini: p.on_mini || 0,
        sold: p.sold || 0,
        rating: p.rating || 5.0,
        rating_count: p.rating_count || 0,
        stock: p.stock || 0,
        created_at: p.created_at,
        updated_at: p.updated_at
      };
    }));

    return items;
  } catch (error) {
    console.error('[listProducts] ❌ Error:', error);
    return [];
  }
}

// ===================================================================
// PUBLIC: Get Product by ID (CORE INTEGRATED)
// ===================================================================
export async function getProductById(req, env, productId) {
  try {
    console.log('[getProductById] 🔍 Loading from Core:', productId);
    
    // Dùng Core Engine: Tự động Cache KV + Chuẩn hóa Data + Tính Flash Sale
    const product = await loadProductNormalized(env, productId);

    if (!product) {
      return json({ ok: false, error: 'Product not found' }, { status: 404 }, req);
    }

    // Tính giá hiển thị theo Tier khách hàng
    const tier = getCustomerTier(req);
    const priced = { ...product, ...computeDisplayPrice(product, tier) };
    
    return json({ ok: true, item: priced, data: priced }, {}, req);
  } catch (e) {
    console.error('[getProductById] ❌ Lỗi:', e);
    return errorResponse(e, 500, req);
  }
}

// ===================================================================
// PUBLIC: List Public Products (Simple List)
// ===================================================================
export async function listPublicProducts(req, env) {
  try {
    const list = await listProducts(env);
    const actives = list.filter(p => p.status !== 0);

    const full = [];
    for (const s of actives) {
      const id = Number(s.id);
      if (!id) {
        full.push(s);
        continue;
      }

      const productResult = await env.DB.prepare(`SELECT * FROM products WHERE id = ?`).bind(id).first();
      if (!productResult) {
        full.push(s);
        continue;
      }

      const variantsResult = await env.DB.prepare(`SELECT * FROM variants WHERE product_id = ? ORDER BY id ASC`).bind(id).all();

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

      // Gắn thông tin Flash Sale
      const fsInfo = await getFlashSaleForProduct(env, product.id);
      if (fsInfo) {
        product.flash_sale = fsInfo;
        product.variants = product.variants.map(v => {
            const vWithFS = applyFlashSaleDiscount(v, fsInfo);
            // [CRITICAL FIX] Ghi đè price_sale bằng giá Flash Sale
            if (vWithFS.flash_sale && vWithFS.flash_sale.active) {
                vWithFS.price_sale = vWithFS.flash_sale.price;
            }
            return vWithFS;
        });
      }

      // Chỉ thêm sản phẩm còn hàng
      const totalStock = product.variants.reduce((sum, v) => sum + Number(v.stock || 0), 0);
      if (totalStock > 0) {
        full.push(product);
      }
    } // ✅ ĐÃ CÓ DẤU ĐÓNG VÒNG LẶP

    const tier = getCustomerTier(req);
    const items = full.map(p => ({ ...p, ...computeDisplayPrice(p, tier) }));

    return json({ ok: true, items }, {}, req);
  } catch (e) {
    console.error('[listPublicProducts] Error:', e);
    return errorResponse(e, 500, req);
  }
}

// ===================================================================
// PUBLIC: Search & List Products (Filtered - Search v10)
// ===================================================================
export async function listPublicProductsFiltered(req, env) {
  try {
    const url = new URL(req.url);
    const category = url.searchParams.get('category') || url.searchParams.get('cat') || url.searchParams.get('category_slug') || url.searchParams.get('c') || '';
    const searchRaw = (url.searchParams.get('q') || url.searchParams.get('search') || url.searchParams.get('keyword') || '').trim();
    const page = Math.max(1, Number(url.searchParams.get('page') || '1'));
    
    const hasSearch = searchRaw.length > 0;
    const sortBy = url.searchParams.get('sort') || '';
    const isBestseller = sortBy === 'bestseller';

    let limit;
    if (hasSearch || isBestseller) {
      limit = Math.min(5000, Number(url.searchParams.get('limit') || '1000'));
    } else {
      limit = Math.min(200, Number(url.searchParams.get('limit') || '24'));
    }
    const offset = (page - 1) * limit;

    let sql = `SELECT id, title, slug, images, category_slug, status, sold, rating, rating_count, created_at, stock FROM products WHERE status = 'active' AND stock > 0`;
    const params = [];

    if (searchRaw) {
       const cleanSearch = normalizeVietnamese(searchRaw);
       let keywords = cleanSearch.split(/[^a-z0-9]+/).filter(k => k.length > 0);
       
       if (keywords.length > 0) {
         const textConditions = keywords.map(() => `search_text LIKE ?`).join(' AND ');
         sql += ` AND (id IN (SELECT product_id FROM variants WHERE LOWER(sku) = ?) OR (${textConditions}))`;
         params.push(cleanSearch); 
         keywords.forEach(k => params.push(`%${k}%`));
       } else {
         sql += ` AND search_text LIKE ?`;
         params.push(`%${cleanSearch}%`);
       }
    }

    if (category && !searchRaw) {
      sql += ` AND category_slug = ?`;
      params.push(category);
    }

    if (sortBy === 'bestseller') {
       sql += ` ORDER BY sold DESC, created_at DESC`;
     } else if (sortBy === 'price_asc') {
       sql += ` ORDER BY stock DESC, created_at DESC`;
     } else {
       sql += ` ORDER BY created_at DESC`;
     }

    sql += ` LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    const productRes = await env.DB.prepare(sql).bind(...params).all();
    const products = productRes.results || [];

    if (products.length === 0) {
      return json({ ok: true, items: [], pagination: { page, limit, count: 0 } }, {}, req);
    }

    const productIds = products.map(p => p.id);
    const placeholders = productIds.map(() => '?').join(',');
    
    const variantRes = await env.DB.prepare(`
      SELECT id, product_id, sku, name, price, price_sale, stock 
      FROM variants WHERE product_id IN (${placeholders})
    `).bind(...productIds).all();
    
    const allVariants = variantRes.results || [];
    const parseNum = (val) => Number(String(val).replace(/[^0-9]/g, '')) || 0;
    const items = [];

    for (const p of products) {
      // 1. Lấy variants của sản phẩm
      let pVariants = allVariants.filter(v => v.product_id === p.id);
      
      // 2. [FIX] Lấy thông tin Flash Sale (quan trọng)
      const fsInfo = await getFlashSaleForProduct(env, p.id);
      
      // 3. [FIX] Áp dụng giá Flash Sale vào variants nếu có
      if (fsInfo) {
         pVariants = pVariants.map(v => {
             const vWithFS = applyFlashSaleDiscount(v, fsInfo);
             // [CRITICAL FIX] Ghi đè price_sale bằng giá Flash Sale để Mini App tự nhận diện đúng giá bán
             if (vWithFS.flash_sale && vWithFS.flash_sale.active) {
                 vWithFS.price_sale = vWithFS.flash_sale.price;
             }
             return vWithFS;
         });
      }

      let minPrice = 0;
      let maxOriginal = 0;
      let totalStock = 0;

      if (pVariants.length > 0) {
        for (const v of pVariants) {
          const reg = parseNum(v.price);
          const sale = parseNum(v.price_sale);
          const stock = parseNum(v.stock);
          
          // Tính giá thực tế (ưu tiên Flash Sale -> Sale -> Gốc)
          let realPrice = (sale > 0 && sale < reg) ? sale : reg;
          
          // [FIX] Nếu có Flash Sale active, dùng giá Flash Sale làm giá hiển thị
          if (v.flash_sale && v.flash_sale.active) {
             realPrice = v.flash_sale.price;
          }

          if (realPrice > 0) {
            if (minPrice === 0 || realPrice < minPrice) minPrice = realPrice;
          }
          if (reg > maxOriginal) maxOriginal = reg;
          totalStock += stock;
        }
      }

      if (minPrice <= 0 || totalStock <= 0) continue;

      const images = safeParseImages(p.images);
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
        stock: totalStock,
        variants: pVariants,
        price: minPrice,
        price_display: minPrice,
        compare_at_display: maxOriginal > minPrice ? maxOriginal : null,
        price_tier: 'retail',
        price_sale: 0,
        flash_sale: fsInfo // [FIX] Trả về thông tin Flash Sale để App nhận diện
      });
    }

    return json({ 
      ok: true, 
      items: items,
      pagination: { page, limit, count: items.length }
    }, { headers: { 'cache-control': 'public, max-age=5' } }, req);

  } catch (e) {
    console.error('[SEARCH ERROR]', e);
    return json({ ok: false, error: e.message }, { status: 500 }, req);
  }
}

// ===================================================================
// PUBLIC: Get Bestsellers
// ===================================================================
export async function getBestsellers(req, env) {
  try {
    const url = new URL(req.url);
    const limit = Number(url.searchParams.get('limit') || '12');

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

    const items = (result.results || []).map(p => ({
      id: p.id,
      title: p.title,
      name: p.title,
      slug: p.slug,
      images: safeParseImages(p.images),
      category_slug: p.category_slug,
      status: 1,
      sold: Number(p.sold || 0),
      rating: Number(p.rating || 5.0),
      rating_count: Number(p.rating_count || 0),
      stock: Number(p.total_stock || 0)
    }));

    const full = [];
    for (const item of items) {
      const productResult = await env.DB.prepare(`SELECT * FROM products WHERE id = ?`).bind(item.id).first();
      if (!productResult) continue;
      const variantsResult = await env.DB.prepare(`SELECT * FROM variants WHERE product_id = ?`).bind(item.id).all();

      const product = {
        ...productResult, ...item,
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

    full.sort((a, b) => Number(b.sold || 0) - Number(a.sold || 0));
    const out = full.slice(0, limit).map((p) => toSummary(p));
    return json({ ok: true, items: out }, {}, req);
  } catch (e) {
    console.error('❌ Error:', e);
    return errorResponse(e, 500, req);
  }
}

// ===================================================================
// PUBLIC: Get Newest
// ===================================================================
export async function getNewest(req, env) {
  const now = Date.now();
  try {
    const url = new URL(req.url);
    const limit = Number(url.searchParams.get('limit') || '12');
    const DAYS = 14;
    const cutoffTime = Date.now() - (DAYS * 24 * 60 * 60 * 1000);

    const result = await env.DB.prepare(`
      SELECT 
        p.id, p.title, p.slug, p.images, p.category_slug,
        p.status, p.sold, p.rating, p.rating_count, p.created_at,
        COALESCE(SUM(v.stock), 0) as total_stock
      FROM products p
      LEFT JOIN variants v ON p.id = v.product_id
      WHERE p.status = 'active' AND p.created_at >= ?
      GROUP BY p.id
      HAVING total_stock > 0
      ORDER BY p.created_at DESC
      LIMIT ?
    `).bind(cutoffTime, limit).all();

    const items = (result.results || []).map(p => ({
      id: p.id,
      title: p.title,
      name: p.title,
      slug: p.slug,
      images: safeParseImages(p.images),
      category_slug: p.category_slug,
      status: 1,
      sold: Number(p.sold || 0),
      rating: Number(p.rating || 5.0),
      rating_count: Number(p.rating_count || 0),
      stock: Number(p.total_stock || 0),
      created_at: p.created_at
    }));

    const full = [];
    for (const item of items) {
      const productResult = await env.DB.prepare(`SELECT * FROM products WHERE id = ?`).bind(item.id).first();
      if (!productResult) continue;
      const variantsResult = await env.DB.prepare(`SELECT * FROM variants WHERE product_id = ?`).bind(item.id).all();

      const product = {
        ...productResult, ...item,
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

    const newest = full.filter(p => {
      const created = new Date(p.createdAt || p.created_at || 0).getTime();
      return created && (now - created) / (1000 * 60 * 60 * 24) <= DAYS;
    });
    newest.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());

    const out = newest.slice(0, limit).map((p) => toSummary(p));
    return json({ ok: true, items: out }, {}, req);
  } catch (e) {
    console.error('❌ Error:', e);
    return errorResponse(e, 500, req);
  }
}

// ===================================================================
// PUBLIC: Get Home Sections (Optimized + Cache)
// ===================================================================
export async function getHomeSections(req, env) {
  try {
    const CACHE_KEY = 'home-sections-v2';
    const CACHE_TTL = 300;
    const url = new URL(req.url);
    const forceRefresh = url.searchParams.get('refresh') === '1';

    if (!forceRefresh) {
      const cached = await getJSON(env, CACHE_KEY, null);
      if (cached) return json({ ok: true, source: 'cache', data: cached }, { headers: { 'x-cache-status': 'HIT' } }, req);
    }

    const sqlTemplate = (condition, orderBy, limit) => `
      SELECT DISTINCT p.id, p.title, p.slug, p.images, p.category_slug, 
             p.status, p.sold, p.rating, p.rating_count
      FROM products p
      INNER JOIN variants v ON p.id = v.product_id
      WHERE p.status = 'active' 
        AND v.stock > 0
        AND ((v.price_sale > 0 AND v.price_sale < v.price) OR (v.price > 0))
        ${condition ? 'AND ' + condition : ''}
      GROUP BY p.id
      ORDER BY ${orderBy}
      LIMIT ${limit}
    `;

    const [resBest, resDien, resNha, resHoa, resDung] = await Promise.all([
      env.DB.prepare(sqlTemplate('', 'p.sold DESC', 50)).all(),
      env.DB.prepare(sqlTemplate("p.category_slug = 'thiet-bi-dien-nuoc'", 'p.created_at DESC', 40)).all(),
      env.DB.prepare(sqlTemplate("p.category_slug = 'nha-cua-doi-song'", 'p.created_at DESC', 40)).all(),
      env.DB.prepare(sqlTemplate("p.category_slug = 'hoa-chat-gia-dung'", 'p.created_at DESC', 40)).all(),
      env.DB.prepare(sqlTemplate("p.category_slug = 'dung-cu-tien-ich'", 'p.created_at DESC', 40)).all()
    ]);

    const allRows = [...(resBest.results||[]), ...(resDien.results||[]), ...(resNha.results||[]), ...(resHoa.results||[]), ...(resDung.results||[])];
    const uniqueIds = [...new Set(allRows.map(p => p.id))];
    
    let allVariants = [];
    if (uniqueIds.length > 0) {
      const placeholders = uniqueIds.map(() => '?').join(',');
      const vRes = await env.DB.prepare(`
        SELECT id, product_id, sku, name, price, price_sale, stock 
        FROM variants WHERE product_id IN (${placeholders})
      `).bind(...uniqueIds).all();
      allVariants = vRes.results || [];
    }

    const parseNum = (x) => Number(String(x).replace(/[^0-9]/g, '')) || 0;

    const processSection = (rows) => {
      const result = [];
      for (const p of (rows || [])) {
        const pVars = allVariants.filter(v => v.product_id === p.id);
        const productForCore = {
          id: p.id,
          title: p.title,
          slug: p.slug,
          images: safeParseImages(p.images),
          category_slug: p.category_slug,
          sold: p.sold,
          rating: p.rating,
          rating_count: p.rating_count,
          variants: pVars.map(v => ({
            id: v.id, product_id: v.product_id, sku: v.sku, name: v.name,
            price: parseNum(v.price), price_sale: parseNum(v.price_sale), stock: parseNum(v.stock)
          }))
        };
        
        const normalized = normalizeProduct(productForCore);
        if (normalized.price_final <= 0 || normalized.stock_total <= 0) continue;

        result.push({
          id: normalized.id,
          title: normalized.name,
          name: normalized.name,
          slug: normalized.slug,
          images: normalized.images,
          image: normalized.images[0] || null,
          category_slug: normalized.category_slug,
          sold: normalized.sold,
          rating: normalized.rating,
          rating_count: normalized.rating_count,
          stock: normalized.stock_total,
          price: normalized.price_final,
          price_display: normalized.price_final,
          compare_at_display: normalized.price_original > normalized.price_final ? normalized.price_original : null,
          discount_percent: normalized.discount_percent,
          video: normalized.video,
          variants: normalized.variants,
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

    await putJSON(env, CACHE_KEY, responseData, CACHE_TTL);
    return json({ ok: true, source: 'database', data: responseData }, { headers: { 'x-cache-status': 'MISS' } }, req);
  } catch (e) {
    console.error('[HOME] ❌ Error:', e);
    return errorResponse(e, 500, req);
  }
}

// ===================================================================
// PUBLIC: Get Cheap Products
// ===================================================================
export async function getCheapProducts(req, env) {
  try {
    const url = new URL(req.url);
    const limit = Number(url.searchParams.get('limit') || '15');
    const maxPrice = Number(url.searchParams.get('max_price') || '15000');

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
        AND ((v.price_sale > 0 AND v.price_sale <= ?) OR (v.price_sale IS NULL AND v.price <= ?) OR (v.price_sale = 0 AND v.price <= ?))
      GROUP BY p.id
      HAVING total_stock > 0 AND min_price > 0 AND min_price <= ?
      ORDER BY min_price ASC, p.sold DESC
      LIMIT ?
    `).bind(maxPrice, maxPrice, maxPrice, maxPrice, limit).all();

    const items = (result.results || []).map(p => ({
      id: p.id,
      title: p.title,
      name: p.title,
      slug: p.slug,
      images: safeParseImages(p.images),
      category_slug: p.category_slug,
      status: 1,
      sold: Number(p.sold || 0),
      rating: Number(p.rating || 5.0),
      rating_count: Number(p.rating_count || 0),
      stock: Number(p.total_stock || 0),
      min_price: Number(p.min_price || 0)
    }));

    const full = [];
    for (const item of items) {
      const variantsResult = await env.DB.prepare(`SELECT * FROM variants WHERE product_id = ? AND stock > 0`).bind(item.id).all();
      const product = {
        ...item,
        variants: (variantsResult.results || []).map(v => ({
          id: v.id, sku: v.sku, name: v.name, price: v.price, price_sale: v.price_sale, stock: v.stock, weight: v.weight
        }))
      };
      full.push(product);
    }

    const out = full.map(p => toSummary(p));
    return json({ ok: true, items: out, max_price: maxPrice }, { headers: { 'cache-control': 'public, max-age=300' } }, req);
  } catch (e) {
    console.error('[CHEAP] ❌ Error:', e);
    return errorResponse(e, 500, req);
  }
}

// ===================================================================
// PUBLIC: Get Product Channels Mapping
// ===================================================================
export async function getProductChannels(req, env, productId) {
  try {
    const result = await env.DB.prepare(`
      SELECT cp.*, v.sku as variant_sku, v.name as variant_name
      FROM channel_products cp
      LEFT JOIN variants v ON cp.variant_id = v.id
      WHERE cp.product_id = ?
      ORDER BY cp.channel, cp.created_at DESC
    `).bind(productId).all();

    return json({ ok: true, product_id: productId, channels: result.results || [] }, {}, req);
  } catch (e) {
    console.error('[getProductChannels] ❌ Error:', e);
    return errorResponse(e, 500, req);
  }
}