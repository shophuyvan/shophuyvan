# init: SHV starter (FE + API)

This PR adds the initial codebase for **SHOP HUY VÂN**:

- **shv-fe/** Cloudflare Pages (Vite + Vanilla + Tailwind CDN)
- **shv-api/** Cloudflare Workers (API + Cron) with routes:
  - /ai/suggest, /ai/health
  - /upload/signature (Cloudinary signed)
  - /pricing/preview
  - /orders, /admin/*
  - /shipping/* (quote/create/cancel/webhook/health)

## What’s configured
- Admin mobile-first (drawer), product `weight_grams` for shipping fee.
- PDP price priority (variant > product), countdown, SEO JSON-LD.
- Worker cron placeholder to increase fake_sales/fake_reviews.

## After merge (checklist)
- [ ] Add repo **Actions Secrets**:
  - `CLOUDFLARE_API_TOKEN` (Workers token with `Account.Workers Scripts`)
  - `CLOUDFLARE_ACCOUNT_ID` (Cloudflare → Overview)
  - `GEMINI_API_KEY`
  - `FIREBASE_PROJECT_ID`
  - `GOOGLE_SERVICE_ACCOUNT_JSON` (full SA JSON)
  - `ADMIN_TOKEN`
  - `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`, `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_UPLOAD_PRESET`
- [ ] Connect **Pages** build for `shv-fe` (root: `shv-fe`, output: `dist`)
- [ ] Set Pages env vars: `VITE_API_BASE` + Firebase keys
- [ ] Open `/ai/health` and admin page to smoke test
