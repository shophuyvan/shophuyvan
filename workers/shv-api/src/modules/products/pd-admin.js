// workers/shv-api/src/modules/products/pd-admin.js
// Chứa API phục vụ Admin Panel (CRUD, List, Sync)

import { buildSearchText, invalidateProductCache } from '../../core/product-core.js';
import { adminOK } from '../../lib/auth.js';
import { readBody } from '../../lib/utils.js';
import { json, errorResponse } from '../../lib/response.js';
import { safeParseJSON, slugify, toSlug } from './pd-utils.js';

// ===================================================================
// ADMIN: List All Products (WITH PAGINATION + FILTER)
// ===================================================================
export async function listAdminProducts(req, env) {
  try {
    const url = new URL(req.url);
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'));
    const limit = Math.min(5000, Math.max(1, parseInt(url.searchParams.get('limit') || '24')));
    const offset = (page - 1) * limit;
    
    const search = (url.searchParams.get('search') || url.searchParams.get('q') || '').trim();
    const filter = (url.searchParams.get('filter') || '').trim();

    console.log('[listAdminProducts] 📄 Page:', page, 'Limit:', limit, 'Search:', search, 'Filter:', filter);

    let conditions = [];
    let queryParams = [];

    // 1. Search - Dùng search_text đã normalize
    if (search) {
      const normalizedSearch = search.toLowerCase()
        .replace(/à|á|ạ|ả|ã|â|ầ|ấ|ậ|ẩ|ấ|ă|ằ|ắ|ặ|ẳ|ẵ/g, "a")
        .replace(/è|é|ẹ|ẻ|ẽ|ê|ề|ế|ệ|ể|ễ/g, "e")
        .replace(/ì|í|ị|ỉ|ĩ/g, "i")
        .replace(/ò|ó|ọ|ỏ|õ|ô|ồ|ố|ộ|ổ|ỗ|ơ|ờ|ớ|ợ|ở|ỡ/g, "o")
        .replace(/ù|ú|ụ|ủ|ũ|ư|ừ|ứ|ự|ử|ữ/g, "u")
        .replace(/ỳ|ý|ỵ|ỷ|ỹ/g, "y")
        .replace(/đ/g, "d")
        .replace(/[^a-z0-9 ]/g, " ")
        .replace(/\s+/g, ' ')
        .trim();
      
      conditions.push(`(search_text LIKE ? OR CAST(id AS TEXT) LIKE ?)`);
      queryParams.push(`%${normalizedSearch}%`, `%${search}%`);
    }

    // 2. Filter: Uncategorized
    if (filter === 'uncategorized') {
      conditions.push(`(category_slug IS NULL OR category_slug = '')`);
    }

    // 3. Filter: Missing Price
    if (filter === 'missing_price') {
       conditions.push(`(
         id IN (SELECT product_id FROM variants GROUP BY product_id HAVING MAX(price) = 0 OR MAX(price) IS NULL)
         OR 
         (stock > 0 AND NOT EXISTS (SELECT 1 FROM variants WHERE product_id = products.id))
       )`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Query stats
    const statsResult = await env.DB.prepare(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN stock > 0 THEN 1 ELSE 0 END) as in_stock,
        SUM(CASE WHEN stock = 0 THEN 1 ELSE 0 END) as out_of_stock
      FROM products ${whereClause}
    `).bind(...queryParams).first();

    const total = statsResult?.total || 0;
    const totalPages = Math.ceil(total / limit);

    // Query products + variants
    let productsQuery = '';
    let productsQueryParams = [];
    
    if (whereClause) {
      productsQuery = `
        SELECT p.id, p.title, p.slug, p.shortDesc, p.category_slug, p.images, p.status, p.on_website, p.on_mini,
          p.sold, p.rating, p.rating_count, p.stock, p.created_at, p.updated_at,
          v.id as variant_id, v.sku as variant_sku, v.name as variant_name, v.price as variant_price,
          v.price_sale as variant_price_sale, v.price_wholesale as variant_price_wholesale, v.cost_price as variant_cost_price,
          v.stock as variant_stock, v.weight as variant_weight, v.status as variant_status, v.image as variant_image
        FROM products p
        LEFT JOIN variants v ON p.id = v.product_id
        WHERE p.id IN (SELECT p2.id FROM products p2 ${whereClause.replace(/\bproducts\./g, 'p2.')} ORDER BY p2.created_at DESC LIMIT ? OFFSET ?)
        ORDER BY p.created_at DESC, v.id ASC
      `;
      productsQueryParams = [...queryParams, limit, offset];
    } else {
      productsQuery = `
        SELECT p.id, p.title, p.slug, p.shortDesc, p.category_slug, p.images, p.status, p.on_website, p.on_mini,
          p.sold, p.rating, p.rating_count, p.stock, p.created_at, p.updated_at,
          v.id as variant_id, v.sku as variant_sku, v.name as variant_name, v.price as variant_price,
          v.price_sale as variant_price_sale, v.price_wholesale as variant_price_wholesale, v.cost_price as variant_cost_price,
          v.stock as variant_stock, v.weight as variant_weight, v.status as variant_status, v.image as variant_image
        FROM products p
        LEFT JOIN variants v ON p.id = v.product_id
        WHERE p.id IN (SELECT id FROM products ORDER BY created_at DESC LIMIT ? OFFSET ?)
        ORDER BY p.created_at DESC, v.id ASC
      `;
      productsQueryParams = [limit, offset];
    }
    
    const productsResult = await env.DB.prepare(productsQuery).bind(...productsQueryParams).all();
    const rows = productsResult.results || [];

    // Group rows
    const productsMap = new Map();
    rows.forEach(row => {
      if (!productsMap.has(row.id)) {
        productsMap.set(row.id, {
          id: row.id,
          title: row.title,
          slug: row.slug,
          shortDesc: row.shortDesc || '',
          category_slug: row.category_slug || '',
          images: row.images ? safeParseJSON(row.images, []) : [],
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
      if (row.variant_id) {
        productsMap.get(row.id).variants.push({
          id: row.variant_id,
          sku: row.variant_sku,
          name: row.variant_name,
          price: row.variant_price,
          price_sale: row.variant_price_sale,
          price_wholesale: row.variant_price_wholesale,
          cost_price: row.variant_cost_price,
          stock: row.variant_stock,
          weight: row.variant_weight,
          status: row.variant_status,
          image: row.variant_image
        });
      }
    });

    return json({ 
      ok: true, items: Array.from(productsMap.values()),
      pagination: { page, limit, total, totalPages, hasNext: page < totalPages, hasPrev: page > 1 },
      stats: { total: statsResult?.total || 0, in_stock: statsResult?.in_stock || 0, out_of_stock: statsResult?.out_of_stock || 0 },
      search: search || null
    }, {}, req);
  } catch (e) {
    console.error('[listAdminProducts] ❌ Error:', e);
    return errorResponse(e, 500, req);
  }
}

// ===================================================================
// ADMIN: Get Single Product (For Edit)
// ===================================================================
export async function getAdminProduct(req, env) {
  const url = new URL(req.url);
  const id = url.searchParams.get('id');
  const slug = url.searchParams.get('slug');

  if (!id && !slug) return errorResponse('Missing id or slug', 400, req);

  try {
    let productResult;
    if (id) {
      productResult = await env.DB.prepare(`SELECT * FROM products WHERE id = ?`).bind(id).first();
    } else {
      productResult = await env.DB.prepare(`SELECT * FROM products WHERE slug = ?`).bind(slug).first();
    }

    if (!productResult) return json({ ok: false, error: 'Product not found' }, { status: 404 }, req);

    const product = {
      ...productResult,
      images: safeParseJSON(productResult.images, []),
      keywords: safeParseJSON(productResult.keywords, []),
      faq: safeParseJSON(productResult.faq, []),
      reviews: safeParseJSON(productResult.reviews, [])
    };

    const variantsResult = await env.DB.prepare(`SELECT * FROM variants WHERE product_id = ? ORDER BY id ASC`).bind(product.id).all();
    product.variants = variantsResult.results || [];

    return json({ ok: true, data: product }, {}, req);
  } catch (e) {
    console.error('[getAdminProduct] ❌ Error:', e);
    return errorResponse(e, 500, req);
  }
}

// ===================================================================
// ADMIN: Upsert Product (Create/Update)
// ===================================================================
export async function upsertProduct(req, env) {
  if (!(await adminOK(req, env))) return errorResponse('Unauthorized', 401, req);

  try {
    const incoming = await readBody(req) || {};
    const now = Date.now();
    let productId = incoming.id ? Number(incoming.id) : null;
    
    let old = null;
    if (productId) {
      old = await env.DB.prepare(`SELECT * FROM products WHERE id = ?`).bind(productId).first();
    }

    if (!incoming.slug && (incoming.title || incoming.name)) {
      incoming.slug = slugify(incoming.title || incoming.name);
    }
    if (!incoming.category_slug && incoming.category) {
      incoming.category_slug = toSlug(incoming.category);
    }

    const productData = {
      title: incoming.title || incoming.name || 'Untitled',
      slug: incoming.slug || slugify(incoming.title || incoming.name || 'untitled'),
      shortDesc: incoming.shortDesc || incoming.short_description || '',
      desc: incoming.desc || incoming.description || '',
      category_slug: incoming.category_slug || null,
      seo_title: incoming.seo_title || null,
      seo_desc: incoming.seo_desc || null,
      brand: incoming.brand || '',
      tags: incoming.tags ? JSON.stringify(incoming.tags) : '[]',
      search_text: buildSearchText({
        title: incoming.title || incoming.name,
        brand: incoming.brand,
        tags: incoming.tags,
        category_slug: incoming.category_slug
      }),
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

    if (old) {
      await env.DB.prepare(`
        UPDATE products SET
          title = ?, slug = ?, shortDesc = ?, desc = ?,
          category_slug = ?, seo_title = ?, seo_desc = ?,
          brand = ?, tags = ?, search_text = ?,
          keywords = ?, faq = ?, reviews = ?,
          images = ?, video = ?, status = ?,
          on_website = ?, on_mini = ?, updated_at = ?
        WHERE id = ?
      `).bind(
        productData.title, productData.slug, productData.shortDesc, productData.desc,
        productData.category_slug, productData.seo_title, productData.seo_desc,
        productData.brand, productData.tags, productData.search_text,
        productData.keywords, productData.faq, productData.reviews,
        productData.images, productData.video, productData.status,
        productData.on_website, productData.on_mini, productData.updated_at,
        productId
      ).run();
    } else {
      const result = await env.DB.prepare(`
        INSERT INTO products (
          title, slug, shortDesc, desc, category_slug,
          seo_title, seo_desc, brand, tags, search_text,
          keywords, faq, reviews, images, video, status, on_website, on_mini,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        RETURNING id
      `).bind(
        productData.title, productData.slug, productData.shortDesc, productData.desc,
        productData.category_slug, productData.seo_title, productData.seo_desc,
        productData.brand, productData.tags, productData.search_text,
        productData.keywords, productData.faq, productData.reviews,
        productData.images, productData.video, productData.status,
        productData.on_website, productData.on_mini,
        productData.created_at, productData.updated_at
      ).first();
      productId = result.id;
    }

    const incomingVariants = Array.isArray(incoming.variants) ? incoming.variants : [];
    if (incomingVariants.length > 0) {
      const existingVariants = await env.DB.prepare(`SELECT * FROM variants WHERE product_id = ?`).bind(productId).all();
      const existingMapBySKU = new Map();
      const existingMapByID = new Map();
      (existingVariants.results || []).forEach(v => {
        if (v.sku) existingMapBySKU.set(v.sku, v);
        existingMapByID.set(v.id, v);
      });

      for (const v of incomingVariants) {
        const incomingSKU = v.sku || `SKU-${productId}-${Date.now()}`;
        let oldVariant = null;
        if (v.id) oldVariant = existingMapByID.get(Number(v.id));
        if (!oldVariant && incomingSKU) oldVariant = existingMapBySKU.get(incomingSKU);

        const variantData = {
          product_id: productId,
          sku: incomingSKU,
          name: v.name || v.title || 'Default',
          price: Number(v.price || 0),
          price_sale: v.price_sale ? Number(v.price_sale) : null,
          price_wholesale: v.price_wholesale ? Number(v.price_wholesale) : null,
          cost_price: (v.cost !== undefined) ? Number(v.cost) : (v.cost_price ? Number(v.cost_price) : null),
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
    }

    const stockResult = await env.DB.prepare(`SELECT COALESCE(SUM(stock), 0) as total_stock FROM variants WHERE product_id = ?`).bind(productId).first();
    const totalStock = stockResult?.total_stock || 0;
    await env.DB.prepare(`UPDATE products SET stock = ?, updated_at = ? WHERE id = ?`).bind(totalStock, now, productId).run();
    
    await invalidateProductCache(env, productId);

    const saved = await env.DB.prepare(`SELECT * FROM products WHERE id = ?`).bind(productId).first();
    const savedVariants = await env.DB.prepare(`SELECT * FROM variants WHERE product_id = ?`).bind(productId).all();
    
    const result = {
      ...saved,
      id: productId,
      images: safeParseJSON(saved.images, []),
      keywords: safeParseJSON(saved.keywords, []),
      faq: safeParseJSON(saved.faq, []),
      reviews: safeParseJSON(saved.reviews, []),
      variants: savedVariants.results || []
    };

    return json({ ok: true, data: result }, {}, req);
  } catch (e) {
    console.error('❌ Save error (D1 upsert):', e);
    return errorResponse(e, 500, req);
  }
}

// ===================================================================
// ADMIN: Delete Product
// ===================================================================
export async function deleteProduct(req, env) {
  if (!(await adminOK(req, env))) return errorResponse('Unauthorized', 401, req);

  try {
    const body = await readBody(req) || {};
    const id = body.id;
    if (!id) return errorResponse('Product ID required', 400, req);

    const product = await env.DB.prepare(`SELECT id FROM products WHERE id = ?`).bind(id).first();
    if (!product) return errorResponse('Product not found', 404, req);

    await env.DB.prepare(`DELETE FROM products WHERE id = ?`).bind(id).run();
    return json({ ok: true, deleted: id }, {}, req);
  } catch (e) {
    console.error('❌ Delete error:', e);
    return errorResponse(e, 500, req);
  }
}

// ===================================================================
// ADMIN: Batch Get Products
// ===================================================================
export async function getProductsBatch(req, env) {
  try {
    const body = await readBody(req) || {};
    const productIds = body.product_ids || body.ids || [];
    if (!Array.isArray(productIds) || productIds.length === 0) return json({ ok: false, error: 'product_ids required' }, { status: 400 }, req);

    const ids = productIds.slice(0, 100);
    const placeholders = ids.map(() => '?').join(',');
    const productsResult = await env.DB.prepare(`SELECT * FROM products WHERE id IN (${placeholders})`).bind(...ids).all();
    const products = productsResult.results || [];

    let variantsResult = { results: [] };
    if (ids.length > 0) {
      variantsResult = await env.DB.prepare(`SELECT * FROM variants WHERE product_id IN (${placeholders}) ORDER BY product_id, id ASC`).bind(...ids).all();
    }

    const variantsByProduct = {};
    (variantsResult.results || []).forEach(v => {
      if (!variantsByProduct[v.product_id]) variantsByProduct[v.product_id] = [];
      variantsByProduct[v.product_id].push(v);
    });

    const items = products.map(p => ({
      ...p,
      images: safeParseJSON(p.images, []),
      keywords: safeParseJSON(p.keywords, []),
      faq: safeParseJSON(p.faq, []),
      reviews: safeParseJSON(p.reviews, []),
      variants: variantsByProduct[p.id] || []
    }));

    return json({ ok: true, items, count: items.length }, {}, req);
  } catch (e) {
    console.error('[getProductsBatch] ❌ Error:', e);
    return errorResponse(e, 500, req);
  }
}

// ===================================================================
// ADMIN: List All Products with Variants (Stats)
// ===================================================================
export async function listAllProductsWithVariants(req, env) {
  try {
    const result = await env.DB.prepare(`
      SELECT p.id, p.title, p.slug, p.shortDesc, p.desc, p.category_slug, p.images, p.status, p.on_website, p.on_mini, p.sold, p.rating, p.stock, p.created_at, p.updated_at,
        v.id as variant_id, v.sku as variant_sku, v.name as variant_name, v.price as variant_price, v.price_sale as variant_price_sale, v.stock as variant_stock, v.image as variant_image
      FROM products p
      LEFT JOIN variants v ON p.id = v.product_id
      ORDER BY p.created_at DESC, v.id ASC
    `).all();

    const rows = result.results || [];
    const productsMap = new Map();
    
    rows.forEach(row => {
      if (!productsMap.has(row.id)) {
        productsMap.set(row.id, {
          id: row.id, title: row.title, slug: row.slug, category_slug: row.category_slug || '',
          images: row.images ? JSON.parse(row.images) : [], status: row.status || 'active',
          sold: row.sold || 0, stock: row.stock || 0, variants: []
        });
      }
      if (row.variant_id) {
        productsMap.get(row.id).variants.push({
          id: row.variant_id, sku: row.variant_sku, name: row.variant_name,
          price: row.variant_price, price_sale: row.variant_price_sale, stock: row.variant_stock
        });
      }
    });

    const items = Array.from(productsMap.values());
    return json({ ok: true, items, total: items.length, has_variants: true }, {}, req);
  } catch (e) {
    console.error('[listAllProductsWithVariants] ❌ Error:', e);
    return errorResponse(e, 500, req);
  }
}

// ===================================================================
// ADMIN: Sync Search Text
// ===================================================================
export async function syncSearchText(req, env) {
  try {
    console.log('[SYNC] 🚀 Starting search_text sync...');
    const products = await env.DB.prepare(`SELECT * FROM products`).all();
    const all = products.results || [];
    let count = 0;

    for (const p of all) {
      const variants = await env.DB.prepare(`SELECT sku FROM variants WHERE product_id = ?`).bind(p.id).all();
      const productObj = { ...p, variants: variants.results || [] };
      const newSearchText = buildSearchText(productObj);
      await env.DB.prepare(`UPDATE products SET search_text = ? WHERE id = ?`).bind(newSearchText, p.id).run();
      count++;
    }
    return json({ ok: true, message: `Synced ${count} products` }, {}, req);
  } catch (e) {
    console.error('[SYNC ERROR]', e);
    return errorResponse(e, 500, req);
  }
}