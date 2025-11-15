/**
 * Lazada OAuth Helper
 * workers/shv-api/src/modules/lazada.js
 */

export function buildOAuthURL(env) {
  const clientId = env.LAZADA_APP_KEY;
  const callback = 'https://api.shophuyvan.vn/channels/lazada/callback';

  if (!clientId) {
    throw new Error('Missing LAZADA_APP_KEY');
  }

  const url =
    'https://auth.lazada.com/oauth/authorize?' +
    `response_type=code&force_auth=true&redirect_uri=${encodeURIComponent(
      callback
    )}&client_id=${clientId}`;

  return url;
}

export async function exchangeToken(env, code) {
  const clientId = env.LAZADA_APP_KEY;
  const clientSecret = env.LAZADA_APP_SECRET;
  const callback = 'https://api.shophuyvan.vn/channels/lazada/callback';

  if (!clientId || !clientSecret) {
    throw new Error('Missing Lazada App Key/Secret');
  }

  const timestamp = Date.now().toString();
  
  const tokenUrl = new URL('https://auth.lazada.com/rest/auth/token/create');
  tokenUrl.searchParams.append('app_key', clientId);
  tokenUrl.searchParams.append('timestamp', timestamp);
  tokenUrl.searchParams.append('sign_method', 'sha256');
  tokenUrl.searchParams.append('code', code);

  // Generate signature - Lazada format: /api + sorted params
  const apiPath = '/auth/token/create';
  const params = {
    app_key: clientId,
    code: code,
    sign_method: 'sha256',
    timestamp: timestamp,
  };
  
  const sortedKeys = Object.keys(params).sort();
  let signString = apiPath;
  for (const key of sortedKeys) {
    signString += key + params[key];
  }

  console.log('[Lazada][exchangeToken] Sign string:', signString);

  const keyBuffer = new TextEncoder().encode(clientSecret);
  const msgBuffer = new TextEncoder().encode(signString);
  
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyBuffer,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const hashBuffer = await crypto.subtle.sign('HMAC', cryptoKey, msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const sign = hashArray.map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();

  console.log('[Lazada][exchangeToken] Signature:', sign);

  tokenUrl.searchParams.append('sign', sign);

  console.log('[Lazada][exchangeToken] URL:', tokenUrl.toString());

  const res = await fetch(tokenUrl.toString(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  console.log('[Lazada][exchangeToken] Status:', res.status);

  const text = await res.text();
  console.log('[Lazada][exchangeToken] Raw response:', text);

  let json;
  try {
    json = JSON.parse(text);
  } catch (e) {
    console.error('[Lazada][exchangeToken] Parse error - Status:', res.status);
    console.error('[Lazada][exchangeToken] Parse error - Body:', text);
    throw new Error('lazada_token_not_json');
  }

  if (!res.ok) {
    throw new Error('Lazada token error: ' + JSON.stringify(json));
  }

  return json;
}


export async function loadLazadaShops(env) {
  const raw = await env.SHV.get('channels:lazada:shops');
  if (!raw) return [];
  try {
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list : [];
  } catch (e) {
    console.error('[Lazada] parse error:', e);
    return [];
  }
}

export async function saveLazadaShops(env, shops) {
  await env.SHV.put('channels:lazada:shops', JSON.stringify(shops || []));
}
