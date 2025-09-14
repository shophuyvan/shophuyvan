# SHV FE – Patch bundle (paths rooted at `shv-fe/`)

## What’s inside
- `src/lib/media.js`      → Inline SVG placeholder.
- `src/lib/fallback.js`   → Global image fallback + mutation observer.

## Why
Browsers were trying to load `fallback.js` from a wrong path and, as a result, received HTML (404/redirect)
instead of JS — triggering: “Failed to load module script… MIME type 'text/html'”. This patch puts the
modules under `shv-fe/src/lib/` and is meant to be imported with absolute paths in `product.html`:

    <script type="module">
      import '/src/ui-pdp.js';       // your product page logic (existing file)
      import '/src/lib/fallback.js'; // this patch
    </script>

## How to apply
1) Unzip into your repository so that files land under: `shv-fe/src/lib/…`
2) In `shv-fe/product.html`, ensure you only import modules via absolute paths starting with `/src/...`.
   Example (at the bottom of the body is fine):

      <input id="api-base" type="hidden" value="" />
      <script type="module">
        import '/src/ui-pdp.js';
        import '/src/lib/fallback.js';
      </script>

3) Deploy on Cloudflare Pages. If a CDN sits in front, Purge Everything once.
4) Quick sanity check (both must return JS, not HTML):
    - https://<your-domain>/src/ui-pdp.js
    - https://<your-domain>/src/lib/fallback.js
