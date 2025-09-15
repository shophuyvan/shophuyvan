
// SHV API minimal catalog (KV: SHV). Endpoints:
// - OPTIONS * (CORS)
// - GET /me
// - POST/GET /admin/login   (env.ADMIN_TOKEN)
// - GET  /admin/me
// - POST /admin/products/upsert   (body: product)  [fallback: /admin/product]
// - GET  /admin/products           (list)
// - GET  /products                 (public list, status!=0)
// - GET  /product?id=              (public detail)
// - POST /admin/banners/upsert     [fallback: /admin/banner]
// - GET  /admin/banners
// - GET  /banners                  (public)
// - POST /admin/upload | /admin/files  (multipart/form-data)
// - GET  /file/:id                 (serve uploaded file)

function corsHeaders(req){
  const origin = req.headers.get('Origin') || '*';
  const reqHdr = req.headers.get('Access-Control-Request-Headers') || 'authorization,content-type,x-token,x-requested-with';
  return {
    'Access-Control-Allow-Origin': origin,
    'Vary': 'Origin',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
    'Access-Control-Max-Age': '86400',
    'Access-Control-Allow-Headers': reqHdr,
    'Access-Control-Expose-Headers': 'x-token'
  };
}
function json(data, init={}, req){ return new Response(JSON.stringify(data||{}), {status: init.status||200, headers: {...corsHeaders(req), 'content-type':'application/json; charset=utf-8'}}); }
async function readBody(req){
  const ct = req.headers.get('content-type')||'';
  if(ct.includes('application/json')) return await req.json();
  const txt = await req.text(); try { return JSON.parse(txt); } catch { return {raw:txt}; }
}
async function sha256Hex(s){ const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(s||''))); return [...new Uint8Array(d)].map(b=>b.toString(16).padStart(2,'0')).join(''); }
async function expectedToken(env){ return env && env.ADMIN_TOKEN ? await sha256Hex(env.ADMIN_TOKEN) : ''; }
async function adminOK(req, env){
  const url = new URL(req.url); const token = req.headers.get('x-token') || url.searchParams.get('token') || '';
  if(env && env.SHV && typeof env.SHV.get==='function'){ const saved = await env.SHV.get('admin_token'); return !!token && !!saved && token===saved; }
  const exp = await expectedToken(env); return !!token && !!exp && token===exp;
}
async function getJSON(env, key, def){ try{ const v = await env.SHV.get(key); return v? JSON.parse(v): (def??null);}catch{return def??null;} }
async function putJSON(env, key, obj){ await env.SHV.put(key, JSON.stringify(obj)); }

