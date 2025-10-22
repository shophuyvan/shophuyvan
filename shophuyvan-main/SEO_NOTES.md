# SEO & Build notes (auto-generated)
- Added meta description to pages.
- Injected Product JSON-LD in `apps/fe/product.html`.
- Ensured `<img>` tags have `alt` and `loading="lazy"`.
- Added `apps/fe/sitemap.xml` and `apps/fe/robots.txt` (update domain if needed).
- Created GitHub Actions workflow `.github/workflows/cache-bust.yml` that bumps `?v=` cache-buster on every push.
- Replaced `apps/fe/src/ui-pdp.js` with a minimal, safe script to prevent parsing errors.
