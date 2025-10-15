// ===================================================================
// modules/products.js - Products Module (Complete)
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
  if (path === '/admin/products' && method === 'GET') {
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
 * Convert product to summary (lightweight version)
 */
function toSummary(product) {
  return {
    id: product.id,
    title: product.title || product.name || '',
    name: product.title || product.name || '',
    slug: product.slug || slugify(product.title || product.name || ''),
    sku: product.sku || '',
    price: product.price || 0,
    price_sale: product.price_sale || 0,
    stock: product.stock || 0,
    images: product.images || [],
    status: (product.status === 0 ? 0 : 1)
  };
}

/**
 * Build products list from KV
 */
async function listProducts(env) {
  // Try to get cached list first
  let list = await getJSON(env, 'products:list', null);
  if (list && list.length) return list;

  // Fallback: build from individual product keys
  const items = [];
  let cursor;

  do {
    const result = await env.SHV.list({ prefix: 'product:', cursor });
    
    for (const key of result.keys) {
      const product = await getJSON(env, key.name, null);
      if (product) {
        product.id = product.id || key.name.slice('product:'.length);
        items.push(toSummary(product));
      }
    }
    
    cursor = result.list_complete ? null : result.cursor;
  } while (cursor);

  // Cache the list
  if (items.length) {
    await putJSON(env, 'products:list', items);
  }

  return items;
}

/**
 * Category matching helper
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

  const raw = (product && product.raw) || {};
  const meta = product?.meta || raw?.meta || {};

  [product, raw, meta].forEach(obj => {
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

  return candidates.some(v => wants.includes(v));
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

    return json({ ok: true, item: product }, {}, req);
  } catch (e) {
    return errorResponse(e, 500, req);
  }
}

// ===================================================================
// PUBLIC: List Products
// ===================================================================

async function listPublicProducts(req, env) {
  try {
    const list = await listProducts(env);
    const activeProducts = list.filter(p => p.status !== 0);
    
    return json({ ok: true, items: activeProducts }, {}, req);
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

    let data = await listProducts(env);
    let items = Array.isArray(data?.items) ? data.items.slice() : 
               (Array.isArray(data) ? data.slice() : []);

    // Filter by category
    if (category) {
      items = items.filter(product => matchCategoryStrict(product, category));
    }

    // Filter active only
    items = items.filter(p => p.status !== 0);

    return json({ 
      items: items.slice(0, limit) 
    }, {}, req);
  } catch (e) {
    return errorResponse(e, 500, req);
  }
}

// ===================================================================
// ADMIN: List All Products
// ===================================================================

async function listAdminProducts(req, env) {
  if (!(await adminOK(req, env))) {
    return errorResponse('Unauthorized', 401, req);
  }

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
    const product = await readBody(req) || {};
    
    // Generate ID if not exists
    product.id = product.id || crypto.randomUUID().replace(/-/g, '');
    
    // Update timestamp
    product.updatedAt = Date.now();
    
    // Auto-generate slug if not provided
    if (!product.slug && (product.title || product.name)) {
      product.slug = slugify(product.title || product.name);
    }

    // Get current products list
    const list = await listProducts(env);
    
    // Create summary version
    const summary = toSummary(product);
    
    // Update or add to list
    const index = list.findIndex(p => p.id === product.id);
    if (index >= 0) {
      list[index] = summary;
    } else {
      list.unshift(summary);
    }

    // Save to KV
    await putJSON(env, 'products:list', list);
    await putJSON(env, 'product:' + product.id, product);
    
    // Legacy compatibility
    await putJSON(env, 'products:' + product.id, summary);

    return json({ ok: true, data: product }, {}, req);
  } catch (e) {
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
}