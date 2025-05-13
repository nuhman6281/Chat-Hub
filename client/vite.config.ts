import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      "@shared": path.resolve(__dirname, "../shared"),
      events: "events-browserify",
      util: "util/",
      stream: "stream-browserify",
      buffer: "buffer/",
      process: "process/browser",
    },
  },
  server: {
    port: 3000,
    proxy: {
      "/api": {
        target: "http://localhost:3001",
        changeOrigin: true,
      },
      "/api/ws": {
        target: "ws://localhost:3001",
        ws: true,
      },
    },
  },
  optimizeDeps: {
    include: ["simple-peer"],
    esbuildOptions: {
      define: {
        global: "globalThis",
      },
    },
  },
  define: {
    global: "globalThis",
    "process.env": {},
  },
});
