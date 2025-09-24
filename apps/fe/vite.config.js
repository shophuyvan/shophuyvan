
import fs from 'node:fs';
import path from 'node:path';

function seoBaseUrlReplace(baseUrlToken = '__BASE_URL__') {
  const BASE_URL = process.env.BASE_URL || 'https://shophuyvan1.pages.dev';
  return {
    name: 'seo-baseurl-replace',
    enforce: 'post',
    apply: 'build',
    generateBundle(_, bundle) {
      for (const [fileName, asset] of Object.entries(bundle)) {
        if (asset && typeof asset.source === 'string' && asset.source.includes(baseUrlToken)) {
          asset.source = asset.source.split(baseUrlToken).join(BASE_URL);
        }
      }
    },
    closeBundle() {
      // Replace in copied public assets as well
      const outDir = path.resolve(process.cwd(), 'dist');
      if (!fs.existsSync(outDir)) return;
      const walk = (dir) => {
        for (const entry of fs.readdirSync(dir)) {
          const p = path.join(dir, entry);
          const st = fs.statSync(p);
          if (st.isDirectory()) walk(p);
          else if (st.isFile()) {
            let txt = fs.readFileSync(p, 'utf-8');
            if (txt.includes(baseUrlToken)) {
              const replaced = txt.split(baseUrlToken).join(process.env.BASE_URL || 'https://shophuyvan1.pages.dev');
              fs.writeFileSync(p, replaced);
            }
          }
        }
      };
      walk(outDir);
    }
  };
}

import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  define: { __BASE_URL__: JSON.stringify(process.env.BASE_URL || 'https://shophuyvan1.pages.dev') },
  plugins: [seoBaseUrlReplace()],
  root: '.',
  build: {
    target: 'esnext',
    outDir: 'dist',
    rollupOptions: {
      input: {
        index:    resolve(__dirname, 'index.html'),
        product:  resolve(__dirname, 'product.html'),
        cart:     resolve(__dirname, 'cart.html'),
        checkout: resolve(__dirname, 'checkout.html'),
      }
    }
  }
});
