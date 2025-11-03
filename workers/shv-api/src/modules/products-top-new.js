// workers/shv-api/src/modules/products-top-new.js
// Dùng chung cho FE + Mini: /products/bestsellers & /products/newest (ESM .js)

export async function handle(req) {
  const { pathname, searchParams, origin } = new URL(req.url);

  if (pathname === '/products/bestsellers') {
    const limit = Math.min(Number(searchParams.get('limit') || '8'), 50);
    const products = await fetchAllPublicProducts(origin, 300);
    const items = pickTopSold(products, limit);
    return jsonOK({ ok: true, items });
  }

  if (pathname === '/products/newest') {
    const limit = Math.min(Number(searchParams.get('limit') || '8'), 50);
    const products = await fetchAllPublicProducts(origin, 300);
    const items = pickNewest(products, limit);
    return jsonOK({ ok: true, items });
  }

  return null;
}

// ---------- helpers ----------
function toNum(x){ return typeof x === 'string' ? (Number(x.replace(/[^\d.-]/g,''))||0) : Number(x||0); }

function computePriceDisplay(p){
  const ready = toNum(p.price_display);
  if (ready > 0) return { price_display: ready, compare_at_display: toNum(p.compare_at_display) };

  const variants = Array.isArray(p.variants) ? p.variants
                : Array.isArray(p.options)  ? p.options
                : Array.isArray(p.skus)     ? p.skus   : [];
  const cand = [];
  const push = v => { const n = toNum(v); if (n>0) cand.push(n); };

  if (variants.length){
    for (const v of variants){
      push(v.price_sale ?? v.sale_price ?? v.sale);
      push(v.price ?? v.unit_price ?? v.regular_price ?? v.base_price);
    }
  } else {
    push(p.price_sale ?? p.sale_price ?? p.price);
  }
  const min = cand.length ? Math.min(...cand) : 0;
  return { price_display: min, compare_at_display: toNum(p.compare_at||0) };
}

async function fetchAllPublicProducts(origin, max = 200){
  let cursor = null, items = [];
  while (items.length < max){
    const u = new URL('/public/products', origin);
    u.searchParams.set('limit', '50');
    if (cursor) u.searchParams.set('cursor', cursor);

    const r = await fetch(u.toString(), { headers: { 'cache-control': 'no-cache' }});
    if (!r.ok) break;
    const j = await r.json().catch(()=>({}));
    const list = j.items || j.products || j.data || [];
    items.push(...list);
    cursor = j.cursor || j.next || null;
    if (!cursor) break;
  }
  return items;
}

function pickTopSold(products, limit){
  return products
    .map(p => {
      const sold = toNum(p.sold ?? p.sales ?? p.sold_count ?? p.total_sold ?? p.order_count);
      const { price_display, compare_at_display } = computePriceDisplay(p);
      return {
        id: p.id || p.key,
        name: p.title || p.name,
        image: (p.images && p.images[0]) || p.image || p.thumbnail,
        price_display, compare_at_display,
        rating: toNum(p.rating_avg ?? p.rating_average ?? p.rating) || 5.0,
        reviewCount: toNum(p.rating_count ?? p.reviews ?? p.review_count),
        sold
      };
    })
    .sort((a,b)=> b.sold - a.sold)
    .slice(0, limit);
}

function pickNewest(products, limit){
  return products
    .map(p => {
      const t = new Date(
        p.created_at || p.createdAt || p.published_at || p.publishedAt || p.time || p.ts || 0
      ).getTime() || 0;
      const { price_display, compare_at_display } = computePriceDisplay(p);
      return {
        id: p.id || p.key,
        name: p.title || p.name,
        image: (p.images && p.images[0]) || p.image || p.thumbnail,
        price_display, compare_at_display,
        created_at: t
      };
    })
    .sort((a,b)=> b.created_at - a.created_at)
    .slice(0, limit);
}

function jsonOK(obj, init={}){
  return new Response(JSON.stringify(obj), {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'max-age=120',
      'access-control-allow-origin': '*'
    },
    ...init
  });
}
