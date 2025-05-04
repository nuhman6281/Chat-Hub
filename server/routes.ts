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
import { setupAuth, ensureAuthenticated, verifyToken } from "./auth";
import nodemailer from "nodemailer";

// WebSocket client map
interface ConnectedClient {
  userId: number;
  ws: WebSocket;
}

// Define the schema for adding by email
const addMemberByEmailSchema = z.object({
  email: z.string().email({ message: "Invalid email address provided." }),
  // workspaceId: z.number().int(), // We get this from req.params.id
  role: z.enum(["admin", "member"], {
    errorMap: () => ({
      message: "Invalid role specified. Must be 'admin' or 'member'.",
    }),
  }),
});

export async function registerRoutes(app: Express): Promise<Server> {
  // Set up authentication with our centralized auth module
  setupAuth(app);

  // Create HTTP server
  const httpServer = createServer(app);

  // Set up WebSocket server with more specific error handling
  const wss = new WebSocketServer({ server: httpServer, path: "/api/ws" });
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
        console.log(`WebSocket message received:`, data.type);

        if (data.type === "auth") {
          // Authenticate the WebSocket connection
          if (!data.userId) {
            ws.send(
              JSON.stringify({
                type: "error",
                message: "User ID is required for authentication",
              })
            );
            return;
          }

          const user = await storage.getUser(data.userId);
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
        } else if (data.type === "message" && userId) {
          // Handle new chat message
          if (!data.content || data.content.trim() === "") {
            ws.send(
              JSON.stringify({
                type: "error",
                message: "Message content cannot be empty",
              })
            );
            return;
          }

          if (data.channelId) {
            // Channel message
            const isUserInChannel = await storage.isUserInChannel(
              userId,
              data.channelId
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
              content: data.content,
              userId,
              channelId: data.channelId,
              directMessageId: undefined,
            });

            // Broadcast to all clients in the channel
            broadcastToChannel(data.channelId, message);

            // Send confirmation back to sender
            ws.send(
              JSON.stringify({
                type: "message_sent",
                messageId: message.id,
              })
            );
          } else if (data.directMessageId) {
            // Direct message
            const dm = await storage.getDirectMessage(data.directMessageId);
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
              content: data.content,
              userId,
              channelId: undefined,
              directMessageId: data.directMessageId,
            });

            // Send to both participants
            broadcastToDirectMessage(data.directMessageId, message);

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
    storage
      .getChannelMembersByChannelId(channelId)
      .then((members) => {
        const memberIds = members.map((member) => member.userId);

        // Track how many clients received the message
        let deliveryCount = 0;
        const totalEligibleClients = clients.filter(
          (client) =>
            memberIds.includes(client.userId) &&
            client.ws.readyState === WebSocket.OPEN
        ).length;

        // Prepare message payload
        const message = {
          type: data.type || "message",
          data,
          timestamp: new Date().toISOString(),
          channelId,
        };

        const messageStr = JSON.stringify(message);

        // Send to all eligible clients
        clients.forEach((client) => {
          if (
            memberIds.includes(client.userId) &&
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
          `Message broadcast to channel ${channelId}: ${deliveryCount}/${totalEligibleClients} clients received`
        );
      })
      .catch((error) => {
        console.error(`Error broadcasting to channel ${channelId}:`, error);
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

          // Prepare message payload
          const message = {
            type: data.type || "message",
            data,
            timestamp: new Date().toISOString(),
            directMessageId,
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
        const validatedData = insertWorkspaceSchema.parse({
          ...req.body,
          ownerId: (req.user as any).id,
        });

        const workspace = await storage.createWorkspace(validatedData);
        res.status(201).json(workspace);
      } catch (error) {
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
        const workspaces = await storage.getWorkspacesByUserId(userId);
        res.json(workspaces);
      } catch (error) {
        res.status(500).json({ message: "Failed to fetch workspaces" });
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
        const validatedData = insertChannelSchema.parse(req.body);
        const userId = (req.user as any).id;

        // Check if user is a member of the workspace
        const isMember = await storage.isUserInWorkspace(
          userId,
          validatedData.workspaceId
        );
        if (!isMember) {
          return res
            .status(403)
            .json({ message: "You do not have access to this workspace" });
        }

        const channel = await storage.createChannel(validatedData);

        // Add the creator to the channel
        await storage.addChannelMember({
          channelId: channel.id,
          userId,
        });

        res.status(201).json(channel);
      } catch (error) {
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

        res.status(201).json(directMessage);
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
        const targetUserId = parseInt(req.body.userId);

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

        // Check if the target user is a member of the workspace
        const isTargetInWorkspace = await storage.isUserInWorkspace(
          targetUserId,
          channel.workspaceId
        );
        if (!isTargetInWorkspace) {
          return res
            .status(400)
            .json({ message: "User is not a member of this workspace" });
        }

        // Add member to channel
        const member = await storage.addChannelMember({
          channelId,
          userId: targetUserId,
        });

        res.status(201).json(member);
      } catch (error) {
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
        // 1. Get IDs from request
        const workspaceId = parseInt(req.params.id);
        if (isNaN(workspaceId)) {
          return res
            .status(400)
            .json({ message: "Invalid workspace ID format." });
        }
        // Ensure req.user exists and has an id property
        const requesterUser = req.user as { id?: number };
        if (!requesterUser || typeof requesterUser.id !== "number") {
          return res.status(401).json({ message: "Authentication required." });
        }
        const requesterId = requesterUser.id;

        // 2. Validate request body (email and role)
        const validatedData = addMemberByEmailSchema.parse(req.body);
        const { email, role } = validatedData;

        // 3. Permission Check: Requester must be OWNER or ADMIN
        const requesterMembership = await storage.getWorkspaceMember(
          requesterId,
          workspaceId
        );
        if (
          !requesterMembership ||
          !["owner", "admin"].includes(requesterMembership.role)
        ) {
          return res.status(403).json({
            message:
              "Permission denied: You must be an owner or admin to add members.",
          });
        }

        // 4. Find the target user by email
        const targetUser = await storage.getUserByEmail(email);
        if (!targetUser) {
          return res.status(404).json({
            message: `User with email ${email} not found. Please ask them to register first.`,
          });
        }
        const targetUserId = targetUser.id;

        // 5. Check if the target user is already a member
        const isTargetAlreadyMember = await storage.isUserInWorkspace(
          targetUserId,
          workspaceId
        );
        if (isTargetAlreadyMember) {
          return res
            .status(409) // Conflict
            .json({
              message: `User ${email} is already a member of this workspace.`,
            });
        }

        // 6. Add member to workspace using the found userId
        const memberData = {
          userId: targetUserId,
          workspaceId: workspaceId,
          role: role,
        };
        const newMember = await storage.addWorkspaceMember(memberData);

        // 7. Return success response
        // Simply return the object created by addWorkspaceMember
        // const createdMemberWithDetails =
        //   await storage.getWorkspaceMemberDetails(
        //     newMember.id // Assuming addWorkspaceMember returns an object with the new membership ID
        //   );

        res.status(201).json(newMember); // Send the newly created member object
      } catch (error) {
        // Handle Zod validation errors specifically
        if (error instanceof z.ZodError) {
          // Provide structured validation errors
          return res.status(400).json({
            message: "Invalid invitation data provided.",
            errors: error.flatten().fieldErrors,
          });
        }
        // Log other errors and return a generic 500
        console.error("Error adding workspace member by email:", error);
        res.status(500).json({
          message: "An internal error occurred while adding the member.",
        });
      }
    }
  );

  app.get(
    "/api/workspaces/:id/members",
    ensureAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const workspaceId = parseInt(req.params.id);
        if (isNaN(workspaceId)) {
          return res
            .status(400)
            .json({ message: "Invalid workspace ID format." });
        }
        const requesterUser = req.user as { id?: number };
        if (!requesterUser || typeof requesterUser.id !== "number") {
          return res.status(401).json({ message: "Authentication required." });
        }
        const userId = requesterUser.id;

        // Check if the user is a member of the workspace first
        const isUserInWorkspace = await storage.isUserInWorkspace(
          userId,
          workspaceId
        );
        if (!isUserInWorkspace) {
          return res.status(403).json({
            message:
              "Permission denied: You do not have access to this workspace's members.",
          });
        }

        // Fetch members including their user details
        const members = await storage.getWorkspaceMembersByWorkspaceId(
          workspaceId
        );
        res.json(members);
      } catch (error) {
        console.error("Error fetching workspace members:", error);
        res.status(500).json({ message: "Failed to fetch workspace members." });
      }
    }
  );

  // Get the current user's membership details for a specific workspace
  app.get(
    "/api/workspaces/:workspaceId/members/me",
    ensureAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const workspaceId = parseInt(req.params.workspaceId);
        const userId = (req.user as any).id;

        const membership = await storage.getWorkspaceMember(
          userId,
          workspaceId
        );

        if (!membership) {
          // This shouldn't happen if the user can access the workspace,
          // but handle it just in case.
          return res
            .status(404)
            .json({ message: "Membership not found for this workspace" });
        }

        res.json(membership); // Contains userId, workspaceId, role
      } catch (error) {
        console.error("Error fetching own workspace membership:", error);
        res.status(500).json({ message: "Failed to fetch membership details" });
      }
    }
  );

  // Add PUT endpoint for updating member role
  app.put(
    "/api/workspaces/:workspaceId/members/:memberUserId",
    ensureAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const workspaceId = parseInt(req.params.workspaceId);
        const memberUserId = parseInt(req.params.memberUserId);
        const requesterId = (req.user as any).id;
        const { role } = req.body;

        if (!role || !["owner", "admin", "member"].includes(role)) {
          return res.status(400).json({ message: "Invalid role specified" });
        }

        // Permission Check: Requester must be OWNER or ADMIN
        const requesterMembership = await storage.getWorkspaceMember(
          requesterId,
          workspaceId
        );
        if (
          !requesterMembership ||
          !["owner", "admin"].includes(requesterMembership.role)
        ) {
          return res.status(403).json({
            message:
              "You do not have permission to change roles in this workspace",
          });
        }

        // Special check: Cannot demote the last owner
        if (role !== "owner") {
          const currentMember = await storage.getWorkspaceMember(
            memberUserId,
            workspaceId
          );
          if (currentMember?.role === "owner") {
            const owners = await storage.getWorkspaceOwners(workspaceId);
            if (owners.length <= 1) {
              return res
                .status(400)
                .json({ message: "Cannot remove the last owner" });
            }
          }
        }

        // Prevent self-demotion from owner if last owner
        if (
          requesterId === memberUserId &&
          requesterMembership.role === "owner" &&
          role !== "owner"
        ) {
          const owners = await storage.getWorkspaceOwners(workspaceId);
          if (owners.length <= 1) {
            return res.status(400).json({
              message: "You cannot demote yourself as the last owner",
            });
          }
        }

        const updatedMember = await storage.updateWorkspaceMemberRole(
          memberUserId,
          workspaceId,
          role
        );
        if (!updatedMember) {
          return res
            .status(404)
            .json({ message: "Workspace member not found" });
        }

        res.json(updatedMember);
      } catch (error) {
        console.error("Error updating workspace member role:", error);
        res.status(500).json({ message: "Failed to update member role" });
      }
    }
  );

  // Add DELETE endpoint for removing member
  app.delete(
    "/api/workspaces/:workspaceId/members/:memberUserId",
    ensureAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const workspaceId = parseInt(req.params.workspaceId);
        const memberUserId = parseInt(req.params.memberUserId);
        const requesterId = (req.user as any).id;

        // Cannot remove self directly with this endpoint
        if (requesterId === memberUserId) {
          return res.status(400).json({
            message:
              "Cannot remove yourself using this method. Use 'Leave Workspace'.",
          });
        }

        // Permission Check: Requester must be OWNER or ADMIN
        const requesterMembership = await storage.getWorkspaceMember(
          requesterId,
          workspaceId
        );
        if (
          !requesterMembership ||
          !["owner", "admin"].includes(requesterMembership.role)
        ) {
          return res.status(403).json({
            message:
              "You do not have permission to remove members from this workspace",
          });
        }

        // Check role of member being removed - cannot remove owner unless you are also owner? (Policy decision)
        const memberToRemove = await storage.getWorkspaceMember(
          memberUserId,
          workspaceId
        );
        if (!memberToRemove) {
          return res.status(404).json({ message: "Member not found" });
        }

        // Policy: Prevent non-owners from removing owners
        if (
          memberToRemove.role === "owner" &&
          requesterMembership.role !== "owner"
        ) {
          return res
            .status(403)
            .json({ message: "Admins cannot remove owners" });
        }

        // Policy: Prevent removing the last owner
        if (memberToRemove.role === "owner") {
          const owners = await storage.getWorkspaceOwners(workspaceId);
          if (owners.length <= 1) {
            return res
              .status(400)
              .json({ message: "Cannot remove the last owner" });
          }
        }

        const success = await storage.removeWorkspaceMember(
          memberUserId,
          workspaceId
        );
        if (!success) {
          // This might happen if the member didn't exist, though we checked above
          return res
            .status(404)
            .json({ message: "Failed to remove member or member not found" });
        }

        res.status(204).send(); // No content on successful deletion
      } catch (error) {
        console.error("Error removing workspace member:", error);
        res.status(500).json({ message: "Failed to remove member" });
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

  // Workspace invitations
  app.post(
    "/api/workspaces/:id/invite",
    ensureAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const workspaceId = parseInt(req.params.id);
        const userId = (req.user as any).id;
        const { email } = req.body;

        // Check if user has permission
        const isUserInWorkspace = await storage.isUserInWorkspace(
          userId,
          workspaceId
        );
        if (!isUserInWorkspace) {
          return res.status(403).json({ message: "Not authorized" });
        }

        // Get workspace details
        const workspace = await storage.getWorkspace(workspaceId);
        if (!workspace) {
          return res.status(404).json({ message: "Workspace not found" });
        }

        // Generate unique invitation token
        const inviteToken = require("shortid").generate();

        // Store invitation in database
        await storage.createWorkspaceInvitation({
          workspaceId,
          invitedByUserId: userId,
          email,
          token: inviteToken,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        });

        const inviteLink = `${
          process.env.APP_URL || "http://localhost:5000"
        }/join/${inviteToken}`;

        // Send email to invited user
        const transporter = nodemailer.createTransport({
          host: process.env.SMTP_HOST,
          port: parseInt(process.env.SMTP_PORT || "587"),
          secure: process.env.SMTP_SECURE === "true",
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
          },
        });

        const mailOptions = {
          from: process.env.SMTP_FROM || "noreply@chathub.com",
          to: email,
          subject: `Invitation to join ${workspace.name}`,
          html: `
            <h2>You've been invited to join ${workspace.name}</h2>
            <p>Click the link below to accept the invitation:</p>
            <a href="${inviteLink}" style="display: inline-block; padding: 10px 20px; background-color: #4f46e5; color: white; text-decoration: none; border-radius: 5px;">Join Workspace</a>
            <p>This invitation will expire in 7 days.</p>
            <p>If you didn't request this invitation, you can safely ignore this email.</p>
          `,
        };

        await transporter.sendMail(mailOptions);

        res.json({
          message: "Invitation sent successfully",
          inviteLink,
        });
      } catch (error) {
        console.error("Error creating invitation:", error);
        res.status(500).json({ message: "Failed to create invitation" });
      }
    }
  );

  // We're now using the ensureAuthenticated function from auth.ts

  return httpServer;
}
