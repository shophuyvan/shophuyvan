import { getSystemInfo } from "zmp-sdk";
// import { App, ZMPRouter, AnimationRoutes, Route, SnackbarProvider } from "zmp-ui"; // Tạm comment SnackbarProvider
import { App, ZMPRouter, AnimationRoutes, Route } from "zmp-ui"; // Import không có SnackbarProvider
import "zmp-ui/zaui.css";// Import CSS của zmp-ui

// --- Import Pages (Sử dụng alias @/) ---
import HomePage from '@/pages/index';
import CategoryPage from '@/pages/Category';
import ProductPage from '@/pages/Product';
import CartPage from '@/pages/Cart';
import CheckoutPage from '@/pages/Checkout';

// --- Lấy theme an toàn ---
// const theme = (getSystemInfo()?.zaloTheme ?? getSystemInfo()?.theme ?? "light") as "light" | "dark"; // Tạm comment
const theme = "light" as "light" | "dark"; // Tạm hardcode

const Layout = () => {
  return (
    <App theme={theme}>
      {/* <SnackbarProvider> */} {/* Tạm comment */}
        <ZMPRouter>
          <AnimationRoutes>
            <Route path="/" element={<HomePage />} />
            {/* Dùng path chữ thường để khớp với href & window.location.href */}
            <Route path="/category" element={<CategoryPage />} />
            <Route path="/product" element={<ProductPage />} />
            <Route path="/cart" element={<CartPage />} />
            <Route path="/checkout" element={<CheckoutPage />} />
          </AnimationRoutes>

        </ZMPRouter>
      {/* </SnackbarProvider> */} {/* Tạm comment */}
    </App>
  );
};

export default Layout;