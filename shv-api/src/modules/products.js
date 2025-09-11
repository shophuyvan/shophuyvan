
// shv-api/src/modules/products.js (v6.3)
// - Upsert merge so fields (variants, images, videos, description, SEO, FAQ, reviews) không bị mất
// - KV metadata để list nhanh (thumb, title, active, updated_at)
// - Public list/get routes dùng JSON helpers (export tại index router)

export function json(body, status=200, headers={}){
  return new Response(JSON.stringify(body), { status, headers: { "content-type":"application/json; charset=utf-8", ...headers }});
}
function toArrCSV(x){
  if (!x) return [];
  if (Array.isArray(x)) return x.map(s => (typeof s === "string" ? s.trim() : s)).filter(Boolean);
  if (typeof x === "string") return x.split(",").map(s => s.trim()).filter(Boolean);
  return [];
}
function normVariants(arr){
  if (!Array.isArray(arr)) return [];
  return arr.map(v => ({
    image: String(v.image||"").trim(),
    name: String(v.name||"").trim(),
    sku: String(v.sku||"").trim(),
    stock: Number(v.stock||0),
    weight_grams: Number(v.weight_grams||0),
    price: Number(v.price||0),
    sale_price: (v.sale_price===undefined || v.sale_price===null || String(v.sale_price).trim?.()==="") ? null : Number(v.sale_price)
  })).filter(v => v.name);
}

async function putWithMeta(kv, key, data){
  const updated_at = data.updated_at || new Date().toISOString();
  const thumb = (Array.isArray(data.images) && data.images[0] ? data.images[0] : "").replace("/upload/","/upload/w_240,f_auto,q_auto/");
  const meta = { id: data.id, title: data.title||"", price: Number(data.price||0), sale_price: data.sale_price ?? null, is_active: !!data.is_active, thumb, updated_at };
  await kv.put(key, JSON.stringify({ ...data, updated_at }), { metadata: meta });
}

export async function listProducts(req, env){
  const url = new URL(req.url);
  const limit  = Math.min(Number(url.searchParams.get("limit")) || 50, 200);
  const cursor = url.searchParams.get("cursor") || null;
  const activeOnly = url.searchParams.get("active") === "1";

  const r = await env.PRODUCTS_KV.list({ prefix: "products:", cursor, limit });
  let items = r.keys.map(k => k.metadata).filter(Boolean);
  if (activeOnly) items = items.filter(m => !!m.is_active);
  items.sort((a,b) => String(b.updated_at||"").localeCompare(String(a.updated_at||"")));
  return json({ items, cursor: r.list_complete ? null : r.cursor });
}

export async function getProduct(req, env, id){
  const v = await env.PRODUCTS_KV.get(`products:${id}`);
  if (!v) return json({ error: "not_found" }, 404);
  return json(JSON.parse(v));
}

export async function upsertProduct(req, env){
  let body = {};
  try{ body = await req.json(); }catch{}
  const id = String(body.id || body.slug || body.title || "").trim().toLowerCase().replace(/\s+/g,"-").replace(/[^a-z0-9\-]/g,"").slice(0,80) || crypto.randomUUID();
  const kv = env.PRODUCTS_KV;

  // Read existing to MERGE
  let existing = {};
  try{
    const cur = await kv.get(`products:${id}`);
    existing = cur ? JSON.parse(cur) : {};
  }catch{ existing = {}; }

  // Normalize incoming
  const incoming = {
    id,
    title: String(body.title || existing.title || "").trim(),
    description: typeof body.description === "string" ? body.description : (existing.description || ""),
    images: toArrCSV(body.images?.length ? body.images : existing.images),
    videos: toArrCSV(body.videos?.length ? body.videos : existing.videos),
    image_alts: toArrCSV(body.image_alts?.length ? body.image_alts : existing.image_alts),
    price: Number(body.price ?? existing.price ?? 0),
    sale_price: (body.sale_price===undefined ? existing.sale_price : (body.sale_price===""? null : Number(body.sale_price))),
    stock: Number(body.stock ?? existing.stock ?? 0),
    is_active: (body.is_active!==undefined ? !!body.is_active : !!existing.is_active),
    category: body.category || existing.category || "default",
    weight_grams: Number(body.weight_grams ?? existing.weight_grams ?? 0),
    seo_title: (body.seo_title!==undefined ? body.seo_title : existing.seo_title || ""),
    seo_description: (body.seo_description!==undefined ? body.seo_description : existing.seo_description || ""),
    seo_keywords: (body.seo_keywords!==undefined ? body.seo_keywords : existing.seo_keywords || ""),
    faq: Array.isArray(body.faq) ? body.faq : (existing.faq||[]),
    reviews: Array.isArray(body.reviews) ? body.reviews : (existing.reviews||[]),
    variants: normVariants(body.variants && body.variants.length ? body.variants : (existing.variants || [])),
  };

  await putWithMeta(kv, `products:${id}`, incoming);
  return json({ ok: true, id });
}
