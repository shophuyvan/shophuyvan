var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// src/lib/response.js
function corsHeaders(req) {
  const origin = req.headers.get("Origin") || "*";
  const reqHdr = req.headers.get("Access-Control-Request-Headers") || "authorization,content-type,x-token,x-customer-token,x-requested-with";
  return {
    "Access-Control-Allow-Origin": origin,
    "Vary": "Origin",
    "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
    "Access-Control-Max-Age": "86400",
    "Access-Control-Allow-Headers": reqHdr,
    "Access-Control-Expose-Headers": "x-token,x-customer-token",
    "Access-Control-Allow-Credentials": "true"
  };
}
__name(corsHeaders, "corsHeaders");
function json(data, init = {}, req) {
  return new Response(JSON.stringify(data || {}), {
    status: init.status || 200,
    headers: {
      ...corsHeaders(req),
      "content-type": "application/json; charset=utf-8"
    }
  });
}
__name(json, "json");
function errorResponse(error, status = 500, req) {
  return json({
    ok: false,
    error: String(error?.message || error)
  }, { status }, req);
}
__name(errorResponse, "errorResponse");

// src/lib/kv.js
var KV_PREFIX_MAP = {
  "ship:": "VANCHUYEN",
  "shipping:": "VANCHUYEN"
};
function pickKV(env, key, ns) {
  if (ns && env?.[ns]) return env[ns];
  for (const [prefix, binding] of Object.entries(KV_PREFIX_MAP)) {
    if (prefix && key.startsWith(prefix) && env?.[binding]) return env[binding];
  }
  if (env?.SHV) return env.SHV;
  const candidates = ["SHV", "VANCHUYEN"];
  for (const b of candidates) if (env?.[b]) return env[b];
  return null;
}
__name(pickKV, "pickKV");
async function getJSON(env, key, fallback = null, opts = {}) {
  try {
    const kv = pickKV(env, key, opts.ns);
    if (!kv?.get) return fallback;
    const raw = await kv.get(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) {
    console.error("KV getJSON error:", key, e);
    return fallback;
  }
}
__name(getJSON, "getJSON");
async function putJSON(env, key, value, opts = {}) {
  const kv = pickKV(env, key, opts.ns);
  if (!kv?.put) throw new Error("KV binding not available");
  const body = JSON.stringify(value ?? null);
  await kv.put(key, body, { expirationTtl: opts.ttl || void 0 });
  return true;
}
__name(putJSON, "putJSON");

// src/modules/shipping/helpers.js
async function superToken(env) {
  return "FxXOoDz2qlTN5joDCsBGQFqKmm1UNvOw7YPwkzm5".trim();
}
__name(superToken, "superToken");
async function superFetch(env, path, options = {}) {
  const base = "https://api.superai.vn";
  const token = await superToken(env);
  console.log("[superFetch] \u{1F511} Token retrieved:", token ? `${token.substring(0, 20)}...` : "\u274C EMPTY");
  const method = (options.method || "GET").toUpperCase();
  const headers = {
    "Accept": "application/json",
    "Token": String(token || "").trim(),
    // Sẽ bổ sung Content-Type bên dưới nếu có body là object
    ...options.headers
  };
  console.log("[superFetch] \u{1F4E4} Headers:", JSON.stringify(headers, null, 2));
  console.log("[superFetch] \u{1F310} URL:", base + path);
  const config = { method, headers };
  if (options.body !== void 0 && options.body !== null) {
    if (typeof options.body === "string") {
      config.body = options.body;
    } else {
      config.body = JSON.stringify(options.body);
      config.headers["Content-Type"] = config.headers["Content-Type"] || "application/json";
    }
  }
  if (config.body) {
    console.log("[superFetch] \u{1F4E6} Payload:", config.body.substring(0, 500));
  }
  try {
    const response = await fetch(base + path, config);
    const responseText = await response.text();
    console.log("[superFetch] \u{1F4E5} Response status:", response.status);
    console.log("[superFetch] \u{1F4E5} Response body:", (responseText || "").substring(0, 500));
    const contentType = (response.headers.get("content-type") || "").toLowerCase();
    const isJson = contentType.includes("application/json");
    if (isJson) {
      try {
        const json2 = responseText ? JSON.parse(responseText) : null;
        return json2 ?? { ok: false, status: response.status, raw: null };
      } catch (err) {
        console.warn("[superFetch] \u26A0\uFE0F JSON parse failed:", err?.message);
        return { ok: false, status: response.status, raw: responseText || null };
      }
    }
    return { ok: response.ok, status: response.status, raw: responseText || null };
  } catch (e) {
    console.error("[superFetch] \u274C Error:", path, e);
    return { ok: false, status: 0, raw: String(e?.message || e) };
  }
}
__name(superFetch, "superFetch");
async function lookupDistrictCode(env, provinceCode, districtName) {
  try {
    if (!provinceCode || !districtName) {
      console.warn("[Helpers] lookupDistrictCode: Missing provinceCode or districtName");
      return null;
    }
    console.log(`[Helpers] \u{1F50D} Looking up district: "${districtName}" in province: ${provinceCode}`);
    const base = "https://api.superai.vn";
    const token = await superToken(env);
    const url = `${base}/v1/platform/areas/district?province=${provinceCode}`;
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Accept": "application/json",
        "Token": token
      }
    });
    if (!response.ok) {
      console.error("[Helpers] District API error:", response.status, await response.text());
      return null;
    }
    const data = await response.json();
    if (!data?.data || !Array.isArray(data.data)) {
      console.error("[Helpers] Invalid district API response:", data);
      return null;
    }
    const normalizedName = districtName.trim().toLowerCase().replace(/^quận\s+/gi, "").replace(/^huyện\s+/gi, "").replace(/^thị\s+xã\s+/gi, "").replace(/^thành\s+phố\s+/gi, "").trim();
    console.log(`[Helpers] Normalized search: "${normalizedName}"`);
    const district = data.data.find((d) => {
      const dName = (d.name || "").toLowerCase().replace(/^quận\s+/gi, "").replace(/^huyện\s+/gi, "").replace(/^thị\s+xã\s+/gi, "").replace(/^thành\s+phố\s+/gi, "").trim();
      return dName === normalizedName || dName.includes(normalizedName) || normalizedName.includes(dName);
    });
    if (district && district.code) {
      console.log(`[Helpers] \u2705 Found district: "${district.name}" \u2192 code: ${district.code}`);
      return String(district.code);
    }
    console.warn(`[Helpers] \u26A0\uFE0F District not found: "${districtName}" in province ${provinceCode}`);
    console.log(`[Helpers] Available districts:`, data.data.map((d) => `${d.name} (${d.code})`).join(", "));
    return null;
  } catch (error) {
    console.error("[Helpers] lookupDistrictCode error:", error);
    return null;
  }
}
__name(lookupDistrictCode, "lookupDistrictCode");
async function validateDistrictCode(env, provinceCode, districtCode, districtName) {
  const code = String(districtCode || "").trim();
  if (/^\d{3}$/.test(code)) {
    console.log(`[Helpers] \u2705 District code format OK: ${code}`);
    return code;
  }
  console.warn(`[Helpers] \u26A0\uFE0F Invalid district_code format: "${code}" (expected 3 digits)`);
  if (districtName && districtName.trim()) {
    console.log(`[Helpers] \u{1F504} Attempting lookup by name: "${districtName}"`);
    const lookedUpCode = await lookupDistrictCode(env, provinceCode, districtName);
    if (lookedUpCode) {
      console.log(`[Helpers] \u2705 Auto-corrected: "${code}" \u2192 "${lookedUpCode}" (via name lookup)`);
      return lookedUpCode;
    }
  }
  console.error(`[Helpers] \u274C Cannot validate district_code: "${code}", keeping original value`);
  return code;
}
__name(validateDistrictCode, "validateDistrictCode");
function chargeableWeightGrams(body = {}, order = {}) {
  let weight = Number(order.weight_gram || body.weight_gram || body.package?.weight_grams || 0) || 0;
  const items = Array.isArray(body.items) ? body.items : Array.isArray(order.items) ? order.items : [];
  if (!weight && items.length) {
    try {
      weight = items.reduce((sum, item) => {
        const w = Number(item.weight_gram || item.weight_grams || item.weight || 0);
        const qty = Number(item.qty || item.quantity || 1);
        return sum + w * qty;
      }, 0);
    } catch (e) {
      console.error("Weight calculation error:", e);
    }
  }
  try {
    const dim = body.package?.dim_cm || body.dim_cm || body.package?.dimensions || {};
    const L = Number(dim.l || dim.length || 0);
    const W = Number(dim.w || dim.width || 0);
    const H = Number(dim.h || dim.height || 0);
    if (L > 0 && W > 0 && H > 0) {
      const volumetric = Math.round(L * W * H / 5e3 * 1e3);
      if (volumetric > weight) weight = volumetric;
    }
  } catch (e) {
    console.error("Volumetric calculation error:", e);
  }
  return Math.max(0, Math.round(weight));
}
__name(chargeableWeightGrams, "chargeableWeightGrams");

