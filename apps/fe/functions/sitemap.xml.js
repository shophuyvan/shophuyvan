// apps/fe/functions/sitemap.xml.js
export async function onRequest() {
  const SITE = "https://shophuyvan1.pages.dev"; // đổi nếu có domain chính
  const API  = "https://shv-api.shophuyvan.workers.dev/products";

  try {
    const r = await fetch(API, { headers: { "accept": "application/json" }});
    const data = await r.json();
    const items = Array.isArray(data) ? data : (data.items || []);

    const urls = items.map(p => {
      const loc = p.slug
        ? `${SITE}/product/${encodeURIComponent(p.slug)}`
        : `${SITE}/product?id=${encodeURIComponent(p.id)}`;
      const lastmod = new Date(p.updatedAt || p.updated_at || Date.now()).toISOString();
      return `<url>
  <loc>${loc}</loc>
  <lastmod>${lastmod}</lastmod>
  <changefreq>daily</changefreq>
  <priority>0.8</priority>
</url>`;
    }).join("\n");

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${SITE}/</loc>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
  ${urls}
</urlset>`;

    return new Response(xml, {
      headers: {
        "content-type": "application/xml; charset=utf-8",
        "cache-control": "public, max-age=3600"
      }
    });
  } catch (_e) {
    return new Response(
      `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>`,
      { headers: { "content-type": "application/xml" } }
    );
  }
}
