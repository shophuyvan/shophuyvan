/* SHV Admin bootstrap & token/fetch patch (v12) */
(function(){
  const LS='shv_admin_token', SS='shv_login_redirected_once';
  const s=document.currentScript;const API=(s?.dataset.apiBase||'https://shv-api.shophuyvan.workers.dev').replace(/\/+$/,'');const LOGIN=s?.dataset.loginPath||'/admin_login.html';
  const t=new URL(location.href).searchParams.get('token'); if(t){try{localStorage.setItem(LS,t);}catch{} history.replaceState(null,'',location.pathname+location.hash||'/admin/');}
  let token=''; try{token=localStorage.getItem(LS)||'';}catch{}
  const _f=window.fetch.bind(window); window.fetch=(i,o={})=>{try{const r=new Request(i,o); const u=new URL(r.url,location.origin); const isApi=u.href.startsWith(API+'/'); const isLogin=u.pathname.includes('/admin/login'); if(isApi&&!isLogin){ if(token&&!u.searchParams.has('token'))u.searchParams.set('token',token); i=u.toString(); o=Object.assign({cache:'no-store',credentials:'omit',mode:'cors'},o);} }catch(e){} return _f(i,o);};
  window.SHV_AUTH={tokenGetter:()=>token,setToken:(x)=>{token=x;try{localStorage.setItem(LS,x);}catch{}},logout:()=>{try{localStorage.removeItem(LS);}catch{} location.href=LOGIN;},shvApiFetch:(p,o={})=>fetch(API+'/'+String(p).replace(/^\/+/,''),o)};
  (async()=>{if(!token)return;try{await fetch(API+'/admin/me?token='+encodeURIComponent(token),{mode:'cors',cache:'no-store'});}catch{}})();
})();