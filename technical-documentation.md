# Technical Documentation - Chat Application

## Overview
A comprehensive cross-platform communication application designed for seamless, secure, and interactive messaging experiences. Built with React TypeScript frontend, Express.js backend with real-time WebSocket communication, and WebRTC integration for voice/video calls.

## Architecture

### Technology Stack
- **Frontend**: React 18 + TypeScript + Vite
- **Backend**: Node.js + Express.js + TypeScript
- **Real-time Communication**: WebSocket (ws library)
- **Database**: PostgreSQL with Drizzle ORM (configurable to in-memory storage)
- **Authentication**: Passport.js with local strategy + JWT tokens
- **UI Framework**: Tailwind CSS + shadcn/ui components
- **State Management**: TanStack Query (React Query) + Context API
- **Routing**: Wouter
- **Form Handling**: React Hook Form + Zod validation
- **Video/Audio**: WebRTC integration

### Project Structure
```
├── client/                    # Frontend React application
│   ├── src/
│   │   ├── components/       # Reusable UI components
│   │   │   ├── ui/          # shadcn/ui base components
│   │   │   ├── chat/        # Chat-specific components
│   │   │   └── CallUI.tsx   # Video/audio call interface
│   │   ├── contexts/        # React context providers
│   │   │   └── ChatContext.tsx
│   │   ├── hooks/           # Custom React hooks
│   │   │   └── use-auth.tsx
│   │   ├── lib/             # Utility functions and configs
│   │   │   ├── socket.ts    # WebSocket client management
│   │   │   └── queryClient.ts
│   │   ├── pages/           # Application pages
│   │   │   ├── Home.tsx     # Main chat interface
│   │   │   └── auth-page.tsx
│   │   └── App.tsx          # Main application component
├── server/                   # Backend Express application
│   ├── auth.ts              # Authentication logic
│   ├── db.ts                # Database connection
│   ├── index.ts             # Server entry point
│   ├── routes.ts            # API routes and WebSocket handling
│   ├── storage.ts           # Data persistence layer
│   └── vite.ts              # Vite integration
├── shared/                   # Shared types and schemas
│   └── schema.ts            # Drizzle schemas and types
└── package.json             # Dependencies and scripts
```

## Core Features

### 1. Authentication System
- **Local username/password authentication**
- **JWT token-based sessions**
- **Passport.js integration**
- **Protected routes with middleware**

#### Authentication Flow
1. User submits credentials via `/auth` page
2. Server validates against database/storage
3. JWT token generated and stored in session
4. Protected API endpoints verify authentication
5. WebSocket connections authenticate using userId

#### API Endpoints
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `GET /api/auth/user` - Get current user info

### 2. Real-time Messaging System

#### WebSocket Architecture
- **Connection Management**: Single WebSocket per user with reconnection logic
- **Authentication**: Users authenticate WebSocket with userId
- **Message Broadcasting**: Channel-based and direct message routing
- **Connection Health**: Ping/pong heartbeat every 30 seconds

#### Message Flow
1. User types message in input field
2. Frontend sends via WebSocket: `{type: 'message', payload: {...}}`
3. Server validates user permissions for channel/DM
4. Message stored in database/memory
5. Server broadcasts to all channel members: `{type: 'new_message', payload: message}`
6. Frontend receives and displays message in real-time

#### Message Types
- **Text Messages**: Basic text communication
- **Media Messages**: File/image sharing with metadata
- **Reactions**: Emoji reactions to messages
- **Replies**: Threaded message responses

### 3. Workspace & Channel Management

#### Data Models
```typescript
// Workspace
{
  id: number,
  name: string,
  ownerId: number,
  createdAt: Date
}

// Channel
{
  id: number,
  name: string,
  workspaceId: number,
  isPrivate: boolean,
  createdAt: Date
}

// Channel Membership
{
  id: number,
  channelId: number,
  userId: number,
  joinedAt: Date
}
```

#### API Endpoints
- `POST /api/workspaces` - Create workspace
- `GET /api/workspaces` - Get user's workspaces
- `GET /api/workspaces/:id` - Get specific workspace
- `POST /api/channels` - Create channel
- `GET /api/workspaces/:workspaceId/channels` - Get workspace channels
- `GET /api/channels/:id` - Get channel details
- `POST /api/channels/:id/members` - Add channel member
- `GET /api/channels/:id/members` - Get channel members

