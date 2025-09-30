
// Minimal Cloudflare Worker API for Orders & Admin list
// Routes implemented:
// - OPTIONS /* CORS
// - GET /api/orders?limit=
// - POST /api/orders
// - GET /admin/orders?limit=
// - POST /admin/shipping/quote  (stub)
// - POST /admin/shipping/create (stub)

const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "*",
  "access-control-allow-methods": "GET,POST,OPTIONS",
};

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...JSON_HEADERS, ...headers },
  });
}

function badRequest(message, details = {}) {
  return json({ ok: false, error: "BAD_REQUEST", message, details }, 400);
}

async function readJson(req) {
  try {
    return await req.json();
  } catch (e) {
    throw new Error("Invalid JSON body");
  }
}

function genId() {
  // UUID without hyphens for compactness
  if (crypto && crypto.randomUUID) return crypto.randomUUID().replace(/-/g, "");
  const buf = new Uint8Array(16);
  crypto.getRandomValues(buf);
  return Array.from(buf, b => b.toString(16).padStart(2, "0")).join("");
}

function nowISO() { return new Date().toISOString(); }

async function listOrdersKV(env, limit = 20) {
  const prefix = "orders:";
  const keys = await env.SHV.list({ prefix, limit });
  const rows = [];
  for (const k of keys.keys) {
    const v = await env.SHV.get(k.name, "json");
    if (v) rows.push(v);
  }
  // sort newest first by created_at if present
  rows.sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""));
  return rows;
}

function validateOrder(o) {
  const errs = [];
  if (!o || typeof o !== "object") return ["Body must be a JSON object"];
  const { name, phone, address, province_code, district_code, commune_code, items } = o;

  if (!name || String(name).trim().length < 2) errs.push("name is required");
  if (!phone || !/^\d{8,15}$/.test(String(phone).replace(/\D/g, ""))) errs.push("phone is invalid");
  if (!address || String(address).trim().length < 3) errs.push("address is required");

  for (const [code, label] of [
    ["province_code", "province_code"],
    ["district_code", "district_code"],
    ["commune_code", "commune_code"],
  ]) {
    if (!o[code]) errs.push(`${label} is required`);
  }

  if (!Array.isArray(items) || items.length < 1) {
    errs.push("items must be a non-empty array");
  } else {
    items.forEach((it, idx) => {
      if (!it?.name) errs.push(`items[${idx}].name is required`);
      // weight in grams optional but recommended
      if (it?.weight_grams != null && Number(it.weight_grams) < 0) errs.push(`items[${idx}].weight_grams must be >= 0`);
      if (it?.qty != null && Number(it.qty) <= 0) errs.push(`items[${idx}].qty must be > 0`);
    });
  }

  return errs;
}

async function handleApiOrdersGET(url, env) {
  const limit = Math.max(1, Math.min(100, Number(url.searchParams.get("limit") || 20)));
  const data = await listOrdersKV(env, limit);
  return json({ ok: true, data });
}

async function handleApiOrdersPOST(req, env) {
  const body = await readJson(req);
  const errors = validateOrder(body);
  if (errors.length) return badRequest("Invalid order", { errors });

  const id = genId();
  const order = {
    id,
    status: "confirmed",
    created_at: nowISO(),
    ...body,
  };

  await env.SHV.put(`orders:${id}`, JSON.stringify(order));
  return json({ ok: true, order_id: id, data: order });
}

async function handleAdminOrdersGET(url, env) {
  return handleApiOrdersGET(url, env);
}

async function async function handleAdminShippingQuotePOST(req) {
  // For now return stub quote
  const body = await readJson(req).catch(() => ({}));
  const { provider = "stub" } = body;
  return json({ ok: true, provider, fee: 15000, eta: "1-3 ngày" });
}

async function 
async function handleAdminShippingCreatePOST(req) {
  var body = await readJson(req).catch(function(){ return {}; });
  // Normalize sender/receiver fields and map to codes expected by providers
  function val(v){ return (v==null?'':(typeof v==='string'?v:String(v))); }
  var sender = body.sender || {};
  var receiver = body.receiver || {};
  // Support flat payload (sender_* keys)
  var s = {
    name: val(sender.name || body.sender_name),
    phone: val(sender.phone || body.sender_phone),
    address: val(sender.address || body.sender_address),
    province_code: val(sender.province_code || body.sender_province_code || body.from_province_code),
    district_code: val(sender.district_code || body.sender_district_code || body.from_district_code),
    ward_code: val(sender.ward_code || body.sender_commune_code || body.from_commune_code)
  };
  var r = {
    name: val(receiver.name || body.receiver_name),
    phone: val(receiver.phone || body.receiver_phone),
    address: val(receiver.address || body.receiver_address || body.address),
    province_code: val(receiver.province_code || body.receiver_province_code || body.to_province_code || body.province_code),
    district_code: val(receiver.district_code || body.receiver_district_code || body.to_district_code || body.district_code),
    ward_code: val(receiver.ward_code || body.receiver_commune_code || body.to_commune_code || body.commune_code)
  };
  var errs = [];
  ['name','phone','address','province_code','district_code','ward_code'].forEach(function(k){ if(!s[k]) errs.push('sender.'+k+' is required');});
  ['name','phone','address','province_code','district_code','ward_code'].forEach(function(k){ if(!r[k]) errs.push('receiver.'+k+' is required');});
  var items = Array.isArray(body.items)? body.items : [];
  if(!items.length) errs.push('items must not be empty');
  if(errs.length){
    return json({ ok:false, error:'CREATE_FAILED', raw:{ error:true, message:'Missing fields', errors:errs }}, 400);
  }
  // Simulate provider mapping and success payload
  var provider = String(body.provider||'super').toLowerCase();
  var tracking = (provider==='jt'?'JT':'SPX') + Math.random().toString(36).slice(2,10).toUpperCase();
  var fee = Number(body.cod || 0) > 0 ? 15000 : 12000;
  var resp = {
    ok: true,
    provider: provider,
    tracking_code: tracking,
    fee: fee,
    eta: '1-3 ngày',
    mapped: {
      from_province_code: s.province_code, from_district_code: s.district_code, from_commune_code: s.ward_code,
      to_province_code: r.province_code, to_district_code: r.district_code, to_commune_code: r.ward_code
    }
  };
  return json(resp, 200);
}
}

export default {
  async fetch(req, env, ctx) {
    const url = new URL(req.url);
    const pathname = url.pathname;

    // CORS preflight
    if (req.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: JSON_HEADERS });
    }

    // Routing
    try {
      if (pathname === "/api/orders" && req.method === "GET") {
        return await handleApiOrdersGET(url, env);
      }
      if (pathname === "/api/orders" && req.method === "POST") {
        return await handleApiOrdersPOST(req, env);
      }
      if (pathname === "/admin/orders" && req.method === "GET") {
        return await handleAdminOrdersGET(url, env);
      }
      if (pathname === "/admin/shipping/quote" && req.method === "POST") {
        return await handleAdminShippingQuotePOST(req, env);
      }
      if (pathname === "/admin/shipping/create" && req.method === "POST") {
        return await handleAdminShippingCreatePOST(req, env);
      }
      return json({ ok: false, error: "NOT_FOUND", path: pathname }, 404);
    } catch (e) {
      return json({ ok: false, error: "SERVER_ERROR", message: e?.message || String(e) }, 500);
    }
  }
};
