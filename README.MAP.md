# Mapping note
These files mirror the behavior of your web `api.js` helper:
- window.API_BASE with fallback to shv-api Cloudflare Worker
- `x-token` header from localStorage if present
- JSON body auto-serialization (unless FormData)
- 10s timeout + single automatic retry on 5xx
- auto JSON/text response by content-type

Overwrite into your scaffold at:
- packages/shared/src/api/index.ts
- packages/shared/src/index.ts
