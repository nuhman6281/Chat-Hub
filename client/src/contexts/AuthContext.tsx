import React, { createContext, ReactNode, useContext, useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useMutation, UseMutationResult } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';

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
  password: string;
  displayName: string;
}

// Auth context interface
interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  error: Error | null;
  loginMutation: UseMutationResult<{ user: User; token: string }, Error, LoginCredentials>;
  logoutMutation: UseMutationResult<{ message: string }, Error, void>;
  registerMutation: UseMutationResult<{ user: User; token: string }, Error, RegistrationCredentials>;
}

// Create the auth context
export const AuthContext = createContext<AuthContextType | null>(null);

// Create the AuthProvider component
export function AuthProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();
  const [authToken, setAuthToken] = useState<string | null>(
    localStorage.getItem('authToken')
  );

  // Fetch current user
  const {
    data: user,
    error,
    isLoading,
  } = useQuery({
    queryKey: ['/api/auth/user'],
    queryFn: async () => {
      try {
        const headers: HeadersInit = {};
        if (authToken) {
          headers['Authorization'] = `Bearer ${authToken}`;
        }
        
        const res = await fetch('/api/auth/user', { headers });
        if (!res.ok) {
          if (res.status === 401) {
            // Clear token if unauthorized
            localStorage.removeItem('authToken');
            setAuthToken(null);
            return null;
          }
          throw new Error('Failed to fetch user');
        }
        
        return await res.json();
      } catch (err) {
        console.error('Error fetching user:', err);
        return null;
      }
    },
    enabled: true,
  });

  // Login mutation
  const loginMutation = useMutation({
    mutationFn: async (credentials: LoginCredentials) => {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(credentials)
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || 'Login failed');
      }
      return await res.json();
    },
    onSuccess: (data) => {
      // Save token and update query cache
      localStorage.setItem('authToken', data.token);
      setAuthToken(data.token);
      queryClient.setQueryData(['/api/auth/user'], data.user);
      
      toast({
        title: 'Login successful',
        description: `Welcome back, ${data.user.displayName}!`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Login failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Register mutation
  const registerMutation = useMutation({
    mutationFn: async (credentials: RegistrationCredentials) => {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(credentials)
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || 'Registration failed');
      }
      return await res.json();
    },
    onSuccess: (data) => {
      // Save token and update query cache
      localStorage.setItem('authToken', data.token);
      setAuthToken(data.token);
      queryClient.setQueryData(['/api/auth/user'], data.user);
      
      toast({
        title: 'Registration successful',
        description: `Welcome, ${data.user.displayName}!`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Registration failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Logout mutation
  const logoutMutation = useMutation({
    mutationFn: async () => {
      const headers: HeadersInit = {};
      if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
      }
      
      const res = await fetch('/api/auth/logout', {
        method: 'POST',
        headers: {
          ...headers,
          'Content-Type': 'application/json'
        }
      });
      
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || 'Logout failed');
      }
      return await res.json();
    },
    onSuccess: () => {
      // Clear token and update query cache
      localStorage.removeItem('authToken');
      setAuthToken(null);
      queryClient.setQueryData(['/api/auth/user'], null);
      
      toast({
        title: 'Logged out',
        description: 'You have been successfully logged out.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Logout failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  return (
    <AuthContext.Provider
      value={{
        user: user || null,
        isLoading,
        error,
        loginMutation,
        logoutMutation,
        registerMutation,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// Custom hook to use the auth context
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}