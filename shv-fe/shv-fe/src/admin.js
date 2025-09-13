// Auto-append token to API calls
(function(){
  function withToken(url){
    const u = new URL(url, location.origin);
    const t = localStorage.getItem('admin_token') || new URL(location.href).searchParams.get('token') || '';
    if(t && !u.searchParams.get('token')) u.searchParams.set('token', t);
    return u.toString();
  }
  window.apiFetch = async function(path, opts){
    const base = window.API_BASE || 'https://shv-api.shophuyvan.workers.dev';
    const url = withToken(base.replace(/\/$/,'') + '/' + String(path).replace(/^\//,''));
    const r = await fetch(url, Object.assign({method:'GET'}, opts||{}));
    if(!r.ok) throw new Error('HTTP '+r.status);
    const ct = r.headers.get('content-type')||'';
    return ct.includes('application/json') ? r.json() : r.text();
  };
})();