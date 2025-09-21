#!/usr/bin/env node
/**
 * Generate sitemap.xml at repo root, robots.txt at root.
 * - includes all HTML pages under apps/fe
 * - if a product JSON exists (apps/fe/products.json OR apps/fe/data/products.json),
 *   add product detail URLs by heuristics (slug/id)
 */
import fs from 'fs';
import path from 'path';

const root = process.cwd();
const baseUrl = process.env.SITE_BASE_URL || 'https://shophuyvan1.pages.dev';
const feDir = path.join(root, 'apps/fe');

function walk(dir, out=[]){
  for (const entry of fs.readdirSync(dir, {withFileTypes:true})) {
    if (entry.name.startsWith('.')) continue;
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p, out);
    else if (p.endsWith('.html')) out.push(p);
  }
  return out;
}
const htmlFiles = walk(feDir);

function toUrl(p){
  const rel = p.replace(feDir, '').replace(/\\/g,'/'); // windows friendly
  return baseUrl + rel;
}

let urls = htmlFiles.map(toUrl);

// Heuristics for product JSON
const candidates = [
  path.join(feDir, 'data', 'products.json'),
  path.join(feDir, 'products.json')
].filter(fs.existsSync);

for (const file of candidates){
  try{
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    const arr = Array.isArray(data) ? data : (Array.isArray(data.products) ? data.products : []);
    for (const item of arr){
      if (!item) continue;
      if (item.slug) urls.push(`${baseUrl}/san-pham/${encodeURIComponent(item.slug)}`);
      else if (item.id || item._id) {
        const id = item.id || item._id;
        // common template product.html?id=...
        urls.push(`${baseUrl}/product.html?id=${encodeURIComponent(id)}`);
      }
    }
  }catch(e){ /* ignore */ }
}

urls = Array.from(new Set(urls));

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u=>`  <url><loc>${u}</loc></url>`).join('\n')}
</urlset>
`;
fs.writeFileSync(path.join(root, 'sitemap.xml'), xml.trim() + '\n');

const robots = `User-agent: *
Allow: /
Sitemap: ${baseUrl}/sitemap.xml
`;
fs.writeFileSync(path.join(root, 'robots.txt'), robots);
console.log(`sitemap.xml with ${urls.length} URLs written.`);