### 4. Direct Messaging

#### Direct Message Flow
1. User initiates DM with another user
2. System creates/finds existing DM conversation
3. Messages sent through same WebSocket protocol
4. Broadcasting limited to conversation participants

#### API Endpoints
- `POST /api/direct-messages` - Create/get DM conversation
- `GET /api/direct-messages` - Get user's DM conversations
- `GET /api/direct-messages/:id/messages` - Get DM message history
- `POST /api/direct-messages/:id/messages` - Send DM message

### 5. Voice/Video Calling (WebRTC)

#### Call Architecture
- **WebRTC Peer-to-Peer**: Direct audio/video streams between users
- **Signaling Server**: WebSocket-based offer/answer/ICE exchange
- **Call States**: Incoming, outgoing, active, ended
- **Media Controls**: Mute/unmute, video on/off, screen sharing

#### Call Flow
1. User initiates call via UI
2. Server creates call record and notifies participants
3. WebRTC signaling exchange through WebSocket
4. Direct peer-to-peer media stream established
5. Call state managed through React context

#### API Endpoints
- `POST /api/calls/initiate` - Start new call
- `POST /api/calls/signal` - WebRTC signaling exchange

### 6. File Upload & Media Sharing

#### Upload System
- **Endpoint**: `POST /api/upload`
- **File Storage**: Server-side file system
- **Metadata**: File type, size, URL generation
- **Integration**: Messages can include media attachments

### 7. Message Features

#### Enhanced Messaging
- **Message Editing**: Edit previously sent messages
- **Message Reactions**: Add emoji reactions
- **Message Threading**: Reply to specific messages
- **Message Formatting**: Bold, italic, code snippets

#### API Endpoints
- `GET /api/channels/:id/messages` - Get channel message history
- `POST /api/channels/:id/messages` - Send channel message
- `POST /api/messages/:id/react` - Add message reaction

## Data Layer

### Storage Interface
```typescript
interface IStorage {
  // User operations
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUserStatus(id: number, status: string): Promise<User | undefined>;

  // Workspace operations
  createWorkspace(workspace: InsertWorkspace): Promise<Workspace>;
  getWorkspace(id: number): Promise<Workspace | undefined>;
  getWorkspacesByUserId(userId: number): Promise<Workspace[]>;

  // Channel operations
  createChannel(channel: InsertChannel): Promise<Channel>;
  getChannel(id: number): Promise<Channel | undefined>;
  getChannelsByWorkspaceId(workspaceId: number): Promise<ChannelWithMemberCount[]>;

  // Message operations
  createMessage(message: InsertMessage): Promise<MessageWithUser>;
  getMessagesByChannelId(channelId: number): Promise<MessageWithUser[]>;
  getMessagesByDirectMessageId(directMessageId: number): Promise<MessageWithUser[]>;

  // Direct Message operations
  createDirectMessage(dm: InsertDirectMessage): Promise<DirectMessage>;
  getDirectMessage(id: number): Promise<DirectMessage | undefined>;
  getDirectMessageByUserIds(user1Id: number, user2Id: number): Promise<DirectMessage | undefined>;
  getDirectMessagesByUserId(userId: number): Promise<DirectMessageWithUser[]>;

  // Membership operations
  addWorkspaceMember(member: InsertWorkspaceMember): Promise<WorkspaceMember>;
  getWorkspaceMembersByWorkspaceId(workspaceId: number): Promise<(WorkspaceMember & { user: User })[]>;
  isUserInWorkspace(userId: number, workspaceId: number): Promise<boolean>;
  addChannelMember(member: InsertChannelMember): Promise<ChannelMember>;
  getChannelMembersByChannelId(channelId: number): Promise<(ChannelMember & { user: User })[]>;
  isUserInChannel(userId: number, channelId: number): Promise<boolean>;

  // Search operations
  searchUsers(searchTerm: string): Promise<User[]>;

  // Session management
  sessionStore: any;
}
```

### Database Schema (Drizzle ORM)

