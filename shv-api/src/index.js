/* SHV API Worker v13: CORS + Admin auth + Products CRUD + Banners + Vouchers + Promos */
const textEncoder=new TextEncoder();
function toHex(buf){return [...new Uint8Array(buf)].map(b=>b.toString(16).padStart(2,'0')).join('');}
async function sha256Hex(str){const data=textEncoder.encode(str);const d=await crypto.subtle.digest('SHA-256',data);return toHex(d);}
const ORIGINS=['https://adminshophuyvan.pages.dev'];function pickOrigin(req){const o=req.headers.get('Origin')||'';return ORIGINS.includes(o)?o:ORIGINS[0]||'*';}
function corsHeaders(o,req){const h=new Headers();h.set('Access-Control-Allow-Origin',o);h.set('Vary','Origin');h.set('Access-Control-Allow-Methods','GET,POST,PUT,DELETE,OPTIONS');h.set('Access-Control-Allow-Headers',req?.headers.get('Access-Control-Request-Headers')||'content-type,authorization,x-setup-key');h.set('Access-Control-Max-Age','86400');h.set('Cache-Control','no-store');return h;}
function jsonRes(x,o,s=200){const h=corsHeaders(o);h.set('content-type','application/json;charset=utf-8');return new Response(JSON.stringify(x),{status:s,headers:h});}
function txtRes(x,o,s=200){const h=corsHeaders(o);h.set('content-type','text/plain;charset=utf-8');return new Response(String(x),{status:s,headers:h});}
function newId(){const a=new Uint8Array(8);crypto.getRandomValues(a);return [...a].map(b=>b.toString(16).padStart(2,'0')).join('');}

