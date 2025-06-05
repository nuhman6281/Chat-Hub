import { useEffect, useState, useCallback } from 'react';
import { webSocketService } from '@/lib/websocket-service';

export function useWebSocket(userId?: number) {
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    // Subscribe to connection state changes
    const unsubscribe = webSocketService.onConnectionChange(setIsConnected);

    // Connect if not already connected
    if (userId) {
      webSocketService.connect(userId);
    }

    return unsubscribe;
  }, [userId]);

  const on = useCallback((eventType: string, handler: (payload: any) => void) => {
    return webSocketService.on(eventType, handler);
  }, []);

  const send = useCallback((eventType: string, payload: any) => {
    return webSocketService.send(eventType, payload);
  }, []);

  return {
    isConnected,
    on,
    send
  };
}