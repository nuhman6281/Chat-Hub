import React, { useRef, useEffect } from "react";
import {
  HashRouter as Router,
  Routes,
  Route,
  Navigate,
  useLocation,
} from "react-router-dom";
import HomePage from "./pages/Home";
import AuthPage from "./pages/auth-page";
import InvitePage from "./pages/InvitePage";
import TestDemo from "./pages/TestDemo";
import TestPage from "./pages/TestPage";
import { AuthProvider } from "./contexts/AuthContext";
import { ChatProvider } from "./contexts/ChatContext";
import { CallProvider } from "./contexts/CallContext";
import { useAuth } from "./contexts/AuthContext";

// ProtectedRoute component that's causing excessive logging
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = React.memo(
  ({ children }) => {
    const { user, isLoading } = useAuth();
    const location = useLocation();
    const path = location.pathname;

    // Use ref to avoid excessive logs
    const prevPathRef = useRef(path);
    const prevUserLoadingRef = useRef({ userId: user?.id, isLoading });

    // Only log when relevant states change
    const hasPathChanged = path !== prevPathRef.current;
    const hasUserStateChanged =
      isLoading !== prevUserLoadingRef.current.isLoading ||
      user?.id !== prevUserLoadingRef.current.userId;

    // Update refs
    useEffect(() => {
      prevPathRef.current = path;
      prevUserLoadingRef.current = { userId: user?.id, isLoading };
    }, [path, user?.id, isLoading]);

    // Only log when things actually change
    if (hasPathChanged || hasUserStateChanged) {
      console.log(
        `ProtectedRoute: Path=${path}, isLoading=${isLoading}, userExists=${!!user}`
      );
    }

    if (isLoading) {
      return <div>Loading...</div>;
    }

    if (!user) {
      return <Navigate to="/auth" state={{ from: location }} replace />;
    }

    // Only log once when rendering children
    if (hasPathChanged || hasUserStateChanged) {
      console.log("ProtectedRoute: User exists, rendering children");
    }

    return <>{children}</>;
  },
  (prevProps, nextProps) => {
    // Custom comparison function to prevent unnecessary re-renders
    return (
      React.Children.count(prevProps.children) ===
      React.Children.count(nextProps.children)
    );
  }
);

function App() {
  return (
    <Router>
      <AuthProvider>
        <ChatProvider>
          <CallProvider>
            <Routes>
              <Route path="/auth" element={<AuthPage />} />
              <Route path="/invite/:token" element={<InvitePage />} />
              <Route path="/join/:token" element={<InvitePage />} />
              <Route path="/demo" element={<TestDemo />} />
              <Route path="/test-page" element={<TestPage />} />

              {/* Chat routes with persistent URLs */}
              <Route
                path="/workspace/:workspaceId/channel/:channelId"
                element={
                  <ProtectedRoute>
                    <HomePage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/workspace/:workspaceId/direct/:userId"
                element={
                  <ProtectedRoute>
                    <HomePage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/workspace/:workspaceId"
                element={
                  <ProtectedRoute>
                    <HomePage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/"
                element={
                  <ProtectedRoute>
                    <HomePage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/test"
                element={
                  <ProtectedRoute>
                    <TestDemo />
                  </ProtectedRoute>
                }
              />
            </Routes>
          </CallProvider>
        </ChatProvider>
      </AuthProvider>
    </Router>
  );
}

export default App;
