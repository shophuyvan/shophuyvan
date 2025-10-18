// === SHV Cloudinary helper (Admin Plan A) ===
function cloudify(u, t='w_800,q_auto,f_auto'){
  try{
    if(!u) return u;
    var base = (typeof location!=='undefined' && location.origin) ? location.origin : 'https://example.com';
    var url = new URL(u, base);
    if(!/res\.cloudinary\.com/i.test(url.hostname)) return u; // only transform Cloudinary URLs
    if(/\/upload\/[^/]+\/.*/.test(url.pathname)) return url.toString(); // already has transforms
    url.pathname = url.pathname.replace('/upload/', '/upload/'+t+'/');
    return url.toString();
  }catch(_){ return u; }
}

/* SHV admin patch v47 - FIXED LOGIN LOOP */
// Admin core (API base, auth token, robust fetch + fallbacks)
window.Admin = (function(){
  const store = (k, v) => (v===undefined ? localStorage.getItem(k) : (localStorage.setItem(k, v), v));
  let apiBase = store('apiBase') || 'https://shv-api.shophuyvan.workers.dev';

  function setBase(v){
    if (!v) return apiBase;
    apiBase = String(v).replace(/\/+$/,'');
    store('apiBase', apiBase);
    renderApiBase();
    return apiBase;
  }
  function getBase(){ return apiBase; }
  function renderApiBase(){
    const el = document.querySelector('[data-api-base]');
    if (el) el.textContent = apiBase;
    const input = document.querySelector('#api');
    if (input && !input.value) input.value = apiBase;
  }

  function token(v){ return store('x-token', v); }

  async function req(path, init={}){
    const url = (path.startsWith('http')? path : (getBase()+ (path.startsWith('/')?'':'/') + path));
    const headers = new Headers(init.headers||{});
    // Attach token (if any)
    const t = token();
    if (t) headers.set('x-token', t);
    let body = init.body;
    const isFd = (typeof FormData!=='undefined') && body instanceof FormData;
    if (body && typeof body === 'object' && !isFd) {
      if (!headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
      body = JSON.stringify(body);
    }
    // Robust fetch + JSON convenience
    if((init.method||'GET').toUpperCase()!=='GET' && !headers.has('Idempotency-Key')){
      headers.set('Idempotency-Key', 'idem-'+Date.now()+'-'+Math.random().toString(36).slice(2,8));
    }
    console.info('[Admin.req]', (init.method||'GET'), url);
    const res = await fetch(url, { method: init.method||'GET', headers, body, credentials:'omit' });
    let data = null;
    const ctype = res.headers.get('content-type')||'';
    if (ctype.includes('application/json')) {
      try { data = await res.json(); } catch(e){ data = null; }
    }
    // unify ok/data so callers can check
    if (data && data.ok===undefined) data.ok = res.ok;
    data = data || { ok: res.ok, status: res.status };
    return data;
  }

  // Try list of paths until one returns ok
  async function tryPaths(paths, init={}){
    for (const p of paths){
      try {
        const r = await req(p, init);
        if (r && (r.ok || (r.status===200||r.status===204))) return r;
      } catch(e){}
    }
    return { ok:false };
  }

  async function login(u, p){
    const r = await tryPaths(['/admin/login', '/login', '/admin_auth/login'], {
      method:'POST', body:{ user:u, pass:p }
    });
    if (r && r.ok && (r.token || r['x-token'])){
      token(r.token || r['x-token']);
      return true;
    }
    return false;
  }

  async function me(){
    return await tryPaths(['/admin/me', '/me', '/admin/auth/me']);
  }

  function toast(msg, t=1800){
    let el = document.querySelector('#__toast');
    if (!el){
      el = document.createElement('div'); el.id='__toast';
      el.style.cssText = 'position:fixed;right:12px;bottom:12px;background:#132240;border:1px solid #2b4270;color:#e5ecff;padding:10px 12px;border-radius:10px;z-index:9999;box-shadow:0 8px 24px rgba(0,0,0,.4)';
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.style.opacity = '1';
    setTimeout(()=>{ el.style.opacity='0'; }, t);
  }

  function ensureAuth(){
    // FIXED: Check if we're on login page first
    const isLoginPage = /login|admin_login/.test(location.pathname);
    if (isLoginPage) {
      console.log('[Admin] On login page, skipping auth check');
      return;
    }

    const t = token();
    if (!t) {
      console.log('[Admin] No token, redirecting to login');
      location.href = '/login_admin.html';
    }
  }

  // Back-compat aliases
  function getApiBase(){ return getBase(); }
  function setApiBase(v){ return setBase(v); }

  const api = { setBase, getBase, renderApiBase, token, req, tryPaths, login, me, toast, ensureAuth,
                getApiBase, setApiBase };
  Object.defineProperty(api, 'apiBase', { get: ()=>getBase() });
  return api;
})();

document.addEventListener('DOMContentLoaded', ()=>window.Admin && Admin.renderApiBase());

// v24: Ads page quick wire if not present
document.addEventListener('DOMContentLoaded', ()=>{
  if(!/ads\.html/.test(location.pathname)) return;
  const h = (key, id)=>{
    const btn = document.getElementById('save_'+key);
    if(!btn) return;
    btn.onclick = async ()=>{
      const val = document.getElementById({fb:'fb_pixel',ga:'ga_tag',zl:'zalo_pixel'}[key])?.value?.trim() || '';
      try{
        const r = await Admin.req('/admin/settings/upsert', { method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify({ path: 'ads.'+key, value: val }) });
        Admin.toast('Đã lưu '+key.toUpperCase());
      }catch(e){ alert('Lưu lỗi: '+e.message); }
    };
  };
  ['fb','ga','zl'].forEach(k=>h(k));
});

// --- v25 Admin runtime fixes ---
(function(){
  document.addEventListener('DOMContentLoaded', ()=>{
    // 0) Common helpers
    const $ = (s)=>document.querySelector(s);
    const on = (id, fn)=>{ const el=document.getElementById(id); if(el && !el.__wired){ el.__wired=true; el.addEventListener('click', fn); } };

    // 1) De-duplicate nav tabs (avoid duplicates like 'Đơn hàng'/'Thống kê')
    try{
      const nav = document.querySelector('.header .nav');
      if(nav){
        const seen = new Set();
        const a = Array.from(nav.querySelectorAll('a.badge'));
        a.forEach(x=>{
          const key = (x.getAttribute('href')||'')+'|'+(x.textContent||'').trim();
          if(seen.has(key)) x.remove(); else seen.add(key);
        });
      }
    }catch{}

    // 2) AI wiring on product_edit.html
    if(/product_edit\.html/.test(location.pathname)){
      async function aiCall(type, ctx){
        try{
          const r = await Admin.req('/admin/ai/generate', { method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify({ type, ctx }) });
          return r;
        }catch(e){ Admin.toast('AI lỗi: '+e?.message); return null; }
      }
      on('aiTitle', async ()=>{
        const title = $('#title')?.value||''; const desc=$('#desc')?.value||'';
        const r = await aiCall('title', { title, description: desc }); if(!r) return;
        const box = document.getElementById('aiTitleBox') || document.getElementById('title');
        if(Array.isArray(r.suggestions) && r.suggestions.length && box){ box.value = r.suggestions[0]; }
      });
      on('aiDesc', async ()=>{
        const title = $('#title')?.value||''; const desc=$('#desc')?.value||'';
        const r = await aiCall('desc', { title, description: desc }); if(!r) return;
        if(r.text) document.getElementById('desc').value = r.text;
      });
      on('aiSEO', async ()=>{
        const title = $('#title')?.value||''; const desc=$('#desc')?.value||'';
        const r = await aiCall('seo', { title, description: desc }); if(!r) return;
        if(r.seo){ if(r.seo.title) $('#seoTitle').value=r.seo.title; if(r.seo.description) $('#seoDesc').value=r.seo.description; if(Array.isArray(r.seo.keywords)) $('#keywords').value=r.seo.keywords.join(', '); }
      });
      on('aiFAQ', async ()=>{
        const title = $('#title')?.value||''; const desc=$('#desc')?.value||'';
        const r = await aiCall('faq', { title, description: desc }); if(!r) return;
        if(Array.isArray(r.items)){ const t=r.items.map(x=>`- ${x.q}\n  ${x.a}`).join('\n'); const el=$('#faq')||$('#desc'); el.value = (el.value? el.value+'\n\n':'')+'FAQ:\n'+t; }
      });
      on('aiReviews', async ()=>{
        const title = $('#title')?.value||'';
        const r = await aiCall('reviews', { title }); if(!r) return;
        if(Array.isArray(r.items)){ const t=r.items.map(x=>`- ${x.name||'Khách'}: ${x.text||''} (${x.star||5}★)`).join('\n'); const el=$('#reviews')||$('#desc'); el.value = (el.value? el.value+'\n\n':'')+'Đánh giá mẫu:\n'+t; }
      });
      on('aiAltAll', async ()=>{
        const title = $('#title')?.value||''; const desc=$('#desc')?.value||'';
        const r = await aiCall('alt', { title, description: desc }); if(!r) return;
        const alts = Array.isArray(r.items)? r.items: [];
        // Try to distribute alts to visible image items under #imgs
        const wrap = document.getElementById('imgs');
        if(wrap){
          const rows = Array.from(wrap.querySelectorAll('.img-row, .row, li, div'));
          let i=0;
          rows.forEach(row=>{
            const inp = row.querySelector('input[placeholder*="ALT"], input[aria-label*="ALT"], input.img-alt, textarea.img-alt');
            if(inp && alts[i]){ inp.value = alts[i++]; }
          });
        }
        // Also drop suggestions in the right-side "Gợi ý" box
        const box = document.getElementById('suggest');
        if(box && alts.length){ box.textContent = alts.map((s,j)=>`${j+1}. ${s}`).join('\n'); }
        Admin.toast('AI ALT đã gợi ý '+alts.length+' mô tả.');
      });
    }

    // 3) Quick responsive tweak for tables on small screens
    try{ document.querySelectorAll('.table').forEach(t=>{ t.style.display='block'; t.style.overflow='auto'; t.style.whiteSpace='nowrap'; }); }catch{}
  });
})();
