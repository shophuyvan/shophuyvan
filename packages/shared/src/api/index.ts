// packages/shared/src/api/index.ts
import { pickLowestPrice, pickPrice, numLike } from '../utils/price';

const API_BASE: string = (globalThis as any).API_BASE || 'https://shv-api.shophuyvan.workers.dev';

type FetchResult = { ok: boolean; status: number; data: any };

async function _fetch(path: string, init?: RequestInit): Promise<FetchResult> {
  const url = path.startsWith('http') ? path : `${API_BASE}${path.startsWith('/') ? '' : '/'}${path}`;
  const headers = new Headers(init?.headers || {});
  try { const token = localStorage.getItem('x-token') || ''; if (token && !headers.has('x-token')) headers.set('x-token', token); } catch {}
  const res = await fetch(url, { method: init?.method || 'GET', headers });
  const ctype = res.headers.get('content-type') || '';
  const data = ctype.includes('application/json') ? await res.json().catch(()=>null) : await res.text().catch(()=>'');
  return { ok: res.ok, status: res.status, data };
}

function toArr(x:any): any[] {
  if (!x) return [];
  if (Array.isArray(x)) return x;
  if (Array.isArray(x.items)) return x.items;
  if (Array.isArray(x.list)) return x.list;
  if (x.data) {
    if (Array.isArray(x.data.items)) return x.data.items;
    if (Array.isArray(x.data.list)) return x.data.list;
    if (Array.isArray(x.data)) return x.data;
  }
  if (Array.isArray(x.results)) return x.results;
  if (Array.isArray(x.rows)) return x.rows;
  return [];
}

function imagesOf(p:any): string[] {
  const arr:any[] = [];
  if (Array.isArray(p?.images)) arr.push(...p.images);
  if (p?.image) arr.unshift(p.image);
  if (p?.thumb || p?.thumbnail) arr.push(p.thumb || p.thumbnail);
  return arr.filter(Boolean).map(String);
}
function videosOf(p:any): string[] {
  const arr:string[] = [];
  if (Array.isArray(p?.videos)) arr.push(...p.videos);
  if (p?.video) arr.unshift(p.video);
  if (Array.isArray(p?.media)) {
    for (const m of p.media) {
      const u = m?.src || m?.url || '';
      if (/\.(mp4|webm|m3u8)(\?.*)?$/i.test(u) || m?.type === 'video') arr.push(String(u));
    }
  }
  return arr;
}
function variantsOf(p:any): any[] {
  if (Array.isArray(p?.variants)) return p.variants;
  const keys = ['skus','sku_list','children','items','options','variations','combos','list'];
  for (const k of keys) { const v = p?.[k]; if (Array.isArray(v)) return v; }
  if (Array.isArray(p?.options?.variants)) return p.options.variants;
  return [];
}
function readRating(p:any): number {
  const cand = [p?.rating, p?.rating_avg, p?.avg_rating, p?.star, p?.stars, p?.review_avg];
  for (const v of cand) { const n = Number(v); if (!isNaN(n) && n>0) return n; }
  return 0;
}
function readSold(p:any): number {
  const cand = [p?.sold, p?.sold_count, p?.sales, p?.orders, p?.order_count, p?.purchases];
  for (const v of cand) { const n = Number(v); if (!isNaN(n) && n>0) return n; }
  return 0;
}
function normalizePrice(p:any) {
  let pair = pickLowestPrice(p);
  let base = numLike(pair?.base);
  let original = numLike(pair?.original);

  if (base <= 0) {
    const pp = pickPrice(p);
    base = numLike(pp?.base);
    original = numLike(original || (pp?.original ?? 0));
  }
  if (base <= 0) {
    const bCand = [
      p?.min_price, p?.price_min, p?.minPrice, p?.priceFrom, p?.price_from, p?.lowest_price,
      p?.sale_price, p?.price_sale, p?.deal_price, p?.special_price,
      p?.price, p?.regular_price, p?.base_price, p?.priceText,
      p?.price?.min, p?.price?.from, p?.price?.base, p?.price?.value
    ];
    for (const v of bCand) { const n = numLike(v); if (n>0) { base = n; break; } }
  }
  const maxLike = numLike(p?.price?.max ?? p?.price?.to ?? p?.max_price ?? p?.price_max ?? p?.original_price ?? p?.list_price);
  if (maxLike > base) original = maxLike;
  if (original <= 0) original = null as any;
  return { base, original };
}

function normalizeProduct(p:any) {
  if (!p) return null;
  const id = p.id ?? p._id ?? p.sku ?? p.code ?? p.slug;
  const name = p.name ?? p.title ?? p.product_name ?? p.full_name ?? 'Sản phẩm';
  const images = imagesOf(p);
  const image = images[0] || '';
  const price = normalizePrice(p);
  const variants = variantsOf(p);
  const description = p.description_html || p.description || p.desc || '';
  const videos = videosOf(p);
  const rating = readRating(p);
  const sold = readSold(p);
  if (!id) return null;
  return { id, name, image, images, price, variants, description, videos, rating, sold, raw: p };
}


