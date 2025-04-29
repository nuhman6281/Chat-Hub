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

    if (
      socket &&
      (socket.readyState === WebSocket.OPEN ||
        socket.readyState === WebSocket.CONNECTING)
    ) {
      console.log("Socket already connected or connecting");
      return;
    }

    userId = uid;
    const socketUrl = getSocketUrl(uid);

    console.log(`Connecting to socket at ${socketUrl}`);

    try {
      socket = new WebSocket(socketUrl);

      socket.onopen = () => {
        console.log("Socket connected");
        connected = true;
        retryCount = 0;

        // Notify any listeners that we're connected
        if (eventHandlers["connect"]) {
          eventHandlers["connect"].forEach((handler) =>
            handler({ connected: true })
          );
        }
      };

      socket.onmessage = (event) => {
        try {
          const parsedData = JSON.parse(event.data) as SocketEvent;

          if (eventHandlers[parsedData.event]) {
            eventHandlers[parsedData.event].forEach((handler) =>
              handler(parsedData.data)
            );
          } else {
            console.log(
              `No handlers for event: ${parsedData.event}`,
              parsedData.data
            );
          }
        } catch (error) {
          console.error("Error parsing socket message", error, event.data);
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
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      console.error("Cannot send message, socket not connected");
      if (userId) {
        console.log("Attempting to reconnect before sending");
        connect(userId);
      }
      return false;
    }

    try {
      const message: SocketEvent = { event, data };
      socket.send(JSON.stringify(message));
      return true;
    } catch (error) {
      console.error("Error sending message", error);
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

  return {
    get connected() {
      return connected;
    },
    send,
    on,
    off,
    connect,
    disconnect,
  };
};

// Helper to parse socket messages
export const parseSocketMessage = (data: string): SocketEvent | null => {
  try {
    return JSON.parse(data) as SocketEvent;
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
