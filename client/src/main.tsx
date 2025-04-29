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
  // @ts-ignore - Need to override WebSocket constructor
  window.WebSocket = function (url: string, protocols?: string | string[]) {
    if (url && typeof url === "string") {
      // Hardcode localhost to use port 3000
      if (url.includes("localhost")) {
        url = url.replace(/localhost(?::undefined)?/, "localhost:3000");
        console.log("Using fixed WebSocket URL:", url);
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
        console.error("Invalid WebSocket URL:", url);
        // Fallback to a safe default if URL is invalid
        if (url.includes("token=")) {
          const tokenMatch = url.match(/token=([^&]*)/);
          const token = tokenMatch ? tokenMatch[1] : "";
          url = `ws://localhost:3000/?token=${token}`;
        } else {
          url = "ws://localhost:3000/";
        }
        console.log("Using fallback WebSocket URL:", url);
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
      <AuthProvider>
        <ChatProvider>
          <App />
        </ChatProvider>
      </AuthProvider>
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
