/**
 * Establishes a WebSocket connection for real-time messaging
 */
export function connectWebSocket(userId: number): WebSocket {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const wsUrl = `${protocol}//${window.location.host}/ws`;
  
  const socket = new WebSocket(wsUrl);
  
  socket.addEventListener("open", () => {
    console.log("WebSocket connection established");
    
    // Authenticate the WebSocket connection by sending the user ID
    socket.send(JSON.stringify({
      type: "auth",
      userId
    }));
  });
  
  socket.addEventListener("error", (event) => {
    console.error("WebSocket error:", event);
  });
  
  socket.addEventListener("close", (event) => {
    console.log("WebSocket connection closed:", event.code, event.reason);
    
    // Try to reconnect after 5 seconds if not intentionally closed
    if (event.code !== 1000) {
      console.log("Attempting to reconnect in 5 seconds...");
      setTimeout(() => {
        connectWebSocket(userId);
      }, 5000);
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
