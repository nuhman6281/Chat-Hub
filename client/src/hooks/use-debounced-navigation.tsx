import { useCallback, useRef } from "react";

interface DebouncedNavigationOptions {
  delay?: number;
}

export function useDebouncedNavigation(
  options: DebouncedNavigationOptions = {}
) {
  const { delay = 150 } = options;
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastCallRef = useRef<number>(0);

  const debouncedNavigate = useCallback(
    (navigationFn: () => void) => {
      const now = Date.now();

      // If it's been less than the delay since the last call, clear the timeout and set a new one
      if (now - lastCallRef.current < delay) {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }

        timeoutRef.current = setTimeout(() => {
          navigationFn();
          lastCallRef.current = Date.now();
        }, delay);
      } else {
        // If enough time has passed, execute immediately
        navigationFn();
        lastCallRef.current = now;
      }
    },
    [delay]
  );

  const clearDebounce = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  return {
    debouncedNavigate,
    clearDebounce,
  };
}
