# shophuyvan mono-repo

This repo bundles:
- **FE** static site → Cloudflare Pages project: `shophuyvan1` (in `apps/fe`)
- **Admin** static site → Cloudflare Pages project: `adminshophuyvan` (in `apps/admin`)
- **API Worker** → Cloudflare Workers project in `workers/shv-api` (wrangler)

## Deploy

Create two repository secrets:
- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_API_TOKEN` (token with: Pages:Edit, Workers Scripts:Edit, KV:Edit, R2:Edit if used)

Then push, or run workflows manually in **Actions**:
- "Deploy FE to Cloudflare Pages"
- "Deploy Admin to Cloudflare Pages"
- "Deploy Worker (shv-api)"

