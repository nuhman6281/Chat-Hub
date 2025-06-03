import {
  users,
  type User,
  type InsertUser,
  workspaces,
  type Workspace,
  type InsertWorkspace,
  channels,
  type Channel,
  type InsertChannel,
  messages,
  type Message,
  type InsertMessage,
  directMessages,
  type DirectMessage,
  type InsertDirectMessage,
  workspaceMembers,
  type WorkspaceMember,
  type InsertWorkspaceMember,
  channelMembers,
  type ChannelMember,
  type InsertChannelMember,
  type MessageWithUser,
  type ChannelWithMemberCount,
  type DirectMessageWithUser,
  workspaceInvitations,
  type WorkspaceInvitation,
  type InsertWorkspaceInvitation,
} from "@shared/schema";
import { drizzle, NodePgDatabase } from "drizzle-orm/node-postgres";
import { eq, and, or, desc, count, sql, ilike } from "drizzle-orm";
import bcrypt from "bcrypt";

// Define the storage interface with CRUD methods
export interface IStorage {
  // User operations
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUserStatus(id: number, status: string): Promise<User | undefined>;

  // Workspace operations
  createWorkspace(workspace: InsertWorkspace): Promise<Workspace>;
  getWorkspace(id: number): Promise<Workspace | undefined>;
  getWorkspacesByUserId(userId: number): Promise<Workspace[]>;

  // Channel operations
  createChannel(channel: InsertChannel): Promise<Channel>;
  getChannel(id: number): Promise<Channel | undefined>;
  getChannelsByWorkspaceId(
    workspaceId: number
  ): Promise<ChannelWithMemberCount[]>;

  // Message operations
  createMessage(message: InsertMessage): Promise<MessageWithUser>;
  getMessagesByChannelId(channelId: number): Promise<MessageWithUser[]>;
  getMessagesByDirectMessageId(
    directMessageId: number
  ): Promise<MessageWithUser[]>;

  // Direct Message operations
  createDirectMessage(dm: InsertDirectMessage): Promise<DirectMessage>;
  getDirectMessage(id: number): Promise<DirectMessage | undefined>;
  getDirectMessageByUserIds(
    user1Id: number,
    user2Id: number
  ): Promise<DirectMessage | undefined>;
  getDirectMessagesByUserId(userId: number): Promise<DirectMessageWithUser[]>;

  // Workspace membership operations
  addWorkspaceMember(member: InsertWorkspaceMember): Promise<WorkspaceMember>;
  getWorkspaceMembersByWorkspaceId(
    workspaceId: number
  ): Promise<(WorkspaceMember & { user: User })[]>;
  getWorkspaceMember(
    userId: number,
    workspaceId: number
  ): Promise<WorkspaceMember | undefined>;
  isUserInWorkspace(userId: number, workspaceId: number): Promise<boolean>;
  updateWorkspaceMemberRole(
    userId: number,
    workspaceId: number,
    role: string
  ): Promise<WorkspaceMember | undefined>;
  removeWorkspaceMember(userId: number, workspaceId: number): Promise<boolean>;
  getWorkspaceOwners(workspaceId: number): Promise<WorkspaceMember[]>;

  // Channel membership operations
  addChannelMember(member: InsertChannelMember): Promise<ChannelMember>;
  getChannelMembersByChannelId(
    channelId: number
  ): Promise<(ChannelMember & { user: User })[]>;
  isUserInChannel(userId: number, channelId: number): Promise<boolean>;

  // Workspace invitation operations
  createWorkspaceInvitation(
    data: InsertWorkspaceInvitation
  ): Promise<WorkspaceInvitation>;
  getWorkspaceInvitationByToken(
    token: string
  ): Promise<WorkspaceInvitation | null>;
  deleteWorkspaceInvitation(id: number): Promise<boolean>;

  // Search users by username or display name
  searchUsers(searchTerm: string): Promise<User[]>;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private workspaces: Map<number, Workspace>;
  private channels: Map<number, Channel>;
  private messages: Map<number, Message>;
  private directMessages: Map<number, DirectMessage>;
  private workspaceMembers: Map<number, WorkspaceMember>;
  private channelMembers: Map<number, ChannelMember>;

