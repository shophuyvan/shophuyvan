// apps/mini/src/components/layout/MiniAppGuard.tsx
import React, { useState, useEffect } from 'react';
import { zmp } from '@/lib/zmp';
import { Box, Text, Icon } from 'zmp-ui'; // Dùng component của zmp-ui

// Màn hình hiển thị khi mở trên trình duyệt web
const FallbackUI: React.FC = () => {
  return (
    <Box
      flex
      flexDirection="column"
      justifyContent="center"
      alignItems="center"
      className="h-screen w-screen bg-gray-100 p-4 text-center"
    >
      <Icon icon="zi-zalo" size={48} className="text-blue-600" />
      <Text.Title className="mt-4">Vui lòng mở trong Zalo</Text.Title>
      <Text className="text-gray-600">
        Ứng dụng này được thiết kế để hoạt động tốt nhất bên trong Zalo Mini App.
      </Text>
      <Text size="small" className="text-gray-500 mt-2">
        Bạn có thể quét mã QR hoặc tìm "Shop Huy Vân" trong Zalo để trải nghiệm.
      </Text>
    </Box>
  );
};

/**
 * Component này kiểm tra xem app có đang chạy trong môi trường Zalo Mini App không.
 * Nếu không, hiển thị một màn hình FallbackUI đẹp.
 */
const MiniAppGuard: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [isMiniAppEnv, setIsMiniAppEnv] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // 🔧 DEV MODE: Bypass guard khi chạy localhost
    if (import.meta.env.DEV || window.location.hostname === 'localhost') {
      console.warn('[MiniAppGuard] DEV MODE: Bypassing check for localhost');
      setIsMiniAppEnv(true);
      setIsLoading(false);
      return;
    }

    // Dùng zmp.getSystemInfo là cách kiểm tra đáng tin cậy nhất
    zmp.getSystemInfo({
      success: (res) => {
        // Thành công -> đang ở trong Mini App
        setIsMiniAppEnv(true);
        setIsLoading(false);
      },
      fail: (err) => {
        // Thất bại -> đang ở trình duyệt
        setIsMiniAppEnv(false);
        setIsLoading(false);
        console.warn('Không phải môi trường Mini App:', err);
      },
    });
  }, []);

  if (isLoading) {
    // Có thể hiển thị một màn hình loading toàn trang
    return null;
  }

  return isMiniAppEnv ? <>{children}</> : <FallbackUI />;
};

export default MiniAppGuard;