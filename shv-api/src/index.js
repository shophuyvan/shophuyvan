
function buildCors(req) {
  const origin = req.headers.get('Origin') || '*';
  const reqHdr = req.headers.get('Access-Control-Request-Headers');
  return {
    'Access-Control-Allow-Origin': origin,
    'Vary': 'Origin',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
    'Access-Control-Max-Age': '86400',
    'Access-Control-Allow-Headers': reqHdr || 'authorization,content-type,x-token,x-requested-with',
    'Access-Control-Expose-Headers': 'x-token'
  };
}
function json(data, init = {}, req) {
  return new Response(JSON.stringify(data), {
    status: init.status || 200,
    headers: { 'content-type': 'application/json; charset=utf-8', ...(req ? buildCors(req) : {}), ...(init.headers || {}) }
  });
}
async function maybeHandlePreflight(req) {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: buildCors(req) });
  return null;
}
async function readBody(req) {
  const ct = req.headers.get('content-type') || '';
  if (ct.includes('application/json')) { try { return await req.json(); } catch { return {}; } }
  if (ct.includes('form')) return await req.formData();
  try { return await req.text(); } catch { return null; }
}
async function withAuth(req, env, handler) {
  const token = req.headers.get('x-token') || new URL(req.url).searchParams.get('token');
  const saved = await env.SHV.get('admin_token');
  if (!token || !saved || token !== saved) return json({ ok: false, error: 'unauthorized' }, { status: 401 }, req);
  return handler();
}
async function putJSON(env, key, obj) { await env.SHV.put(key, JSON.stringify(obj)); }
async function getJSON(env, key, defVal=null) { const v = await env.SHV.get(key); return v ? JSON.parse(v) : defVal; }

