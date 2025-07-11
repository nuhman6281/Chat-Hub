import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest<T = any>(
  url: string,
  options?: RequestInit,
  returnPlainResponse?: boolean
): Promise<T> {
  const authToken = localStorage.getItem('authToken');
  
  const res = await fetch(url, {
    ...options,
    headers: {
      ...(options?.body ? { 'Content-Type': 'application/json' } : {}),
      ...(authToken ? { 'Authorization': `Bearer ${authToken}` } : {}),
      ...options?.headers,
    },
    body: options?.body && typeof options.body !== 'string' 
      ? JSON.stringify(options.body) 
      : options?.body,
    credentials: 'include',
  });

  await throwIfResNotOk(res);
  
  // For API calls that don't return JSON
  if (returnPlainResponse) {
    return res as unknown as T;
  }
  
  return await res.json() as T;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const res = await fetch(queryKey[0] as string, {
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
