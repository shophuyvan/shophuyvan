/* SHV safe patch header */

// src/modules/products.js
// v7.2-compat — exposes handleProducts() so index.js can keep `import { handleProducts } ...`

/**
 * Utilities
 */
const json = (data, init = {}) =>
  new Response(JSON.stringify(data), {
    headers: { "content-type": "application/json; charset=utf-8" },
    ...init,
  });

const notFound = (msg = "Not found") => json({ error: msg }, { status: 404 });
const badReq = (msg = "Bad request") => json({ error: msg }, { status: 400 });
const unauthorized = () => json({ error: "Unauthorized" }, { status: 401 });

/**
 * Very lightweight “DB” on Cloudflare KV with a memory fallback.
 * KV key format: products:<id>
 */
export class Fire {
  constructor(env) {
    this.env = env || {};
    if (!globalThis.__MEM_STORE) globalThis.__MEM_STORE = new Map();
    this.mem = globalThis.__MEM_STORE;
  }
  _key(col, id) {
    return `${col}:${id}`;
  }
  async _kv() {
    return this.env.PRODUCTS_KV || null;
  }
  async get(col, id) {
    const kv = await this._kv();
    if (kv) {
      const v = await kv.get(this._key(col, id));
      return v ? JSON.parse(v) : null;
    }
    return this.mem.get(this._key(col, id)) || null;
  }
  async set(col, id, data) {
    const doc = { ...(data || {}), id };
    const kv = await this._kv();
    if (kv) {
      await kv.put(this._key(col, id), JSON.stringify(doc));
      return doc;
    }
    this.mem.set(this._key(col, id), doc);
    return doc;
  }
  async remove(col, id) {
    const kv = await this._kv();
    if (kv) {
      await kv.delete(this._key(col, id));
      return { ok: true };
    }
    this.mem.delete(this._key(col, id));
    return { ok: true };
  }
  async list(col, params = {}) {
    const kv = await this._kv();
    const limit = Math.min(Number(params.limit) || 50, 200);

    let items = [];
    if (kv) {
      let cursor;
      const keys = [];
      do {
        const r = await kv.list({ prefix: `${col}:`, cursor });
        r.keys.forEach((k) => keys.push(k.name));
        cursor = r.list_complete ? null : r.cursor;
      } while (cursor);
      for (const k of keys) {
        const v = await kv.get(k);
        if (v) items.push(JSON.parse(v));
      }
    } else {
      for (const [k, v] of this.mem.entries())
        if (k.startsWith(`${col}:`)) items.push(v);
    }

    // Optional filter by is_active
    if (params.onlyActive) items = items.filter((p) => !!p.is_active);

    // Sort by created_at desc
    items.sort((a, b) =>
      String(b.created_at || "").localeCompare(String(a.created_at || ""))
    );

    // Simple slice pagination
    const start = 0;
    return { items: items.slice(start, start + limit) };
  }
}

/**
 * Core actions used by admin & storefront
 */
export async function listProducts(env, query) {
  const store = new Fire(env);
  const onlyActive = query.get("active") === "1";
  const limit = query.get("limit") || "50";
  return store.list("products", { limit, onlyActive });
}

export async function getProduct(env, id) {
  const store = new Fire(env);
  const doc = await store.get("products", id);
  if (!doc) return null;
  return doc;
}

export async function upsertProduct(env, data) {
  if (!data || !data.id) return null;

  const store = new Fire(env);
  const now = new Date().toISOString();

  const prev = (await store.get("products", data.id)) || {};
  const merged = {
    ...prev,
    ...data,
    id: data.id,
    created_at: prev.created_at || now,
    updated_at: now,
  };

  await store.set("products", data.id, merged);
  return merged;
}

export async function deleteProduct(env, id) {
  const store = new Fire(env);
  await store.remove("products", id);
  return { ok: true };
}

/**
 * 👇 Compatibility handler so `import { handleProducts }` keeps working.
 * Supports:
 *  - GET    /admin/products?limit=...
 *  - GET    /admin/products/:id
 *  - POST   /admin/products        (JSON body)
 *  - PUT    /admin/products        (JSON body)
 *  - DELETE /admin/products/:id
 */
export async function handleProducts(request, env) {
  // Optional admin token check (only if ADMIN_TOKEN is set in env)
  const url = new URL(request.url);
  const pathname = url.pathname;

  const respond = (data, status = 200) =>
    json(data, { status, headers: { "access-control-allow-origin": "*" } });

  try {
    // GET list
    if (request.method === "GET" && pathname.endsWith("/admin/products")) {
      const data = await listProducts(env, url.searchParams);
      return respond(data);
    }

    // GET one
    const reGetOne = /\/admin\/products\/([^/]+)$/;
    if (request.method === "GET" && reGetOne.test(pathname)) {
      const id = pathname.match(reGetOne)[1];
      const doc = await getProduct(env, id);
      if (!doc) return notFound();
      return respond(doc);
    }

    // CREATE/UPDATE
    if (
      (request.method === "POST" || request.method === "PUT") &&
      pathname.endsWith("/admin/products")
    ) {
      const payload = await request.json().catch(() => null);
      if (!payload || !payload.id) return badReq("missing id");
      const saved = await upsertProduct(env, payload);
      return respond(saved, 201);
    }

    // DELETE
    if (request.method === "DELETE" && reGetOne.test(pathname)) {
      const id = pathname.match(reGetOne)[1];
      const r = await deleteProduct(env, id);
      return respond(r);
    }

    return notFound("Unsupported route");
  } catch (err) {
    return json({ error: String(err && err.message || err) }, { status: 500 });
  }
}
