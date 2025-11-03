import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "url";
import * as path from "path";
import zmp from "zmp-vite-plugin";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  plugins: [react(), zmp()],
  // [SHV] Dùng đường dẫn tương đối để Mini load đúng asset
  base: "./",

  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@shared": path.resolve(__dirname, "../../packages/shared/src"),
    },
    extensions: [".mjs", ".js", ".ts", ".jsx", ".tsx", ".json"],
  },

  // [SHV] Cho phép truy cập dev server từ LAN/thiết bị thật
  server: {
    host: true,
    port: 5173,
  },

  // [SHV] Preview cũng mở host để extension/thiết bị vào được
  preview: {
    host: true,
    port: 4173,
  },

  build: {
    outDir: "dist",
  },
});