export default {
  async fetch(req, env, ctx){
    try{
      if(req.method==='OPTIONS') return new Response(null,{status:204, headers:corsHeaders(req)});
      const url = new URL(req.url); const p = url.pathname;

      if(p==='/me' && req.method==='GET') return json({ok:true,msg:'worker alive'}, {}, req);

      if(p==='/admin/login'){
        let u='', pw=''; if(req.method==='POST'){ const b=await readBody(req)||{}; u=b.u||''; pw=b.p||''; } else { u=url.searchParams.get('u')||''; pw=url.searchParams.get('p')||''; }
        if(!env || !env.ADMIN_TOKEN) return json({ok:false, error:'ADMIN_TOKEN not set'}, {status:500}, req);
        if(!(u==='admin' && pw===env.ADMIN_TOKEN)) return json({ok:false,error:'bad credentials'},{status:401},req);
        let token=''; if(env.SHV){ token=crypto.randomUUID().replace(/-/g,''); await env.SHV.put('admin_token', token, {expirationTtl:60*60*24*7}); } else { token=await expectedToken(env); }
        return json({ok:true, token}, {}, req);
      }

      if(p==='/admin/me' && req.method==='GET'){ const ok = await adminOK(req, env); return json({ok}, {}, req); }

      // ===== Files upload & serve =====
      if(p.startsWith('/file/') && req.method==='GET'){
        const id = p.split('/').pop();
        const meta = await getJSON(env, 'file:'+id+':meta', null);
        const data = await env.SHV.get('file:'+id, 'arrayBuffer');
        if(!data || !meta) return new Response('not found',{status:404, headers:corsHeaders(req)});
        return new Response(data, {status:200, headers:{...corsHeaders(req), 'content-type': meta.type||'application/octet-stream', 'cache-control':'public, max-age=31536000'}});
      }
      if((p==='/admin/upload' || p==='/admin/files') && req.method==='POST'){
        if(!(await adminOK(req, env))) return json({ok:false, error:'unauthorized'},{status:401},req);
        const ct = req.headers.get('content-type')||'';
        if(!ct.startsWith('multipart/form-data')) return json({ok:false,error:'expect multipart'}, {status:400}, req);
        const form = await req.formData();
        const files = []; for(const [k,v] of form.entries()){ if(v && typeof v==='object' && 'arrayBuffer' in v){ files.push(v); } }
        const urls = [];
        for(const f of files){
          const id = crypto.randomUUID().replace(/-/g,'');
          const buf = await f.arrayBuffer();
          await env.SHV.put('file:'+id, buf);
          await putJSON(env, 'file:'+id+':meta', {name:f.name, type:f.type, size:f.size});
          urls.push(url.origin+'/file/'+id);
        }
        return json({ok:true, urls}, {}, req);
      }

      // ===== Banners =====
      if((p==='/admin/banners/upsert' || p==='/admin/banner') && req.method==='POST'){
        if(!(await adminOK(req, env))) return json({ok:false, error:'unauthorized'},{status:401},req);
        const b = await readBody(req)||{}; b.id = b.id || crypto.randomUUID().replace(/-/g,'');
        const list = await getJSON(env,'banners:list',[]) || [];
        const i = list.findIndex(x=>x.id===b.id); if(i>=0) list[i]=b; else list.unshift(b);
        await putJSON(env, 'banners:list', list);
        return json({ok:true, data:b}, {}, req);
      }
      if(p==='/admin/banners' && req.method==='GET'){ const list = await getJSON(env,'banners:list',[])||[]; return json({ok:true, items:list}, {}, req); }
      if(p==='/banners' && req.method==='GET'){ const list = await getJSON(env,'banners:list',[])||[]; return json({ok:true, items:list}, {}, req); }

      // ===== Products =====
      if((p==='/admin/products/upsert' || p==='/admin/product') && req.method==='POST'){
        if(!(await adminOK(req, env))) return json({ok:false, error:'unauthorized'},{status:401},req);
        const prod = await readBody(req)||{}; prod.id = prod.id || crypto.randomUUID().replace(/-/g,''); prod.updatedAt = Date.now();
        const list = await getJSON(env,'products:list',[])||[];
        const summary = { id:prod.id, name: prod.name||prod.title||'', sku: prod.sku||'', price: prod.price||0, price_sale: prod.price_sale||0, stock: prod.stock||0, images: prod.images||[], status: (prod.status===0?0:1) };
        const idx = list.findIndex(x=>x.id===prod.id); if(idx>=0) list[idx]=summary; else list.unshift(summary);
        await putJSON(env, 'products:list', list);
        await putJSON(env, 'product:'+prod.id, prod);
        return json({ok:true, data:prod}, {}, req);
      }
      if(p==='/admin/products' && req.method==='GET'){ const list = await getJSON(env,'products:list',[])||[]; return json({ok:true, items:list}, {}, req); }
      if(p==='/products' && req.method==='GET'){ const list = await getJSON(env,'products:list',[])||[]; return json({ok:true, items:list.filter(x=>x.status!==0)}, {}, req); }
      if(p==='/product' && req.method==='GET'){ const id = url.searchParams.get('id'); if(!id) return json({ok:false,error:'missing id'},{status:400},req); const prod = await getJSON(env,'product:'+id,null); if(!prod) return json({ok:false,error:'not found'},{status:404},req); return json({ok:true, data:prod}, {}, req); }

      return json({ok:false, error:'not found'}, {status:404}, req);
    }catch(e){
      return json({ok:false, error: (e && e.message) || String(e)}, {status:500}, req);
    }
  }
};
