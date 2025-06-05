/**
 * Singleton WebSocket service for managing real-time communication
 * Implements proper handler accumulation and connection management
 */

type EventHandler = (payload: any) => void;

class WebSocketService {
  private static instance: WebSocketService;
  private socket: WebSocket | null = null;
  private handlers: Map<string, EventHandler[]> = new Map();
  private isConnected = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 2000;
  private connectionListeners: ((connected: boolean) => void)[] = [];

  private constructor() {}

  static getInstance(): WebSocketService {
    if (!WebSocketService.instance) {
      WebSocketService.instance = new WebSocketService();
    }
    return WebSocketService.instance;
  }

  connect(userId?: number): void {
    if (this.socket?.readyState === WebSocket.OPEN) return;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws`;

    try {
      this.socket = new WebSocket(wsUrl);

      this.socket.onopen = () => {
        console.log('WebSocket connected');
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.notifyConnectionListeners(true);

        // Authenticate if userId provided
        if (userId) {
          this.send('auth', { userId });
        }
      };

      this.socket.onmessage = (event) => {
        try {
          const { type, payload } = JSON.parse(event.data);
          console.log(`WebSocket event received: ${type}`, payload);
          
          const eventHandlers = this.handlers.get(type);
          if (eventHandlers && eventHandlers.length > 0) {
            console.log(`Executing ${eventHandlers.length} handlers for ${type}`);
            eventHandlers.forEach((handler, index) => {
              try {
                console.log(`Calling handler ${index + 1} for ${type}`);
                handler(payload);
              } catch (error) {
                console.error(`Error in handler ${index + 1} for ${type}:`, error);
              }
            });
          } else {
            console.log(`No handlers registered for ${type}`);
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      this.socket.onclose = (event) => {
        console.log('WebSocket disconnected:', event.code, event.reason);
        this.isConnected = false;
        this.notifyConnectionListeners(false);

        // Attempt reconnection for unexpected closures
        if (event.code !== 1000 && event.code !== 1001 && this.reconnectAttempts < this.maxReconnectAttempts) {
          const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts);
          console.log(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts + 1})`);
          
          setTimeout(() => {
            this.reconnectAttempts++;
            this.connect(userId);
          }, delay);
        }
      };

      this.socket.onerror = (error) => {
        console.error('WebSocket error:', error);
      };

    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
    }
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.close(1000, 'Manual disconnect');
      this.socket = null;
    }
    this.isConnected = false;
    this.handlers.clear();
    this.connectionListeners = [];
  }

  send(type: string, payload: any): boolean {
    if (this.socket?.readyState === WebSocket.OPEN) {
      const message = { type, payload };
      this.socket.send(JSON.stringify(message));
      console.log(`WebSocket message sent: ${type}`, payload);
      return true;
    }
    console.warn(`Cannot send message: WebSocket not connected (${type})`);
    return false;
  }

  on(eventType: string, handler: EventHandler): () => void {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, []);
    }

    const handlers = this.handlers.get(eventType)!;
    handlers.push(handler);
    console.log(`Handler registered for ${eventType}, total: ${handlers.length}`);

    // Return unsubscribe function
    return () => {
      const handlers = this.handlers.get(eventType);
      if (handlers) {
        const index = handlers.indexOf(handler);
        if (index > -1) {
          handlers.splice(index, 1);
          console.log(`Handler unregistered for ${eventType}, remaining: ${handlers.length}`);
          
          if (handlers.length === 0) {
            this.handlers.delete(eventType);
          }
        }
      }
    };
  }

  onConnectionChange(listener: (connected: boolean) => void): () => void {
    this.connectionListeners.push(listener);
    
    // Immediately call with current state
    listener(this.isConnected);

    // Return unsubscribe function
    return () => {
      const index = this.connectionListeners.indexOf(listener);
      if (index > -1) {
        this.connectionListeners.splice(index, 1);
      }
    };
  }

  private notifyConnectionListeners(connected: boolean): void {
    this.connectionListeners.forEach(listener => {
      try {
        listener(connected);
      } catch (error) {
        console.error('Error in connection listener:', error);
      }
    });
  }

  getConnectionState(): boolean {
    return this.isConnected;
  }
}

export const webSocketService = WebSocketService.getInstance();