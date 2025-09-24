/* SHV safe patch header */

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
async function geminiGen(env, prompt){
  try{
    if(!(env && env.GEMINI_API_KEY)) return null;
    const model = (env.GEMINI_MODEL || 'gemini-1.5-flash-latest').trim();
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${env.GEMINI_API_KEY}`;
    const body = { contents:[{ role:'user', parts:[{text: prompt}]}], generationConfig:{ temperature:0.7 } };
    const r = await fetch(endpoint, { method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify(body)});
    const j = await r.json();
    const text = j?.candidates?.[0]?.content?.parts?.map(p=>p.text||'').join('\n') || j?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    return (text||'').trim();
  }catch(e){ return null; }
}

      // AI
function dedupe(arr){ return Array.from(new Set(arr.filter(Boolean).map(s=>s.trim()))); }
function words(s){ return (s||'').toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu,'').replace(/[^a-z0-9\s]/g,'').split(/\s+/g).filter(w=>w.length>2); }
function keywordsFrom(title, desc){
  const stop = new Set(['san','pham','chinh','hang','bao','hanh','gia','tot','chat','luong','mua','ngay','giao','nhanh','quoc','te','toan','quoc','hang','ship','uu','dai','khach','hang']);
  const bag = dedupe([...words(title||''), ...words(desc||'')]).filter(w=>!stop.has(w)).slice(0,12);
  return bag;
}
async function aiTitle(p, env){
  const name = p.title||p.name||'Sản phẩm';
  const price = p.price_sale||p.sale||p.price||'';
  const prompt = `Đặt 5 tiêu đề ngắn cho sản phẩm (≤120 ký tự), tiếng Việt, thuyết phục, không emoji. Tên: "${name}". Giá sale: "${price}". Trả đúng mỗi dòng 1 tiêu đề.`;
  const g = await geminiGen(env, prompt);
  if(g){ return g.split(/\r?\n+/).map(s=>s.trim()).filter(Boolean).slice(0,5).map(s=>s.slice(0,120)); }
  const opts = [
    `${name} chính hãng – Mua ngay`,
    `${name} giá tốt | Ship nhanh toàn quốc`,
    `${name} giảm chỉ còn ${price}đ`,
    `Mua ${name} – Ưu đãi hôm nay`,
    `${name} chất lượng, bảo hành`
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
async function aiSEO(p, env){
  const name = p.title||p.name||'Sản phẩm';
  const prompt = `Viết SEO Title, SEO Description (≤160 ký tự), và 8-12 Keywords cho sản phẩm "${name}". Trả đúng JSON với keys: title, desc, keywords (mảng).`;
  const g = await geminiGen(env, prompt);
  if(g){
    try{ const j = JSON.parse(g); if(j && (j.title||j.desc)) return [{title:j.title||name, desc:j.desc||'', keywords:j.keywords||[]}]; }catch{}
  }
  const kws = keywordsFrom(p.title, p.desc);
  const items = [{ title: `${name} | Giá tốt, Giao nhanh`, desc: `${name} chính hãng, chất lượng. Mua ngay giao nhanh.`, keywords: kws }];
  return items;
}
async function aiFAQ(p, env){
  const name = p.title||p.name||'Sản phẩm';
  const prompt = `Tạo 5 câu Hỏi/Đáp ngắn gọn cho "${name}". Trả JSON mảng [{q,a}].`;
  const g = await geminiGen(env, prompt);
  if(g){ try{ const arr = JSON.parse(g); return arr; }catch{} }
  return [
    {q:'Dùng có bền không?', a:'Thiết kế chắc chắn, dùng bền mỗi ngày.'},
    {q:'Bảo hành thế nào?', a:'Hỗ trợ bảo hành theo chính sách cửa hàng.'},
    {q:'Có dễ lắp đặt không?', a:'Có hướng dẫn chi tiết, ai cũng có thể tự lắp.'},
    {q:'Giao hàng bao lâu?', a:'1–3 ngày tùy khu vực, có hỗ trợ theo dõi đơn.'},
    {q:'Có đổi trả không?', a:'Đổi trả trong 7 ngày theo điều kiện đi kèm.'}
  ];
}
const VI_NAMES = ['Minh','An','Anh','Bình','Duy','Huy','Khoa','Khôi','Long','Nam','Phong','Quân','Sơn','Tiến','Trung','Tú','Vinh','Vy','Linh','Trang','Thu','Ngọc','Quỳnh','Hương','Mai','Lan','Hà','Nga','Thảo'];
function randName(){ return VI_NAMES[Math.floor(Math.random()*VI_NAMES.length)]+' '+(Math.random()<0.5?'Nguyễn':'Trần'); }
function avatar(seed){ const s = seed||Math.random().toString(36).slice(2,8); return `https://api.dicebear.com/7.x/thumbs/svg?seed=${s}`; }
async function aiReviews(p, env){
  const name = p.title||p.name||'Sản phẩm';
  const prompt = `Sinh 6 nhận xét tiếng Việt tích cực cho "${name}", mỗi nhận xét gồm: name, stars (4-5), text; trả JSON mảng.`;
  const g = await geminiGen(env, prompt);
  if(g){ try{ const arr = JSON.parse(g); return arr; }catch{} }
  return [
    {name:'Minh Khoa', stars:5, text:'Hàng tốt, đúng mô tả.'},
    {name:'Hồng Nhung', stars:5, text:'Đẹp và chắc chắn.'},
    {name:'Tuấn An', stars:4, text:'Đáng tiền, giao nhanh.'}
  ];
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

// --- SHV v22: vouchers, settings, orders, stats ---
if(p==='/vouchers' && req.method==='GET'){
  const list = await getJSON(env,'vouchers',[]) || [];
  return json({items:list}, {}, req);
}
if(p==='/admin/vouchers/list' && req.method==='GET'){
  const list = await getJSON(env,'vouchers',[]) || [];
  return json({items:list}, {}, req);
}
if(p==='/admin/vouchers/upsert' && req.method==='POST'){
  const body = await req.json().catch(()=>({}));
  const list = await getJSON(env,'vouchers',[]) || [];
  const idx = list.findIndex(x=> (x.code||'').toUpperCase()===String(body.code||'').toUpperCase());
  if(idx>=0) list[idx] = {...list[idx], ...body};
  else list.push({code: body.code||'', off: Number(body.off||0), on: String(body.on||'ON')});
  await putJSON(env,'vouchers',list);
  return json({ok:true, items:list}, {}, req);
}
if(p==='/public/settings' && req.method==='GET'){
  const s = await getJSON(env,'settings',{}) || {};
  return json(s, {}, req);
}
if(p==='/admin/settings/upsert' && req.method==='POST'){
  const body = await req.json().catch(()=>({}));
  const cur = await getJSON(env,'settings',{}) || {};
  // body: {path:'ads.fb', value:'...'} -> deep set
  function set(obj, path, value){
    const parts = String(path||'').split('.').filter(Boolean);
    let o=obj;
    while(parts.length>1){ const k=parts.shift(); o[k]=o[k]||{}; o=o[k]; }
    o[parts[0]] = value;
    return obj;
  }
  set(cur, body.path, body.value);
  await putJSON(env,'settings',cur);
  return json({ok:true, settings:cur}, {}, req);
}
// Orders (unified)
if(p==='/admin/orders' && req.method==='GET'){
  if(!(await adminOK(req, env))) return json({ok:false, error:'unauthorized'},{status:401},req);
  const { searchParams } = new URL(req.url);
  const from = Number(searchParams.get('from')||0) || 0;
  const to   = Number(searchParams.get('to')||0)   || 0;
  let list = await getJSON(env,'orders:list',[])||[];
  // enrich legacy list entries lacking items
  list = await (async ()=>{ const out=[]; for(const it of list){ if(!it.items){ const full = await getJSON(env,'order:'+it.id, null); out.push(full||it); } else out.push(it);} return out; })();
  if(from||to){
    list = list.filter(o=>{
      const t = Number(o.createdAt||0);
      if(from && t < from) return false;
      if(to   && t > to)   return false;
      return true;
    });
  }
  return json({ok:true, items:list}, {}, req);
}


if(p==='/admin/stats' && req.method==='GET'){
  const gran = (url.searchParams.get('granularity')||'day').toLowerCase();
  let from = url.searchParams.get('from');
  let to   = url.searchParams.get('to');
  // VN timezone base
  const now = new Date(Date.now() + 7*3600*1000);
  const y = now.getUTCFullYear(), m = now.getUTCMonth(), d = now.getUTCDate();
  const todayStart = Date.UTC(y,m,d) - 7*3600*1000;
  if(!from || !to){
    if(gran==='day'){
      from = todayStart; to = todayStart + 86400000;
    }else if(gran==='week'){
      // Monday as first day
      const wd = (new Date(todayStart + 7*3600*1000).getDay() + 6) % 7; // 0..6, Monday=0
      const start = todayStart - wd*86400000;
      from = start; to = start + 7*86400000;
    }else if(gran==='month'){
      const dt = new Date(todayStart + 7*3600*1000);
      const start = Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth(), 1) - 7*3600*1000;
      const end = Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth()+1, 1) - 7*3600*1000;
      from = start; to = end;
    }else{ // custom without params => default to today
      from = todayStart; to = todayStart + 86400000;
    }
  }else{
    from = Number(from); to = Number(to);
  }

  // Load orders and enrich legacy rows
  let list = await getJSON(env,'orders:list',[]) || [];
  const out = [];
  for(const o of list){
    if(!o.items){
      const full = await getJSON(env,'order:'+o.id, null);
      out.push(full||o);
    } else out.push(o);
  }
  list = out;

  async function getCost(it){
    if(it && (it.cost!=null)) return Number(it.cost||0);
    const pid = it && (it.id||it.sku||it.product_id);
    if(!pid) return 0;
    const p = await getJSON(env, 'product:'+pid, null);
    if(!p) return 0;
    const keys = ['cost','cost_price','import_price','gia_von','buy_price','price_import'];
    for(const k of keys){ if(p[k]!=null) return Number(p[k]||0); }
    if(Array.isArray(p.variants)){
      const v = p.variants.find(v=> String(v.id||v.sku||'')===String(pid) || String(v.sku||'')===String(it.sku||''));
      if(v){ for(const k of keys){ if(v[k]!=null) return Number(v[k]||0);} }
    }
    return 0;
  }

  let orders = 0, revenue = 0, goodsCost = 0;
  const topMap = {};

  for(const o of list){
    const t = Number(o.createdAt||o.created_at||0);
    if(!t || t < from || t >= to) continue;
    orders += 1;
    const items = Array.isArray(o.items)? o.items : [];
    const subtotal = items.reduce((s,it)=> s + Number(it.price||0)*Number(it.qty||1), 0);
    const ship = Number(o.shipping_fee||0);
    const disc = Number(o.discount||0) + Number(o.shipping_discount||0);
    const orderRevenue = Math.max(0, (o.revenue!=null ? Number(o.revenue) : (subtotal + ship - disc)));
    revenue += orderRevenue;
    for(const it of items){
      let c = Number(it.cost||0);
      if(!c){ c = await getCost(it); }
      goodsCost += c * Number(it.qty||1);
      const name = it.name || it.title || it.id || 'unknown';
      if(!topMap[name]) topMap[name] = {name, qty:0, revenue:0};
      topMap[name].qty += Number(it.qty||1);
      topMap[name].revenue += Number(it.price||0)*Number(it.qty||1);
    }
  }

  const tax = revenue * 0.015;
  const ads = revenue * 0.15;
  const labor = revenue * 0.10;
  const profit = Math.max(0, revenue - goodsCost - tax - ads - labor);
  const top_products = Object.values(topMap).sort((a,b)=> b.revenue-a.revenue).slice(0,20);
  return json({ok:true, orders, revenue, profit, top_products, from, to, granularity:gran }, {}, req);
}
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
        const idQ = url.searchParams.get('id');
        if(idQ){
          let prod = await getJSON(env, 'product:'+idQ, null);
          if(!prod){
            const list = await listProducts(env);
            prod = (list||[]).find(x=>String(x.id||x.key||'')===String(idQ)) || null;
            if(prod){
              const cached = await getJSON(env, 'product:'+prod.id, null);
              if(cached) prod = cached;
          }
            }
          if(!prod) return json({ok:false, error:'not found'}, {status:404}, req);
          return json({ok:true, item: prod}, {}, req);
        }
        const cat = url.searchParams.get('category')||url.searchParams.get('cat');
        const limit = Number(url.searchParams.get('limit')||'24');
        let items = (await listProducts(env)) || [];
        if(cat){ items = items.filter(x=> (x.categories||[]).includes(cat) || String(x.keywords||'').includes(cat)); }
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
        return new Response(data, {status:200, headers:{...corsHeaders(req), 'content-type': (meta && (meta.type||meta.mime)) || 'image/jpeg', 'content-disposition': 'inline; filename="'+((meta && (meta.name||('file-'+id)))||('file-'+id))+((meta && meta.ext)?('.'+meta.ext):'')+'"', 'cache-control':'public, max-age=31536000, immutable'}});
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

      
// Categories
if(p==='/admin/categories' && req.method==='GET'){ const list = await getJSON(env,'cats:list',[])||[]; return json({items:list}, {}, req); }
if(p==='/admin/categories/upsert' && req.method==='POST'){ if(!(await adminOK(req,env))) return json({ok:false},{status:401},req); const b=await readBody(req)||{}; const it={ id:b.id||crypto.randomUUID(), name:b.name||'', slug:b.slug||(b.name||'').toLowerCase().replace(/\s+/g,'-'), parent:b.parent||'', order:Number(b.order||0) }; const list=await getJSON(env,'cats:list',[])||[]; const i=list.findIndex(x=>x.id===it.id); if(i>=0) list[i]=it; else list.push(it); await putJSON(env,'cats:list',list); return json({ok:true,item:it}, {}, req); }
if(p==='/admin/categories/delete' && req.method==='POST'){ if(!(await adminOK(req,env))) return json({ok:false},{status:401},req); const b=await readBody(req)||{}; const id=b.id; const list=(await getJSON(env,'cats:list',[])||[]).filter(x=>x.id!==id); await putJSON(env,'cats:list',list); return json({ok:true,deleted:id}, {}, req); }
if(p==='/public/categories' && req.method==='GET'){ const list = await getJSON(env,'cats:list',[])||[]; return json({items:list.sort((a,b)=>Number(a.order||0)-Number(b.order||0))}, {}, req); }
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
        const idQ = url.searchParams.get('id');
        if(idQ){
          // public single-get by query ?id=...
          let prod = await getJSON(env, 'product:'+idQ, null);
          if(!prod){
            const list = await listProducts(env);
            prod = (list||[]).find(x=>String(x.id||x.key||'')===String(idQ)) || null;
            if(prod){
              const cached = await getJSON(env, 'product:'+prod.id, null);
              if(cached) prod = cached;
            }
          }
          if(!prod) return json({ok:false, error:'not found'}, {status:404}, req);
          return json({ok:true, item: prod}, {}, req);
        }
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

      
      

      // AI - unified endpoint: POST /admin/ai/generate  {type, ctx}
      if(p==='/admin/ai/generate' && req.method==='POST'){
        try{
          let body = await readBody(req)||{};
          const type = (body.type||'').toLowerCase();
          const ctx  = body.ctx||{};
          const map = { title: aiTitle, desc: aiDesc, seo: aiSEO, faq: aiFAQ, reviews: aiReviews, alt: aiAlt };
          const gen = map[type];
          if(!gen) return json({ok:false, error:'unknown type'}, {status:400}, req);
          const items = await gen(ctx, env);
          // For SEO/FAQ return structured value
          return json({ok:true, items, value: items}, {}, req);
        }catch(e){
          return json({ok:false, error:String(e)}, {status:500}, req);
        }
      }

      // Public checkout: POST /public/orders/create
      
if(p==='/public/orders/create' && req.method==='POST'){
        const body = await readBody(req)||{};
        const id = (body.id)|| crypto.randomUUID().replace(/-/g,'');
        // Normalize fields
        const createdAt = body.createdAt || body.created_at || Date.now();
        const status = body.status || 'pending';
        const customer = body.customer || {};
        const items = Array.isArray(body.items)? body.items : [];
        // derive totals
        const t = body.totals || {};
        const shipping_fee = Number(body.shipping_fee ?? t.ship ?? t.shipping_fee ?? 0);
        const discount = Number(body.discount ?? t.discount ?? 0);
        const shipping_discount = Number(body.shipping_discount ?? t.shipping_discount ?? 0);
        const subtotal = items.reduce((s,it)=> s + Number(it.price||0)*Number(it.qty||1), 0);
        const revenue = Math.max(0, subtotal + shipping_fee - (discount + shipping_discount));
        const profit = items.reduce((s,it)=> s + (Number(it.price||0)-Number(it.cost||0))*Number(it.qty||1), 0) - (discount||0);
        const order = { id, createdAt, status, customer, items,
          shipping_fee, discount, shipping_discount, subtotal, revenue, profit,
          note: body.note||'', source: body.source||'fe' };
        await putJSON(env, 'order:'+id, order);
        const list = await getJSON(env,'orders:list',[])||[];
        list.unshift(order);
        await putJSON(env,'orders:list', list);
        return json({ok:true, id}, {}, req);
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
      
      if(p==='/admin/orders/print' && req.method==='GET'){
        if(!(await adminOK(req, env))) return json({ok:false, error:'unauthorized'},{status:401}, req);
        const { searchParams } = new URL(req.url);
        const id = searchParams.get('id');
        if(!id) return json({ok:false, error:'missing id'},{status:400}, req);
        let o = await getJSON(env, 'order:'+id, null);
        if(!o){
          const list = await getJSON(env,'orders:list',[])||[];
          o = list.find(x=> String(x.id)===String(id)) || null;
        }
        if(!o) return json({ok:false, error:'not found'},{status:404}, req);
        const its = Array.isArray(o.items)? o.items : [];
        const fmt = (n)=> new Intl.NumberFormat('vi-VN').format(Number(n||0));
        const sub = its.reduce((s,it)=> s + Number(it.price||0)*Number(it.qty||1), 0);
        const ship = Number(o.shipping_fee||0);
        const disc = Number(o.discount||0) + Number(o.shipping_discount||0);
        const total = Math.max(0, sub + ship - disc);
        const when = o.createdAt ? new Date(Number(o.createdAt)).toLocaleString('vi-VN') : '';
        const rows = its.map(it=>`
          <tr>
            <td>${it.sku||it.id||''}</td>
            <td>${(it.name||'') + (it.variant?(' - '+it.variant):'')}</td>
            <td style="text-align:right">${fmt(it.qty||1)}</td>
            <td style="text-align:right">${fmt(it.price||0)}</td>
            <td style="text-align:right">${fmt(it.cost||0)}</td>
            <td style="text-align:right">${fmt((it.price||0)*(it.qty||1))}</td>
          </tr>`).join('') || `<tr><td colspan="6" style="color:#6b7280">Không có dòng hàng</td></tr>`;
        const customer = o.customer||{};
        const html = `<!doctype html><html><head>
          <meta charset="utf-8"/><title>In đơn ${id}</title>
          <style>
            body{font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;margin:24px;color:#111827}
            .row{display:flex;justify-content:space-between;margin-bottom:12px}
            table{width:100%;border-collapse:collapse;margin-top:8px}
            th,td{border:1px solid #e5e7eb;padding:6px 8px;font-size:13px}
            th{background:#f9fafb;text-align:left}
            .totals{margin-top:12px}
            .totals div{display:flex;justify-content:space-between;padding:2px 0}
          </style></head><body>
          <div class="row"><div>
            <div><b>Đơn hàng:</b> ${id}</div>
            <div><b>Ngày tạo:</b> ${when}</div>
            <div><b>Khách:</b> ${customer.name||o.customer_name||o.name||''} ${customer.phone?('• '+customer.phone):''}</div>
            ${o.address||customer.address?(`<div><b>Địa chỉ:</b> ${o.address||customer.address}</div>`):''}
            ${o.shipping_name?(`<div><b>Vận chuyển:</b> ${o.shipping_name} ${o.shipping_eta?(' • '+o.shipping_eta):''}</div>`):''}
          </div></div>
          <table><thead><tr>
            <th>Mã SP</th><th>Tên/Phân loại</th><th>SL</th><th>Giá bán</th><th>Giá vốn</th><th>Thành tiền</th>
          </tr></thead><tbody>${rows}</tbody></table>
          <div class="totals">
            <div><span>Tổng hàng</span><b>${fmt(sub)}đ</b></div>
            <div><span>Phí vận chuyển</span><b>${fmt(ship)}đ</b></div>
            ${disc?(`<div><span>Giảm</span><b>-${fmt(disc)}đ</b></div>`):''}
            <div style="font-size:16px"><span>Tổng thanh toán</span><b>${fmt(total)}đ</b></div>
          </div>
          <script>window.onload = ()=> setTimeout(()=>window.print(), 200);</script>
        </body></html>`;
        return json({ok:true, html}, {}, req);
      }
if(p==='/admin/stats' && req.method==='GET'){ const list = await getJSON(env,'orders:list',[])||[]; const orders=list.length; const revenue=list.reduce((s,o)=>s+Number(o.revenue||0),0); const profit=list.reduce((s,o)=>s+Number(o.profit||0),0); const map={}; list.forEach(o=> (o.items||[]).forEach(it=>{ const k=it.id||it.productId||it.title||'unknown'; map[k]=map[k]||{id:k, title:it.title||it.name||k, qty:0, revenue:0}; map[k].qty += Number(it.qty||1); map[k].revenue += Number(it.price||0)*Number(it.qty||1); })); const top = Object.values(map).sort((a,b)=>b.qty-a.qty).slice(0,10); return json({ok:true, orders, revenue, profit, top_products:top}, {}, req); }

      
      // Public order create -> create order and store to KV
      if(p==='/public/order-create' && req.method==='POST'){
        const body = await readBody(req)||{};
        const id = (body.id || crypto.randomUUID().replace(/-/g,''));
        const createdAt = Date.now();
        const items = Array.isArray(body.items)? body.items : [];
        const shipping_fee = Number(body.shipping_fee || body.shippingFee || 0);
        const subtotal = items.reduce((s,it)=> s + Number(it.price||0) * Number(it.qty||it.quantity||1), 0);
        const cost     = items.reduce((s,it)=> s + Number(it.cost||0)  * Number(it.qty||it.quantity||1), 0);
        const revenue  = subtotal - shipping_fee;
        const profit   = revenue - cost;
        const o = { id, status: body.status || 'mới', name: body.name, phone: body.phone, address: body.address, note: body.note||body.notes, items, subtotal, shipping_fee, total: subtotal + shipping_fee, revenue, profit, createdAt };
        const list = await getJSON(env,'orders:list',[])||[];
        list.unshift(o);
        await putJSON(env,'orders:list', list);
        await putJSON(env,'order:'+id, o);
        return json({ok:true, id, data:o}, {}, req);
      }

      // Admin: GET /admin/orders?from=&to=
      if(p==='/admin/orders' && req.method==='GET'){
        if(!(await adminOK(req, env))) return json({ok:false, error:'unauthorized'},{status:401},req);
        const { searchParams } = new URL(req.url);
        const from = Number(searchParams.get('from')||0) || 0;
        const to   = Number(searchParams.get('to')||0)   || 0;
        let list = await getJSON(env,'orders:list',[])||[];
  // enrich legacy list entries lacking items
  list = await (async ()=>{ const out=[]; for(const it of list){ if(!it.items){ const full = await getJSON(env,'order:'+it.id, null); out.push(full||it); } else out.push(it);} return out; })();
        if(from||to){
          list = list.filter(o=>{
            const t = Number(o.createdAt||0);
            if(from && t < from) return false;
            if(to   && t > to)   return false;
            return true;
          });
        }
        return json({ok:true, items:list}, {}, req);
      }

      // Stats with granularity day|month|year
      if(p==='/admin/stats' && req.method==='GET'){
        if(!(await adminOK(req, env))) return json({ok:false, error:'unauthorized'},{status:401},req);
        const { searchParams } = new URL(req.url);
        const gran = (searchParams.get('granularity')||'all').toLowerCase();
        const list = await getJSON(env,'orders:list',[])||[];
        const groupKey = (t)=>{
          const d = new Date(Number(t||0));
          if(gran==='day')   return d.toISOString().slice(0,10);
          if(gran==='month') return d.toISOString().slice(0,7);
          if(gran==='year')  return String(d.getUTCFullYear());
          return 'all';
        };
        const groups = {};
        let revenue=0, profit=0;
        for(const o of list){
          const k = groupKey(o.createdAt);
          groups[k] = groups[k]||{orders:0,revenue:0,profit:0};
          groups[k].orders += 1;
          groups[k].revenue += Number(o.revenue||0);
          groups[k].profit  += Number(o.profit||0);
          revenue += Number(o.revenue||0);
          profit  += Number(o.profit||0);
        }
        // top products
        const map = {};
        for(const o of list){
          for(const it of (o.items||[])){
            const key = it.sku||it.id||it.title||it.name||'unknown';
            if(!map[key]) map[key] = {title: it.title||it.name||key, qty:0, revenue:0};
            map[key].qty += Number(it.qty||it.quantity||1);
            map[key].revenue += Number(it.price||0) * Number(it.qty||it.quantity||1);
          }
        }
        const top = Object.values(map).sort((a,b)=>b.qty-a.qty).slice(0,10);
        return json({ok:true, revenue, profit, groups, top_products: top}, {}, req);
      }

      // Settings: upsert (pixels/shipping credentials etc.) to KV
      if(p==='/admin/settings/upsert' && req.method==='POST'){
        if(!(await adminOK(req, env))) return json({ok:false, error:'unauthorized'},{status:401},req);
        const body = await readBody(req)||{};
        const all = await getJSON(env,'settings',{})||{};
        const path = String(body.path||'').split('.').filter(Boolean);
        let cur = all;
        while(path.length>1){ const k=path.shift(); cur[k]=cur[k]||{}; cur=cur[k]; }
        if(path.length){ cur[path[0]] = body.value; }
        else if(body.data && typeof body.data==='object'){ Object.assign(all, body.data); }
        await putJSON(env,'settings', all);
        return json({ok:true, settings: all}, {}, req);
      }
      if(p==='/public/settings' && req.method==='GET'){
        const all = await getJSON(env,'settings',{})||{};
        return json({ok:true, settings: all}, {}, req);
      }

      

      // Public shipping quote (weight-based stub; requires key presence)
      if(p==='/shipping/quote' && req.method==='GET'){
        const weight = Number(url.searchParams.get('weight')||0); // grams
        const to_province = url.searchParams.get('to_province')||'';
        const to_district = url.searchParams.get('to_district')||'';
        const key = (env && env.SHIPPING_API_KEY) || 'FxXOoDz2qlTN5joDCsBGQFqKmm1UNvOw7YPwkzm5';
        if(!key){ return json({ok:false, error:'missing_key'}, {status:400}, req); }
        const unit = Math.max(1, Math.ceil(weight/500)); // 500g blocks
        const base = 12000 + unit*3000;
        const items = [
          { provider:'jt', service_code:'JT-FAST', name:'Giao nhanh', fee: Math.round(base*1.1), eta:'1-2 ngày' },
          { provider:'spx', service_code:'SPX-REG', name:'Tiêu chuẩn', fee: Math.round(base), eta:'2-3 ngày' },
          { provider:'ahamove', service_code:'AHA-SAVE', name:'Tiết kiệm', fee: Math.round(base*0.9), eta:'3-5 ngày' }
        ];
        return json({ok:true, items, to_province, to_district}, {}, req);
      }
// Shipping credentials
      if(p==='/admin/shipping/credentials' && req.method==='POST'){
        if(!(await adminOK(req, env))) return json({ok:false, error:'unauthorized'},{status:401},req);
        const body = await readBody(req)||{};
        const all = await getJSON(env,'settings',{})||{};
        all.shipping = all.shipping || {}; all.shipping.credentials = all.shipping.credentials || {};
        if(body.provider && body.credentials){ all.shipping.credentials[body.provider] = body.credentials; }
        await putJSON(env,'settings', all);
        return json({ok:true}, {}, req);
      }
      // Shipping quote (stub logic)
      if(p==='/admin/shipping/quote' && req.method==='POST'){
        if(!(await adminOK(req, env))) return json({ok:false, error:'unauthorized'},{status:401},req);
        const body = await readBody(req)||{};
        const weight = Number(body.weight||0);
        const subtotal = (Array.isArray(body.items)?body.items:[]).reduce((s,it)=>s+Number(it.price||0)*(Number(it.qty||1)),0);
        const fee = Math.max(15000, Math.round(15000 + weight*100 + subtotal*0.02));
        return json({ok:true, provider: body.provider||'stub', fee, eta:'1-3 ngày'}, {}, req);
      }
      // Shipping create (stub) -> returns tracking code
      if(p==='/admin/shipping/create' && req.method==='POST'){
        if(!(await adminOK(req, env))) return json({ok:false, error:'unauthorized'},{status:401},req);
        const body = await readBody(req)||{}; const id = body.order_id || crypto.randomUUID().replace(/-/g,'');
        const tracking = (body.provider||'SHIP') + '-' + id.slice(-8).toUpperCase();
        await putJSON(env, 'shipment:'+id, {id, provider:body.provider||'stub', tracking, createdAt:Date.now(), body});
        return json({ok:true, tracking, id}, {}, req);
      }
return json({ok:false, error:'not found'}, {status:404}, req);

    }catch(e){
      return json({ok:false, error: (e && e.message) || String(e)}, {status:500}, req);
    }
  }
};