// node scripts/build-sitemap.mjs
import fs from "node:fs/promises";

const SITE = process.env.SITE_URL || "https://shophuyvan1.pages.dev";
const API  = process.env.PRODUCT_API || "https://shv-api.shophuyvan.workers.dev/products";

const r = await fetch(API, { headers: { "accept":"application/json" }});
const data = await r.json();
const items = Array.isArray(data) ? data : (data.items || []);

const urls = items.map(p => {
  const loc = p.slug ? `${SITE}/product/${encodeURIComponent(p.slug)}`
                     : `${SITE}/product?id=${encodeURIComponent(p.id)}`;
  const lastmod = new Date(p.updatedAt || p.updated_at || Date.now()).toISOString();
  return `<url><loc>${loc}</loc><lastmod>${lastmod}</lastmod><changefreq>daily</changefreq><priority>0.8</priority></url>`;
}).join("");

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${SITE}/</loc><changefreq>daily</changefreq><priority>1.0</priority></url>
  ${urls}
</urlset>`;

await fs.mkdir("dist", { recursive: true });
await fs.writeFile("dist/sitemap.xml", xml, "utf8");

const build = String(Date.now());
await fs.writeFile("dist/build.txt", build, "utf8");
console.log("Sitemap generated, build:", build);
