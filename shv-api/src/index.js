
function corsHeaders(req){
  const origin = req.headers.get('Origin') || '*';
  const reqHdr = req.headers.get('Access-Control-Request-Headers') || 'authorization,content-type,x-token,x-requested-with';
  return {
    'Access-Control-Allow-Origin': origin,
    'Vary': 'Origin',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
    'Access-Control-Max-Age': '86400',
    'Access-Control-Allow-Headers': reqHdr,
    'Access-Control-Expose-Headers': 'x-token', 'Access-Control-Allow-Credentials': 'true'
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

function slugify(s){ return String(s||'').toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu,'').replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,''); }

// Build product summary
function toSummary(prod){
  return { id:prod.id, title: prod.title||prod.name||'', name: prod.title||prod.name||'', slug: prod.slug||slugify(prod.title||prod.name||''), sku: prod.sku||'', price: prod.price||0, price_sale: prod.price_sale||0, stock: prod.stock||0, images: prod.images||[], status: (prod.status===0?0:1) };
}

// Fallback build list from legacy keys: product:* (full JSON)
async function listProducts(env){
  let list = await getJSON(env,'products:list',null);
  if(list && list.length) return list;

  const items = [];
  let cursor;
  do{
    const res = await env.SHV.list({ prefix: 'product:', cursor });
    for(const k of res.keys){
      const prod = await getJSON(env, k.name, null);
      if(prod){
        prod.id = prod.id || k.name.slice('product:'.length);
        items.push(toSummary(prod));
      }
    }
    cursor = res.list_complete ? null : res.cursor;
  } while(cursor);

  if(items.length) await putJSON(env, 'products:list', items);
  return items;
}

// AI
      if(p==='/admin/ai/ping'){
        return json({ok:true, ready: Boolean(env && env.GEMINI_API_KEY)}, {}, req);
      }
      // AI (same as v3)
