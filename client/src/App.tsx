import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthWrapper";
import { ChatProvider } from "@/contexts/ChatContext";
import { CallProvider } from "@/contexts/CallContext";
import CallUI from "@/components/CallUI";
import { Suspense, lazy } from "react";
import { ProtectedRoute } from "@/lib/protected-route";

// Lazy load components for better performance
const HomePage = lazy(() => import("@/pages/Home"));
const AuthPage = lazy(() => import("@/pages/auth-page"));
const NotFound = lazy(() => import("@/pages/not-found"));


function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center h-screen w-full">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
    </div>
  );
}

function Router() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <Switch>
        <ProtectedRoute path="/" component={HomePage} />
        <Route path="/auth" component={AuthPage} />

        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ChatProvider>
          <CallProvider>
            <TooltipProvider>
              <Toaster />
              <Router />
              <CallUI />
            </TooltipProvider>
          </CallProvider>
        </ChatProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
