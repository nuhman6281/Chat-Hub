import express, { type Express, Request, Response, NextFunction } from "express";
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
import { setupAuth, ensureAuthenticated, verifyToken } from "./auth";

// WebSocket client map
interface ConnectedClient {
  userId: number;
  ws: WebSocket;
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Set up authentication with our centralized auth module
  setupAuth(app);

  // Create HTTP server
  const httpServer = createServer(app);

  // Set up WebSocket server with more specific error handling
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });
  const clients: ConnectedClient[] = [];

  // Handle new WebSocket connections
  wss.on('connection', (ws, req) => {
    console.log(`New WebSocket connection: ${req.url}`);
    let userId: number | null = null;
    let pingInterval: NodeJS.Timeout;

    // Set up ping/pong for connection health checks
    pingInterval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.ping();
      } else {
        clearInterval(pingInterval);
      }
    }, 30000);

    ws.on('message', async (message) => {
      try {
        const data = JSON.parse(message.toString());
        console.log(`WebSocket message received:`, data.type);

        if (data.type === 'auth') {
          // Authenticate the WebSocket connection
          if (!data.userId) {
            ws.send(JSON.stringify({ 
              type: 'error', 
              message: 'User ID is required for authentication'
            }));
            return;
          }

          const user = await storage.getUser(data.userId);
          if (user) {
            userId = user.id;
            
            // Remove any existing connections for this user
            const existingIndex = clients.findIndex(client => 
              client.userId === userId && client.ws !== ws
            );
            
            if (existingIndex !== -1) {
              console.log(`Replacing existing WebSocket for user: ${user.username}`);
              // Don't close the old connection, just replace it in the clients array
              clients[existingIndex].ws = ws;
            } else {
              clients.push({ userId: user.id, ws });
            }
            
            console.log(`WebSocket authenticated for user: ${user.username}`);
            
            // Send confirmation back to the client
            ws.send(JSON.stringify({ 
              type: 'auth_success', 
              userId: user.id,
              username: user.username,
              displayName: user.displayName
            }));
            
            // Update user status to online
            await storage.updateUserStatus(userId, "online");
          } else {
            ws.send(JSON.stringify({ 
              type: 'error', 
              message: 'User not found'
            }));
          }
        } else if (data.type === 'message' && userId) {
          // Handle new chat message
          if (!data.content || data.content.trim() === '') {
            ws.send(JSON.stringify({ 
              type: 'error', 
              message: 'Message content cannot be empty'
            }));
            return;
          }

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
            broadcastToChannel(data.channelId, {
              type: 'new_message',
              payload: message
            });
            
            // Send confirmation back to sender
            ws.send(JSON.stringify({ 
              type: 'message_sent', 
              messageId: message.id 
            }));
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
            broadcastToDirectMessage(data.directMessageId, {
              type: 'new_message',
              payload: message
            });
            
            // Send confirmation back to sender
            ws.send(JSON.stringify({ 
              type: 'message_sent', 
              messageId: message.id 
            }));
          } else {
            ws.send(JSON.stringify({ 
              type: 'error', 
              message: 'Missing channelId or directMessageId' 
            }));
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
        } else if (!userId) {
          ws.send(JSON.stringify({ 
            type: 'error', 
            message: 'Not authenticated'
          }));
        }
      } catch (error) {
        console.error('WebSocket message error:', error);
        ws.send(JSON.stringify({ 
          type: 'error', 
          message: 'Invalid message format'
        }));
      }
    });

    ws.on('close', async (code, reason) => {
      console.log(`WebSocket closed: ${code} ${reason}`);
      clearInterval(pingInterval);
      
      if (userId) {
        // Remove client from connected clients
        const index = clients.findIndex(client => client.userId === userId && client.ws === ws);
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
    
    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
      clearInterval(pingInterval);
    });
    
    ws.on('pong', () => {
      // Received pong, connection is alive
    });
  });

  // Helper functions for broadcasting messages
  function broadcastToChannel(channelId: number, data: any) {
    storage.getChannelMembersByChannelId(channelId).then(members => {
      const memberIds = members.map(member => member.userId);
      
      // Track how many clients received the message
      let deliveryCount = 0;
      const totalEligibleClients = clients.filter(client => 
        memberIds.includes(client.userId) && client.ws.readyState === WebSocket.OPEN
      ).length;
      
      // Prepare message payload with correct format expected by client
      const message = {
        type: data.type,
        payload: data.payload
      };
      
      const messageStr = JSON.stringify(message);
      
      // Send to all eligible clients
      clients.forEach(client => {
        if (memberIds.includes(client.userId) && client.ws.readyState === WebSocket.OPEN) {
          try {
            client.ws.send(messageStr);
            deliveryCount++;
          } catch (error) {
            console.error(`Failed to send message to client: ${error}`);
          }
        }
      });
      
      console.log(`Message broadcast to channel ${channelId}: ${deliveryCount}/${totalEligibleClients} clients received`);
    }).catch(error => {
      console.error(`Error broadcasting to channel ${channelId}:`, error);
    });
  }

  function broadcastToDirectMessage(directMessageId: number, data: any) {
    storage.getDirectMessage(directMessageId).then(dm => {
      if (dm) {
        // Track how many clients received the message
        let deliveryCount = 0;
        const eligibleUserIds = [dm.user1Id, dm.user2Id];
        const totalEligibleClients = clients.filter(client => 
          eligibleUserIds.includes(client.userId) && client.ws.readyState === WebSocket.OPEN
        ).length;
        
        // Prepare message payload with correct format expected by client
        const message = {
          type: data.type,
          payload: data.payload
        };
        
        const messageStr = JSON.stringify(message);
        
        // Send to both participants
        clients.forEach(client => {
          if ((client.userId === dm.user1Id || client.userId === dm.user2Id) && 
              client.ws.readyState === WebSocket.OPEN) {
            try {
              client.ws.send(messageStr);
              deliveryCount++;
            } catch (error) {
              console.error(`Failed to send message to client: ${error}`);
            }
          }
        });
        
        console.log(`Message broadcast to DM ${directMessageId}: ${deliveryCount}/${totalEligibleClients} clients received`);
      }
    }).catch(error => {
      console.error(`Error broadcasting to DM ${directMessageId}:`, error);
    });
  }

  // Demo mode endpoints (only for development)
  app.get('/api/demo/status', (req: Request, res: Response) => {
    const isDevelopment = process.env.NODE_ENV === 'development';
    res.json({
      mode: isDevelopment ? 'development' : 'production',
      features: {
        demoLoginEnabled: isDevelopment,
        webSocketEnabled: true,
        apiVersion: '1.0.0',
        serverTime: new Date().toISOString()
      }
    });
  });
  
  // Direct demo login without password for development only
  app.post('/api/demo/login', (req: Request, res: Response) => {
    const isDevelopment = process.env.NODE_ENV === 'development';
    
    if (!isDevelopment) {
      return res.status(404).json({ 
        message: 'This endpoint is only available in development mode' 
      });
    }
    
    // Create a demo user session
    const demoUser = {
      id: 1,
      username: 'demo',
      displayName: 'Demo User',
      status: 'online',
      password: 'password'  // This is safe because it's only used in development
    };
    
    req.login(demoUser, (err) => {
      if (err) {
        console.error('Demo login error:', err);
        return res.status(500).json({ message: 'Failed to create demo session' });
      }
      
      console.log('Demo login successful, Session ID:', req.sessionID);
      
      // Return user data without password
      const { password, ...userWithoutPassword } = demoUser;
      return res.json(userWithoutPassword);
    });
  });
  
  // Authentication endpoints
  // Register endpoint is now managed in auth.ts

  // Login endpoint is now managed in auth.ts

  // Auth endpoints (logout and user) are now managed in auth.ts

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

  // Create a message in a channel with media support
  app.post('/api/channels/:id/messages', ensureAuthenticated, async (req: Request, res: Response) => {
    try {
      const channelId = parseInt(req.params.id);
      const userId = (req.user as any).id;
      const { content, messageType = 'text', mediaUrl, mediaType, mediaSize, replyToId } = req.body;
      
      if (!content || !content.trim()) {
        return res.status(400).json({ message: 'Message content is required' });
      }
      
      // Get the channel
      const channel = await storage.getChannel(channelId);
      if (!channel) {
        return res.status(404).json({ message: 'Channel not found' });
      }
      
      // Check if user is a member of the channel
      const isMember = await storage.isUserInChannel(userId, channelId);
      if (!isMember) {
        return res.status(403).json({ message: 'You are not a member of this channel' });
      }
      
      // Create the message with enhanced properties
      const message = await storage.createMessage({
        content: content.trim(),
        messageType,
        mediaUrl,
        mediaType,
        mediaSize,
        userId,
        channelId,
        replyToId
      });
      
      // Broadcast to channel members via WebSocket
      broadcastToChannel(channelId, {
        type: 'new_message',
        message
      });
      
      res.status(201).json(message);
    } catch (error) {
      console.error('Error creating channel message:', error);
      res.status(500).json({ message: 'Failed to create message' });
    }
  });

  // Create a direct message with media support
  app.post('/api/direct-messages/:id/messages', ensureAuthenticated, async (req: Request, res: Response) => {
    try {
      const directMessageId = parseInt(req.params.id);
      const userId = (req.user as any).id;
      const { content, messageType = 'text', mediaUrl, mediaType, mediaSize, replyToId } = req.body;
      
      if (!content || !content.trim()) {
        return res.status(400).json({ message: 'Message content is required' });
      }
      
      // Get the direct message conversation
      const dm = await storage.getDirectMessage(directMessageId);
      if (!dm) {
        return res.status(404).json({ message: 'Direct message conversation not found' });
      }
      
      // Check if user is part of this conversation
      if (dm.user1Id !== userId && dm.user2Id !== userId) {
        return res.status(403).json({ message: 'You are not part of this conversation' });
      }
      
      // Create the message
      const message = await storage.createMessage({
        content: content.trim(),
        messageType,
        mediaUrl,
        mediaType,
        mediaSize,
        userId,
        directMessageId,
        replyToId
      });
      
      // Broadcast to conversation participants via WebSocket
      broadcastToDirectMessage(directMessageId, {
        type: 'new_message',
        message
      });
      
      res.status(201).json(message);
    } catch (error) {
      console.error('Error creating direct message:', error);
      res.status(500).json({ message: 'Failed to create direct message' });
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

  // Call Management - Voice and Video Calls
  app.post('/api/calls/initiate', ensureAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = (req.user as any).id;
      const { callType, receiverId, channelId } = req.body;
      
      if (!['voice', 'video'].includes(callType)) {
        return res.status(400).json({ message: 'Invalid call type' });
      }
      
      // Direct call
      if (receiverId) {
        const receiver = await storage.getUser(receiverId);
        if (!receiver) {
          return res.status(404).json({ message: 'User not found' });
        }
        
        // Notify receiver via WebSocket
        const receiverClients = clients.filter(c => c.userId === receiverId);
        const initiator = await storage.getUser(userId);
        
        receiverClients.forEach(client => {
          if (client.ws.readyState === WebSocket.OPEN) {
            client.ws.send(JSON.stringify({
              type: 'incoming_call',
              callType,
              from: initiator,
              callId: `${userId}-${receiverId}-${Date.now()}`
            }));
          }
        });
        
        res.json({ success: true, message: 'Call initiated' });
      }
      
      // Channel call
      if (channelId) {
        const channel = await storage.getChannel(channelId);
        if (!channel) {
          return res.status(404).json({ message: 'Channel not found' });
        }
        
        const isMember = await storage.isUserInChannel(userId, channelId);
        if (!isMember) {
          return res.status(403).json({ message: 'Not a channel member' });
        }
        
        const initiator = await storage.getUser(userId);
        broadcastToChannel(channelId, {
          type: 'channel_call_started',
          callType,
          initiator,
          channelId,
          callId: `channel-${channelId}-${Date.now()}`
        });
        
        res.json({ success: true, message: 'Channel call started' });
      }
    } catch (error) {
      console.error('Call initiation error:', error);
      res.status(500).json({ message: 'Failed to initiate call' });
    }
  });

  // WebRTC Signaling
  app.post('/api/calls/signal', ensureAuthenticated, async (req: Request, res: Response) => {
    try {
      const { targetUserId, signalData, callId } = req.body;
      const userId = (req.user as any).id;
      
      const targetClients = clients.filter(c => c.userId === targetUserId);
      targetClients.forEach(client => {
        if (client.ws.readyState === WebSocket.OPEN) {
          client.ws.send(JSON.stringify({
            type: 'webrtc_signal',
            from: userId,
            signalData,
            callId
          }));
        }
      });
      
      res.json({ success: true });
    } catch (error) {
      console.error('Signaling error:', error);
      res.status(500).json({ message: 'Failed to send signal' });
    }
  });

  // Media upload endpoint
  app.post('/api/upload', ensureAuthenticated, async (req: Request, res: Response) => {
    try {
      // In a real app, implement file upload with multer or similar
      // For now, return a mock URL
      const { filename, mimetype } = req.body;
      
      // Generate a mock URL - in production, use cloud storage
      const mockUrl = `/uploads/${Date.now()}-${filename}`;
      
      res.json({ 
        success: true, 
        url: mockUrl,
        mimetype 
      });
    } catch (error) {
      console.error('Upload error:', error);
      res.status(500).json({ message: 'Failed to upload file' });
    }
  });

  // Message reactions
  app.post('/api/messages/:id/react', ensureAuthenticated, async (req: Request, res: Response) => {
    try {
      const messageId = parseInt(req.params.id);
      const userId = (req.user as any).id;
      const { emoji } = req.body;
      
      // In a real implementation, update message reactions in database
      // For now, broadcast the reaction via WebSocket
      // Message retrieval functionality will be implemented when needed
      if (!message) {
        return res.status(404).json({ message: 'Message not found' });
      }
      
      // Broadcast reaction to appropriate channel or DM
      const reactionData = {
        type: 'message_reaction',
        messageId,
        userId,
        emoji,
        timestamp: new Date().toISOString()
      };
      
      if (message.channelId) {
        broadcastToChannel(message.channelId, reactionData);
      } else if (message.directMessageId) {
        broadcastToDirectMessage(message.directMessageId, reactionData);
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error('Reaction error:', error);
      res.status(500).json({ message: 'Failed to add reaction' });
    }
  });

  // We're now using the ensureAuthenticated function from auth.ts

  return httpServer;
}
