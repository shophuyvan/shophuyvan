// apps/mini/src/lib/navigation.ts
import { zmp, isZaloMiniApp } from "@/lib/zmp";

/**
 * Phát hiện đang ở trong Zalo Mini hay chỉ là web.
 * Cho chỗ khác dùng nếu cần.
 */
export const isMiniEnv = (): boolean => isZaloMiniApp();

/**
 * Helper điều hướng chuẩn:
 * - Components / pages chỉ gọi navigate(path)
 * - Không dùng window.location trực tiếp trong UI
 *
 * @param path
 *   - Đường dẫn tương đối nội bộ (VD: '/product/123')
 *   - Hoặc URL tuyệt đối (VD: 'https://shophuyvan.vn')
 */
export const navigate = (path: string) => {
  if (!path) {
    console.warn('Hàm navigate() được gọi nhưng không có "path"');
    return;
  }

  const isExternal = /^https?:\/\//i.test(path);

  // Link EXTERNAL -> để SDK Zalo xử lý
  if (isExternal) {
    (zmp as any).openLink?.({
      url: path,
      success: () => {
        console.log('[navigate] Điều hướng external thành công:', path);
      },
      fail: (err: any) => {
        console.error('[navigate] Lỗi điều hướng external:', path, err);
      },
    });
    return;
  }

  // Link INTERNAL (VD: /product?id=..., /category?c=...)
  try {
    if (typeof window !== 'undefined') {
      console.log('[navigate] internal SPA path:', path);
      // Dùng href để giữ nguyên query + hash, hoạt động trong WebView iOS
      window.location.href = path;
    }
  } catch (err) {
    console.error('[navigate] Lỗi điều hướng internal:', path, err);
  }
};


// Nếu sau này bạn muốn alias tên cũ:
// export const openMiniLink = navigate;
