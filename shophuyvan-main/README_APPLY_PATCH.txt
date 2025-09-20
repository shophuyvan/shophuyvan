SHV - PATCH READY (for repo deployment)
==========================================

Bạn commit toàn bộ nội dung ZIP này lên GitHub (project website) để Cloudflare Pages build.

ĐÃ THÊM/CHỈNH:
- shv-fe/_redirects
    /api/* https://shv-api.shophuyvan.workers.dev/:splat 200
    /* /index.html 200

- shv-fe/src/shv_api_client.js

GỢI Ý DÙNG:
import { apiGet } from './src/shv_api_client.js';
const promos = await apiGet('/public/promos');

Admin (adminshophuyvan) bạn đã upload theo v8_dir -> cứ giữ nguyên.
