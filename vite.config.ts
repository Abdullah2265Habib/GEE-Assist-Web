import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

// In development the site talks to the backend through this proxy, so the
// backend needs no CORS entry for the dev server. In production set
// VITE_API_BASE_URL to the backend's public URL and add the website's origin
// to the backend's CORS_ORIGINS.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const backend = env.BACKEND_URL || "http://localhost:8000";
  return {
    plugins: [react()],
    server: {
      port: 5173,
      proxy: {
        "/api": {
          target: backend,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, ""),
        },
      },
    },
  };
});
