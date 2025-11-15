/**
 * Lazada API Helper
 * Call Lazada Open Platform API với signature
 */

export async function callLazadaAPI(env, shopId, apiPath, params = {}) {
  // Load shop info
  const shopRaw = await env.SHV.get(`channels:lazada:shop:${shopId}`);
  if (!shopRaw) {
    throw new Error('Shop not found');
  }

  const shop = JSON.parse(shopRaw);
  const appKey = env.LAZADA_APP_KEY;
  const appSecret = env.LAZADA_APP_SECRET;
  const accessToken = shop.access_token;

  if (!appKey || !appSecret || !accessToken) {
    throw new Error('Missing credentials');
  }

  const timestamp = Date.now().toString();

  // Build params
  const allParams = {
    app_key: appKey,
    timestamp: timestamp,
    sign_method: 'sha256',
    access_token: accessToken,
    ...params,
  };

  // Generate signature
  const sortedKeys = Object.keys(allParams).sort();
  let signString = apiPath;
  for (const key of sortedKeys) {
    signString += key + allParams[key];
  }

  const keyBuffer = new TextEncoder().encode(appSecret);
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
  const sign = hashArray
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase();

  // Build URL
  const url = new URL(`https://api.lazada.vn/rest${apiPath}`);
  Object.keys(allParams).forEach((key) => {
    url.searchParams.append(key, allParams[key]);
  });
  url.searchParams.append('sign', sign);

  // Call API
  const res = await fetch(url.toString(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  const data = await res.json();

  if (!res.ok || (data.code && data.code !== '0')) {
    throw new Error(data.message || 'Lazada API error');
  }

  return data;
}