export default{async fetch(req,env,ctx){
  const url=new URL(req.url); const p=url.pathname; const o=pickOrigin(req);
  if(req.method==='OPTIONS') return new Response(null,{status:204,headers:corsHeaders(o,req)});

  // ---- Setup admin (JSON {u,p}) ----
  if(req.method==='POST' && p==='/admin/setup'){
    const key=req.headers.get('x-setup-key')||''; if(!env.SETUP_KEY) return jsonRes({ok:false,error:'SETUP_KEY missing'},o,500);
    if(key!==env.SETUP_KEY) return jsonRes({ok:false,error:'Forbidden'},o,403);
    const b=await req.json().catch(()=>null); if(!b||!b.u||!b.p) return jsonRes({ok:false,error:'Body {u,p}'},o,400);
    const u=String(b.u).trim().toLowerCase();
    const ex=await env.AUTH_KV.get('admin:'+u,{type:'json'}); if(ex) return jsonRes({ok:false,error:'Admin exists'},o,409);
    const salt=[...crypto.getRandomValues(new Uint8Array(16))].map(b=>b.toString(16).padStart(2,'0')).join('');
    const hash=await sha256Hex(salt+':'+b.p);
    await env.AUTH_KV.put('admin:'+u,JSON.stringify({username:u,hash,salt,createdAt:Date.now()}));
    return jsonRes({ok:true,created:u},o);
  }

  // ---- Login ----
  if(p==='/admin/login'){
    if(req.method!=='POST') return txtRes('method not allowed',o,405);
    const b=await req.json().catch(()=>null); if(!b||!b.u||!b.p) return jsonRes({ok:false,error:'Body {u,p}'},o,400);
    const u=String(b.u).trim().toLowerCase(); const rec=await env.AUTH_KV.get('admin:'+u,{type:'json'});
    if(!rec) return jsonRes({ok:false,error:'Unauthorized'},o,401);
    const h=await sha256Hex(rec.salt+':'+b.p); if(h!==rec.hash) return jsonRes({ok:false,error:'Unauthorized'},o,401);
    const token=newId()+newId(); await env.AUTH_KV.put('session:'+token,JSON.stringify({u:rec.username,t:Date.now()}),{expirationTtl:60*60*24*7});
    return jsonRes({ok:true,token},o);
  }

  // ---- Who am I ----
  if(req.method==='GET'&&(p==='/admin/whoami'||p==='/admin/me')){
    const token=url.searchParams.get('token')||''; const sess=token?await env.AUTH_KV.get('session:'+token,{type:'json'}):null;
    if(!sess) return jsonRes({ok:false,error:'Invalid'},o,401);
    return jsonRes({ok:true,user:sess.u},o);
  }

  // ---- Promos (public + admin) ----
  if(req.method==='GET'&&(p==='/public/promos'||p==='/api/public/promos')){
    const list=await env.PRODUCTS_KV.get('promos:latest',{type:'json'})||[]; return jsonRes(list,o);
  }
  if((p==='/admin/promos'||p==='/api/admin/promos') && req.method==='PUT'){
    const token=url.searchParams.get('token')||''; const sess=token?await env.AUTH_KV.get('session:'+token,{type:'json'}):null; if(!sess) return jsonRes({ok:false,error:'Unauthorized'},o,401);
    const body=await req.json().catch(()=>null); if(!Array.isArray(body)) return jsonRes({ok:false,error:'Body must be array'},o,400);
    await env.PRODUCTS_KV.put('promos:latest',JSON.stringify(body)); return jsonRes({ok:true,saved:body.length},o);
  }

  // ---- Banners ----
  if(req.method==='GET'&&(p==='/public/banners'||p==='/api/public/banners')){
    const list=await env.PRODUCTS_KV.get('banners:latest',{type:'json'})||[]; return jsonRes(list,o);
  }
  if((p==='/admin/banners'||p==='/api/admin/banners') && req.method==='PUT'){
    const token=url.searchParams.get('token')||''; const sess=token?await env.AUTH_KV.get('session:'+token,{type:'json'}):null; if(!sess) return jsonRes({ok:false,error:'Unauthorized'},o,401);
    const body=await req.json().catch(()=>null); if(!Array.isArray(body)) return jsonRes({ok:false,error:'Body must be array'},o,400);
    await env.PRODUCTS_KV.put('banners:latest',JSON.stringify(body)); return jsonRes({ok:true,saved:body.length},o);
  }

  // ---- Vouchers ----
  if(req.method==='GET'&&(p==='/public/vouchers'||p==='/api/public/vouchers')){
    const list=await env.PRODUCTS_KV.get('vouchers:latest',{type:'json'})||[]; return jsonRes(list,o);
  }
  if((p==='/admin/vouchers'||p==='/api/admin/vouchers') && req.method==='PUT'){
    const token=url.searchParams.get('token')||''; const sess=token?await env.AUTH_KV.get('session:'+token,{type:'json'}):null; if(!sess) return jsonRes({ok:false,error:'Unauthorized'},o,401);
    const body=await req.json().catch(()=>null); if(!Array.isArray(body)) return jsonRes({ok:false,error:'Body must be array'},o,400);
    await env.PRODUCTS_KV.put('vouchers:latest',JSON.stringify(body)); return jsonRes({ok:true,saved:body.length},o);
  }

  // ---- Products (admin CRUD) ----
  async function auth(){const t=url.searchParams.get('token')||''; const s=t?await env.AUTH_KV.get('session:'+t,{type:'json'}):null; return !!s;}
  async function getIdx(){return await env.PRODUCTS_KV.get('product:idx',{type:'json'})||{ids:[]};}
  async function putIdx(idx){await env.PRODUCTS_KV.put('product:idx',JSON.stringify(idx));}

  if(p==='/admin/products' && req.method==='GET'){
    if(!await auth()) return jsonRes({ok:false,error:'Unauthorized'},o,401);
    const q=(url.searchParams.get('q')||'').toLowerCase();
    const idx=await getIdx(); const arr=[];
    for(const id of idx.ids){
      const p=await env.PRODUCTS_KV.get('product:'+id,{type:'json'}); if(!p) continue;
      if(q && !String(p.title||'').toLowerCase().includes(q)) continue;
      arr.push({id, title:p.title, price:p.price, stock:p.stock});
    }
    return jsonRes(arr,o);
  }
  if(p==='/admin/product' && req.method==='GET'){
    if(!await auth()) return jsonRes({ok:false,error:'Unauthorized'},o,401);
    const id=url.searchParams.get('id')||''; const item=id?await env.PRODUCTS_KV.get('product:'+id,{type:'json'}):null;
    if(!item) return jsonRes({ok:false,error:'Not found'},o,404);
    return jsonRes({...item,id},o);
  }
  if(p==='/admin/product' && req.method==='PUT'){
    if(!await auth()) return jsonRes({ok:false,error:'Unauthorized'},o,401);
    let id=url.searchParams.get('id')||'new'; const body=await req.json().catch(()=>null); if(!body) return jsonRes({ok:false,error:'Body required'},o,400);
    if(id==='new'){ id=newId(); const idx=await getIdx(); if(!idx.ids.includes(id)){ idx.ids.unshift(id); await putIdx(idx);} }
    await env.PRODUCTS_KV.put('product:'+id,JSON.stringify({...body,updatedAt:Date.now()}));
    return jsonRes({ok:true,id},o);
  }
  if(p==='/admin/product' && req.method==='DELETE'){
    if(!await auth()) return jsonRes({ok:false,error:'Unauthorized'},o,401);
    const id=url.searchParams.get('id')||''; if(!id) return jsonRes({ok:false,error:'id required'},o,400);
    await env.PRODUCTS_KV.delete('product:'+id);
    const idx=await getIdx(); idx.ids=idx.ids.filter(x=>x!==id); await putIdx(idx);
    return jsonRes({ok:true,deleted:id},o);
  }

  return txtRes('not found',o,404);
}};
