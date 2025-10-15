// workers/shv-api/src/lib/kv.js
// Detected KV namespaces from wrangler.toml: SHV, VANCHUYEN

/// Auto-select the correct KV binding by (1) explicit ns, (2) key prefix, then (3) default.
const KV_PREFIX_MAP = {
  'ship:': 'VANCHUYEN',
  'shipping:': 'VANCHUYEN',
};

function pickKV(env, key, ns) {
  // 1) explicit namespace
  if (ns && env?.[ns]) return env[ns];

  // 2) by key prefix mapping
  for (const [prefix, binding] of Object.entries(KV_PREFIX_MAP)) {
    if (prefix && key.startsWith(prefix) && env?.[binding]) return env[binding];
  }

  // 3) default: SHV if present, else first configured binding
  if (env?.SHV) return env.SHV;

  // fallback: pick any available binding
  const candidates = ['SHV','VANCHUYEN'];
  for (const b of candidates) if (env?.[b]) return env[b];
  return null;
}

export async function getJSON(env, key, fallback = null, opts = {}) {
  try {
    const kv = pickKV(env, key, opts.ns);
    if (!kv?.get) return fallback;
    const raw = await kv.get(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) {
    console.error('KV getJSON error:', key, e);
    return fallback;
  }
}

export async function putJSON(env, key, value, opts = {}) {
  const kv = pickKV(env, key, opts.ns);
  if (!kv?.put) throw new Error('KV binding not available');
  const body = JSON.stringify(value ?? null);
  await kv.put(key, body, { expirationTtl: opts.ttl || undefined });
  return true;
}

export async function deleteKey(env, key, opts = {}) {
  try {
    const kv = pickKV(env, key, opts.ns);
    if (!kv?.delete) return false;
    await kv.delete(key);
    return true;
  } catch (e) {
    console.error('KV delete error:', key, e);
    return false;
  }
}
