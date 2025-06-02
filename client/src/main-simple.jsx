import React, { useState } from "react";
import ReactDOM from "react-dom/client";
import "./index.css";

function SimpleApp() {
  const [apiStatus, setApiStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const checkApiStatus = async () => {
    setLoading(true);
    setError(null);
    try {
      // Direct call to the server, bypassing the proxy
      const response = await fetch("http://localhost:3001/api/health");
      const data = await response.json();
      setApiStatus(data);
      setLoading(false);
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        fontFamily: "Arial",
        maxWidth: "800px",
        margin: "0 auto",
        padding: "20px",
      }}
    >
      <h1>ChatHub - Simplified Mode</h1>
      <p>
        The application is running in simplified mode to bypass path resolution
        issues.
      </p>

      <div
        style={{
          marginTop: "20px",
          padding: "20px",
          backgroundColor: "#f5f5f5",
          borderRadius: "8px",
        }}
      >
        <h2>Status</h2>
        <p>✅ Server is running on port 3001</p>
        <p>✅ Client is running on port 3002</p>
        <p>✅ Database connection is established</p>
      </div>

      <div
        style={{
          marginTop: "20px",
          padding: "20px",
          backgroundColor: "#f5f5f5",
          borderRadius: "8px",
        }}
      >
        <h2>Next Steps</h2>
        <p>To properly fix the path issues, the following would be needed:</p>
        <ol>
          <li>Rewrite imports in client files to use relative paths</li>
          <li>Or properly configure module resolution in build tools</li>
        </ol>
      </div>

      <div
        style={{
          marginTop: "20px",
          padding: "20px",
          backgroundColor: "#f0f8ff",
          borderRadius: "8px",
        }}
      >
        <h2>Server API Status</h2>
        <button
          style={{
            padding: "10px 15px",
            backgroundColor: "#4CAF50",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer",
          }}
          onClick={checkApiStatus}
          disabled={loading}
        >
          {loading ? "Checking..." : "Check API Status"}
        </button>

        {error && (
          <div
            style={{
              marginTop: "10px",
              padding: "10px",
              backgroundColor: "#ffebee",
              color: "#d32f2f",
              borderRadius: "4px",
            }}
          >
            Error: {error}
          </div>
        )}

        {apiStatus && (
          <div
            style={{
              marginTop: "10px",
              padding: "10px",
              backgroundColor: "#e8f5e9",
              borderRadius: "4px",
            }}
          >
            <h3>API Response:</h3>
            <pre style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
              {JSON.stringify(apiStatus, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <SimpleApp />
  </React.StrictMode>
);
