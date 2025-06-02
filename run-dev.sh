#!/bin/bash

# Set environment variables
export DATABASE_URL="postgres://postgres:postgres@localhost:5432/event_sentinel"
export SESSION_SECRET="event-sentinel-secret-key"
export JWT_SECRET="event-sentinel-jwt-secret-key"
export NODE_ENV="development"
export PORT=3001

# Check if Docker is installed
if ! command -v docker &>/dev/null; then
    echo "Docker is not installed or not in your PATH. Please install Docker first."
    exit 1
fi

# Check if PostgreSQL container is running
POSTGRES_CONTAINER_RUNNING=$(docker ps -q -f name=postgres-event-sentinel)
if [ -z "$POSTGRES_CONTAINER_RUNNING" ]; then
    # Check if container exists but stopped
    POSTGRES_CONTAINER_EXISTS=$(docker ps -aq -f name=postgres-event-sentinel)
    if [ -n "$POSTGRES_CONTAINER_EXISTS" ]; then
        echo "Starting existing PostgreSQL container..."
        docker start postgres-event-sentinel
    else
        echo "Creating and starting PostgreSQL container..."
        docker run --name postgres-event-sentinel -e POSTGRES_PASSWORD=postgres -e POSTGRES_USER=postgres -p 5432:5432 -d postgres:15

        echo "Waiting for PostgreSQL to start..."
        sleep 10
    fi
fi

# Check if the database exists
echo "Checking if database exists..."
POSTGRES_DB_EXISTS=$(
    docker exec postgres-event-sentinel psql -U postgres -lqt | cut -d \| -f 1 | grep -qw event_sentinel
    echo $?
)
if [ "$POSTGRES_DB_EXISTS" -ne "0" ]; then
    echo "Creating database 'event_sentinel'..."
    docker exec postgres-event-sentinel psql -U postgres -c "CREATE DATABASE event_sentinel"
fi

# Run database migrations
echo "Running database migrations..."
npm run db:push

# Start the development server
echo "Starting development server on port 3001..."
npm run dev