function dedupe(arr){ return Array.from(new Set(arr.filter(Boolean).map(s=>s.trim()))); }
function words(s){ return (s||'').toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu,'').replace(/[^a-z0-9\s]/g,'').split(/\s+/g).filter(w=>w.length>2); }
function keywordsFrom(title, desc){
  const stop = new Set(['san','pham','chinh','hang','bao','hanh','gia','tot','chat','luong','mua','ngay','giao','nhanh','quoc','te','toan','quoc','hang','ship','uu','dai','khach','hang']);
  const bag = dedupe([...words(title||''), ...words(desc||'')]).filter(w=>!stop.has(w)).slice(0,12);
  return bag;
}
function aiTitle(p){
  const name = p.title||p.name||'Sản phẩm';
  const price = p.sale||p.price||'';
  const opts = [
    `${name} chính hãng – Mua ngay`,
    `${name} giá tốt | Ship nhanh toàn quốc`,
    `${name} chất lượng, bảo hành đầy đủ`,
    `${name} giảm giá chỉ ${price}đ`,
    `Mua ${name} – Ưu đãi hôm nay`
  ].map(s=>s.slice(0,120));
  return dedupe(opts).slice(0,5);
}
function aiDesc(p){
  const name = p.title||p.name||'Sản phẩm';
  const base = `${name} thiết kế gọn đẹp, chất liệu bền bỉ. Dễ dùng, phù hợp gia đình & văn phòng. `+
               `Hiệu năng ổn định, tiết kiệm năng lượng. Giao nhanh, đổi trả linh hoạt.`;
  const opts = [
    base,
    `${name} chính hãng – Thông số được tinh gọn để hiển thị tốt trên mobile. `+
    `Gợi ý: tách riêng mục kích thước/chất liệu/thuộc tính vào danh sách để người mua dễ đọc.`,
    `Mô tả ${name}: tập trung lợi ích cốt lõi, hướng dẫn sử dụng ngắn gọn, chèn ảnh minh hoạ thông số nếu có.`
  ];
  return dedupe(opts).slice(0,5);
}
function aiSEO(p){
  const name = p.title||p.name||'Sản phẩm';
  const kws = keywordsFrom(p.title, p.desc);
  const slug = slugify(name);
  const items = [
    { title: `${name} | Giá tốt, giao nhanh`, slug, desc: `${name} chính hãng, bảo hành đầy đủ. Giao nhanh toàn quốc.`, keywords:kws.slice(0,8) },
    { title: `Mua ${name} chính hãng – Ưu đãi hôm nay`, slug, desc: `Đặt ${name} với nhiều ưu đãi. Chất lượng đảm bảo.`, keywords:kws.slice(0,8) },
    { title: `${name} chất lượng – Ship nhanh`, slug, desc: `Sản phẩm ${name} bền bỉ, trải nghiệm tốt.`, keywords:kws.slice(0,8) },
  ];
  return items;
}
function aiFAQ(p){
  const name = p.title||'sản phẩm';
  const items = [
    {q:`${name} có bảo hành không?`, a:'Có, theo chính sách của cửa hàng.'},
    {q:`Có được đổi trả ${name} không?`, a:'Đổi trả trong 7 ngày nếu còn nguyên trạng.'},
    {q:`Thời gian giao hàng ${name}?`, a:'1–3 ngày tuỳ khu vực.'},
    {q:`${name} có phù hợp làm quà tặng?`, a:'Có, đóng gói đẹp và an toàn.'},
    {q:`Có hỗ trợ xuất hoá đơn cho ${name}?`, a:'Có, vui lòng để lại thông tin khi đặt hàng.'}
  ];
  return items;
}
const VI_NAMES = ['Minh','An','Anh','Bình','Duy','Huy','Khoa','Khôi','Long','Nam','Phong','Quân','Sơn','Tiến','Trung','Tú','Vinh','Vy','Linh','Trang','Thu','Ngọc','Quỳnh','Hương','Mai','Lan','Hà','Nga','Thảo'];
function randName(){ return VI_NAMES[Math.floor(Math.random()*VI_NAMES.length)]+' '+(Math.random()<0.5?'Nguyễn':'Trần'); }
function avatar(seed){ const s = seed||Math.random().toString(36).slice(2,8); return `https://api.dicebear.com/7.x/thumbs/svg?seed=${s}`; }
function aiReviews(p){
  const name = p.title||'Sản phẩm';
  const items = Array.from({length: Math.floor(Math.random()*6)+5}).map(()=>({name: randName(), text: `${name} dùng rất ổn, giao nhanh, đóng gói chắc chắn. Sẽ ủng hộ tiếp.`, stars:5, avatar: avatar()}));
  return items;
}
function aiAlt(p){
  const base = (p.title||'Sản phẩm') + ' ' + (p.filename||'hinh-anh');
  return [
    `${base} nhìn từ góc nghiêng`,
    `${base} cận cảnh chi tiết`,
    `${base} phụ kiện kèm theo`,
    `${base} sử dụng thực tế`
  ];
}

