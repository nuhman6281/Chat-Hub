import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { WebRTCTester } from "./lib/webrtc-test.ts";
import { WebRTCDebugger } from "./lib/webrtc-debug.ts";

// Make WebRTC utilities available globally for debugging
if (import.meta.env.DEV) {
  (window as any).WebRTCTester = WebRTCTester;
  (window as any).WebRTCDebugger = WebRTCDebugger;
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
