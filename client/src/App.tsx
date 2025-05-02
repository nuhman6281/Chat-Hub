import React from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  useLocation,
} from "react-router-dom";
import HomePage from "./pages/Home";
import AuthPage from "./pages/auth-page";
import InvitePage from "./pages/InvitePage";
import TestDemo from "./pages/TestDemo";
import { AuthProvider } from "./contexts/AuthContext";
import { ChatProvider } from "./contexts/ChatContext";
import { CallProvider } from "./contexts/CallContext";
import { useAuth } from "./contexts/AuthContext";

// Protected route component
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  console.log(
    `ProtectedRoute: Path=${
      location.pathname
    }, isLoading=${isLoading}, userExists=${!!user}`
  );

  // Show loading state or redirect if not authenticated
  if (isLoading) {
    console.log("ProtectedRoute: Showing Loading...");
    return <div>Loading...</div>;
  }
  if (!user) {
    console.log("ProtectedRoute: No user, redirecting to /auth");
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  console.log("ProtectedRoute: User exists, rendering children");
  return <>{children}</>;
};

function App() {
  return (
    <Router>
      <AuthProvider>
        <ChatProvider>
          <CallProvider>
            <Routes>
              <Route path="/auth" element={<AuthPage />} />
              <Route path="/invite/:token" element={<InvitePage />} />
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
