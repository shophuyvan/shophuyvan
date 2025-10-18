// === api.js (đã vá hoàn chỉnh) ===
// API client dùng cho FE và Mini App, đồng bộ domain hiện tại

const API_BASE = window.API_BASE || window.location.origin;

// Hàm gọi API chung
async function apiRequest(path, options = {}) {
  const url = path.startsWith('http') ? path : `${API_BASE}${path}`;
  const res = await fetch(url, options);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// Xuất module chính
export const api = {
  get: (path) => apiRequest(path),
  post: (path, data) =>
    apiRequest(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),
};
