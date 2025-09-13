/*! Shop Huy Van - admin_real.js (v3, root) */
(function () {
  const SCRIPT = document.currentScript;
  const API_BASE = (window.SHV_API_BASE || (SCRIPT && SCRIPT.dataset.apiBase)) || '/api';
  const LOGIN_PATH = (window.SHV_LOGIN_PATH || (SCRIPT && SCRIPT.dataset.loginPath)) || '/admin_login.html';
  const STORAGE_KEY = (window.SHV_TOKEN_KEY || (SCRIPT && SCRIPT.dataset.tokenKey)) || 'shv_admin_token';
  const PATCH_FETCH = (SCRIPT && SCRIPT.dataset.patchFetch === 'true') || true;
  const SHOULD_VALIDATE = !((SCRIPT && SCRIPT.dataset.validate === 'false'));

  if (window.__SHV_AUTH_INIT__) return;
  window.__SHV_AUTH_INIT__ = true;

  function getTokenFromUrl() {
    try { const url = new URL(location.href); const t = url.searchParams.get('token'); if (t && t.length > 5) return t; } catch (e) {}
    return null;
  }
  function saveToken(t){ try{ localStorage.setItem(STORAGE_KEY,t);}catch(e){} }
  function getToken(){ try{ return localStorage.getItem(STORAGE_KEY)||'';}catch(e){ return ''; } }
  function clearToken(){ try{ localStorage.removeItem(STORAGE_KEY);}catch(e){} }

  function removeTokenFromUrl(){
    try{ const url=new URL(location.href); if(!url.searchParams.has('token')) return;
      url.searchParams.delete('token'); history.replaceState({}, document.title, url.toString());
    }catch(e){}
  }

  function loginUrl(){
    try{ if(/^https?:\/\//.test(LOGIN_PATH)) return LOGIN_PATH; return new URL(LOGIN_PATH, location.origin).toString(); }
    catch(e){ return '/admin_login.html'; }
  }
  function gotoLogin(){ location.replace(loginUrl()); }

  function normalizeApi(pathOrUrl){
    const base=(API_BASE||'').replace(/\/+$/, '');
    if (/^https?:\/\//.test(pathOrUrl)) return pathOrUrl;
    return base + '/' + String(pathOrUrl||'').replace(/^\/+/, '');
  }
  function sameOrigin(a,b){
    try{ const A=new URL(a, location.origin); const B=new URL(b, location.origin); return A.origin===B.origin; }catch(e){ return false; }
  }
  function appendTokenParam(u, token){
    try{
      const url=new URL(u, location.origin);
      if (sameOrigin(url, API_BASE)) {
        if (!url.searchParams.has('token')) url.searchParams.set('token', token||'');
      }
      return url.toString();
    }catch(e){ return u; }
  }

  async function validateToken(token){
    const meUrl = appendTokenParam(normalizeApi('/admin/me'), token);
    try {
      const res = await fetch(meUrl, { method:'GET', mode:'cors', credentials:'omit', cache:'no-store' });
      if (!res.ok) return 'invalid';
      try {
        const data = await res.json();
        if (data && data.ok === false) return 'invalid';
      } catch (_) {}
      return 'ok';
    } catch (err) {
      console.warn('[SHV] /admin/me check skipped due to CORS/network:', err);
      return 'network'; // soft-pass
    }
  }

  async function shvApiFetch(pathOrUrl, opts){
    const token=getToken(); const url=appendTokenParam(normalizeApi(pathOrUrl), token);
    return fetch(url, Object.assign({ mode:'cors', credentials:'omit' }, opts));
  }

  function exposeGlobals(token){
    try{
      window.SHV_AUTH={ token, API_BASE, LOGIN_PATH, STORAGE_KEY, getToken, clearToken,
        logout:function(){ clearToken(); gotoLogin(); }, gotoLogin, shvApiFetch };
      document.documentElement.setAttribute('data-shv-auth','ok');
      document.dispatchEvent(new CustomEvent('shv:auth-ok',{ detail:{ token } }));
    }catch(e){}
  }

  function maybePatchFetch(){
    if (!PATCH_FETCH) return;
    const nativeFetch=window.fetch;
    window.fetch=function(input, init){
      try{
        const token=getToken();
        if (typeof input === 'string') {
          input = appendTokenParam(input, token);
        } else if (input && typeof input.url === 'string') {
          const newUrl = appendTokenParam(input.url, token);
          input = new Request(newUrl, input);
        }
      }catch(e){}
      return nativeFetch(input, Object.assign({ mode:'cors' }, init));
    };
  }

  function bannerWarn(msg){
    try{
      const el=document.createElement('div');
      el.textContent=msg;
      el.style.cssText='position:fixed;left:12px;bottom:12px;right:12px;padding:10px;font:12px/1.4 system-ui;background:#fffbe6;border:1px solid #ffe58f;border-radius:8px;z-index:99999';
      document.body.appendChild(el);
      setTimeout(()=>{ el.remove(); }, 6000);
    }catch(e){}
  }

  (async function main(){
    document.documentElement.setAttribute('data-shv-auth','checking');

    let loginPath = LOGIN_PATH || '/admin_login.html';
    try { loginPath = new URL(loginUrl()).pathname; } catch (e) {}
    const isLoginPage = location.pathname === loginPath || location.pathname.endsWith('/admin_login');

    const urlToken = getTokenFromUrl();
    if (urlToken) { saveToken(urlToken); removeTokenFromUrl(); }

    if (isLoginPage) { document.documentElement.removeAttribute('data-shv-auth'); return; }

    const token = getToken();
    if (!token) { gotoLogin(); return; }

    maybePatchFetch();

    if (SHOULD_VALIDATE) {
      const status = await validateToken(token);
      if (status === 'invalid') { clearToken(); gotoLogin(); return; }
      if (status === 'network') { bannerWarn('Không kiểm tra được token do CORS/network. Vẫn tiếp tục vào Admin. Hãy sửa CORS/API hoặc dùng proxy /api.'); }
    }

    exposeGlobals(token);

    try {
      const boot = window.startAdminApp || window.bootAdmin || window.initAdmin;
      if (typeof boot === 'function') boot();
    } catch (e) { console.warn('Admin boot error:', e); }
  })();
})();