  private userId: number = 1;
  private workspaceId: number = 1;
  private channelId: number = 1;
  private messageId: number = 1;
  private directMessageId: number = 1;
  private workspaceMemberId: number = 1;
  private channelMemberId: number = 1;

  constructor() {
    this.users = new Map();
    this.workspaces = new Map();
    this.channels = new Map();
    this.messages = new Map();
    this.directMessages = new Map();
    this.workspaceMembers = new Map();
    this.channelMembers = new Map();

    // Create a seed user for testing
    const seedUser: User = {
      id: this.userId++,
      username: "demo",
      email: "demo@example.com",
      password: "demo",
      displayName: "Demo User",
      status: "online",
      avatarUrl: null,
    };
    this.users.set(seedUser.id, seedUser);

    // Create a seed workspace
    const seedWorkspace: Workspace = {
      id: this.workspaceId++,
      name: "Demo Workspace",
      ownerId: seedUser.id,
      iconText: "DW",
      createdAt: new Date(),
    };
    this.workspaces.set(seedWorkspace.id, seedWorkspace);

    // Add the user to the workspace
    const membershipId = this.workspaceMemberId++;
    const membership: WorkspaceMember = {
      id: membershipId,
      workspaceId: seedWorkspace.id,
      userId: seedUser.id,
      role: "owner",
    };
    this.workspaceMembers.set(membershipId, membership);

    // Create a general channel
    const generalChannel: Channel = {
      id: this.channelId++,
      name: "general",
      workspaceId: seedWorkspace.id,
      description: "General discussion channel",
      isPrivate: false,
      createdAt: new Date(),
    };
    this.channels.set(generalChannel.id, generalChannel);

    // Add the user to the general channel
    const channelMemberId = this.channelMemberId++;
    const channelMember: ChannelMember = {
      id: channelMemberId,
      channelId: generalChannel.id,
      userId: seedUser.id,
    };
    this.channelMembers.set(channelMemberId, channelMember);

    // Create a seed message for testing
    const message: Message = {
      id: this.messageId++,
      content: "Hello, world!",
      userId: seedUser.id,
      channelId: generalChannel.id,
      directMessageId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.messages.set(message.id, message);
  }

  // User operations
  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username.toLowerCase() === username.toLowerCase()
    );
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    console.log(`MemStorage: Searching for email: ${email}`);
    const foundUser = Array.from(this.users.values()).find(
      (user) => user.email?.toLowerCase() === email.toLowerCase()
    );
    console.log(`MemStorage: Found user by email:`, foundUser);
    return foundUser;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.userId++;
    const user: User = {
      ...insertUser,
      id,
      status: "online",
      avatarUrl: insertUser.avatarUrl || null,
    };
    this.users.set(id, user);
    return user;
  }

  async updateUserStatus(
    id: number,
    status: string
  ): Promise<User | undefined> {
    const user = await this.getUser(id);
    if (!user) return undefined;

    const updatedUser = { ...user, status };
    this.users.set(id, updatedUser);
    return updatedUser;
  }

  // Workspace operations
  async createWorkspace(workspace: InsertWorkspace): Promise<Workspace> {
    const id = this.workspaceId++;
    const now = new Date();
    const newWorkspace: Workspace = { ...workspace, id, createdAt: now };
    this.workspaces.set(id, newWorkspace);

    // Add the owner as a member
    await this.addWorkspaceMember({
      workspaceId: id,
      userId: workspace.ownerId,
      role: "owner",
    });

    // Create a default "general" channel
    await this.createChannel({
      name: "general",
      workspaceId: id,
      description: "General discussions",
      isPrivate: false,
    });

    return newWorkspace;
  }

  async getWorkspace(id: number): Promise<Workspace | undefined> {
    return this.workspaces.get(id);
  }

  async getWorkspacesByUserId(userId: number): Promise<Workspace[]> {
    const memberships = Array.from(this.workspaceMembers.values()).filter(
      (member) => member.userId === userId
    );

    return memberships
      .map((member) => this.workspaces.get(member.workspaceId))
      .filter((workspace): workspace is Workspace => workspace !== undefined);
  }

  // Channel operations
  async createChannel(insertChannel: InsertChannel): Promise<Channel> {
    const id = this.channelId++;
    const now = new Date();
    const channel: Channel = {
      ...insertChannel,
      id,
      createdAt: now,
      description: insertChannel.description || null,
      isPrivate: insertChannel.isPrivate ?? false,
    };
    this.channels.set(id, channel);

    // Add the creator to the channel automatically
    await this.addChannelMember({
      channelId: id,
      userId:
        (await this.getWorkspace(insertChannel.workspaceId))?.ownerId || 0,
    });

    return channel;
  }

  async getChannel(id: number): Promise<Channel | undefined> {
    return this.channels.get(id);
  }

  async getChannelsByWorkspaceId(
    workspaceId: number
  ): Promise<ChannelWithMemberCount[]> {
    const channels = Array.from(this.channels.values()).filter(
      (channel) => channel.workspaceId === workspaceId
    );

    return Promise.all(
      channels.map(async (channel) => {
        const members = await this.getChannelMembersByChannelId(channel.id);
        return {
          ...channel,
          memberCount: members.length,
        };
      })
    );
  }

  // Message operations
  async createMessage(insertMessage: InsertMessage): Promise<MessageWithUser> {
    const id = this.messageId++;
    const now = new Date();
    const message: Message = {
      ...insertMessage,
      id,
      createdAt: now,
      updatedAt: now,
      channelId: insertMessage.channelId || null,
      directMessageId: insertMessage.directMessageId || null,
    };
    this.messages.set(id, message);

    const user = await this.getUser(message.userId);
    if (!user) {
      throw new Error(`User with id ${message.userId} not found`);
    }

    return { ...message, user };
  }

  async getMessagesByChannelId(channelId: number): Promise<MessageWithUser[]> {
    const messages = Array.from(this.messages.values()).filter(
      (message) => message.channelId === channelId
    );

    return Promise.all(
      messages.map(async (message) => {
        const user = await this.getUser(message.userId);
        if (!user) {
          throw new Error(`User with id ${message.userId} not found`);
        }
        return { ...message, user };
      })
    );
  }

  async getMessagesByDirectMessageId(
    directMessageId: number
  ): Promise<MessageWithUser[]> {
    const messages = Array.from(this.messages.values())
      .filter((message) => message.directMessageId === directMessageId)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

    return Promise.all(
      messages.map(async (message) => {
        const user = await this.getUser(message.userId);
        if (!user) {
          throw new Error(`User with id ${message.userId} not found`);
        }
        return { ...message, user };
      })
    );
  }

  // Direct Message operations
  async createDirectMessage(dm: InsertDirectMessage): Promise<DirectMessage> {
    const id = this.directMessageId++;
    const now = new Date();
    const directMessage: DirectMessage = { ...dm, id, createdAt: now };
    this.directMessages.set(id, directMessage);
    return directMessage;
  }

  async getDirectMessage(id: number): Promise<DirectMessage | undefined> {
    return this.directMessages.get(id);
  }

  async getDirectMessageByUserIds(
    user1Id: number,
    user2Id: number
  ): Promise<DirectMessage | undefined> {
    return Array.from(this.directMessages.values()).find(
      (dm) =>
        (dm.user1Id === user1Id && dm.user2Id === user2Id) ||
        (dm.user1Id === user2Id && dm.user2Id === user1Id)
    );
  }

  async getDirectMessagesByUserId(
    userId: number
  ): Promise<DirectMessageWithUser[]> {
    const dms = Array.from(this.directMessages.values()).filter(
      (dm) => dm.user1Id === userId || dm.user2Id === userId
    );

    return Promise.all(
      dms.map(async (dm) => {
        const otherUserId = dm.user1Id === userId ? dm.user2Id : dm.user1Id;
        const otherUser = await this.getUser(otherUserId);

        if (!otherUser) {
          throw new Error(`User with id ${otherUserId} not found`);
        }

        const messages = await this.getMessagesByDirectMessageId(dm.id);
        const lastMessage =
          messages.length > 0 ? messages[messages.length - 1] : undefined;

        return {
          ...dm,
          otherUser,
          lastMessage,
        };
      })
    );
  }

  // Workspace membership operations
  async addWorkspaceMember(
    member: InsertWorkspaceMember
  ): Promise<WorkspaceMember> {
    const id = this.workspaceMemberId++;
    const newMember: WorkspaceMember = {
      ...member,
      id,
      role: member.role || "member",
    };
    this.workspaceMembers.set(id, newMember);
    return newMember;
  }

  async getWorkspaceMembersByWorkspaceId(
    workspaceId: number
  ): Promise<(WorkspaceMember & { user: User })[]> {
    const members = Array.from(this.workspaceMembers.values()).filter(
      (member) => member.workspaceId === workspaceId
    );

    return Promise.all(
      members.map(async (member) => {
        const user = await this.getUser(member.userId);
        if (!user) {
          throw new Error(`User with id ${member.userId} not found`);
        }
        return { ...member, user };
      })
    );
  }

  async getWorkspaceMember(
    userId: number,
    workspaceId: number
  ): Promise<WorkspaceMember | undefined> {
    return Array.from(this.workspaceMembers.values()).find(
      (member) => member.userId === userId && member.workspaceId === workspaceId
    );
  }

  async isUserInWorkspace(
    userId: number,
    workspaceId: number
  ): Promise<boolean> {
    return Array.from(this.workspaceMembers.values()).some(
      (member) => member.userId === userId && member.workspaceId === workspaceId
    );
  }

  async updateWorkspaceMemberRole(
    userId: number,
    workspaceId: number,
    role: string
  ): Promise<WorkspaceMember | undefined> {
    const member = Array.from(this.workspaceMembers.values()).find(
      (m) => m.userId === userId && m.workspaceId === workspaceId
    );
    if (member) {
      member.role = role;
      this.workspaceMembers.set(member.id, member);
      return member;
    }
    return undefined;
  }

  async removeWorkspaceMember(
    userId: number,
    workspaceId: number
  ): Promise<boolean> {
    const member = Array.from(this.workspaceMembers.values()).find(
      (m) => m.userId === userId && m.workspaceId === workspaceId
    );
    if (member) {
      return this.workspaceMembers.delete(member.id);
    }
    return false;
  }

  async getWorkspaceOwners(workspaceId: number): Promise<WorkspaceMember[]> {
    return Array.from(this.workspaceMembers.values()).filter(
      (m) => m.workspaceId === workspaceId && m.role === "owner"
    );
  }

  // Channel membership operations
  async addChannelMember(member: InsertChannelMember): Promise<ChannelMember> {
    const id = this.channelMemberId++;
    const newMember: ChannelMember = { ...member, id };
    this.channelMembers.set(id, newMember);
    return newMember;
  }

  async getChannelMembersByChannelId(
    channelId: number
  ): Promise<(ChannelMember & { user: User })[]> {
    const members = Array.from(this.channelMembers.values()).filter(
      (m) => m.channelId === channelId
    );

    return Promise.all(
      members.map(async (mem) => {
        const user = await this.getUser(mem.userId);
        if (!user) {
          throw new Error(`User with id ${mem.userId} not found`);
        }
        return { ...mem, user };
      })
    );
  }

  async isUserInChannel(userId: number, channelId: number): Promise<boolean> {
    return Array.from(this.channelMembers.values()).some(
      (m) => m.userId === userId && m.channelId === channelId
    );
  }

  // Workspace invitation operations
  async createWorkspaceInvitation(
    data: InsertWorkspaceInvitation
  ): Promise<WorkspaceInvitation> {
    // Implementation needed
    throw new Error("Method not implemented");
  }

  async getWorkspaceInvitationByToken(
    token: string
  ): Promise<WorkspaceInvitation | null> {
    // Since this is just a memory implementation for testing, we'll return null
    // In a real implementation, we would search for the invitation by token
    console.warn(
      "MemStorage.getWorkspaceInvitationByToken is not fully implemented"
    );
    return null;
  }

  async deleteWorkspaceInvitation(id: number): Promise<boolean> {
    // Since this is just a memory implementation for testing, we'll return true
    // In a real implementation, we would remove the invitation from storage
    console.warn(
      "MemStorage.deleteWorkspaceInvitation is not fully implemented"
    );
    return true;
  }

  // Search users by username or display name
  async searchUsers(searchTerm: string): Promise<User[]> {
    return Array.from(this.users.values()).filter((user) => {
      return (
        user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.displayName.toLowerCase().includes(searchTerm.toLowerCase())
      );
    });
  }
}