export default {
  async fetch(req, env, ctx){
    try{
      if(req.method==='OPTIONS') return new Response(null,{status:204, headers:corsHeaders(req)});
      const url = new URL(req.url); const p = url.pathname;
      // REST-style product get: /products/{id} and public alias
      if(p.startsWith('/products/') && req.method==='GET'){
        const id = decodeURIComponent(p.split('/')[2]||'').trim();
        if(!id) return json({error:'No id'}, {status:400}, req);
        if(env && env.SHV){
          const obj = await getJSON(env, 'product:'+id, null);
          if(obj) return json({item: obj}, {}, req);
        }
        // fallback to list then find
        const lst = await listProducts(env);
        const found = (lst||[]).find(x=>String(x.id||x.key||'')===id);
        if(found) return json({item: found}, {}, req);
        return json({error:'Not Found'}, {status:404}, req);
      }
      if(p.startsWith('/public/products/') && req.method==='GET'){
        const id = decodeURIComponent(p.split('/')[3]||'').trim();
        if(!id) return json({error:'No id'}, {status:400}, req);
        if(env && env.SHV){
          const obj = await getJSON(env, 'product:'+id, null);
          if(obj) return json({item: obj}, {}, req);
        }
        const lst = await listProducts(env);
        const found = (lst||[]).find(x=>String(x.id||x.key||'')===id);
        if(found) return json({item: found}, {}, req);
        return json({error:'Not Found'}, {status:404}, req);
      }
      // Public products list
      if(p==='/public/products' && req.method==='GET'){
        const limit = Number(url.searchParams.get('limit')||'24');
        const items = (await listProducts(env)) || [];
        return json({items: items.slice(0, limit)}, {}, req);
      }


      if(p==='/' || p===''){ return json({ok:true, msg:'SHV API v3.1', hint:'GET /products, /admin/products, /banners, /admin/ai/*'}, {}, req); }
      if(p==='/me' && req.method==='GET') return json({ok:true,msg:'worker alive'}, {}, req);

      if(p==='/admin/login'){
        let u='', pw='';
        if(req.method==='POST'){ const b=await readBody(req)||{}; u=b.user||b.username||b.u||''; pw=b.pass||b.password||b.p||''; }
        else { u=url.searchParams.get('u')||''; pw=url.searchParams.get('p')||''; }
        // accept ADMIN_TOKEN from env or admin_pass/admin_token from KV
        let pass = (env && env.ADMIN_TOKEN) ? env.ADMIN_TOKEN : '';
        if(!pass && env && env.SHV){ pass = (await env.SHV.get('admin_pass')) || (await env.SHV.get('admin_token')) || ''; }
        if(!(u==='admin' && pw===pass)) return json({ok:false,error:'bad credentials'},{status:401},req);
        let token='';
        if(env && env.SHV){ token = crypto.randomUUID().replace(/-/g,''); await env.SHV.put('admin_token', token, { expirationTtl: 60*60*24*7 }); }
        else { token = await expectedToken(env); }
        return json({ok:true, token}, {}, req);
      }

      // Aliases for compatibility
      if(p==='/login' || p==='/admin_auth/login'){
        let u='', pw='';
        if(req.method==='POST'){ const b=await readBody(req)||{}; u=b.user||b.username||b.u||''; pw=b.pass||b.password||b.p||''; }
        else { u=url.searchParams.get('u')||''; pw=url.searchParams.get('p')||''; }
        let pass = (env && env.ADMIN_TOKEN) ? env.ADMIN_TOKEN : '';
        if(!pass && env && env.SHV){ pass = (await env.SHV.get('admin_pass')) || (await env.SHV.get('admin_token')) || ''; }
        if(!(u==='admin' && pw===pass)) return json({ok:false,error:'bad credentials'},{status:401},req);
        let token='';
        if(env && env.SHV){ token = crypto.randomUUID().replace(/-/g,''); await env.SHV.put('admin_token', token, { expirationTtl: 60*60*24*7 }); }
        else { token = await expectedToken(env); }
        return json({ok:true, token}, {}, req);
      }
if(p==='/admin/me' && req.method==='GET'){ const ok = await adminOK(req, env); return json({ok}, {}, req); }

      // File
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
          await env.SHV.put('file:'+id+':meta', JSON.stringify({name:f.name, type:f.type, size:f.size}));
          urls.push(url.origin+'/file/'+id);
        }
        return json({ok:true, urls}, {}, req);
      }

      // Banners
      if(p==='/admin/banners' && req.method==='POST'){ req = new Request(new URL('/admin/banners/upsert', req.url), req); }
      // Banners
      if((p==='/admin/banners/upsert' || p==='/admin/banner') && req.method==='POST'){
        if(!(await adminOK(req, env))) return json({ok:false, error:'unauthorized'},{status:401},req);
        const b = await readBody(req)||{}; b.id = b.id || crypto.randomUUID().replace(/-/g,'');
        const list = await getJSON(env,'banners:list',[]) || [];
        const i = list.findIndex(x=>x.id===b.id); if(i>=0) list[i]=b; else list.unshift(b);
        await putJSON(env, 'banners:list', list);
        return json({ok:true, data:b}, {}, req);
      }
      if(p==='/admin/banners' && req.method==='GET'){ const list = await getJSON(env,'banners:list',[])||[]; return json({ok:true, items:list}, {}, req); }
      if(p==='/banners' && req.method==='GET'){ const list = await getJSON(env,'banners:list',[])||[]; return json({ok:true, items:list.filter(x=>x.on!==false)}, {}, req); }
      if((p==='/admin/banners/delete' || p==='/admin/banner/delete') && req.method==='POST'){
        if(!(await adminOK(req, env))) return json({ok:false, error:'unauthorized'},{status:401},req);
        const b = await readBody(req)||{}; const id = b.id;
        const list = await getJSON(env,'banners:list',[])||[];
        const next = list.filter(x=>x.id!==id);
        await putJSON(env, 'banners:list', next);
        return json({ok:true, deleted:id}, {}, req);
      }

      // Products
      if((p==='/admin/products/upsert' || p==='/admin/product') && req.method==='POST'){
        if(!(await adminOK(req, env))) return json({ok:false, error:'unauthorized'},{status:401},req);
        const prod = await readBody(req)||{}; prod.id = prod.id || crypto.randomUUID().replace(/-/g,''); prod.updatedAt = Date.now();
        const list = await listProducts(env);
        const summary = toSummary(prod);
        const idx = list.findIndex(x=>x.id===prod.id); if(idx>=0) list[idx]=summary; else list.unshift(summary);
        await putJSON(env, 'products:list', list);
        await putJSON(env, 'product:'+prod.id, prod);
        await putJSON(env, 'products:'+prod.id, summary); // keep legacy-compat style
        return json({ok:true, data:prod}, {}, req);
      }
      if(p==='/admin/products' && req.method==='GET'){
        const list = await listProducts(env);
        return json({ok:true, items:list}, {}, req);
      }
      if(p==='/products' && req.method==='GET'){
        const list = await listProducts(env);
        return json({ok:true, items:list.filter(x=>x.status!==0)}, {}, req);
      }
      if((p==='/admin/products/get' || p==='/product') && req.method==='GET'){
        const id = url.searchParams.get('id'); const slug = url.searchParams.get('slug');
        if(!id && !slug) return json({ok:false,error:'missing id or slug'},{status:400},req);
        let prod=null;
        if(id) prod = await getJSON(env,'product:'+id,null);
        if(!prod && slug){
          const list=await listProducts(env); const item=list.find(x=>x.slug===slug);
          if(item) prod = await getJSON(env, 'product:'+item.id, null);
        }
        if(!prod) return json({ok:false,error:'not found'},{status:404},req);
        return json({ok:true, data:prod}, {}, req);
      }
      if(p==='/admin/products/delete' && req.method==='POST'){
        if(!(await adminOK(req, env))) return json({ok:false, error:'unauthorized'},{status:401},req);
        const b = await readBody(req)||{}; const id=b.id;
        const list = await listProducts(env); const next=list.filter(x=>x.id!==id); await putJSON(env,'products:list',next); await env.SHV.delete('product:'+id);
        return json({ok:true, deleted:id}, {}, req);
      }

      // AI
      if(p==='/admin/ai/ping'){
        return json({ok:true, ready: Boolean(env && env.GEMINI_API_KEY)}, {}, req);
      }
      // AI
      if(p.startsWith('/admin/ai/')){
        const kind = p.split('/').pop();
        let body = req.method==='POST' ? (await readBody(req)||{}) : Object.fromEntries(new URL(req.url).searchParams.entries());
        const map = { title: aiTitle, desc: aiDesc, seo: aiSEO, faq: aiFAQ, reviews: aiReviews, alt: aiAlt };
        const gen = map[kind];
        if(!gen) return json({ok:false,error:'unknown ai endpoint'}, {status:404}, req);
        const items = gen(body||{});
        return json({ok:true, items, options:items}, {}, req);
      }

      
      // Orders upsert
      if((p==='/admin/orders/upsert') && (req.method==='POST')){
        if(!(await adminOK(req, env))) return json({ok:false, error:'unauthorized'},{status:401},req);
        const o = await readBody(req)||{}; o.id = o.id || crypto.randomUUID().replace(/-/g,''); o.createdAt = o.createdAt || Date.now();
        const list = await getJSON(env,'orders:list',[])||[];
        // compute subtotal, revenue, profit
        const items = o.items||[];
        const subtotal = items.reduce((s,it)=> s + Number(it.price||0)*Number(it.qty||1), 0);
        const cost     = items.reduce((s,it)=> s + Number(it.cost||0)*Number(it.qty||1), 0);
        o.subtotal = subtotal; o.revenue = subtotal - Number(o.shipping_fee||0); o.profit = o.revenue - cost;
        const idxExist = list.findIndex(x=>x.id===o.id); if(idxExist>=0) list[idxExist]=o; else list.unshift(o);
        await putJSON(env,'orders:list', list); await putJSON(env,'order:'+o.id, o);
        return json({ok:true, id:o.id, data:o}, {}, req);
      }
      if(p==='/admin/orders' && req.method==='GET'){ const list = await getJSON(env,'orders:list',[])||[]; return json({ok:true, items:list}, {}, req); }
      if(p==='/admin/orders/delete' && req.method==='POST'){ if(!(await adminOK(req, env))) return json({ok:false, error:'unauthorized'},{status:401},req); const b=await readBody(req)||{}; const id=b.id; const list=await getJSON(env,'orders:list',[])||[]; const next=list.filter(x=>x.id!==id); await putJSON(env,'orders:list', next); return json({ok:true, deleted:id}, {}, req); }
      if(p==='/admin/orders/print' && req.method==='GET'){ const id = new URL(req.url).searchParams.get('id'); const o = await getJSON(env,'order:'+id,null); if(!o) return json({ok:false,error:'not found'},{status:404},req); const rows=(o.items||[]).map(it=>`<tr><td>${it.title||it.name||it.id}</td><td>${it.qty||1}</td><td>${Number(it.price||0).toLocaleString('vi-VN')}</td></tr>`).join(''); const html=`<!doctype html><html><head><meta charset="utf-8"/><title>In đơn ${id}</title><style>table{width:100%;border-collapse:collapse}td,th{border:1px solid #ccc;padding:6px}</style></head><body><h3>ĐƠN HÀNG ${id}</h3><p>KH: ${o.customer?.name||''} - ${o.customer?.phone||''} - ${o.customer?.address||''}</p><table><thead><tr><th>Sản phẩm</th><th>SL</th><th>Giá</th></tr></thead><tbody>${rows}</tbody></table><p>Tổng hàng: ${o.subtotal.toLocaleString('vi-VN')}đ - Ship: ${Number(o.shipping_fee||0).toLocaleString('vi-VN')}đ</p></body></html>`; return json({ok:true, html}, {}, req); }
      if(p==='/admin/stats' && req.method==='GET'){ const list = await getJSON(env,'orders:list',[])||[]; const orders=list.length; const revenue=list.reduce((s,o)=>s+Number(o.revenue||0),0); const profit=list.reduce((s,o)=>s+Number(o.profit||0),0); const map={}; list.forEach(o=> (o.items||[]).forEach(it=>{ const k=it.id||it.productId||it.title||'unknown'; map[k]=map[k]||{id:k, title:it.title||it.name||k, qty:0, revenue:0}; map[k].qty += Number(it.qty||1); map[k].revenue += Number(it.price||0)*Number(it.qty||1); })); const top = Object.values(map).sort((a,b)=>b.qty-a.qty).slice(0,10); return json({ok:true, orders, revenue, profit, top_products:top}, {}, req); }

      return json({ok:false, error:'not found'}, {status:404}, req);

    }catch(e){
      return json({ok:false, error: (e && e.message) || String(e)}, {status:500}, req);
    }
  }
};
