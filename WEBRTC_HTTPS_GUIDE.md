# WebRTC HTTPS Setup Guide

## Why HTTPS is Required

WebRTC applications require secure contexts (HTTPS) to access camera and microphone. This is a browser security requirement that applies when:

- Accessing the application from another device using an IP address
- Running the application on any domain that isn't `localhost` or `127.0.0.1`

## Quick Solutions

### Option 1: Use Local Network with Self-Signed Certificate

1. **Install mkcert** (for creating trusted local certificates):

   ```bash
   # On macOS
   brew install mkcert

   # On Linux
   apt install libnss3-tools
   wget -O mkcert https://github.com/FiloSottile/mkcert/releases/download/v1.4.4/mkcert-v1.4.4-linux-amd64
   chmod +x mkcert
   sudo mv mkcert /usr/local/bin/

   # On Windows
   choco install mkcert
   ```

2. **Create and install local CA**:

   ```bash
   mkcert -install
   ```

3. **Generate certificate for your local IP**:

   ```bash
   # Replace 192.168.1.100 with your actual IP address
   mkcert localhost 127.0.0.1 192.168.1.100 ::1
   ```

4. **Update vite.config.ts** to use HTTPS:

   ```typescript
   import { defineConfig } from "vite";
   import react from "@vitejs/plugin-react";
   import path from "path";
   import fs from "fs";

   export default defineConfig({
     plugins: [react()],
     server: {
       https: {
         key: fs.readFileSync("./localhost+3-key.pem"),
         cert: fs.readFileSync("./localhost+3.pem"),
       },
       host: "0.0.0.0", // Allow external connections
       port: 5173,
     },
     // ... rest of config
   });
   ```

### Option 2: Use ngrok (Easiest)

1. **Install ngrok**:

   ```bash
   npm install -g ngrok
   # or download from https://ngrok.com/
   ```

2. **Run your development server normally**:

   ```bash
   npm run dev
   ```

3. **In another terminal, expose it via HTTPS**:

   ```bash
   ngrok http 3000
   ```

4. **Use the HTTPS URL** provided by ngrok (e.g., `https://abc123.ngrok.io`)

### Option 3: Use localhost Tunneling

1. **Use localtunnel** (simpler alternative to ngrok):
   ```bash
   npm install -g localtunnel
   npm run dev
   # In another terminal:
   lt --port 3000
   ```

## Current Error Fix

The application now includes proper error handling that will show you this message:

```
"Camera/microphone access requires HTTPS. Please use HTTPS or localhost."
```

When you see this error, it means you need to implement one of the solutions above.

## Testing WebRTC Calls

Once you have HTTPS set up:

1. **Same device testing**: Use `https://localhost:3000` in multiple browser tabs
2. **Different device testing**: Use the HTTPS URL (from ngrok/localtunnel) or your local IP with the certificate
3. **Production**: Ensure your production server has valid SSL certificate

## Troubleshooting

- **Certificate not trusted**: Make sure you installed the local CA with `mkcert -install`
- **Still getting errors**: Check browser console for specific WebRTC errors
- **Permission denied**: Allow camera/microphone access in browser settings
- **No devices found**: Check that camera/microphone are connected and not used by other applications

## Development Scripts

You can add these scripts to `package.json` for easier HTTPS development:

```json
{
  "scripts": {
    "dev:https": "NODE_ENV=development HTTPS=true tsx server/index.ts",
    "tunnel": "lt --port 3000"
  }
}
```
