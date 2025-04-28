import { createContext, useEffect, useState, ReactNode } from "react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface User {
  id: number;
  username: string;
  displayName: string;
  status: string;
  avatarUrl?: string;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string, displayName: string) => Promise<void>;
  logout: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType>({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  login: async () => {},
  register: async () => {},
  logout: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const checkAuth = async () => {
    try {
      console.log("Checking authentication status...");
      const response = await fetch("/api/auth/user", {
        credentials: "include",
      });
      
      if (response.ok) {
        const userData = await response.json();
        console.log("User is authenticated:", userData);
        setUser(userData);
        setIsAuthenticated(true);
      } else {
        console.log("User is not authenticated");
        setUser(null);
        setIsAuthenticated(false);
      }
    } catch (error) {
      console.error("Failed to check authentication:", error);
      setUser(null);
      setIsAuthenticated(false);
    } finally {
      setIsLoading(false);
    }
  };
  
  useEffect(() => {
    // Check if user is already logged in when component mounts
    checkAuth();
  }, []);

  const login = async (username: string, password: string) => {
    try {
      console.log(`Attempting to login with username: ${username}`);
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
        credentials: "include"
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        console.error("Login error:", errorData);
        toast({
          title: "Login failed",
          description: errorData.message || "Invalid username or password",
          variant: "destructive",
        });
        throw new Error(errorData.message || "Login failed");
      }
      
      const userData = await response.json();
      console.log("Login successful:", userData);
      setUser(userData);
      setIsAuthenticated(true);
      
      // After successful login, fetch current user data to confirm
      await checkAuth();
    } catch (error) {
      console.error("Login error:", error);
      toast({
        title: "Login failed",
        description: "Invalid username or password",
        variant: "destructive",
      });
      throw error;
    }
  };

  const register = async (username: string, password: string, displayName: string) => {
    try {
      const response = await apiRequest("POST", "/api/auth/register", {
        username,
        password,
        displayName,
      });
      const userData = await response.json();
      setUser(userData);
    } catch (error) {
      toast({
        title: "Registration failed",
        description: "Could not create account. Please try a different username.",
        variant: "destructive",
      });
      throw error;
    }
  };

  const logout = async () => {
    try {
      await apiRequest("POST", "/api/auth/logout");
      setUser(null);
    } catch (error) {
      toast({
        title: "Logout failed",
        description: "An error occurred while logging out",
        variant: "destructive",
      });
      throw error;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
        register,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
