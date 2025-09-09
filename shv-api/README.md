# SHV Starter Code (Pages + Workers)

Generated: 2025-09-09T07:06:23.452000

## Structure
- **shv-fe**: Vite + Vanilla + Tailwind (Pages)
- **shv-api**: Cloudflare Workers (API + Cron)

## Quick Start

### API (Workers)
```bash
cd shv-api
npm init -y && npm i --save-dev
# Set secrets (replace ...):
wrangler secret put GEMINI_API_KEY
wrangler secret put GOOGLE_SERVICE_ACCOUNT_JSON
wrangler secret put FIREBASE_PROJECT_ID
wrangler secret put ADMIN_TOKEN
wrangler secret put CLOUDINARY_API_KEY
wrangler secret put CLOUDINARY_API_SECRET
wrangler secret put CLOUDINARY_CLOUD_NAME
wrangler secret put CLOUDINARY_UPLOAD_PRESET
# Optional shipping keys...
wrangler publish
```

### FE (Pages)
```bash
cd shv-fe
npm i
npm run build
# Deploy via Cloudflare Pages. Set env VITE_API_BASE to your Worker URL.
```

Then open **index.html** on Pages. Admin at **admin.html** (mobile-first drawer), paste `ADMIN_TOKEN` and start managing.

> NOTE: Worker endpoints for products are mocked. Connect Firestore in `modules/firestore.js` and replace demo catalog in `index.js`.


## Secrets to set (example)
wrangler secret put GEMINI_API_KEY
wrangler secret put GOOGLE_SERVICE_ACCOUNT_JSON   # paste SA JSON here (needed for Firestore writes)
wrangler secret put FIREBASE_PROJECT_ID
wrangler secret put ADMIN_TOKEN
wrangler secret put CLOUDINARY_API_KEY
wrangler secret put CLOUDINARY_API_SECRET
wrangler secret put CLOUDINARY_CLOUD_NAME
wrangler secret put CLOUDINARY_UPLOAD_PRESET
# Optional shipping keys...
