// Rewritten minimal Worker (KV-driven areas API + CORS)
// This file replaces a previously corrupted script that produced "Unexpected token ':'".
// It serves /shipping/areas/{province|district|commune} using KV namespace bindings.
// KV keys used:
//  - 'areas:provinces' => JSON array of { code, name }
//  - 'areas:districts:<provinceCode>' => JSON array of { code, name }
//  - 'areas:communes:<districtCode>' => JSON array of { code, name }
//
// Response shape: { ok: true, items: [...] }

function corsHeaders(req) {
  const origin = req.headers.get("Origin") || "*";
  const reqHdr = req.headers.get("Access-Control-Request-Headers") || "authorization,content-type,x-token,x-requested-with";
  return {
    "Access-Control-Allow-Origin": origin,
    "Vary": "Origin",
    "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
    "Access-Control-Max-Age": "86400",
    "Access-Control-Allow-Headers": reqHdr,
    "Access-Control-Expose-Headers": "x-token",
    "Access-Control-Allow-Credentials": "true",
    "Content-Type": "application/json; charset=utf-8"
  };
}

function json(data, init={}, req=null){
  const headers = init.headers || {};
  return new Response(JSON.stringify(data), { status: init.status || 200, headers: { ...headers, ...(req ? corsHeaders(req) : {}) }});
}

async function readJSONFromKV(kv, key, fallback=null) {
  const raw = await kv.get(key);
  if (!raw) return fallback;
  try { return JSON.parse(raw); } catch { return fallback; }
}

// Normalizes name fields & sorts
function normalizeItems(arr){
  if (!Array.isArray(arr)) return [];
  return arr.map(x => ({
    code: (x.code ?? x.id ?? x.value ?? "").toString(),
    name: (x.name ?? x.label ?? "").toString()
  })).filter(x => x.code && x.name)
    .sort((a,b) => a.name.localeCompare(b.name,'vi'));
}

async function handleAreas(env, url){
  const pathname = url.pathname;
  const search = url.searchParams;
  // /shipping/areas/province
  if (pathname.endsWith("/shipping/areas/province")){
    const items = normalizeItems(await readJSONFromKV(env.VANCHUYEN, "areas:provinces", []));
    return { ok:true, items };
  }
  // /shipping/areas/district?province=92
  if (pathname.endsWith("/shipping/areas/district")){
    const prov = (search.get("province") || "").trim();
    if (!prov) return { ok:false, error:"province is required", items: [] };
    const items = normalizeItems(await readJSONFromKV(env.VANCHUYEN, `areas:districts:${prov}`, []));
    return { ok:true, items };
  }
  // /shipping/areas/commune?district=916
  if (pathname.endsWith("/shipping/areas/commune")){
    const dist = (search.get("district") || "").trim();
    if (!dist) return { ok:false, error:"district is required", items: [] };
    const items = normalizeItems(await readJSONFromKV(env.VANCHUYEN, `areas:communes:${dist}`, []));
    return { ok:true, items };
  }
  return null;
}

export default {
  async fetch(req, env, ctx) {
    const url = new URL(req.url);

    // CORS preflight
    if (req.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(req) });
    }

    // Areas endpoints
    const areas = await handleAreas(env, url);
    if (areas) return json(areas, {}, req);

    // Health
    if (url.pathname === "/" || url.pathname === "/health"){
      return json({ ok:true, name:"shv-api", time: Date.now() }, {}, req);
    }

    // Default 404
    return json({ ok:false, error:"Not found", path:url.pathname }, { status:404 }, req);
  }
};