#### Core Tables
```sql
-- Users
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  display_name VARCHAR(255) NOT NULL,
  status VARCHAR(50) DEFAULT 'offline',
  avatar_url TEXT
);

-- Workspaces
CREATE TABLE workspaces (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  owner_id INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Channels
CREATE TABLE channels (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  workspace_id INTEGER REFERENCES workspaces(id),
  is_private BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Messages
CREATE TABLE messages (
  id SERIAL PRIMARY KEY,
  content TEXT NOT NULL,
  user_id INTEGER REFERENCES users(id),
  channel_id INTEGER REFERENCES channels(id),
  direct_message_id INTEGER REFERENCES direct_messages(id),
  message_type VARCHAR(50) DEFAULT 'text',
  media_url TEXT,
  media_type VARCHAR(100),
  media_size INTEGER,
  reply_to_id INTEGER REFERENCES messages(id),
  is_edited BOOLEAN DEFAULT false,
  edited_at TIMESTAMP,
  reactions JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Direct Messages
CREATE TABLE direct_messages (
  id SERIAL PRIMARY KEY,
  user1_id INTEGER REFERENCES users(id),
  user2_id INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Workspace Members
CREATE TABLE workspace_members (
  id SERIAL PRIMARY KEY,
  workspace_id INTEGER REFERENCES workspaces(id),
  user_id INTEGER REFERENCES users(id),
  role VARCHAR(50) DEFAULT 'member',
  joined_at TIMESTAMP DEFAULT NOW()
);

-- Channel Members
CREATE TABLE channel_members (
  id SERIAL PRIMARY KEY,
  channel_id INTEGER REFERENCES channels(id),
  user_id INTEGER REFERENCES users(id),
  joined_at TIMESTAMP DEFAULT NOW()
);

-- Calls
CREATE TABLE calls (
  id SERIAL PRIMARY KEY,
  type VARCHAR(50) NOT NULL,
  status VARCHAR(50) DEFAULT 'pending',
  caller_id INTEGER REFERENCES users(id),
  workspace_id INTEGER REFERENCES workspaces(id),
  channel_id INTEGER REFERENCES channels(id),
  direct_message_id INTEGER REFERENCES direct_messages(id),
  created_at TIMESTAMP DEFAULT NOW(),
  ended_at TIMESTAMP
);

-- Call Participants
CREATE TABLE call_participants (
  id SERIAL PRIMARY KEY,
  call_id INTEGER REFERENCES calls(id),
  user_id INTEGER REFERENCES users(id),
  joined_at TIMESTAMP DEFAULT NOW(),
  left_at TIMESTAMP
);
```

## WebSocket Protocol

### Message Types

#### Client to Server
```typescript
// Authentication
{
  type: 'auth',
  payload: { userId: number }
}

// Send Message
{
  type: 'message',
  payload: {
    content: string,
    channelId?: number,
    directMessageId?: number,
    messageType: 'text' | 'media',
    mediaUrl?: string,
    mediaType?: string,
    mediaSize?: number
  }
}

// WebRTC Signaling
{
  type: 'call_signal',
  payload: {
    callId: number,
    signal: RTCSessionDescription | RTCIceCandidate
  }
}
```

#### Server to Client
```typescript
// New Message
{
  type: 'new_message',
  payload: MessageWithUser
}

// Message Confirmation
{
  type: 'message_sent',
  messageId: number
}

// Call Events
{
  type: 'incoming_call',
  payload: CallData
}

// Error
{
  type: 'error',
  message: string
}
```

## Frontend Architecture

### State Management
- **TanStack Query**: Server state management and caching
- **React Context**: Global application state (auth, chat, calls)
- **Local State**: Component-specific state with useState/useReducer

### Key Hooks
```typescript
// Authentication
const { user, loginMutation, registerMutation, logoutMutation } = useAuth();

// WebSocket Connection
const { isConnected, sendMessage, onMessage } = useSocket();

// Chat State
const { 
  currentWorkspace, 
  currentChannel, 
  messages, 
  sendMessage,
  activeCall 
} = useChat();
```

### Component Architecture
- **Page Components**: Top-level route components
- **Layout Components**: Navigation, sidebars, main content areas
- **Feature Components**: Chat interface, call UI, message lists
- **UI Components**: Reusable shadcn/ui components
- **Form Components**: Authentication, message input, settings

