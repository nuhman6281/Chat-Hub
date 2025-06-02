import React from "react";

export default function TestPage() {
  return (
    <div style={{ padding: "20px", maxWidth: "800px", margin: "0 auto" }}>
      <h1 style={{ color: "blue" }}>ChatHub Test Page</h1>
      <p>
        This is a simple test page to verify that routing is working correctly.
      </p>
      <p>If you can see this page, the basic routing is functioning.</p>

      <div
        style={{
          marginTop: "20px",
          padding: "15px",
          backgroundColor: "#f5f5f5",
          borderRadius: "5px",
        }}
      >
        <h2>Debug Information</h2>
        <p>Current URL: {window.location.href}</p>
        <p>Path: {window.location.pathname}</p>
      </div>

      <button
        style={{
          marginTop: "20px",
          padding: "10px 15px",
          backgroundColor: "blue",
          color: "white",
          border: "none",
          borderRadius: "5px",
          cursor: "pointer",
        }}
        onClick={() => alert("Button clicked!")}
      >
        Test Button
      </button>
    </div>
  );
}
