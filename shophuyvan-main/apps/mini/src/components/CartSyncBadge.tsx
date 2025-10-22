// File: apps/mini/src/components/CartSyncBadge.tsx
// Hiển thị trạng thái đồng bộ giỏ hàng

import React, { useEffect, useState } from 'react';
import { getMiniCartSync } from '../lib/cart-sync-init';

export default function CartSyncBadge() {
  const [lastSync, setLastSync] = useState<string>('');
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    // Update online status
    const updateOnline = () => setIsOnline(navigator.onLine);
    window.addEventListener('online', updateOnline);
    window.addEventListener('offline', updateOnline);

    // Listen for cart changes
    const handleCartChange = () => {
      const now = new Date();
      setLastSync(now.toLocaleTimeString('vi-VN'));
    };

    window.addEventListener('shv:cart-changed', handleCartChange);
    window.addEventListener('storage', handleCartChange);

    // Initial sync time
    const lastSyncTime = localStorage.getItem('shv_last_sync');
    if (lastSyncTime) {
      const date = new Date(parseInt(lastSyncTime));
      setLastSync(date.toLocaleTimeString('vi-VN'));
    }

    return () => {
      window.removeEventListener('online', updateOnline);
      window.removeEventListener('offline', updateOnline);
      window.removeEventListener('shv:cart-changed', handleCartChange);
      window.removeEventListener('storage', handleCartChange);
    };
  }, []);

  const handleForceSync = async () => {
    const sync = getMiniCartSync();
    if (sync) {
      await sync.forceSync();
      const now = new Date();
      setLastSync(now.toLocaleTimeString('vi-VN'));
    }
  };

  if (!isOnline) {
    return (
      <div className="fixed bottom-20 right-4 z-50 bg-red-500 text-white px-3 py-2 rounded-lg shadow-lg text-xs">
        ⚠️ Offline - Sẽ đồng bộ khi online
      </div>
    );
  }

  if (!lastSync) return null;

  return (
    <button
      onClick={handleForceSync}
      className="fixed bottom-20 right-4 z-50 bg-white border border-gray-200 px-3 py-2 rounded-lg shadow-lg text-xs hover:shadow-xl transition-shadow"
    >
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
        <span className="text-gray-600">Đồng bộ: {lastSync}</span>
        <svg className="w-3 h-3 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
        </svg>
      </div>
    </button>
  );
}