### Real-time Updates
- WebSocket messages trigger TanStack Query cache updates
- Optimistic updates for immediate UI feedback
- Cache invalidation for data consistency

## API Reference

### Authentication Endpoints
```
POST /api/auth/register
POST /api/auth/login
POST /api/auth/logout
GET  /api/auth/user
```

### Workspace Endpoints
```
POST /api/workspaces
GET  /api/workspaces
GET  /api/workspaces/:id
POST /api/workspaces/:id/members
GET  /api/workspaces/:id/members
```

### Channel Endpoints
```
POST /api/channels
GET  /api/workspaces/:workspaceId/channels
GET  /api/channels/:id
GET  /api/channels/:id/messages
POST /api/channels/:id/messages
POST /api/channels/:id/members
GET  /api/channels/:id/members
```

### Direct Message Endpoints
```
POST /api/direct-messages
GET  /api/direct-messages
GET  /api/direct-messages/:id/messages
POST /api/direct-messages/:id/messages
```

### Call Endpoints
```
POST /api/calls/initiate
POST /api/calls/signal
```

### Utility Endpoints
```
POST /api/upload
GET  /api/users
POST /api/messages/:id/react
```

## Development & Deployment

### Environment Setup
```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Database operations
npm run db:push
npm run db:studio
```

### Environment Variables
```
DATABASE_URL=postgresql://user:password@host:port/database
SESSION_SECRET=your-session-secret
NODE_ENV=development|production
```

### Build & Deployment
```bash
# Build for production
npm run build

# Start production server
npm start
```

### Configuration Options
- **Storage Mode**: Toggle between PostgreSQL and in-memory storage
- **Authentication**: Configurable session settings
- **WebSocket**: Customizable connection parameters
- **File Upload**: Configurable storage paths and limits

## Security Considerations

### Authentication Security
- Password hashing with bcrypt (10 rounds)
- JWT tokens with secure session storage
- Protected API endpoints with middleware
- WebSocket authentication validation

### Data Security
- Input validation with Zod schemas
- SQL injection prevention with parameterized queries
- XSS prevention with content sanitization
- CORS configuration for API access

### Communication Security
- WebSocket connection over WSS in production
- Message content validation
- User permission checks for channels/DMs
- Rate limiting considerations

## Performance Optimizations

### Frontend Optimizations
- React Query caching for API responses
- Optimistic updates for immediate feedback
- Component memoization for expensive renders
- Lazy loading for large message histories

### Backend Optimizations
- Connection pooling for database
- WebSocket connection management
- Message broadcasting efficiency
- Query optimization with indexes

### Real-time Performance
- WebSocket connection health monitoring
- Efficient message routing algorithms
- Memory management for in-memory storage
- Cleanup of inactive connections

## Troubleshooting

### Common Issues
1. **WebSocket Connection Failures**: Check authentication and network connectivity
2. **Message Broadcasting Issues**: Verify channel membership and client connections
3. **Database Connection Errors**: Ensure DATABASE_URL is configured correctly
4. **Authentication Problems**: Check session configuration and JWT settings

### Debug Logging
- Comprehensive WebSocket event logging
- Message flow tracking
- Authentication step debugging
- Database query logging

### Development Tools
- Browser DevTools for WebSocket inspection
- Network tab for API request monitoring
- React DevTools for component debugging
- Database management tools for data inspection

## Future Enhancements

### Planned Features
- **Mobile Applications**: React Native iOS/Android apps
- **Desktop Applications**: Electron cross-platform desktop apps
- **Advanced Search**: Full-text search across messages and files
- **Message Threading**: Nested conversation threads
- **Custom Emojis**: Workspace-specific emoji sets
- **Bot Integration**: API for chatbot integrations
- **Advanced Permissions**: Role-based access control
- **Message Encryption**: End-to-end encryption for sensitive communications

### Scalability Improvements
- **Microservices Architecture**: Service separation for better scaling
- **Message Queue**: Redis/RabbitMQ for message processing
- **Load Balancing**: Multi-instance deployment
- **CDN Integration**: Global content delivery
- **Caching Strategy**: Redis for session and data caching

This documentation provides a comprehensive overview of the chat application architecture, features, and implementation details. For specific implementation questions or advanced configurations, refer to the individual source files and comments within the codebase.