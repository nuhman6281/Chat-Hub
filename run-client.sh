#!/bin/bash

# Kill any existing Node.js processes in the client directory
echo "Stopping any running client processes..."
pkill -f "vite" || true

# Change to the client directory
cd client || exit

# Set environment variables
export VITE_API_URL="http://localhost:3001"
export DEBUG=vite:resolve

# Run the client
echo "Starting client development server..."
npm run dev -- --debug