// Check for DATABASE_URL environment variable
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("FATAL ERROR: DATABASE_URL environment variable is not set.");
  process.exit(1); // Exit if the database URL is missing
}

// Initialize the Drizzle client
// Assuming NodePgDatabase is the correct type for your setup
const dbClient: NodePgDatabase = drizzle(databaseUrl);

export class DatabaseStorage implements IStorage {
  private db: NodePgDatabase;

  constructor(databaseClient: NodePgDatabase) {
    this.db = databaseClient;
  }

  async getUser(id: number): Promise<User | undefined> {
    try {
      const [user] = await this.db
        .select()
        .from(users)
        .where(sql`${users.id} = ${id}`)
        .limit(1);
      return user;
    } catch (error) {
      console.error("Error getting user by ID:", error);
      return undefined;
    }
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    try {
      const [user] = await this.db
        .select()
        .from(users)
        .where(sql`${users.username} = ${username}`)
        .limit(1);
      return user;
    } catch (error) {
      console.error("Error getting user by username:", error);
      return undefined;
    }
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    try {
      const [user] = await this.db
        .select()
        .from(users)
        .where(sql`${users.email} = ${email}`)
        .limit(1);
      return user;
    } catch (error) {
      console.error("Error getting user by email:", error);
      return undefined;
    }
  }

