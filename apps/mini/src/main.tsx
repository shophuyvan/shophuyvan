import React from 'react';
import { createRoot } from 'react-dom/client';
import 'zmp-ui/zaui.css';
import './styles/tailwind.css';
import App from './app';

// Tạo hoặc lấy container để mount React trong Mini App
function getOrCreateRootContainer(id: string) {
  let el = document.getElementById(id);
  if (!el) {
    el = document.createElement('div');
    el.id = id;
    document.body.appendChild(el);
  }
  return el;
}

function mountApp() {
  const container = getOrCreateRootContainer('root');
  const root = createRoot(container);

  try {
  root.render(<App />);
  console.log('[MAIN] Root rendered successfully');
} catch (err) {
  console.error('[MAIN] Render error:', err);
}
}

// Mount app ngay khi script chạy (Mini đã load xong HTML)
mountApp();

// (TUỲ CHỌN) Log lỗi global nhẹ nhàng để debug trong Mini
window.addEventListener('error', (event) => {
  console.error('🌋 Global error:', (event as ErrorEvent).error || event);
});

window.addEventListener('unhandledrejection', (event) => {
  console.error(
    '🌋 Unhandled promise rejection:',
    (event as PromiseRejectionEvent).reason
  );
});
