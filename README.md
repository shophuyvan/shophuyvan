# shophuyvan – CI/CD template for Cloudflare

This repository is a **ready-to-use** GitHub template to deploy:
- **API**: Cloudflare **Workers** (folder: `api/`)
- **FE**: Cloudflare **Pages** project `shophuyvan1` (folder: `fe/`)
- **Admin**: Cloudflare **Pages** project `adminshophuyvan` (folder: `admin/`)

## 1) Secrets (GitHub → Settings → Secrets and variables → Actions → *New repository secret*)
Create **repository secrets** with these exact names:

- `CLOUDFLARE_API_TOKEN` – Cloudflare API token with minimum permissions:
  - Account → *Workers Scripts*: **Edit**
  - Account → *Cloudflare Pages*: **Edit**
  - (Optional) Account → *Workers KV Storage*: **Edit** if Worker uses KV
  - (Optional) Zone → *Workers Routes*: **Edit** if your Worker uses routes/custom domain
- `CLOUDFLARE_ACCOUNT_ID` – Your Cloudflare **Account ID**

> Tip: You can find Account ID in the URL of Cloudflare dashboard: `dash.cloudflare.com/<ACCOUNT_ID>/...`

## 2) Folders
- `api/` – put your Worker source here. The template assumes build output at `dist/index.mjs`.
- `fe/` – your storefront; build to `fe/dist`
- `admin/` – admin site; build to `admin/dist`

## 3) Workflows
This repo contains 3 workflows under `.github/workflows/`:

- `deploy-worker.yml` – deploy Worker from `api/`
- `deploy-pages-fe.yml` – deploy FE to Pages project **shophuyvan1**
- `deploy-pages-admin.yml` – deploy Admin to Pages project **adminshophuyvan**

## 4) Build scripts expectations

**Worker** (api/package.json):
```json
{ "scripts": { "build": "tsc -p . || echo 'skip build'", "deploy": "wrangler deploy" } }
```
If you already have your own build, keep it; just ensure the output file used in `wrangler.toml` is correct.

**FE / Admin** (fe|admin/package.json):
```json
{ "scripts": { "build": "vite build" } }
```
Change to whatever you use (Next/Nuxt/etc.) and update the workflows `directory:` if output != `dist`.

## 5) wrangler.toml (api/wrangler.toml)
- Uses `${CLOUDFLARE_ACCOUNT_ID}` so you do **not** hardcode account id.
- Update `main = "dist/index.mjs"` to your compiled entry.

## 6) Trigger
Push to `main` branch. Each folder change triggers only its workflow via `paths:` filters.

Happy shipping 🚀