  async createUser(userData: InsertUser): Promise<User> {
    try {
      const [newUser] = await this.db
        .insert(users)
        .values(userData)
        .returning();
      return newUser;
    } catch (error) {
      console.error("Error creating user:", error);
      throw new Error(`Failed to create user: ${error.message}`);
    }
  }

  async updateUserStatus(
    id: number,
    status: string
  ): Promise<User | undefined> {
    try {
      const [updatedUser] = await this.db
        .update(users)
        .set({ status })
        .where(sql`${users.id} = ${id}`)
        .returning();
      return updatedUser;
    } catch (error) {
      console.error("Error updating user status:", error);
      return undefined;
    }
  }

  // Workspace operations
  async createWorkspace(workspace: InsertWorkspace): Promise<Workspace> {
    try {
      const [newWorkspace] = await this.db
        .insert(workspaces)
        .values(workspace)
        .returning();

      // Add the owner as a member
      await this.addWorkspaceMember({
        workspaceId: newWorkspace.id,
        userId: workspace.ownerId,
        role: "owner",
      });

      // Create a default "general" channel
      await this.createChannel({
        name: "general",
        workspaceId: newWorkspace.id,
        description: "General discussions",
        isPrivate: false,
      });

      return newWorkspace;
    } catch (error) {
      console.error("Error creating workspace:", error);
      throw new Error(`Failed to create workspace: ${error.message}`);
    }
  }

