
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

function slugify(s){ return String(s||'').toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu,'').replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,''); }

// AI generators
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

      if((p==='/' || p==='') && req.method==='GET'){
        return json({
          ok:true,
          service:'SHV API',
          endpoints:{
            health:'GET /me',
            public:['GET /products','GET /product?id=','GET /banners','GET /file/:id'],
            admin:['POST /admin/login','GET /admin/me','POST /admin/products/upsert','GET /admin/products','POST /admin/products/delete','POST /admin/banners/upsert','GET /admin/banners','POST /admin/banners/delete','POST /admin/upload','POST /admin/ai/*']
          }
        }, {}, req);
      }

      if(p==='/me' && req.method==='GET') return json({ok:true,msg:'worker alive'}, {}, req);

      if(p==='/admin/login'){
        let u='', pw=''; if(req.method==='POST'){ const b=await readBody(req)||{}; u=b.u||''; pw=b.p||''; } else { u=url.searchParams.get('u')||''; pw=url.searchParams.get('p')||''; }
        if(!env || !env.ADMIN_TOKEN) return json({ok:false, error:'ADMIN_TOKEN not set'}, {status:500}, req);
        if(!(u==='admin' && pw===env.ADMIN_TOKEN)) return json({ok:false,error:'bad credentials'},{status:401},req);
        let token=''; if(env.SHV){ token=crypto.randomUUID().replace(/-/g,''); await env.SHV.put('admin_token', token, {expirationTtl:60*60*24*7}); } else { token=await expectedToken(env); }
        return json({ok:true, token}, {}, req);
      }

      if(p==='/admin/me' && req.method==='GET'){ const ok = await adminOK(req, env); return json({ok}, {}, req); }

      // Files
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
        const list = await getJSON(env,'products:list',[])||[];
        const summary = { id:prod.id, title:prod.title||prod.name||'', name: prod.title||prod.name||'', slug: prod.slug||slugify(prod.title||prod.name||''), sku: prod.sku||'', price: prod.price||0, price_sale: prod.price_sale||0, stock: prod.stock||0, images: prod.images||[], status: (prod.status===0?0:1) };
        const idx = list.findIndex(x=>x.id===prod.id); if(idx>=0) list[idx]=summary; else list.unshift(summary);
        await putJSON(env, 'products:list', list);
        await putJSON(env, 'product:'+prod.id, prod);
        return json({ok:true, data:prod}, {}, req);
      }
      if(p==='/admin/products' && req.method==='GET'){ const list = await getJSON(env,'products:list',[])||[]; return json({ok:true, items:list}, {}, req); }
      if(p==='/products' && req.method==='GET'){ const list = await getJSON(env,'products:list',[])||[]; return json({ok:true, items:list.filter(x=>x.status!==0)}, {}, req); }
      if(p==='/product' && req.method==='GET'){ const id = url.searchParams.get('id'); if(!id) return json({ok:false,error:'missing id'},{status:400},req); const prod = await getJSON(env,'product:'+id,null); if(!prod) return json({ok:false,error:'not found'},{status:404},req); return json({ok:true, data:prod}, {}, req); }
      if(p==='/admin/products/delete' && req.method==='POST'){
        if(!(await adminOK(req, env))) return json({ok:false, error:'unauthorized'},{status:401},req);
        const b = await readBody(req)||{}; const id=b.id;
        const list = await getJSON(env,'products:list',[])||[]; const next=list.filter(x=>x.id!==id); await putJSON(env,'products:list',next); await env.SHV.delete('product:'+id);
        return json({ok:true, deleted:id}, {}, req);
      }

      // AI endpoints
      if(p.startsWith('/admin/ai/')){
        const kind = p.split('/').pop();
        let body = req.method==='POST' ? (await readBody(req)||{}) : Object.fromEntries(new URL(req.url).searchParams.entries());
        const map = { title: aiTitle, desc: aiDesc, seo: aiSEO, faq: aiFAQ, reviews: aiReviews, alt: aiAlt };
        const gen = map[kind];
        if(!gen) return json({ok:false,error:'unknown ai endpoint'}, {status:404}, req);
        const items = gen(body||{});
        // 'seo' returns objects; others arrays of strings/objects
        return json({ok:true, items, options:items}, {}, req);
      }

      return json({ok:false, error:'not found'}, {status:404}, req);
    }catch(e){
      return json({ok:false, error: (e && e.message) || String(e)}, {status:500}, req);
    }
  }
};
