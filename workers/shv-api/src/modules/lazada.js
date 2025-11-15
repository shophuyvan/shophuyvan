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

  const params = new URLSearchParams();
  params.append('grant_type', 'authorization_code');
  params.append('client_id', clientId);
  params.append('client_secret', clientSecret);
  params.append('code', code);
  params.append('redirect_uri', callback);

  const res = await fetch('https://auth.lazada.com/oauth/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });

  const text = await res.text();  // Lazada đôi khi trả về HTML hoặc empty

  let json;
  try {
    json = JSON.parse(text);
  } catch (e) {
    console.error('[Lazada][exchangeToken] Raw response:', text);
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