  async getWorkspace(id: number): Promise<Workspace | undefined> {
    try {
      const [workspace] = await this.db
        .select()
        .from(workspaces)
        .where(sql`${workspaces.id} = ${id}`)
        .limit(1);
      return workspace;
    } catch (error) {
      console.error("Error getting workspace:", error);
      return undefined;
    }
  }

  async getWorkspacesByUserId(userId: number): Promise<Workspace[]> {
    try {
      // Join workspaces with workspaceMembers to get workspaces where user is a member
      const result = await this.db
        .select({
          id: workspaces.id,
          name: workspaces.name,
          ownerId: workspaces.ownerId,
          iconText: workspaces.iconText,
          createdAt: workspaces.createdAt,
        })
        .from(workspaces)
        .innerJoin(
          workspaceMembers,
          sql`${workspaceMembers.workspaceId} = ${workspaces.id}`
        )
        .where(sql`${workspaceMembers.userId} = ${userId}`);

      return result;
    } catch (error) {
      console.error("Error getting workspaces by user ID:", error);
      return [];
    }
  }

  // Channel operations
  async createChannel(channel: InsertChannel): Promise<Channel> {
    try {
      const [newChannel] = await this.db
        .insert(channels)
        .values(channel)
        .returning();
      return newChannel;
    } catch (error) {
      console.error("Error creating channel:", error);
      throw new Error(`Failed to create channel: ${error.message}`);
    }
  }

