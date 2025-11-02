import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import zmp from "zmp-vite-plugin";

export default defineConfig({
  plugins: [react(), zmp()],
  base: "./"
});
