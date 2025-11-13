// Xóa dấu vết Pages Functions trong output để deploy static thuần
import { existsSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WWW = path.resolve(__dirname, '..', 'www');

const targets = [
  'functions',      // Pages Functions dir
  '_worker.js',     // Workers entry
  '_headers',       // headers (nếu có)
  '_redirects'      // redirects (nếu có)
];

for (const t of targets) {
  const p = path.join(WWW, t);
  if (existsSync(p)) {
    rmSync(p, { recursive: true, force: true });
    console.log(`[postbuild] removed ${t}`);
  }
}
console.log('[postbuild] static-only deploy ready.');