  async getChannel(id: number): Promise<Channel | undefined> {
    try {
      const [channel] = await this.db
        .select()
        .from(channels)
        .where(sql`${channels.id} = ${id}`)
        .limit(1);
      return channel;
    } catch (error) {
      console.error("Error getting channel:", error);
      return undefined;
    }
  }

  async getChannelsByWorkspaceId(
    workspaceId: number
  ): Promise<ChannelWithMemberCount[]> {
    try {
      // Get all channels in the workspace
      const channelsData = await this.db
        .select()
        .from(channels)
        .where(sql`${channels.workspaceId} = ${workspaceId}`);

      // For each channel, count its members
      const result = await Promise.all(
        channelsData.map(async (channel) => {
          // Count members in each channel
          const [{ count: memberCount }] = await this.db
            .select({ count: count() })
            .from(channelMembers)
            .where(sql`${channelMembers.channelId} = ${channel.id}`);

          return {
            ...channel,
            memberCount: Number(memberCount) || 0,
          };
        })
      );

      return result;
    } catch (error) {
      console.error("Error getting channels by workspace ID:", error);
      return [];
    }
  }

  // Message operations
  async createMessage(message: InsertMessage): Promise<MessageWithUser> {
    try {
      // Insert the message into the database
      const [newMessage] = await this.db
        .insert(messages)
        .values({
          ...message,
          channelId: message.channelId || null,
          directMessageId: message.directMessageId || null,
        })
        .returning();

      // Get the user who sent the message to include in the response
      const user = await this.getUser(message.userId);
      if (!user) {
        throw new Error(`User with id ${message.userId} not found`);
      }

      // Return the message with user information
      return { ...newMessage, user };
    } catch (error) {
      console.error("Error creating message:", error);
      throw new Error(`Failed to create message: ${error.message}`);
    }
  }

  async getMessagesByChannelId(channelId: number): Promise<MessageWithUser[]> {
    try {
      const messagesData = await this.db
        .select({
          message: messages,
          user: users,
        })
        .from(messages)
        .innerJoin(users, sql`${users.id} = ${messages.userId}`)
        .where(sql`${messages.channelId} = ${channelId}`)
        .orderBy(messages.createdAt);

      return messagesData.map((item) => ({
        ...item.message,
        user: item.user,
      }));
    } catch (error) {
      console.error("Error getting messages by channel ID:", error);
      return [];
    }
  }

  async getMessagesByDirectMessageId(
    directMessageId: number
  ): Promise<MessageWithUser[]> {
    try {
      const messagesData = await this.db
        .select({
          message: messages,
          user: users,
        })
        .from(messages)
        .innerJoin(users, sql`${users.id} = ${messages.userId}`)
        .where(sql`${messages.directMessageId} = ${directMessageId}`)
        .orderBy(messages.createdAt);

      return messagesData.map((item) => ({
        ...item.message,
        user: item.user,
      }));
    } catch (error) {
      console.error("Error getting messages by direct message ID:", error);
      return [];
    }
  }

  // Direct Message operations
  async createDirectMessage(dm: InsertDirectMessage): Promise<DirectMessage> {
    try {
      const [directMessage] = await this.db
        .insert(directMessages)
        .values(dm)
        .returning();
      return directMessage;
    } catch (error) {
      console.error("Error creating direct message:", error);
      throw new Error(`Failed to create direct message: ${error.message}`);
    }
  }

  async getDirectMessage(id: number): Promise<DirectMessage | undefined> {
    try {
      const [dm] = await this.db
        .select()
        .from(directMessages)
        .where(sql`${directMessages.id} = ${id}`)
        .limit(1);
      return dm;
    } catch (error) {
      console.error("Error getting direct message:", error);
      return undefined;
    }
  }

