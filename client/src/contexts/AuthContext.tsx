import React, {
  createContext,
  ReactNode,
  useContext,
  useState,
  useEffect,
} from "react";
import { useToast } from "@/components/ui/use-toast";
import {
  useQuery,
  useMutation,
  UseMutationResult,
  QueryKey,
} from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useNavigate } from "react-router-dom";
import { ClientUser } from "@shared/schema";
import { api } from "@/lib/api";

// Login credentials interface
interface LoginCredentials {
  email: string;
  password: string;
}

// Registration credentials interface
interface RegistrationCredentials {
  email: string;
  password: string;
  displayName: string;
}

// Auth context interface
export interface AuthContextType {
  user: ClientUser | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (
    email: string,
    password: string,
    displayName: string
  ) => Promise<void>;
  logout: () => Promise<void>;
  loginMutation: UseMutationResult<any, Error, LoginCredentials>;
  registerMutation: UseMutationResult<any, Error, RegistrationCredentials>;
  logoutMutation: UseMutationResult<any, Error, void>;
}

// Create the auth context
export const AuthContext = createContext<AuthContextType | null>(null);

// Define query key
const userQueryKey: QueryKey = ["/api/auth/user"];

// Create the AuthProvider component
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { toast } = useToast();
  const [user, setUser] = useState<ClientUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  const loginMutation = useMutation({
    mutationFn: async (credentials: LoginCredentials) => {
      const response = await api.post("/auth/login", credentials);
      return response.data;
    },
    onSuccess: (data) => {
      setUser(data.user);
      navigate("/");
    },
  });

  const registerMutation = useMutation({
    mutationFn: async (data: RegistrationCredentials) => {
      const response = await api.post("/auth/register", data);
      return response.data;
    },
    onSuccess: (data) => {
      setUser(data.user);
      navigate("/");
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      await api.post("/auth/logout");
    },
    onSuccess: () => {
      setUser(null);
      navigate("/login");
    },
  });

  const login = async (email: string, password: string) => {
    await loginMutation.mutateAsync({ email, password });
  };

  const register = async (
    email: string,
    password: string,
    displayName: string
  ) => {
    await registerMutation.mutateAsync({ email, password, displayName });
  };

  const logout = async () => {
    await logoutMutation.mutateAsync();
  };

  useEffect(() => {
    const checkAuth = async () => {
      try {
        setIsLoading(true);
        const response = await api.get("/auth/me");
        setUser(response.data.user);
      } catch (error) {
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };
    checkAuth();
  }, []);

  const value = {
    user,
    isLoading,
    login,
    register,
    logout,
    loginMutation,
    registerMutation,
    logoutMutation,
  };

  // Log the value being provided
  console.log("AuthContext.Provider: Rendering with value:", value);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// Custom hook to use the auth context
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
