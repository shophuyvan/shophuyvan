export async function sha256Hex(text) {
  const data = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(String(text || ''))
  );
  return [...new Uint8Array(data)]
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function adminOK(req, env) {
  const url = new URL(req.url);
  const token = req.headers.get('x-token') || url.searchParams.get('token') || '';
  
  if (!token) return false;
  
  // Check KV-stored token first (session token)
  if (env?.SHV?.get) {
    const saved = await env.SHV.get('admin_token');
    if (saved && token === saved) return true;
  }
  
  // Fallback: check env variable (static token)
  if (env?.ADMIN_TOKEN) {
    const expected = await sha256Hex(env.ADMIN_TOKEN);
    return token === expected;
  }
  
  return false;
}