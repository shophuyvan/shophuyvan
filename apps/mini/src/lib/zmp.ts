// apps/mini/src/lib/zmp.ts
// Wrapper nhỏ để dùng SDK Zalo Mini (window.zmp)

export type ZaloMini = any;

// SDK thật trong môi trường Mini App
const rawZmp: ZaloMini =
  typeof window !== "undefined" ? (window as any).zmp : undefined;

// Cho chỗ khác biết đang chạy trong Zalo Mini thật hay không
export const isZaloMiniApp = (): boolean => {
  return !!rawZmp;
};

/**
 * Stub an toàn khi chạy ngoài Mini (mở localhost:5173 trực tiếp trên trình duyệt).
 * Trong Zalo Mini THẬT, rawZmp có giá trị và stub này KHÔNG được dùng.
 */
const stubZmp: ZaloMini = {
  // ---------------------------------------------------------------------------
  // SYSTEM INFO
  // ---------------------------------------------------------------------------
  /**
   * Giả lập getSystemInfo theo style phổ biến của MiniApp:
   * - zmp.getSystemInfo({ success(res) { ... } })
   * - hoặc zmp.getSystemInfo().then(res => ...)
   */
  getSystemInfo: (opts?: any) => {
    const info = {
      platform: "web",
      brand: "browser",
      model: "web",
      system:
        typeof navigator !== "undefined" ? navigator.userAgent : "unknown",
      screenWidth:
        typeof window !== "undefined" ? window.innerWidth || 0 : 0,
      screenHeight:
        typeof window !== "undefined" ? window.innerHeight || 0 : 0,
    };

    console.log("[zmp.getSystemInfo.stub]", info);

    if (opts && typeof opts.success === "function") {
      opts.success(info);
      return;
    }

    if (typeof opts === "function") {
      opts(info);
      return;
    }

    return Promise.resolve(info);
  },

  // ---------------------------------------------------------------------------
  // USER INFO
  // ---------------------------------------------------------------------------
  getUserInfo: (opts?: any) => {
    const userInfo = {
      id: "guest_" + Date.now(),
      name: "Guest User",
      avatar: "",
    };

    console.log("[zmp.getUserInfo.stub]", userInfo);

    if (opts && typeof opts.success === "function") {
      opts.success({ userInfo });
      return;
    }

    if (typeof opts === "function") {
      opts({ userInfo });
      return;
    }

    return Promise.resolve({ userInfo });
  },

  getPhoneNumber: (opts?: any) => {
    console.log("[zmp.getPhoneNumber.stub] - requires user permission");
    
    const response = {
      token: "",
      error: "Not available in web mode"
    };

    if (opts && typeof opts.fail === "function") {
      opts.fail(response);
      return;
    }

    return Promise.reject(response);
  },

    // ---------------------------------------------------------------------------
  // NAVIGATION
  // ---------------------------------------------------------------------------
  openLink: ({ url, success, fail }: any) => {
    console.log("[zmp.openLink.stub]", url);
    try {
      if (typeof window !== "undefined" && url) {
        // Dùng href cho cả internal + external để giữ nguyên query, hash
        if (/^https?:\/\//i.test(url)) {
          // external link
          window.location.href = url;
        } else {
          // internal path (VD: /category?c=..., /product?id=...)
          window.location.href = url;
        }
      }
      success && success();
    } catch (err) {
      console.error("[zmp.openLink.stub.error]", err);
      fail && fail(err);
    }
  },

  openWebview: ({ url }: any) => {
    console.log("[zmp.openWebview.stub]", url);
    if (typeof window !== "undefined" && url) {
      window.location.href = url;
    }
  },

  // ---------------------------------------------------------------------------
  // UI: TOAST / DIALOG
  // ---------------------------------------------------------------------------
  toast: {
    show: (opts: any) => {
      console.log("[zmp.toast.stub]", opts);
    },
  },

  dialog: {
    alert: (opts: any) => {
      console.log("[zmp.dialog.alert.stub]", opts);
      if (typeof window !== "undefined" && (window as any).alert) {
        (window as any).alert(opts?.message || "Thông báo");
      }
    },
  },

  // ---------------------------------------------------------------------------
  // STORAGE (dùng localStorage khi chạy web)
  // ---------------------------------------------------------------------------
  storage: {
    get: ({ key, success, fail }: any) => {
      try {
        let data: any = null;
        if (typeof window !== "undefined" && window.localStorage) {
          const raw = window.localStorage.getItem(key);
          data = raw ? JSON.parse(raw) : null;
        }
        success && success({ data });
      } catch (err) {
        console.error("[zmp.storage.get.stub.error]", err);
        fail && fail(err);
      }
    },
    set: ({ key, data, success, fail }: any) => {
      try {
        if (typeof window !== "undefined" && window.localStorage) {
          window.localStorage.setItem(key, JSON.stringify(data));
        }
        success && success();
      } catch (err) {
        console.error("[zmp.storage.set.stub.error]", err);
        fail && fail(err);
      }
    },
    remove: ({ key, success, fail }: any) => {
      try {
        if (typeof window !== "undefined" && window.localStorage) {
          window.localStorage.removeItem(key);
        }
        success && success();
      } catch (err) {
        console.error("[zmp.storage.remove.stub.error]", err);
        fail && fail(err);
      }
    },
  },
};

// Trong Mini thật: dùng rawZmp (SDK chính thức).
// Khi chạy web / localhost không có window.zmp: dùng stub để không bị crash.
export const zmp: ZaloMini = rawZmp || stubZmp;

// Helper async cho storage (tuỳ, dùng hay không tuỳ bạn)
export const zmpStorage = {
  async get<T = any>(key: string): Promise<T | null> {
    return new Promise((resolve) => {
      (zmp as any).storage?.get?.({
        key,
        success: (res: any) => resolve(res?.data ?? null),
        fail: () => resolve(null),
      });
    });
  },

  async set<T = any>(key: string, value: T): Promise<void> {
    return new Promise((resolve) => {
      (zmp as any).storage?.set?.({
        key,
        data: value,
        success: () => resolve(),
        fail: () => resolve(),
      });
    });
  },

  async remove(key: string): Promise<void> {
    return new Promise((resolve) => {
      (zmp as any).storage?.remove?.({
        key,
        success: () => resolve(),
        fail: () => resolve(),
      });
    });
  },
};
