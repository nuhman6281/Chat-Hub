import {
  users,
  workspaces,
  channels,
  messages,
  directMessages,
  workspaceMembers,
  channelMembers,
  messageReactions,
  fileUploads,
  type User,
  type InsertUser,
  type Workspace,
  type InsertWorkspace,
  type Channel,
  type InsertChannel,
  type Message,
  type InsertMessage,
  type MessageWithUser,
  type DirectMessage,
  type InsertDirectMessage,
  type DirectMessageWithUser,
  type WorkspaceMember,
  type InsertWorkspaceMember,
  type ChannelMember,
  type InsertChannelMember,
  type ChannelWithMemberCount,
  type MessageReaction,
  type InsertMessageReaction,
  type FileUpload,
  type InsertFileUpload,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, or, desc, sql } from "drizzle-orm";
import session from "express-session";
import connectPg from "connect-pg-simple";
import createMemoryStore from "memorystore";
import { pool } from "./db";

const PostgresSessionStore = connectPg(session);
const MemoryStore = createMemoryStore(session);

export interface IStorage {
  // User operations
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUserStatus(id: number, status: string): Promise<User | undefined>;
  updateUserPublicKey(id: number, publicKey: string): Promise<User | undefined>;

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
  isUserInWorkspace(userId: number, workspaceId: number): Promise<boolean>;

  // Channel membership operations
  addChannelMember(member: InsertChannelMember): Promise<ChannelMember>;
  getChannelMembersByChannelId(
    channelId: number
  ): Promise<(ChannelMember & { user: User })[]>;
  isUserInChannel(userId: number, channelId: number): Promise<boolean>;

  // Search operations
  searchUsers(searchTerm: string): Promise<User[]>;

  // Message reactions
  addMessageReaction(reaction: InsertMessageReaction): Promise<MessageReaction>;
  getMessageReactions(
    messageId: number
  ): Promise<(MessageReaction & { user: User })[]>;
  removeMessageReaction(
    messageId: number,
    userId: number,
    emoji: string
  ): Promise<boolean>;

  // Thread messages
  getThreadMessages(parentMessageId: number): Promise<MessageWithUser[]>;
  updateThreadCount(messageId: number, count: number): Promise<void>;

  // Search messages
  searchMessages(query: string, userId: number): Promise<MessageWithUser[]>;

  // File uploads
  createFileUpload(file: InsertFileUpload): Promise<FileUpload>;
  getFileUpload(id: number): Promise<FileUpload | undefined>;
  getMessageById(id: number): Promise<MessageWithUser | undefined>;

  // Session store
  sessionStore: any;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private workspaces: Map<number, Workspace>;
  private channels: Map<number, Channel>;
  private messages: Map<number, Message>;
  private directMessages: Map<number, DirectMessage>;
  private workspaceMembers: Map<number, WorkspaceMember>;
  private channelMembers: Map<number, ChannelMember>;
  private messageReactions: Map<number, MessageReaction>;
  private fileUploads: Map<number, FileUpload>;

  private userId: number = 1;
  private workspaceId: number = 1;
  private channelId: number = 1;
  private messageId: number = 1;
  private directMessageId: number = 1;
  private workspaceMemberId: number = 1;
  private channelMemberId: number = 1;
  private messageReactionId: number = 1;
  private fileUploadId: number = 1;

  sessionStore: any;