function toSlug(input:any): string {
  const s = String(input || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');
}

async function discover<T>(candidates:string[], pick:(data:any)=>T|null): Promise<T> {
  for (const p of candidates) {
    const r = await _fetch(p);
    if (!r.ok) continue;
    const v = pick(r.data);
    if (v != null) return v;
  }
  throw new Error('Không tìm thấy endpoint phù hợp.');
}

export const api = {
  async get(path: string) {
    const r = await _fetch(path);
    if (!r.ok) throw new Error(`API error: ${r.status}`);
    return r.data;
  },
  products: {
    async list({ limit = 12, category }: { limit?: number; category?: string } = {}) {
      const enc = category ? encodeURIComponent(String(category)) : '';
      const qs = `?limit=${limit}` + (category ? `&category=${enc}&cate=${enc}&category_slug=${enc}&categoryId=${enc}` : '');
      const candidates = [
        `/public/products${qs}`,
        `/products${qs}`,
        `/api/products${qs}`,
        `/v1/product/list${qs}`,
        `/product/list${qs}`,
        `/items${qs}`,
        `/v1/items${qs}`,
      ];
      return discover<any[]>(candidates, (data) => {
        const arr = toArr(data).map(normalizeProduct).filter(Boolean);
        // If backend doesn't filter by category, filter client-side using common fields
        const out = (arr.length ? (arr as any[]) : null);
        if (!out) return null;
        if (category) {
          
const key = String(category).toLowerCase();
const slugKey = toSlug(category);
const filtered = out.filter((p:any) => {
  const raw:any = p?.raw || {};
  const top:any = p || {};
  const cands:any[] = [
    top.category, top.category_name, top.category_slug, top.categoryId, top.cate,
    raw.category, raw.category_name, raw.category_slug, raw.categoryId, raw.cate,
    raw.group, raw.group_slug, raw.type,
    top?.meta?.category, top?.meta?.category_name, top?.meta?.category_slug,
    raw?.meta?.category, raw?.meta?.category_name, raw?.meta?.category_slug,
  ];
  if (Array.isArray(raw.categories)) cands.push(...raw.categories);
  if (Array.isArray(top.categories)) cands.push(...top.categories);
  if (Array.isArray(raw.tags)) cands.push(...raw.tags);
  if (Array.isArray(top.tags)) cands.push(...top.tags);
  function hit(val:any): boolean {
    if (!val) return false;
    if (Array.isArray(val)) return val.some(hit);
    if (typeof val === 'object') return hit(val.slug || val.code || val.name || val.title || val.label || val.text);
    const s = String(val);
    const sv = s.toLowerCase();
    const sl = toSlug(s);
    return sv.includes(key) || sl === slugKey || (slugKey && sl.includes(slugKey));
  }
  const alias:any = {
    'dien-nuoc': ['điện & nước','điện nước','dien nuoc','thiet bi dien nuoc'],
    'nha-cua-doi-song': ['nhà cửa đời sống','nha cua doi song','do gia dung'],
    'hoa-chat-gia-dung': ['hoá chất gia dụng','hoa chat gia dung','hoa chat'],
    'dung-cu-thiet-bi-tien-ich': ['dụng cụ thiết bị tiện ích','dung cu thiet bi tien ich','dung cu tien ich']
  };
  const syns = alias[slugKey] || [];
  cands.push(...syns);
  return cands.some(hit);
});
return filtered;
        }
        return out;
      });
    },
    async listWithPrices({ limit = 12, category, concurrency = 4 }: { limit?: number; category?: string; concurrency?: number } = {}) {
      const base = await this.list({ limit, category });
      if (!base || !Array.isArray(base)) return base as any;
      const items = [...base];
      const need = items.map((p:any, i:number) => ({ i, p })).filter(x => !(x.p?.price && x.p.price.base > 0));
      const q:any[] = [];
      let idx = 0;
      async function worker(){
        while (idx < need.length){
          const cur = need[idx++];
          try { const d = await api.products.detail(cur.p.id); if (d?.price?.base > 0) items[cur.i] = d; } catch {}
        }
      }
      const n = Math.max(1, Number(concurrency||1));
      await Promise.all(Array.from({length:n}, worker));
      return items;
    },
    async detail(id: string | number) {
      const candidates = [
        `/public/products/${id}`,
        `/products/${id}`,
        `/api/products/${id}`,
        `/v1/product/${id}`,
        `/product/${id}`,
        `/items/${id}`,
        `/v1/items/${id}`,
      ];
      return discover<any>(candidates, (data) => {
        const obj = (data && typeof data === 'object' && (data.item || data.product || data.data)) || data;
        const norm = normalizeProduct(obj);
        return norm;
      });
    },
  },
  categories: {
    async list() {
      const candidates = [
        `/public/categories`,
        `/categories`,
        `/api/categories`,
        `/v1/categories`,
      ];
      return discover<any[]>(candidates, (data) => {
        const arr = toArr(data);
        return arr && arr.length ? arr : null;
      });
    },
  },
  banners: {
    async list() {
      const r = await _fetch('/banners');
      if (!r.ok) return [];
      const data = r.data;
      return toArr(data);
    },
  },
  addresses: {
    async getAreas() {
      const r = await _fetch('/public/shipping/areas');
      if (!r.ok) throw new Error('Cannot load areas');
      return r.data?.areas || r.data?.data || [];
    },
    async list() {
      const r = await _fetch('/api/addresses');
      if (!r.ok) return [];
      return toArr(r.data);
    },
    async save(data: any, id?: string) {
      const method = id ? 'PUT' : 'POST';
      const path = id ? `/api/addresses/${id}` : '/api/addresses';
      const r = await _fetch(path, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!r.ok) throw new Error(r.data?.message || 'Save failed');
      return r.data;
    },
  },
  auth: {
    async activate(userData: any) {
      const r = await _fetch('/api/users/activate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userData),
      });
      if (!r.ok) throw new Error(r.data?.message || 'Activation failed');
      return r.data;
    },
  }
};

export default api;