  async getDirectMessageByUserIds(
    user1Id: number,
    user2Id: number
  ): Promise<DirectMessage | undefined> {
    try {
      // Check both possible combinations of user IDs
      const [dm] = await this.db
        .select()
        .from(directMessages)
        .where(
          sql`(${directMessages.user1Id} = ${user1Id} AND ${directMessages.user2Id} = ${user2Id}) OR 
              (${directMessages.user1Id} = ${user2Id} AND ${directMessages.user2Id} = ${user1Id})`
        )
        .limit(1);
      return dm;
    } catch (error) {
      console.error("Error getting direct message by user IDs:", error);
      return undefined;
    }
  }

  async getDirectMessagesByUserId(
    userId: number
  ): Promise<DirectMessageWithUser[]> {
    try {
      // Get direct messages where user is either user1 or user2
      const dms = await this.db
        .select()
        .from(directMessages)
        .where(
          sql`${directMessages.user1Id} = ${userId} OR ${directMessages.user2Id} = ${userId}`
        );

      // For each DM, get the other user and the last message
      const enrichedDms = await Promise.all(
        dms.map(async (dm) => {
          const otherUserId = dm.user1Id === userId ? dm.user2Id : dm.user1Id;
          const otherUser = await this.getUser(otherUserId);

          if (!otherUser) {
            throw new Error(`User with ID ${otherUserId} not found`);
          }

          // Get the most recent message
          const messages = await this.getMessagesByDirectMessageId(dm.id);
          const lastMessage =
            messages.length > 0 ? messages[messages.length - 1] : undefined;

          return {
            ...dm,
            otherUser,
            lastMessage,
          };
        })
      );

      return enrichedDms;
    } catch (error) {
      console.error("Error getting direct messages by user ID:", error);
      return [];
    }
  }

  // Workspace membership operations
  async addWorkspaceMember(
    member: InsertWorkspaceMember
  ): Promise<WorkspaceMember> {
    try {
      const [newMember] = await this.db
        .insert(workspaceMembers)
        .values(member)
        .returning();
      return newMember;
    } catch (error) {
      console.error("Error adding workspace member:", error);
      throw new Error(`Failed to add workspace member: ${error.message}`);
    }
  }

  async getWorkspaceMembersByWorkspaceId(
    workspaceId: number
  ): Promise<(WorkspaceMember & { user: User })[]> {
    try {
      const members = await this.db
        .select({
          id: workspaceMembers.id,
          workspaceId: workspaceMembers.workspaceId,
          userId: workspaceMembers.userId,
          role: workspaceMembers.role,
          user: users,
        })
        .from(workspaceMembers)
        .innerJoin(users, sql`${users.id} = ${workspaceMembers.userId}`)
        .where(sql`${workspaceMembers.workspaceId} = ${workspaceId}`);

      return members.map((member) => ({
        id: member.id,
        workspaceId: member.workspaceId,
        userId: member.userId,
        role: member.role,
        user: member.user,
      }));
    } catch (error) {
      console.error("Error getting workspace members:", error);
      return [];
    }
  }

  async getWorkspaceMember(
    userId: number,
    workspaceId: number
  ): Promise<WorkspaceMember | undefined> {
    try {
      const [member] = await this.db
        .select()
        .from(workspaceMembers)
        .where(
          sql`${workspaceMembers.userId} = ${userId} AND ${workspaceMembers.workspaceId} = ${workspaceId}`
        )
        .limit(1);
      return member;
    } catch (error) {
      console.error("Error getting workspace member:", error);
      return undefined;
    }
  }

  async isUserInWorkspace(
    userId: number,
    workspaceId: number
  ): Promise<boolean> {
    try {
      const member = await this.getWorkspaceMember(userId, workspaceId);
      return !!member;
    } catch (error) {
      console.error("Error checking if user is in workspace:", error);
      return false;
    }
  }

  async updateWorkspaceMemberRole(
    userId: number,
    workspaceId: number,
    role: string
  ): Promise<WorkspaceMember | undefined> {
    try {
      const [updatedMember] = await this.db
        .update(workspaceMembers)
        .set({ role })
        .where(
          sql`${workspaceMembers.userId} = ${userId} AND ${workspaceMembers.workspaceId} = ${workspaceId}`
        )
        .returning();
      return updatedMember;
    } catch (error) {
      console.error("Error updating workspace member role:", error);
      return undefined;
    }
  }

