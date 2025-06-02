import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";

// Dynamic import helper function
function loadCartographer() {
  if (
    process.env.NODE_ENV !== "production" &&
    process.env.REPL_ID !== undefined
  ) {
    return import("@replit/vite-plugin-cartographer")
      .then((m) => [m.cartographer()])
      .catch(() => []);
  }
  return Promise.resolve([]);
}

export default defineConfig(async () => {
  const cartographerPlugins = await loadCartographer();

  return {
    plugins: [react(), runtimeErrorOverlay(), ...cartographerPlugins],
    resolve: {
      alias: {
        "@": path.resolve(import.meta.dirname, "client", "src"),
        "@shared": path.resolve(import.meta.dirname, "shared"),
        "@assets": path.resolve(import.meta.dirname, "attached_assets"),
        events: "events-browserify",
        util: "util/",
        stream: "stream-browserify",
        buffer: "buffer/",
        process: "process/browser",
      },
    },
    server: {
      port: 3001,
      hmr: {
        port: 3002,
        protocol: "ws",
        host: "localhost",
        clientPort: 3002,
      },
      proxy: {
        "/api/ws": {
          target: "ws://localhost:3001",
          ws: true,
        },
      },
    },
    root: path.resolve(import.meta.dirname, "client"),
    build: {
      outDir: path.resolve(import.meta.dirname, "dist/public"),
      emptyOutDir: true,
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
  };
});
