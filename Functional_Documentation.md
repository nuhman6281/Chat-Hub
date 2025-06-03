# ChatHub (EventSentinel) Functional Documentation

This document provides a detailed explanation of each file's purpose and role in the ChatHub/EventSentinel project flow.

## Table of Contents

1. [Overview](#overview)
2. [Configuration Files](#configuration-files)
3. [Scripts and Automation](#scripts-and-automation)
4. [Client-Side (Frontend)](#client-side-frontend)
5. [Server-Side (Backend)](#server-side-backend)
6. [Shared Code](#shared-code)
7. [Deployment and CI/CD](#deployment-and-cicd)
8. [Database Schema](#database-schema)
9. [API Endpoints](#api-endpoints)
10. [WebSocket Implementation](#websocket-implementation)
11. [Authentication Flow](#authentication-flow)
12. [Application Flow](#application-flow)

## Overview

ChatHub (also referred to as EventSentinel) is a real-time chat application featuring workspaces, channels, direct messaging, and user authentication. It's built using a modern web stack with React, TypeScript, Express, and PostgreSQL.

### Key Features

- Real-time messaging via WebSockets
- Workspace and channel management
- Direct messaging between users
- User authentication and session management
- Role-based permissions (owner, admin, member)
- Invitation system for workspaces

### Technology Stack

- **Frontend**: React, TypeScript, Vite, Tailwind CSS, Shadcn UI
- **Backend**: Node.js, Express, TypeScript
- **Database**: PostgreSQL with Drizzle ORM
- **Real-time**: WebSockets (ws library)
- **Authentication**: Passport.js, JWT, express-session
- **Styling**: Tailwind CSS, Shadcn UI components

## Configuration Files

### Root Configuration

- **package.json**: Defines project dependencies, scripts, and metadata. Contains scripts for development, building, and database operations.

- **package-lock.json**: Auto-generated file that locks dependency versions for consistent installations across environments.

- **tsconfig.json**: TypeScript configuration file that specifies compiler options and project settings for TypeScript files.

- **vite.config.ts**: Configures the Vite build tool with plugins, server settings, and build options. Sets up HMR, proxying for WebSockets, and aliases for imports.

- **vercel.json**: Deployment configuration for Vercel platform, defining build steps and routing rules for the application.

- **drizzle.config.ts**: Configuration for Drizzle ORM, specifying database connection, migration output directory, and schema location.

- **tailwind.config.ts**: Tailwind CSS configuration for styling, including theme customization, plugins, and content paths.

- **postcss.config.js**: PostCSS configuration used by Tailwind CSS for processing styles.

- **components.json**: Configuration for Shadcn UI component library, defining styling preferences, file paths, and import aliases.

### IDE and Development Environment

- **.vscode/settings.json**: VS Code editor settings, configuring search behavior for the project.

- **.replit**: Configuration for Replit development environment, defining run commands, hidden files, and deployment settings.

- **.gitignore**: Specifies files and directories that Git should ignore, such as node_modules, build artifacts, and environment-specific files.

## Scripts and Automation

- **run.sh**: Main script that sets up the development environment:

  - Stops existing Node processes
  - Sets environment variables
  - Manages PostgreSQL Docker container
  - Creates database if needed
  - Runs migrations
  - Starts both server and client in development mode

- **run-client.sh**: Script focused on starting just the client application.

- **run-dev.sh**: Script for starting the development environment, likely with specific configurations.

## Client-Side (Frontend)

### Core Files

- **client/index.html**: Main HTML entry point for the React application.

- **client/index-simple.html**: Simplified HTML entry point, possibly for testing or minimal setup.

- **client/vite.config.js** and **client/vite.config.ts**: Client-specific Vite configurations.

- **client/tsconfig.json**: TypeScript configuration specific to the client application.

- **client/package.json**: Client-specific dependencies and scripts.

- **client/tailwind.config.js**: Tailwind CSS configuration for the client.

- **client/vite-client-patch.js**: Custom patch for Vite client behavior.

### Frontend Components

#### Layout Components

- **client/src/components/layout/Header.tsx**: Main application header component that includes:
  - User profile dropdown
  - Theme toggle
  - Notifications
  - Mobile menu toggle

#### UI Components (Shadcn UI)

The application uses Shadcn UI components, which are built on top of Radix UI primitives:

- **client/src/components/ui/accordion.tsx**: Collapsible content panels.
- **client/src/components/ui/button.tsx**: Various button styles and variants.
- **client/src/components/ui/card.tsx**: Card layout components with header, content, and footer.
- **client/src/components/ui/input.tsx**: Text input fields.
- **client/src/components/ui/select.tsx**: Dropdown selection components.
- **client/src/components/ui/dialog.tsx**: Modal dialogs.
- **client/src/components/ui/dropdown-menu.tsx**: Dropdown menus.
- **client/src/components/ui/avatar.tsx**: User avatars.
- **client/src/components/ui/calendar.tsx**: Date picker calendar.
- **client/src/components/ui/input-otp.tsx**: One-time password input.
- **client/src/components/ui/pagination.tsx**: Pagination controls.

#### Page Components

- **client/src/pages/Home.tsx**: Main application dashboard showing workspaces, channels, and messages.
- **client/src/pages/Login.tsx**: User login page.
- **client/src/pages/Register.tsx**: User registration page.
- **client/src/pages/TestDemo.tsx**: Demo page for testing features.

#### Context Providers

- **client/src/contexts/AuthContext.tsx**: Manages user authentication state.
- **client/src/contexts/ThemeContext.tsx**: Manages application theme (light/dark).
- **client/src/contexts/ChatContext.tsx**: Manages chat-related state.

### Client-Side Libraries

- **client/src/lib/socket.ts**: WebSocket client implementation for real-time messaging.
- **client/src/lib/api.ts**: API client for making requests to the backend.
- **client/src/lib/utils.ts**: Utility functions used throughout the application.
- **client/src/lib/queryClient.ts**: React Query client configuration.

### Client API Calls

The frontend makes the following API calls to interact with the backend:

#### Authentication API Calls

- **Login**: `POST /api/auth/login`

  - Payload: `{ username, password }`
  - Response: User data and authentication token

- **Register**: `POST /api/auth/register`

  - Payload: `{ username, password, displayName, email }`
  - Response: User data and authentication token

- **Logout**: `POST /api/auth/logout`

  - Response: Success message

- **Get Current User**: `GET /api/auth/user`
  - Response: Current user data

#### Workspace API Calls

- **Create Workspace**: `POST /api/workspaces`

  - Payload: `{ name, iconText }`
  - Response: Created workspace data

- **Get Workspaces**: `GET /api/workspaces`

  - Response: List of workspaces the user belongs to

- **Get Workspace**: `GET /api/workspaces/:id`

  - Response: Specific workspace data

- **Get Workspace Members**: `GET /api/workspaces/:workspaceId/members`

  - Response: List of workspace members

- **Update Member Role**: `PUT /api/workspaces/:workspaceId/members/:memberUserId`

  - Payload: `{ role }`
  - Response: Updated member data

- **Remove Member**: `DELETE /api/workspaces/:workspaceId/members/:memberUserId`

  - Response: Success message

- **Invite Member**: `POST /api/workspaces/:workspaceId/invite`
  - Payload: `{ email, role }`
  - Response: Invitation data

#### Channel API Calls

- **Create Channel**: `POST /api/channels`

  - Payload: `{ name, workspaceId, description, isPrivate }`
  - Response: Created channel data

- **Get Workspace Channels**: `GET /api/workspaces/:workspaceId/channels`

  - Response: List of channels in workspace

- **Get Channel**: `GET /api/channels/:id`

  - Response: Specific channel data

- **Get Channel Messages**: `GET /api/channels/:id/messages`

  - Response: List of messages in channel

- **Join Channel**: `POST /api/channels/:id/join`
  - Response: Channel member data

#### Direct Message API Calls

- **Create Direct Message**: `POST /api/direct-messages`

  - Payload: `{ userId }`
  - Response: Direct message conversation data

- **Get Direct Messages**: `GET /api/direct-messages`

  - Response: List of direct message conversations

- **Get Direct Message Messages**: `GET /api/direct-messages/:id/messages`
  - Response: List of messages in direct message conversation

#### User API Calls

- **Search Users**: `GET /api/users?search=query`
  - Response: List of users matching search query

## Server-Side (Backend)

### Core Files

- **server/index.ts**: Main entry point for the Express server:

  - Sets up Express application
  - Configures middleware
  - Initializes database connection
  - Sets up authentication
  - Registers routes
  - Configures WebSocket server

- **server/routes.ts**: Defines API endpoints and request handlers for the application. Contains WebSocket server implementation for real-time messaging.

- **server/auth.ts**: Implements authentication logic using Passport.js, including user registration, login, and session management.

- **server/storage.ts**: Contains database operations and data access logic. Implements CRUD operations for all entities.

- **server/db.ts**: Establishes and manages database connection.

- **server/types.ts**: TypeScript type definitions for server-side code.

- **server/health.ts**: Endpoints for health checks and monitoring.

- **server/vite.ts**: Server-side Vite configuration for development.

- **server/prod.ts** and **server/production.ts**: Entry points and configuration for production deployment.

- **server/tsconfig.json**: TypeScript configuration specific to the server.

### Build Output

- **server/dist/**: Compiled server-side code for production.

## Shared Code

- **shared/schema.ts**: Database schema definitions using Drizzle ORM, shared between client and server for type consistency. Defines all database tables and relationships:
  - Users
  - Workspaces
  - Workspace Members
  - Channels
  - Channel Members
  - Messages
  - Direct Messages
  - Workspace Invitations

## Deployment and CI/CD

- **.vercel/**: Vercel deployment configuration and cache.

- **generated-icon.png**: Application icon for various platforms and environments.

## Database Schema

The application uses PostgreSQL with Drizzle ORM. The schema includes the following tables:

### Users Table

```typescript
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  displayName: text("display_name").notNull(),
  status: text("status").default("offline").notNull(),
  avatarUrl: text("avatar_url"),
});
```

### Workspaces Table

```typescript
export const workspaces = pgTable("workspaces", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  ownerId: integer("owner_id").notNull(),
  iconText: text("icon_text").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
```

### Workspace Members Table

```typescript
export const workspaceMembers = pgTable("workspace_members", {
  id: serial("id").primaryKey(),
  workspaceId: integer("workspace_id").notNull(),
  userId: integer("user_id").notNull(),
  role: text("role").default("member").notNull(),
});
```

### Channels Table

```typescript
export const channels = pgTable("channels", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  workspaceId: integer("workspace_id").notNull(),
  description: text("description"),
  isPrivate: boolean("is_private").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
```

### Channel Members Table

```typescript
export const channelMembers = pgTable("channel_members", {
  id: serial("id").primaryKey(),
  channelId: integer("channel_id").notNull(),
  userId: integer("user_id").notNull(),
});
```

### Messages Table

```typescript
export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  content: text("content").notNull(),
  userId: integer("user_id").notNull(),
  channelId: integer("channel_id"),
  directMessageId: integer("direct_message_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
```

### Direct Messages Table

```typescript
export const directMessages = pgTable("direct_messages", {
  id: serial("id").primaryKey(),
  user1Id: integer("user1_id").notNull(),
  user2Id: integer("user2_id").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
```

### Workspace Invitations Table

```typescript
export const workspaceInvitations = pgTable("workspace_invitations", {
  id: serial("id").primaryKey(),
  workspaceId: integer("workspace_id").notNull(),
  invitedByUserId: integer("invited_by_user_id").notNull(),
  email: text("email").notNull(),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
```

## API Endpoints

### Authentication Endpoints

- `POST /api/auth/register`: Register a new user
- `POST /api/auth/login`: Log in a user
- `POST /api/auth/logout`: Log out the current user
- `GET /api/auth/user`: Get the current authenticated user

### Workspace Endpoints

- `POST /api/workspaces`: Create a new workspace
- `GET /api/workspaces`: Get all workspaces for the current user
- `GET /api/workspaces/:id`: Get a specific workspace
- `GET /api/workspaces/:workspaceId/members`: Get members of a workspace
- `POST /api/workspaces/:workspaceId/members`: Add a member to a workspace
- `PUT /api/workspaces/:workspaceId/members/:memberUserId`: Update a member's role
- `DELETE /api/workspaces/:workspaceId/members/:memberUserId`: Remove a member from a workspace
- `POST /api/workspaces/:workspaceId/invite`: Invite a user to a workspace
- `GET /api/invites/verify/:token`: Verify an invitation token
- `POST /api/invites/accept/:token`: Accept an invitation

### Channel Endpoints

- `POST /api/channels`: Create a new channel
- `GET /api/workspaces/:workspaceId/channels`: Get all channels in a workspace
- `GET /api/channels/:id`: Get a specific channel
- `GET /api/channels/:id/messages`: Get messages in a channel
- `POST /api/channels/:id/join`: Join a channel

### Direct Message Endpoints

- `POST /api/direct-messages`: Create a direct message conversation
- `GET /api/direct-messages`: Get all direct message conversations for the current user
- `GET /api/direct-messages/:id/messages`: Get messages in a direct message conversation

### User Endpoints

- `GET /api/users?search=query`: Search for users

### Development/Demo Endpoints

- `GET /api/demo/status`: Get application status (development mode only)
- `POST /api/demo/login`: Quick login for development (development mode only)

## WebSocket Implementation

### Server-Side WebSocket

The server uses the `ws` library to implement WebSocket functionality:

```typescript
// Set up WebSocket server
const wss = new WebSocketServer({ server: httpServer, path: "/api/ws" });
const clients: ConnectedClient[] = [];

// Handle new WebSocket connections
wss.on("connection", (ws, req) => {
  // Connection handling logic
  // Authentication
  // Message handling
  // Error handling
});
```

The WebSocket server handles:

- Client authentication
- Message broadcasting to channels and direct messages
- Typing indicators
- Connection management
- Error handling

### Client-Side WebSocket

The client implements a WebSocket client in `client/src/lib/socket.ts`:

```typescript
export const createSocket = (): Socket => {
  let socket: WebSocket | null = null;
  // Connection management
  // Authentication
  // Message sending/receiving
  // Reconnection logic
  // Error handling
};
```

The client WebSocket implementation handles:

- Connection to server
- Authentication
- Message sending
- Message receiving
- Reconnection with exponential backoff
- Error handling

## Authentication Flow

1. **Registration**:

   - User submits registration form with username, password, email, and display name
   - Client sends `POST /api/auth/register` request
   - Server validates input, checks for existing users
   - Password is hashed using bcrypt
   - User is created in database
   - Session is created and JWT token is generated
   - User is logged in automatically

2. **Login**:

   - User submits login form with username and password
   - Client sends `POST /api/auth/login` request
   - Server authenticates using Passport.js LocalStrategy
   - Session is created and JWT token is generated
   - User status is set to "online"

3. **Session Management**:

   - Sessions are stored in PostgreSQL using connect-pg-simple
   - JWT tokens provide alternative authentication method
   - Sessions expire after 24 hours

4. **Logout**:
   - User clicks logout
   - Client sends `POST /api/auth/logout` request
   - User status is set to "offline"
   - Session is destroyed

## Application Flow

### Development Flow

1. **Environment Setup**:

   - `run.sh` initializes the development environment
   - Sets environment variables and starts database
   - Runs migrations to set up database schema

2. **Server Initialization**:

   - `server/index.ts` starts Express server
   - Connects to database using `db.ts`
   - Sets up authentication with `auth.ts`
   - Registers API routes from `routes.ts`
   - Initializes WebSocket server for real-time communication

3. **Client Initialization**:
   - Vite dev server starts using `client/vite.config.ts`
   - React application loads from `client/index.html`
   - Components render and establish connection to backend

### Authentication Flow

1. User submits login/register form
2. Client sends credentials to authentication endpoints
3. `server/auth.ts` validates credentials and creates session
4. Session cookie or JWT is returned to client
5. Client stores authentication token for subsequent requests

### Messaging Flow

1. User sends message through client interface
2. Client sends message via WebSocket:
   ```javascript
   socket.send({
     type: "message",
     content: "Hello world",
     channelId: 1, // or directMessageId for DMs
   });
   ```
3. Server processes message in WebSocket handler
4. Server stores message using functions in `storage.ts`
5. Server broadcasts message to relevant users via WebSocket
6. Receiving clients update UI with new message

### Workspace and Channel Management Flow

1. User creates workspace

   - Client sends `POST /api/workspaces` request
   - Server creates workspace and adds user as owner
   - Client updates UI with new workspace

2. User creates channel

   - Client sends `POST /api/channels` request
   - Server creates channel and adds user as member
   - Client updates UI with new channel

3. User invites member to workspace
   - Client sends `POST /api/workspaces/:id/invite` request
   - Server generates invitation token and sends email
   - Invited user clicks link and accepts invitation
   - Server adds user to workspace

### Database Operations Flow

1. API endpoints or WebSocket handlers receive requests
2. Server code calls functions in `storage.ts`
3. Storage functions use Drizzle ORM with schema from `shared/schema.ts`
4. Database operations are executed on PostgreSQL
5. Results are returned to the requesting handler
6. Handler formats and sends response to client

### Build and Deployment Flow

1. `npm run build` compiles both client and server code
2. Client assets are built to static files
3. Server code is compiled to JavaScript
4. For Vercel deployment, `vercel.json` configures build and routing
5. Production server serves static assets and API endpoints
