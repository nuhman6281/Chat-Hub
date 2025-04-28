/**
 * Establishes a WebSocket connection for real-time messaging
 */
export function connectWebSocket(userId: number): WebSocket {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const wsUrl = `${protocol}//${window.location.host}/ws`;
  
  console.log(`Connecting to WebSocket at: ${wsUrl}`);
  const socket = new WebSocket(wsUrl);
  
  // Track connection state
  let isAuthenticated = false;
  let reconnectAttempts = 0;
  const maxReconnectAttempts = 5;
  
  socket.addEventListener("open", () => {
    console.log("WebSocket connection established");
    reconnectAttempts = 0;
    
    // Authenticate the WebSocket connection by sending the user ID
    socket.send(JSON.stringify({
      type: "auth",
      userId
    }));
    
    // Set a timeout to verify authentication success
    setTimeout(() => {
      if (!isAuthenticated) {
        console.warn("WebSocket authentication timed out");
      }
    }, 3000);
  });
  
  socket.addEventListener("message", (event) => {
    try {
      const data = JSON.parse(event.data);
      if (data.type === "auth_success") {
        console.log("WebSocket authenticated successfully");
        isAuthenticated = true;
      }
    } catch (error) {
      console.error("Error parsing WebSocket message:", error);
    }
  });
  
  socket.addEventListener("error", (event) => {
    console.error("WebSocket error:", event);
  });
  
  socket.addEventListener("close", (event) => {
    console.log("WebSocket connection closed:", event.code, event.reason);
    isAuthenticated = false;
    
    // Try to reconnect with exponential backoff if not intentionally closed
    if (event.code !== 1000 && reconnectAttempts < maxReconnectAttempts) {
      const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000);
      reconnectAttempts++;
      
      console.log(`Attempting to reconnect in ${delay/1000} seconds... (Attempt ${reconnectAttempts}/${maxReconnectAttempts})`);
      
      setTimeout(() => {
        if (document.visibilityState !== "hidden") {
          connectWebSocket(userId);
        }
      }, delay);
    }
  });
  
  // Handle page visibility changes
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && socket.readyState !== WebSocket.OPEN) {
      console.log("Page became visible, reconnecting WebSocket");
      connectWebSocket(userId);
    }
  });
  
  return socket;
}

/**
 * Parses a WebSocket message
 */
export function parseWSMessage(event: MessageEvent): any {
  try {
    return JSON.parse(event.data);
  } catch (error) {
    console.error("Error parsing WebSocket message:", error);
    return null;
  }
}
