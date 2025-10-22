export default {
  appid: "574448931033929374", // 👈 App ID của bạn từ Zalo Developer Console
  appname: "SHOP HUY VÂN",
  version: "1.0.0",
  description: "Mini App thương mại cho Shop Huy Vân",
  pages: [
    "pages/Home",
    "pages/Product",
    "pages/Category",
    "pages/Cart",
    "pages/Checkout"
  ],
  window: {
    navigationBarTitleText: "SHOP HUY VÂN",
    navigationBarBackgroundColor: "#ffffff",
    navigationBarTextStyle: "black",
    backgroundColor: "#f5f5f5"
  },
  permissions: {
    scope: ["getUserInfo", "openChat", "followOA"]
  },
  app: {
    name: "Shop Huy Vân",
    output: "dist"
  }
};
