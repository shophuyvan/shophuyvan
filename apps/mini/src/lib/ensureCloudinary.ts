const CACHE_KEY = "__cld_cache_v1";
type Kind = 'image' | 'video' | 'auto';

function loadCache(): Record<string, string> {
  try { return JSON.parse(localStorage.getItem(CACHE_KEY) || "{}"); } catch { return {}; }
}
function saveCache(map: Record<string,string>) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(map)); } catch {}
}

export async function ensureCloudinaryUrl(src: string, kind: Kind = 'auto'): Promise<string> {
  if (!src) return src;
  if (/^https:\/\/res\.cloudinary\.com\//i.test(src)) return src;

  const cache = loadCache();
  if (cache[src]) return cache[src];

  const endpoint = `${location.origin}/cld/upload-url`;
  try {
    const r = await fetch(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ src, resource_type: kind })
    });
    const j = await r.json();
    const url = j.secure_url || src;
    cache[src] = url;
    saveCache(cache);
    return url;
  } catch {
    return src;
  }
}