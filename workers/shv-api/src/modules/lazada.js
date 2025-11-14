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

  const form = new FormData();
  form.set('grant_type', 'authorization_code');
  form.set('client_id', clientId);
  form.set('client_secret', clientSecret);
  form.set('code', code);
  form.set('redirect_uri', callback);

  const res = await fetch('https://auth.lazada.com/oauth/token', {
    method: 'POST',
    body: form,
  });

  const json = await res.json();
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
