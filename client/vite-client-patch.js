// This file will patch the Vite client to fix WebSocket connection issues
// We'll import this in the main.tsx file

// WebSocket patch for Vite client
// This file is loaded by index.html before all other scripts
(function () {
  // Store the original WebSocket constructor
  const OriginalWebSocket = window.WebSocket;

  // Override the WebSocket constructor
  window.WebSocket = function (url, protocols) {
    if (url && typeof url === "string") {
      // Fix the localhost:undefined issue
      if (url.includes("localhost:undefined")) {
        console.log("[WebSocket Patch] Fixing invalid URL:", url);
        url = url.replace("localhost:undefined", "localhost:3000");
      }

      // Ensure URL is valid
      try {
        new URL(url);
      } catch (e) {
        console.error("[WebSocket Patch] Invalid URL:", url);
        // Extract token if present
        const tokenMatch = url.match(/token=([^&]*)/);
        const token = tokenMatch ? tokenMatch[1] : "";
        url = `ws://localhost:3000/?token=${token}`;
        console.log("[WebSocket Patch] Using fallback URL:", url);
      }
    }

    // Create a WebSocket with the fixed URL
    return new OriginalWebSocket(url, protocols);
  };

  // Copy static properties
  window.WebSocket.CONNECTING = OriginalWebSocket.CONNECTING;
  window.WebSocket.OPEN = OriginalWebSocket.OPEN;
  window.WebSocket.CLOSING = OriginalWebSocket.CLOSING;
  window.WebSocket.CLOSED = OriginalWebSocket.CLOSED;
  window.WebSocket.prototype = OriginalWebSocket.prototype;

  console.log("[WebSocket Patch] Applied WebSocket URL patch");
})();
