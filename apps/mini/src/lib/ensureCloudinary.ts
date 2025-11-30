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

   // [CORE SYNC] Không tự ý fetch ảnh ngoại lai từ Client (tránh lỗi 401 Unauthorized)
  // Core đã xử lý link ảnh đầu vào.
  return src; 
}