  constructor() {
    this.users = new Map();
    this.workspaces = new Map();
    this.channels = new Map();
    this.messages = new Map();
    this.directMessages = new Map();
    this.workspaceMembers = new Map();
    this.channelMembers = new Map();
    this.messageReactions = new Map();
    this.fileUploads = new Map();

    this.sessionStore = new MemoryStore({
      checkPeriod: 86400000,
    });

    // Seed initial data
    const seedUser: User = {
      id: 1,
      username: "demo",
      password: "$2b$10$K8QVw8VX7z0Z9Z0Z9Z0Z9u.K8QVw8VX7z0Z9Z0Z9Z0Z9u.K8QVw8VX",
      displayName: "Demo User",
      status: "online",
      avatarUrl: null,
      publicKey: null,
    };
    this.users.set(1, seedUser);

    const seedWorkspace: Workspace = {
      id: 1,
      name: "Demo Workspace",
      ownerId: 1,
      iconText: "DW",
      createdAt: new Date(),
    };
    this.workspaces.set(1, seedWorkspace);

    const membership: WorkspaceMember = {
      id: 1,
      userId: 1,
      workspaceId: 1,
      role: "owner",
    };
    this.workspaceMembers.set(1, membership);

    const generalChannel: Channel = {
      id: 1,
      name: "general",
      workspaceId: 1,
      description: null,
      isPrivate: false,
      createdAt: new Date(),
    };
    this.channels.set(1, generalChannel);

    const channelMember: ChannelMember = {
      id: 1,
      userId: 1,
      channelId: 1,
    };
    this.channelMembers.set(1, channelMember);
  }

  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.userId++;
    const user: User = {
      ...insertUser,
      id,
      status: "online",
      avatarUrl: null,
      publicKey: null,
    };
    this.users.set(id, user);
    return user;
  }

  async updateUserStatus(
    id: number,
    status: string
  ): Promise<User | undefined> {
    const user = this.users.get(id);
    if (user) {
      user.status = status;
      return user;
    }
    return undefined;
  }

  async updateUserPublicKey(
    id: number,
    publicKey: string
  ): Promise<User | undefined> {
    const user = this.users.get(id);
    if (user) {
      user.publicKey = publicKey;
      return user;
    }
    return undefined;
  }

  async createWorkspace(insertWorkspace: InsertWorkspace): Promise<Workspace> {
    const id = this.workspaceId++;
    const now = new Date();
    const workspace: Workspace = { ...insertWorkspace, id, createdAt: now };
    this.workspaces.set(id, workspace);
    return workspace;
  }

  async getWorkspace(id: number): Promise<Workspace | undefined> {
    return this.workspaces.get(id);
  }

  async getWorkspacesByUserId(userId: number): Promise<Workspace[]> {
    const userWorkspaces = Array.from(this.workspaceMembers.values())
      .filter((member) => member.userId === userId)
      .map((member) => this.workspaces.get(member.workspaceId))
      .filter((workspace): workspace is Workspace => workspace !== undefined);
    return userWorkspaces;
  }

  async createChannel(insertChannel: InsertChannel): Promise<Channel> {
    const id = this.channelId++;
    const now = new Date();
    const channel: Channel = {
      id,
      name: insertChannel.name,
      workspaceId: insertChannel.workspaceId,
      description: insertChannel.description || null,
      isPrivate: insertChannel.isPrivate || false,
      createdAt: now,
    };
    this.channels.set(id, channel);
    return channel;
  }

  async getChannel(id: number): Promise<Channel | undefined> {
    return this.channels.get(id);
  }

  async getChannelsByWorkspaceId(
    workspaceId: number
  ): Promise<ChannelWithMemberCount[]> {
    const workspaceChannels = Array.from(this.channels.values()).filter(
      (channel) => channel.workspaceId === workspaceId
    );

    return workspaceChannels.map((channel) => {
      const memberCount = Array.from(this.channelMembers.values()).filter(
        (member) => member.channelId === channel.id
      ).length;
      return { ...channel, memberCount };
    });
  }

  async createMessage(insertMessage: InsertMessage): Promise<MessageWithUser> {
    const id = this.messageId++;
    const now = new Date();

    const message: Message = {
      id,
      content: insertMessage.content,
      userId: insertMessage.userId,
      channelId: insertMessage.channelId || null,
      directMessageId: insertMessage.directMessageId || null,
      createdAt: now,
      messageType: insertMessage.messageType || "text",
      mediaUrl: insertMessage.mediaUrl || null,
      mediaType: insertMessage.mediaType || null,
      mediaSize: insertMessage.mediaSize || null,
      replyToId: insertMessage.replyToId || null,
      isEdited: false,
      editedAt: null,
      threadId: insertMessage.threadId || null,
      threadCount: 0,
      isEncrypted: insertMessage.isEncrypted || false,
      encryptedContent: insertMessage.encryptedContent || null,
      nonce: insertMessage.nonce || null,
      senderPublicKey: insertMessage.senderPublicKey || null,
    };

    this.messages.set(id, message);

    const user = await this.getUser(message.userId);
    if (!user) {
      throw new Error(`User with id ${message.userId} not found`);
    }

    return {
      id: message.id,
      content: message.content,
      userId: message.userId,
      channelId: message.channelId,
      directMessageId: message.directMessageId,
      createdAt: message.createdAt,
      messageType: message.messageType,
      mediaUrl: message.mediaUrl,
      mediaType: message.mediaType,
      mediaSize: message.mediaSize,
      replyToId: message.replyToId,
      isEdited: message.isEdited,
      editedAt: message.editedAt,
      threadId: message.threadId,
      threadCount: message.threadCount,
      isEncrypted: message.isEncrypted,
      encryptedContent: message.encryptedContent,
      nonce: message.nonce,
      senderPublicKey: message.senderPublicKey,
      user,
    };
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
        return {
          id: message.id,
          content: message.content,
          userId: message.userId,
          channelId: message.channelId,
          directMessageId: message.directMessageId,
          createdAt: message.createdAt,
          messageType: message.messageType,
          mediaUrl: message.mediaUrl,
          mediaType: message.mediaType,
          mediaSize: message.mediaSize,
          replyToId: message.replyToId,
          isEdited: message.isEdited,
          editedAt: message.editedAt,
          reactions: message.reactions,
          isEncrypted: message.isEncrypted,
          encryptedContent: message.encryptedContent,
          nonce: message.nonce,
          senderPublicKey: message.senderPublicKey,
          user,
        };
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
        return {
          id: message.id,
          content: message.content,
          userId: message.userId,
          channelId: message.channelId,
          directMessageId: message.directMessageId,
          createdAt: message.createdAt,
          messageType: message.messageType,
          mediaUrl: message.mediaUrl,
          mediaType: message.mediaType,
          mediaSize: message.mediaSize,
          replyToId: message.replyToId,
          isEdited: message.isEdited,
          editedAt: message.editedAt,
          reactions: message.reactions,
          isEncrypted: message.isEncrypted,
          encryptedContent: message.encryptedContent,
          nonce: message.nonce,
          senderPublicKey: message.senderPublicKey,
          user,
        };
      })
    );
  }

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
  ): Promise<DirectMessageWithUser | undefined> {
    const dm = Array.from(this.directMessages.values()).find(
      (dm) =>
        (dm.user1Id === user1Id && dm.user2Id === user2Id) ||
        (dm.user1Id === user2Id && dm.user2Id === user1Id)
    );

    if (!dm) return undefined;

    // Determine the other user
    const otherUserId = dm.user1Id === user1Id ? dm.user2Id : dm.user1Id;
    const otherUser = await this.getUser(otherUserId);

    if (!otherUser) {
      throw new Error(`User with id ${otherUserId} not found`);
    }

    const lastMessage = Array.from(this.messages.values())
      .filter((msg) => msg.directMessageId === dm.id)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];

    let lastMessageWithUser;
    if (lastMessage) {
      const lastMessageUser = await this.getUser(lastMessage.userId);
      if (lastMessageUser) {
        lastMessageWithUser = {
          id: lastMessage.id,
          content: lastMessage.content,
          userId: lastMessage.userId,
          channelId: lastMessage.channelId,
          directMessageId: lastMessage.directMessageId,
          createdAt: lastMessage.createdAt,
          messageType: lastMessage.messageType,
          mediaUrl: lastMessage.mediaUrl,
          mediaType: lastMessage.mediaType,
          mediaSize: lastMessage.mediaSize,
          replyToId: lastMessage.replyToId,
          isEdited: lastMessage.isEdited,
          editedAt: lastMessage.editedAt,
          reactions: lastMessage.reactions,
          isEncrypted: lastMessage.isEncrypted,
          encryptedContent: lastMessage.encryptedContent,
          nonce: lastMessage.nonce,
          senderPublicKey: lastMessage.senderPublicKey,
          user: lastMessageUser,
        };
      }
    }

    return {
      id: dm.id,
      user1Id: dm.user1Id,
      user2Id: dm.user2Id,
      createdAt: dm.createdAt,
      otherUser: {
        id: otherUser.id,
        username: otherUser.username,
        displayName: otherUser.displayName,
        status: otherUser.status,
        avatarUrl: otherUser.avatarUrl,
        password: otherUser.password,
        publicKey: otherUser.publicKey,
      },
      lastMessage: lastMessageWithUser,
    };
  }

  async getDirectMessagesByUserId(
    userId: number
  ): Promise<DirectMessageWithUser[]> {
    const userDMs = Array.from(this.directMessages.values()).filter(
      (dm) => dm.user1Id === userId || dm.user2Id === userId
    );

    return Promise.all(
      userDMs.map(async (dm) => {
        const otherUserId = dm.user1Id === userId ? dm.user2Id : dm.user1Id;
        const otherUser = await this.getUser(otherUserId);

        if (!otherUser) {
          throw new Error(`User with id ${otherUserId} not found`);
        }

        const lastMessage = Array.from(this.messages.values())
          .filter((msg) => msg.directMessageId === dm.id)
          .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];

        let lastMessageWithUser;
        if (lastMessage) {
          const lastMessageUser = await this.getUser(lastMessage.userId);
          if (lastMessageUser) {
            lastMessageWithUser = {
              id: lastMessage.id,
              content: lastMessage.content,
              userId: lastMessage.userId,
              channelId: lastMessage.channelId,
              directMessageId: lastMessage.directMessageId,
              createdAt: lastMessage.createdAt,
              messageType: lastMessage.messageType,
              mediaUrl: lastMessage.mediaUrl,
              mediaType: lastMessage.mediaType,
              mediaSize: lastMessage.mediaSize,
              replyToId: lastMessage.replyToId,
              isEdited: lastMessage.isEdited,
              editedAt: lastMessage.editedAt,
              threadId: lastMessage.threadId,
              threadCount: lastMessage.threadCount,
              isEncrypted: lastMessage.isEncrypted,
              encryptedContent: lastMessage.encryptedContent,
              nonce: lastMessage.nonce,
              senderPublicKey: lastMessage.senderPublicKey,
              user: lastMessageUser,
            };
          }
        }

        return {
          ...dm,
          otherUser,
          lastMessage: lastMessageWithUser,
        };
      })
    );
  }

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

  async isUserInWorkspace(
    userId: number,
    workspaceId: number
  ): Promise<boolean> {
    return Array.from(this.workspaceMembers.values()).some(
      (member) => member.userId === userId && member.workspaceId === workspaceId
    );
  }

  async addChannelMember(
    insertMember: InsertChannelMember
  ): Promise<ChannelMember> {
    const id = this.channelMemberId++;
    const member: ChannelMember = { ...insertMember, id };
    this.channelMembers.set(id, member);
    return member;
  }

  async getChannelMembersByChannelId(
    channelId: number
  ): Promise<(ChannelMember & { user: User })[]> {
    const members = Array.from(this.channelMembers.values()).filter(
      (member) => member.channelId === channelId
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

  async isUserInChannel(userId: number, channelId: number): Promise<boolean> {
    return Array.from(this.channelMembers.values()).some(
      (member) => member.userId === userId && member.channelId === channelId
    );
  }

  async searchUsers(searchTerm: string): Promise<User[]> {
    return Array.from(this.users.values()).filter(
      (user) =>
        user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.displayName.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }

  async addMessageReaction(
    reaction: InsertMessageReaction
  ): Promise<MessageReaction> {
    const id = this.messageReactionId++;
    const newReaction: MessageReaction = {
      ...reaction,
      id,
      createdAt: new Date(),
    };
    this.messageReactions.set(id, newReaction);
    return newReaction;
  }

  async getMessageReactions(
    messageId: number
  ): Promise<(MessageReaction & { user: User })[]> {
    const reactions = Array.from(this.messageReactions.values()).filter(
      (reaction) => reaction.messageId === messageId
    );

    return reactions.map((reaction) => {
      const user = this.users.get(reaction.userId);
      if (!user) throw new Error(`User with id ${reaction.userId} not found`);
      return { ...reaction, user };
    });
  }

  async removeMessageReaction(
    messageId: number,
    userId: number,
    emoji: string
  ): Promise<boolean> {
    const reaction = Array.from(this.messageReactions.values()).find(
      (r) =>
        r.messageId === messageId && r.userId === userId && r.emoji === emoji
    );

    if (reaction) {
      this.messageReactions.delete(reaction.id);
      return true;
    }
    return false;
  }

  async createFileUpload(file: InsertFileUpload): Promise<FileUpload> {
    const id = this.fileUploadId++;
    const newFile: FileUpload = {
      ...file,
      id,
      createdAt: new Date(),
    };
    this.fileUploads.set(id, newFile);
    return newFile;
  }

  async getFileUpload(id: number): Promise<FileUpload | undefined> {
    return this.fileUploads.get(id);
  }

  async getMessageById(id: number): Promise<MessageWithUser | undefined> {
    const message = this.messages.get(id);
    if (!message) return undefined;

    const user = this.users.get(message.userId);
    if (!user) return undefined;

    return { ...message, user };
  }

  async getThreadMessages(parentMessageId: number): Promise<MessageWithUser[]> {
    const threadMessages = Array.from(this.messages.values())
      .filter((message) => message.threadId === parentMessageId)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

    const messagesWithUsers = threadMessages
      .map((message) => {
        const user = this.users.get(message.userId);
        return user ? { ...message, user } : null;
      })
      .filter((message): message is MessageWithUser => message !== null);

    return messagesWithUsers;
  }

  async updateThreadCount(messageId: number, count: number): Promise<void> {
    const message = this.messages.get(messageId);
    if (message) {
      message.threadCount = count;
    }
  }

  async searchMessages(
    query: string,
    userId: number
  ): Promise<MessageWithUser[]> {
    const normalizedQuery = query.toLowerCase().trim();
    if (!normalizedQuery) return [];

    // Get all messages the user has access to
    const userWorkspaces = Array.from(this.workspaceMembers.values())
      .filter((member) => member.userId === userId)
      .map((member) => member.workspaceId);

    const userChannels = Array.from(this.channelMembers.values())
      .filter((member) => member.userId === userId)
      .map((member) => member.channelId);

    const userDirectMessages = Array.from(this.directMessages.values())
      .filter((dm) => dm.user1Id === userId || dm.user2Id === userId)
      .map((dm) => dm.id);

    const searchResults = Array.from(this.messages.values())
      .filter((message) => {
        // Check access permissions
        const hasChannelAccess =
          message.channelId && userChannels.includes(message.channelId);
        const hasDMAccess =
          message.directMessageId &&
          userDirectMessages.includes(message.directMessageId);

        if (!hasChannelAccess && !hasDMAccess) return false;

        // Search in content
        const contentMatch = message.content
          .toLowerCase()
          .includes(normalizedQuery);

        // Search in user names
        const user = this.users.get(message.userId);
        const userMatch =
          user &&
          (user.displayName.toLowerCase().includes(normalizedQuery) ||
            user.username.toLowerCase().includes(normalizedQuery));

        return contentMatch || userMatch;
      })
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, 50); // Limit results

    const messagesWithUsers = searchResults
      .map((message) => {
        const user = this.users.get(message.userId);
        return user ? { ...message, user } : null;
      })
      .filter((message): message is MessageWithUser => message !== null);

    return messagesWithUsers;
  }
}

export class DatabaseStorage implements IStorage {
  sessionStore: any;

  constructor() {
    // Use memory store for sessions to avoid PostgreSQL session conflicts
    // while keeping all other data in PostgreSQL database
    this.sessionStore = new MemoryStore({
      checkPeriod: 86400000, // prune expired entries every 24h
    });
  }

  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.username, username));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async updateUserStatus(
    id: number,
    status: string
  ): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set({ status })
      .where(eq(users.id, id))
      .returning();
    return user || undefined;
  }

  async updateUserPublicKey(
    id: number,
    publicKey: string
  ): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set({ publicKey })
      .where(eq(users.id, id))
      .returning();
    return user || undefined;
  }

  async createWorkspace(insertWorkspace: InsertWorkspace): Promise<Workspace> {
    const [workspace] = await db
      .insert(workspaces)
      .values(insertWorkspace)
      .returning();
    return workspace;
  }

  async getWorkspace(id: number): Promise<Workspace | undefined> {
    const [workspace] = await db
      .select()
      .from(workspaces)
      .where(eq(workspaces.id, id));
    return workspace || undefined;
  }

  async getWorkspacesByUserId(userId: number): Promise<Workspace[]> {
    const result = await db
      .select({ workspace: workspaces })
      .from(workspaces)
      .innerJoin(
        workspaceMembers,
        eq(workspaces.id, workspaceMembers.workspaceId)
      )
      .where(eq(workspaceMembers.userId, userId));

    return result.map((r) => r.workspace);
  }

  async createChannel(insertChannel: InsertChannel): Promise<Channel> {
    const [channel] = await db
      .insert(channels)
      .values(insertChannel)
      .returning();
    return channel;
  }

  async getChannel(id: number): Promise<Channel | undefined> {
    const [channel] = await db
      .select()
      .from(channels)
      .where(eq(channels.id, id));
    return channel || undefined;
  }

  async getChannelsByWorkspaceId(
    workspaceId: number
  ): Promise<ChannelWithMemberCount[]> {
    const result = await db
      .select({
        channel: channels,
        memberCount: sql<number>`count(${channelMembers.id})`.as("memberCount"),
      })
      .from(channels)
      .leftJoin(channelMembers, eq(channels.id, channelMembers.channelId))
      .where(eq(channels.workspaceId, workspaceId))
      .groupBy(channels.id);

    return result.map((r) => ({ ...r.channel, memberCount: r.memberCount }));
  }

  async createMessage(insertMessage: InsertMessage): Promise<MessageWithUser> {
    const [message] = await db
      .insert(messages)
      .values(insertMessage)
      .returning();

    const user = await this.getUser(message.userId);
    if (!user) {
      throw new Error(`User with id ${message.userId} not found`);
    }

    return { ...message, user };
  }

  async getMessagesByChannelId(channelId: number): Promise<MessageWithUser[]> {
    const result = await db
      .select({ message: messages, user: users })
      .from(messages)
      .innerJoin(users, eq(messages.userId, users.id))
      .where(eq(messages.channelId, channelId))
      .orderBy(messages.createdAt);

    return result.map((r) => ({ ...r.message, user: r.user }));
  }

  async getMessagesByDirectMessageId(
    directMessageId: number
  ): Promise<MessageWithUser[]> {
    const result = await db
      .select({ message: messages, user: users })
      .from(messages)
      .innerJoin(users, eq(messages.userId, users.id))
      .where(eq(messages.directMessageId, directMessageId))
      .orderBy(messages.createdAt);

    return result.map((r) => ({ ...r.message, user: r.user }));
  }

  async createDirectMessage(
    insertDM: InsertDirectMessage
  ): Promise<DirectMessage> {
    const [dm] = await db.insert(directMessages).values(insertDM).returning();
    return dm;
  }

  async getDirectMessage(id: number): Promise<DirectMessage | undefined> {
    const [dm] = await db
      .select()
      .from(directMessages)
      .where(eq(directMessages.id, id));
    return dm || undefined;
  }

  async getDirectMessageByUserIds(
    user1Id: number,
    user2Id: number
  ): Promise<DirectMessage | undefined> {
    const [dm] = await db
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
    const dms = await db
      .select()
      .from(directMessages)
      .where(
        or(
          eq(directMessages.user1Id, userId),
          eq(directMessages.user2Id, userId)
        )
      );

    return Promise.all(
      dms.map(async (dm) => {
        const otherUserId = dm.user1Id === userId ? dm.user2Id : dm.user1Id;
        const otherUser = await this.getUser(otherUserId);

        if (!otherUser) {
          throw new Error(`User with id ${otherUserId} not found`);
        }

        const lastMessages = await db
          .select({ message: messages, user: users })
          .from(messages)
          .innerJoin(users, eq(messages.userId, users.id))
          .where(eq(messages.directMessageId, dm.id))
          .orderBy(desc(messages.createdAt))
          .limit(1);

        const lastMessage = lastMessages[0];

        return {
          ...dm,
          otherUser,
          lastMessage: lastMessage
            ? { ...lastMessage.message, user: lastMessage.user }
            : undefined,
        };
      })
    );
  }

  async addWorkspaceMember(
    insertMember: InsertWorkspaceMember
  ): Promise<WorkspaceMember> {
    const [member] = await db
      .insert(workspaceMembers)
      .values(insertMember)
      .returning();
    return member;
  }

  async getWorkspaceMembersByWorkspaceId(
    workspaceId: number
  ): Promise<(WorkspaceMember & { user: User })[]> {
    const result = await db
      .select({ member: workspaceMembers, user: users })
      .from(workspaceMembers)
      .innerJoin(users, eq(workspaceMembers.userId, users.id))
      .where(eq(workspaceMembers.workspaceId, workspaceId));

    return result.map((r) => ({ ...r.member, user: r.user }));
  }

  async isUserInWorkspace(
    userId: number,
    workspaceId: number
  ): Promise<boolean> {
    const [member] = await db
      .select()
      .from(workspaceMembers)
      .where(
        and(
          eq(workspaceMembers.userId, userId),
          eq(workspaceMembers.workspaceId, workspaceId)
        )
      );
    return !!member;
  }

  async addChannelMember(
    insertMember: InsertChannelMember
  ): Promise<ChannelMember> {
    const [member] = await db
      .insert(channelMembers)
      .values(insertMember)
      .returning();
    return member;
  }

  async getChannelMembersByChannelId(
    channelId: number
  ): Promise<(ChannelMember & { user: User })[]> {
    const result = await db
      .select({ member: channelMembers, user: users })
      .from(channelMembers)
      .innerJoin(users, eq(channelMembers.userId, users.id))
      .where(eq(channelMembers.channelId, channelId));

    return result.map((r) => ({ ...r.member, user: r.user }));
  }

  async isUserInChannel(userId: number, channelId: number): Promise<boolean> {
    const [member] = await db
      .select()
      .from(channelMembers)
      .where(
        and(
          eq(channelMembers.userId, userId),
          eq(channelMembers.channelId, channelId)
        )
      );
    return !!member;
  }

  async searchUsers(searchTerm: string): Promise<User[]> {
    return await db
      .select()
      .from(users)
      .where(
        or(
          sql`${users.username} ILIKE ${`%${searchTerm}%`}`,
          sql`${users.displayName} ILIKE ${`%${searchTerm}%`}`
        )
      );
  }

  async addMessageReaction(
    reaction: InsertMessageReaction
  ): Promise<MessageReaction> {
    const [newReaction] = await db
      .insert(messageReactions)
      .values(reaction)
      .returning();
    return newReaction;
  }

  async getMessageReactions(
    messageId: number
  ): Promise<(MessageReaction & { user: User })[]> {
    const result = await db
      .select({ reaction: messageReactions, user: users })
      .from(messageReactions)
      .innerJoin(users, eq(messageReactions.userId, users.id))
      .where(eq(messageReactions.messageId, messageId));
    return result.map((r) => ({ ...r.reaction, user: r.user }));
  }

  async removeMessageReaction(
    messageId: number,
    userId: number,
    emoji: string
  ): Promise<boolean> {
    const result = await db
      .delete(messageReactions)
      .where(
        and(
          eq(messageReactions.messageId, messageId),
          eq(messageReactions.userId, userId),
          eq(messageReactions.emoji, emoji)
        )
      )
      .returning();
    return result.length > 0;
  }

  async createFileUpload(file: InsertFileUpload): Promise<FileUpload> {
    const [newFile] = await db.insert(fileUploads).values(file).returning();
    return newFile;
  }

  async getFileUpload(id: number): Promise<FileUpload | undefined> {
    const [file] = await db
      .select()
      .from(fileUploads)
      .where(eq(fileUploads.id, id));
    return file || undefined;
  }

  async getMessageById(id: number): Promise<MessageWithUser | undefined> {
    const result = await db
      .select({ message: messages, user: users })
      .from(messages)
      .innerJoin(users, eq(messages.userId, users.id))
      .where(eq(messages.id, id));

    if (result.length === 0) return undefined;

    const { message, user } = result[0];
    return { ...message, user };
  }

  async getThreadMessages(threadId: number): Promise<MessageWithUser[]> {
    const result = await db
      .select({ message: messages, user: users })
      .from(messages)
      .innerJoin(users, eq(messages.userId, users.id))
      .where(eq(messages.threadId, threadId))
      .orderBy(messages.createdAt);

    return result.map((r) => ({ ...r.message, user: r.user }));
  }

  async updateThreadCount(messageId: number, count: number): Promise<void> {
    await db
      .update(messages)
      .set({ threadCount: count })
      .where(eq(messages.id, messageId));
  }

  async searchMessages(
    query: string,
    userId: number
  ): Promise<MessageWithUser[]> {
    const result = await db
      .select({ message: messages, user: users })
      .from(messages)
      .innerJoin(users, eq(messages.userId, users.id))
      .where(
        and(
          or(
            sql`${messages.content} ILIKE ${`%${query}%`}`,
            sql`${users.displayName} ILIKE ${`%${query}%`}`,
            sql`${users.username} ILIKE ${`%${query}%`}`
          )
        )
      )
      .orderBy(sql`${messages.createdAt} DESC`)
      .limit(50);

    return result.map((r) => ({ ...r.message, user: r.user }));
  }
}

// Use database storage for persistence
export const storage = new DatabaseStorage();
console.log("Using DatabaseStorage with PostgreSQL persistence");
