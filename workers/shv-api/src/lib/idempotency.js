export async function idemGet(req, env) {
  try {
    const key = req.headers.get('Idempotency-Key');
    if (!key) return { key: null, hit: false, body: null };
    
    const body = await env.SHV.get('idem:' + key);
    return { key, hit: !!body, body };
  } catch (e) {
    return { key: null, hit: false, body: null };
  }
}

export async function idemSet(key, env, response) {
  if (!key || !response || !(response instanceof Response)) return;
  
  try {
    const text = await response.clone().text();
    await env.SHV.put('idem:' + key, text, { 
      expirationTtl: 24 * 3600 // 24 hours
    });
  } catch (e) {
    console.error('idemSet error:', e);
  }
}