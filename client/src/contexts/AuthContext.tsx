import React, {
  createContext,
  ReactNode,
  useContext,
  useState,
  useEffect,
} from "react";
import { useToast } from "@/hooks/use-toast";
import {
  useQuery,
  useMutation,
  UseMutationResult,
  QueryKey,
} from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";

// User interface that matches our server-side User type
interface User {
  id: number;
  username: string;
  displayName: string;
  status: string;
  avatarUrl?: string | null;
}

// Login credentials interface
interface LoginCredentials {
  username: string;
  password: string;
}

// Registration credentials interface
interface RegistrationCredentials {
  username: string;
  email: string;
  password: string;
  displayName: string;
}

// Auth context interface
interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  error: Error | null;
  loginMutation: UseMutationResult<
    { user: User; token: string },
    Error,
    LoginCredentials
  >;
  logoutMutation: UseMutationResult<{ message: string }, Error, void>;
  registerMutation: UseMutationResult<
    { user: User; token: string },
    Error,
    RegistrationCredentials
  >;
}

// Create the auth context
export const AuthContext = createContext<AuthContextType | null>(null);

// Define query key
const userQueryKey: QueryKey = ["/api/auth/user"];

// Create the AuthProvider component
export function AuthProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();
  const [authToken, setAuthToken] = useState<string | null>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("authToken");
    }
    return null;
  });
  // State specifically for the user object provided by the context
  const [providedUser, setProvidedUser] = useState<User | null>(null);

  // Fetch current user - Enabled only when authToken exists
  const {
    data: user,
    error,
    isLoading,
  } = useQuery<User | null, Error>({
    queryKey: userQueryKey,
    queryFn: async () => {
      console.log("AuthContext: queryFn running, authToken:", authToken);
      // If no token, don't fetch, return null immediately
      if (!authToken) {
        console.log("AuthContext: No authToken, returning null from queryFn");
        return null;
      }

      try {
        console.log("AuthContext: Fetching /api/auth/user with token");
        const headers: HeadersInit = { Authorization: `Bearer ${authToken}` };
        const res = await fetch("/api/auth/user", { headers });

        if (!res.ok) {
          console.log(`AuthContext: Fetch failed with status ${res.status}`);
          if (res.status === 401) {
            console.log("AuthContext: Received 401, clearing token");
            // Clear token if unauthorized
            localStorage.removeItem("authToken");
            setAuthToken(null); // Trigger state update
            return null;
          }
          throw new Error(`Failed to fetch user (status: ${res.status})`);
        }

        const userData = await res.json();
        console.log("AuthContext: Fetch successful, user data:", userData);
        return userData;
      } catch (err) {
        console.error("AuthContext: Error inside queryFn:", err);
        // Clear token on other fetch errors too?
        localStorage.removeItem("authToken");
        setAuthToken(null);
        return null;
      }
    },
    enabled: !!authToken, // Query is enabled only if authToken exists
    retry: false, // Don't retry on error
    staleTime: 5 * 60 * 1000, // Cache data for 5 minutes
    refetchOnWindowFocus: true, // Refetch on window focus
  });

  // Effect to sync useQuery result to the providedUser state
  useEffect(() => {
    console.log("AuthContext: User data from useQuery changed:", user);
    setProvidedUser(user ?? null); // Update the state passed to context
  }, [user]);

  // Login mutation
  const loginMutation = useMutation({
    mutationFn: async (credentials: LoginCredentials) => {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(credentials),
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || "Login failed");
      }
      return await res.json();
    },
    onSuccess: (data) => {
      console.log("AuthContext: Login mutation onSuccess");
      // 1. Save token
      localStorage.setItem("authToken", data.token);
      // 2. Update token state (this enables the useQuery)
      setAuthToken(data.token);
      // 3. Immediately update providedUser state with login data
      console.log(
        "AuthContext: Setting providedUser state from login data:",
        data.user
      );
      setProvidedUser(data.user);
      // 4. Invalidate the user query to ensure it refetches eventually (good practice)
      console.log("AuthContext: Invalidating user query after login");
      queryClient.invalidateQueries({ queryKey: userQueryKey });

      toast({
        title: "Login successful",
        description: `Welcome back, ${data.user.displayName}!`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Login failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Register mutation
  const registerMutation = useMutation({
    mutationFn: async (credentials: RegistrationCredentials) => {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(credentials),
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || "Registration failed");
      }
      return await res.json();
    },
    onSuccess: (data) => {
      console.log("AuthContext: Register mutation onSuccess");
      // 1. Save token
      localStorage.setItem("authToken", data.token);
      // 2. Update token state (this enables the useQuery)
      setAuthToken(data.token);
      // 3. Immediately update providedUser state with registration data
      console.log(
        "AuthContext: Setting providedUser state from register data:",
        data.user
      );
      setProvidedUser(data.user);
      // 4. Invalidate the user query to ensure it refetches eventually (good practice)
      console.log("AuthContext: Invalidating user query after registration");
      queryClient.invalidateQueries({ queryKey: userQueryKey });

      toast({
        title: "Registration successful",
        description: `Welcome, ${data.user.displayName}!`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Registration failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Logout mutation - Use setQueryData for immediate update
  const logoutMutation = useMutation({
    mutationFn: async () => {
      const currentToken = localStorage.getItem("authToken"); // Use current token for logout call
      if (!currentToken) return { message: "Already logged out" }; // Optional: No need to call server if no token

      const headers: HeadersInit = { Authorization: `Bearer ${currentToken}` };
      const res = await fetch("/api/auth/logout", {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
      });

      if (!res.ok && res.status !== 401) {
        // Ignore 401 error on logout
        const errorData = await res.json().catch(() => ({})); // Avoid crash if no JSON body
        throw new Error(errorData.message || "Logout failed on server");
      }
      return { message: "Logout successful" }; // Return success message
    },
    onSuccess: () => {
      console.log("AuthContext: Logout mutation onSuccess start");
      // 1. Clear token
      localStorage.removeItem("authToken");
      // 2. Update token state -> This disables the useQuery
      setAuthToken(null);
      // 3. Immediately update the user state exposed by the provider
      console.log("AuthContext: Setting providedUser state to null");
      setProvidedUser(null);
      // 4. Force update of user data in cache to null (for consistency)
      console.log("AuthContext: Setting user query data to null");
      queryClient.setQueryData(userQueryKey, null);
      // 5. Also invalidate to ensure query state is fully re-evaluated
      console.log(
        "AuthContext: Invalidating user query AFTER setting data to null"
      );
      queryClient.invalidateQueries({ queryKey: userQueryKey });

      // Let the useQuery hook react to being disabled.
      // This should cause the user data to update to null/undefined,
      // triggering a re-render in consumers via the provider value.

      console.log("AuthContext: Showing logout toast");
      toast({
        title: "Logged out",
        description: "You have been successfully logged out.",
      });
      console.log("AuthContext: Logout mutation onSuccess end");
    },
    onError: (error: Error) => {
      console.error("AuthContext: Logout mutation error:", error);
      toast({
        title: "Logout failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Add logging for user state changes
  useEffect(() => {
    console.log("AuthContext: User state from useQuery changed:", user);
  }, [user]);

  // Combine loading states from query and mutations
  const combinedIsLoading =
    isLoading || // Initial user fetch
    loginMutation.isPending ||
    registerMutation.isPending ||
    logoutMutation.isPending; // Explicitly include logout pending state

  const providerValue = {
    user: providedUser, // Use the local state here
    isLoading: combinedIsLoading, // Provide the combined loading state
    error,
    loginMutation,
    logoutMutation,
    registerMutation,
  };

  // Log the value being provided
  console.log("AuthContext.Provider: Rendering with value:", providerValue);

  return (
    <AuthContext.Provider value={providerValue}>
      {children}
    </AuthContext.Provider>
  );
}

// Custom hook to use the auth context
export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    // Check for undefined instead of null
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
