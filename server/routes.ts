import express, { type Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { z } from "zod";
import { 
  insertUserSchema,
  insertWorkspaceSchema,
  insertChannelSchema,
  insertMessageSchema,
  insertDirectMessageSchema,
  insertWorkspaceMemberSchema,
  insertChannelMemberSchema,
  type MessageWithUser
} from "@shared/schema";
import session from "express-session";
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import bcrypt from "bcrypt";
import MemoryStore from "memorystore";

// WebSocket client map
interface ConnectedClient {
  userId: number;
  ws: WebSocket;
}

export async function registerRoutes(app: Express): Promise<Server> {
  const SessionStore = MemoryStore(session);
  const sessionStore = new SessionStore({
    checkPeriod: 86400000 // 24 hours
  });

  // Configure session middleware
  app.use(
    session({
      secret: process.env.SESSION_SECRET || "chatHub-secret-key",
      resave: false,
      saveUninitialized: false,
      cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 }, // 24 hours
      store: sessionStore
    })
  );

  // Initialize passport
  app.use(passport.initialize());
  app.use(passport.session());

  // Configure passport local strategy
  passport.use(
    new LocalStrategy(async (username, password, done) => {
      try {
        const user = await storage.getUserByUsername(username);
        if (!user) {
          return done(null, false, { message: "Incorrect username." });
        }

        // For our demo user, allow a simple password check
        if (user.username === "demo" && password === "password") {
          // Update user status to online
          await storage.updateUserStatus(user.id, "online");
          return done(null, user);
        }
        
        // For regular users, use proper password verification
        const passwordMatch = user.password === password;
        if (!passwordMatch) {
          return done(null, false, { message: "Incorrect password." });
        }
        // Update user status to online
        await storage.updateUserStatus(user.id, "online");
        return done(null, user);
      } catch (err) {
        return done(err);
      }
    })
  );

  passport.serializeUser((user: any, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id: number, done) => {
    try {
      const user = await storage.getUser(id);
      done(null, user);
    } catch (err) {
      done(err);
    }
  });

  // Create HTTP server
  const httpServer = createServer(app);

  // Set up WebSocket server
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });
  const clients: ConnectedClient[] = [];

  wss.on('connection', (ws) => {
    let userId: number | null = null;

    ws.on('message', async (message) => {
      try {
        const data = JSON.parse(message.toString());

        if (data.type === 'auth') {
          // Authenticate the WebSocket connection
          const user = await storage.getUser(data.userId);
          if (user) {
            userId = user.id;
            clients.push({ userId: user.id, ws });
            console.log(`WebSocket authenticated for user: ${user.username}`);
            
            // Send confirmation back to the client
            ws.send(JSON.stringify({ type: 'auth_success', userId: user.id }));
          }
        } else if (data.type === 'message' && userId) {
          // Handle new chat message
          if (data.channelId) {
            // Channel message
            const isUserInChannel = await storage.isUserInChannel(userId, data.channelId);
            if (!isUserInChannel) {
              ws.send(JSON.stringify({ 
                type: 'error', 
                message: 'You are not a member of this channel' 
              }));
              return;
            }

            const message = await storage.createMessage({
              content: data.content,
              userId,
              channelId: data.channelId,
              directMessageId: undefined
            });

            // Broadcast to all clients in the channel
            broadcastToChannel(data.channelId, message);
          } else if (data.directMessageId) {
            // Direct message
            const dm = await storage.getDirectMessage(data.directMessageId);
            if (!dm || (dm.user1Id !== userId && dm.user2Id !== userId)) {
              ws.send(JSON.stringify({ 
                type: 'error', 
                message: 'Invalid direct message conversation' 
              }));
              return;
            }

            const message = await storage.createMessage({
              content: data.content,
              userId,
              channelId: undefined,
              directMessageId: data.directMessageId
            });

            // Send to both participants
            broadcastToDirectMessage(data.directMessageId, message);
          }
        } else if (data.type === 'typing' && userId) {
          // Handle typing indicator
          const typingData = {
            type: 'typing',
            userId,
            channelId: data.channelId,
            directMessageId: data.directMessageId,
            isTyping: data.isTyping
          };

          if (data.channelId) {
            broadcastToChannel(data.channelId, typingData);
          } else if (data.directMessageId) {
            broadcastToDirectMessage(data.directMessageId, typingData);
          }
        }
      } catch (error) {
        console.error('WebSocket message error:', error);
      }
    });

    ws.on('close', async () => {
      if (userId) {
        // Remove client from connected clients
        const index = clients.findIndex(client => client.userId === userId);
        if (index !== -1) {
          clients.splice(index, 1);
        }

        // Check if user has no other active connections
        const userConnections = clients.filter(client => client.userId === userId);
        if (userConnections.length === 0) {
          // Update user status to offline if they have no other active connections
          await storage.updateUserStatus(userId, "offline");
        }
      }
    });
  });

  // Helper functions for broadcasting messages
  function broadcastToChannel(channelId: number, data: any) {
    storage.getChannelMembersByChannelId(channelId).then(members => {
      const memberIds = members.map(member => member.userId);
      clients.forEach(client => {
        if (memberIds.includes(client.userId) && client.ws.readyState === WebSocket.OPEN) {
          client.ws.send(JSON.stringify({
            type: data.type || 'message',
            data
          }));
        }
      });
    });
  }

  function broadcastToDirectMessage(directMessageId: number, data: any) {
    storage.getDirectMessage(directMessageId).then(dm => {
      if (dm) {
        clients.forEach(client => {
          if ((client.userId === dm.user1Id || client.userId === dm.user2Id) && 
              client.ws.readyState === WebSocket.OPEN) {
            client.ws.send(JSON.stringify({
              type: data.type || 'message',
              data
            }));
          }
        });
      }
    });
  }

  // Authentication endpoints
  app.post('/api/auth/register', async (req: Request, res: Response) => {
    try {
      const validatedData = insertUserSchema.parse(req.body);
      
      // Check if username already exists
      const existingUser = await storage.getUserByUsername(validatedData.username);
      if (existingUser) {
        return res.status(400).json({ message: 'Username already exists' });
      }
      
      const user = await storage.createUser(validatedData);
      
      // Auto-login after registration
      req.login(user, (err) => {
        if (err) {
          return res.status(500).json({ message: 'Login failed after registration' });
        }
        // Return user without password
        const { password, ...userWithoutPassword } = user;
        return res.status(201).json(userWithoutPassword);
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Invalid user data', errors: error.errors });
      }
      return res.status(500).json({ message: 'Registration failed' });
    }
  });

  app.post('/api/auth/login', passport.authenticate('local'), (req: Request, res: Response) => {
    // If we get here, authentication was successful
    if (req.user) {
      const { password, ...userWithoutPassword } = req.user as any;
      res.json(userWithoutPassword);
    } else {
      res.status(401).json({ message: 'Authentication failed' });
    }
  });

  app.post('/api/auth/logout', (req: Request, res: Response) => {
    if (req.user) {
      const userId = (req.user as any).id;
      storage.updateUserStatus(userId, "offline").then(() => {
        req.logout((err) => {
          if (err) {
            return res.status(500).json({ message: 'Logout failed' });
          }
          res.json({ message: 'Logged out successfully' });
        });
      });
    } else {
      res.json({ message: 'No user to log out' });
    }
  });

  app.get('/api/auth/user', (req: Request, res: Response) => {
    if (req.isAuthenticated()) {
      const { password, ...userWithoutPassword } = req.user as any;
      res.json(userWithoutPassword);
    } else {
      res.status(401).json({ message: 'Not authenticated' });
    }
  });

  // Workspaces
  app.post('/api/workspaces', ensureAuthenticated, async (req: Request, res: Response) => {
    try {
      const validatedData = insertWorkspaceSchema.parse({
        ...req.body,
        ownerId: (req.user as any).id
      });
      
      const workspace = await storage.createWorkspace(validatedData);
      res.status(201).json(workspace);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Invalid workspace data', errors: error.errors });
      }
      res.status(500).json({ message: 'Failed to create workspace' });
    }
  });

  app.get('/api/workspaces', ensureAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = (req.user as any).id;
      const workspaces = await storage.getWorkspacesByUserId(userId);
      res.json(workspaces);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch workspaces' });
    }
  });

  app.get('/api/workspaces/:id', ensureAuthenticated, async (req: Request, res: Response) => {
    try {
      const workspaceId = parseInt(req.params.id);
      const userId = (req.user as any).id;
      
      // Check if user is a member of the workspace
      const isMember = await storage.isUserInWorkspace(userId, workspaceId);
      if (!isMember) {
        return res.status(403).json({ message: 'You do not have access to this workspace' });
      }
      
      const workspace = await storage.getWorkspace(workspaceId);
      if (!workspace) {
        return res.status(404).json({ message: 'Workspace not found' });
      }
      
      res.json(workspace);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch workspace' });
    }
  });

  // Channels
  app.post('/api/channels', ensureAuthenticated, async (req: Request, res: Response) => {
    try {
      const validatedData = insertChannelSchema.parse(req.body);
      const userId = (req.user as any).id;
      
      // Check if user is a member of the workspace
      const isMember = await storage.isUserInWorkspace(userId, validatedData.workspaceId);
      if (!isMember) {
        return res.status(403).json({ message: 'You do not have access to this workspace' });
      }
      
      const channel = await storage.createChannel(validatedData);
      
      // Add the creator to the channel
      await storage.addChannelMember({
        channelId: channel.id,
        userId
      });
      
      res.status(201).json(channel);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Invalid channel data', errors: error.errors });
      }
      res.status(500).json({ message: 'Failed to create channel' });
    }
  });

  app.get('/api/workspaces/:workspaceId/channels', ensureAuthenticated, async (req: Request, res: Response) => {
    try {
      const workspaceId = parseInt(req.params.workspaceId);
      const userId = (req.user as any).id;
      
      // Check if user is a member of the workspace
      const isMember = await storage.isUserInWorkspace(userId, workspaceId);
      if (!isMember) {
        return res.status(403).json({ message: 'You do not have access to this workspace' });
      }
      
      const channels = await storage.getChannelsByWorkspaceId(workspaceId);
      res.json(channels);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch channels' });
    }
  });

  app.get('/api/channels/:id', ensureAuthenticated, async (req: Request, res: Response) => {
    try {
      const channelId = parseInt(req.params.id);
      const userId = (req.user as any).id;
      
      // Get the channel
      const channel = await storage.getChannel(channelId);
      if (!channel) {
        return res.status(404).json({ message: 'Channel not found' });
      }
      
      // Check if user is a member of the channel's workspace
      const isMember = await storage.isUserInWorkspace(userId, channel.workspaceId);
      if (!isMember) {
        return res.status(403).json({ message: 'You do not have access to this channel' });
      }
      
      res.json(channel);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch channel' });
    }
  });

  app.get('/api/channels/:id/messages', ensureAuthenticated, async (req: Request, res: Response) => {
    try {
      const channelId = parseInt(req.params.id);
      const userId = (req.user as any).id;
      
      // Get the channel
      const channel = await storage.getChannel(channelId);
      if (!channel) {
        return res.status(404).json({ message: 'Channel not found' });
      }
      
      // Check if user is a member of the channel's workspace
      const isMember = await storage.isUserInWorkspace(userId, channel.workspaceId);
      if (!isMember) {
        return res.status(403).json({ message: 'You do not have access to this channel' });
      }
      
      const messages = await storage.getMessagesByChannelId(channelId);
      res.json(messages);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch messages' });
    }
  });

  // Direct Messages
  app.post('/api/direct-messages', ensureAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = (req.user as any).id;
      const otherUserId = parseInt(req.body.userId);
      
      if (userId === otherUserId) {
        return res.status(400).json({ message: 'Cannot create conversation with yourself' });
      }
      
      // Check if the conversation already exists
      const existingDm = await storage.getDirectMessageByUserIds(userId, otherUserId);
      if (existingDm) {
        return res.json(existingDm);
      }
      
      // Create new conversation
      const directMessage = await storage.createDirectMessage({
        user1Id: userId,
        user2Id: otherUserId
      });
      
      res.status(201).json(directMessage);
    } catch (error) {
      res.status(500).json({ message: 'Failed to create direct message conversation' });
    }
  });

  app.get('/api/direct-messages', ensureAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = (req.user as any).id;
      const directMessages = await storage.getDirectMessagesByUserId(userId);
      res.json(directMessages);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch direct messages' });
    }
  });

  app.get('/api/direct-messages/:id/messages', ensureAuthenticated, async (req: Request, res: Response) => {
    try {
      const directMessageId = parseInt(req.params.id);
      const userId = (req.user as any).id;
      
      // Get the direct message conversation
      const dm = await storage.getDirectMessage(directMessageId);
      if (!dm) {
        return res.status(404).json({ message: 'Conversation not found' });
      }
      
      // Check if user is a participant in the conversation
      if (dm.user1Id !== userId && dm.user2Id !== userId) {
        return res.status(403).json({ message: 'You do not have access to this conversation' });
      }
      
      const messages = await storage.getMessagesByDirectMessageId(directMessageId);
      res.json(messages);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch messages' });
    }
  });

  // Channel memberships
  app.post('/api/channels/:id/members', ensureAuthenticated, async (req: Request, res: Response) => {
    try {
      const channelId = parseInt(req.params.id);
      const userId = (req.user as any).id;
      const targetUserId = parseInt(req.body.userId);
      
      // Get the channel
      const channel = await storage.getChannel(channelId);
      if (!channel) {
        return res.status(404).json({ message: 'Channel not found' });
      }
      
      // Check if the user is a member of the workspace
      const isUserInWorkspace = await storage.isUserInWorkspace(userId, channel.workspaceId);
      if (!isUserInWorkspace) {
        return res.status(403).json({ message: 'You do not have access to this workspace' });
      }
      
      // Check if the target user is a member of the workspace
      const isTargetInWorkspace = await storage.isUserInWorkspace(targetUserId, channel.workspaceId);
      if (!isTargetInWorkspace) {
        return res.status(400).json({ message: 'User is not a member of this workspace' });
      }
      
      // Add member to channel
      const member = await storage.addChannelMember({
        channelId,
        userId: targetUserId
      });
      
      res.status(201).json(member);
    } catch (error) {
      res.status(500).json({ message: 'Failed to add member to channel' });
    }
  });

  app.get('/api/channels/:id/members', ensureAuthenticated, async (req: Request, res: Response) => {
    try {
      const channelId = parseInt(req.params.id);
      const userId = (req.user as any).id;
      
      // Get the channel
      const channel = await storage.getChannel(channelId);
      if (!channel) {
        return res.status(404).json({ message: 'Channel not found' });
      }
      
      // Check if the user is a member of the workspace
      const isUserInWorkspace = await storage.isUserInWorkspace(userId, channel.workspaceId);
      if (!isUserInWorkspace) {
        return res.status(403).json({ message: 'You do not have access to this workspace' });
      }
      
      const members = await storage.getChannelMembersByChannelId(channelId);
      res.json(members);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch channel members' });
    }
  });

  // Workspace memberships
  app.post('/api/workspaces/:id/members', ensureAuthenticated, async (req: Request, res: Response) => {
    try {
      const workspaceId = parseInt(req.params.id);
      const userId = (req.user as any).id;
      const validatedData = insertWorkspaceMemberSchema.parse({
        ...req.body,
        workspaceId
      });
      
      // Check if the user is a member of the workspace
      const isUserInWorkspace = await storage.isUserInWorkspace(userId, workspaceId);
      if (!isUserInWorkspace) {
        return res.status(403).json({ message: 'You do not have access to this workspace' });
      }
      
      // Add member to workspace
      const member = await storage.addWorkspaceMember(validatedData);
      res.status(201).json(member);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Invalid member data', errors: error.errors });
      }
      res.status(500).json({ message: 'Failed to add member to workspace' });
    }
  });

  app.get('/api/workspaces/:id/members', ensureAuthenticated, async (req: Request, res: Response) => {
    try {
      const workspaceId = parseInt(req.params.id);
      const userId = (req.user as any).id;
      
      // Check if the user is a member of the workspace
      const isUserInWorkspace = await storage.isUserInWorkspace(userId, workspaceId);
      if (!isUserInWorkspace) {
        return res.status(403).json({ message: 'You do not have access to this workspace' });
      }
      
      const members = await storage.getWorkspaceMembersByWorkspaceId(workspaceId);
      res.json(members);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch workspace members' });
    }
  });

  // Users
  app.get('/api/users', ensureAuthenticated, async (req: Request, res: Response) => {
    // This endpoint would typically be used to search for users
    // In a real app, you'd implement pagination and search
    try {
      const search = req.query.search as string;
      if (!search || search.length < 3) {
        return res.status(400).json({ message: 'Search query must be at least 3 characters' });
      }
      
      // Search for users matching the search term
      const users = await storage.searchUsers(search)
        .then(users => users.map(({ password, ...userWithoutPassword }) => userWithoutPassword));
      
      res.json(users);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch users' });
    }
  });

  // Middleware to ensure user is authenticated
  function ensureAuthenticated(req: Request, res: Response, next: any) {
    if (req.isAuthenticated()) {
      return next();
    }
    res.status(401).json({ message: 'Unauthorized' });
  }

  return httpServer;
}
