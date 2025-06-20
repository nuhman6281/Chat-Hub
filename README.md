# EventSentinel 🛡️

A real-time communication platform with end-to-end encryption, voice/video calls, and collaborative workspaces.

## Features

- 💬 Real-time messaging with channels and direct messages
- 🔐 End-to-end encryption for secure communication
- 🎥 Voice and video calling capabilities (WebRTC)
- 👥 Workspace and channel management
- 🔄 Real-time synchronization via WebSockets
- 🎨 Modern UI built with React and Tailwind CSS
- 📱 Responsive design for all devices

## Quick Start with Docker

### Prerequisites

- [Docker](https://www.docker.com/get-started) installed on your system
- [Node.js](https://nodejs.org/) (version 18 or higher)
- [npm](https://www.npmjs.com/) or [yarn](https://yarnpkg.com/)

### 1. Clone and Setup

```bash
git clone <your-repo-url>
cd EventSentinel
npm install
```

### 2. Database Setup

Run the automated setup script to configure PostgreSQL with Docker:

```bash
./setup-db.sh
```

This script will:

- Create a PostgreSQL container with Docker Compose
- Generate the `.env` file with database credentials
- Run database migrations
- Provide instructions for starting the application

### 3. Start the Application

**Option A: Using the convenient script (recommended)**

```bash
npm run dev:local
```

**Option B: Manual environment variables**

```bash
DATABASE_URL="postgresql://eventsentinel:eventsentinel123@localhost:5432/eventsentinel" PORT=3000 npm run dev
```

### 4. Access the Application

Open your browser and navigate to:

```
http://localhost:3000
```

## Manual Database Setup

If you prefer to set up the database manually:

### Start PostgreSQL Container

```bash
docker compose up -d postgres
```

### Create Environment File

Create a `.env` file in the root directory:

```env
DATABASE_URL=postgresql://eventsentinel:eventsentinel123@localhost:5432/eventsentinel
NODE_ENV=development
PORT=3000
```

### Run Database Migrations

```bash
npm run db:push
```

## Available Scripts

- `npm run dev` - Start development server (requires DATABASE_URL env var)
- `npm run dev:local` - Start development server with local database
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run check` - Type check TypeScript
- `npm run db:push` - Push database schema changes

## Database Management

### Stop the Database

```bash
docker compose down
```

### Remove Database Data

```bash
docker compose down -v
```

### View Database Logs

```bash
docker logs eventsentinel-postgres
```

### Connect to Database

```bash
docker exec -it eventsentinel-postgres psql -U eventsentinel -d eventsentinel
```

## Database Configuration

The application uses PostgreSQL with the following default settings:

- **Host:** localhost
- **Port:** 5432
- **Database:** eventsentinel
- **Username:** eventsentinel
- **Password:** eventsentinel123

## Troubleshooting

### Port 5000 Already in Use

On macOS, port 5000 is often used by AirPlay. The application is configured to use port 3000 by default.

### Database Connection Issues

1. Ensure PostgreSQL container is running: `docker ps`
2. Check container logs: `docker logs eventsentinel-postgres`
3. Verify database credentials in `.env` file

### Environment Variables Not Loading

Use the `npm run dev:local` script which includes all necessary environment variables.

## Development

### Project Structure

- `client/` - React frontend application
- `server/` - Express.js backend API
- `shared/` - Shared types and schemas
- `docker-compose.yml` - PostgreSQL database configuration

### Tech Stack

**Frontend:**

- React 18
- TypeScript
- Tailwind CSS
- Radix UI Components
- Framer Motion
- WebRTC for calling

**Backend:**

- Node.js
- Express.js
- TypeScript
- WebSockets (ws)
- Drizzle ORM

**Database:**

- PostgreSQL 16
- Drizzle migrations

### Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests and type checking
5. Submit a pull request

## License

MIT License - see LICENSE file for details