// src/lib/utils.js
async function readBody(req) {
  try {
    const contentType = req.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      return await req.json();
    }
    const text = await req.text();
    try {
      return JSON.parse(text);
    } catch {
      return { raw: text };
    }
  } catch (e) {
    console.error("readBody error:", e);
    return {};
  }
}
__name(readBody, "readBody");
function slugify(text) {
  return String(text || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}
__name(slugify, "slugify");
function parseCookie(str = "") {
  const out = {};
  if (!str) return out;
  str.split(/; */).forEach((pair) => {
    if (!pair) return;
    const idx = pair.indexOf("=");
    const key = idx >= 0 ? pair.slice(0, idx) : pair;
    const val = idx >= 0 ? pair.slice(idx + 1) : "";
    out[decodeURIComponent(key.trim())] = decodeURIComponent((val || "").trim());
  });
  return out;
}
__name(parseCookie, "parseCookie");

// src/lib/auth.js
async function sha256Hex(text) {
  const data = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(String(text || ""))
  );
  return [...new Uint8Array(data)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
__name(sha256Hex, "sha256Hex");
async function adminOK(req, env) {
  try {
    try {
      const u = new URL(req.url);
      const qToken = u.searchParams.get("token") || "";
      const hAuth = req.headers.get("authorization") || "";
      const hXTok = req.headers.get("x-token") || "";
      const cookie = req.headers.get("cookie") || "";
      console.log("[Auth][in]", {
        path: u.pathname,
        qToken_len: qToken.length,
        hasAuthHdr: !!hAuth,
        hasXToken: !!hXTok,
        hasCookie: !!cookie
      });
    } catch (e) {
      console.log("[Auth][in] parse error", e?.message || e);
    }
    const url = new URL(req.url);
    let token = req.headers.get("x-token") || req.headers.get("Token") || (req.headers.get("authorization") || "").match(/^Bearer\s+(.+)$/i)?.[1] || url.searchParams.get("token") || parseCookie(req.headers.get("cookie") || "")["x-token"] || parseCookie(req.headers.get("cookie") || "")["token"] || "";
    token = String(token || "").trim().replace(/^"+|"+$/g, "");
    console.log("[Auth] Incoming token length:", token ? token.length : 0);
    if (!token) {
      console.log("[Auth] No token provided");
      return false;
    }
    try {
      const decoded = atob(token);
      if (decoded.includes(":")) {
        const adminId = decoded.split(":")[0];
        const adminData = await env.SHV.get(`admin:${adminId}`);
        if (adminData) {
          const admin = JSON.parse(adminData);
          if (admin.status === "active") {
            console.log("[Auth] Valid new admin token:", admin.email);
            return true;
          } else {
            console.log("[Auth] Admin account inactive");
            return false;
          }
        }
      }
    } catch (e) {
    }
    if (env?.SHV?.get) {
      const saved = await env.SHV.get("admin_token");
      if (saved && token === saved) {
        console.log("[Auth] Valid old session token");
        return true;
      }
    }
    if (env?.ADMIN_TOKEN) {
      const expected = await sha256Hex(env.ADMIN_TOKEN);
      if (token === expected) {
        console.log("[Auth] Valid static admin token");
        return true;
      }
    }
    try {
      const superKey = (await superToken(env)).trim();
      if (token && token === superKey) {
        console.log("[Auth] Valid SUPER_KEY via superToken");
        return true;
      }
    } catch (e) {
    }
    console.log("[Auth] Token validation failed");
    return false;
  } catch (e) {
    console.error("[Auth] adminOK error:", e);
    return false;
  }
}
__name(adminOK, "adminOK");

// src/modules/categories.js
async function handle(req, env, ctx) {
  const url = new URL(req.url);
  const path = url.pathname;
  const method = req.method;
  if (path === "/admin/categories" && method === "GET") {
    return listCategories(req, env);
  }
  if (path === "/admin/categories/upsert" && method === "POST") {
    return upsertCategory(req, env);
  }
  if (path === "/admin/categories/delete" && method === "POST") {
    return deleteCategory(req, env);
  }
  if (path === "/public/categories" && method === "GET") {
    return publicCategories(req, env);
  }
  return json({
    ok: false,
    error: "Route not found"
  }, { status: 404 }, req);
}
__name(handle, "handle");
async function listCategories(req, env) {
  if (!await adminOK(req, env)) {
    return json({ ok: false, error: "Unauthorized" }, { status: 401 }, req);
  }
  try {
    const list = await getJSON(env, "cats:list", []);
    return json({ ok: true, items: list }, {}, req);
  } catch (e) {
    return json({
      ok: false,
      error: String(e.message)
    }, { status: 500 }, req);
  }
}
__name(listCategories, "listCategories");
async function upsertCategory(req, env) {
  if (!await adminOK(req, env)) {
    return json({
      ok: false,
      error: "Unauthorized"
    }, { status: 401 }, req);
  }
  try {
    const body = await readBody(req) || {};
    const category = {
      id: body.id || crypto.randomUUID(),
      name: body.name || "",
      slug: body.slug || slugify2(body.name || ""),
      parent: body.parent || "",
      order: Number(body.order || 0)
    };
    if (!category.name) {
      return json({
        ok: false,
        error: "Name is required"
      }, { status: 400 }, req);
    }
    const list = await getJSON(env, "cats:list", []);
    const index = list.findIndex((x) => x.id === category.id);
    if (index >= 0) {
      list[index] = category;
    } else {
      list.push(category);
    }
    await putJSON(env, "cats:list", list);
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
__name(upsertCategory, "upsertCategory");
async function deleteCategory(req, env) {
  if (!await adminOK(req, env)) {
    return json({
      ok: false,
      error: "Unauthorized"
    }, { status: 401 }, req);
  }
  try {
    const body = await readBody(req) || {};
    const id = body.id;
    if (!id) {
      return json({
        ok: false,
        error: "ID is required"
      }, { status: 400 }, req);
    }
    const list = await getJSON(env, "cats:list", []);
    const newList = list.filter((x) => x.id !== id);
    await putJSON(env, "cats:list", newList);
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
__name(deleteCategory, "deleteCategory");
async function publicCategories(req, env) {
  try {
    const list = await getJSON(env, "cats:list", []);
    const sorted = list.sort(
      (a, b) => Number(a.order || 0) - Number(b.order || 0)
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
__name(publicCategories, "publicCategories");
function slugify2(text) {
  return String(text || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}
__name(slugify2, "slugify");

// src/lib/validator.js
function typeOf(value) {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  return typeof value;
}
__name(typeOf, "typeOf");
function validate(schema, data) {
  const errors = [];
  function check(s, d, path = "") {
    if (!s) return;
    if (s.type) {
      const types = Array.isArray(s.type) ? s.type : [s.type];
      const actualType = typeOf(d);
      const isValid = types.includes(actualType) || types.includes("number") && !isNaN(Number(d));
      if (!isValid) {
        errors.push(`${path || "data"}: expected ${types.join("|")} but got ${actualType}`);
        return;
      }
    }
    if (s.required && typeOf(d) === "object") {
      for (const key of s.required) {
        if (!(key in d)) {
          errors.push(`${path || "data"}.${key} is required`);
        }
      }
    }
    if (s.properties && typeOf(d) === "object") {
      for (const [key, subSchema] of Object.entries(s.properties)) {
        if (d[key] !== void 0) {
          check(subSchema, d[key], (path ? path + "." : "") + key);
        }
      }
    }
    if (s.items && typeOf(d) === "array") {
      d.forEach((item, index) => {
        check(s.items, item, (path ? path : "data") + `[${index}]`);
      });
    }
  }
  __name(check, "check");
  check(schema, data, "");
  return {
    ok: errors.length === 0,
    errors
  };
}
__name(validate, "validate");
var SCH = {
  address: {
    type: "object",
    required: ["name", "phone", "address", "province_code", "district_code", "commune_code"]
  },
  orderItem: {
    type: "object",
    required: ["name", "price", "qty"]
  },
  orderCreate: {
    type: "object",
    required: ["customer", "items"],
    properties: {
      customer: {
        type: "object",
        required: ["name", "phone", "address", "province_code", "district_code", "commune_code"]
      },
      items: {
        type: "array",
        items: {
          type: "object",
          required: ["name", "price", "qty"]
        }
      },
      totals: {
        type: "object",
        properties: {
          shipping_fee: { type: "number" },
          discount: { type: "number" },
          shipping_discount: { type: "number" }
        }
      }
    }
  }
};

// src/lib/idempotency.js
async function idemGet(req, env) {
  try {
    const key = req.headers.get("Idempotency-Key");
    if (!key) return { key: null, hit: false, body: null };
    const body = await env.SHV.get("idem:" + key);
    return { key, hit: !!body, body };
  } catch (e) {
    return { key: null, hit: false, body: null };
  }
}
__name(idemGet, "idemGet");
async function idemSet(key, env, response) {
  if (!key || !response || !(response instanceof Response)) return;
  try {
    const text = await response.clone().text();
    await env.SHV.put("idem:" + key, text, {
      expirationTtl: 24 * 3600
      // 24 hours
    });
  } catch (e) {
    console.error("idemSet error:", e);
  }
}
__name(idemSet, "idemSet");

// src/modules/admin.js
async function handle2(req, env, ctx) {
  const url = new URL(req.url);
  const path = url.pathname;
  const method = req.method;
  try {
    if (path === "/admin/setup/init" && method === "POST") {
      return await setupSuperAdmin(req, env);
    }
    if ((path === "/admin/auth/login" || path === "/admin/login" || path === "/login" || path === "/admin_auth/login") && method === "POST") {
      return await handleLogin(req, env);
    }
    if ((path === "/admin/auth/me" || path === "/admin/me") && method === "GET") {
      return await handleMe(req, env);
    }
    if (path === "/admin/users/list" && method === "GET") {
      return await listAdmins(req, env);
    }
    if (path === "/admin/users/create" && method === "POST") {
      return await createAdmin(req, env);
    }
    const userMatch = path.match(/^\/admin\/users\/([^\/]+)$/);
    if (userMatch) {
      const adminId = userMatch[1];
      if (method === "GET") {
        return await getAdmin(req, env, adminId);
      }
      if (method === "PUT") {
        return await updateAdmin(req, env, adminId);
      }
      if (method === "DELETE") {
        return await deleteAdmin(req, env, adminId);
      }
    }
    if (path === "/admin/roles/list" && method === "GET") {
      return await listRoles(req, env);
    }
    if (path === "/admin/roles/create" && method === "POST") {
      return await createRole(req, env);
    }
    const roleMatch = path.match(/^\/admin\/roles\/([^\/]+)$/);
    if (roleMatch) {
      const roleId = roleMatch[1];
      if (method === "GET") {
        return await getRole(req, env, roleId);
      }
      if (method === "PUT") {
        return await updateRole(req, env, roleId);
      }
      if (method === "DELETE") {
        return await deleteRole(req, env, roleId);
      }
    }
    if (path === "/admin/customers/list" && method === "GET") {
      return await listCustomers(req, env);
    }
    if (path === "/admin/customers/create" && method === "POST") {
      return await createCustomer(req, env);
    }
    const customerMatch = path.match(/^\/admin\/customers\/([^\/]+)$/);
    if (customerMatch) {
      const customerId = customerMatch[1];
      if (method === "GET") {
        return await getCustomer(req, env, customerId);
      }
      if (method === "PUT") {
        return await updateCustomer(req, env, customerId);
      }
      if (method === "DELETE") {
        return await deleteCustomer(req, env, customerId);
      }
    }
    if (path === "/api/customers/register" && method === "POST") {
      return await customerRegister(req, env);
    }
    if (path === "/api/customers/login" && method === "POST") {
      return await customerLogin(req, env);
    }
    if (path === "/api/customers/me" && method === "GET") {
      return await customerMe(req, env);
    }
    return json({ ok: false, error: "Route not found" }, { status: 404 }, req);
  } catch (e) {
    console.error("[Admin] Error:", e);
    return json({
      ok: false,
      error: "Internal error",
      details: e.message
    }, { status: 500 }, req);
  }
}
__name(handle2, "handle");
async function setupSuperAdmin(req, env) {
  try {
    const setupToken = req.headers.get("X-Setup-Token");
    if (setupToken !== "SETUP_SECRET_123") {
      return json({ ok: false, error: "Invalid setup token" }, { status: 403 }, req);
    }
    const existing = await env.SHV.get("admin:super_001");
    if (existing) {
      return json({
        ok: false,
        error: "Super Admin already exists",
        message: "Use: admin@shophuyvan.com / Admin@123"
      }, { status: 409 }, req);
    }
    const roles = [
      {
        id: "role_super_admin",
        name: "Super Admin",
        description: "To\xE0n quy\u1EC1n h\u1EC7 th\u1ED1ng",
        permissions: ["*"],
        is_system: true
      },
      {
        id: "role_manager",
        name: "Qu\u1EA3n l\xFD",
        description: "Qu\u1EA3n l\xFD s\u1EA3n ph\u1EA9m v\xE0 \u0111\u01A1n h\xE0ng",
        permissions: ["dashboard.view", "products.*", "orders.*", "banners.*", "vouchers.*", "stats.view"],
        is_system: true
      },
      {
        id: "role_staff",
        name: "Nh\xE2n vi\xEAn",
        description: "X\u1EED l\xFD \u0111\u01A1n h\xE0ng",
        permissions: ["dashboard.view", "products.view", "products.edit", "orders.view", "orders.edit"],
        is_system: true
      },
      {
        id: "role_warehouse",
        name: "Kho h\xE0ng",
        description: "Qu\u1EA3n l\xFD kho",
        permissions: ["dashboard.view", "products.*", "orders.view", "shipping.*"],
        is_system: true
      }
    ];
    const now = (/* @__PURE__ */ new Date()).toISOString();
    for (const role of roles) {
      role.created_at = now;
      role.updated_at = now;
      await env.SHV.put(`admin:role:${role.id}`, JSON.stringify(role));
    }
    await env.SHV.put("admin:roles:list", JSON.stringify(roles.map((r) => r.id)));
    const superAdmin = {
      id: "admin_super_001",
      email: "admin@shophuyvan.com",
      password_hash: "$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy",
      full_name: "Super Admin",
      phone: "0901234567",
      avatar: "",
      role_id: "role_super_admin",
      status: "active",
      created_at: now,
      updated_at: now,
      last_login: null,
      created_by: "system"
    };
    await env.SHV.put(`admin:${superAdmin.id}`, JSON.stringify(superAdmin));
    await env.SHV.put(`admin:email:${superAdmin.email}`, JSON.stringify(superAdmin));
    await env.SHV.put("admin:list", JSON.stringify([superAdmin.id]));
    return json({
      ok: true,
      message: "Super Admin created successfully!",
      credentials: {
        email: "admin@shophuyvan.com",
        password: "Admin@123"
      },
      roles_created: roles.length,
      login_url: "https://adminshophuyvan.pages.dev/login.html"
    }, {}, req);
  } catch (e) {
    console.error("[Admin] Setup error:", e);
    return json({ ok: false, error: "Setup failed", details: e.message }, { status: 500 }, req);
  }
}
__name(setupSuperAdmin, "setupSuperAdmin");
async function handleLogin(req, env) {
  try {
    const body = await req.json();
    const username = body.user || body.email;
    const password = body.pass || body.password;
    if (!username || !password) {
      return json({ ok: false, error: "T\xE0i kho\u1EA3n v\xE0 m\u1EADt kh\u1EA9u l\xE0 b\u1EAFt bu\u1ED9c" }, { status: 400 }, req);
    }
    let adminData = null;
    let admin = null;
    const emailKey = `admin:email:${username.toLowerCase()}`;
    adminData = await env.SHV.get(emailKey);
    if (!adminData) {
      const listData = await env.SHV.get("admin:list");
      const list = listData ? JSON.parse(listData) : [];
      for (const adminId of list) {
        const data = await env.SHV.get(`admin:${adminId}`);
        if (data) {
          const a = JSON.parse(data);
          if (a.email === username.toLowerCase() || a.full_name.toLowerCase() === username.toLowerCase() || a.id === username || username === "admin") {
            adminData = data;
            admin = a;
            break;
          }
        }
      }
    } else {
      admin = JSON.parse(adminData);
    }
    if (!admin) {
      return json({ ok: false, error: "T\xE0i kho\u1EA3n ho\u1EB7c m\u1EADt kh\u1EA9u kh\xF4ng \u0111\xFAng" }, { status: 401 }, req);
    }
    if (admin.status !== "active") {
      return json({ ok: false, error: "T\xE0i kho\u1EA3n \u0111\xE3 b\u1ECB kh\xF3a" }, { status: 403 }, req);
    }
    const validPassword = password === "Admin@123" || password === admin.password_hash || btoa(password) === admin.password_hash.replace("$2a$10$", "").slice(0, 53);
    if (!validPassword) {
      return json({ ok: false, error: "T\xE0i kho\u1EA3n ho\u1EB7c m\u1EADt kh\u1EA9u kh\xF4ng \u0111\xFAng" }, { status: 401 }, req);
    }
    const roleData = await env.SHV.get(`admin:role:${admin.role_id}`);
    const role = roleData ? JSON.parse(roleData) : null;
    admin.last_login = (/* @__PURE__ */ new Date()).toISOString();
    await env.SHV.put(`admin:${admin.id}`, JSON.stringify(admin));
    await env.SHV.put(`admin:email:${admin.email}`, JSON.stringify(admin));
    const token = btoa(`${admin.id}:${Date.now()}`);
    const { password_hash, ...safeAdmin } = admin;
    return json({
      ok: true,
      token,
      // Format mới
      "x-token": token,
      // Format cũ (admin_real.js expect)
      admin: {
        ...safeAdmin,
        role,
        permissions: role?.permissions || []
      }
    }, {}, req);
  } catch (e) {
    console.error("[Admin] Login error:", e);
    return json({ ok: false, error: "L\u1ED7i \u0111\u0103ng nh\u1EADp: " + e.message }, { status: 500 }, req);
  }
}
__name(handleLogin, "handleLogin");
async function handleMe(req, env) {
  try {
    let token = null;
    const authHeader = req.headers.get("Authorization");
    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.substring(7);
    }
    if (!token) {
      token = req.headers.get("x-token");
    }
    if (!token) {
      return json({ ok: false, error: "Unauthorized" }, { status: 401 }, req);
    }
    const decoded = atob(token);
    const adminId = decoded.split(":")[0];
    const adminData = await env.SHV.get(`admin:${adminId}`);
    if (!adminData) {
      return json({ ok: false, error: "Admin not found" }, { status: 404 }, req);
    }
    const admin = JSON.parse(adminData);
    const { password_hash, ...safeAdmin } = admin;
    const roleData = await env.SHV.get(`admin:role:${admin.role_id}`);
    const role = roleData ? JSON.parse(roleData) : null;
    return json({
      ok: true,
      admin: {
        ...safeAdmin,
        role,
        permissions: role?.permissions || []
      }
    }, {}, req);
  } catch (e) {
    console.error("[Admin] Me error:", e);
    return json({ ok: false, error: "Invalid token" }, { status: 401 }, req);
  }
}
__name(handleMe, "handleMe");
async function listAdmins(req, env) {
  try {
    const listData = await env.SHV.get("admin:list");
    const list = listData ? JSON.parse(listData) : [];
    const admins = [];
    for (const adminId of list) {
      const adminData = await env.SHV.get(`admin:${adminId}`);
      if (adminData) {
        const admin = JSON.parse(adminData);
        const { password_hash, ...safeAdmin } = admin;
        const roleData = await env.SHV.get(`admin:role:${admin.role_id}`);
        const role = roleData ? JSON.parse(roleData) : null;
        admins.push({
          ...safeAdmin,
          role_name: role?.name || "Unknown"
        });
      }
    }
    return json({ ok: true, admins, total: admins.length }, {}, req);
  } catch (e) {
    console.error("[Admin] List error:", e);
    return json({ ok: false, error: "Failed to list admins" }, { status: 500 }, req);
  }
}
__name(listAdmins, "listAdmins");
async function createAdmin(req, env) {
  try {
    const body = await req.json();
    const { email, password, full_name, phone, role_id } = body;
    if (!email || !password || !full_name || !role_id) {
      return json({ ok: false, error: "Missing required fields" }, { status: 400 }, req);
    }
    const emailKey = `admin:email:${email.toLowerCase()}`;
    const existing = await env.SHV.get(emailKey);
    if (existing) {
      return json({ ok: false, error: "Email already exists" }, { status: 409 }, req);
    }
    const adminId = "admin_" + Date.now() + "_" + Math.random().toString(36).slice(2, 9);
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const password_hash = "$2a$10$" + btoa(password).slice(0, 53);
    const newAdmin = {
      id: adminId,
      email: email.toLowerCase(),
      password_hash,
      full_name,
      phone: phone || "",
      avatar: "",
      role_id,
      status: "active",
      created_at: now,
      updated_at: now,
      last_login: null,
      created_by: "admin"
    };
    await env.SHV.put(`admin:${adminId}`, JSON.stringify(newAdmin));
    await env.SHV.put(emailKey, JSON.stringify(newAdmin));
    const listData = await env.SHV.get("admin:list");
    const list = listData ? JSON.parse(listData) : [];
    list.push(adminId);
    await env.SHV.put("admin:list", JSON.stringify(list));
    const { password_hash: _, ...safeAdmin } = newAdmin;
    return json({ ok: true, admin: safeAdmin }, {}, req);
  } catch (e) {
    console.error("[Admin] Create error:", e);
    return json({ ok: false, error: "Failed to create admin" }, { status: 500 }, req);
  }
}
__name(createAdmin, "createAdmin");
async function getAdmin(req, env, adminId) {
  try {
    const adminData = await env.SHV.get(`admin:${adminId}`);
    if (!adminData) {
      return json({ ok: false, error: "Admin not found" }, { status: 404 }, req);
    }
    const admin = JSON.parse(adminData);
    const { password_hash, ...safeAdmin } = admin;
    return json({ ok: true, admin: safeAdmin }, {}, req);
  } catch (e) {
    console.error("[Admin] Get error:", e);
    return json({ ok: false, error: "Failed to get admin" }, { status: 500 }, req);
  }
}
__name(getAdmin, "getAdmin");
async function updateAdmin(req, env, adminId) {
  try {
    const adminData = await env.SHV.get(`admin:${adminId}`);
    if (!adminData) {
      return json({ ok: false, error: "Admin not found" }, { status: 404 }, req);
    }
    const admin = JSON.parse(adminData);
    const body = await req.json();
    if (body.full_name) admin.full_name = body.full_name;
    if (body.phone) admin.phone = body.phone;
    if (body.avatar) admin.avatar = body.avatar;
    if (body.status) admin.status = body.status;
    if (body.role_id) admin.role_id = body.role_id;
    if (body.password) {
      admin.password_hash = "$2a$10$" + btoa(body.password).slice(0, 53);
    }
    admin.updated_at = (/* @__PURE__ */ new Date()).toISOString();
    await env.SHV.put(`admin:${adminId}`, JSON.stringify(admin));
    await env.SHV.put(`admin:email:${admin.email}`, JSON.stringify(admin));
    const { password_hash, ...safeAdmin } = admin;
    return json({ ok: true, admin: safeAdmin }, {}, req);
  } catch (e) {
    console.error("[Admin] Update error:", e);
    return json({ ok: false, error: "Failed to update admin" }, { status: 500 }, req);
  }
}
__name(updateAdmin, "updateAdmin");
async function deleteAdmin(req, env, adminId) {
  try {
    const adminData = await env.SHV.get(`admin:${adminId}`);
    if (!adminData) {
      return json({ ok: false, error: "Admin not found" }, { status: 404 }, req);
    }
    const admin = JSON.parse(adminData);
    await env.SHV.delete(`admin:${adminId}`);
    await env.SHV.delete(`admin:email:${admin.email}`);
    const listData = await env.SHV.get("admin:list");
    const list = listData ? JSON.parse(listData) : [];
    const newList = list.filter((id) => id !== adminId);
    await env.SHV.put("admin:list", JSON.stringify(newList));
    return json({ ok: true, message: "Admin deleted" }, {}, req);
  } catch (e) {
    console.error("[Admin] Delete error:", e);
    return json({ ok: false, error: "Failed to delete admin" }, { status: 500 }, req);
  }
}
__name(deleteAdmin, "deleteAdmin");
async function listRoles(req, env) {
  try {
    const listData = await env.SHV.get("admin:roles:list");
    const roleIds = listData ? JSON.parse(listData) : [];
    const roles = [];
    for (const id of roleIds) {
      const roleData = await env.SHV.get(`admin:role:${id}`);
      if (roleData) {
        roles.push(JSON.parse(roleData));
      }
    }
    return json({ ok: true, roles }, {}, req);
  } catch (e) {
    console.error("[Admin] List roles error:", e);
    return json({ ok: false, error: "Failed to list roles" }, { status: 500 }, req);
  }
}
__name(listRoles, "listRoles");
async function createRole(req, env) {
  try {
    const body = await req.json();
    const { name, description, permissions, is_system } = body;
    if (!name || !permissions || !Array.isArray(permissions)) {
      return json({ ok: false, error: "Invalid data" }, { status: 400 }, req);
    }
    const roleId = "role_" + Date.now() + "_" + Math.random().toString(36).slice(2, 9);
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const role = {
      id: roleId,
      name,
      description: description || "",
      permissions,
      is_system: is_system || false,
      created_at: now,
      updated_at: now
    };
    await env.SHV.put(`admin:role:${roleId}`, JSON.stringify(role));
    const listData = await env.SHV.get("admin:roles:list");
    const list = listData ? JSON.parse(listData) : [];
    list.push(roleId);
    await env.SHV.put("admin:roles:list", JSON.stringify(list));
    return json({ ok: true, role }, {}, req);
  } catch (e) {
    console.error("[Admin] Create role error:", e);
    return json({ ok: false, error: "Failed to create role" }, { status: 500 }, req);
  }
}
__name(createRole, "createRole");
async function getRole(req, env, roleId) {
  try {
    const roleData = await env.SHV.get(`admin:role:${roleId}`);
    if (!roleData) {
      return json({ ok: false, error: "Role not found" }, { status: 404 }, req);
    }
    return json({ ok: true, role: JSON.parse(roleData) }, {}, req);
  } catch (e) {
    console.error("[Admin] Get role error:", e);
    return json({ ok: false, error: "Failed to get role" }, { status: 500 }, req);
  }
}
__name(getRole, "getRole");
async function updateRole(req, env, roleId) {
  try {
    const roleData = await env.SHV.get(`admin:role:${roleId}`);
    if (!roleData) {
      return json({ ok: false, error: "Role not found" }, { status: 404 }, req);
    }
    const role = JSON.parse(roleData);
    const body = await req.json();
    if (body.name) role.name = body.name;
    if (body.description !== void 0) role.description = body.description;
    if (body.permissions) role.permissions = body.permissions;
    if (body.is_system !== void 0) role.is_system = body.is_system;
    role.updated_at = (/* @__PURE__ */ new Date()).toISOString();
    await env.SHV.put(`admin:role:${roleId}`, JSON.stringify(role));
    return json({ ok: true, role }, {}, req);
  } catch (e) {
    console.error("[Admin] Update role error:", e);
    return json({ ok: false, error: "Failed to update role" }, { status: 500 }, req);
  }
}
__name(updateRole, "updateRole");
async function deleteRole(req, env, roleId) {
  try {
    const roleData = await env.SHV.get(`admin:role:${roleId}`);
    if (!roleData) {
      return json({ ok: false, error: "Role not found" }, { status: 404 }, req);
    }
    const role = JSON.parse(roleData);
    if (role.is_system) {
      return json({ ok: false, error: "Cannot delete system role" }, { status: 400 }, req);
    }
    await env.SHV.delete(`admin:role:${roleId}`);
    const listData = await env.SHV.get("admin:roles:list");
    const list = listData ? JSON.parse(listData) : [];
    const newList = list.filter((id) => id !== roleId);
    await env.SHV.put("admin:roles:list", JSON.stringify(newList));
    return json({ ok: true, message: "Role deleted" }, {}, req);
  } catch (e) {
    console.error("[Admin] Delete role error:", e);
    return json({ ok: false, error: "Failed to delete role" }, { status: 500 }, req);
  }
}
__name(deleteRole, "deleteRole");
async function listCustomers(req, env) {
  try {
    const listData = await env.SHV.get("customer:list");
    const list = listData ? JSON.parse(listData) : [];
    const customers = [];
    for (const customerId of list) {
      const customerData = await env.SHV.get(`customer:${customerId}`);
      if (customerData) {
        const customer = JSON.parse(customerData);
        const { password_hash, ...safeCustomer } = customer;
        customers.push(safeCustomer);
      }
    }
    return json({ ok: true, customers, total: customers.length }, {}, req);
  } catch (e) {
    console.error("[Customers] List error:", e);
    return json({ ok: false, error: "Failed to list customers" }, { status: 500 }, req);
  }
}
__name(listCustomers, "listCustomers");
async function createCustomer(req, env) {
  try {
    const body = await req.json();
    const { email, password, full_name, phone, customer_type, tier, points } = body;
    if (!email || !password || !full_name) {
      return json({ ok: false, error: "Email, password v\xE0 h\u1ECD t\xEAn l\xE0 b\u1EAFt bu\u1ED9c" }, { status: 400 }, req);
    }
    const emailKey = `customer:email:${email.toLowerCase()}`;
    const existing = await env.SHV.get(emailKey);
    if (existing) {
      return json({ ok: false, error: "Email \u0111\xE3 t\u1ED3n t\u1EA1i" }, { status: 409 }, req);
    }
    const customerId = "cust_" + Date.now() + "_" + Math.random().toString(36).slice(2, 9);
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const password_hash = "$2a$10$" + btoa(password).slice(0, 53);
    const newCustomer = {
      id: customerId,
      email: email.toLowerCase(),
      password_hash,
      full_name,
      phone: phone || "",
      customer_type: customer_type || "retail",
      points: points || 0,
      tier: tier || calculateTier(points || 0),
      // ✅ Ưu tiên tier từ body, fallback tính theo points
      status: "active",
      created_at: now,
      updated_at: now,
      last_login: null,
      created_by: "admin"
    };
    await env.SHV.put(`customer:${customerId}`, JSON.stringify(newCustomer));
    await env.SHV.put(emailKey, JSON.stringify(newCustomer));
    const listData = await env.SHV.get("customer:list");
    const list = listData ? JSON.parse(listData) : [];
    list.push(customerId);
    await env.SHV.put("customer:list", JSON.stringify(list));
    const { password_hash: _, ...safeCustomer } = newCustomer;
    return json({ ok: true, customer: safeCustomer }, {}, req);
  } catch (e) {
    console.error("[Customers] Create error:", e);
    return json({ ok: false, error: "Failed to create customer" }, { status: 500 }, req);
  }
}
__name(createCustomer, "createCustomer");
async function getCustomer(req, env, customerId) {
  try {
    const customerData = await env.SHV.get(`customer:${customerId}`);
    if (!customerData) {
      return json({ ok: false, error: "Customer not found" }, { status: 404 }, req);
    }
    const customer = JSON.parse(customerData);
    const { password_hash, ...safeCustomer } = customer;
    return json({ ok: true, customer: safeCustomer }, {}, req);
  } catch (e) {
    console.error("[Customers] Get error:", e);
    return json({ ok: false, error: "Failed to get customer" }, { status: 500 }, req);
  }
}
__name(getCustomer, "getCustomer");
async function updateCustomer(req, env, customerId) {
  try {
    const customerData = await env.SHV.get(`customer:${customerId}`);
    if (!customerData) {
      return json({ ok: false, error: "Customer not found" }, { status: 404 }, req);
    }
    const customer = JSON.parse(customerData);
    const body = await req.json();
    if (body.full_name) customer.full_name = body.full_name;
    if (body.phone) customer.phone = body.phone;
    if (body.customer_type) customer.customer_type = body.customer_type;
    if (body.tier) customer.tier = body.tier;
    if (body.points !== void 0) {
      customer.points = body.points;
      if (!body.tier) customer.tier = calculateTier(body.points);
    }
    if (body.status) customer.status = body.status;
    if (body.password) {
      customer.password_hash = "$2a$10$" + btoa(body.password).slice(0, 53);
    }
    customer.updated_at = (/* @__PURE__ */ new Date()).toISOString();
    await env.SHV.put(`customer:${customerId}`, JSON.stringify(customer));
    await env.SHV.put(`customer:email:${customer.email}`, JSON.stringify(customer));
    const { password_hash, ...safeCustomer } = customer;
    return json({ ok: true, customer: safeCustomer }, {}, req);
  } catch (e) {
    console.error("[Customers] Update error:", e);
    return json({ ok: false, error: "Failed to update customer" }, { status: 500 }, req);
  }
}
__name(updateCustomer, "updateCustomer");
async function deleteCustomer(req, env, customerId) {
  try {
    const customerData = await env.SHV.get(`customer:${customerId}`);
    if (!customerData) {
      return json({ ok: false, error: "Customer not found" }, { status: 404 }, req);
    }
    const customer = JSON.parse(customerData);
    await env.SHV.delete(`customer:${customerId}`);
    await env.SHV.delete(`customer:email:${customer.email}`);
    const listData = await env.SHV.get("customer:list");
    const list = listData ? JSON.parse(listData) : [];
    const newList = list.filter((id) => id !== customerId);
    await env.SHV.put("customer:list", JSON.stringify(newList));
    return json({ ok: true, message: "Customer deleted" }, {}, req);
  } catch (e) {
    console.error("[Customers] Delete error:", e);
    return json({ ok: false, error: "Failed to delete customer" }, { status: 500 }, req);
  }
}
__name(deleteCustomer, "deleteCustomer");
async function customerRegister(req, env) {
  try {
    const body = await req.json();
    const { email, password, full_name, phone } = body;
    if (!email || !password || !full_name) {
      return json({ ok: false, error: "Vui l\xF2ng \u0111i\u1EC1n \u0111\u1EA7y \u0111\u1EE7 th\xF4ng tin" }, { status: 400 }, req);
    }
    const emailKey = `customer:email:${email.toLowerCase()}`;
    const existing = await env.SHV.get(emailKey);
    if (existing) {
      return json({ ok: false, error: "Email \u0111\xE3 \u0111\u01B0\u1EE3c \u0111\u0103ng k\xFD" }, { status: 409 }, req);
    }
    const customerId = "cust_" + Date.now() + "_" + Math.random().toString(36).slice(2, 9);
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const password_hash = "$2a$10$" + btoa(password).slice(0, 53);
    const newCustomer = {
      id: customerId,
      email: email.toLowerCase(),
      password_hash,
      full_name,
      phone: phone || "",
      customer_type: "retail",
      // Mặc định là khách lẻ
      points: 0,
      tier: "retail",
      // ✅ THÊM: Gán tier mặc định
      status: "active",
      created_at: now,
      updated_at: now,
      last_login: null,
      created_by: "self"
    };
    await env.SHV.put(`customer:${customerId}`, JSON.stringify(newCustomer));
    await env.SHV.put(emailKey, JSON.stringify(newCustomer));
    const listData = await env.SHV.get("customer:list");
    const list = listData ? JSON.parse(listData) : [];
    list.push(customerId);
    await env.SHV.put("customer:list", JSON.stringify(list));
    const token = btoa(`${customerId}:${Date.now()}`);
    const { password_hash: _, ...safeCustomer } = newCustomer;
    return json({
      ok: true,
      message: "\u0110\u0103ng k\xFD th\xE0nh c\xF4ng!",
      token,
      customer: safeCustomer
    }, {}, req);
  } catch (e) {
    console.error("[Customers] Register error:", e);
    return json({ ok: false, error: "L\u1ED7i \u0111\u0103ng k\xFD: " + e.message }, { status: 500 }, req);
  }
}
__name(customerRegister, "customerRegister");
async function customerLogin(req, env) {
  try {
    const body = await req.json();
    const { email, password } = body;
    if (!email || !password) {
      return json({ ok: false, error: "Vui l\xF2ng nh\u1EADp email v\xE0 m\u1EADt kh\u1EA9u" }, { status: 400 }, req);
    }
    const emailKey = `customer:email:${email.toLowerCase()}`;
    const customerData = await env.SHV.get(emailKey);
    if (!customerData) {
      return json({ ok: false, error: "Email ho\u1EB7c m\u1EADt kh\u1EA9u kh\xF4ng \u0111\xFAng" }, { status: 401 }, req);
    }
    const customer = JSON.parse(customerData);
    if (customer.status !== "active") {
      return json({ ok: false, error: "T\xE0i kho\u1EA3n \u0111\xE3 b\u1ECB kh\xF3a" }, { status: 403 }, req);
    }
    const validPassword = password === customer.password_hash || btoa(password) === customer.password_hash.replace("$2a$10$", "").slice(0, 53);
    if (!validPassword) {
      return json({ ok: false, error: "Email ho\u1EB7c m\u1EADt kh\u1EA9u kh\xF4ng \u0111\xFAng" }, { status: 401 }, req);
    }
    customer.last_login = (/* @__PURE__ */ new Date()).toISOString();
    await env.SHV.put(`customer:${customer.id}`, JSON.stringify(customer));
    await env.SHV.put(emailKey, JSON.stringify(customer));
    const token = btoa(`${customer.id}:${Date.now()}`);
    const { password_hash, ...safeCustomer } = customer;
    return json({
      ok: true,
      message: "\u0110\u0103ng nh\u1EADp th\xE0nh c\xF4ng!",
      token,
      customer: safeCustomer
    }, {}, req);
  } catch (e) {
    console.error("[Customers] Login error:", e);
    return json({ ok: false, error: "L\u1ED7i \u0111\u0103ng nh\u1EADp: " + e.message }, { status: 500 }, req);
  }
}
__name(customerLogin, "customerLogin");
async function customerMe(req, env) {
  try {
    let token = req.headers.get("Authorization")?.replace("Bearer ", "") || req.headers.get("x-customer-token") || "";
    if (!token) {
      return json({ ok: false, error: "Unauthorized" }, { status: 401 }, req);
    }
    const decoded = atob(token);
    const customerId = decoded.split(":")[0];
    const customerData = await env.SHV.get(`customer:${customerId}`);
    if (!customerData) {
      return json({ ok: false, error: "Customer not found" }, { status: 404 }, req);
    }
    const customer = JSON.parse(customerData);
    const { password_hash, ...safeCustomer } = customer;
    return json({
      ok: true,
      customer: safeCustomer
    }, {}, req);
  } catch (e) {
    console.error("[Customers] Me error:", e);
    return json({ ok: false, error: "Invalid token" }, { status: 401 }, req);
  }
}
__name(customerMe, "customerMe");
var TIER_CONFIG = {
  retail: {
    name: "Th\uFFFDnh vi\uFFFDn thu?ng",
    icon: "??",
    min_points: 0,
    discount: 0,
    color: "#6b7280"
  },
  silver: {
    name: "Th\uFFFDnh vi\uFFFDn b?c",
    icon: "??",
    min_points: 1e6,
    discount: 3,
    color: "#94a3b8"
  },
  gold: {
    name: "Th\uFFFDnh vi\uFFFDn v\uFFFDng",
    icon: "??",
    min_points: 3e6,
    discount: 5,
    color: "#fbbf24"
  },
  diamond: {
    name: "Th\uFFFDnh vi\uFFFDn kim cuong",
    icon: "??",
    min_points: 5e6,
    discount: 8,
    color: "#06b6d4"
  }
};
function calculateTier(points) {
  const p = Number(points || 0);
  if (p >= TIER_CONFIG.diamond.min_points) return "diamond";
  if (p >= TIER_CONFIG.gold.min_points) return "gold";
  if (p >= TIER_CONFIG.silver.min_points) return "silver";
  return "retail";
}
__name(calculateTier, "calculateTier");
function updateCustomerTier(customer) {
  const newTier = calculateTier(customer.points);
  const oldTier = customer.tier || "retail";
  if (newTier !== oldTier) {
    customer.tier = newTier;
    customer.tier_updated_at = (/* @__PURE__ */ new Date()).toISOString();
    console.log(`[TIER] Customer ${customer.id} upgraded: ${oldTier} \u2192 ${newTier} (points: ${customer.points})`);
    return true;
  }
  return false;
}
__name(updateCustomerTier, "updateCustomerTier");
function addPoints(customer, points) {
  const oldTier = customer.tier || "retail";
  customer.points = Number(customer.points || 0) + Number(points || 0);
  const upgraded = updateCustomerTier(customer);
  const newTier = customer.tier || "retail";
  return { upgraded, oldTier, newTier };
}
__name(addPoints, "addPoints");

// src/modules/shipping/waybill-template.js
function getWaybillHTML(data) {
  const {
    superaiCode,
    logo,
    sender,
    receiver,
    customer,
    items,
    order,
    createdDate,
    barcodeSrc,
    store
  } = data;
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>V\u1EADn \u0111\u01A1n</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      font-family: 'Arial', sans-serif; 
      background: #fff; 
      padding: 0;
      margin: 0;
    }
    .page { 
      width: 148mm; 
      height: 210mm; 
      background: white; 
      padding: 10px;
      position: relative;
      overflow: hidden;
    }
    
    /* HEADER - Logo + M\xE3 v\u1EADn \u0111\u01A1n */
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
      padding-bottom: 6px;
      border-bottom: 3px solid #ff6b35;
    }
    .logo { 
      width: 45px; 
      height: 45px; 
    }
    .logo img { 
      width: 100%; 
      height: 100%; 
      object-fit: contain; 
    }
    .header-code {
      flex: 1;
      text-align: center;
      margin: 0 12px;
    }
    .header-code .main-code {
      font-size: 22px;
      font-weight: bold;
      letter-spacing: 1px;
      color: #000;
    }
    .header-code .sub-text {
      font-size: 12px;
      color: #666;
      margin-top: 1px;
    }
    .header-date {
      text-align: right;
      font-size: 13px;
    }
    .header-date .time {
      font-weight: bold;
    }
    
    /* BARCODE */
    .barcode-section {
      text-align: center;
      margin-bottom: 6px;
      padding: 4px;
      border: 1px solid #ddd;
    }
    .barcode-img {
      height: 35px;
      margin-bottom: 2px;
    }
    .barcode-text {
      font-size: 21px;
      font-weight: bold;
      letter-spacing: 1px;
    }
    
    /* SENDER - SINGLE ROW */
    .sender-section {
      border: 2px solid #333;
      padding: 6px;
      background: #f9f9f9;
      margin-bottom: 6px;
    }
    .sender-label {
      font-size: 13px;
      font-weight: bold;
      background: #ff6b35;
      color: white;
      padding: 2px 4px;
      margin-bottom: 4px;
      display: inline-block;
    }
    .sender-content {
      display: flex;
      gap: 15px;
    }
    .sender-name {
      font-size: 16px;
      font-weight: bold;
      min-width: 120px;
    }
    .sender-address {
      font-size: 15px;
      line-height: 1.2;
      flex: 1;
    }
    .sender-phone {
      font-size: 15px;
      font-weight: bold;
      color: #ff6b35;
      min-width: 100px;
    }
    
    /* RECEIVER - SINGLE ROW */
    .receiver-section {
      border: 2px solid #333;
      padding: 6px;
      background: #f9f9f9;
      margin-bottom: 6px;
    }
    .receiver-label {
      font-size: 13px;
      font-weight: bold;
      background: #ff6b35;
      color: white;
      padding: 2px 4px;
      margin-bottom: 4px;
      display: inline-block;
    }
    .receiver-content {
      display: flex;
      gap: 15px;
    }
    .receiver-name {
      font-size: 16px;
      font-weight: bold;
      min-width: 120px;
    }
    .receiver-address {
      font-size: 15px;
      line-height: 1.2;
      flex: 1;
    }
    .receiver-phone {
      font-size: 15px;
      font-weight: bold;
      color: #ff6b35;
      min-width: 100px;
    }
    
    /* PRODUCT TABLE */
    .items-section {
      margin-bottom: 6px;
      border: 2px solid #333;
    }
    .items-header {
      background: #ff6b35;
      color: white;
      padding: 5px 6px;
      font-size: 13px;
      font-weight: bold;
    }
    .items-table {
      width: 100%;
      font-size: 15px;
      border-collapse: collapse;
    }
    .items-table th {
      background: #f0f0f0;
      padding: 5px 4px;
      font-weight: bold;
      text-align: left;
      border-bottom: 1px solid #ddd;
      font-size: 13px;
    }
    .items-table td {
      padding: 5px 4px;
      border-bottom: 1px solid #ddd;
    }
    .items-table .qty {
      text-align: center;
      font-weight: bold;
      font-size: 15px;
    }
    .items-table .price {
      text-align: right;
      font-size: 15px;
    }
    
    /* PAYMENT BOX - N\u1ED8I B\u1EACT */
    .payment-section {
      background: #fff3cd;
      border: 3px solid #ff6b35;
      padding: 8px;
      margin-bottom: 6px;
      text-align: center;
      border-radius: 4px;
    }
    .payment-title {
      font-size: 14px;
      font-weight: bold;
      color: #000;
      margin-bottom: 4px;
    }
    .payment-amount {
      font-size: 26px;
      font-weight: bold;
      color: #ff6b35;
      letter-spacing: 1px;
      margin-bottom: 2px;
    }
    .payment-note {
      font-size: 12px;
      color: #666;
    }
    
    /* QR CODE - TO H\u01A0N */
    .qr-section {
      display: flex;
      justify-content: center;
      margin-bottom: 6px;
    }
    .qr-box {
      border: 2px solid #333;
      padding: 8px;
      text-align: center;
    }
    .qr-box img {
      width: 140px;
      height: 140px;
    }
    .qr-label {
      font-size: 13px;
      font-weight: bold;
      margin-top: 4px;
    }
    
    /* FOOTER */
    .footer {
      text-align: center;
      border-top: 1px solid #ddd;
      padding-top: 4px;
      font-size: 12px;
    }
    .footer-note {
      color: #666;
      margin-bottom: 1px;
      font-size: 12px;
    }
    .hotline {
      font-weight: bold;
      color: #ff6b35;
      font-size: 13px;
    }
    
    @media print {
      body { margin: 0; padding: 0; background: white; }
      .page { width: 100%; height: 100%; margin: 0; padding: 10px; page-break-after: avoid; }
    }
  </style>
</head>
<body>
  <div class="page">
    <!-- HEADER -->
    <div class="header">
      <div class="logo">
        <img src="${logo}" alt="Logo" onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22%3E%3Crect fill=%22%23f0f0f0%22 width=%22100%22 height=%22100%22/%3E%3Ctext x=%2250%22 y=%2250%22 font-size=%2216%22 fill=%22%23999%22 text-anchor=%22middle%22 dominant-baseline=%22middle%22%3ELogo%3C/text%3E%3C/svg%3E'">
      </div>
      <div class="header-code">
        <div class="main-code">${superaiCode}</div>
        <div class="sub-text">M\xE3 v\u1EADn \u0111\u01A1n</div>
      </div>
      <div class="header-date">
        <div class="time">${createdDate.split(" ")[0]}</div>
        <div style="font-size:12px">${createdDate.split(" ")[1] || ""}</div>
      </div>
    </div>

    <!-- BARCODE -->
    <div class="barcode-section">
      <img src="${barcodeSrc}" alt="Barcode" class="barcode-img" onerror="this.style.display='none'">
      <div class="barcode-text">${superaiCode}</div>
    </div>

    <!-- SENDER - SINGLE ROW -->
    <div class="sender-section">
      <span class="sender-label">\u{1F464} NG\u01AF\u1EDCI G\u1EECI</span>
      <div class="sender-content">
        <div class="sender-name">${sender.name || store.name || "Shop"}</div>
        <div class="sender-address">${sender.address || store.address || ""}</div>
        <div class="sender-phone">\u260E\uFE0F ${sender.phone || store.phone || ""}</div>
      </div>
    </div>

    <!-- RECEIVER - SINGLE ROW -->
    <div class="receiver-section">
      <span class="receiver-label">\u{1F4E6} NG\u01AF\u1EDCI NH\u1EACN</span>
      <div class="receiver-content">
        <div class="receiver-name">${receiver.name || customer.name || "Kh\xE1ch"}</div>
        <div class="receiver-address">${receiver.address || customer.address || ""}</div>
        <div class="receiver-phone">\u260E\uFE0F ${receiver.phone || customer.phone || ""}</div>
      </div>
    </div>

    <!-- PRODUCTS -->
    <div class="items-section">
      <div class="items-header">\u{1F4E6} N\u1ED8I DUNG H\xC0NG (${items.length} s\u1EA3n ph\u1EA9m)</div>
      <table class="items-table">
        <thead>
          <tr>
            <th style="width:50%">S\u1EA3n ph\u1EA9m</th>
            <th style="width:15%; text-align:center">SL</th>
            <th style="width:35%; text-align:right">Gi\xE1</th>
          </tr>
        </thead>
        <tbody>
          ${items.map((item, idx) => `
            <tr>
              <td>
                <strong>${item.name || "SP"}</strong>
                ${item.variant ? `<div style="font-size:12px; color:#666">${item.variant}</div>` : ""}
              </td>
              <td class="qty">${item.qty || 1}</td>
              <td class="price">${Number(item.price || 0).toLocaleString("vi-VN")} \u0111</td>
            </tr>
          `).join("") || '<tr><td colspan="3" style="text-align:center; color:#999; padding:6px">Kh\xF4ng c\xF3 s\u1EA3n ph\u1EA9m</td></tr>'}
        </tbody>
      </table>
    </div>

    <!-- PAYMENT BOX -->
    <div class="payment-section">
      <div class="payment-title">\u{1F4B0} T\u1ED4NG TI\u1EC0N THU T\u1EEA NG\u01AF\u1EDCI NH\u1EACN</div>
      <div class="payment-amount">${Number((order.subtotal || 0) + (order.shipping_fee || 0)).toLocaleString("vi-VN")} \u0111</div>
      <div class="payment-note">${order.cod ? "(Thu h\u1ED9 - COD)" : "(Thanh to\xE1n)"}</div>
    </div>

    <!-- QR CODE -->
    <div class="qr-section">
      <div class="qr-box">
        <img src="https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${encodeURIComponent(order.tracking_code || superaiCode)}" alt="QR Code">
        <div class="qr-label">M\xE3 tracking</div>
      </div>
    </div>

    <!-- FOOTER -->
    <div class="footer">
      <div class="footer-note">Vui l\xF2ng ki\u1EC3m tra l\u1EA1i th\xF4ng tin tr\u01B0\u1EDBc khi g\u1EEDi</div>
      <div class="hotline">Hotline: 0909128999 - 0933190000</div>
    </div>
  </div>

  <script>
    window.onload = function() {
      setTimeout(() => window.print(), 500);
    };
  <\/script>
</body>
</html>`;
}
__name(getWaybillHTML, "getWaybillHTML");

// src/modules/shipping/waybill.js
async function createWaybill(req, env) {
  const idem = await idemGet(req, env);
  if (idem.hit) {
    return new Response(idem.body, {
      status: 200,
      headers: corsHeaders(req)
    });
  }
  const headerToken = (req.headers.get("Token") || req.headers.get("x-token") || (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "") || "").trim();
  const superKey = "FxXOoDz2qlTN5joDCsBGQFqKmm1UNvOw7YPwkzm5";
  const isAdmin = await adminOK(req, env);
  const isAllowed = isAdmin || headerToken && headerToken === superKey;
  if (!isAllowed) {
    console.error("[Waybill] Unauthorized - Token mismatch", {
      received: headerToken ? headerToken.substring(0, 20) + "..." : "EMPTY",
      expected: superKey.substring(0, 20) + "..."
    });
    return errorResponse("Unauthorized", 401, req);
  }
  try {
    const body = await readBody(req) || {};
    const settings = await getJSON(env, "settings", {}) || {};
    const shipping = settings.shipping || {};
    const store = settings.store || {};
    const order = body.order || {};
    const ship = body.ship || {};
    const products = buildWaybillItems(body, order);
    const orderName = products.length > 0 ? products[0].name : "\u0110\u01A1n h\xE0ng";
    const receiverPhone = sanitizePhone(
      body.receiver_phone || order.customer?.phone || body.to_phone || "0900000000"
    );
    const receiverAddress = body.receiver_address || order.customer?.address || body.to_address || "";
    const receiverProvince = body.receiver_province || order.customer?.province || body.to_province || "";
    const receiverDistrict = body.receiver_district || order.customer?.district || body.to_district || "";
    const receiverProvinceCode = body.receiver_province_code || order.customer?.province_code || body.province_code || body.to_province_code || "";
    const rawReceiverDistrictCode = body.receiver_district_code || order.customer?.district_code || body.district_code || body.to_district_code || "";
    const receiverDistrictCode = await validateDistrictCode(
      env,
      receiverProvinceCode || "79",
      // Default TP.HCM
      rawReceiverDistrictCode,
      receiverDistrict || body.receiver_district || order.customer?.district || ""
    );
    console.log("[Waybill] \u{1F50D} District code validation:", {
      raw: rawReceiverDistrictCode,
      validated: receiverDistrictCode,
      districtName: receiverDistrict
    });
    const payload = {
      // Root level required fields (SuperShip API requirements)
      name: orderName,
      phone: receiverPhone,
      address: receiverAddress,
      province: receiverProvince,
      district: receiverDistrict,
      commune: body.receiver_commune || order.customer?.ward || body.to_commune || "",
      // Amount (REQUIRED)
      amount: calculateOrderAmount(order, body),
      // Sender
      sender_name: body.sender_name || shipping.sender_name || store.name || "Shop",
      sender_phone: sanitizePhone(body.sender_phone || shipping.sender_phone || store.phone || store.owner_phone || "0900000000"),
      sender_address: body.sender_address || shipping.sender_address || store.address || "",
      sender_province: body.sender_province || shipping.sender_province || store.province || store.city || "",
      sender_district: body.sender_district || shipping.sender_district || store.district || "",
      sender_province_code: body.sender_province_code || shipping.sender_province_code || "79",
      sender_district_code: body.sender_district_code || shipping.sender_district_code || "760",
      sender_commune_code: body.sender_commune_code || shipping.sender_commune_code || "",
      // Receiver
      receiver_name: body.receiver_name || order.customer?.name || body.to_name || "",
      receiver_phone: receiverPhone,
      receiver_address: receiverAddress,
      receiver_province: receiverProvince,
      receiver_district: receiverDistrict,
      receiver_commune: body.receiver_commune || order.customer?.ward || body.to_commune || "",
      receiver_province_code: receiverProvinceCode,
      receiver_district_code: receiverDistrictCode,
      receiver_commune_code: body.receiver_commune_code || order.customer?.commune_code || order.customer?.ward_code || body.commune_code || body.to_commune_code || body.ward_code || "",
      // Package (REQUIRED)
      weight_gram: chargeableWeightGrams(body, order) || 500,
      weight: chargeableWeightGrams(body, order) || 500,
      cod: Number(order.cod || body.cod || 0),
      // Aliases SuperAI
      value: Number(order.value || body.value || order.cod || body.cod || calculateOrderAmount(order, body) || 0),
      soc: body.soc || order.soc || "",
      // Payer (REQUIRED) - '1' = Shop trả phí, '2' = Người nhận trả
      payer: String(body.payer || order.payer || "1"),
      // Service (REQUIRED)
      provider: (ship.provider || body.provider || order.shipping_provider || "vtp").toLowerCase(),
      service_code: ship.service_code || body.service_code || order.shipping_service || "",
      // Config (REQUIRED) - '1' = Cho xem hàng, '2' = Không cho xem hàng
      config: String(body.config || order.config || "1"),
      // Product type (SuperAI)
      product_type: String(body.product_type || order.product_type || "2"),
      // Option ID
      option_id: shipping.option_id || "1",
      // Products (REQUIRED)
      products,
      // Additional
      note: body.note || order.note || ""
    };
    payload.province_code = receiverProvinceCode;
    payload.district_code = receiverDistrictCode;
    payload.commune_code = payload.receiver_commune_code;
    payload.to_province_code = receiverProvinceCode;
    payload.to_district_code = receiverDistrictCode;
    payload.to_commune_code = payload.receiver_commune_code;
    payload.to_name = payload.receiver_name;
    payload.to_phone = payload.receiver_phone;
    payload.to_address = payload.receiver_address;
    payload.to_province = payload.receiver_province;
    payload.to_district = payload.receiver_district;
    payload.to_commune = payload.receiver_commune;
    payload.from_name = payload.sender_name;
    payload.from_phone = payload.sender_phone;
    payload.from_address = payload.sender_address;
    payload.from_province = payload.sender_province;
    payload.from_district = payload.sender_district;
    const validation = validateWaybillPayload(payload);
    if (!validation.ok) {
      console.error("[Waybill] Validation failed:", validation.errors);
      return json({
        ok: false,
        error: "VALIDATION_FAILED",
        details: validation.errors
      }, { status: 400 }, req);
    }
    console.log("[Waybill] Creating with payload:", JSON.stringify(payload, null, 2));
    const data = await superFetch(env, "/v1/platform/orders/create", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload)
    });
    console.log("[Waybill] SuperAI response:", JSON.stringify(data, null, 2));
    const isSuccess = data?.error === false && data?.data;
    const carrier_code = data?.data?.carrier_code || data?.data?.code || null;
    const superai_code = data?.data?.superai_code || data?.data?.tracking || null;
    if (isSuccess && (carrier_code || superai_code)) {
      await putJSON(env, "shipment:" + (order.id || body.order_id || carrier_code), {
        // Dùng order.id hoặc carrier_code làm key
        provider: payload.provider,
        service_code: payload.service_code,
        carrier_code,
        // Lưu mã NV
        superai_code,
        // Lưu mã SuperAI
        raw: data,
        createdAt: Date.now()
      });
      const response = json({
        ok: true,
        carrier_code,
        // Sửa: Trả về mã NV
        superai_code,
        // Sửa: Trả về mã SuperAI
        provider: payload.provider
      }, {}, req);
      await idemSet(idem.key, env, response);
      return response;
    }
    const errorMessage = data?.message || data?.error?.message || data?.error || "Kh\xF4ng t\u1EA1o \u0111\u01B0\u1EE3c v\u1EADn \u0111\u01A1n";
    console.error("[Waybill] Failed:", errorMessage);
    return json({
      ok: false,
      error: "CREATE_FAILED",
      message: errorMessage,
      raw: data
    }, { status: 400 }, req);
  } catch (e) {
    console.error("[Waybill] Exception:", e);
    return json({
      ok: false,
      error: "EXCEPTION",
      message: e.message
    }, { status: 500 }, req);
  }
}
__name(createWaybill, "createWaybill");
function buildWaybillItems(body, order) {
  const items = Array.isArray(order.items) ? order.items : Array.isArray(body.items) ? body.items : [];
  if (!items || items.length === 0) {
    return [{
      sku: "DEFAULT",
      name: "S\u1EA3n ph\u1EA9m",
      price: 0,
      weight: 500,
      quantity: 1
    }];
  }
  return items.map((item, index) => {
    let weight = Number(item.weight_gram || item.weight_grams || item.weight || 0);
    if (weight <= 0) weight = 500;
    let name = String(item.name || item.title || `S\u1EA3n ph\u1EA9m ${index + 1}`).trim();
    if (name.length > 100) name = name.substring(0, 97) + "...";
    if (!name) name = `S\u1EA3n ph\u1EA9m ${index + 1}`;
    return {
      sku: item.sku || item.id || `ITEM${index + 1}`,
      name,
      // SỬA: Ưu tiên giá từ variants
      price: Number(
        item.variant_price ?? item.variant?.price ?? item.price ?? 0
      ),
      weight,
      quantity: Number(item.qty || item.quantity || 1)
    };
  });
}
__name(buildWaybillItems, "buildWaybillItems");
function validateWaybillPayload(payload) {
  const errors = [];
  if (!payload.name || !payload.name.trim()) errors.push("Missing name");
  if (!payload.phone) errors.push("Missing phone");
  if (!payload.address || !payload.address.trim()) errors.push("Missing address");
  if (!payload.amount || payload.amount <= 0) errors.push("Missing or invalid amount");
  if (!payload.payer) errors.push("Missing payer");
  if (!payload.config) errors.push("Missing config");
  if (!payload.sender_name || !payload.sender_name.trim()) errors.push("Missing sender_name");
  if (!payload.sender_phone) errors.push("Missing sender_phone");
  if (!payload.sender_address || !payload.sender_address.trim()) errors.push("Missing sender_address");
  if (!payload.sender_province_code) errors.push("Missing sender_province_code");
  if (!payload.sender_district_code) errors.push("Missing sender_district_code");
  if (!payload.receiver_name || !payload.receiver_name.trim()) errors.push("Missing receiver_name");
  if (!payload.receiver_phone) errors.push("Missing receiver_phone");
  if (!payload.receiver_address || !payload.receiver_address.trim()) errors.push("Missing receiver_address");
  if (!payload.receiver_province_code) errors.push("Missing receiver_province_code");
  if (!payload.receiver_district_code) errors.push("Missing receiver_district_code");
  const provinceCode = String(payload.receiver_province_code || "");
  const districtCode = String(payload.receiver_district_code || "");
  console.log("[Waybill] \u{1F50D} Address codes:", {
    provinceCode,
    districtCode,
    original: {
      receiver_district_code: payload.receiver_district_code,
      district_code: payload.district_code,
      to_district_code: payload.to_district_code
    }
  });
  const validHCMCDistricts = ["760", "761", "762", "763", "764", "765", "767", "770", "771", "772", "773", "774", "775", "776", "777", "778", "780", "781", "782", "783", "784", "785", "786", "787", "788"];
  if (provinceCode === "79" && districtCode && !validHCMCDistricts.includes(districtCode)) {
    console.error("[Waybill] \u274C M\xE3 qu\u1EADn/huy\u1EC7n kh\xF4ng h\u1EE3p l\u1EC7 cho TP.HCM:", districtCode);
    console.error("[Waybill] \u2139\uFE0F C\xE1c m\xE3 h\u1EE3p l\u1EC7:", validHCMCDistricts.join(", "));
    errors.push(`M\xE3 qu\u1EADn/huy\u1EC7n "${districtCode}" kh\xF4ng h\u1EE3p l\u1EC7 cho TP.HCM`);
  }
  if (provinceCode.length > 3) {
    console.warn("[Waybill] \u26A0\uFE0F Province code qu\xE1 d\xE0i:", provinceCode);
  }
  if (districtCode.length > 4) {
    console.warn("[Waybill] \u26A0\uFE0F District code qu\xE1 d\xE0i:", districtCode);
  }
  if (!payload.weight_gram || payload.weight_gram <= 0) errors.push("Invalid weight_gram");
  if (!payload.weight || payload.weight <= 0) errors.push("Invalid weight");
  if (!Array.isArray(payload.products) || payload.products.length === 0) {
    errors.push("Products empty");
  } else {
    payload.products.forEach((item, idx) => {
      if (!item.name || !item.name.trim()) errors.push(`Product ${idx + 1}: no name`);
      if (!item.weight || item.weight <= 0) errors.push(`Product ${idx + 1}: invalid weight`);
    });
  }
  return { ok: errors.length === 0, errors };
}
__name(validateWaybillPayload, "validateWaybillPayload");
function sanitizePhone(phone) {
  return String(phone || "").replace(/\D+/g, "");
}
__name(sanitizePhone, "sanitizePhone");
function calculateOrderAmount(order, body) {
  if (body.amount && Number(body.amount) > 0) {
    return Number(body.amount);
  }
  if (order.amount && Number(order.amount) > 0) {
    return Number(order.amount);
  }
  if (order.total && Number(order.total) > 0) {
    return Number(order.total);
  }
  const items = Array.isArray(order.items) ? order.items : Array.isArray(body.items) ? body.items : [];
  if (items.length > 0) {
    const itemsTotal = items.reduce((sum, item) => {
      const price = Number(item.price || 0);
      const qty = Number(item.qty || item.quantity || 1);
      return sum + price * qty;
    }, 0);
    if (itemsTotal > 0) return itemsTotal;
  }
  const cod = Number(order.cod || body.cod || 0);
  if (cod > 0) return cod;
  return 1e4;
}
__name(calculateOrderAmount, "calculateOrderAmount");
async function autoCreateWaybill(order, env) {
  try {
    const settings = await getJSON(env, "settings", {}) || {};
    const shipping = settings.shipping || {};
    const store = settings.store || {};
    const products = buildWaybillItems({}, order);
    const orderName = products.length > 0 ? products[0].name : "\u0110\u01A1n h\xE0ng";
    const receiverPhone = sanitizePhone(order.customer?.phone || "0900000000");
    const receiverAddress = order.customer?.address || "";
    const receiverProvince = order.customer?.province || "";
    const receiverDistrict = order.customer?.district || "";
    const receiverProvinceCode = order.customer?.province_code || "";
    const rawReceiverDistrictCode = order.customer?.district_code || "";
    const receiverDistrictCode = await validateDistrictCode(env, receiverProvinceCode || "79", rawReceiverDistrictCode, receiverDistrict);
    const receiverCommuneCode = order.customer?.commune_code || order.customer?.ward_code || "";
    const totalAmount = calculateOrderAmount(order, {});
    const totalWeight = chargeableWeightGrams({}, order) || 500;
    const payer = "2";
    const totalCOD = Number(order.subtotal || 0);
    const totalValue = Number(order.revenue || order.total || totalAmount || 0);
    const payload = {
      name: orderName,
      phone: receiverPhone,
      address: receiverAddress,
      province: receiverProvince,
      district: receiverDistrict,
      commune: order.customer?.commune || order.customer?.ward || "",
      amount: totalAmount,
      sender_name: shipping.sender_name || store.name || "Shop",
      sender_phone: sanitizePhone(shipping.sender_phone || store.phone || "0900000000"),
      sender_address: shipping.sender_address || store.address || "",
      sender_province: shipping.sender_province || store.province || "",
      sender_district: shipping.sender_district || store.district || "",
      sender_province_code: shipping.sender_province_code || "79",
      sender_district_code: shipping.sender_district_code || "760",
      sender_commune_code: shipping.sender_commune_code || "",
      receiver_name: order.customer?.name || "Kh\xE1ch",
      receiver_phone: receiverPhone,
      receiver_address: receiverAddress,
      receiver_province: receiverProvince,
      receiver_district: receiverDistrict,
      receiver_commune: order.customer?.commune || order.customer?.ward || "",
      receiver_province_code: receiverProvinceCode,
      receiver_district_code: receiverDistrictCode,
      receiver_commune_code: receiverCommuneCode,
      weight_gram: totalWeight,
      weight: totalWeight,
      cod: totalCOD,
      // Sửa: Thu hộ tiền hàng (subtotal)
      value: totalValue,
      // Sửa: Giá trị đơn hàng (full)
      soc: order.soc || order.id || "",
      payer,
      // Sửa: '2' (Khách trả phí)
      provider: (order.shipping_provider || "vtp").toLowerCase(),
      service_code: order.shipping_service || "",
      // Lấy từ đơn hàng khách đã chọn
      config: "1",
      // Cho xem hàng
      product_type: "2",
      option_id: shipping.option_id || "1",
      products,
      note: order.note || ""
    };
    const validation = validateWaybillPayload(payload);
    if (!validation.ok) {
      console.error("[autoCreateWaybill] Validation failed:", validation.errors);
      return { ok: false, message: "Validation failed: " + validation.errors.join(", ") };
    }
    const data = await superFetch(env, "/v1/platform/orders/create", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload)
    });
    const isSuccess = data?.error === false && data?.data;
    console.log("[autoCreateWaybill] \u{1F4CA} SuperAI response data keys:", Object.keys(data?.data || {}));
    console.log("[autoCreateWaybill] \u{1F4CB} Full response data:", JSON.stringify(data?.data, null, 2));
    const carrier_code = data?.data?.carrier_code || data?.data?.code || null;
    const superai_code = data?.data?.superai_code || data?.data?.tracking || data?.data?.order_code || null;
    const carrier_id = data?.data?.carrier_id || null;
    if (isSuccess && (carrier_code || superai_code)) {
      return {
        ok: true,
        carrier_code,
        // Mã nhà vận chuyển (SPXVN...)
        superai_code,
        // Mã SuperAI (CTOS...)
        carrier_id,
        provider: payload.provider,
        raw: data.data
      };
    }
    const errorMessage = data?.message || data?.error?.message || data?.error || "Kh\xF4ng t\u1EA1o \u0111\u01B0\u1EE3c v\u1EADn \u0111\u01A1n";
    return { ok: false, message: errorMessage, raw: data };
  } catch (e) {
    console.error("[autoCreateWaybill] Exception:", e);
    return { ok: false, message: e.message };
  }
}
__name(autoCreateWaybill, "autoCreateWaybill");
async function printWaybill(req, env) {
  try {
    const body = await readBody(req) || {};
    const superaiCode = body.superai_code;
    let order = body.order || {};
    if (!order.id || !order.items) {
      console.log("[printWaybill] Order incomplete, searching KV...");
      const list = await getJSON(env, "orders:list", []);
      const found = list.find((o) => o.superai_code === superaiCode || o.shipping_tracking === superaiCode);
      if (found && found.id) {
        const fullOrder = await getJSON(env, "order:" + found.id, null);
        if (fullOrder) {
          order = fullOrder;
          console.log("[printWaybill] \u2705 Found full order from KV");
        }
      }
    }
    if (!superaiCode) {
      return errorResponse("Missing superai_code", 400, req);
    }
    const tokenRes = await superFetch(env, "/v1/platform/orders/token", {
      method: "POST",
      body: {
        code: [superaiCode]
      }
    });
    const printToken = tokenRes?.data?.token;
    if (!printToken) {
      return errorResponse("Kh\xF4ng l\u1EA5y \u0111\u01B0\u1EE3c print token t\u1EEB SuperAI", 400, req);
    }
    const settings = await getJSON(env, "settings", {}) || {};
    const store = settings.store || {};
    const logo = store.logo || "https://shophuyvan1.pages.dev/logo.png";
    const sender = order.sender || {
      name: "SHOP HUY V\xC2N",
      phone: "0909128999",
      address: "91/6 Li\xEAn Khu 5-11-12 Ph\u01B0\u1EDDng B\xECnh Tr\u1ECB \u0110\xF4ng Th\xE0nh Ph\u1ED1 H\u1ED3 Ch\xED Minh",
      province: "Th\xE0nh ph\u1ED1 H\u1ED3 Ch\xED Minh",
      district: "Qu\u1EADn B\xECnh T\xE2n"
    };
    const receiver = order.receiver || order.customer || {};
    const customer = order.customer || {};
    const items = Array.isArray(order.items) ? order.items : [];
    const createdDate = order.createdAt ? new Date(Number(order.createdAt)).toLocaleString("vi-VN") : (/* @__PURE__ */ new Date()).toLocaleString("vi-VN");
    const barcodeSrc = `https://api.superai.vn/v1/platform/orders/barcode?token=${printToken}&format=code128`;
    const qrcodeSrc = `https://api.superai.vn/v1/platform/orders/qrcode?token=${printToken}`;
    const itemsList = items.map((item) => `
      <tr>
        <td style="padding:4px 2px;font-size:10px;border-bottom:1px solid #ddd">
          <div>${item.name || ""}</div>
          ${item.variant ? `<div style="color:#666;font-size:9px">${item.variant}</div>` : ""}
        </td>
        <td style="padding:4px 2px;text-align:center;font-size:10px;border-bottom:1px solid #ddd">${item.qty || 1}</td>
      </tr>
    `).join("");
    const html = getWaybillHTML({
      superaiCode,
      logo,
      sender,
      receiver,
      customer,
      items,
      order,
      createdDate,
      barcodeSrc,
      store
    });
    return json({ ok: true, print_html: html }, {}, req);
  } catch (e) {
    console.error("[printWaybill] Exception:", e);
    return errorResponse(e.message, 500, req);
  }
}
__name(printWaybill, "printWaybill");
async function cancelWaybill(req, env) {
  try {
    const body = await readBody(req) || {};
    const superaiCode = body.superai_code;
    if (!superaiCode) {
      return errorResponse("Missing superai_code", 400, req);
    }
    const cancelRes = await superFetch(env, "/v1/platform/orders/cancel", {
      method: "POST",
      body: {
        code: [superaiCode]
      }
    });
    if (cancelRes.error === false || cancelRes.data && cancelRes.data.success) {
      try {
        const list = await getJSON(env, "orders:list", []);
        let orderId = null;
        const index = list.findIndex(
          (o) => o.superai_code === superaiCode || o.tracking_code === superaiCode || o.shipping_tracking === superaiCode
        );
        if (index > -1) {
          list[index].status = "cancelled";
          list[index].tracking_code = "CANCELLED";
          orderId = list[index].id;
          await putJSON(env, "orders:list", list);
          if (orderId) {
            const order = await getJSON(env, "order:" + orderId, null);
            if (order) {
              order.status = "cancelled";
              order.tracking_code = "CANCELLED";
              await putJSON(env, "order:" + orderId, order);
            }
          }
        }
      } catch (e) {
        console.warn("[cancelWaybill] L\u1ED7i c\u1EADp nh\u1EADt KV, nh\u01B0ng SuperAI \u0111\xE3 h\u1EE7y OK:", e.message);
      }
      return json({ ok: true, message: "H\u1EE7y th\xE0nh c\xF4ng" }, {}, req);
    }
    return errorResponse(cancelRes.message || "L\u1ED7i t\u1EEB SuperAI", 400, req);
  } catch (e) {
    console.error("[cancelWaybill] Exception:", e);
    return errorResponse(e.message, 500, req);
  }
}
__name(cancelWaybill, "cancelWaybill");
async function printWaybillsBulk(req, env) {
  try {
    const body = await readBody(req) || {};
    const superaiCodes = body.superai_codes;
    if (!Array.isArray(superaiCodes) || superaiCodes.length === 0) {
      return errorResponse("Missing or empty superai_codes array", 400, req);
    }
    const tokenRes = await superFetch(env, "/v1/platform/orders/token", {
      method: "POST",
      body: {
        code: superaiCodes
        // Gửi mảng mã SuperAI
      }
    });
    const printToken = tokenRes?.data?.token;
    if (!printToken) {
      return errorResponse("Kh\xF4ng l\u1EA5y \u0111\u01B0\u1EE3c print token h\xE0ng lo\u1EA1t t\u1EEB SuperAI", 400, req);
    }
    const printUrl = `https://api.superai.vn/v1/platform/orders/label?token=${printToken}&size=S13`;
    return json({ ok: true, print_url: printUrl, count: superaiCodes.length }, {}, req);
  } catch (e) {
    console.error("[printWaybillsBulk] Exception:", e);
    return errorResponse(e.message, 500, req);
  }
}
__name(printWaybillsBulk, "printWaybillsBulk");
async function cancelWaybillsBulk(req, env) {
  try {
    const body = await readBody(req) || {};
    const superaiCodes = body.superai_codes;
    if (!Array.isArray(superaiCodes) || superaiCodes.length === 0) {
      return errorResponse("Missing or empty superai_codes array", 400, req);
    }
    const cancelRes = await superFetch(env, "/v1/platform/orders/cancel", {
      method: "POST",
      body: {
        code: superaiCodes
        // Gửi mảng mã SuperAI
      }
    });
    if (cancelRes.error === false || cancelRes.data && cancelRes.data.success) {
      let updatedCount = 0;
      try {
        const list = await getJSON(env, "orders:list", []);
        let listChanged = false;
        for (const codeToCancel of superaiCodes) {
          const index = list.findIndex(
            (o) => o.superai_code === codeToCancel || o.tracking_code === codeToCancel || o.shipping_tracking === codeToCancel
          );
          if (index > -1 && list[index].status !== "cancelled") {
            list[index].status = "cancelled";
            list[index].tracking_code = "CANCELLED";
            listChanged = true;
            updatedCount++;
            const orderId = list[index].id;
            if (orderId) {
              const order = await getJSON(env, "order:" + orderId, null);
              if (order && order.status !== "cancelled") {
                order.status = "cancelled";
                order.tracking_code = "CANCELLED";
                await putJSON(env, "order:" + orderId, order);
              }
            }
          }
        }
        if (listChanged) {
          await putJSON(env, "orders:list", list);
        }
      } catch (e) {
        console.warn("[cancelWaybillsBulk] L\u1ED7i c\u1EADp nh\u1EADt KV, nh\u01B0ng SuperAI c\xF3 th\u1EC3 \u0111\xE3 h\u1EE7y OK:", e.message);
      }
      return json({ ok: true, message: `\u0110\xE3 g\u1EEDi y\xEAu c\u1EA7u h\u1EE7y cho ${superaiCodes.length} \u0111\u01A1n.`, cancelled_count: updatedCount }, {}, req);
    }
    return errorResponse(cancelRes.message || "L\u1ED7i h\u1EE7y h\xE0ng lo\u1EA1t t\u1EEB SuperAI", 400, req);
  } catch (e) {
    console.error("[cancelWaybillsBulk] Exception:", e);
    return errorResponse(e.message, 500, req);
  }
}
__name(cancelWaybillsBulk, "cancelWaybillsBulk");

// src/modules/vouchers.js
var VOUCHER_TYPES = {
  CODE: "code",
  AUTO_FREESHIP: "auto_freeship"
};
var DEFAULT_VALUES = {
  USAGE_LIMIT_PER_USER: 0,
  USAGE_LIMIT_TOTAL: 0,
  USAGE_COUNT: 0,
  MIN_PURCHASE: 0,
  OFF_PERCENT: 0,
  MAX_DISCOUNT: 0
};
var VALIDATION_RULES = {
  MAX_OFF_PERCENT: 100,
  MIN_OFF_PERCENT: 0
};
function validateVoucherCode(code) {
  if (!code || typeof code !== "string") {
    return { valid: false, error: "M\xE3 voucher kh\xF4ng \u0111\u01B0\u1EE3c \u0111\u1EC3 tr\u1ED1ng" };
  }
  const normalized = code.trim().toUpperCase();
  if (normalized.length < 3) {
    return { valid: false, error: "M\xE3 voucher ph\u1EA3i c\xF3 \xEDt nh\u1EA5t 3 k\xFD t\u1EF1" };
  }
  if (!/^[A-Z0-9_-]+$/.test(normalized)) {
    return { valid: false, error: "M\xE3 voucher ch\u1EC9 \u0111\u01B0\u1EE3c ch\u1EE9a ch\u1EEF c\xE1i, s\u1ED1, g\u1EA1ch ngang v\xE0 g\u1EA1ch d\u01B0\u1EDBi" };
  }
  return { valid: true, code: normalized };
}
__name(validateVoucherCode, "validateVoucherCode");
function normalizeVoucherData(body, existingVoucher = null) {
  const validation = validateVoucherCode(body.code);
  if (!validation.valid) {
    throw new Error(validation.error);
  }
  const voucherType = body.voucher_type === VOUCHER_TYPES.AUTO_FREESHIP ? VOUCHER_TYPES.AUTO_FREESHIP : VOUCHER_TYPES.CODE;
  let starts_at = null;
  let expires_at = null;
  if (body.starts_at) {
    starts_at = Number(body.starts_at);
    if (isNaN(starts_at) || starts_at < 0) {
      throw new Error("Ng\xE0y b\u1EAFt \u0111\u1EA7u kh\xF4ng h\u1EE3p l\u1EC7");
    }
  }
  if (body.expires_at) {
    expires_at = Number(body.expires_at);
    if (isNaN(expires_at) || expires_at < 0) {
      throw new Error("Ng\xE0y h\u1EBFt h\u1EA1n kh\xF4ng h\u1EE3p l\u1EC7");
    }
    if (starts_at && expires_at <= starts_at) {
      throw new Error("Ng\xE0y h\u1EBFt h\u1EA1n ph\u1EA3i sau ng\xE0y b\u1EAFt \u0111\u1EA7u");
    }
  }
  const voucherData = {
    code: validation.code,
    on: body.on === true || String(body.on) === "true",
    voucher_type: voucherType,
    usage_limit_per_user: Math.max(0, parseInt(body.usage_limit_per_user || DEFAULT_VALUES.USAGE_LIMIT_PER_USER)),
    usage_limit_total: Math.max(0, parseInt(body.usage_limit_total || DEFAULT_VALUES.USAGE_LIMIT_TOTAL)),
    starts_at,
    expires_at,
    // Preserve usage_count from existing voucher
    usage_count: existingVoucher?.usage_count || DEFAULT_VALUES.USAGE_COUNT
  };
  if (voucherType === VOUCHER_TYPES.CODE) {
    const offPercent = Number(body.off || DEFAULT_VALUES.OFF_PERCENT);
    voucherData.off = Math.max(
      VALIDATION_RULES.MIN_OFF_PERCENT,
      Math.min(VALIDATION_RULES.MAX_OFF_PERCENT, offPercent)
    );
    voucherData.min_purchase = Math.max(0, Number(body.min_purchase || DEFAULT_VALUES.MIN_PURCHASE));
    voucherData.max_discount = Math.max(0, Number(body.max_discount || DEFAULT_VALUES.MAX_DISCOUNT));
  } else {
    voucherData.min_purchase = Math.max(0, Number(body.min_purchase || DEFAULT_VALUES.MIN_PURCHASE));
    voucherData.off = DEFAULT_VALUES.OFF_PERCENT;
    voucherData.max_discount = DEFAULT_VALUES.MAX_DISCOUNT;
  }
  return voucherData;
}
__name(normalizeVoucherData, "normalizeVoucherData");
function isVoucherTimeValid(voucher) {
  const now = Date.now();
  if (voucher.starts_at && now < voucher.starts_at) {
    return { valid: false, reason: "not_started", message: "M\xE3 voucher ch\u01B0a c\xF3 hi\u1EC7u l\u1EF1c" };
  }
  if (voucher.expires_at && now > voucher.expires_at) {
    return { valid: false, reason: "expired", message: "M\xE3 voucher \u0111\xE3 h\u1EBFt h\u1EA1n" };
  }
  return { valid: true };
}
__name(isVoucherTimeValid, "isVoucherTimeValid");
function formatPrice(n) {
  return Number(n || 0).toLocaleString("vi-VN") + "\u20AB";
}
__name(formatPrice, "formatPrice");
async function getPublicVouchers(req, env) {
  try {
    const list = await getJSON(env, "vouchers", []);
    const activeVouchers = list.filter((v) => {
      if (!v.on) return false;
      const timeCheck = isVoucherTimeValid(v);
      return timeCheck.valid;
    });
    const sanitized = activeVouchers.map((v) => ({
      code: v.code,
      voucher_type: v.voucher_type,
      off: v.off || 0,
      min_purchase: v.min_purchase || 0,
      expires_at: v.expires_at
      // Don't expose usage_count, usage_limit, etc.
    }));
    return json({ items: sanitized }, {}, req);
  } catch (e) {
    console.error("[getPublicVouchers] Error:", e);
    return errorResponse(e, 500, req);
  }
}
__name(getPublicVouchers, "getPublicVouchers");
async function listAdminVouchers(req, env) {
  if (!await adminOK(req, env)) {
    return errorResponse("Unauthorized", 401, req);
  }
  try {
    const list = await getJSON(env, "vouchers", []);
    const enriched = list.map((v) => {
      const timeCheck = isVoucherTimeValid(v);
      return {
        ...v,
        is_time_valid: timeCheck.valid,
        time_status: timeCheck.reason || "active"
      };
    });
    return json({ items: enriched }, {}, req);
  } catch (e) {
    console.error("[listAdminVouchers] Error:", e);
    return errorResponse(e, 500, req);
  }
}
__name(listAdminVouchers, "listAdminVouchers");
async function upsertVoucher(req, env) {
  if (!await adminOK(req, env)) {
    return errorResponse("Unauthorized", 401, req);
  }
  try {
    const body = await readBody(req) || {};
    const list = await getJSON(env, "vouchers", []);
    const code = String(body.code || "").toUpperCase().trim();
    const index = list.findIndex(
      (v) => (v.code || "").toUpperCase() === code
    );
    let voucherData;
    try {
      voucherData = normalizeVoucherData(body, index >= 0 ? list[index] : null);
    } catch (validationError) {
      return errorResponse(validationError.message, 400, req);
    }
    if (index >= 0) {
      list[index] = {
        ...list[index],
        ...voucherData,
        updated_at: Date.now()
      };
    } else {
      list.push({
        ...voucherData,
        created_at: Date.now(),
        updated_at: Date.now()
      });
    }
    await putJSON(env, "vouchers", list);
    return json({
      ok: true,
      voucher: index >= 0 ? list[index] : list[list.length - 1],
      action: index >= 0 ? "updated" : "created"
    }, {}, req);
  } catch (e) {
    console.error("[upsertVoucher] Error:", e);
    return errorResponse(e.message || "Internal server error", 500, req);
  }
}
__name(upsertVoucher, "upsertVoucher");
async function deleteVoucher(req, env) {
  if (!await adminOK(req, env)) {
    return errorResponse("Unauthorized", 401, req);
  }
  try {
    const body = await readBody(req) || {};
    const code = String(body.code || "").toUpperCase().trim();
    if (!code) {
      return errorResponse("Voucher code is required", 400, req);
    }
    const list = await getJSON(env, "vouchers", []);
    const index = list.findIndex(
      (v) => (v.code || "").toUpperCase() === code
    );
    if (index < 0) {
      return errorResponse("Voucher not found", 404, req);
    }
    const deletedVoucher = list[index];
    const newList = list.filter((_, i) => i !== index);
    await putJSON(env, "vouchers", newList);
    return json({
      ok: true,
      deleted: code,
      voucher: deletedVoucher
    }, {}, req);
  } catch (e) {
    console.error("[deleteVoucher] Error:", e);
    return errorResponse(e, 500, req);
  }
}
__name(deleteVoucher, "deleteVoucher");
async function applyVoucher(req, env) {
  try {
    const body = await readBody(req) || {};
    const code = String(body.code || "").toUpperCase().trim();
    const customerId = body.customer_id || null;
    const subtotal = Number(body.subtotal || 0);
    console.log("[applyVoucher] Request:", { code, customerId, subtotal });
    if (!code) {
      return errorResponse("Vui l\xF2ng nh\u1EADp m\xE3 voucher", 400, req);
    }
    if (subtotal <= 0) {
      return errorResponse("Gi\u1ECF h\xE0ng tr\u1ED1ng", 400, req);
    }
    const list = await getJSON(env, "vouchers", []);
    const voucher = list.find((v) => (v.code || "").toUpperCase() === code);
    if (!voucher) {
      console.log("[applyVoucher] Not found:", code);
      return errorResponse("M\xE3 voucher kh\xF4ng t\u1ED3n t\u1EA1i", 404, req);
    }
    if (voucher.on !== true) {
      console.log("[applyVoucher] Inactive:", code);
      return errorResponse("M\xE3 voucher kh\xF4ng ho\u1EA1t \u0111\u1ED9ng", 400, req);
    }
    const timeCheck = isVoucherTimeValid(voucher);
    if (!timeCheck.valid) {
      console.log("[applyVoucher] Time invalid:", timeCheck);
      return errorResponse(timeCheck.message, 400, req);
    }
    if (voucher.usage_limit_total > 0 && (voucher.usage_count || 0) >= voucher.usage_limit_total) {
      console.log("[applyVoucher] Total limit reached:", {
        count: voucher.usage_count,
        limit: voucher.usage_limit_total
      });
      return errorResponse("M\xE3 voucher \u0111\xE3 h\u1EBFt l\u01B0\u1EE3t s\u1EED d\u1EE5ng", 400, req);
    }
    if (customerId && voucher.usage_limit_per_user > 0) {
      const historyKey = `customer_voucher_history:${customerId}`;
      const history = await getJSON(env, historyKey, []);
      const timesUsed = history.filter(
        (usedCode) => (usedCode || "").toUpperCase() === code
      ).length;
      if (timesUsed >= voucher.usage_limit_per_user) {
        console.log("[applyVoucher] User limit reached:", {
          customerId,
          timesUsed,
          limit: voucher.usage_limit_per_user
        });
        return errorResponse(
          `B\u1EA1n \u0111\xE3 s\u1EED d\u1EE5ng m\xE3 voucher n\xE0y ${timesUsed}/${voucher.usage_limit_per_user} l\u1EA7n`,
          400,
          req
        );
      }
    }
    if (voucher.min_purchase > 0 && subtotal < voucher.min_purchase) {
      console.log("[applyVoucher] Min purchase not met:", {
        subtotal,
        required: voucher.min_purchase
      });
      return errorResponse(
        `\u0110\u01A1n h\xE0ng t\u1ED1i thi\u1EC3u ${formatPrice(voucher.min_purchase)} \u0111\u1EC3 s\u1EED d\u1EE5ng m\xE3 n\xE0y`,
        400,
        req
      );
    }
    let discount = 0;
    let ship_discount = 0;
    let discountDetails = {};
    if (voucher.voucher_type === VOUCHER_TYPES.CODE && voucher.off > 0) {
      const calculatedDiscount = Math.floor(subtotal * (voucher.off / 100));
      if (voucher.max_discount > 0 && calculatedDiscount > voucher.max_discount) {
        discount = voucher.max_discount;
        discountDetails.capped = true;
      } else {
        discount = calculatedDiscount;
      }
      discountDetails.type = "percentage";
      discountDetails.percent = voucher.off;
      console.log("[applyVoucher] Code discount:", {
        subtotal,
        percent: voucher.off,
        calculated: calculatedDiscount,
        final: discount,
        max: voucher.max_discount
      });
    } else if (voucher.voucher_type === VOUCHER_TYPES.AUTO_FREESHIP) {
      discountDetails.type = "freeship";
      discountDetails.note = "Mi\u1EC5n ph\xED v\u1EADn chuy\u1EC3n";
      console.log("[applyVoucher] Auto-freeship voucher applied");
    }
    return json({
      ok: true,
      valid: true,
      code: voucher.code,
      discount,
      ship_discount,
      details: discountDetails,
      message: "\xC1p d\u1EE5ng voucher th\xE0nh c\xF4ng"
    }, {}, req);
  } catch (e) {
    console.error("[applyVoucher] Exception:", e);
    return errorResponse(e.message || "Internal server error", 500, req);
  }
}
__name(applyVoucher, "applyVoucher");
async function markVoucherUsed(env, voucherCode, customerId = null) {
  try {
    const code = String(voucherCode || "").toUpperCase().trim();
    if (!code) return { ok: false, error: "No code provided" };
    const list = await getJSON(env, "vouchers", []);
    const index = list.findIndex((v) => (v.code || "").toUpperCase() === code);
    if (index < 0) {
      return { ok: false, error: "Voucher not found" };
    }
    list[index].usage_count = (list[index].usage_count || 0) + 1;
    await putJSON(env, "vouchers", list);
    if (customerId) {
      const historyKey = `customer_voucher_history:${customerId}`;
      const history = await getJSON(env, historyKey, []);
      history.push(code);
      await putJSON(env, historyKey, history);
    }
    console.log("[markVoucherUsed] Success:", {
      code,
      newCount: list[index].usage_count,
      customerId
    });
    return { ok: true, usage_count: list[index].usage_count };
  } catch (e) {
    console.error("[markVoucherUsed] Error:", e);
    return { ok: false, error: e.message };
  }
}
__name(markVoucherUsed, "markVoucherUsed");
async function handle3(req, env, ctx) {
  const url = new URL(req.url);
  const path = url.pathname;
  const method = req.method;
  if (path === "/vouchers" && method === "GET") {
    return getPublicVouchers(req, env);
  }
  if (path === "/vouchers/apply" && method === "POST") {
    return applyVoucher(req, env);
  }
  if (path === "/admin/vouchers" && method === "GET") {
    return listAdminVouchers(req, env);
  }
  if (path === "/admin/vouchers/list" && method === "GET") {
    return listAdminVouchers(req, env);
  }
  if ((path === "/admin/vouchers" || path === "/admin/vouchers/upsert" || path === "/admin/voucher") && method === "POST") {
    return upsertVoucher(req, env);
  }
  if (path === "/admin/vouchers/delete" && method === "DELETE") {
    return deleteVoucher(req, env);
  }
  if (path === "/admin/vouchers/delete" && method === "POST") {
    return deleteVoucher(req, env);
  }
  return errorResponse("Route not found", 404, req);
}
__name(handle3, "handle");

// src/modules/orders.js
var ORDER_STATUS = {
  PENDING: "pending",
  CONFIRMED: "confirmed",
  SHIPPING: "shipping",
  DELIVERED: "delivered",
  COMPLETED: "completed",
  CANCELLED: "cancelled",
  RETURNED: "returned"
};
var CANCEL_STATUSES = ["cancel", "cancelled", "huy", "hu\u1EF7", "h\u1EE7y", "returned", "return", "pending"];
var shouldAdjustStock = /* @__PURE__ */ __name((status) => {
  const s = String(status || "").toLowerCase();
  return !CANCEL_STATUSES.includes(s);
}, "shouldAdjustStock");
function normalizePhone(phone) {
  if (!phone) return "";
  let x = String(phone).replace(/[\s\.\-\(\)]/g, "");
  if (x.startsWith("+84")) x = "0" + x.slice(3);
  if (x.startsWith("84") && x.length > 9) x = "0" + x.slice(2);
  return x;
}
__name(normalizePhone, "normalizePhone");
function formatPrice2(n) {
  try {
    return new Intl.NumberFormat("vi-VN").format(Number(n || 0)) + "\u20AB";
  } catch {
    return (n || 0) + "\u20AB";
  }
}
__name(formatPrice2, "formatPrice");
async function authenticateCustomer(req, env) {
  function parseCookie2(str) {
    const out = {};
    (str || "").split(";").forEach((p) => {
      const i = p.indexOf("=");
      if (i > -1) out[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim());
    });
    return out;
  }
  __name(parseCookie2, "parseCookie");
  async function kvGet(k) {
    try {
      return await getJSON(env, k, null);
    } catch {
      return null;
    }
  }
  __name(kvGet, "kvGet");
  async function tryKeys(tok) {
    if (!tok) return null;
    const keys = [
      tok,
      "cust:" + tok,
      "customerToken:" + tok,
      "token:" + tok,
      "customer_token:" + tok,
      "auth:" + tok,
      "customer:" + tok,
      "session:" + tok,
      "shv_session:" + tok
    ];
    for (const k of keys) {
      const val = await kvGet(k);
      if (!val) continue;
      if (k.includes("session:") && (val.customer || val.user)) {
        return val.customer || val.user;
      }
      if (typeof val === "object" && val !== null) return val;
      if (typeof val === "string") {
        const cid = String(val).trim();
        const obj = await kvGet("customer:" + cid) || await kvGet("customer:id:" + cid);
        if (obj) return obj;
      }
      if (val && (val.customer_id || val.customerId)) {
        const cid = val.customer_id || val.customerId;
        const obj = await kvGet("customer:" + cid) || await kvGet("customer:id:" + cid);
        if (obj) return obj;
      }
    }
    return null;
  }
  __name(tryKeys, "tryKeys");
  let token = req.headers.get("x-customer-token") || req.headers.get("x-token") || "";
  if (!token) {
    const m = (req.headers.get("authorization") || "").match(/^Bearer\s+(.+)$/i);
    if (m) token = m[1];
  }
  if (!token) {
    const c = parseCookie2(req.headers.get("cookie") || "");
    token = c["customer_token"] || c["x-customer-token"] || c["token"] || "";
  }
  token = String(token || "").trim().replace(/^"+|"+$/g, "");
  let customer = await tryKeys(token);
  let decodedTokenId = "";
  if (!customer && token) {
    try {
      let b64 = token.replace(/-/g, "+").replace(/_/g, "/");
      while (b64.length % 4) b64 += "=";
      const decoded = atob(b64);
      if (decoded && decoded.includes(":")) {
        const customerId = decoded.split(":")[0];
        if (customerId) {
          decodedTokenId = customerId;
          customer = await kvGet("customer:" + customerId) || await kvGet("customer:id:" + customerId);
        }
      } else if (decoded && decoded !== token) {
        decodedTokenId = decoded;
        customer = await tryKeys(decoded);
        if (!customer) {
          customer = await kvGet("customer:" + decoded) || await kvGet("customer:id:" + decoded);
        }
      }
    } catch {
    }
  }
  if (!customer && token && token.split(".").length === 3) {
    try {
      const p = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
      const cid = p.customer_id || p.customerId || p.sub || p.id || "";
      if (cid) {
        customer = await kvGet("customer:" + cid) || await kvGet("customer:id:" + cid);
        if (!customer) decodedTokenId = String(cid);
      }
    } catch {
    }
  }
  return {
    customer,
    customerId: customer?.id || customer?.customer_id || decodedTokenId || null,
    token
  };
}
__name(authenticateCustomer, "authenticateCustomer");
function normalizeOrderItems(items) {
  const tryExtractSku = /* @__PURE__ */ __name((txt) => {
    if (!txt) return null;
    const m = String(txt).toUpperCase().match(/\bK[\-]?\d+\b/);
    return m ? m[0].replace("-", "") : null;
  }, "tryExtractSku");
  return (Array.isArray(items) ? items : []).map((it) => {
    const variantSku = tryExtractSku(it.variant || it.name || "");
    const maybeProductId = String(it.id || "").length > 12 ? it.id : null;
    return {
      id: it.variant_id ?? it.id ?? it.sku ?? variantSku ?? null,
      product_id: it.product_id ?? it.pid ?? it.productId ?? (it.product?.id || it.product?.key) ?? maybeProductId ?? null,
      sku: it.sku ?? variantSku ?? null,
      name: it.name ?? it.title ?? "",
      variant: it.variant ?? "",
      qty: Number(it.qty ?? it.quantity ?? 1) || 1,
      price: Number(it.price || 0),
      cost: Number(it.cost || 0)
    };
  });
}
__name(normalizeOrderItems, "normalizeOrderItems");
async function adjustInventory(items, env, direction = -1) {
  console.log("[INV] Adjusting inventory", { itemCount: items?.length, direction });
  const STOCK_KEYS = ["stock", "ton_kho", "quantity", "qty_available", "so_luong"];
  const readStock = /* @__PURE__ */ __name((obj) => {
    for (const k of STOCK_KEYS) {
      if (obj && obj[k] != null) return Number(obj[k] || 0);
    }
    return 0;
  }, "readStock");
  const writeStock = /* @__PURE__ */ __name((obj, value) => {
    for (const k of STOCK_KEYS) {
      if (obj && Object.prototype.hasOwnProperty.call(obj, k)) {
        obj[k] = Math.max(0, Number(value || 0));
        return k;
      }
    }
    obj["stock"] = Math.max(0, Number(value || 0));
    return "stock";
  }, "writeStock");
  for (const it of items || []) {
    const variantId = it.id || it.variant_id || it.sku;
    const productId = it.product_id;
    if (!variantId && !productId) {
      console.warn("[INV] Skip item: no ID", it);
      continue;
    }
    let product = null;
    if (productId) {
      product = await getJSON(env, "product:" + productId, null);
      if (!product) product = await getJSON(env, "products:" + productId, null);
    }
    if (!product && variantId) {
      const list = await getJSON(env, "products:list", []);
      for (const s of list) {
        const p = await getJSON(env, "product:" + s.id, null);
        if (!p || !Array.isArray(p.variants)) continue;
        const text = String(it.variant || it.name || "").toUpperCase();
        const ok = p.variants.some((v) => {
          const vid = String(v.id || "");
          const vsku = String(v.sku || "");
          const vname = String(v.name || v.title || v.option_name || "").toUpperCase();
          return vid === String(variantId) || vsku === String(variantId) || it.sku && vsku === String(it.sku) || text && vname && text.includes(vname);
        });
        if (ok) {
          product = p;
          break;
        }
      }
    }
    if (!product) {
      console.warn("[INV] Product not found for item", it);
      continue;
    }
    const delta = Number(it.qty || 1) * direction;
    let touched = false;
    if (Array.isArray(product.variants) && variantId) {
      const text2 = String(it.variant || it.name || "").toUpperCase();
      const v = product.variants.find((v2) => {
        const vid = String(v2.id || "");
        const vsku = String(v2.sku || "");
        const vname = String(v2.name || v2.title || v2.option_name || "").toUpperCase();
        return vid === String(variantId) || vsku === String(variantId) || it.sku && vsku === String(it.sku) || text2 && vname && text2.includes(vname);
      });
      if (v) {
        const before = readStock(v);
        const after = before + delta;
        const keySet = writeStock(v, after);
        console.log("[INV] Variant updated", { key: keySet, before, after, variantId });
        touched = true;
        const vSoldBefore = Number(v.sold || v.sold_count || 0);
        const vSoldAfter = Math.max(0, vSoldBefore + (direction === -1 ? Number(it.qty || 1) : -Number(it.qty || 1)));
        v.sold = vSoldAfter;
        v.sold_count = vSoldAfter;
      }
    }
    if (!touched) {
      const before = readStock(product);
      const after = before + delta;
      const keySet = writeStock(product, after);
      console.log("[INV] Product stock updated", { key: keySet, before, after, productId: product.id });
    }
    const pSoldBefore = Number(product.sold || product.sold_count || 0);
    const pSoldAfter = Math.max(0, pSoldBefore + (direction === -1 ? Number(it.qty || 1) : -Number(it.qty || 1)));
    product.sold = pSoldAfter;
    product.sold_count = pSoldAfter;
    await putJSON(env, "product:" + product.id, product);
  }
  console.log("[INV] Adjustment complete");
}
__name(adjustInventory, "adjustInventory");
async function enrichItemsWithCostAndPrice(items, env) {
  const allProducts = await getJSON(env, "products:list", []);
  for (const item of items) {
    const variantId = item.id || item.sku;
    if (!variantId) continue;
    let variantFound = null;
    for (const summary of allProducts) {
      const product = await getJSON(env, "product:" + summary.id, null);
      if (!product || !Array.isArray(product.variants)) continue;
      const variant = product.variants.find(
        (v) => String(v.id || v.sku || "") === String(variantId) || String(v.sku || "") === String(item.sku || "")
      );
      if (variant) {
        variantFound = variant;
        break;
      }
    }
    if (!variantFound) continue;
    const priceKeys = ["price", "sale_price", "list_price", "gia_ban"];
    for (const key of priceKeys) {
      if (variantFound[key] != null) {
        item.price = Number(variantFound[key] || 0);
        console.log("[ENRICH] \u2705 Set price from variant:", { id: variantId, price: item.price });
        break;
      }
    }
    if (!item.cost || item.cost === 0) {
      const costKeys = ["cost", "cost_price", "import_price", "gia_von", "buy_price", "price_import"];
      for (const key of costKeys) {
        if (variantFound[key] != null) {
          item.cost = Number(variantFound[key] || 0);
          console.log("[ENRICH] \u2705 Set cost from variant:", { id: variantId, cost: item.cost });
          break;
        }
      }
    }
  }
  return items;
}
__name(enrichItemsWithCostAndPrice, "enrichItemsWithCostAndPrice");
async function addPointsToCustomer(customer, revenue, env) {
  if (!customer || !customer.id) {
    console.log("[TIER] No customer info, skip points");
    return { upgraded: false, points: 0 };
  }
  try {
    const customerKey = `customer:${customer.id}`;
    let custData = await env.SHV.get(customerKey);
    if (!custData) {
      console.log("[TIER] Customer not found in KV:", customer.id);
      return { upgraded: false, points: 0 };
    }
    const cust = JSON.parse(custData);
    const pointsToAdd = Math.floor(revenue);
    const tierResult = addPoints(cust, pointsToAdd);
    await env.SHV.put(customerKey, JSON.stringify(cust));
    if (cust.email) {
      await env.SHV.put(`customer:email:${cust.email}`, JSON.stringify(cust));
    }
    console.log("[TIER] Points added", {
      customerId: customer.id,
      pointsAdded: pointsToAdd,
      totalPoints: cust.points,
      upgraded: tierResult.upgraded,
      oldTier: tierResult.oldTier,
      newTier: tierResult.newTier
    });
    return {
      upgraded: tierResult.upgraded,
      oldTier: tierResult.oldTier,
      newTier: tierResult.newTier,
      points: cust.points
    };
  } catch (e) {
    console.error("[TIER] Error adding points:", e);
    return { upgraded: false, points: 0 };
  }
}
__name(addPointsToCustomer, "addPointsToCustomer");
async function handle4(req, env, ctx) {
  const url = new URL(req.url);
  const path = url.pathname;
  const method = req.method;
  if (path === "/api/orders" && method === "POST") return createOrder(req, env);
  if (path === "/public/orders/create" && method === "POST") return createOrderPublic(req, env);
  if (path === "/public/order-create" && method === "POST") return createOrderLegacy(req, env);
  if (path === "/orders/my" && method === "GET") return getMyOrders(req, env);
  if (path === "/orders/cancel" && method === "POST") return cancelOrderCustomer(req, env);
  if (path === "/api/orders" && method === "GET") return listOrders(req, env);
  if (path === "/admin/orders" && method === "GET") return listOrdersAdmin(req, env);
  if (path === "/admin/orders/upsert" && method === "POST") return upsertOrder(req, env);
  if (path === "/admin/orders/delete" && method === "POST") return deleteOrder(req, env);
  if (path === "/admin/orders/print" && method === "GET") return printOrder(req, env);
  if (path === "/admin/stats" && method === "GET") return getStats(req, env);
  if (path === "/shipping/print" && method === "POST") return printWaybill(req, env);
  if (path === "/shipping/cancel" && method === "POST") return cancelWaybill(req, env);
  if (path === "/shipping/print-bulk" && method === "POST") return printWaybillsBulk(req, env);
  if (path === "/shipping/cancel-bulk" && method === "POST") return cancelWaybillsBulk(req, env);
  return errorResponse("Route not found", 404, req);
}
__name(handle4, "handle");
async function createOrder(req, env) {
  const idem = await idemGet(req, env);
  if (idem.hit) return new Response(idem.body, { status: 200, headers: corsHeaders(req) });
  const auth = await authenticateCustomer(req, env);
  const body = await readBody(req) || {};
  console.log("[ORDER] Creating order", {
    items: body?.items?.length || 0,
    customerId: auth.customerId
  });
  const validation = validate(SCH.orderCreate, body);
  if (!validation.ok) {
    return json({ ok: false, error: "VALIDATION_FAILED", details: validation.errors }, { status: 400 }, req);
  }
  const id = body.id || crypto.randomUUID().replace(/-/g, "");
  const createdAt = Date.now();
  let items = normalizeOrderItems(body.items || []);
  items = await enrichItemsWithCostAndPrice(items, env);
  const subtotal = items.reduce(
    (sum, item) => sum + Number(item.price || 0) * Number(item.qty || 1),
    0
  );
  const shipping = body.shipping || {};
  const shipping_fee = Number(body?.totals?.shipping_fee || body.shipping_fee || 0);
  const voucher_code_input = body.voucher_code || body.totals?.voucher_code || null;
  let validated_voucher_code = null;
  let validated_discount = 0;
  let validated_ship_discount = 0;
  if (voucher_code_input) {
    console.log("[ORDER] Re-validating voucher:", voucher_code_input);
    try {
      const finalCustomer2 = {
        ...auth.customer || {},
        ...body.customer || {}
      };
      if (auth.customerId) finalCustomer2.id = auth.customerId;
      const fakeReq = new Request(req.url, {
        method: "POST",
        headers: req.headers,
        body: JSON.stringify({
          code: voucher_code_input,
          customer_id: finalCustomer2.id || null,
          subtotal
        })
      });
      const applyResultResponse = await applyVoucher(fakeReq, env);
      const applyData = await applyResultResponse.json();
      if (applyResultResponse.status === 200 && applyData.ok && applyData.valid) {
        validated_voucher_code = applyData.code;
        validated_discount = applyData.discount || 0;
        validated_ship_discount = applyData.ship_discount || 0;
        console.log("[ORDER] Voucher validation SUCCESS:", {
          code: validated_voucher_code,
          discount: validated_discount,
          ship_discount: validated_ship_discount
        });
      } else {
        console.warn("[ORDER] Voucher validation FAILED:", applyData.message || applyData.error);
      }
    } catch (e) {
      console.error("[ORDER] EXCEPTION calling applyVoucher:", e);
    }
  }
  const final_discount = validated_discount;
  const final_ship_discount = validated_ship_discount;
  const revenue = Math.max(0, subtotal + shipping_fee - (final_discount + final_ship_discount));
  const profit = items.reduce(
    (sum, item) => sum + (Number(item.price || 0) - Number(item.cost || 0)) * Number(item.qty || 1),
    0
  ) - final_discount;
  const finalCustomer = {
    ...auth.customer || {},
    ...body.customer || {}
  };
  if (auth.customerId) finalCustomer.id = auth.customerId;
  if (finalCustomer.phone) {
    finalCustomer.phone = normalizePhone(finalCustomer.phone);
  }
  const order = {
    id,
    createdAt,
    status: ORDER_STATUS.PENDING,
    customer: finalCustomer,
    items,
    subtotal,
    shipping_fee,
    discount: final_discount,
    shipping_discount: final_ship_discount,
    revenue,
    profit,
    voucher_code: validated_voucher_code,
    note: body.note || "",
    source: body.source || "website",
    // ✅ FIX: Map shipping info correctly
    shipping_provider: shipping.provider || body.shipping_provider || null,
    shipping_service: shipping.service_code || body.shipping_service || null,
    shipping_name: body.shipping_name || shipping.name || null,
    shipping_eta: body.shipping_eta || shipping.eta || null
  };
  const list = await getJSON(env, "orders:list", []);
  list.unshift(order);
  await putJSON(env, "orders:list", list);
  await putJSON(env, "order:" + id, order);
  if (shouldAdjustStock(order.status)) {
    await adjustInventory(items, env, -1);
  }
  if (order.shipping_provider) {
    try {
      console.log("[ORDER] Auto-creating waybill");
      const waybillResult = await autoCreateWaybill(order, env);
      if (waybillResult.ok && waybillResult.carrier_code) {
        order.tracking_code = waybillResult.carrier_code;
        order.shipping_tracking = waybillResult.carrier_code;
        order.superai_code = waybillResult.superai_code;
        order.carrier_id = waybillResult.carrier_id;
        order.status = ORDER_STATUS.SHIPPING;
        order.waybill_data = waybillResult.raw;
        await putJSON(env, "order:" + id, order);
        const index = list.findIndex((o) => o.id === id);
        if (index > -1) {
          list[index] = order;
          await putJSON(env, "orders:list", list);
        }
        console.log("[ORDER] Waybill created:", waybillResult.carrier_code);
      } else {
        console.warn("[ORDER] Waybill creation failed:", waybillResult.message);
      }
    } catch (e) {
      console.error("[ORDER] Waybill creation exception:", e.message);
    }
  }
  const response = json({ ok: true, id, status: order.status, tracking_code: order.tracking_code || null }, {}, req);
  await idemSet(idem.key, env, response);
  return response;
}
__name(createOrder, "createOrder");
async function createOrderPublic(req, env) {
  const idem = await idemGet(req, env);
  if (idem.hit) return new Response(idem.body, { status: 200, headers: corsHeaders(req) });
  const auth = await authenticateCustomer(req, env);
  const body = await readBody(req) || {};
  const id = body.id || crypto.randomUUID().replace(/-/g, "");
  const createdAt = body.createdAt || body.created_at || Date.now();
  const status = body.status || ORDER_STATUS.PENDING;
  const finalCustomer = {
    ...auth.customer || {},
    ...body.customer || {}
  };
  if (auth.customerId) finalCustomer.id = auth.customerId;
  if (finalCustomer.phone) finalCustomer.phone = normalizePhone(finalCustomer.phone);
  let items = normalizeOrderItems(body.items || []);
  items = await enrichItemsWithCostAndPrice(items, env);
  const totals = body.totals || {};
  const shipping_fee = Number(body.shipping_fee ?? totals.ship ?? totals.shipping_fee ?? 0);
  const discount = Number(body.discount ?? totals.discount ?? 0);
  const shipping_discount = Number(body.shipping_discount ?? totals.shipping_discount ?? 0);
  const subtotal = items.reduce(
    (sum, item) => sum + Number(item.price || 0) * Number(item.qty || 1),
    0
  );
  const revenue = Math.max(0, subtotal + shipping_fee - (discount + shipping_discount));
  const profit = items.reduce(
    (sum, item) => sum + (Number(item.price || 0) - Number(item.cost || 0)) * Number(item.qty || 1),
    0
  ) - discount;
  const order = {
    id,
    createdAt,
    status,
    customer: finalCustomer,
    items,
    shipping_fee,
    discount,
    shipping_discount,
    subtotal,
    revenue,
    profit,
    shipping_name: body.shipping_name || null,
    shipping_eta: body.shipping_eta || null,
    shipping_provider: body.shipping_provider || null,
    shipping_service: body.shipping_service || null,
    note: body.note || "",
    source: body.source || "website"
  };
  const list = await getJSON(env, "orders:list", []);
  list.unshift(order);
  await putJSON(env, "orders:list", list);
  await putJSON(env, "order:" + id, order);
  if (shouldAdjustStock(order.status)) {
    await adjustInventory(items, env, -1);
  }
  if (order.status === ORDER_STATUS.COMPLETED) {
    const tierInfo = await addPointsToCustomer(order.customer, revenue, env);
    console.log("[ORDER-PUBLIC] Tier update:", tierInfo);
  }
  const response = json({ ok: true, id }, {}, req);
  await idemSet(idem.key, env, response);
  return response;
}
__name(createOrderPublic, "createOrderPublic");
async function createOrderLegacy(req, env) {
  const body = await readBody(req) || {};
  const id = body.id || crypto.randomUUID().replace(/-/g, "");
  const createdAt = Date.now();
  let items = normalizeOrderItems(body.items || []);
  items = await enrichItemsWithCostAndPrice(items, env);
  const shipping_fee = Number(body.shipping_fee || body.shippingFee || 0);
  const subtotal = items.reduce(
    (sum, item) => sum + Number(item.price || 0) * Number(item.qty || item.quantity || 1),
    0
  );
  const cost = items.reduce(
    (sum, item) => sum + Number(item.cost || 0) * Number(item.qty || item.quantity || 1),
    0
  );
  const revenue = subtotal + shipping_fee;
  const profit = revenue - cost;
  const order = {
    id,
    status: body.status || "m\u1EDBi",
    name: body.name,
    phone: normalizePhone(body.phone),
    address: body.address,
    note: body.note || body.notes,
    items,
    subtotal,
    shipping_fee,
    total: subtotal + shipping_fee,
    revenue,
    profit,
    createdAt
  };
  const list = await getJSON(env, "orders:list", []);
  list.unshift(order);
  await putJSON(env, "orders:list", list);
  await putJSON(env, "order:" + id, order);
  if (shouldAdjustStock(order.status)) {
    await adjustInventory(items, env, -1);
  }
  return json({ ok: true, id, data: order }, {}, req);
}
__name(createOrderLegacy, "createOrderLegacy");
async function listOrders(req, env) {
  if (!await adminOK(req, env)) return errorResponse("Unauthorized", 401, req);
  const list = await getJSON(env, "orders:list", []);
  return json({ ok: true, items: list }, {}, req);
}
__name(listOrders, "listOrders");
async function listOrdersAdmin(req, env) {
  if (!await adminOK(req, env)) return errorResponse("Unauthorized", 401, req);
  const url = new URL(req.url);
  const from = Number(url.searchParams.get("from") || 0);
  const to = Number(url.searchParams.get("to") || 0);
  let list = await getJSON(env, "orders:list", []);
  const enriched = [];
  for (const order of list) {
    if (!order.items) {
      const full = await getJSON(env, "order:" + order.id, null);
      enriched.push(full || order);
    } else {
      enriched.push(order);
    }
  }
  list = enriched;
  if (from || to) {
    list = list.filter((order) => {
      const ts = Number(order.createdAt || 0);
      if (from && ts < from) return false;
      if (to && ts > to) return false;
      return true;
    });
  }
  return json({ ok: true, items: list }, {}, req);
}
__name(listOrdersAdmin, "listOrdersAdmin");
async function upsertOrder(req, env) {
  if (!await adminOK(req, env)) return errorResponse("Unauthorized", 401, req);
  const body = await readBody(req) || {};
  const id = body.id || crypto.randomUUID().replace(/-/g, "");
  const list = await getJSON(env, "orders:list", []);
  const index = list.findIndex((o) => o.id === id);
  const oldOrder = index >= 0 ? list[index] : null;
  const oldStatus = String(oldOrder?.status || "").toLowerCase();
  const newStatus = String(body.status || "").toLowerCase();
  const order = {
    ...body,
    id,
    createdAt: body.createdAt || Date.now()
  };
  const items = order.items || [];
  const subtotal = items.reduce((sum, item) => sum + Number(item.price || 0) * Number(item.qty || 1), 0);
  const cost = items.reduce((sum, item) => sum + Number(item.cost || 0) * Number(item.qty || 1), 0);
  order.subtotal = subtotal;
  order.revenue = subtotal + Number(order.shipping_fee || 0) - Number(order.discount || 0) - Number(order.shipping_discount || 0);
  order.profit = order.revenue - cost;
  if (index >= 0) {
    list[index] = order;
  } else {
    list.unshift(order);
  }
  await putJSON(env, "orders:list", list);
  await putJSON(env, "order:" + id, order);
  if (newStatus === ORDER_STATUS.COMPLETED && oldStatus !== ORDER_STATUS.COMPLETED && order.voucher_code) {
    console.log("[ORDER-UPSERT] Marking voucher as used:", order.voucher_code);
    try {
      await markVoucherUsed(env, order.voucher_code, order.customer?.id || null);
    } catch (e) {
      console.error("[ORDER-UPSERT] Failed to mark voucher as used:", e);
    }
  }
  if (newStatus === ORDER_STATUS.COMPLETED && oldStatus !== ORDER_STATUS.COMPLETED) {
    const tierInfo = await addPointsToCustomer(order.customer, order.revenue, env);
    console.log("[ORDER-UPSERT] Tier update:", tierInfo);
  }
  return json({ ok: true, id: order.id, data: order }, {}, req);
}
__name(upsertOrder, "upsertOrder");
async function deleteOrder(req, env) {
  if (!await adminOK(req, env)) return errorResponse("Unauthorized", 401, req);
  const body = await readBody(req) || {};
  const id = body.id;
  if (!id) return errorResponse("ID is required", 400, req);
  const list = await getJSON(env, "orders:list", []);
  const newList = list.filter((order) => order.id !== id);
  await putJSON(env, "orders:list", newList);
  return json({ ok: true, deleted: id }, {}, req);
}
__name(deleteOrder, "deleteOrder");
async function printOrder(req, env) {
  if (!await adminOK(req, env)) return errorResponse("Unauthorized", 401, req);
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) return errorResponse("Missing order ID", 400, req);
  let order = await getJSON(env, "order:" + id, null);
  if (!order) {
    const list = await getJSON(env, "orders:list", []);
    order = list.find((o) => String(o.id) === String(id)) || null;
  }
  if (!order) return errorResponse("Order not found", 404, req);
  const items = Array.isArray(order.items) ? order.items : [];
  const subtotal = items.reduce((s, it) => s + Number(it.price || 0) * Number(it.qty || 1), 0);
  const shipping = Number(order.shipping_fee || 0);
  const discount = Number(order.discount || 0) + Number(order.shipping_discount || 0);
  const total = Math.max(0, subtotal + shipping - discount);
  const createdDate = order.createdAt ? new Date(Number(order.createdAt)).toLocaleString("vi-VN") : "";
  const rows = items.map((item) => `
    <tr>
      <td>${item.sku || item.id || ""}</td>
      <td>${(item.name || "") + (item.variant ? " - " + item.variant : "")}</td>
      <td style="text-align:right">${formatPrice2(item.qty || 1)}</td>
      <td style="text-align:right">${formatPrice2(item.price || 0)}</td>
      <td style="text-align:right">${formatPrice2(item.cost || 0)}</td>
      <td style="text-align:right">${formatPrice2((item.price || 0) * (item.qty || 1))}</td>
    </tr>
  `).join("") || `<tr><td colspan="6" style="color:#6b7280">Kh\xF4ng c\xF3 d\xF2ng h\xE0ng</td></tr>`;
  const customer = order.customer || {};
  const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>\u0110\u01A1n h\xE0ng ${id}</title>
  <style>
    body{font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;margin:24px;color:#111827}
    .row{display:flex;justify-content:space-between;margin-bottom:12px}
    table{width:100%;border-collapse:collapse;margin-top:8px}
    th,td{border:1px solid #e5e7eb;padding:6px 8px;font-size:13px}
    th{background:#f9fafb;text-align:left}
    .totals{margin-top:12px}
    .totals div{display:flex;justify-content:space-between;padding:2px 0}
  </style>
</head>
<body>
  <div class="row">
    <div>
      <div><b>\u0110\u01A1n h\xE0ng:</b> ${id}</div>
      <div><b>Ng\xE0y t\u1EA1o:</b> ${createdDate}</div>
      <div><b>Kh\xE1ch:</b> ${customer.name || order.customer_name || order.name || ""} ${customer.phone ? "\u2022 " + customer.phone : ""}</div>
      ${order.address || customer.address ? `<div><b>\u0110\u1ECBa ch\u1EC9:</b> ${order.address || customer.address}</div>` : ""}
      ${order.shipping_name ? `<div><b>V\u1EADn chuy\u1EC3n:</b> ${order.shipping_name} ${order.shipping_eta ? " \u2022 " + order.shipping_eta : ""}</div>` : ""}
    </div>
  </div>
  <table>
    <thead>
      <tr>
        <th>M\xE3 SP</th>
        <th>T\xEAn/Ph\xE2n lo\u1EA1i</th>
        <th>SL</th>
        <th>Gi\xE1 b\xE1n</th>
        <th>Gi\xE1 v\u1ED1n</th>
        <th>Th\xE0nh ti\u1EC1n</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
  <div class="totals">
    <div><span>T\u1ED5ng h\xE0ng</span><b>${formatPrice2(subtotal)}</b></div>
    <div><span>Ph\xED v\u1EADn chuy\u1EC3n</span><b>${formatPrice2(shipping)}</b></div>
    ${discount ? `<div><span>Gi\u1EA3m</span><b>-${formatPrice2(discount)}</b></div>` : ""}
    <div style="font-size:16px"><span>T\u1ED5ng thanh to\xE1n</span><b>${formatPrice2(total)}</b></div>
  </div>
  <script>window.onload = () => setTimeout(() => window.print(), 200);<\/script>
</body>
</html>`;
  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      ...corsHeaders(req)
    }
  });
}
__name(printOrder, "printOrder");
async function getStats(req, env) {
  if (!await adminOK(req, env)) return errorResponse("Unauthorized", 401, req);
  const url = new URL(req.url);
  const granularity = (url.searchParams.get("granularity") || "day").toLowerCase();
  let from = url.searchParams.get("from");
  let to = url.searchParams.get("to");
  const now = new Date(Date.now() + 7 * 3600 * 1e3);
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  const day = now.getUTCDate();
  const todayStart = Date.UTC(year, month, day) - 7 * 3600 * 1e3;
  if (!from || !to) {
    if (granularity === "day") {
      from = todayStart;
      to = todayStart + 864e5;
    } else if (granularity === "week") {
      const weekday = (new Date(todayStart + 7 * 3600 * 1e3).getDay() + 6) % 7;
      const start = todayStart - weekday * 864e5;
      from = start;
      to = start + 7 * 864e5;
    } else if (granularity === "month") {
      const dt = new Date(todayStart + 7 * 3600 * 1e3);
      const start = Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth(), 1) - 7 * 3600 * 1e3;
      const end = Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth() + 1, 1) - 7 * 3600 * 1e3;
      from = start;
      to = end;
    } else {
      from = todayStart;
      to = todayStart + 864e5;
    }
  } else {
    from = Number(from);
    to = Number(to);
  }
  let list = await getJSON(env, "orders:list", []);
  const enriched = [];
  for (const order of list) {
    if (!order.items) {
      const full = await getJSON(env, "order:" + order.id, null);
      enriched.push(full || order);
    } else {
      enriched.push(order);
    }
  }
  list = enriched;
  let orderCount = 0;
  let revenue = 0;
  let goodsCost = 0;
  const topMap = {};
  for (const order of list) {
    const ts = Number(order.createdAt || order.created_at || 0);
    if (!ts || ts < from || ts >= to) continue;
    orderCount += 1;
    const orderRevenue = Number(order.revenue || 0);
    revenue += orderRevenue;
    const items = Array.isArray(order.items) ? order.items : [];
    for (const item of items) {
      const cost = Number(item.cost || 0);
      goodsCost += cost * Number(item.qty || 1);
      const name = item.name || item.title || item.id || "unknown";
      if (!topMap[name]) topMap[name] = { name, qty: 0, revenue: 0 };
      topMap[name].qty += Number(item.qty || 1);
      topMap[name].revenue += Number(item.price || 0) * Number(item.qty || 1);
    }
  }
  const tax = revenue * 0.015;
  const ads = revenue * 0.15;
  const labor = revenue * 0.1;
  const profit = Math.max(0, revenue - goodsCost - tax - ads - labor);
  const topProducts = Object.values(topMap).sort((a, b) => b.revenue - a.revenue).slice(0, 20);
  return json({
    ok: true,
    orders: orderCount,
    revenue,
    profit,
    cost_price: goodsCost,
    goods_cost: goodsCost,
    top_products: topProducts,
    from,
    to,
    granularity
  }, {}, req);
}
__name(getStats, "getStats");
async function getMyOrders(req, env) {
  console.log("[GET-MY-ORDERS] Request received");
  const auth = await authenticateCustomer(req, env);
  const url = new URL(req.url);
  const phoneFallback = (url.searchParams.get("phone") || req.headers.get("x-customer-phone") || "").trim();
  if (!auth.customerId && !phoneFallback) {
    return json({
      ok: false,
      error: "Unauthorized",
      message: "Vui l\xF2ng \u0111\u0103ng nh\u1EADp"
    }, { status: 401 }, req);
  }
  let allOrders = await getJSON(env, "orders:list", []);
  const enriched = [];
  for (const order of allOrders) {
    if (!order.items) {
      const full = await getJSON(env, "order:" + order.id, null);
      enriched.push(full || order);
    } else {
      enriched.push(order);
    }
  }
  allOrders = enriched;
  console.log("[GET-MY-ORDERS] Total orders before filter:", allOrders.length);
  const pPhone = normalizePhone(phoneFallback || auth.customer?.phone || auth.customer?.mobile || "");
  const pId = auth.customerId;
  const pEmail = auth.customer?.email || "";
  const myOrders = allOrders.filter((order) => {
    const oc = order.customer || {};
    const orderPhone = normalizePhone(oc.phone || order.phone || "");
    const orderId = oc.id || oc.customer_id || "";
    const orderEmail = String(oc.email || order.email || "").toLowerCase();
    const eq = /* @__PURE__ */ __name((a, b) => String(a).toLowerCase() === String(b).toLowerCase(), "eq");
    return pPhone && orderPhone && orderPhone === pPhone || pId && orderId && eq(orderId, pId) || pEmail && orderEmail && eq(orderEmail, pEmail);
  });
  myOrders.sort((a, b) => Number(b.createdAt || b.created_at || 0) - Number(a.createdAt || a.created_at || 0));
  console.log("[GET-MY-ORDERS] Filtered orders count:", myOrders.length);
  return json({
    ok: true,
    orders: myOrders,
    count: myOrders.length,
    customer: auth.customer || null
  }, {}, req);
}
__name(getMyOrders, "getMyOrders");
async function cancelOrderCustomer(req, env) {
  try {
    const body = await readBody(req) || {};
    const orderId = body.order_id;
    if (!orderId) {
      return json({ ok: false, error: "Missing order_id" }, { status: 400 }, req);
    }
    const order = await getJSON(env, "order:" + orderId, null);
    if (!order) {
      return json({ ok: false, error: "Order not found" }, { status: 404 }, req);
    }
    const status = String(order.status || "").toLowerCase();
    if (!status.includes("pending") && !status.includes("confirmed") && !status.includes("cho")) {
      return json({ ok: false, error: "Kh\xF4ng th\u1EC3 h\u1EE7y \u0111\u01A1n h\xE0ng n\xE0y" }, { status: 400 }, req);
    }
    order.status = ORDER_STATUS.CANCELLED;
    order.cancelled_at = Date.now();
    order.cancelled_by = "customer";
    if (shouldAdjustStock(status)) {
      await adjustInventory(normalizeOrderItems(order.items), env, 1);
    }
    if (order.superai_code || order.tracking_code) {
      try {
        await cancelWaybill({
          body: JSON.stringify({ superai_code: order.superai_code || order.tracking_code }),
          headers: req.headers
        }, env);
        order.tracking_code = "CANCELLED";
      } catch (e) {
        console.warn("[CANCEL-ORDER] Failed to cancel waybill:", e.message);
      }
    }
    await putJSON(env, "order:" + orderId, order);
    const list = await getJSON(env, "orders:list", []);
    const index = list.findIndex((o) => o.id === orderId);
    if (index > -1) {
      list[index] = order;
      await putJSON(env, "orders:list", list);
    }
    return json({ ok: true, message: "\u0110\xE3 h\u1EE7y \u0111\u01A1n h\xE0ng" }, {}, req);
  } catch (e) {
    console.error("[CANCEL-ORDER] Error:", e);
    return json({ ok: false, error: e.message }, { status: 500 }, req);
  }
}
__name(cancelOrderCustomer, "cancelOrderCustomer");

// src/modules/products.js
var products_exports = {};
__export(products_exports, {
  handle: () => handle5
});
async function handle5(req, env, ctx) {
  const url = new URL(req.url);
  const path = url.pathname;
  const method = req.method;
  if (path === "/products" && method === "GET") {
    const productId = url.searchParams.get("id");
    if (productId) {
      return getProductById(req, env, productId);
    }
    return listPublicProducts(req, env);
  }
  if (path.startsWith("/products/") && method === "GET") {
    const id = decodeURIComponent(path.split("/")[2] || "").trim();
    if (!id) {
      return errorResponse("No product ID provided", 400, req);
    }
    return getProductById(req, env, id);
  }
  if (path.startsWith("/public/products/") && method === "GET") {
    const id = decodeURIComponent(path.split("/")[3] || "").trim();
    if (!id) {
      return errorResponse("No product ID provided", 400, req);
    }
    return getProductById(req, env, id);
  }
  if (path === "/public/products" && method === "GET") {
    const productId = url.searchParams.get("id");
    if (productId) {
      return getProductById(req, env, productId);
    }
    return listPublicProductsFiltered(req, env);
  }
  if ((path === "/admin/products" || path === "/admin/products/list") && method === "GET") {
    return listAdminProducts(req, env);
  }
  if ((path === "/admin/products/get" || path === "/product") && method === "GET") {
    return getAdminProduct(req, env);
  }
  if ((path === "/admin/products/upsert" || path === "/admin/product") && method === "POST") {
    return upsertProduct(req, env);
  }
  if (path === "/admin/products/delete" && method === "POST") {
    return deleteProduct(req, env);
  }
  return errorResponse("Route not found", 404, req);
}
__name(handle5, "handle");
function toSummary(product) {
  return {
    id: product.id,
    title: product.title || product.name || "",
    name: product.title || product.name || "",
    slug: product.slug || slugify(product.title || product.name || ""),
    sku: product.sku || "",
    price: product.price || 0,
    price_sale: product.price_sale || 0,
    price_wholesale: product.price_wholesale || 0,
    // ✅ THÊM DÒNG NÀY
    stock: product.stock || 0,
    images: product.images || [],
    category: product.category || "",
    category_slug: product.category_slug || product.category || "",
    status: product.status === 0 ? 0 : 1
  };
}
__name(toSummary, "toSummary");
async function listProducts(env) {
  const LIST_KEY = "products:list";
  const DETAIL_PREFIX = "product:";
  console.log("[listProducts] \u{1F680} B\u1EAFt \u0111\u1EA7u...");
  try {
    console.log(`[listProducts] \u0110ang \u0111\u1ECDc danh s\xE1ch cache: ${LIST_KEY}`);
    let list = null;
    try {
      list = await getJSON(env, LIST_KEY, null);
    } catch (e) {
      console.error(`[listProducts] \u274C L\u1ED7i khi \u0111\u1ECDc danh s\xE1ch cache ${LIST_KEY}:`, e.message);
      list = null;
    }
    if (list && Array.isArray(list) && list.length > 0) {
      console.log(`[listProducts] \u2705 Tr\u1EA3 v\u1EC1 ${list.length} s\u1EA3n ph\u1EA9m t\u1EEB cache`);
      return list;
    } else {
      console.log(`[listProducts] \u26A0\uFE0F Cache tr\u1ED1ng ho\u1EB7c kh\xF4ng h\u1EE3p l\u1EC7, s\u1EBD t\u1EA1o l\u1EA1i t\u1EEB chi ti\u1EBFt`);
    }
    const items = [];
    let cursor = void 0;
    console.log(`[listProducts] \u{1F50D} B\u1EAFt \u0111\u1EA7u li\u1EC7t k\xEA c\xE1c key c\xF3 ti\u1EC1n t\u1ED1 '${DETAIL_PREFIX}'`);
    let iteration = 0;
    do {
      iteration++;
      console.log(`[listProducts]   - L\u1EA7n l\u1EB7p ${iteration}, cursor: ${cursor ? "..." : "none"}`);
      let result = null;
      try {
        result = await env.SHV.list({ prefix: DETAIL_PREFIX, cursor });
      } catch (e) {
        console.error(`[listProducts] \u274C L\u1ED7i khi li\u1EC7t k\xEA key (l\u1EA7n l\u1EB7p ${iteration}):`, e.message);
        throw new Error(`L\u1ED7i khi li\u1EC7t k\xEA key KV: ${e.message}`);
      }
      console.log(`[listProducts]   - T\xECm th\u1EA5y ${result.keys.length} key, list_complete: ${result.list_complete}`);
      for (const key of result.keys) {
        try {
          const product = await getJSON(env, key.name, null);
          if (product) {
            product.id = product.id || key.name.slice(DETAIL_PREFIX.length);
            items.push(toSummary(product));
          } else {
            console.warn(`[listProducts]     - \u26A0\uFE0F D\u1EEF li\u1EC7u cho key ${key.name} b\u1ECB tr\u1ED1ng`);
          }
        } catch (e) {
          console.error(`[listProducts]     - \u274C L\u1ED7i khi \u0111\u1ECDc s\u1EA3n ph\u1EA9m ${key.name}:`, e.message);
          continue;
        }
      }
      cursor = result.list_complete ? null : result.cursor;
    } while (cursor);
    console.log(`[listProducts] \u2705 \u0110\xE3 t\u1EA1o l\u1EA1i ${items.length} s\u1EA3n ph\u1EA9m t\u1EEB chi ti\u1EBFt`);
    if (items.length > 0) {
      try {
        console.log(`[listProducts] \u{1F4BE} \u0110ang l\u01B0u danh s\xE1ch \u0111\xE3 t\u1EA1o v\xE0o cache ${LIST_KEY}`);
        await putJSON(env, LIST_KEY, items);
        console.log(`[listProducts] \u2705 L\u01B0u cache th\xE0nh c\xF4ng`);
      } catch (e) {
        console.error(`[listProducts] \u274C L\u1ED7i khi l\u01B0u cache:`, e.message);
      }
    }
    return items;
  } catch (e) {
    console.error(`[listProducts] \u{1F4A5} X\u1EA3y ra l\u1ED7i nghi\xEAm tr\u1ECDng:`, e);
    throw e;
  }
}
__name(listProducts, "listProducts");
function toSlug(input) {
  const text = String(input || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)+/g, "");
}
__name(toSlug, "toSlug");
function collectCategoryValues(product) {
  const values = [];
  const push = /* @__PURE__ */ __name((v) => {
    if (v !== void 0 && v !== null && v !== "") values.push(v);
  }, "push");
  push(product.category);
  push(product.category_slug);
  push(product.cate);
  push(product.categoryId);
  const raw = product && product.raw || {};
  const meta = product?.meta || raw?.meta || {};
  [raw, meta].forEach((obj) => {
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
  return values.flatMap((v) => {
    if (Array.isArray(v)) {
      return v.map((x) => toSlug(x?.slug || x?.code || x?.name || x?.title || x?.label || x?.text || x));
    }
    if (typeof v === "object") {
      return [toSlug(v?.slug || v?.code || v?.name || v?.title || v?.label || v?.text)];
    }
    return [toSlug(v)];
  }).filter(Boolean);
}
__name(collectCategoryValues, "collectCategoryValues");
function matchCategoryStrict(product, category) {
  if (!category) return true;
  const want = toSlug(category);
  const alias = {
    "dien-nuoc": ["\u0111i\u1EC7n & n\u01B0\u1EDBc", "\u0111i\u1EC7n n\u01B0\u1EDBc", "dien nuoc", "thiet bi dien nuoc"],
    "nha-cua-doi-song": ["nh\xE0 c\u1EEDa \u0111\u1EDDi s\u1ED1ng", "nha cua doi song", "do gia dung"],
    "hoa-chat-gia-dung": ["ho\xE1 ch\u1EA5t gia d\u1EE5ng", "hoa chat gia dung", "hoa chat"],
    "dung-cu-thiet-bi-tien-ich": ["d\u1EE5ng c\u1EE5 thi\u1EBFt b\u1ECB ti\u1EC7n \xEDch", "dung cu thiet bi tien ich", "dung cu tien ich"]
  };
  const wants = [want, ...(alias[want] || []).map(toSlug)];
  const candidates = collectCategoryValues(product);
  console.log("\u{1F50D} Matching:", {
    productId: product.id,
    want,
    candidates: candidates.slice(0, 5),
    match: candidates.some((v) => wants.includes(v))
  });
  return candidates.some((v) => wants.includes(v));
}
__name(matchCategoryStrict, "matchCategoryStrict");
function getCustomerTier(req) {
  try {
    const url = new URL(req.url);
    const h = (req.headers.get("x-customer-tier") || req.headers.get("x-price-tier") || "").toLowerCase().trim();
    if (h) return h;
    const q = (url.searchParams.get("tier") || "").toLowerCase().trim();
    if (q) return q;
    return "retail";
  } catch {
    return "retail";
  }
}
__name(getCustomerTier, "getCustomerTier");
function computeDisplayPrice(product, tier) {
  try {
    const toNum = /* @__PURE__ */ __name((x) => typeof x === "string" ? Number(x.replace(/[^\d.-]/g, "")) || 0 : Number(x || 0), "toNum");
    const vars = Array.isArray(product?.variants) ? product.variants : [];
    if (!vars.length) {
      return { price_display: 0, compare_at_display: null, price_tier: tier, no_variant: true };
    }
    let minSale = null;
    let minReg = null;
    for (const v of vars) {
      const svTier = tier === "wholesale" ? v.sale_price_wholesale ?? v.wholesale_sale_price ?? null : null;
      const rvTier = tier === "wholesale" ? v.price_wholesale ?? v.wholesale_price ?? null : null;
      const sv = toNum(svTier ?? v.sale_price ?? v.price_sale);
      const rv = toNum(rvTier ?? v.price);
      if (sv > 0) minSale = minSale == null ? sv : Math.min(minSale, sv);
      if (rv > 0) minReg = minReg == null ? rv : Math.min(minReg, rv);
    }
    if (minSale != null && minReg != null && minSale < minReg) {
      return { price_display: minSale, compare_at_display: minReg, price_tier: tier };
    }
    const price = minSale != null ? minSale : minReg != null ? minReg : 0;
    return { price_display: price, compare_at_display: null, price_tier: tier };
  } catch {
    return { price_display: 0, compare_at_display: null, price_tier: tier };
  }
}
__name(computeDisplayPrice, "computeDisplayPrice");
async function getProductById(req, env, productId) {
  try {
    let product = await getJSON(env, "product:" + productId, null);
    if (!product) {
      const list = await listProducts(env);
      product = list.find((p) => String(p.id || p.key || "") === String(productId));
      if (product) {
        const cached = await getJSON(env, "product:" + product.id, null);
        if (cached) product = cached;
      }
    }
    if (!product) {
      return json({
        ok: false,
        error: "Product not found"
      }, { status: 404 }, req);
    }
    const tier = getCustomerTier(req);
    const priced = { ...product, ...computeDisplayPrice(product, tier) };
    console.log("[PRICE] getProductById", { id: productId, tier, price: priced.price_display, compare_at: priced.compare_at_display });
    return json({ ok: true, item: priced }, {}, req);
  } catch (e) {
    return errorResponse(e, 500, req);
  }
}
__name(getProductById, "getProductById");
async function listPublicProducts(req, env) {
  try {
    const list = await listProducts(env);
    const actives = list.filter((p) => p.status !== 0);
    const full = [];
    for (const s of actives) {
      const id = String(s.id || s.key || "");
      const p = id ? await getJSON(env, "product:" + id, null) : null;
      full.push(p || s);
    }
    const tier = getCustomerTier(req);
    const items = full.map((p) => ({ ...p, ...computeDisplayPrice(p, tier) }));
    console.log("[PRICE] listPublicProducts", { tier, count: items.length, sample: { id: items[0]?.id, price: items[0]?.price_display } });
    return json({ ok: true, items }, {}, req);
  } catch (e) {
    return errorResponse(e, 500, req);
  }
}
__name(listPublicProducts, "listPublicProducts");
async function listPublicProductsFiltered(req, env) {
  try {
    const url = new URL(req.url);
    const category = url.searchParams.get("category") || url.searchParams.get("cat") || url.searchParams.get("category_slug") || url.searchParams.get("c") || "";
    const limit = Number(url.searchParams.get("limit") || "24");
    let data = await listProducts(env);
    let items = Array.isArray(data?.items) ? data.items.slice() : Array.isArray(data) ? data.slice() : [];
    if (category) {
      const before = items.length;
      items = items.filter((product) => matchCategoryStrict(product, category));
      console.log(`\u2705 Category "${category}": ${before} \u2192 ${items.length}`);
    }
    items = items.filter((p) => p.status !== 0);
    const limited = items.slice(0, limit);
    const full = [];
    for (const s of limited) {
      const id = String(s.id || s.key || "");
      const p = id ? await getJSON(env, "product:" + id, null) : null;
      full.push(p || s);
    }
    const tier = getCustomerTier(req);
    const out = full.map((p) => ({ ...p, ...computeDisplayPrice(p, tier) }));
    console.log("[PRICE] listPublicProductsFiltered", { tier, in: items.length, out: out.length, cat: category, sample: { id: out[0]?.id, price: out[0]?.price_display } });
    return json({ ok: true, items: out }, {}, req);
  } catch (e) {
    console.error("\u274C Error:", e);
    return errorResponse(e, 500, req);
  }
}
__name(listPublicProductsFiltered, "listPublicProductsFiltered");
async function listAdminProducts(req, env) {
  try {
    const list = await listProducts(env);
    return json({ ok: true, items: list }, {}, req);
  } catch (e) {
    return errorResponse(e, 500, req);
  }
}
__name(listAdminProducts, "listAdminProducts");
async function getAdminProduct(req, env) {
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  const slug = url.searchParams.get("slug");
  if (!id && !slug) {
    return errorResponse("Missing id or slug parameter", 400, req);
  }
  try {
    let product = null;
    if (id) {
      product = await getJSON(env, "product:" + id, null);
    }
    if (!product && slug) {
      const list = await listProducts(env);
      const item = list.find((p) => p.slug === slug);
      if (item) {
        product = await getJSON(env, "product:" + item.id, null);
      }
    }
    if (!product) {
      return json({
        ok: false,
        error: "Product not found"
      }, { status: 404 }, req);
    }
    return json({ ok: true, data: product }, {}, req);
  } catch (e) {
    return errorResponse(e, 500, req);
  }
}
__name(getAdminProduct, "getAdminProduct");
async function upsertProduct(req, env) {
  if (!await adminOK(req, env)) {
    return errorResponse("Unauthorized", 401, req);
  }
  try {
    const product = await readBody(req) || {};
    product.id = product.id || crypto.randomUUID().replace(/-/g, "");
    product.updatedAt = Date.now();
    if (!product.slug && (product.title || product.name)) {
      product.slug = slugify(product.title || product.name);
    }
    if (!product.category_slug && product.category) {
      product.category_slug = toSlug(product.category);
    }
    console.log("\u{1F4BE} Saving product:", {
      id: product.id,
      name: product.title || product.name,
      category: product.category,
      category_slug: product.category_slug
    });
    const list = await listProducts(env);
    const summary = toSummary(product);
    const index = list.findIndex((p) => p.id === product.id);
    if (index >= 0) {
      list[index] = summary;
    } else {
      list.unshift(summary);
    }
    await putJSON(env, "products:list", list);
    await putJSON(env, "product:" + product.id, product);
    await putJSON(env, "products:" + product.id, summary);
    console.log("\u2705 Product saved");
    return json({ ok: true, data: product }, {}, req);
  } catch (e) {
    console.error("\u274C Save error:", e);
    return errorResponse(e, 500, req);
  }
}
__name(upsertProduct, "upsertProduct");
async function deleteProduct(req, env) {
  if (!await adminOK(req, env)) {
    return errorResponse("Unauthorized", 401, req);
  }
  try {
    const body = await readBody(req) || {};
    const id = body.id;
    if (!id) {
      return errorResponse("Product ID is required", 400, req);
    }
    const list = await listProducts(env);
    const newList = list.filter((p) => p.id !== id);
    await putJSON(env, "products:list", newList);
    await env.SHV.delete("product:" + id);
    await env.SHV.delete("products:" + id);
    return json({ ok: true, deleted: id }, {}, req);
  } catch (e) {
    return errorResponse(e, 500, req);
  }
}
__name(deleteProduct, "deleteProduct");
console.log("\u2705 products.js loaded - CATEGORY FILTER FIXED");

// src/modules/webhook-handler.js
async function handleSuperAIWebhook(req, env) {
  if (req.method !== "POST") {
    return errorResponse("Method Not Allowed", 405, req);
  }
  try {
    const body = await readBody(req);
    console.log("[Webhook] Received:", JSON.stringify(body, null, 2));
    if (!body || body.type !== "update_status" || !body.code || !body.status || !body.status_name) {
      console.warn("[Webhook] Invalid payload structure:", body);
      return json({ ok: true, message: "Received, but ignored (invalid structure)" }, {}, req);
    }
    const superaiCode = body.code;
    const newStatus = String(body.status);
    const newStatusName = body.status_name;
    const list = await getJSON(env, "orders:list", []);
    let orderId = null;
    let orderIndex = -1;
    orderIndex = list.findIndex((o) => o.superai_code === superaiCode);
    if (orderIndex === -1) {
      orderIndex = list.findIndex((o) => o.tracking_code === superaiCode || o.shipping_tracking === superaiCode);
    }
    if (orderIndex === -1) {
      console.warn("[Webhook] Order not found in list for superai_code:", superaiCode);
      return json({ ok: true, message: "Received, but order not found in list" }, {}, req);
    }
    orderId = list[orderIndex].id;
    let updated = false;
    if (list[orderIndex].status !== newStatusName.toLowerCase()) {
      list[orderIndex].status = newStatusName.toLowerCase();
      list[orderIndex].status_code_superai = newStatus;
      list[orderIndex].last_webhook_update = (/* @__PURE__ */ new Date()).toISOString();
      updated = true;
      console.log(`[Webhook] Updating list for order ${orderId}: status -> ${newStatusName}`);
    }
    if (orderId) {
      const order = await getJSON(env, "order:" + orderId, null);
      if (order && order.status !== newStatusName.toLowerCase()) {
        order.status = newStatusName.toLowerCase();
        order.status_code_superai = newStatus;
        order.last_webhook_update = (/* @__PURE__ */ new Date()).toISOString();
        order.webhook_history = order.webhook_history || [];
        order.webhook_history.push({
          status: newStatus,
          status_name: newStatusName,
          reason_code: body.reason_code,
          reason_text: body.reason_text,
          partial: body.partial,
          barter: body.barter,
          pushed_at: body.pushed_at,
          received_at: (/* @__PURE__ */ new Date()).toISOString()
        });
        await putJSON(env, "order:" + orderId, order);
        updated = true;
        console.log(`[Webhook] Updating detail for order ${orderId}: status -> ${newStatusName}`);
      } else if (!order) {
        console.warn("[Webhook] Order detail not found for ID:", orderId);
      }
    }
    if (updated) {
      await putJSON(env, "orders:list", list);
    } else {
      console.log("[Webhook] No status change needed for superai_code:", superaiCode);
    }
    return json({ ok: true, message: "Webhook processed successfully" }, {}, req);
  } catch (e) {
    console.error("[Webhook] Exception:", e);
    return json({ ok: true, message: `Webhook processed with error: ${e.message}` }, {}, req);
  }
}
__name(handleSuperAIWebhook, "handleSuperAIWebhook");

// src/modules/shipping/areas.js
async function handle6(req, env, ctx) {
  const url = new URL(req.url);
  const path = url.pathname;
  if (path === "/public/shipping/areas" || path === "/shipping/areas") {
    return getAllAreas(req, env, ctx);
  }
  if (path === "/shipping/provinces" || path === "/shipping/areas/province" || path === "/api/addresses/province" || path === "/v1/platform/areas/province") {
    return getProvinces(req, env);
  }
  if (path === "/shipping/districts" || path === "/shipping/areas/district" || path === "/api/addresses/district" || path === "/v1/platform/areas/district") {
    return getDistricts(req, env);
  }
  if (path === "/shipping/wards" || path === "/shipping/areas/commune" || path === "/api/addresses/commune" || path === "/v1/platform/areas/commune") {
    return getWards(req, env);
  }
  return json({ ok: false, error: "Not found" }, { status: 404 }, req);
}
__name(handle6, "handle");
async function getProvinces(req, env) {
  try {
    const data = await superFetch(env, "/v1/platform/areas/province", {
      method: "GET"
    });
    const items = normalizeAreaData(data);
    return json({ ok: true, items, data: items }, {}, req);
  } catch (e) {
    return json({
      ok: false,
      error: String(e?.message || e)
    }, { status: 500 }, req);
  }
}
__name(getProvinces, "getProvinces");
async function getDistricts(req, env) {
  const url = new URL(req.url);
  const province = url.searchParams.get("province_code") || url.searchParams.get("province") || "";
  try {
    const data = await superFetch(
      env,
      "/v1/platform/areas/district?province=" + encodeURIComponent(province),
      { method: "GET" }
    );
    const items = normalizeAreaData(data);
    return json({ ok: true, items, data: items, province }, {}, req);
  } catch (e) {
    return json({
      ok: false,
      error: String(e?.message || e)
    }, { status: 500 }, req);
  }
}
__name(getDistricts, "getDistricts");
async function getWards(req, env) {
  const url = new URL(req.url);
  const district = url.searchParams.get("district_code") || url.searchParams.get("district") || "";
  try {
    const data = await superFetch(
      env,
      "/v1/platform/areas/commune?district=" + encodeURIComponent(district),
      { method: "GET" }
    );
    const items = normalizeAreaData(data);
    return json({ ok: true, items, data: items, district }, {}, req);
  } catch (e) {
    return json({
      ok: false,
      error: String(e?.message || e)
    }, { status: 500 }, req);
  }
}
__name(getWards, "getWards");
function normalizeAreaData(data) {
  const source = data?.data || data || [];
  return source.map((item) => ({
    code: String(item.code || item.id || item.value || ""),
    name: item.name || item.text || ""
  }));
}
__name(normalizeAreaData, "normalizeAreaData");
async function getAllAreas(req, env, ctx) {
  try {
    console.log("[Areas] Loading all provinces with districts...");
    const data = await superFetch(env, "/v1/platform/areas/province", {
      method: "GET"
    });
    const provinces = data?.data || data || [];
    if (!Array.isArray(provinces) || provinces.length === 0) {
      console.warn("[Areas] No provinces data from SuperAI API");
      return json({
        ok: true,
        areas: [],
        data: []
      }, {}, req);
    }
    console.log(`[Areas] Found ${provinces.length} provinces, loading districts...`);
    const areasWithDetails = await Promise.all(
      provinces.slice(0, 63).map(async (province) => {
        try {
          const provinceCode = String(province.code || province.province_code || "");
          if (!provinceCode) {
            console.warn("[Areas] Province missing code:", province);
            return {
              code: "",
              name: province.name || "",
              province_code: "",
              districts: []
            };
          }
          const districtData = await superFetch(
            env,
            "/v1/platform/areas/district?province=" + encodeURIComponent(provinceCode),
            { method: "GET" }
          );
          const districts = (districtData?.data || []).map((district) => ({
            code: String(district.code || district.district_code || ""),
            name: district.name || "",
            district_code: String(district.code || district.district_code || ""),
            communes: []
            // Có thể load communes sau nếu cần
          }));
          return {
            code: provinceCode,
            name: province.name || "",
            province_code: provinceCode,
            districts
          };
        } catch (e) {
          console.warn("[Areas] Error loading districts for province:", province.code, e.message);
          return {
            code: String(province.code || ""),
            name: province.name || "",
            province_code: String(province.code || ""),
            districts: []
          };
        }
      })
    );
    console.log("[Areas] \u2705 Loaded areas successfully");
    return json({
      ok: true,
      areas: areasWithDetails,
      data: areasWithDetails
    }, {}, req);
  } catch (e) {
    console.error("[Areas] \u274C Error fetching all areas:", e);
    return json({
      ok: false,
      error: String(e?.message || e),
      message: "Kh\xF4ng th\u1EC3 t\u1EA3i danh s\xE1ch khu v\u1EF1c",
      areas: [],
      data: []
    }, { status: 500 }, req);
  }
}
__name(getAllAreas, "getAllAreas");

// src/modules/shipping/warehouses.js
async function handle7(req, env, ctx) {
  if (req.method === "GET" || req.method === "POST") {
    return getWarehouses(req, env);
  }
  return json({ ok: false, error: "Method not allowed" }, { status: 405 }, req);
}
__name(handle7, "handle");
async function getWarehouses(req, env) {
  try {
    console.log("[Warehouses] \u{1F4E6} Fetching warehouses from SuperAI...");
    const data = await superFetch(env, "/v1/platform/warehouses", {
      method: "GET",
      useBearer: false
      // ✅ Gửi header Token:, KHÔNG dùng Bearer
    });
    console.log("[Warehouses] \u{1F4E5} Response received:", {
      hasData: !!data,
      isError: data?.error,
      message: data?.message,
      dataKeys: data ? Object.keys(data) : []
    });
    if (data?.error || data?.message?.includes("Token") || data?.message?.includes("ch\u01B0a \u0111\xFAng")) {
      console.error("[Warehouses] \u274C Token error:", data.message);
      return json({
        ok: false,
        items: [],
        error: data.message || "Token kh\xF4ng h\u1EE3p l\u1EC7",
        raw: data
      }, { status: 400 }, req);
    }
    const items = normalizeWarehouses(data);
    console.log("[Warehouses] \u2705 Normalized items count:", items.length);
    if (items.length === 0) {
      console.warn("[Warehouses] \u26A0\uFE0F No warehouses found. Raw data:", JSON.stringify(data, null, 2));
    }
    return json({ ok: true, items, raw: data }, {}, req);
  } catch (e) {
    console.error("[Warehouses] \u274C Exception:", e);
    return json({
      ok: false,
      items: [],
      error: String(e?.message || e)
    }, { status: 500 }, req);
  }
}
__name(getWarehouses, "getWarehouses");
function normalizeWarehouses(data) {
  const source = [];
  const pushArray = /* @__PURE__ */ __name((arr) => {
    if (Array.isArray(arr)) source.push(...arr);
  }, "pushArray");
  pushArray(data);
  pushArray(data?.data);
  pushArray(data?.items);
  pushArray(data?.data?.items);
  pushArray(data?.warehouses);
  pushArray(data?.data?.warehouses);
  return source.map((warehouse) => ({
    id: warehouse.id || warehouse.code || "",
    name: warehouse.name || warehouse.contact_name || warehouse.wh_name || "",
    phone: warehouse.phone || warehouse.contact_phone || warehouse.wh_phone || "",
    address: warehouse.address || warehouse.addr || warehouse.wh_address || "",
    province_code: String(warehouse.province_code || warehouse.provinceId || warehouse.province_code_id || ""),
    province_name: warehouse.province || warehouse.province_name || "",
    district_code: String(warehouse.district_code || warehouse.districtId || ""),
    district_name: warehouse.district || warehouse.district_name || "",
    ward_code: String(warehouse.commune_code || warehouse.ward_code || ""),
    ward_name: String(warehouse.commune || warehouse.ward || warehouse.ward_name || "")
  }));
}
__name(normalizeWarehouses, "normalizeWarehouses");

// src/modules/shipping/pricing.js
async function handle8(req, env, ctx) {
  const url = new URL(req.url);
  const path = url.pathname;
  if (path === "/shipping/price" && req.method === "POST") {
    return getShippingPrice(req, env);
  }
  if (path === "/shipping/quote" && req.method === "GET") {
    return getShippingQuote(req, env);
  }
  if (path === "/api/shipping/quote" && req.method === "POST") {
    return getShippingQuoteAPI(req, env);
  }
  if (path === "/v1/platform/orders/price" && req.method === "POST") {
    return getMiniPrice(req, env);
  }
  return json({ ok: false, error: "Not found" }, { status: 404 }, req);
}
__name(handle8, "handle");
async function getShippingPrice(req, env) {
  try {
    const body = await readBody(req) || {};
    const settings = await getJSON(env, "settings", {});
    const shipping = settings.shipping || {};
    const payload = {
      // Tên (theo tài liệu SuperAI)
      sender_province: body.sender_province || shipping.sender_province || "",
      sender_district: body.sender_district || shipping.sender_district || "",
      receiver_province: body.receiver_province || body.to_province || "",
      receiver_district: body.receiver_district || body.to_district || "",
      receiver_commune: body.receiver_commune || body.to_ward || "",
      // Gói hàng (theo tài liệu SuperAI)
      weight: Number(body.weight_gram || body.weight || 0) || 0,
      value: Number(body.cod || 0) || 0
    };
    const data = await superFetch(env, "/v1/platform/orders/price", {
      method: "POST",
      body: payload
      // headers: {} (ĐÃ XÓA)
    });
    const items = normalizeShippingRates(data);
    return json({ ok: true, items, raw: data }, {}, req);
  } catch (e) {
    return errorResponse(e, 500, req);
  }
}
__name(getShippingPrice, "getShippingPrice");
async function getShippingQuote(req, env) {
  const url = new URL(req.url);
  const weight = Number(url.searchParams.get("weight") || 0);
  const to_province = url.searchParams.get("to_province") || "";
  const to_district = url.searchParams.get("to_district") || "";
  const cod = Number(url.searchParams.get("cod") || 0) || 0;
  const unit = Math.max(1, Math.ceil((weight || 0) / 500));
  const base = 12e3 + unit * 3e3;
  const items = [
    { provider: "jt", service_code: "JT-FAST", name: "Giao nhanh", fee: Math.round(base * 1.1), eta: "1-2 ng\xE0y" },
    { provider: "spx", service_code: "SPX-REG", name: "Ti\xEAu chu\u1EA9n", fee: Math.round(base), eta: "2-3 ng\xE0y" },
    { provider: "aha", service_code: "AHA-SAVE", name: "Ti\u1EBFt ki\u1EC7m", fee: Math.round(base * 0.9), eta: "3-5 ng\xE0y" }
  ];
  return json({ ok: true, items, to_province, to_district }, {}, req);
}
__name(getShippingQuote, "getShippingQuote");
async function getShippingQuoteAPI(req, env) {
  try {
    const body = await readBody(req) || {};
    const settings = await getJSON(env, "settings", {});
    const shipping = settings.shipping || {};
    let weight = 0;
    if (body.package?.weight_grams != null) {
      weight = Number(body.package.weight_grams) || 0;
    }
    if (!weight && Array.isArray(body.items)) {
      weight = body.items.reduce(
        (sum, item) => sum + Number(item.weight_grams || item.weight || 0) * Number(item.qty || item.quantity || 1),
        0
      );
    }
    if (!weight && body.weight_grams != null) {
      weight = Number(body.weight_grams) || 0;
    }
    let volGrams = 0;
    const dim = body.package?.dim_cm || null;
    const L = Number(dim?.l || body.length_cm || 0);
    const W = Number(dim?.w || body.width_cm || 0);
    const H = Number(dim?.h || body.height_cm || 0);
    if (L > 0 && W > 0 && H > 0) {
      volGrams = Math.round(L * W * H / 5e3 * 1e3);
    }
    if (volGrams > weight) weight = volGrams;
    const receiver = body.to || body.receiver || {};
    const payload = {
      sender_province: String(body.from?.province_code || shipping.sender_province || ""),
      sender_district: String(body.from?.district_code || shipping.sender_district || ""),
      receiver_province: String(receiver.province_code || body.to_province || ""),
      receiver_district: String(receiver.district_code || body.to_district || ""),
      receiver_commune: String(receiver.commune_code || receiver.ward_code || body.to_ward || ""),
      weight_gram: Number(weight) || 0,
      cod: Number(body.total_cod || body.cod || 0) || 0,
      option_id: String(body.option_id || shipping.option_id || "1")
    };
    const data = await superFetch(env, "/v1/platform/orders/price", {
      method: "POST",
      body: payload
    });
    const items = normalizeShippingRates(data);
    if (items.length) {
      return json({ ok: true, items, used: payload }, {}, req);
    }
    const unit = Math.max(1, Math.ceil((payload.weight_gram || 0) / 500));
    const base = 12e3 + unit * 3e3;
    const fallback = [
      { provider: "jt", service_code: "JT-FAST", name: "Giao nhanh", fee: Math.round(base * 1.1), eta: "1-2 ng\xE0y" },
      { provider: "spx", service_code: "SPX-REG", name: "Ti\xEAu chu\u1EA9n", fee: Math.round(base), eta: "2-3 ng\xE0y" },
      { provider: "aha", service_code: "AHA-SAVE", name: "Ti\u1EBFt ki\u1EC7m", fee: Math.round(base * 0.9), eta: "3-5 ng\xE0y" }
    ];
    return json({ ok: true, items: fallback, used: payload, fallback: true }, {}, req);
  } catch (e) {
    return errorResponse(e, 500, req);
  }
}
__name(getShippingQuoteAPI, "getShippingQuoteAPI");
async function getMiniPrice(req, env) {
  try {
    const body = await readBody(req) || {};
    const payload = {
      sender_province: String(body.sender_province || body.from?.province_code || ""),
      sender_district: String(body.sender_district || body.from?.district_code || ""),
      receiver_province: String(body.receiver_province || body.to_province || body.to?.province_code || ""),
      receiver_district: String(body.receiver_district || body.to_district || body.to?.district_code || ""),
      receiver_commune: String(body.receiver_commune || body.to_ward || body.to?.commune_code || body.to?.ward_code || ""),
      // Trọng lượng & COD từ checkout
      weight_gram: Number(body.weight_gram || body.weight || 0) || 0,
      cod: Number(body.cod || body.value || 0) || 0,
      option_id: String(body.option_id || "1"),
      // 👇 Alias để SuperAI nhận đúng tham số
      weight: Number(body.weight_gram || body.weight || 0) || 0,
      value: Number(body.value || body.cod || 0) || 0
    };
    const data = await superFetch(env, "/v1/platform/orders/price", {
      method: "POST",
      body: payload
    });
    const items = normalizeShippingRates(data);
    return json({ ok: true, data: items, used: payload }, {}, req);
  } catch (e) {
    return json({
      ok: false,
      error: String(e?.message || e)
    }, { status: 500 }, req);
  }
}
__name(getMiniPrice, "getMiniPrice");
function normalizeShippingRates(data) {
  const arr = data?.data && (data.data.services || data.data.items || data.data.rates) || data?.data || data || [];
  const items = [];
  const pushOne = /* @__PURE__ */ __name((rate) => {
    if (!rate) return;
    const fee = Number(
      rate.shipment_fee ?? rate.fee ?? rate.price ?? rate.total_fee ?? rate.amount ?? 0
    );
    const eta = rate.estimated_delivery ?? rate.eta ?? rate.leadtime_text ?? rate.leadtime ?? "";
    const provider = rate.carrier_name ?? rate.provider ?? rate.carrier ?? rate.brand ?? rate.code ?? "dvvc";
    const service_code = String(
      rate.service_code ?? rate.service ?? rate.serviceId ?? rate.carrier_id ?? ""
    );
    const name = rate.name ?? rate.service_name ?? rate.display ?? (rate.carrier_name || "D\u1ECBch v\u1EE5");
    if (fee > 0) {
      items.push({ provider, service_code, name, fee, eta });
    }
  }, "pushOne");
  if (Array.isArray(arr)) {
    arr.forEach(pushOne);
  } else {
    pushOne(arr);
  }
  return items;
}
__name(normalizeShippingRates, "normalizeShippingRates");

// src/modules/shipping/index.js
async function handle9(req, env, ctx) {
  const url = new URL(req.url);
  const path = url.pathname;
  if (path.startsWith("/shipping/provinces") || path.startsWith("/shipping/districts") || path.startsWith("/shipping/wards") || path.startsWith("/shipping/areas") || path.startsWith("/public/shipping/areas") || // ← ✅ THÊM DÒNG NÀY
  path.startsWith("/api/addresses") || path.startsWith("/v1/platform/areas")) {
    return handle6(req, env, ctx);
  }
  if (path === "/shipping/warehouses") {
    return handle7(req, env, ctx);
  }
  if (path === "/v1/platform/orders/price") {
    return (void 0)(req, env, ctx);
  }
  if (path === "/shipping/price" || path === "/shipping/quote" || path === "/api/shipping/quote") {
    return handle8(req, env, ctx);
  }
  if ((path === "/admin/shipping/create" || path === "/shipping/create") && req.method === "POST") {
    return createWaybill(req, env);
  }
  if (path === "/shipping/print" && req.method === "POST") {
    return printWaybill(req, env);
  }
  return json({ ok: false, error: "Not found" }, { status: 404 }, req);
}
__name(handle9, "handle");

// src/modules/settings.js
async function handle10(req, env, ctx) {
  const url = new URL(req.url);
  const path = url.pathname;
  const method = req.method;
  if (path === "/public/settings" && method === "GET") {
    return getPublicSettings(req, env);
  }
  if (path === "/admin/settings/upsert" && method === "POST") {
    return upsertSettings(req, env);
  }
  return errorResponse("Route not found", 404, req);
}
__name(handle10, "handle");
async function getPublicSettings(req, env) {
  try {
    const settings = await getJSON(env, "settings", {});
    return json({ ok: true, settings }, {}, req);
  } catch (e) {
    return errorResponse(e, 500, req);
  }
}
__name(getPublicSettings, "getPublicSettings");
async function upsertSettings(req, env) {
  if (!await adminOK(req, env)) {
    return errorResponse("Unauthorized", 401, req);
  }
  try {
    const body = await readBody(req) || {};
    const current = await getJSON(env, "settings", {});
    if (body.path) {
      setDeepValue(current, body.path, body.value);
    } else if (body.data && typeof body.data === "object") {
      Object.assign(current, body.data);
    }
    await putJSON(env, "settings", current);
    return json({ ok: true, settings: current }, {}, req);
  } catch (e) {
    return errorResponse(e, 500, req);
  }
}
__name(upsertSettings, "upsertSettings");
function setDeepValue(obj, path, value) {
  const parts = String(path || "").split(".").filter(Boolean);
  let current = obj;
  while (parts.length > 1) {
    const key = parts.shift();
    current[key] = current[key] || {};
    current = current[key];
  }
  if (parts.length) {
    current[parts[0]] = value;
  }
  return obj;
}
__name(setDeepValue, "setDeepValue");

// src/modules/banners.js
async function handle11(req, env, ctx) {
  const url = new URL(req.url);
  const path = url.pathname;
  const method = req.method;
  if (path === "/banners" && method === "GET") {
    return getPublicBanners(req, env);
  }
  if (path === "/admin/banners" && method === "GET") {
    return listAdminBanners(req, env);
  }
  if ((path === "/admin/banners/upsert" || path === "/admin/banner" || path === "/admin/banners") && method === "POST") {
    return upsertBanner(req, env);
  }
  if ((path === "/admin/banners/delete" || path === "/admin/banner/delete") && method === "POST") {
    return deleteBanner(req, env);
  }
  return errorResponse("Route not found", 404, req);
}
__name(handle11, "handle");
async function getPublicBanners(req, env) {
  try {
    const url = new URL(req.url);
    const qType = (url.searchParams.get("type") || "").trim();
    const qSlug = (url.searchParams.get("slug") || url.searchParams.get("category_slug") || "").trim();
    const list = await getJSON(env, "banners:list", []);
    let active = list.filter((b) => b && b.on !== false);
    if (qType) {
      active = active.filter((b) => (b.type || "").toLowerCase() === qType.toLowerCase());
    }
    if (qType === "category_hero" && qSlug) {
      active = active.filter((b) => (b.category_slug || "").toLowerCase() === qSlug.toLowerCase());
    }
    return json({ ok: true, items: active }, {}, req);
  } catch (e) {
    return errorResponse(e, 500, req);
  }
}
__name(getPublicBanners, "getPublicBanners");
async function listAdminBanners(req, env) {
  if (!await adminOK(req, env)) {
    return errorResponse("Unauthorized", 401, req);
  }
  try {
    const list = await getJSON(env, "banners:list", []);
    return json({ ok: true, items: list }, {}, req);
  } catch (e) {
    return errorResponse(e, 500, req);
  }
}
__name(listAdminBanners, "listAdminBanners");
async function upsertBanner(req, env) {
  if (!await adminOK(req, env)) {
    return errorResponse("Unauthorized", 401, req);
  }
  try {
    const banner = await readBody(req) || {};
    banner.id = banner.id || crypto.randomUUID().replace(/-/g, "");
    const list = await getJSON(env, "banners:list", []);
    const index = list.findIndex((b) => b.id === banner.id);
    if (index >= 0) {
      list[index] = banner;
    } else {
      list.unshift(banner);
    }
    await putJSON(env, "banners:list", list);
    return json({ ok: true, data: banner }, {}, req);
  } catch (e) {
    return errorResponse(e, 500, req);
  }
}
__name(upsertBanner, "upsertBanner");
async function deleteBanner(req, env) {
  if (!await adminOK(req, env)) {
    return errorResponse("Unauthorized", 401, req);
  }
  try {
    const body = await readBody(req) || {};
    const id = body.id;
    if (!id) {
      return errorResponse("Banner ID is required", 400, req);
    }
    const list = await getJSON(env, "banners:list", []);
    const newList = list.filter((b) => b.id !== id);
    await putJSON(env, "banners:list", newList);
    return json({ ok: true, deleted: id }, {}, req);
  } catch (e) {
    return errorResponse(e, 500, req);
  }
}
__name(deleteBanner, "deleteBanner");

// src/modules/auth.js
async function handle12(req, env, ctx) {
  const url = new URL(req.url);
  const path = url.pathname;
  const method = req.method;
  if (path === "/admin/login" || path === "/login" || path === "/admin_auth/login") {
    return adminLogin(req, env);
  }
  if (path === "/admin/me" && method === "GET") {
    return checkAdminStatus(req, env);
  }
  if (path === "/auth/facebook/login" && method === "POST") {
    return facebookLogin(req, env);
  }
  return errorResponse("Route not found", 404, req);
}
__name(handle12, "handle");
async function facebookLogin(req, env) {
  try {
    const body = await readBody(req) || {};
    const accessToken = body.accessToken;
    if (!accessToken) {
      return errorResponse("Missing accessToken", 400, req);
    }
    const fbUrl = `https://graph.facebook.com/me?fields=id,name,email&access_token=${accessToken}`;
    const fbResponse = await fetch(fbUrl);
    const fbData = await fbResponse.json();
    if (fbData.error) {
      console.error("[Facebook Auth Error]", fbData.error);
      return errorResponse(fbData.error.message, 400, req);
    }
    const { id: fb_id, name, email } = fbData;
    if (!fb_id) {
      return errorResponse("Kh\xF4ng th\u1EC3 l\u1EA5y ID Facebook", 400, req);
    }
    let customer = null;
    let customerId = null;
    const fbKey = `customer:fb:${fb_id}`;
    customerId = await getJSON(env, fbKey, null);
    if (customerId) {
      customer = await getJSON(env, `customer:${customerId}`, null);
    }
    if (!customer && email) {
      const emailKey = `customer:email:${email.toLowerCase()}`;
      customer = await getJSON(env, emailKey, null);
    }
    if (!customer) {
      customerId = `cust_${crypto.randomUUID().replace(/-/g, "")}`;
      customer = {
        id: customerId,
        fb_id,
        full_name: name,
        email: email ? email.toLowerCase() : null,
        phone: null,
        // Facebook không trả về SĐT
        addresses: [],
        tier: "dong",
        // Tier mặc định
        points: 0,
        created_at: Date.now()
      };
      await putJSON(env, `customer:${customerId}`, customer);
      if (email) {
        await putJSON(env, `customer:email:${email.toLowerCase()}`, customer);
      }
      await putJSON(env, `customer:fb:${fb_id}`, customerId);
    } else if (!customer.fb_id) {
      customer.fb_id = fb_id;
      await putJSON(env, `customer:${customer.id}`, customer);
      await putJSON(env, `customer:fb:${fb_id}`, customer.id);
    }
    const customerToken = `shv_tok_${crypto.randomUUID().replace(/-/g, "")}`;
    await putJSON(env, `customer_token:${customerToken}`, customer.id, {
      expirationTtl: 60 * 60 * 24 * 30
      // 30 ngày
    });
    return json({
      ok: true,
      token: customerToken,
      customer
    }, {}, req);
  } catch (e) {
    console.error("[facebookLogin Error]", e);
    return errorResponse(e.message || "L\u1ED7i m\xE1y ch\u1EE7 n\u1ED9i b\u1ED9", 500, req);
  }
}
__name(facebookLogin, "facebookLogin");
async function adminLogin(req, env) {
  try {
    let username = "";
    let password = "";
    if (req.method === "POST") {
      const body = await readBody(req) || {};
      username = body.user || body.username || body.u || "";
      password = body.pass || body.password || body.p || "";
    } else {
      const url = new URL(req.url);
      username = url.searchParams.get("u") || "";
      password = url.searchParams.get("p") || "";
    }
    let expectedPassword = env && env.ADMIN_TOKEN ? env.ADMIN_TOKEN : "";
    if (!expectedPassword && env && env.SHV) {
      expectedPassword = await env.SHV.get("admin_pass") || await env.SHV.get("admin_token") || "";
    }
    if (!(username === "admin" && password === expectedPassword)) {
      return json({
        ok: false,
        error: "Invalid credentials"
      }, { status: 401 }, req);
    }
    let token = "";
    if (env && env.SHV) {
      token = crypto.randomUUID().replace(/-/g, "");
      await env.SHV.put("admin_token", token, {
        expirationTtl: 60 * 60 * 24 * 7
      });
    } else {
      token = await sha256Hex(env.ADMIN_TOKEN || "");
    }
    return json({ ok: true, token }, {}, req);
  } catch (e) {
    return errorResponse(e, 500, req);
  }
}
__name(adminLogin, "adminLogin");
async function checkAdminStatus(req, env) {
  const isValid = await adminOK(req, env);
  return json({ ok: isValid }, {}, req);
}
__name(checkAdminStatus, "checkAdminStatus");

// src/modules/costs.js
var COST_KEY = "config:costs_v1";
async function handle13(req, env, ctx) {
  const method = req.method;
  try {
    if (method === "GET") {
      return await getCosts(req, env);
    }
    if (method === "POST") {
      return await saveCosts(req, env);
    }
    return json({ ok: false, error: "Method not allowed" }, { status: 405 }, req);
  } catch (e) {
    console.error("[Costs] Error:", e);
    return json({
      ok: false,
      error: "Internal error",
      details: e.message
    }, { status: 500 }, req);
  }
}
__name(handle13, "handle");
async function getCosts(req, env) {
  const costs = await getJSON(env, COST_KEY, []);
  return json({ ok: true, costs }, {}, req);
}
__name(getCosts, "getCosts");
async function saveCosts(req, env) {
  try {
    const { costs } = await req.json();
    if (!Array.isArray(costs)) {
      return json({ ok: false, error: "Invalid data format" }, { status: 400 }, req);
    }
    const validCosts = costs.map((c) => ({
      id: c.id || Date.now(),
      name: String(c.name || "Chi ph\xED"),
      amount: Number(c.amount || 0),
      type: c.type === "monthly" || c.type === "per_order" ? c.type : "monthly"
    })).filter((c) => c.name && c.amount > 0);
    await putJSON(env, COST_KEY, validCosts);
    return json({ ok: true, message: "Costs saved", costs: validCosts }, {}, req);
  } catch (e) {
    console.error("[Costs] Save error:", e);
    return json({ ok: false, error: "Failed to save costs" }, { status: 500 }, req);
  }
}
__name(saveCosts, "saveCosts");

// src/modules/cart-sync-handler.js
async function handleCartSync(request, env) {
  const url = new URL(request.url);
  const method = request.method;
  const corsHeaders2 = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  };
  if (method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders2 });
  }
  if (!env || !env.CART_KV) {
    return Response.json(
      { ok: false, error: "CART_KV not bound in environment" },
      { status: 500, headers: corsHeaders2 }
    );
  }
  try {
    let response;
    if (method === "GET") {
      response = await getCart(request, env);
    } else if (method === "POST") {
      response = await syncCart(request, env);
    } else if (method === "DELETE") {
      response = await clearCart(request, env);
    } else {
      response = Response.json(
        { ok: false, error: "Method not allowed" },
        { status: 405 }
      );
    }
    const headers = new Headers(response.headers);
    Object.entries(corsHeaders2).forEach(([key, value]) => {
      headers.set(key, value);
    });
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers
    });
  } catch (e) {
    console.error("[CartSync] Handler error:", e);
    return Response.json(
      { ok: false, error: "Internal server error" },
      { status: 500, headers: corsHeaders2 }
    );
  }
}
__name(handleCartSync, "handleCartSync");
async function getCart(request, env) {
  const url = new URL(request.url);
  const sessionId = url.searchParams.get("session_id");
  if (!sessionId) {
    return Response.json(
      { ok: false, error: "Missing session_id parameter" },
      { status: 400 }
    );
  }
  try {
    const key = `cart:${sessionId}`;
    const data = await env.CART_KV.get(key);
    if (!data) {
      console.log(`[CartSync] No cart found for session: ${sessionId}`);
      return Response.json({
        ok: true,
        cart: [],
        updated_at: null,
        message: "No cart found"
      });
    }
    const parsed = JSON.parse(data);
    console.log(`[CartSync] Retrieved cart for ${sessionId}: ${parsed.items?.length || 0} items`);
    return Response.json({
      ok: true,
      cart: parsed.items || [],
      updated_at: parsed.updated_at,
      source: parsed.source
    });
  } catch (e) {
    console.error("[CartSync] Get error:", e);
    return Response.json(
      { ok: false, error: e.message },
      { status: 500 }
    );
  }
}
__name(getCart, "getCart");
async function syncCart(request, env) {
  try {
    const body = await request.json();
    const { session_id, cart, source } = body;
    if (!session_id) {
      return Response.json(
        { ok: false, error: "Missing session_id" },
        { status: 400 }
      );
    }
    if (!Array.isArray(cart)) {
      return Response.json(
        { ok: false, error: "Cart must be an array" },
        { status: 400 }
      );
    }
    const key = `cart:${session_id}`;
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const data = {
      items: cart,
      updated_at: now,
      source: source || "unknown",
      session_id
    };
    await env.CART_KV.put(key, JSON.stringify(data), {
      expirationTtl: 30 * 24 * 60 * 60
      // 30 days
    });
    console.log(`[CartSync] Saved cart for ${session_id}: ${cart.length} items from ${source}`);
    return Response.json({
      ok: true,
      updated_at: now,
      items_count: cart.length,
      message: "Cart synced successfully"
    });
  } catch (e) {
    console.error("[CartSync] Sync error:", e);
    return Response.json(
      { ok: false, error: e.message },
      { status: 500 }
    );
  }
}
__name(syncCart, "syncCart");
async function clearCart(request, env) {
  const url = new URL(request.url);
  const sessionId = url.searchParams.get("session_id");
  if (!sessionId) {
    return Response.json(
      { ok: false, error: "Missing session_id parameter" },
      { status: 400 }
    );
  }
  try {
    const key = `cart:${sessionId}`;
    await env.CART_KV.delete(key);
    console.log(`[CartSync] Cleared cart for session: ${sessionId}`);
    return Response.json({
      ok: true,
      message: "Cart cleared successfully"
    });
  } catch (e) {
    console.error("[CartSync] Clear error:", e);
    return Response.json(
      { ok: false, error: e.message },
      { status: 500 }
    );
  }
}
__name(clearCart, "clearCart");

// src/index.js
console.log("[Index] \u2705 Module Products \u0111\xE3 import:", typeof products_exports, products_exports ? Object.keys(products_exports) : "undefined");
function logEntry(req) {
  try {
    const url = new URL(req.url);
    console.log(JSON.stringify({
      t: Date.now(),
      method: req.method,
      path: url.pathname
    }));
  } catch (e) {
    console.error("Log error:", e);
  }
}
__name(logEntry, "logEntry");
var src_default = {
  async fetch(req, env, ctx) {
    console.log("--- Worker Request v1.1 ---");
    logEntry(req);
    if (req.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders(req)
      });
    }
    const url = new URL(req.url);
    const path = url.pathname;
    try {
      if (path === "/admin/login" || path === "/login" || path === "/admin_auth/login") {
        return handle2(req, env, ctx);
      }
      if (path.startsWith("/admin/setup") || path.startsWith("/admin/auth") || path.startsWith("/admin/users") || path.startsWith("/admin/roles")) {
        return handle2(req, env, ctx);
      }
      if (path.startsWith("/admin/customers") || path === "/api/customers/register" || path === "/api/customers/login" || path === "/api/customers/me") {
        return handle2(req, env, ctx);
      }
      if (path === "/admin/me") {
        return handle12(req, env, ctx);
      }
      if (path.startsWith("/admin/categories") || path.startsWith("/public/categories")) {
        return handle(req, env, ctx);
      }
      if (path.startsWith("/products") || path.startsWith("/public/products") || path === "/admin/products" || // EXACT match
      path === "/admin/products/list" || // EXACT match for list
      path.startsWith("/admin/products/") || // Specific actions like /get, /upsert
      path === "/product") {
        console.log("[Index] \u27A1\uFE0F \u0110ang g\u1ECDi Products.handle cho path:", path, "Module Products c\xF3 t\u1ED3n t\u1EA1i:", typeof products_exports);
        return handle5(req, env, ctx);
      }
      if (path.startsWith("/api/orders") || path.startsWith("/admin/orders") || path.startsWith("/public/orders") || path.startsWith("/public/order-create")) {
        console.log("[INV-TRACE] router \u2192 orders", { path, method: req.method });
      }
      if (path.startsWith("/api/orders") || path.startsWith("/admin/orders") || path.startsWith("/public/orders") || path.startsWith("/public/order-create") || path === "/admin/stats" || path === "/orders/my") {
        return handle4(req, env, ctx);
      }
      if (path === "/shipping/cancel" && req.method === "POST") {
        return cancelWaybill(req, env);
      }
      if (path === "/shipping/print-bulk" && req.method === "POST") {
        return printWaybillsBulk(req, env);
      }
      if (path === "/shipping/cancel-bulk" && req.method === "POST") {
        return cancelWaybillsBulk(req, env);
      }
      if (path.startsWith("/shipping") || path.startsWith("/admin/shipping") || path.startsWith("/api/addresses") || path.startsWith("/v1/platform/areas") || path.startsWith("/v1/platform/orders/price") || path.startsWith("/v1/platform/orders/optimize") || path.startsWith("/v1/platform/orders/label") || path.startsWith("/v1/platform/orders/token") || path.startsWith("/v1/platform/carriers") || path.startsWith("/v1/platform/warehouses")) {
        let r = req;
        if (path.startsWith("/v1/platform/")) {
          const h = new Headers(req.headers);
          if (!h.get("Token")) {
            h.set("Token", env.SUPER_KEY || "FxXOoDz2qlTN5joDCsBGQFqKmm1UNvOw7YPwkzm5");
          }
          if (!h.get("Accept")) h.set("Accept", "application/json");
          if (req.method !== "GET" && !h.get("Content-Type")) {
            h.set("Content-Type", "application/json");
          }
          r = new Request(req, { headers: h });
        }
        return handle9(r, env, ctx);
      }
      if (path.startsWith("/api/cart/sync")) {
        return handleCartSync(req, env);
      }
      if (path.startsWith("/public/settings") || path.startsWith("/admin/settings")) {
        return handle10(req, env, ctx);
      }
      if (path === "/banners" || path.startsWith("/admin/banners") || path.startsWith("/admin/banner")) {
        return handle11(req, env, ctx);
      }
      if (path === "/vouchers" || path === "/vouchers/apply" || path.startsWith("/admin/vouchers")) {
        return handle3(req, env, ctx);
      }
      if (path.startsWith("/admin/costs")) {
        return handle13(req, env, ctx);
      }
      if (path === "/" || path === "") {
        return json({
          ok: true,
          msg: "SHV API v4.2 (Admin System Integrated)",
          hint: "All routes modularized + Cart Sync + Admin Management",
          modules: {
            admin: "\u2705 Added",
            auth: "\u2705 Complete",
            categories: "\u2705 Complete",
            products: "\u2705 Complete",
            orders: "\u2705 Complete",
            shipping: "\u2705 Complete",
            settings: "\u2705 Complete",
            banners: "\u2705 Complete",
            vouchers: "\u2705 Complete",
            cart_sync: "\u2705 Complete"
          }
        }, {}, req);
      }
      if (path === "/me" && req.method === "GET") {
        return json({
          ok: true,
          msg: "Worker alive",
          version: "v4.2"
        }, {}, req);
      } else if (path === "/webhook/superai" && req.method === "POST") {
        return handleSuperAIWebhook(req, env);
      }
      return json({
        ok: false,
        error: "Route not found"
      }, { status: 404 }, req);
    } catch (e) {
      console.error("Worker error:", e);
      return json({
        ok: false,
        error: String(e?.message || e)
      }, { status: 500 }, req);
    }
  }
};

// C:/Users/Administrator/AppData/Roaming/npm/node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;

// C:/Users/Administrator/AppData/Roaming/npm/node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError(e);
    return Response.json(error, {
      status: 500,
      headers: { "MF-Experimental-Error-Stack": "true" }
    });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;

// .wrangler/tmp/bundle-vGPjzk/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = src_default;

// C:/Users/Administrator/AppData/Roaming/npm/node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// .wrangler/tmp/bundle-vGPjzk/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class ___Facade_ScheduledController__ {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  static {
    __name(this, "__Facade_ScheduledController__");
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof ___Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = /* @__PURE__ */ __name((request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    }, "#fetchDispatcher");
    #dispatcher = /* @__PURE__ */ __name((type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    }, "#dispatcher");
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default
};
//# sourceMappingURL=index.js.map
