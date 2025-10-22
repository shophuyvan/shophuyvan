// ===================================================================
// modules/categories.js - Example module đầu tiên để học cách refactor
// ===================================================================

import { json } from '../lib/response.js';
import { adminOK } from '../lib/auth.js';
import { getJSON, putJSON } from '../lib/kv.js';
import { readBody } from '../lib/utils.js';

/**
 * Main handler cho tất cả /categories routes
 */
export async function handle(req, env, ctx) {
  const url = new URL(req.url);
  const path = url.pathname;
  const method = req.method;

  // Admin: List categories
  if (path === '/admin/categories' && method === 'GET') {
    return listCategories(req, env);
  }

  // Admin: Upsert category
  if (path === '/admin/categories/upsert' && method === 'POST') {
    return upsertCategory(req, env);
  }

  // Admin: Delete category
  if (path === '/admin/categories/delete' && method === 'POST') {
    return deleteCategory(req, env);
  }

  // Public: List categories (sorted by order)
  if (path === '/public/categories' && method === 'GET') {
    return publicCategories(req, env);
  }

  // Route not found
  return json({ 
    ok: false, 
    error: 'Route not found' 
  }, { status: 404 }, req);
}

/**
 * Admin: Get all categories (unsorted)
 */
async function listCategories(req, env) {
  if (!(await adminOK(req, env))) { return json({ ok: false, error: 'Unauthorized' }, { status: 401 }, req); }
    try {
    const list = await getJSON(env, 'cats:list', []);
    return json({ ok: true, items: list }, {}, req);
  } catch (e) {
    return json({ 
      ok: false, 
      error: String(e.message) 
    }, { status: 500 }, req);
  }
}

/**
 * Admin: Create or update category
 */
async function upsertCategory(req, env) {
  // Auth check
  if (!(await adminOK(req, env))) {
    return json({ 
      ok: false, 
      error: 'Unauthorized' 
    }, { status: 401 }, req);
  }

  try {
    const body = await readBody(req) || {};
    
    // Build category object
    const category = {
      id: body.id || crypto.randomUUID(),
      name: body.name || '',
      slug: body.slug || slugify(body.name || ''),
      parent: body.parent || '',
      order: Number(body.order || 0)
    };

    // Validation
    if (!category.name) {
      return json({ 
        ok: false, 
        error: 'Name is required' 
      }, { status: 400 }, req);
    }

    // Get existing list
    const list = await getJSON(env, 'cats:list', []);
    
    // Find existing category
    const index = list.findIndex(x => x.id === category.id);
    
    if (index >= 0) {
      // Update existing
      list[index] = category;
    } else {
      // Add new
      list.push(category);
    }

    // Save to KV
    await putJSON(env, 'cats:list', list);

    return json({ 
      ok: true, 
      item: category 
    }, {}, req);

  } catch (e) {
    return json({ 
      ok: false, 
      error: String(e.message) 
    }, { status: 500 }, req);
  }
}

/**
 * Admin: Delete category by ID
 */
async function deleteCategory(req, env) {
  // Auth check
  if (!(await adminOK(req, env))) {
    return json({ 
      ok: false, 
      error: 'Unauthorized' 
    }, { status: 401 }, req);
  }

  try {
    const body = await readBody(req) || {};
    const id = body.id;

    if (!id) {
      return json({ 
        ok: false, 
        error: 'ID is required' 
      }, { status: 400 }, req);
    }

    // Get existing list
    const list = await getJSON(env, 'cats:list', []);
    
    // Filter out deleted category
    const newList = list.filter(x => x.id !== id);

    // Save to KV
    await putJSON(env, 'cats:list', newList);

    return json({ 
      ok: true, 
      deleted: id 
    }, {}, req);

  } catch (e) {
    return json({ 
      ok: false, 
      error: String(e.message) 
    }, { status: 500 }, req);
  }
}

/**
 * Public: Get categories sorted by order
 */
async function publicCategories(req, env) {
  try {
    const list = await getJSON(env, 'cats:list', []);
    
    // Sort by order field
    const sorted = list.sort((a, b) => 
      Number(a.order || 0) - Number(b.order || 0)
    );

    return json({ 
      ok: true, 
      items: sorted 
    }, {}, req);

  } catch (e) {
    return json({ 
      ok: false, 
      error: String(e.message) 
    }, { status: 500 }, req);
  }
}

/**
 * Helper: Convert string to slug
 */
function slugify(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
    .replace(/[^a-z0-9]+/g, '-')     // Replace non-alphanumeric with dash
    .replace(/(^-|-$)/g, '');        // Remove leading/trailing dashes
}