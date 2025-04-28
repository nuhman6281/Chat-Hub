import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Route, useLocation, Redirect, RouteComponentProps } from 'wouter';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  path: string;
  component: React.ComponentType<any>;
}

export function ProtectedRoute({ path, component: Component }: ProtectedRouteProps) {
  const { user, isLoading } = useAuth();
  const [, navigate] = useLocation();

  // Render loading spinner while checking authentication
  if (isLoading) {
    return (
      <Route path={path}>
        {() => (
          <div className="flex items-center justify-center min-h-screen">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        )}
      </Route>
    );
  }

  // If user is not authenticated, redirect to login page
  if (!user) {
    return (
      <Route path={path}>
        {() => <Redirect to="/auth" />}
      </Route>
    );
  }

  // If user is authenticated, render the protected component
  return (
    <Route path={path}>
      {(params) => <Component {...params} />}
    </Route>
  );
}