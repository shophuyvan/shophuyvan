#!/usr/bin/env node
/**
 * Walk apps/fe and:
 *  - write apps/fe/build-meta.json with {build, iso}
 *  - append/update ?v=<build> on <script src> and <link href> assets
 */
import fs from 'fs';
import path from 'path';

const root = process.cwd();
const feDir = path.join(root, 'apps/fe');
const build = Date.now().toString();
const iso = new Date().toISOString();

fs.writeFileSync(path.join(feDir,'build-meta.json'), JSON.stringify({build, iso}, null, 2));

/** return all files by ext */
function walk(dir, exts, out=[]){
  for (const entry of fs.readdirSync(dir, {withFileTypes:true})) {
    if (entry.name.startsWith('.')) continue;
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p, exts, out);
    else if (exts.some(e => p.endsWith(e))) out.push(p);
  }
  return out;
}

const htmlFiles = walk(feDir, ['.html']);
const assets = walk(feDir, ['.js', '.css']);

function withVersion(url){
  if (/^https?:\/\//.test(url) || url.startsWith('data:')) return url; // skip absolute/data
  // strip existing ?v
  url = url.replace(/(\?|&)v=\d+/g, '').replace(/\?$/, '');
  return url + (url.includes('?') ? `&v=${build}` : `?v=${build}`);
}

for(const file of htmlFiles){
  let html = fs.readFileSync(file, 'utf8');
  // tags: <script src="..."> and <link ... href="...">
  html = html.replace(/<script\s+([^>]*?)src=["']([^"']+)["']([^>]*)>/gi, (m, pre, src, post) => {
    return `<script ${pre}src="${withVersion(src)}"${post}>`;
  });
  html = html.replace(/<link\s+([^>]*?)href=["']([^"']+)["']([^>]*)>/gi, (m, pre, href, post) => {
    return `<link ${pre}href="${withVersion(href)}"${post}>`;
  });

  // Also bump direct asset URLs referenced in inline styles
  html = html.replace(/url\(["']?([^"')]+)["']?\)/gi, (m,u)=> `url(${withVersion(u)})`);

  fs.writeFileSync(file, html);
}

console.log(`Bumped version to ${build} on ${htmlFiles.length} HTML files`);
