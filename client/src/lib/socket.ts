import { useEffect, useState, useRef, useCallback } from 'react';

type SocketEvent = {
  type: string;
  payload: any;
};

type SocketHandler = (payload: any) => void;

// Create a WebSocket connection
export function createSocketConnection(): WebSocket {
  // Determine the correct WebSocket protocol (ws or wss)
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${protocol}//${window.location.host}/ws`;
  
  // Create and return the WebSocket instance
  return new WebSocket(wsUrl);
}

// Custom hook for managing WebSocket connections
export function useSocket() {
  const [isConnected, setIsConnected] = useState(false);
  const [reconnectAttempt, setReconnectAttempt] = useState(0);
  const socketRef = useRef<WebSocket | null>(null);
  const handlersRef = useRef<Map<string, Set<SocketHandler>>>(new Map());
  
  // Initialize connection
  useEffect(() => {
    const connectSocket = () => {
      try {
        // Close existing connection if any
        if (socketRef.current) {
          socketRef.current.close();
        }
        
        // Create new connection
        socketRef.current = createSocketConnection();
        
        // Set up event listeners
        socketRef.current.onopen = () => {
          console.log('WebSocket connection established');
          setIsConnected(true);
          setReconnectAttempt(0);
        };
        
        socketRef.current.onmessage = (event) => {
          try {
            const socketEvent: SocketEvent = JSON.parse(event.data);
            const { type, payload } = socketEvent;
            
            console.log('WebSocket message received:', { type, payload });
            
            // Call all registered handlers for this event type
            const handlers = handlersRef.current.get(type);
            if (handlers) {
              console.log(`Found ${handlers.size} handlers for event type: ${type}`);
              handlers.forEach((handler, index) => {
                console.log(`Calling handler ${index + 1} for ${type}`);
                handler(payload);
              });
            } else {
              console.log(`No handlers found for event type: ${type}`);
            }
          } catch (error) {
            console.error('Error handling WebSocket message:', error);
          }
        };
        
        socketRef.current.onclose = (event) => {
          console.log('WebSocket connection closed', event.code, event.reason);
          setIsConnected(false);
          
          // Disable automatic reconnection in development to prevent loops
          // Only reconnect on unexpected closures and limit attempts
          if (event.code !== 1000 && event.code !== 1001 && reconnectAttempt < 3) {
            const delay = Math.min(2000 * Math.pow(2, reconnectAttempt), 10000);
            setTimeout(() => {
              setReconnectAttempt(prev => prev + 1);
              connectSocket();
            }, delay);
          }
        };
        
        socketRef.current.onerror = (error) => {
          console.error('WebSocket error:', error);
        };
      } catch (error) {
        console.error('Error creating WebSocket connection:', error);
        
        // Attempt to reconnect
        setTimeout(() => {
          setReconnectAttempt(prev => prev + 1);
          connectSocket();
        }, 5000);
      }
    };
    
    // Initialize connection
    connectSocket();
    
    // Cleanup on unmount
    return () => {
      if (socketRef.current) {
        socketRef.current.close();
      }
    };
  }, [reconnectAttempt]);
  
  // Register event handlers
  const on = useCallback((eventType: string, handler: SocketHandler) => {
    if (!handlersRef.current.has(eventType)) {
      handlersRef.current.set(eventType, new Set());
    }
    
    handlersRef.current.get(eventType)!.add(handler);
    
    // Return cleanup function
    return () => {
      const handlers = handlersRef.current.get(eventType);
      if (handlers) {
        handlers.delete(handler);
        if (handlers.size === 0) {
          handlersRef.current.delete(eventType);
        }
      }
    };
  }, []);
  
  // Send messages
  const send = useCallback((eventType: string, payload: any) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      const event: SocketEvent = {
        type: eventType,
        payload
      };
      socketRef.current.send(JSON.stringify(event));
      return true;
    }
    return false;
  }, []);
  
  return {
    isConnected,
    on,
    send
  };
}