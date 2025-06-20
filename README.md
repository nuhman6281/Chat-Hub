# EventSentinel 🛡️

A real-time communication platform with end-to-end encryption, voice/video calls, and collaborative workspaces.

## Features

### 💬 **Real-Time Communication**

- Instant messaging with channels and direct messages
- Real-time typing indicators and message status
- File sharing and rich media support
- End-to-end encryption for secure communication

### 🎥 **Professional Video & Voice Calling**

- High-quality WebRTC-based video and audio calls
- **🖥️ Screen sharing with multiple capture options:**
  - Entire screen capture
  - Application window sharing
  - Browser tab sharing
  - Real-time screen share notifications
- Industry-standard call controls (mute, video toggle, volume control)
- Picture-in-picture mode with participant tiles
- Speaker and gallery view modes
- Call recording capabilities (UI ready)
- Professional call UI matching Zoom/Teams standards

### 🔧 **Advanced Call Features**

- Intelligent video stream prioritization
- Screen sharing takes precedence over regular video
- Seamless track replacement without call interruption
- Comprehensive error handling and recovery
- Connection quality indicators
- Real-time call duration tracking
- Professional status indicators and badges

### 👥 **Workspace Management**

- Multi-workspace organization
- Channel-based communication
- User presence and status indicators
- Role-based permissions

### 🛡️ **Security & Reliability**

- End-to-end encryption
- Secure WebRTC connections with STUN servers
- Comprehensive media cleanup and privacy protection
- Automatic reconnection and failover mechanisms
- HTTPS enforcement for production environments

### 🎨 **Modern User Experience**

- Beautiful, responsive UI built with React and Tailwind CSS
- Professional dark theme with smooth animations
- Accessibility-compliant components
- Mobile-responsive design
- Real-time visual feedback and notifications

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

## Screen Sharing & Video Calling

### 🖥️ **Professional Screen Sharing**

EventSentinel includes industry-standard screen sharing capabilities with comprehensive options:

**Sharing Options:**

- **Entire Screen**: Share everything on your display
- **Application Window**: Share a specific application
- **Browser Tab**: Share a single browser tab

**Features:**

- High-quality capture (up to 1920x1080, 30fps)
- Audio capture with echo cancellation
- Real-time participant notifications
- Professional UI controls and status indicators
- Seamless start/stop functionality

**Screen Sharing Controls:**

- Prominent screen share button in call controls
- Professional dropdown with sharing options
- Visual status indicators and overlays
- Quick stop button for active shares
- Error handling and recovery

### 📞 **Video Calling Features**

**Call Management:**

- Initiate video/audio calls with one click
- Professional incoming call interface
- Real-time call status and duration
- Connection quality indicators

**Video Controls:**

- Camera on/off toggle
- Microphone mute/unmute
- Speaker/gallery view modes
- Picture-in-picture thumbnails
- Volume control with slider

**Advanced Features:**

- Intelligent stream prioritization (screen share > video)
- Seamless track replacement
- Comprehensive cleanup and privacy protection
- Auto-reconnection and error recovery

### 🔧 **Technical Implementation**

**WebRTC Architecture:**

- STUN servers for NAT traversal
- ICE candidate exchange
- Secure peer-to-peer connections
- Professional error handling

**Media Management:**

- Automatic track replacement for screen sharing
- Comprehensive stream cleanup
- Privacy-focused media handling
- Cross-browser compatibility

**State Management:**

- React Context for call state
- WebSocket for real-time signaling
- Proper lifecycle management
- Error recovery mechanisms

## Troubleshooting

### Video Calling Issues

**Camera/Microphone Access:**

- Ensure browser permissions are granted
- Use HTTPS for non-localhost access
- Check device availability and settings

**Screen Sharing Problems:**

- Modern browser required (Chrome, Firefox, Safari)
- Permission must be granted for screen capture
- Some browsers may require HTTPS for screen sharing

**Connection Issues:**

- Check network connectivity
- Firewall may block WebRTC traffic
- STUN servers must be accessible

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
