import express, {
  type Express,
  Request,
  Response,
  NextFunction,
} from "express";
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
  type MessageWithUser,
} from "@shared/schema";
import {
  setupAuth,
  ensureAuthenticated,
  verifyToken,
  comparePasswords,
} from "./auth";

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
  const wss = new WebSocketServer({ server: httpServer, path: "/ws" });
  const clients: ConnectedClient[] = [];

  // Handle new WebSocket connections
  wss.on("connection", (ws, req) => {
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

    ws.on("message", async (message) => {
      try {
        const data = JSON.parse(message.toString());
        console.log(`WebSocket message received:`, data.type, data);

        if (data.type === "auth") {
          // Authenticate the WebSocket connection
          const authUserId = data.payload?.userId || data.userId;
          if (!authUserId) {
            ws.send(
              JSON.stringify({
                type: "error",
                message: "User ID is required for authentication",
              })
            );
            return;
          }

          if (typeof authUserId === "number") {
            const user = await storage.getUser(authUserId);
            if (user) {
              userId = user.id;

              // Remove any existing connections for this user
              const existingIndex = clients.findIndex(
                (client) => client.userId === userId && client.ws !== ws
              );

              if (existingIndex !== -1) {
                console.log(
                  `Replacing existing WebSocket for user: ${user.username}`
                );
                // Don't close the old connection, just replace it in the clients array
                clients[existingIndex].ws = ws;
              } else {
                clients.push({ userId: user.id, ws });
              }

              console.log(`WebSocket authenticated for user: ${user.username}`);

              // Send confirmation back to the client
              ws.send(
                JSON.stringify({
                  type: "auth_success",
                  userId: user.id,
                  username: user.username,
                  displayName: user.displayName,
                })
              );

              // Update user status to online
              await storage.updateUserStatus(userId, "online");
            } else {
              ws.send(
                JSON.stringify({
                  type: "error",
                  message: "User not found",
                })
              );
            }
          } else {
            ws.send(
              JSON.stringify({
                type: "error",
                message: "Invalid user ID format",
              })
            );
          }
        } else if (data.type === "message" && userId) {
          // Handle new chat message
          console.log(`Processing message from user ${userId}:`, data);

          const content = data.payload?.content || data.content;
          const channelId = data.payload?.channelId || data.channelId;
          const directMessageId =
            data.payload?.directMessageId || data.directMessageId;

          if (!content || content.trim() === "") {
            console.log("Empty message content detected");
            ws.send(
              JSON.stringify({
                type: "error",
                message: "Message content cannot be empty",
              })
            );
            return;
          }

          if (channelId) {
            // Channel message
            const isUserInChannel = await storage.isUserInChannel(
              userId,
              channelId
            );
            if (!isUserInChannel) {
              ws.send(
                JSON.stringify({
                  type: "error",
                  message: "You are not a member of this channel",
                })
              );
              return;
            }

            const message = await storage.createMessage({
              content,
              userId,
              channelId,
              directMessageId: undefined,
            });

            console.log("Message created successfully:", message);

            // Broadcast to all clients in the channel
            broadcastToChannel(channelId, {
              type: "new_message",
              payload: message,
            });

            // Send confirmation back to sender
            ws.send(
              JSON.stringify({
                type: "message_sent",
                messageId: message.id,
              })
            );
          } else if (directMessageId) {
            // Direct message
            const dm = await storage.getDirectMessage(directMessageId);
            if (!dm || (dm.user1Id !== userId && dm.user2Id !== userId)) {
              ws.send(
                JSON.stringify({
                  type: "error",
                  message: "Invalid direct message conversation",
                })
              );
              return;
            }

            const message = await storage.createMessage({
              content,
              userId,
              channelId: undefined,
              directMessageId,
            });

            // Send to both participants
            broadcastToDirectMessage(directMessageId, {
              type: "new_message",
              payload: message,
            });

            // Send confirmation back to sender
            ws.send(
              JSON.stringify({
                type: "message_sent",
                messageId: message.id,
              })
            );
          } else {
            ws.send(
              JSON.stringify({
                type: "error",
                message: "Missing channelId or directMessageId",
              })
            );
          }
        } else if (data.type === "typing" && userId) {
          // Handle typing indicator
          const typingData = {
            type: "typing",
            userId,
            channelId: data.channelId,
            directMessageId: data.directMessageId,
            isTyping: data.isTyping,
          };

          if (data.channelId) {
            broadcastToChannel(data.channelId, typingData);
          } else if (data.directMessageId) {
            broadcastToDirectMessage(data.directMessageId, typingData);
          }
        } else if (data.type === "webrtc_offer" && userId) {
          // Handle WebRTC offer (including recovery offers)
          const isRecovery = data.payload.isRecovery;
          console.log(
            `${
              isRecovery ? "🔄 WebRTC recovery" : "📡 WebRTC"
            } offer received:`,
            data.payload
          );

          const targetUserId = data.payload.targetUserId;
          const targetClients = clients.filter(
            (client) => client.userId === targetUserId
          );

          if (targetClients.length === 0) {
            console.log(`⚠️ No target clients found for user ${targetUserId}`);
            // Send error back to sender
            ws.send(
              JSON.stringify({
                type: "webrtc_error",
                payload: {
                  error: "Target user not connected",
                  callId: data.payload.callId,
                },
              })
            );
            return;
          }

          targetClients.forEach((client) => {
            if (client.ws.readyState === WebSocket.OPEN) {
              client.ws.send(
                JSON.stringify({
                  type: "webrtc_offer",
                  payload: {
                    ...data.payload,
                    fromUserId: userId,
                    isRecovery: isRecovery,
                  },
                })
              );
              console.log(
                `✅ ${
                  isRecovery ? "Recovery offer" : "Offer"
                } forwarded to user ${targetUserId}`
              );
            } else {
              console.log(
                `❌ Target client connection is not open for user ${targetUserId}`
              );
            }
          });
        } else if (data.type === "webrtc_answer" && userId) {
          // Handle WebRTC answer
          console.log("WebRTC answer received:", data.payload);
          const targetUserId = data.payload.targetUserId;
          const targetClients = clients.filter(
            (client) => client.userId === targetUserId
          );

          targetClients.forEach((client) => {
            if (client.ws.readyState === WebSocket.OPEN) {
              client.ws.send(
                JSON.stringify({
                  type: "webrtc_answer",
                  payload: {
                    ...data.payload,
                    fromUserId: userId,
                  },
                })
              );
            }
          });
        } else if (data.type === "webrtc_candidate" && userId) {
          // Handle ICE candidate
          console.log("ICE candidate received:", data.payload);
          const targetUserId = data.payload.targetUserId;
          const targetClients = clients.filter(
            (client) => client.userId === targetUserId
          );

          console.log(
            `Forwarding ICE candidate to ${targetClients.length} target clients`
          );
          targetClients.forEach((client) => {
            if (client.ws.readyState === WebSocket.OPEN) {
              client.ws.send(
                JSON.stringify({
                  type: "webrtc_candidate",
                  payload: {
                    ...data.payload,
                    fromUserId: userId,
                  },
                })
              );
            }
          });
        } else if (data.type === "screen_share_started" && userId) {
          // Handle screen sharing started
          console.log("🖥️ Screen sharing started:", data.payload);

          // Find the target user from the call participants
          const callId = data.payload.callId;

          // Broadcast to all participants in the call
          clients.forEach((client) => {
            if (
              client.userId !== userId &&
              client.ws.readyState === WebSocket.OPEN
            ) {
              client.ws.send(
                JSON.stringify({
                  type: "screen_share_started",
                  payload: {
                    ...data.payload,
                    fromUserId: userId,
                  },
                })
              );
            }
          });
        } else if (data.type === "screen_share_stopped" && userId) {
          // Handle screen sharing stopped
          console.log("🖥️ Screen sharing stopped:", data.payload);

          // Find the target user from the call participants
          const callId = data.payload.callId;

          // Broadcast to all participants in the call
          clients.forEach((client) => {
            if (
              client.userId !== userId &&
              client.ws.readyState === WebSocket.OPEN
            ) {
              client.ws.send(
                JSON.stringify({
                  type: "screen_share_stopped",
                  payload: {
                    ...data.payload,
                    fromUserId: userId,
                  },
                })
              );
            }
          });
        } else if (!userId) {
          ws.send(
            JSON.stringify({
              type: "error",
              message: "Not authenticated",
            })
          );
        }
      } catch (error) {
        console.error("WebSocket message error:", error);
        ws.send(
          JSON.stringify({
            type: "error",
            message: "Invalid message format",
          })
        );
      }
    });

    ws.on("close", async (code, reason) => {
      console.log(`WebSocket closed: ${code} ${reason}`);
      clearInterval(pingInterval);

      if (userId) {
        // Remove client from connected clients
        const index = clients.findIndex(
          (client) => client.userId === userId && client.ws === ws
        );
        if (index !== -1) {
          clients.splice(index, 1);
        }

        // Check if user has no other active connections
        const userConnections = clients.filter(
          (client) => client.userId === userId
        );
        if (userConnections.length === 0) {
          // Update user status to offline if they have no other active connections
          await storage.updateUserStatus(userId, "offline");
        }
      }
    });

    ws.on("error", (error) => {
      console.error("WebSocket error:", error);
      clearInterval(pingInterval);
    });

    ws.on("pong", () => {
      // Received pong, connection is alive
    });
  });

  // Helper functions for broadcasting messages
  function broadcastToChannel(channelId: number, data: any) {
    console.log(`=== Broadcasting to channel ${channelId} ===`);
    console.log(`Data to broadcast:`, JSON.stringify(data, null, 2));
    console.log(`Total connected clients: ${clients.length}`);

    // Get channel members asynchronously
    storage
      .getChannelMembersByChannelId(channelId)
      .then((members) => {
        const memberIds = members.map((member) => member.userId);
        console.log(`Channel ${channelId} member IDs:`, memberIds);

        // Find eligible clients
        const eligibleClients = clients.filter((client) => {
          const isOpen = client.ws.readyState === WebSocket.OPEN;
          const isMember = memberIds.includes(client.userId);
          console.log(
            `Client user ${client.userId}: open=${isOpen}, member=${isMember}`
          );
          return isOpen && isMember;
        });

        console.log(
          `Found ${eligibleClients.length} eligible clients for channel ${channelId}`
        );

        // Prepare message payload with correct format expected by client
        const message = {
          type: data.type,
          payload: data.payload,
        };

        const messageStr = JSON.stringify(message);
        console.log(`Sending message:`, messageStr);

        // Send to all eligible clients
        let deliveryCount = 0;
        eligibleClients.forEach((client, index) => {
          try {
            console.log(
              `Sending to client ${index + 1} (user ${client.userId})`
            );
            client.ws.send(messageStr);
            deliveryCount++;
          } catch (error) {
            console.error(
              `Failed to send message to client ${index + 1}:`,
              error
            );
          }
        });

        console.log(
          `=== Broadcast complete: ${deliveryCount}/${eligibleClients.length} clients received message ===`
        );
      })
      .catch((error) => {
        console.error(
          `Error getting channel members for channel ${channelId}:`,
          error
        );
      });
  }

  function broadcastToDirectMessage(directMessageId: number, data: any) {
    storage
      .getDirectMessage(directMessageId)
      .then((dm) => {
        if (dm) {
          // Track how many clients received the message
          let deliveryCount = 0;
          const eligibleUserIds = [dm.user1Id, dm.user2Id];
          const totalEligibleClients = clients.filter(
            (client) =>
              eligibleUserIds.includes(client.userId) &&
              client.ws.readyState === WebSocket.OPEN
          ).length;

          // Prepare message payload with correct format expected by client
          const message = {
            type: data.type,
            payload: data.payload,
          };

          const messageStr = JSON.stringify(message);

          // Send to both participants
          clients.forEach((client) => {
            if (
              (client.userId === dm.user1Id || client.userId === dm.user2Id) &&
              client.ws.readyState === WebSocket.OPEN
            ) {
              try {
                client.ws.send(messageStr);
                deliveryCount++;
              } catch (error) {
                console.error(`Failed to send message to client: ${error}`);
              }
            }
          });

          console.log(
            `Message broadcast to DM ${directMessageId}: ${deliveryCount}/${totalEligibleClients} clients received`
          );
        }
      })
      .catch((error) => {
        console.error(`Error broadcasting to DM ${directMessageId}:`, error);
      });
  }

  // Public key registration endpoint for encryption
  app.post(
    "/api/users/public-key",
    ensureAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const { publicKey } = req.body;

        if (!publicKey || typeof publicKey !== "string") {
          return res.status(400).json({ message: "Public key is required" });
        }

        const user = req.user;
        if (!user) {
          return res.status(401).json({ message: "User not authenticated" });
        }

        const updatedUser = await storage.updateUserPublicKey(
          user.id,
          publicKey
        );

        if (!updatedUser) {
          return res.status(404).json({ message: "User not found" });
        }

        res.json({
          message: "Public key registered successfully",
          publicKey: updatedUser.publicKey,
        });
      } catch (error) {
        console.error("Error registering public key:", error);
        res.status(500).json({ message: "Internal server error" });
      }
    }
  );

  // Demo mode endpoints (only for development)
  app.get("/api/demo/status", (req: Request, res: Response) => {
    const isDevelopment = process.env.NODE_ENV === "development";
    res.json({
      mode: isDevelopment ? "development" : "production",
      features: {
        demoLoginEnabled: isDevelopment,
        webSocketEnabled: true,
        apiVersion: "1.0.0",
        serverTime: new Date().toISOString(),
      },
    });
  });

  // Direct demo login without password for development only
  app.post("/api/demo/login", (req: Request, res: Response) => {
    const isDevelopment = process.env.NODE_ENV === "development";

    if (!isDevelopment) {
      return res.status(404).json({
        message: "This endpoint is only available in development mode",
      });
    }

    // Create a demo user session
    const demoUser = {
      id: 1,
      username: "demo",
      displayName: "Demo User",
      status: "online",
      password: "password", // This is safe because it's only used in development
    };

    req.login(demoUser, (err) => {
      if (err) {
        console.error("Demo login error:", err);
        return res
          .status(500)
          .json({ message: "Failed to create demo session" });
      }

      console.log("Demo login successful, Session ID:", req.sessionID);

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
  app.post(
    "/api/workspaces",
    ensureAuthenticated,
    async (req: Request, res: Response) => {
      try {
        // Handle nested name object from frontend
        const workspaceName =
          typeof req.body.name === "string"
            ? req.body.name
            : req.body.name?.name || req.body.name;

        if (!workspaceName || typeof workspaceName !== "string") {
          return res
            .status(400)
            .json({ message: "Workspace name is required" });
        }

        const validatedData = insertWorkspaceSchema.parse({
          name: workspaceName,
          ownerId: (req.user as any).id,
          iconText: req.body.iconText || workspaceName.charAt(0).toUpperCase(),
        });

        const workspace = await storage.createWorkspace(validatedData);

        // Add the creator as a workspace member
        await storage.addWorkspaceMember({
          workspaceId: workspace.id,
          userId: (req.user as any).id,
          role: "admin",
        });

        // Create a default general channel
        const channel = await storage.createChannel({
          name: "general",
          workspaceId: workspace.id,
          createdBy: (req.user as any).id,
          isPrivate: false,
        });

        // Add the creator to the channel
        await storage.addChannelMember({
          channelId: channel.id,
          userId: (req.user as any).id,
        });

        res.status(201).json(workspace);
      } catch (error) {
        console.error("Workspace creation error:", error);
        if (error instanceof z.ZodError) {
          return res
            .status(400)
            .json({ message: "Invalid workspace data", errors: error.errors });
        }
        res.status(500).json({ message: "Failed to create workspace" });
      }
    }
  );

  app.get(
    "/api/workspaces",
    ensureAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const userId = (req.user as any).id;
        console.log("Fetching workspaces for user:", userId);
        const workspaces = await storage.getWorkspacesByUserId(userId);
        console.log("Found workspaces:", workspaces);
        res.json(workspaces);
      } catch (error) {
        console.error("Workspaces API error:", error);
        res.status(500).json({
          message: "Failed to fetch workspaces",
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  );

  app.get(
    "/api/workspaces/:id",
    ensureAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const workspaceId = parseInt(req.params.id);
        const userId = (req.user as any).id;

        // Check if user is a member of the workspace
        const isMember = await storage.isUserInWorkspace(userId, workspaceId);
        if (!isMember) {
          return res
            .status(403)
            .json({ message: "You do not have access to this workspace" });
        }

        const workspace = await storage.getWorkspace(workspaceId);
        if (!workspace) {
          return res.status(404).json({ message: "Workspace not found" });
        }

        res.json(workspace);
      } catch (error) {
        res.status(500).json({ message: "Failed to fetch workspace" });
      }
    }
  );

  // Channels
  app.post(
    "/api/channels",
    ensureAuthenticated,
    async (req: Request, res: Response) => {
      try {
        // Handle nested name object from frontend
        const channelName =
          typeof req.body.name === "string"
            ? req.body.name
            : req.body.name?.name || req.body.name;
        const workspaceId = req.body.workspaceId || req.body.name?.workspaceId;
        const description = req.body.description || req.body.name?.description;

        if (!channelName || typeof channelName !== "string") {
          return res.status(400).json({ message: "Channel name is required" });
        }

        if (!workspaceId || typeof workspaceId !== "number") {
          return res.status(400).json({ message: "Workspace ID is required" });
        }

        const userId = (req.user as any).id;

        // Check if user is a member of the workspace
        const isMember = await storage.isUserInWorkspace(userId, workspaceId);
        if (!isMember) {
          return res
            .status(403)
            .json({ message: "You do not have access to this workspace" });
        }

        const validatedData = insertChannelSchema.parse({
          name: channelName,
          workspaceId: workspaceId,
          description: description || null,
          createdBy: userId,
          isPrivate: req.body.isPrivate || false,
        });

        const channel = await storage.createChannel(validatedData);

        // For public channels, add all workspace members automatically
        if (!validatedData.isPrivate) {
          const workspaceMembers =
            await storage.getWorkspaceMembersByWorkspaceId(workspaceId);
          for (const member of workspaceMembers) {
            await storage.addChannelMember({
              channelId: channel.id,
              userId: member.userId,
            });
          }
        } else {
          // For private channels, only add the creator
          await storage.addChannelMember({
            channelId: channel.id,
            userId,
          });
        }

        res.status(201).json(channel);
      } catch (error) {
        console.error("Channel creation error:", error);
        if (error instanceof z.ZodError) {
          return res
            .status(400)
            .json({ message: "Invalid channel data", errors: error.errors });
        }
        res.status(500).json({ message: "Failed to create channel" });
      }
    }
  );

  app.get(
    "/api/workspaces/:workspaceId/channels",
    ensureAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const workspaceId = parseInt(req.params.workspaceId);
        const userId = (req.user as any).id;

        // Check if user is a member of the workspace
        const isMember = await storage.isUserInWorkspace(userId, workspaceId);
        if (!isMember) {
          return res
            .status(403)
            .json({ message: "You do not have access to this workspace" });
        }

        const channels = await storage.getChannelsByWorkspaceId(workspaceId);
        res.json(channels);
      } catch (error) {
        res.status(500).json({ message: "Failed to fetch channels" });
      }
    }
  );

  app.get(
    "/api/channels/:id",
    ensureAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const channelId = parseInt(req.params.id);
        const userId = (req.user as any).id;

        // Get the channel
        const channel = await storage.getChannel(channelId);
        if (!channel) {
          return res.status(404).json({ message: "Channel not found" });
        }

        // Check if user is a member of the channel's workspace
        const isMember = await storage.isUserInWorkspace(
          userId,
          channel.workspaceId
        );
        if (!isMember) {
          return res
            .status(403)
            .json({ message: "You do not have access to this channel" });
        }

        res.json(channel);
      } catch (error) {
        res.status(500).json({ message: "Failed to fetch channel" });
      }
    }
  );

  app.get(
    "/api/channels/:id/messages",
    ensureAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const channelId = parseInt(req.params.id);
        const userId = (req.user as any).id;

        // Get the channel
        const channel = await storage.getChannel(channelId);
        if (!channel) {
          return res.status(404).json({ message: "Channel not found" });
        }

        // Check if user is a member of the channel's workspace
        const isMember = await storage.isUserInWorkspace(
          userId,
          channel.workspaceId
        );
        if (!isMember) {
          return res
            .status(403)
            .json({ message: "You do not have access to this channel" });
        }

        const messages = await storage.getMessagesByChannelId(channelId);
        res.json(messages);
      } catch (error) {
        res.status(500).json({ message: "Failed to fetch messages" });
      }
    }
  );

  // Create a message in a channel with media support
  app.post(
    "/api/channels/:id/messages",
    ensureAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const channelId = parseInt(req.params.id);
        const userId = (req.user as any).id;
        const {
          content,
          messageType = "text",
          mediaUrl,
          mediaType,
          mediaSize,
          replyToId,
        } = req.body;

        if (!content || !content.trim()) {
          return res
            .status(400)
            .json({ message: "Message content is required" });
        }

        // Get the channel
        const channel = await storage.getChannel(channelId);
        if (!channel) {
          return res.status(404).json({ message: "Channel not found" });
        }

        // Check if user is a member of the channel
        const isMember = await storage.isUserInChannel(userId, channelId);
        if (!isMember) {
          return res
            .status(403)
            .json({ message: "You are not a member of this channel" });
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
          replyToId,
        });

        // Broadcast to channel members via WebSocket
        broadcastToChannel(channelId, {
          type: "new_message",
          message,
        });

        res.status(201).json(message);
      } catch (error) {
        console.error("Error creating channel message:", error);
        res.status(500).json({ message: "Failed to create message" });
      }
    }
  );

  // Create a direct message with media support
  app.post(
    "/api/direct-messages/:id/messages",
    ensureAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const directMessageId = parseInt(req.params.id);
        const userId = (req.user as any).id;
        const {
          content,
          messageType = "text",
          mediaUrl,
          mediaType,
          mediaSize,
          replyToId,
        } = req.body;

        if (!content || !content.trim()) {
          return res
            .status(400)
            .json({ message: "Message content is required" });
        }

        // Get the direct message conversation
        const dm = await storage.getDirectMessage(directMessageId);
        if (!dm) {
          return res
            .status(404)
            .json({ message: "Direct message conversation not found" });
        }

        // Check if user is part of this conversation
        if (dm.user1Id !== userId && dm.user2Id !== userId) {
          return res
            .status(403)
            .json({ message: "You are not part of this conversation" });
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
          replyToId,
        });

        // Broadcast to conversation participants via WebSocket
        broadcastToDirectMessage(directMessageId, {
          type: "new_message",
          message,
        });

        res.status(201).json(message);
      } catch (error) {
        console.error("Error creating direct message:", error);
        res.status(500).json({ message: "Failed to create direct message" });
      }
    }
  );

  // Direct Messages
  app.post(
    "/api/direct-messages",
    ensureAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const userId = (req.user as any).id;
        const otherUserId = parseInt(req.body.userId);

        if (userId === otherUserId) {
          return res
            .status(400)
            .json({ message: "Cannot create conversation with yourself" });
        }

        // Check if the conversation already exists
        const existingDm = await storage.getDirectMessageByUserIds(
          userId,
          otherUserId
        );
        if (existingDm) {
          return res.json(existingDm);
        }

        // Create new conversation
        const directMessage = await storage.createDirectMessage({
          user1Id: userId,
          user2Id: otherUserId,
        });

        // Get the complete DM with user information for the response
        const completeDm = await storage.getDirectMessageByUserIds(
          userId,
          otherUserId
        );

        res.status(201).json(completeDm);
      } catch (error) {
        res
          .status(500)
          .json({ message: "Failed to create direct message conversation" });
      }
    }
  );

  app.get(
    "/api/direct-messages",
    ensureAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const userId = (req.user as any).id;
        const directMessages = await storage.getDirectMessagesByUserId(userId);
        res.json(directMessages);
      } catch (error) {
        res.status(500).json({ message: "Failed to fetch direct messages" });
      }
    }
  );

  app.get(
    "/api/direct-messages/:id",
    ensureAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const directMessageId = parseInt(req.params.id);
        const userId = (req.user as any).id;

        // Get the direct message conversation
        const dm = await storage.getDirectMessage(directMessageId);
        if (!dm) {
          return res.status(404).json({ message: "Conversation not found" });
        }

        // Check if user is a participant in the conversation
        if (dm.user1Id !== userId && dm.user2Id !== userId) {
          return res
            .status(403)
            .json({ message: "You are not part of this conversation" });
        }

        // Get user details for both participants
        const user1 = await storage.getUser(dm.user1Id);
        const user2 = await storage.getUser(dm.user2Id);

        if (!user1 || !user2) {
          return res.status(500).json({ message: "User data not found" });
        }

        res.json({
          id: dm.id,
          user1Id: dm.user1Id,
          user2Id: dm.user2Id,
          createdAt: dm.createdAt,
          user1,
          user2,
        });
      } catch (error) {
        res.status(500).json({ message: "Failed to fetch direct message" });
      }
    }
  );

  app.get(
    "/api/direct-messages/:id/messages",
    ensureAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const directMessageId = parseInt(req.params.id);
        const userId = (req.user as any).id;

        // Get the direct message conversation
        const dm = await storage.getDirectMessage(directMessageId);
        if (!dm) {
          return res.status(404).json({ message: "Conversation not found" });
        }

        // Check if user is a participant in the conversation
        if (dm.user1Id !== userId && dm.user2Id !== userId) {
          return res
            .status(403)
            .json({ message: "You do not have access to this conversation" });
        }

        const messages = await storage.getMessagesByDirectMessageId(
          directMessageId
        );
        res.json(messages);
      } catch (error) {
        res.status(500).json({ message: "Failed to fetch messages" });
      }
    }
  );

  // Channel memberships
  app.post(
    "/api/channels/:id/members",
    ensureAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const channelId = parseInt(req.params.id);
        const userId = (req.user as any).id;
        const username = req.body.username;

        if (!username) {
          return res.status(400).json({ message: "Username is required" });
        }

        // Find user by username
        const targetUser = await storage.getUserByUsername(username);
        if (!targetUser) {
          return res.status(404).json({ message: "User not found" });
        }

        // Get the channel
        const channel = await storage.getChannel(channelId);
        if (!channel) {
          return res.status(404).json({ message: "Channel not found" });
        }

        // Check if the user is a member of the workspace
        const isUserInWorkspace = await storage.isUserInWorkspace(
          userId,
          channel.workspaceId
        );
        if (!isUserInWorkspace) {
          return res
            .status(403)
            .json({ message: "You do not have access to this workspace" });
        }

        // Check if target user is already in the channel
        const isAlreadyMember = await storage.isUserInChannel(
          targetUser.id,
          channelId
        );
        if (isAlreadyMember) {
          return res
            .status(409)
            .json({ message: "User is already a member of this channel" });
        }

        // Check if the target user is a member of the workspace
        const isTargetInWorkspace = await storage.isUserInWorkspace(
          targetUser.id,
          channel.workspaceId
        );
        if (!isTargetInWorkspace) {
          // Automatically add user to workspace when adding to channel
          await storage.addWorkspaceMember({
            workspaceId: channel.workspaceId,
            userId: targetUser.id,
            role: "member",
          });
        }

        // Add member to channel
        const member = await storage.addChannelMember({
          channelId,
          userId: targetUser.id,
        });

        res.status(201).json(member);
      } catch (error) {
        console.error("Channel member addition error:", error);
        res.status(500).json({ message: "Failed to add member to channel" });
      }
    }
  );

  app.get(
    "/api/channels/:id/members",
    ensureAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const channelId = parseInt(req.params.id);
        const userId = (req.user as any).id;

        // Get the channel
        const channel = await storage.getChannel(channelId);
        if (!channel) {
          return res.status(404).json({ message: "Channel not found" });
        }

        // Check if the user is a member of the workspace
        const isUserInWorkspace = await storage.isUserInWorkspace(
          userId,
          channel.workspaceId
        );
        if (!isUserInWorkspace) {
          return res
            .status(403)
            .json({ message: "You do not have access to this workspace" });
        }

        const members = await storage.getChannelMembersByChannelId(channelId);
        res.json(members);
      } catch (error) {
        res.status(500).json({ message: "Failed to fetch channel members" });
      }
    }
  );

  // Workspace memberships
  app.post(
    "/api/workspaces/:id/members",
    ensureAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const workspaceId = parseInt(req.params.id);
        const userId = (req.user as any).id;
        const username = req.body.username;

        if (!username) {
          return res.status(400).json({ message: "Username is required" });
        }

        // Find user by username
        const targetUser = await storage.getUserByUsername(username);
        if (!targetUser) {
          return res.status(404).json({ message: "User not found" });
        }

        // Check if the user is a member of the workspace
        const isUserInWorkspace = await storage.isUserInWorkspace(
          userId,
          workspaceId
        );
        if (!isUserInWorkspace) {
          return res
            .status(403)
            .json({ message: "You do not have access to this workspace" });
        }

        // Check if target user is already a member
        const isAlreadyMember = await storage.isUserInWorkspace(
          targetUser.id,
          workspaceId
        );
        if (isAlreadyMember) {
          return res
            .status(409)
            .json({ message: "User is already a member of this workspace" });
        }

        // Add member to workspace
        const member = await storage.addWorkspaceMember({
          workspaceId,
          userId: targetUser.id,
          role: "member",
        });

        // Add user to all public channels in the workspace
        const channels = await storage.getChannelsByWorkspaceId(workspaceId);
        for (const channel of channels) {
          if (!channel.isPrivate) {
            // Check if user is not already in the channel
            const isInChannel = await storage.isUserInChannel(
              targetUser.id,
              channel.id
            );
            if (!isInChannel) {
              await storage.addChannelMember({
                channelId: channel.id,
                userId: targetUser.id,
              });
            }
          }
        }

        res.status(201).json(member);
      } catch (error) {
        console.error("Workspace member addition error:", error);
        if (error instanceof z.ZodError) {
          return res
            .status(400)
            .json({ message: "Invalid member data", errors: error.errors });
        }
        res.status(500).json({ message: "Failed to add member to workspace" });
      }
    }
  );

  app.get(
    "/api/workspaces/:id/members",
    ensureAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const workspaceId = parseInt(req.params.id);
        const userId = (req.user as any).id;

        // Check if the user is a member of the workspace
        const isUserInWorkspace = await storage.isUserInWorkspace(
          userId,
          workspaceId
        );
        if (!isUserInWorkspace) {
          return res
            .status(403)
            .json({ message: "You do not have access to this workspace" });
        }

        const members = await storage.getWorkspaceMembersByWorkspaceId(
          workspaceId
        );
        res.json(members);
      } catch (error) {
        res.status(500).json({ message: "Failed to fetch workspace members" });
      }
    }
  );

  // Users
  app.get(
    "/api/users",
    ensureAuthenticated,
    async (req: Request, res: Response) => {
      // This endpoint would typically be used to search for users
      // In a real app, you'd implement pagination and search
      try {
        const search = req.query.search as string;
        if (!search || search.length < 3) {
          return res
            .status(400)
            .json({ message: "Search query must be at least 3 characters" });
        }

        // Search for users matching the search term
        const users = await storage
          .searchUsers(search)
          .then((users) =>
            users.map(
              ({ password, ...userWithoutPassword }) => userWithoutPassword
            )
          );

        res.json(users);
      } catch (error) {
        res.status(500).json({ message: "Failed to fetch users" });
      }
    }
  );

  // Create a new user
  app.post(
    "/api/users",
    ensureAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const { username, displayName, password } = req.body;

        if (!username || !displayName || !password) {
          return res.status(400).json({
            message: "Username, display name, and password are required",
          });
        }

        // Check if user already exists
        const existingUser = await storage.getUserByUsername(username);
        if (existingUser) {
          return res.status(409).json({ message: "Username already exists" });
        }

        // Create the user with hashed password (using bcrypt directly)
        const bcrypt = require("bcrypt");
        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = await storage.createUser({
          username,
          displayName,
          password: hashedPassword,
        });

        // Remove password from response
        const { password: _, ...userResponse } = newUser;
        res.status(201).json(userResponse);
      } catch (error) {
        console.error("Error creating user:", error);
        res.status(500).json({ message: "Failed to create user" });
      }
    }
  );

  // Call Management - Voice and Video Calls
  app.post(
    "/api/calls/initiate",
    ensureAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const userId = (req.user as any).id;
        const {
          callType,
          targetUserId,
          receiverId,
          channelId,
          offer,
          callId: providedCallId,
        } = req.body;
        const actualReceiverId = targetUserId || receiverId;

        console.log("📞 Call initiation request received:", {
          userId,
          callType,
          targetUserId,
          actualReceiverId,
          hasOffer: !!offer,
          offerType: offer?.type,
          callId: providedCallId,
        });

        // Add detailed offer debugging
        if (offer) {
          console.log("📋 Offer details received from client:", {
            type: offer.type,
            sdpLength: offer.sdp ? offer.sdp.length : 0,
            sdpPreview: offer.sdp
              ? offer.sdp.substring(0, 100) + "..."
              : "no SDP",
          });
        } else {
          console.log("⚠️ No offer received from client");
        }

        if (!["voice", "video", "audio"].includes(callType)) {
          return res.status(400).json({
            message: "Invalid call type. Must be voice, video, or audio",
          });
        }

        // Direct call
        if (actualReceiverId) {
          const receiver = await storage.getUser(actualReceiverId);
          if (!receiver) {
            return res.status(404).json({ message: "User not found" });
          }

          // Use provided call ID or generate unique call ID
          const callId =
            providedCallId ||
            `call_${userId}_${actualReceiverId}_${Date.now()}`;

          // Notify receiver via WebSocket for call ringing
          const receiverClients = clients.filter(
            (c) => c.userId === actualReceiverId
          );
          const initiator = await storage.getUser(userId);

          if (receiverClients.length === 0) {
            return res.status(404).json({ message: "User is not online" });
          }

          const incomingCallPayload = {
            type: "incoming_call",
            payload: {
              callId,
              callType: callType === "audio" ? "voice" : callType, // Normalize audio to voice
              fromUserId: userId,
              offer: offer, // Include the WebRTC offer in the incoming call
              from: {
                id: initiator!.id,
                username: initiator!.username,
                displayName: initiator!.displayName,
                avatarUrl: initiator!.avatarUrl,
              },
            },
          };

          console.log("📞 Sending incoming call to receiver:", {
            receiverUserId: actualReceiverId,
            callId,
            hasOffer: !!offer,
            offerType: offer?.type,
            receiverClientsCount: receiverClients.length,
          });

          // Add detailed logging of the exact payload being sent
          console.log("📋 Complete incoming call payload being sent:", {
            type: incomingCallPayload.type,
            callId: incomingCallPayload.payload.callId,
            callType: incomingCallPayload.payload.callType,
            fromUserId: incomingCallPayload.payload.fromUserId,
            hasOffer: !!incomingCallPayload.payload.offer,
            offerType: incomingCallPayload.payload.offer?.type,
            offerSdpLength: incomingCallPayload.payload.offer?.sdp?.length,
            payloadKeys: Object.keys(incomingCallPayload.payload),
          });

          receiverClients.forEach((client) => {
            if (client.ws.readyState === WebSocket.OPEN) {
              client.ws.send(JSON.stringify(incomingCallPayload));
            }
          });

          // Notify caller that call is ringing
          const callerClients = clients.filter((c) => c.userId === userId);
          callerClients.forEach((client) => {
            if (client.ws.readyState === WebSocket.OPEN) {
              client.ws.send(
                JSON.stringify({
                  type: "call_ringing",
                  payload: { callId, to: receiver },
                })
              );
            }
          });

          res.json({
            success: true,
            message: "Call initiated successfully",
            callId,
            receiver: {
              id: receiver.id,
              username: receiver.username,
              displayName: receiver.displayName,
            },
          });
        }

        // Channel call
        if (channelId) {
          const channel = await storage.getChannel(channelId);
          if (!channel) {
            return res.status(404).json({ message: "Channel not found" });
          }

          const isMember = await storage.isUserInChannel(userId, channelId);
          if (!isMember) {
            return res.status(403).json({ message: "Not a channel member" });
          }

          const initiator = await storage.getUser(userId);
          broadcastToChannel(channelId, {
            type: "channel_call_started",
            callType,
            initiator,
            channelId,
            callId: `channel-${channelId}-${Date.now()}`,
          });

          res.json({ success: true, message: "Channel call started" });
        }
      } catch (error) {
        console.error("Call initiation error:", error);
        res.status(500).json({ message: "Failed to initiate call" });
      }
    }
  );

  // WebRTC Signaling
  app.post(
    "/api/calls/signal",
    ensureAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const { targetUserId, signalData, callId, type } = req.body;
        const userId = (req.user as any).id;

        if (!targetUserId || !signalData || !callId) {
          return res.status(400).json({
            message:
              "Missing required fields: targetUserId, signalData, callId",
          });
        }

        const targetClients = clients.filter((c) => c.userId === targetUserId);

        if (targetClients.length === 0) {
          return res.status(404).json({ message: "Target user not connected" });
        }

        targetClients.forEach((client) => {
          if (client.ws.readyState === WebSocket.OPEN) {
            client.ws.send(
              JSON.stringify({
                type: "webrtc_signal",
                payload: {
                  from: userId,
                  signalData,
                  callId,
                  signalType: type || "offer",
                },
              })
            );
          }
        });

        res.json({ success: true, message: "Signal sent successfully" });
      } catch (error) {
        console.error("Signaling error:", error);
        res.status(500).json({ message: "Failed to send signal" });
      }
    }
  );

  // Call answer endpoint
  app.post(
    "/api/calls/answer",
    ensureAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const { callId, accepted, answer } = req.body;
        const userId = (req.user as any).id;

        console.log("Call answer request:", {
          callId,
          accepted,
          userId,
          hasAnswer: !!answer,
        });

        // Add detailed answer debugging
        if (accepted && answer) {
          console.log("📋 Answer details received from client:", {
            type: answer.type,
            sdpLength: answer.sdp ? answer.sdp.length : 0,
            sdpPreview: answer.sdp
              ? answer.sdp.substring(0, 100) + "..."
              : "no SDP",
          });
        } else if (accepted && !answer) {
          console.log("⚠️ Call accepted but no WebRTC answer provided");
        }

        if (!callId || accepted === undefined) {
          return res
            .status(400)
            .json({ message: "Call ID and accepted status are required" });
        }

        // Extract caller ID from call ID format: call_callerID_receiverID_timestamp
        const callParts = callId.split("_");
        if (callParts.length < 4) {
          console.log("Invalid call ID format:", callId);
          return res.status(400).json({ message: "Invalid call ID format" });
        }

        const callerId = parseInt(callParts[1]);
        const receiverId = parseInt(callParts[2]);
        console.log("Call participants:", {
          callerId,
          receiverId,
          currentUser: userId,
        });

        const caller = await storage.getUser(callerId);
        const responder = await storage.getUser(userId);

        if (!caller || !responder) {
          console.log("User not found:", {
            caller: !!caller,
            responder: !!responder,
          });
          return res.status(404).json({ message: "User not found" });
        }

        const eventType = accepted ? "call_answered" : "call_rejected";
        const eventPayload = {
          callId,
          answer: accepted ? answer : undefined,
          fromUserId: userId,
          by: {
            id: responder.id,
            username: responder.username,
            displayName: responder.displayName,
          },
        };

        console.log(
          "Sending WebSocket event:",
          eventType,
          "to caller:",
          callerId
        );

        // Notify caller of response
        const callerClients = clients.filter((c) => c.userId === callerId);
        console.log("Found caller clients:", callerClients.length);
        callerClients.forEach((client) => {
          if (client.ws.readyState === WebSocket.OPEN) {
            console.log("Sending to caller client");
            client.ws.send(
              JSON.stringify({
                type: eventType,
                payload: eventPayload,
              })
            );
          } else {
            console.log(
              "Caller client WebSocket not open:",
              client.ws.readyState
            );
          }
        });

        console.log("Call answer processed successfully");
        res.json({
          success: true,
          message: accepted ? "Call accepted" : "Call rejected",
          callId,
        });
      } catch (error) {
        console.error("Call answer error:", error);
        res.status(500).json({ message: "Failed to respond to call" });
      }
    }
  );

  // Call hangup endpoint
  app.post(
    "/api/calls/hangup",
    ensureAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const { callId } = req.body;
        const userId = (req.user as any).id;

        if (!callId) {
          return res.status(400).json({ message: "Call ID is required" });
        }

        // Extract caller and receiver IDs from call ID
        const callParts = callId.split("_");
        if (callParts.length < 4) {
          return res.status(400).json({ message: "Invalid call ID format" });
        }

        const callerId = parseInt(callParts[1]);
        const receiverId = parseInt(callParts[2]);
        const otherUserId = userId === callerId ? receiverId : callerId;

        const hangupUser = await storage.getUser(userId);

        // Notify other participant
        const otherClients = clients.filter((c) => c.userId === otherUserId);
        otherClients.forEach((client) => {
          if (client.ws.readyState === WebSocket.OPEN) {
            client.ws.send(
              JSON.stringify({
                type: "call_ended",
                payload: {
                  callId,
                  endedBy: {
                    id: hangupUser!.id,
                    username: hangupUser!.username,
                    displayName: hangupUser!.displayName,
                  },
                },
              })
            );
          }
        });

        // Also notify the user who initiated the hangup
        const initiatorClients = clients.filter((c) => c.userId === userId);
        initiatorClients.forEach((client) => {
          if (client.ws.readyState === WebSocket.OPEN) {
            client.ws.send(
              JSON.stringify({
                type: "call_ended",
                payload: {
                  callId,
                  endedBy: {
                    id: hangupUser!.id,
                    username: hangupUser!.username,
                    displayName: hangupUser!.displayName,
                  },
                },
              })
            );
          }
        });

        res.json({ success: true, message: "Call ended", callId });
      } catch (error) {
        console.error("Call hangup error:", error);
        res.status(500).json({ message: "Failed to end call" });
      }
    }
  );

  // Media upload endpoint
  app.post(
    "/api/upload",
    ensureAuthenticated,
    async (req: Request, res: Response) => {
      try {
        // In a real app, implement file upload with multer or similar
        // For now, return a mock URL
        const { filename, mimetype } = req.body;

        // Generate a mock URL - in production, use cloud storage
        const mockUrl = `/uploads/${Date.now()}-${filename}`;

        res.json({
          success: true,
          url: mockUrl,
          mimetype,
        });
      } catch (error) {
        console.error("Upload error:", error);
        res.status(500).json({ message: "Failed to upload file" });
      }
    }
  );

  // Message reactions
  // Message search endpoint
  app.get(
    "/api/search/messages",
    ensureAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const { q: query } = req.query;
        const userId = (req.user as any).id;

        if (!query || typeof query !== "string") {
          return res
            .status(400)
            .json({ message: "Query parameter is required" });
        }

        const searchResults = await storage.searchMessages(query, userId);
        res.json(searchResults);
      } catch (error) {
        console.error("Search error:", error);
        res.status(500).json({ message: "Search failed" });
      }
    }
  );

  // Message thread endpoints
  app.get(
    "/api/messages/:id/thread",
    ensureAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const messageId = parseInt(req.params.id);
        const userId = (req.user as any).id;

        // Get the parent message to verify access
        const parentMessage = await storage.getMessageById(messageId);
        if (!parentMessage) {
          return res.status(404).json({ message: "Message not found" });
        }

        // Check if user has access to this message
        if (parentMessage.channelId) {
          const hasAccess = await storage.isUserInChannel(
            userId,
            parentMessage.channelId
          );
          if (!hasAccess) {
            return res.status(403).json({ message: "Access denied" });
          }
        } else if (parentMessage.directMessageId) {
          const dm = await storage.getDirectMessage(
            parentMessage.directMessageId
          );
          if (!dm || (dm.user1Id !== userId && dm.user2Id !== userId)) {
            return res.status(403).json({ message: "Access denied" });
          }
        }

        const threadMessages = await storage.getThreadMessages(messageId);
        res.json(threadMessages);
      } catch (error) {
        console.error("Thread fetch error:", error);
        res.status(500).json({ message: "Failed to fetch thread messages" });
      }
    }
  );

  // Message reactions endpoint
  app.post(
    "/api/messages/:id/react",
    ensureAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const messageId = parseInt(req.params.id);
        const userId = (req.user as any).id;
        const { emoji } = req.body;

        // Get the message to verify access and broadcast to correct channel/DM
        const message = await storage.getMessageById(messageId);
        if (!message) {
          return res.status(404).json({ message: "Message not found" });
        }

        // Verify user has access to this message
        if (message.channelId) {
          const hasAccess = await storage.isUserInChannel(
            userId,
            message.channelId
          );
          if (!hasAccess) {
            return res.status(403).json({ message: "Access denied" });
          }
        } else if (message.directMessageId) {
          const dm = await storage.getDirectMessage(message.directMessageId);
          if (!dm || (dm.user1Id !== userId && dm.user2Id !== userId)) {
            return res.status(403).json({ message: "Access denied" });
          }
        }

        // Broadcast reaction to appropriate channel or DM
        const reactionData = {
          type: "message_reaction",
          messageId,
          userId,
          emoji,
          timestamp: new Date().toISOString(),
        };

        if (message.channelId) {
          broadcastToChannel(message.channelId, reactionData);
        } else if (message.directMessageId) {
          broadcastToDirectMessage(message.directMessageId, reactionData);
        }

        res.json({ success: true });
      } catch (error) {
        console.error("Reaction error:", error);
        res.status(500).json({ message: "Failed to add reaction" });
      }
    }
  );

  // We're now using the ensureAuthenticated function from auth.ts

  return httpServer;
}
