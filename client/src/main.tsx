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
        url = url.replace("localhost:undefined", "localhost:3002");
        return new originalWebSocket(url, protocols);
      }

      // Handle application WebSocket - make sure to use server port
      if (url.includes("/api/ws")) {
        // Fix: create proper WebSocket URL without concatenation
        let wsPath = url;
        if (url.startsWith("/")) {
          // For paths starting with /, construct the full URL
          wsPath = `ws://localhost:3001${url}`;
        } else if (!url.startsWith("ws://") && !url.startsWith("wss://")) {
          // For relative paths without protocol
          wsPath = `ws://localhost:3001/${url}`;
        }
        console.log(
          "[WebSocket Patch] Using application WebSocket URL:",
          wsPath
        );
        return new originalWebSocket(wsPath, protocols);
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
        url = `ws://localhost:3001/api/ws?token=${token}`;
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

  // Define base API URL for use throughout the app
  (window as any).API_BASE_URL = "http://localhost:3001";
}

// Separate component to prevent context initialization issues
function AppWithProviders() {
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <ChatProvider>
            <App />
          </ChatProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

// Render with error boundary
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Suspense fallback={<div>Loading...</div>}>
      <AppWithProviders />
    </Suspense>
  </StrictMode>
);
