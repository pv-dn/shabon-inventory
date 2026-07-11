import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// GitHub Pages: /shabon-inventory/
// ローカル・Flask同梱: /
const base = process.env.GITHUB_PAGES === "1" ? "/shabon-inventory/" : "/";

export default defineConfig({
  base,
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": "http://127.0.0.1:5050",
    },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
});
