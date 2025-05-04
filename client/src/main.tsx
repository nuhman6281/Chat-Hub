import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { ThemeProvider } from "./contexts/ThemeContext";
import { AuthProvider } from "./contexts/AuthContext";
import { ChatProvider } from "./contexts/ChatContext";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Suspense, StrictMode } from "react";

// Add WebSocket connection patch for Vite
const patchViteWebSocket = () => {
  const originalWebSocket = window.WebSocket;
  // @ts-expect-error - Need to override WebSocket constructor temporarily
  window.WebSocket = function (url: string, protocols?: string | string[]) {
    if (url && typeof url === "string") {
      // Handle Vite HMR WebSocket
      if (url.includes("localhost:undefined")) {
        console.log("[WebSocket Patch] Fixing Vite HMR URL:", url);
        url = url.replace("localhost:undefined", "localhost:3001");
        return new originalWebSocket(url, protocols);
      }

      // Handle application WebSocket
      if (url.includes("/api/ws")) {
        console.log("[WebSocket Patch] Using application WebSocket URL:", url);
        return new originalWebSocket(url, protocols);
      }

      // Ensure proper WS protocol is used
      if (!url.startsWith("ws:") && !url.startsWith("wss:")) {
        if (window.location.protocol === "https:") {
          url = url.replace(/^(http:\/\/)/, "wss://");
        } else {
          url = url.replace(/^(http:\/\/)/, "ws://");
        }
      }

      // Double check URL is valid before creating WebSocket
      try {
        new URL(url);
      } catch (e) {
        console.error("[WebSocket Patch] Invalid URL:", url);
        // Extract token if present
        const tokenMatch = url.match(/token=([^&]*)/);
        const token = tokenMatch ? tokenMatch[1] : "";
        url = `ws://localhost:3000/api/ws?token=${token}`;
        console.log("[WebSocket Patch] Using fallback URL:", url);
      }
    }
    return new originalWebSocket(url, protocols);
  };

  // Copy prototype and static properties
  window.WebSocket.prototype = originalWebSocket.prototype;
  Object.getOwnPropertyNames(originalWebSocket).forEach((prop) => {
    if (prop !== "prototype" && prop !== "name" && prop !== "length") {
      try {
        Object.defineProperty(window.WebSocket, prop, {
          value: (originalWebSocket as any)[prop],
          configurable: true,
        });
      } catch (e) {
        console.warn(`Could not copy property ${prop}:`, e);
      }
    }
  });
};

// Polyfill for simple-peer
if (typeof window !== "undefined") {
  (window as any).global = window;

  // Apply WebSocket patch
  patchViteWebSocket();
}

// Separate component to prevent context initialization issues
function AppWithProviders() {
  return (
    <ThemeProvider>
      <App />
    </ThemeProvider>
  );
}

// Render with error boundary
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Suspense fallback={<div>Loading...</div>}>
      <QueryClientProvider client={queryClient}>
        <AppWithProviders />
      </QueryClientProvider>
    </Suspense>
  </StrictMode>
);
