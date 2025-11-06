// src/lib/storage.ts
// Wrapper lưu trữ: ưu tiên zmp.storage, fallback localStorage

import { zmp } from './zmp';

export const storage = {
  get<T = any>(key: string): Promise<T | null> {
    return new Promise((resolve) => {
      if ((zmp as any).storage?.get) {
        (zmp as any).storage.get({
          key,
          success: (res: any) => resolve(res?.data ?? null),
          fail: () => resolve(null),
        });
      } else if (typeof window !== 'undefined' && window.localStorage) {
        const raw = window.localStorage.getItem(key);
        resolve(raw ? JSON.parse(raw) : null);
      } else {
        resolve(null);
      }
    });
  },

  set<T = any>(key: string, value: T): Promise<void> {
    return new Promise((resolve) => {
      if ((zmp as any).storage?.set) {
        (zmp as any).storage.set({
          key,
          data: value,
          success: () => resolve(),
          fail: () => resolve(),
        });
      } else if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(key, JSON.stringify(value));
        resolve();
      } else {
        resolve();
      }
    });
  },

  remove(key: string): Promise<void> {
    return new Promise((resolve) => {
      if ((zmp as any).storage?.remove) {
        (zmp as any).storage.remove({
          key,
          success: () => resolve(),
          fail: () => resolve(),
        });
      } else if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem(key);
        resolve();
      } else {
        resolve();
      }
    });
  },
};
