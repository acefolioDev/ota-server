import preact from "@preact/preset-vite";
import { defineConfig } from "vite";

export default defineConfig({
  root: "dashboard",
  base: "/admin/",
  plugins: [preact()],
  server: {
    proxy: {
      "/api": "http://localhost:3000",
    },
  },
  build: {
    outDir: "../dist/dashboard",
    emptyOutDir: true,
  },
});
