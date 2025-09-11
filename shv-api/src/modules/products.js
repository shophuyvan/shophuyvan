
// shv-api: src/modules/products.js (v7.1)
/**
 * Cloudflare Worker module for Products using KV (PRODUCTS_KV)
 * Exports:
 *   - listProducts(req, env)
 *   - getProduct(req, env, id)
 *   - upsertProduct(req, env)
 */

const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store"
};

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: JSON_HEADERS });

// ---------- helpers ----------

function ensureArray(v) {
  if (!v) return [];
  if (Array.isArray(v)) return v.filter(Boolean);
  if (typeof v === "string") {
    return v.split(",").map(s => s.trim()).filter(Boolean);
  }
  return [];
}

function safeId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function pickThumb(images) {
  const arr = ensureArray(images);
  if (!arr.length) return null;
  const url = arr[0];
  try {
    // Cloudinary transform for fast thumbnail, else return original
    if (url.includes("/image/upload/")) {
      return url.replace("/image/upload/", "/image/upload/w_240,q_auto,f_auto/");
    }
  } catch {}
  return url;
}

function normVariants(input) {
  // Accepts array of objects or CSV-ish string -> array of {name, price, sku, stock, sale_price, weight, image}
  if (!input) return [];
  if (typeof input === "string") {
    // Expecting JSON string or CSV list "name|price|sku|stock"
    try {
      const parsed = JSON.parse(input);
      if (Array.isArray(parsed)) return parsed;
    } catch {}
    return input.split("\n").map(row => {
      const [name, price, sku, stock] = row.split("|").map(s => (s || "").trim());
      if (!name) return null;
      return { name, price: Number(price) || 0, sku: sku || "", stock: Number(stock) || 0 };
    }).filter(Boolean);
  }
  if (Array.isArray(input)) return input;
  return [];
}

const COL = "product"; // KV key prefix: product:<id>

async function getKV(env) {
  if (!env || !env.PRODUCTS_KV) throw new Error("Missing binding PRODUCTS_KV");
  return env.PRODUCTS_KV;
}

async function getById(kv, id) {
  const key = `${COL}:${id}`;
  const v = await kv.get(key);
  if (!v) return null;
  try { return JSON.parse(v); } catch { return null; }
}

async function putWithMeta(kv, id, obj) {
  const key = `${COL}:${id}`;
  const meta = {
    id,
    title: obj.title || obj.name || "",
    price: Number(obj.price) || 0,
    sale_price: Number(obj.sale_price) || 0,
    is_active: !!obj.is_active,
    thumb: pickThumb(obj.images),
    updated_at: obj.updated_at || new Date().toISOString()
  };
  await kv.put(key, JSON.stringify(obj), { metadata: meta });
  return meta;
}

// ---------- handlers ----------

export async function listProducts(req, env) {
  try {
    const kv = await getKV(env);
    const url = new URL(req.url);
    const limit = Math.min(Number(url.searchParams.get("limit")) || 50, 200);
    const cursor = url.searchParams.get("cursor") || undefined;
    const activeFilter = url.searchParams.get("active"); // "1" to filter active only

    const r = await kv.list({ prefix: `${COL}:`, cursor, limit });
    const items = (r.keys || []).map(k => {
      const m = k.metadata || {};
      return {
        id: m.id || k.name.replace(`${COL}:`, ""),
        title: m.title || "",
        price: m.price || 0,
        sale_price: m.sale_price || 0,
        is_active: !!m.is_active,
        thumb: m.thumb || null,
        updated_at: m.updated_at || null
      };
    });

    const filtered = (activeFilter === "1")
      ? items.filter(it => it.is_active)
      : items;

    return json({ items: filtered, cursor: r.cursor || null, list_complete: r.list_complete === true });
  } catch (err) {
    return json({ error: String(err && err.message || err) }, 500);
  }
}

export async function getProduct(req, env, id) {
  try {
    const kv = await getKV(env);
    const data = await getById(kv, id);
    if (!data) return json({ error: "Not found" }, 404);
    return json({ item: data });
  } catch (err) {
    return json({ error: String(err && err.message || err) }, 500);
  }
}

export async function upsertProduct(req, env) {
  try {
    const kv = await getKV(env);
    const body = await req.json();

    const nowISO = new Date().toISOString();
    const id = body.id || safeId();
    const existing = await getById(kv, id) || {};

    // Preserve long arrays unless explicitly provided
    const images  = body.images  !== undefined ? ensureArray(body.images)  : ensureArray(existing.images);
    const videos  = body.videos  !== undefined ? ensureArray(body.videos)  : ensureArray(existing.videos);
    const alts    = body.image_alts !== undefined ? ensureArray(body.image_alts) : ensureArray(existing.image_alts);
    const faq     = body.faq     !== undefined ? (Array.isArray(body.faq) ? body.faq : existing.faq || []) : (existing.faq || []);
    const reviews = body.reviews !== undefined ? (Array.isArray(body.reviews) ? body.reviews : existing.reviews || []) : (existing.reviews || []);
    const variants = body.variants !== undefined ? normVariants(body.variants) : (existing.variants || []);

    const merged = {
      // base
      id,
      title: body.title ?? existing.title ?? "",
      name: body.name ?? existing.name ?? "",
      description: body.description ?? existing.description ?? "",
      seo_title: body.seo_title ?? existing.seo_title ?? "",
      seo_description: body.seo_description ?? existing.seo_description ?? "",
      seo_keywords: ensureArray(body.seo_keywords ?? existing.seo_keywords),
      category: body.category ?? existing.category ?? "default",

      // numbers
      price: Number(body.price ?? existing.price ?? 0),
      sale_price: Number(body.sale_price ?? existing.sale_price ?? 0),
      stock: Number(body.stock ?? existing.stock ?? 0),
      weight: Number(body.weight ?? existing.weight ?? 0),

      // states
      is_active: (body.is_active !== undefined ? !!body.is_active : (existing.is_active !== undefined ? !!existing.is_active : true)),

      // media & structured
      images,
      videos,
      image_alts: alts,
      faq,
      reviews,
      variants,

      // bookkeeping
      created_at: existing.created_at || nowISO,
      updated_at: nowISO
    };

    await putWithMeta(kv, id, merged);
    return json({ ok: true, id, updated_at: merged.updated_at });
  } catch (err) {
    return json({ error: String(err && err.message || err) }, 500);
  }
}
