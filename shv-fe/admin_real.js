/* SHV Admin bootstrap / token handler (hotfix v10) */
(function(){
  const LS_KEY='shv_admin_token', SS_REDIRECT_FLAG='shv_login_redirected_once';
  const s=document.currentScript||document.querySelector('script[src*="admin_real.js"]');
  const d=s?s.dataset:{}; const API_BASE=(d.apiBase||'/api').replace(/\/+$/,''); const LOGIN_PATH=d.loginPath||'/admin_login.html';
  const PATCH_FETCH=String(d.patchFetch||'true')!=='false'; const DO_VALIDATE=String(d.validate||'true')!=='false';
  const here=new URL(location.href); const urlToken=here.searchParams.get('token'); if(urlToken){try{localStorage.setItem(LS_KEY,urlToken);}catch{}; history.replaceState(null,'',location.pathname+location.hash||'/admin/');}
  let token=null; try{token=localStorage.getItem(LS_KEY)||'';}catch{}
  if(PATCH_FETCH&&window.fetch){const _f=window.fetch.bind(window); window.fetch=(input,init={})=>{try{const req=new Request(input,init); const u=new URL(req.url,location.origin);
      const isApi=(u.origin===location.origin&&u.pathname.startsWith('/api/'))||u.href.startsWith(API_BASE+'/'); const isLogin=u.pathname.includes('/admin/login');
      if(isApi&&!isLogin){if(!u.searchParams.has('token')&&token){u.searchParams.set('token',token);} input=u.toString(); init=Object.assign({cache:'no-store',credentials:'omit',mode:'cors'},init);} }catch(e){}
      return _f(input,init);};
    window.SHV_AUTH={tokenGetter:()=>token,setToken:(t)=>{token=t;try{localStorage.setItem(LS_KEY,t);}catch{}},logout:()=>{try{localStorage.removeItem(LS_KEY);}catch{};location.href=LOGIN_PATH;},shvApiFetch:(p,init={})=>fetch(API_BASE+'/'+String(p).replace(/^\/+/,''),init)};}
  async function softValidate(){if(!DO_VALIDATE)return ok('skip'); if(!token)return goLogin('no-token'); const url=API_BASE+'/admin/me?token='+encodeURIComponent(token);
    try{const res=await fetch(url,{cache:'no-store',credentials:'omit',mode:'cors'}); if(res.status===401||res.status===403)return goLogin('unauthorized'); if(res.ok)return ok('validated'); if(res.status===404)return warn('me-404'); return warn('status-'+res.status);}catch(e){return warn('network');}}
  function ok(r){setTimeout(()=>document.dispatchEvent(new CustomEvent('shv:auth-ok',{detail:{r}})),0);} function warn(r){console.warn('[SHV]/admin/me skipped:',r); ok(r);}
  function goLogin(r){if(location.pathname===LOGIN_PATH)return; try{if(sessionStorage.getItem(SS_REDIRECT_FLAG))return; sessionStorage.setItem(SS_REDIRECT_FLAG,'1');}catch{} location.href=LOGIN_PATH;}
  softValidate();
})();