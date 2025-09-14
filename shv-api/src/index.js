
// SHV API Worker – v3 (CORS fixed + banners/vouchers/files + AI placeholders)
// Drop-in replacement for your Worker index.js
// - Allows 'x-token' header in CORS preflight
// - Handles OPTIONS for all routes
// - Token auth via /admin/login -> {ok:true, token}
// - Protected endpoints: /admin/me, /admin/files|upload|media, /admin/banners, /admin/vouchers, /admin/ai/*
// - Data persisted in KV (bind one of: SHV, DB, KV) under simple JSON keys.
//
// Bindings required (Cloudflare Dashboard → Settings → Variables):
// KV Namespace: one of SHV / DB / KV (any name; this code auto-detects)
// Optional: environment variable GEMINI_API_KEY (for AI endpoints)
//
// NOTE: Files are stored as base64 in KV for simplicity. Replace with R2/Images later if needed.

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // ---------- Helpers ----------
    const kv = env.SHV || env.DB || env.KV; // auto-detect KV namespace

    const allowOrigin = request.headers.get("Origin") || "*";
    const CORS = {
      "Access-Control-Allow-Origin": allowOrigin,
      "Vary": "Origin",
      "Access-Control-Allow-Credentials": "false",
      "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
      // IMPORTANT: allow 'x-token' so the admin UI can send auth in header
      "Access-Control-Allow-Headers": "content-type, x-token, x-requested-with",
      "Access-Control-Max-Age": "86400",
    };

    const ok = (body, init={}) =>
      new Response(JSON.stringify(body, null, 2), {
        headers: { "content-type": "application/json; charset=utf-8", ...CORS, ...(init.headers||{}) },
        status: init.status || 200,
      });

    const text = (body, init={}) =>
      new Response(body, { headers: { ...CORS, "content-type": "text/plain; charset=utf-8" }, status: init.status || 200 });

    const notFound = () => ok({ ok:false, error:"Not found" }, { status:404 });
    const bad = (msg="Bad request", code=400) => ok({ ok:false, error:msg }, { status: code });
    const genToken = () => Array.from(crypto.getRandomValues(new Uint8Array(16))).map(b=>b.toString(16).padStart(2,"0")).join("");

    async function getJSON() {
      const ct = request.headers.get("content-type") || "";
      if (ct.includes("application/json")) {
        try { return await request.json(); } catch { return {}; }
      }
      if (ct.includes("application/x-www-form-urlencoded")) {
        const form = await request.formData();
        const obj = {}; for (const [k,v] of form.entries()) obj[k]=v;
        return obj;
      }
      return {};
    }

    async function getFileFromForm() {
      const form = await request.formData().catch(()=>null);
      if (!form) return null;
      // try common field names
      const keys = ["file","image","photo","media","upload"];
      for (const k of keys) {
        const f = form.get(k);
        if (f && typeof f === "object" && "arrayBuffer" in f) return f;
      }
      // otherwise take first File found
      for (const [k,v] of form.entries()) {
        if (v && typeof v === "object" && "arrayBuffer" in v) return v;
      }
      return null;
    }

    async function requireAuth() {
      const token = request.headers.get("x-token") || url.searchParams.get("token") || "";
      if (!token) return null;
      const saved = await kv.get("admin_token");
      if (saved && saved === token) return token;
      return null;
    }

    // ---------- CORS preflight ----------
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS });
    }

    // ---------- Public health check ----------
    if (url.pathname === "/") {
      return ok({ ok:true, msg:"worker alive" });
    }

    // ---------- Auth: /admin/login  ----------
    if (url.pathname.startsWith("/admin/login")) {
      if (request.method === "GET") {
        return ok({ ok:true, msg:"login endpoint" });
      }
      if (request.method !== "POST") return bad("Method not allowed", 405);
      const { u, p } = await getJSON(); // expect {"u":"admin","p":"..."}
      // simple demo check: any user/pass accepted; replace with real check
      if (!u || !p) return bad("Missing credentials");
      const token = genToken();
      await kv.put("admin_token", token, { expirationTtl: 60*60*24*7 }); // 7 days
      return ok({ ok:true, token });
    }

    // ---------- Who am I ----------
    if (url.pathname === "/admin/me") {
      const token = await requireAuth();
      if (!token) return ok({ ok:false, error:"unauthorized" }, { status:401 });
      return ok({ ok:true, token });
    }

    // ---------- Protected routes below ----------
    const needsAuth = /^\/admin\/(files|upload|media|banners|vouchers|ai)/.test(url.pathname);
    if (needsAuth) {
      const token = await requireAuth();
      if (!token) return ok({ ok:false, error:"unauthorized" }, { status:401 });
    }

    // ---------- Files / Upload ----------
    if (url.pathname === "/admin/upload" || url.pathname === "/admin/files" || url.pathname === "/admin/media") {
      if (request.method !== "POST") return bad("Method not allowed", 405);
      const file = await getFileFromForm();
      if (!file) return bad("Missing file in form-data");
      const ab = await file.arrayBuffer();
      const b64 = btoa(String.fromCharCode(...new Uint8Array(ab)));
      const id = `f_${Date.now()}_${Math.random().toString(36).slice(2,8)}`;
      await kv.put(`file:${id}`, JSON.stringify({ id, name:file.name, type:file.type, b64 }), { expirationTtl: 60*60*24*30 });
      // return data URL (front-end can save this or upload to your CDN later)
      return ok({ ok:true, id, url:`data:${file.type};base64,${b64}` });
    }

    // ---------- Banners ----------
    if (url.pathname === "/admin/banners") {
      if (request.method === "GET") {
        const raw = await kv.get("banners");
        return ok({ ok:true, items: raw ? JSON.parse(raw) : [] });
      }
      if (request.method === "POST") {
        const body = await getJSON(); // {id?, img, alt, link, pos, sort, active}
        const raw = await kv.get("banners");
        const items = raw ? JSON.parse(raw) : [];
        if (!body.id) body.id = "b_" + Date.now();
        const idx = items.findIndex(x=>x.id===body.id);
        if (idx >= 0) items[idx] = { ...items[idx], ...body };
        else items.push(body);
        await kv.put("banners", JSON.stringify(items));
        return ok({ ok:true, items });
      }
      if (request.method === "DELETE") {
        const id = url.searchParams.get("id");
        const raw = await kv.get("banners");
        const items = raw ? JSON.parse(raw) : [];
        const filtered = items.filter(x=>x.id!==id);
        await kv.put("banners", JSON.stringify(filtered));
        return ok({ ok:true, items: filtered });
      }
      return bad("Method not allowed", 405);
    }

    // ---------- Vouchers ----------
    if (url.pathname === "/admin/vouchers" || url.pathname === "/admin/vouchers/upsert") {
      if (request.method === "GET") {
        const raw = await kv.get("vouchers");
        return ok({ ok:true, items: raw ? JSON.parse(raw) : [] });
      }
      if (request.method === "POST") {
        const v = await getJSON(); // {code, name, type, value, min, maxUse, start, end, active}
        if (!v.code) return bad("Missing code");
        const raw = await kv.get("vouchers");
        const items = raw ? JSON.parse(raw) : [];
        const idx = items.findIndex(x=>x.code===v.code);
        if (idx >= 0) items[idx] = { ...items[idx], ...v };
        else items.push(v);
        await kv.put("vouchers", JSON.stringify(items));
        return ok({ ok:true, items });
      }
      if (request.method === "DELETE") {
        const code = url.searchParams.get("code");
        const raw = await kv.get("vouchers");
        const items = raw ? JSON.parse(raw) : [];
        const filtered = items.filter(x=>x.code!==code);
        await kv.put("vouchers", JSON.stringify(filtered));
        return ok({ ok:true, items: filtered });
      }
      return bad("Method not allowed", 405);
    }

    // ---------- AI Helpers (Gemini 1.5) ----------
    if (url.pathname.startsWith("/admin/ai/")) {
      // Expected POST JSON { title?, desc? } etc.
      const body = await getJSON();
      const key = env.GEMINI_API_KEY || env.GEMINI || "";
      const prompt = buildPrompt(url.pathname, body);
      let content = demoAI(prompt); // default demo

      // If a key is configured, try real Gemini call
      if (key) {
        try {
          const aiRes = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key="+key, {
            method: "POST",
            headers: { "content-type":"application/json" },
            body: JSON.stringify({
              contents:[{ role:"user", parts:[{ text: prompt }]}],
              generationConfig: { temperature: 0.7 }
            }),
          });
          const j = await aiRes.json();
          content = j?.candidates?.[0]?.content?.parts?.[0]?.text || content;
        } catch (e) {
          // keep demo content
        }
      }

      return ok({ ok:true, text: content });
    }

    return notFound();

    // ---------- Helpers (AI) ----------
    function buildPrompt(path, body) {
      const title = body.title || "";
      const desc  = body.desc  || body.description || "";
      const base  = `Sản phẩm: ${title}\nMô tả: ${desc}\n`;
      if (path.endsWith("/title"))   return base + "Viết 5 tiêu đề ngắn gọn (<=120 ký tự) bằng tiếng Việt, dạng danh sách.";
      if (path.endsWith("/desc"))    return base + "Viết lại mô tả gọn gàng, dễ đọc cho mobile, giữ lại thông số như kích thước/chất liệu/hướng dẫn. Xuất HTML <p><ul> nếu cần.";
      if (path.endsWith("/seo"))     return base + "Tạo JSON với 3 khóa: seoTitle, seoDescription, seoKeywords (chuỗi keywords cách nhau bởi dấu phẩy).";
      if (path.endsWith("/faq"))     return base + "Viết 4-5 Q&A (FAQ) ngắn gọn dưới dạng danh sách gạch đầu dòng.";
      if (path.endsWith("/reviews")) return base + "Tạo 5-10 đánh giá (tên người Việt + 1 câu nhận xét + điểm 1-5). Xuất JSON mảng đối tượng {name, rating, text}.";
      return base + "Tóm tắt 3 gạch đầu dòng.";
    }
    function demoAI(prompt) {
      // Very small fallback when no AI key set
      if (prompt.includes("tiêu đề")) return "Bộ điều khiển từ xa mini USB\nGiá tốt, thiết kế nhỏ gọn\nSản phẩm tiện dụng cho gia đình\nHỗ trợ bảo hành, đổi trả\nGiao hàng nhanh trong ngày";
      if (prompt.includes("Viết lại mô tả")) return "<p>Thiết bị điều khiển nhỏ gọn, bền bỉ. Chất liệu an toàn, phù hợp sử dụng hằng ngày.</p><ul><li>Dễ dùng, vệ sinh nhanh</li><li>Hướng dẫn chi tiết trong hộp</li></ul>";
      if (prompt.includes("seoTitle")) return JSON.stringify({seoTitle:"Mạch quạt mini USB – giá tốt",seoDescription:"Mạch quạt điều khiển từ xa, nhỏ gọn cho gia đình. Bảo hành 1 đổi 1.",seoKeywords:"mạch quạt, điều khiển, mini usb"});
      if (prompt.includes("Q&A")) return "- Sản phẩm dùng nguồn gì? 5V USB.\n- Bảo hành bao lâu? 6 tháng.\n- Có hướng dẫn lắp đặt? Có kèm tờ hướng dẫn.\n- Dùng được cho quạt nào? Hầu hết quạt mini 5V.";
      if (prompt.includes("đánh giá")) return JSON.stringify([{name:"Minh Anh",rating:5,text:"Hài lòng, dùng ổn định!"},{name:"Ngọc Hà",rating:5,text:"Đóng gói cẩn thận, giao nhanh."}]);
      return "Demo output.";
    }
  }
};
