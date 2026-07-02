import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    open: true,
    // Proxy Azure Search requests through Vite to avoid CORS entirely.
    // Browser calls /azure-search/* → Vite forwards to the real endpoint.
    proxy: {
      "/azure-search": {
        target: "https://searchcatalog.search.windows.net",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/azure-search/, ""),
      },
    },
  },
});
