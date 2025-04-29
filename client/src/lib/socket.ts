import { useEffect, useState, useRef, useCallback } from "react";

// Define the BASE_URL constant
const BASE_URL = process.env.VITE_API_URL || "http://localhost:3000";

export type SocketEventHandler = (data: any) => void;

export interface Socket {
  connected: boolean;
  send: (event: string, data: any) => boolean;
  on: (event: string, callback: SocketEventHandler) => () => void;
  off: (event: string, callback: SocketEventHandler) => void;
  connect: (userId: string | null) => void;
  disconnect: () => void;
  authenticate: () => boolean;
}

interface SocketEvent {
  event: string;
  data: any;
}

interface EventHandlers {
  [event: string]: SocketEventHandler[];
}

export const createSocket = (): Socket => {
  let socket: WebSocket | null = null;
  let connected = false;
  let retryCount = 0;
  let maxRetryCount = 5;
  let retryTimeout: ReturnType<typeof setTimeout> | null = null;
  const eventHandlers: EventHandlers = {};
  let userId: string | null = null;

  const calculateRetryTimeout = (): number => {
    // Exponential backoff with jitter
    const baseTimeout = 1000; // 1 second
    const maxTimeout = 30000; // 30 seconds
    const exponentialTimeout = baseTimeout * Math.pow(2, retryCount);
    const cappedTimeout = Math.min(exponentialTimeout, maxTimeout);
    const jitter = Math.random() * 0.3 + 0.85; // 0.85-1.15
    return Math.floor(cappedTimeout * jitter);
  };

  const getSocketUrl = (uid: string): string => {
    // Extract base URL components
    let url = BASE_URL || "";

    // Default to localhost:3000 if no BASE_URL
    if (!url) {
      url = "http://localhost:3000";
    }

    // Simple direct WebSocket URL without using URL parsing
    // This avoids issues with undefined port
    if (url.includes("localhost")) {
      // Append the correct path /api/ws
      return `ws://localhost:3000/api/ws?token=${uid}`;
    }

    // Parse the URL to ensure we have all components
    try {
      const urlObj = new URL(url);
      // Replace http/https with ws/wss
      const protocol = urlObj.protocol === "https:" ? "wss:" : "ws:";
      // Always use port 3000 for local development
      const port =
        urlObj.hostname === "localhost" ? "3000" : urlObj.port || "3000";
      // Construct the WebSocket URL with fixed port and correct path
      return `${protocol}//${urlObj.hostname}:${port}/api/ws?token=${uid}`;
    } catch (error) {
      console.error("Invalid base URL for WebSocket", error);
      // Fallback to a safe default with the correct path
      return `ws://localhost:3000/api/ws?token=${uid}`;
    }
  };

  const connect = (uid: string | null) => {
    if (!uid) {
      console.error("Cannot connect socket: userId is null or undefined");
      return;
    }

    // Clear any existing reconnect timer
    if (retryTimeout) {
      clearTimeout(retryTimeout);
      retryTimeout = null;
    }

    // Check if we already have an active connection
    if (socket) {
      if (socket.readyState === WebSocket.OPEN) {
        console.log("Socket is already open - no need to reconnect");

        // Ensure connect handlers are triggered
        if (eventHandlers["connect"] && !connected) {
          connected = true;
          eventHandlers["connect"].forEach((handler) =>
            handler({ connected: true })
          );
        }

        // Send authentication if needed
        if (!connected && userId) {
          try {
            const message = {
              type: "auth",
              data: { userId },
            };
            console.log("Sending authentication message:", message);
            socket.send(JSON.stringify(message));
          } catch (error) {
            console.error("Error sending authentication message:", error);
          }
        }
        return;
      }

      if (socket.readyState === WebSocket.CONNECTING) {
        console.log("Socket is already connecting - waiting...");
        return;
      }

      // Close any existing socket in other states
      try {
        socket.close(1000, "Creating new connection");
      } catch (e) {
        console.log("Error closing existing socket:", e);
      }
      socket = null;
    }

    userId = uid;
    const socketUrl = getSocketUrl(uid);

    console.log(`Creating new socket connection to ${socketUrl}`);

    try {
      socket = new WebSocket(socketUrl);

      socket.onopen = () => {
        console.log("Socket connected successfully");
        connected = true;
        retryCount = 0;

        // Send authentication immediately after connection
        if (userId) {
          try {
            const message = {
              type: "auth",
              data: { userId },
            };
            console.log("Sending authentication message:", message);
            if (socket) {
              socket.send(JSON.stringify(message));
            } else {
              console.error("Cannot send authentication: socket is null");
            }
          } catch (error) {
            console.error("Error sending authentication message:", error);
          }
        }

        // Notify any listeners that we're connected
        if (eventHandlers["connect"]) {
          eventHandlers["connect"].forEach((handler) =>
            handler({ connected: true })
          );
        }
      };

      socket.onmessage = (event) => {
        try {
          let parsedData;

          try {
            parsedData = JSON.parse(event.data);
          } catch (e) {
            console.log("Raw message received (not JSON):", event.data);
            return;
          }

          console.log("Received socket message:", parsedData);

          // Check if the message is valid
          if (!parsedData || typeof parsedData !== "object") {
            console.error("Invalid message format received:", event.data);
            return;
          }

          // Normalize the event type - handle both common formats
          // Some servers send {type, data}, others send {event, data}
          const eventType = parsedData.type || parsedData.event || "message";
          const eventData = parsedData.data || parsedData;

          // Special case for auth_success
          if (eventType === "auth_success" || eventType === "auth-success") {
            console.log("Authentication successful:", parsedData);
            if (eventHandlers["auth_success"]) {
              eventHandlers["auth_success"].forEach((handler) =>
                handler(parsedData)
              );
            }
            return;
          }

          // Handle errors
          if (eventType === "error") {
            console.error("Received socket error:", parsedData);
            if (eventHandlers["error"]) {
              eventHandlers["error"].forEach((handler) => handler(parsedData));
            }
            return;
          }

          // Debug for undefined event types
          if (eventType === undefined) {
            console.warn(
              "Received message with undefined event type:",
              parsedData
            );
            return;
          }

          // Handle regular messages
          if (eventHandlers[eventType]) {
            eventHandlers[eventType].forEach((handler) => handler(parsedData));
          } else {
            console.log(
              `No handlers for socket event: ${eventType}`,
              parsedData
            );
          }
        } catch (error) {
          console.error("Error processing socket message", error, event.data);
        }
      };

      socket.onclose = (event) => {
        connected = false;
        console.log(`Socket closed: ${event.code} ${event.reason}`);

        if (eventHandlers["disconnect"]) {
          eventHandlers["disconnect"].forEach((handler) =>
            handler({ code: event.code, reason: event.reason })
          );
        }

        // Only retry if this wasn't an intentional disconnect
        if (userId && retryCount < maxRetryCount) {
          const timeout = calculateRetryTimeout();
          console.log(
            `Reconnecting in ${timeout}ms (attempt ${
              retryCount + 1
            }/${maxRetryCount})`
          );

          retryTimeout = setTimeout(() => {
            retryCount++;
            connect(userId);
          }, timeout);
        } else if (retryCount >= maxRetryCount) {
          console.error("Max reconnection attempts reached");
          if (eventHandlers["error"]) {
            eventHandlers["error"].forEach((handler) =>
              handler({ error: "Max reconnection attempts reached" })
            );
          }
        }
      };

      socket.onerror = (error) => {
        console.error("Socket error", error);
        if (eventHandlers["error"]) {
          eventHandlers["error"].forEach((handler) => handler({ error }));
        }
      };
    } catch (error) {
      console.error("Error creating WebSocket connection", error);
      if (eventHandlers["error"]) {
        eventHandlers["error"].forEach((handler) =>
          handler({ error: "Failed to create WebSocket connection" })
        );
      }
    }
  };

  const disconnect = () => {
    if (retryTimeout) {
      clearTimeout(retryTimeout);
      retryTimeout = null;
    }

    if (socket) {
      userId = null;
      socket.close(1000, "Client disconnected");
      socket = null;
      connected = false;
    }
  };

  const send = (event: string, data: any): boolean => {
    if (!socket) {
      console.error("Cannot send message: socket is null");
      if (userId) {
        console.log("Attempting to create socket before sending");
        connect(userId);
      }
      return false;
    }

    if (socket.readyState !== WebSocket.OPEN) {
      console.error(
        `Cannot send message: socket state is ${socket.readyState} (not OPEN)`
      );
      if (socket.readyState === WebSocket.CONNECTING) {
        console.log("Socket is connecting, waiting...");
      } else if (userId) {
        console.log("Socket not open, attempting to reconnect");
        connect(userId);
      }
      return false;
    }

    try {
      // Format message: Spread data directly into the message object
      const message = {
        type: event,
        ...data, // Spread the data here
      };

      // Log based on type
      if (event === "auth") {
        console.log("Sending authentication message:", message);
      } else {
        console.log("Sending socket message:", message);
      }

      socket.send(JSON.stringify(message));
      return true;
    } catch (error) {
      console.error("Error sending socket message", error);
      return false;
    }
  };

  const on = (event: string, callback: SocketEventHandler): (() => void) => {
    if (!eventHandlers[event]) {
      eventHandlers[event] = [];
    }
    eventHandlers[event].push(callback);

    // Return a function that removes this specific callback
    return () => {
      off(event, callback);
    };
  };

  const off = (event: string, callback: SocketEventHandler) => {
    if (eventHandlers[event]) {
      eventHandlers[event] = eventHandlers[event].filter(
        (handler) => handler !== callback
      );
    }
  };

  // Add explicit authentication method
  const authenticate = (): boolean => {
    if (!userId) {
      console.error("Cannot authenticate: No userId available");
      return false;
    }

    if (!socket) {
      console.error("Cannot authenticate: Socket not initialized");
      return false;
    }

    if (socket.readyState !== WebSocket.OPEN) {
      console.error(
        `Cannot authenticate: Socket not open (state: ${socket.readyState})`
      );
      return false;
    }

    try {
      // Send userId directly, not nested in data
      const message = {
        type: "auth",
        userId: String(userId),
      };
      console.log("Explicitly authenticating socket:", message);
      socket.send(JSON.stringify(message));
      return true;
    } catch (error) {
      console.error("Error authenticating socket:", error);
      return false;
    }
  };

  return {
    get connected() {
      return connected;
    },
    send,
    on,
    off,
    connect,
    disconnect,
    authenticate,
  };
};

// Helper to parse socket messages
export const parseSocketMessage = (data: string): SocketEvent | null => {
  try {
    const parsed = JSON.parse(data);
    // Convert server message format to client event format
    return {
      event: parsed.type,
      data: parsed.data, // Extract data from the data field
    };
  } catch (error) {
    console.error("Error parsing socket message", error);
    return null;
  }
};

// Create the singleton socket instance
const socketSingleton = createSocket();

// Custom hook for using the socket
export const useSocket = (): Socket => {
  // Return the singleton instance
  return socketSingleton;
};
