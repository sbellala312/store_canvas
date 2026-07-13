import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    open: true,
    proxy: {
      // Azure Cognitive Search — catalog lookup
      "/azure-search": {
        target: "https://searchcatalog.search.windows.net",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/azure-search/, ""),
      },
      // Gemini (vision) — CAD auto-placement
      "/gemini": {
        target: "https://generativelanguage.googleapis.com",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/gemini/, ""),
      },
    },
  },
});
