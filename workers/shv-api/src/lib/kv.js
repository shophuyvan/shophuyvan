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

/**
 * List keys by prefix
 * @param {object} env - Worker environment
 * @param {string} prefix - Key prefix to search
 * @param {object} opts - Options { ns: 'SHV'|'VANCHUYEN' }
 * @returns {Promise<object>} KV list result
 */
export async function listKeys(env, prefix, opts = {}) {
  try {
    const kv = pickKV(env, prefix, opts.ns);
    if (!kv?.list) throw new Error('KV binding not available');
    return await kv.list({ prefix });
  } catch (e) {
    console.error('KV listKeys error:', prefix, e);
    throw e;
  }
}

/**
 * Clear all keys with a specific prefix
 * @param {object} env - Worker environment
 * @param {string} prefix - Key prefix to clear
 * @param {object} opts - Options { ns: 'SHV'|'VANCHUYEN' }
 * @returns {Promise<number>} Number of deleted keys
 */
export async function clearByPrefix(env, prefix, opts = {}) {
  try {
    const keys = await listKeys(env, prefix, opts);
    const totalKeys = keys.keys.length;
    
    if (totalKeys === 0) {
      return 0;
    }
    
    let deleted = 0;
    for (const key of keys.keys) {
      const success = await deleteKey(env, key.name, opts);
      if (success) deleted++;
    }
    
    return deleted;
  } catch (e) {
    console.error('KV clearByPrefix error:', prefix, e);
    throw e;
  }
}
