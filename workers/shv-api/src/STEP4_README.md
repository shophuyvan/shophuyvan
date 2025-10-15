# Step 4 Output
- src/index.js: Modular router. Routes /admin|/public/categories -> modules/categories.js. Others delegate to legacy.js.
- src/legacy.js: Original monolithic index.js (unchanged).
- src/modules/categories.js: Your categories module (with admin check added for GET /admin/categories).

Apply by copying `workers/shv-api/src/*` into your repo.