export default {
  async fetch(req, env, ctx) {
    try {
    const pre = await maybeHandlePreflight(req); if (pre) return pre;
    const url = new URL(req.url);
    const p = url.pathname;

    if (p === '/me' || p === '/api' || p === '/') return json({ ok: true, msg: 'worker alive' }, {}, req);

    if (p === '/admin/login') {
      let u, pw;
      if (req.method === 'POST') {
        const body = await readBody(req) || {};
        u = body.u; pw = body.p;
      } else {
        u = url.searchParams.get('u'); pw = url.searchParams.get('p');
      }
      const ok = (u === 'admin' && pw && env.ADMIN_TOKEN && pw === env.ADMIN_TOKEN);
      if (!ok) return json({ ok: false, error: 'bad credentials' }, {}, req);
      const token = crypto.randomUUID().replace(/-/g,'');
      await env.SHV.put('admin_token', token, { expirationTtl: 60*60*24*7 });
      return json({ ok: true, token }, {}, req);
    }
    if (p === '/admin/me') {
      const token = req.headers.get('x-token') || url.searchParams.get('token');
      const saved = await env.SHV.get('admin_token');
      return json({ ok: !!token && !!saved && token === saved }, {}, req);
    }

    if (p === '/admin/upload' && req.method === 'POST') {
      return withAuth(req, env, async ()=>{
        const form = await req.formData();
        const file = form.get('file');
        if (!file) return json({ ok: false, error: 'no file' }, {}, req);
        if (!env.CLOUDINARY_CLOUD_NAME || !env.CLOUDINARY_UPLOAD_PRESET) {
          return json({ ok: false, error: 'cloudinary not configured' }, {}, req);
        }
        const fd = new FormData();
        fd.append('file', file);
        fd.append('upload_preset', env.CLOUDINARY_UPLOAD_PRESET);
        const r = await fetch(`https://api.cloudinary.com/v1_1/${env.CLOUDINARY_CLOUD_NAME}/auto/upload`, { method:'POST', body:fd });
        const j = await r.json();
        if (!j.secure_url) return json({ ok: false, error: j.error || 'upload failed' }, {}, req);
        return json({ ok: true, url: j.secure_url }, {}, req);
      });
    }

    if (p === '/admin/products/upsert' && req.method === 'POST') {
      return withAuth(req, env, async ()=>{
        const body = await readBody(req) || {};
        const slug = (body.slug || body.title || crypto.randomUUID()).toString().trim();
        body.slug = slug;
        await putJSON(env, `product:${slug}`, body);
        const list = await getJSON(env, 'products:index', []);
        if (!list.includes(slug)) { list.push(slug); await putJSON(env, 'products:index', list); }
        return json({ ok: true, slug }, {}, req);
      });
    }
    if (p === '/admin/products' && req.method === 'GET') {
      return withAuth(req, env, async ()=>{
        const list = await getJSON(env, 'products:index', []);
        const items = [];
        for (const s of list) { const it = await getJSON(env, `product:${s}`, null); if (it) items.push(it); }
        return json({ ok:true, items }, {}, req);
      });
    }

    if (p === '/admin/banners/upsert' && req.method === 'POST') {
      return withAuth(req, env, async ()=>{
        const body = await readBody(req) || {};
        const id = body.id || crypto.randomUUID();
        body.id = id;
        const list = await getJSON(env, 'banners:list', []);
        const idx = list.findIndex(x=>x.id===id);
        if (idx>=0) list[idx]=body; else list.push(body);
        await putJSON(env, 'banners:list', list);
        return json({ ok:true, id }, {}, req);
      });
    }
    if (p === '/admin/banners' && req.method === 'GET') {
      return withAuth(req, env, async ()=>{
        const list = await getJSON(env, 'banners:list', []);
        return json({ ok:true, items:list }, {}, req);
      });
    }

    if (p === '/admin/vouchers/upsert' && req.method === 'POST') {
      return withAuth(req, env, async ()=>{
        const body = await readBody(req) || {};
        const code = (body.code || '').toUpperCase();
        if (!code) return json({ ok:false, error:'code required' }, {}, req);
        await putJSON(env, `voucher:${code}`, body);
        const idx = await getJSON(env, 'vouchers:index', []);
        if (!idx.includes(code)) { idx.push(code); await putJSON(env, 'vouchers:index', idx); }
        return json({ ok:true, code }, {}, req);
      });
    }
    if (p === '/admin/vouchers' && req.method === 'GET') {
      return withAuth(req, env, async ()=>{
        const idx = await getJSON(env, 'vouchers:index', []);
        const items = [];
        for (const c of idx) { const it = await getJSON(env, `voucher:${c}`, null); if (it) items.push(it); }
        return json({ ok:true, items }, {}, req);
      });
    }

    if (p.startsWith('/admin/ai/')) {
      return withAuth(req, env, async ()=>{
        const body = await readBody(req) || {};
        const model = env.GEMINI_MODEL || 'models/gemini-1.5-flash';
        async function gemini(prompt) {
          if (!env.GEMINI_API_KEY) return null;
          const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${env.GEMINI_API_KEY}`,{
            method:'POST',
            headers:{'content-type':'application/json'},
            body: JSON.stringify({ contents:[{ parts:[{text: prompt}] }] })
          });
          const j = await r.json().catch(()=>null);
          const text = j?.candidates?.[0]?.content?.parts?.map(p=>p.text).join('\n') || '';
          return text.trim();
        }
        if (p === '/admin/ai/title') {
          const text = await gemini(`Hãy đề xuất 5 tiêu đề sản phẩm tiếng Việt súc tích (<= 120 ký tự) dựa trên tên: "${body.title||''}". Xuất mỗi dòng 1 tiêu đề.`)
              || `Gợi ý tiêu đề cho: ${body.title||''}`;
          return json({ ok:true, result: text.split('\\n')[0].trim() }, {}, req);
        }
        if (p === '/admin/ai/seo') {
          const text = await gemini(`Viết SEO cho sản phẩm. Tiêu đề <= 60 ký tự. Mô tả <= 160 ký tự. Đề xuất 6-10 từ khóa. Dựa trên nội dung:\\nTiêu đề:${body.title}\\nMô tả:${body.desc}\\nXuất JSON với keys: title, desc, keywords (array).`)
              || JSON.stringify({title: body.title || '', desc: (body.desc||'').slice(0,160), keywords: []});
          let j; try{ j = JSON.parse(text); }catch{ j={title:body.title||'', desc:(body.desc||'').slice(0,160), keywords:[]}; }
          return json({ ok:true, ...j }, {}, req);
        }
        if (p === '/admin/ai/desc') {
          const text = await gemini(`Viết lại mô tả sản phẩm gọn gàng, dễ đọc cho di động. Đầu mục nếu cần. Giữ thông số kỹ thuật (kích thước, chất liệu...) nếu có. Nội dung:\\n${body.desc||''}`)
              || (body.desc||'');
          return json({ ok:true, desc:text }, {}, req);
        }
        if (p === '/admin/ai/faq') {
          const text = await gemini(`Tạo 4-5 câu hỏi thường gặp (FAQ) và câu trả lời ngắn cho sản phẩm: "${body.title}". Xuất JSON: [{"q":"","a":""}, ...]`)
              || JSON.stringify([{q:'Bảo hành thế nào?',a:'Đổi trả trong 7 ngày, bảo hành theo quy định.'}]);
          let j; try{ j = JSON.parse(text); }catch{ j = [{q:'Thông tin sản phẩm?',a:'Vui lòng xem mô tả chi tiết.'}]; }
          return json({ ok:true, faq:j }, {}, req);
        }
        if (p === '/admin/ai/reviews') {
          const text = await gemini(`Tạo 5-10 đánh giá của khách Việt Nam (có name, star 4-5, text <=120 ký tự). Xuất JSON: [{"name":"","star":5,"text":"","avatar":""}]`)
              || JSON.stringify([{name:'Ngọc Hà', star:5, text:'Rất hài lòng, giao nhanh!', avatar:''}]);
          let j; try{ j = JSON.parse(text); }catch{ j=[{name:'Khách',star:5,text:'Hài lòng!',avatar:''}]; }
          return json({ ok:true, reviews:j }, {}, req);
        }
        return json({ ok:false, error:'not found' }, { status:404 }, req);
      });
    }

    return json({ ok:false, error:'not found' }, { status:404 }, req);
  }
};
