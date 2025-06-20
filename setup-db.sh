#!/bin/bash

# EventSentinel Database Setup Script

echo "🚀 Setting up EventSentinel database with Docker..."

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
    echo "📝 Creating .env file..."
    cat >.env <<EOF
# Database Configuration
DATABASE_URL=postgresql://eventsentinel:eventsentinel123@localhost:5432/eventsentinel

# Development Settings
NODE_ENV=development

# Optional: Add other environment variables as needed
# JWT_SECRET=your-jwt-secret-here
# SESSION_SECRET=your-session-secret-here
EOF
    echo "✅ .env file created"
else
    echo "ℹ️  .env file already exists"
fi

# Start PostgreSQL with Docker Compose
echo "🐳 Starting PostgreSQL container..."
docker compose up -d postgres

# Wait for PostgreSQL to be ready
echo "⏳ Waiting for PostgreSQL to be ready..."
timeout=60
while ! docker exec eventsentinel-postgres pg_isready -U eventsentinel -d eventsentinel >/dev/null 2>&1; do
    timeout=$((timeout - 1))
    if [ $timeout -eq 0 ]; then
        echo "❌ Timeout waiting for PostgreSQL to start"
        exit 1
    fi
    sleep 1
done

echo "✅ PostgreSQL is ready!"

# Run database migrations
echo "🔄 Running database migrations..."
npm run db:push

echo ""
echo "🎉 Database setup complete!"
echo ""
echo "📊 Database Info:"
echo "   Host: localhost"
echo "   Port: 5432"
echo "   Database: eventsentinel"
echo "   Username: eventsentinel"
echo "   Password: eventsentinel123"
echo ""
echo "🚀 You can now run the application:"
echo "   npm run dev:local      (convenient script with all env vars set)"
echo "   OR"
echo "   DATABASE_URL=\"postgresql://eventsentinel:eventsentinel123@localhost:5432/eventsentinel\" PORT=3000 npm run dev"
echo ""
echo "🌐 Open http://localhost:3000 in your browser to access the app"
echo ""
echo "🛑 To stop the database: docker compose down"
echo "🗑️  To remove all data: docker compose down -v"
