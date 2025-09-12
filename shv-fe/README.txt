
SHV R6.1 – Merge Banner/Voucher into current Admin page
=======================================================

Files you care about:
- src/lib/api.js            → exports BOTH named + default `api` (fixes import error)
- src/ui-pdp.js             → example shows using default import
- src/ui-admin-bv.js        → injects Banner/Voucher sections into your EXISTING admin.html

How to apply
------------
1) Copy the entire `src/lib/api.js` and replace your existing file.
2) Include `<script type="module" src="src/ui-admin-bv.js"></script>` at the bottom of your current admin.html (same page).
3) In the product page script where you import the api, change:
   `import { api } from './lib/api.js'` → `import api from './lib/api.js'`
   OR keep the named import because the new api.js now exports both.
4) Deploy.

Notes
-----
- Script will try Worker endpoint: `admin/settings?token=...`. If unreachable, it stores data in `localStorage` under key `shv_settings`.
- Sidebar buttons `Cài đặt Banner / Cài đặt Voucher` are injected automatically.
- The UI is Tailwind-friendly but doesn't require Tailwind to function.
