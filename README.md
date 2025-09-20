
# SHV Monorepo (FE + Admin + API)

Triển khai tự động lên **Cloudflare Pages** và **Cloudflare Workers** thông qua **GitHub Actions**.

## Cấu trúc
```
apps/
  fe/      # FE (Pages project: shophuyvan1)
    dist/  # đặt toàn bộ build FE vào đây
  admin/   # Admin (Pages project: adminshophuyvan)
    dist/  # đặt toàn bộ build Admin vào đây
  api/     # Worker service: shv-api
    src/   # đặt source Worker vào đây
    wrangler.toml
```

> Với ZIP bạn đang có: giải nén **FE** vào `apps/fe/dist`, **Admin** vào `apps/admin/dist`, **API** vào `apps/api/src/` (đặt file chính là `index.js` hoặc đổi `main` trong `wrangler.toml`).

## Secrets (GitHub → Settings → Secrets → Actions)
- `CF_ACCOUNT_ID`
- `CF_API_TOKEN`

## Deploy
- Push `apps/fe/**`   → Pages `shophuyvan1`
- Push `apps/admin/**`→ Pages `adminshophuyvan`
- Push `apps/api/**`  → Worker `shv-api`

## Cache-busting
Workflow sẽ gắn `?v=<sha7>` cho link `.js/.css` trong HTML và cập nhật nếu đã có `?v=`.

## Lint / Format
- `pnpm -w i`
- `pnpm -w run format`
- `pnpm -w run lint`
