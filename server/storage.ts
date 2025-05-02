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
      password: "password",
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
  async createWorkspace(insertWorkspace: InsertWorkspace): Promise<Workspace> {
    const id = this.workspaceId++;
    const now = new Date();
    const workspace: Workspace = { ...insertWorkspace, id, createdAt: now };
    this.workspaces.set(id, workspace);

    // Automatically add the owner as a member with 'owner' role
    await this.addWorkspaceMember({
      workspaceId: id,
      userId: insertWorkspace.ownerId,
      role: "owner",
    });

    // Create a default general channel
    await this.createChannel({
      name: "general",
      workspaceId: id,
      description: "General discussions",
      isPrivate: false,
    });

    return workspace;
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
  async createDirectMessage(
    insertDM: InsertDirectMessage
  ): Promise<DirectMessage> {
    const id = this.directMessageId++;
    const now = new Date();
    const dm: DirectMessage = { ...insertDM, id, createdAt: now };
    this.directMessages.set(id, dm);
    return dm;
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
    insertMember: InsertWorkspaceMember
  ): Promise<WorkspaceMember> {
    const id = this.workspaceMemberId++;
    const member: WorkspaceMember = {
      ...insertMember,
      id,
      role: insertMember.role || "member",
    };
    this.workspaceMembers.set(id, member);
    return member;
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

export class DatabaseStorage implements IStorage {
  private db: NodePgDatabase;

  constructor(databaseClient: NodePgDatabase) {
    this.db = databaseClient;
  }

  async getUser(id: number): Promise<User | undefined> {
    const [user] = await this.db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await this.db
      .select()
      .from(users)
      .where(eq(users.username, username));
    return user || undefined;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    console.log(`DatabaseStorage: Attempting to find user by email: ${email}`);
    try {
      const result = await this.db
        .select()
        .from(users)
        .where(eq(users.email, email.toLowerCase()))
        .limit(1);

      console.log(`DatabaseStorage: Found user by email result:`, result[0]);
      if (result && result.length > 0) {
        return result[0] as User;
      } else {
        return undefined;
      }
    } catch (error) {
      console.error(
        `DatabaseStorage: Error fetching user by email ${email}:`,
        error
      );
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      throw new Error(`Database error fetching user by email: ${errorMessage}`);
    }
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    if (insertUser.password && !insertUser.password.startsWith("$2b$")) {
      const hashedPassword = await bcrypt.hash(insertUser.password, 10);
      insertUser.password = hashedPassword;
    }

    const userToInsert = {
      ...insertUser,
      status: "online",
      avatarUrl: insertUser.avatarUrl || null,
    };

    const [user] = await this.db.insert(users).values(userToInsert).returning();
    return user;
  }

  async updateUserStatus(
    id: number,
    status: string
  ): Promise<User | undefined> {
    const [updatedUser] = await this.db
      .update(users)
      .set({ status })
      .where(eq(users.id, id))
      .returning();

    return updatedUser || undefined;
  }

  async createWorkspace(insertWorkspace: InsertWorkspace): Promise<Workspace> {
    return await this.db.transaction(async (tx) => {
      const [workspace] = await tx
        .insert(workspaces)
        .values(insertWorkspace)
        .returning();

      await tx.insert(workspaceMembers).values({
        workspaceId: workspace.id,
        userId: insertWorkspace.ownerId,
        role: "owner",
      });

      const [channel] = await tx
        .insert(channels)
        .values({
          name: "general",
          workspaceId: workspace.id,
          description: "General discussions",
          isPrivate: false,
        })
        .returning();

      await tx.insert(channelMembers).values({
        channelId: channel.id,
        userId: insertWorkspace.ownerId,
      });

      return workspace;
    });
  }

  async getWorkspace(id: number): Promise<Workspace | undefined> {
    const [workspace] = await this.db
      .select()
      .from(workspaces)
      .where(eq(workspaces.id, id));

    return workspace || undefined;
  }

  async getWorkspacesByUserId(userId: number): Promise<Workspace[]> {
    return await this.db
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
        eq(workspaces.id, workspaceMembers.workspaceId)
      )
      .where(eq(workspaceMembers.userId, userId));
  }

  async createChannel(insertChannel: InsertChannel): Promise<Channel> {
    const [channel] = await this.db
      .insert(channels)
      .values({
        ...insertChannel,
        description: insertChannel.description || null,
        isPrivate: insertChannel.isPrivate || false,
      })
      .returning();

    return channel;
  }

  async getChannel(id: number): Promise<Channel | undefined> {
    const [channel] = await this.db
      .select()
      .from(channels)
      .where(eq(channels.id, id));

    return channel || undefined;
  }

  async getChannelsByWorkspaceId(
    workspaceId: number
  ): Promise<ChannelWithMemberCount[]> {
    return await this.db
      .select({
        id: channels.id,
        name: channels.name,
        workspaceId: channels.workspaceId,
        description: channels.description,
        isPrivate: channels.isPrivate,
        createdAt: channels.createdAt,
        memberCount: count(channelMembers.id).as("memberCount"),
      })
      .from(channels)
      .leftJoin(channelMembers, eq(channels.id, channelMembers.channelId))
      .where(eq(channels.workspaceId, workspaceId))
      .groupBy(channels.id);
  }

  async createMessage(insertMessage: InsertMessage): Promise<MessageWithUser> {
    const [message] = await this.db
      .insert(messages)
      .values({
        ...insertMessage,
        channelId: insertMessage.channelId || null,
        directMessageId: insertMessage.directMessageId || null,
      })
      .returning();

    const [user] = await this.db
      .select()
      .from(users)
      .where(eq(users.id, message.userId));

    if (!user) {
      throw new Error(`User with id ${message.userId} not found`);
    }

    return { ...message, user };
  }

  async getMessagesByChannelId(channelId: number): Promise<MessageWithUser[]> {
    return await this.db
      .select({
        id: messages.id,
        content: messages.content,
        userId: messages.userId,
        channelId: messages.channelId,
        directMessageId: messages.directMessageId,
        createdAt: messages.createdAt,
        user: users,
      })
      .from(messages)
      .innerJoin(users, eq(messages.userId, users.id))
      .where(eq(messages.channelId, channelId))
      .orderBy(messages.createdAt);
  }

  async getMessagesByDirectMessageId(
    directMessageId: number
  ): Promise<MessageWithUser[]> {
    return await this.db
      .select({
        id: messages.id,
        content: messages.content,
        userId: messages.userId,
        channelId: messages.channelId,
        directMessageId: messages.directMessageId,
        createdAt: messages.createdAt,
        user: users,
      })
      .from(messages)
      .innerJoin(users, eq(messages.userId, users.id))
      .where(eq(messages.directMessageId, directMessageId))
      .orderBy(messages.createdAt);
  }

  async createDirectMessage(
    insertDM: InsertDirectMessage
  ): Promise<DirectMessage> {
    const [dm] = await this.db
      .insert(directMessages)
      .values(insertDM)
      .returning();

    return dm;
  }

  async getDirectMessage(id: number): Promise<DirectMessage | undefined> {
    const [dm] = await this.db
      .select()
      .from(directMessages)
      .where(eq(directMessages.id, id));

    return dm || undefined;
  }

  async getDirectMessageByUserIds(
    user1Id: number,
    user2Id: number
  ): Promise<DirectMessage | undefined> {
    const [dm] = await this.db
      .select()
      .from(directMessages)
      .where(
        or(
          and(
            eq(directMessages.user1Id, user1Id),
            eq(directMessages.user2Id, user2Id)
          ),
          and(
            eq(directMessages.user1Id, user2Id),
            eq(directMessages.user2Id, user1Id)
          )
        )
      );

    return dm || undefined;
  }

  async getDirectMessagesByUserId(
    userId: number
  ): Promise<DirectMessageWithUser[]> {
    const results = await this.db.transaction(async (tx) => {
      const directMessagesForUser = await tx
        .select()
        .from(directMessages)
        .where(
          or(
            eq(directMessages.user1Id, userId),
            eq(directMessages.user2Id, userId)
          )
        );

      return await Promise.all(
        directMessagesForUser.map(async (dm) => {
          const otherUserId = dm.user1Id === userId ? dm.user2Id : dm.user1Id;

          const [otherUser] = await tx
            .select()
            .from(users)
            .where(eq(users.id, otherUserId));

          if (!otherUser) {
            throw new Error(`User with id ${otherUserId} not found`);
          }

          const [lastMessage] = await tx
            .select({
              id: messages.id,
              content: messages.content,
              userId: messages.userId,
              channelId: messages.channelId,
              directMessageId: messages.directMessageId,
              createdAt: messages.createdAt,
              user: users,
            })
            .from(messages)
            .innerJoin(users, eq(messages.userId, users.id))
            .where(eq(messages.directMessageId, dm.id))
            .orderBy(desc(messages.createdAt))
            .limit(1);

          return {
            ...dm,
            otherUser,
            lastMessage,
          };
        })
      );
    });

    return results;
  }

  async addWorkspaceMember(
    insertMember: InsertWorkspaceMember
  ): Promise<WorkspaceMember> {
    const [member] = await this.db
      .insert(workspaceMembers)
      .values({
        ...insertMember,
        role: insertMember.role || "member",
      })
      .returning();

    return member;
  }

  async getWorkspaceMembersByWorkspaceId(
    workspaceId: number
  ): Promise<(WorkspaceMember & { user: User })[]> {
    return await this.db
      .select({
        id: workspaceMembers.id,
        workspaceId: workspaceMembers.workspaceId,
        userId: workspaceMembers.userId,
        role: workspaceMembers.role,
        user: users,
      })
      .from(workspaceMembers)
      .innerJoin(users, eq(workspaceMembers.userId, users.id))
      .where(eq(workspaceMembers.workspaceId, workspaceId));
  }

  async getWorkspaceMember(
    userId: number,
    workspaceId: number
  ): Promise<WorkspaceMember | undefined> {
    const [member] = await this.db
      .select()
      .from(workspaceMembers)
      .where(
        and(
          eq(workspaceMembers.userId, userId),
          eq(workspaceMembers.workspaceId, workspaceId)
        )
      )
      .limit(1);
    return member;
  }

  async isUserInWorkspace(
    userId: number,
    workspaceId: number
  ): Promise<boolean> {
    const result = await this.db
      .select({ memberCount: count() })
      .from(workspaceMembers)
      .where(
        and(
          eq(workspaceMembers.userId, userId),
          eq(workspaceMembers.workspaceId, workspaceId)
        )
      );

    return result[0].memberCount > 0;
  }

  async updateWorkspaceMemberRole(
    userId: number,
    workspaceId: number,
    role: string
  ): Promise<WorkspaceMember | undefined> {
    const [updatedMember] = await this.db
      .update(workspaceMembers)
      .set({ role })
      .where(
        and(
          eq(workspaceMembers.userId, userId),
          eq(workspaceMembers.workspaceId, workspaceId)
        )
      )
      .returning();
    return updatedMember;
  }

  async removeWorkspaceMember(
    userId: number,
    workspaceId: number
  ): Promise<boolean> {
    const result = await this.db
      .delete(workspaceMembers)
      .where(
        and(
          eq(workspaceMembers.userId, userId),
          eq(workspaceMembers.workspaceId, workspaceId)
        )
      );
    return result?.rowCount ? result.rowCount > 0 : false;
  }

  async getWorkspaceOwners(workspaceId: number): Promise<WorkspaceMember[]> {
    return await this.db
      .select()
      .from(workspaceMembers)
      .where(
        and(
          eq(workspaceMembers.workspaceId, workspaceId),
          eq(workspaceMembers.role, "owner")
        )
      );
  }

  async addChannelMember(
    insertMember: InsertChannelMember
  ): Promise<ChannelMember> {
    const [member] = await this.db
      .insert(channelMembers)
      .values(insertMember)
      .returning();

    return member;
  }

  async getChannelMembersByChannelId(
    channelId: number
  ): Promise<(ChannelMember & { user: User })[]> {
    return await this.db
      .select({
        id: channelMembers.id,
        channelId: channelMembers.channelId,
        userId: channelMembers.userId,
        user: users,
      })
      .from(channelMembers)
      .innerJoin(users, eq(channelMembers.userId, users.id))
      .where(eq(channelMembers.channelId, channelId));
  }

  async isUserInChannel(userId: number, channelId: number): Promise<boolean> {
    const result = await this.db
      .select({ memberCount: count() })
      .from(channelMembers)
      .where(
        and(
          eq(channelMembers.userId, userId),
          eq(channelMembers.channelId, channelId)
        )
      );

    return result[0].memberCount > 0;
  }

  async searchUsers(searchTerm: string): Promise<User[]> {
    return await this.db
      .select()
      .from(users)
      .where(
        or(
          ilike(users.username, `%${searchTerm}%`),
          ilike(users.displayName, `%${searchTerm}%`)
        )
      )
      .limit(20);
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

// Use the DatabaseStorage implementation and inject the db client
export const storage = new DatabaseStorage(dbClient);