  async removeWorkspaceMember(
    userId: number,
    workspaceId: number
  ): Promise<boolean> {
    try {
      const result = await this.db
        .delete(workspaceMembers)
        .where(
          sql`${workspaceMembers.userId} = ${userId} AND ${workspaceMembers.workspaceId} = ${workspaceId}`
        );
      return true;
    } catch (error) {
      console.error("Error removing workspace member:", error);
      return false;
    }
  }

  async getWorkspaceOwners(workspaceId: number): Promise<WorkspaceMember[]> {
    try {
      const owners = await this.db
        .select()
        .from(workspaceMembers)
        .where(
          sql`${workspaceMembers.workspaceId} = ${workspaceId} AND ${workspaceMembers.role} = 'owner'`
        );
      return owners;
    } catch (error) {
      console.error("Error getting workspace owners:", error);
      return [];
    }
  }

  // Channel membership operations
  async addChannelMember(member: InsertChannelMember): Promise<ChannelMember> {
    try {
      const [newMember] = await this.db
        .insert(channelMembers)
        .values(member)
        .returning();
      return newMember;
    } catch (error) {
      console.error("Error adding channel member:", error);
      throw new Error(`Failed to add channel member: ${error.message}`);
    }
  }

  async getChannelMembersByChannelId(
    channelId: number
  ): Promise<(ChannelMember & { user: User })[]> {
    try {
      const members = await this.db
        .select({
          id: channelMembers.id,
          channelId: channelMembers.channelId,
          userId: channelMembers.userId,
          user: users,
        })
        .from(channelMembers)
        .innerJoin(users, sql`${users.id} = ${channelMembers.userId}`)
        .where(sql`${channelMembers.channelId} = ${channelId}`);

      return members.map((member) => ({
        id: member.id,
        channelId: member.channelId,
        userId: member.userId,
        user: member.user,
      }));
    } catch (error) {
      console.error("Error getting channel members:", error);
      return [];
    }
  }

  async isUserInChannel(userId: number, channelId: number): Promise<boolean> {
    try {
      const [member] = await this.db
        .select()
        .from(channelMembers)
        .where(
          sql`${channelMembers.userId} = ${userId} AND ${channelMembers.channelId} = ${channelId}`
        )
        .limit(1);
      return !!member;
    } catch (error) {
      console.error("Error checking if user is in channel:", error);
      return false;
    }
  }

  // Workspace invitation operations
  async createWorkspaceInvitation(
    data: InsertWorkspaceInvitation
  ): Promise<WorkspaceInvitation> {
    try {
      const [invitation] = await this.db
        .insert(workspaceInvitations)
        .values(data)
        .returning();
      return invitation;
    } catch (error) {
      console.error("Error creating workspace invitation:", error);
      throw new Error(
        `Failed to create workspace invitation: ${error.message}`
      );
    }
  }

  async getWorkspaceInvitationByToken(
    token: string
  ): Promise<WorkspaceInvitation | null> {
    try {
      const [invitation] = await this.db
        .select()
        .from(workspaceInvitations)
        .where(sql`${workspaceInvitations.token} = ${token}`)
        .limit(1);

      return invitation || null;
    } catch (error) {
      console.error("Error fetching workspace invitation by token:", error);
      return null;
    }
  }

  async deleteWorkspaceInvitation(id: number): Promise<boolean> {
    try {
      await this.db
        .delete(workspaceInvitations)
        .where(sql`${workspaceInvitations.id} = ${id}`);
      return true;
    } catch (error) {
      console.error("Error deleting workspace invitation:", error);
      return false;
    }
  }

  // Search users by username or display name
  async searchUsers(searchTerm: string): Promise<User[]> {
    try {
      const users = await this.db
        .select()
        .from(users)
        .where(
          sql`${users.username} ILIKE ${`%${searchTerm}%`} OR ${
            users.displayName
          } ILIKE ${`%${searchTerm}%`}`
        )
        .limit(20);

      return users;
    } catch (error) {
      console.error("Error searching users:", error);
      return [];
    }
  }
}

// Use the DatabaseStorage implementation and inject the db client
export const storage = new DatabaseStorage(dbClient);
