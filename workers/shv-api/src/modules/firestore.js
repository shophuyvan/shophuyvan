/* SHV safe patch header */
// Simple Fire abstraction with 3 tiers:
// 1) Cloudflare KV (binding: PRODUCTS_KV) if available
// 2) Firebase Firestore via Service Account (GOOGLE_SERVICE_ACCOUNT_JSON, FIREBASE_PROJECT_ID)
// 3) Volatile in-memory store (for local/dev only)
export class Fire {
  constructor(env){
    this.env = env || {};
    if (!globalThis.__MEM_STORE) globalThis.__MEM_STORE = new Map();
    this.mem = globalThis.__MEM_STORE;
  }

  // ----- helpers -----
  _key(col, id){ return `${col}:${id}`; }

  async _kv(){ return this.env.PRODUCTS_KV || null; }

  async get(col, id){
    const kv = await this._kv();
    if (kv){
      const v = await kv.get(this._key(col,id));
      return v ? JSON.parse(v) : null;
    }
    // mem fallback
    return this.mem.get(this._key(col,id)) || null;
  }

  async set(col, id, data){
    const item = { ...(data||{}), id };
    const kv = await this._kv();
    if (kv){
      await kv.put(this._key(col,id), JSON.stringify(item));
      return item;
    }
    this.mem.set(this._key(col,id), item);
    return item;
  }

  async upsert(col, id, data){
    return this.set(col, id, { ...(await this.get(col,id)||{}), ...(data||{}) });
  }

  async remove(col, id){
    const kv = await this._kv();
    if (kv){
      await kv.delete(this._key(col,id));
      return { ok: true };
    }
    this.mem.delete(this._key(col,id));
    return { ok: true };
  }

  // params: { where, orderBy, limit, cursor }
  // where supports only ['is_active','==',true] for now
  // orderBy supports ['created_at','desc'] for now
  async list(col, params = {}){
    const limit = Math.min(Number(params.limit)||50, 200);
    const cursor = params.cursor || '';
    const where = params.where || null;

    // collect all
    let items = [];
    const kv = await this._kv();
    if (kv){
      // KV doesn't support value listing; do a prefix list then get values
      let cursorKV;
      const keys = [];
      do {
        const r = await kv.list({ prefix: `${col}:`, cursor: cursorKV });
        r.keys.forEach(k => keys.push(k.name));
        cursorKV = r.list_complete ? null : r.cursor;
      } while (cursorKV);
      for (const k of keys){
        const v = await kv.get(k);
        if (v) items.push(JSON.parse(v));
      }
    } else {
      for (const [k,v] of this.mem.entries()){
        if (k.startsWith(`${col}:`)) items.push(v);
      }
    }

    // filter
    if (where && Array.isArray(where) && where[0]==='is_active' && where[1]==='==' ){
      const expect = where[2];
      items = items.filter(it => !!it.is_active === !!expect);
    }

    // sort by created_at desc
    items.sort((a,b) => String(b.created_at||'').localeCompare(String(a.created_at||'')));

    // paginate by index cursor (as offset)
    let start = 0;
    if (cursor){
      try {
        const idx = Number(atob(cursor));
        if (!Number.isNaN(idx)) start = Math.max(0, idx);
      } catch {}
    }
    const slice = items.slice(start, start + limit);
    const nextCursor = (start + limit) < items.length ? btoa(String(start + limit)) : null;
    return { items: slice, nextCursor };
  }

  // Unused placeholders for API compatibility
  async query(){ return { documents: [] }; }
}
