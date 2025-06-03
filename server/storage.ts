import { 
  users, type User, type InsertUser,
  workspaces, type Workspace, type InsertWorkspace,
  channels, type Channel, type InsertChannel,
  messages, type Message, type InsertMessage,
  directMessages, type DirectMessage, type InsertDirectMessage,
  workspaceMembers, type WorkspaceMember, type InsertWorkspaceMember,
  channelMembers, type ChannelMember, type InsertChannelMember,
  type MessageWithUser,
  type ChannelWithMemberCount,
  type DirectMessageWithUser
} from "@shared/schema";

// Define the storage interface with CRUD methods
export interface IStorage {
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

  // Workspace membership operations
  addWorkspaceMember(member: InsertWorkspaceMember): Promise<WorkspaceMember>;
  getWorkspaceMembersByWorkspaceId(workspaceId: number): Promise<(WorkspaceMember & { user: User })[]>;
  isUserInWorkspace(userId: number, workspaceId: number): Promise<boolean>;

  // Channel membership operations
  addChannelMember(member: InsertChannelMember): Promise<ChannelMember>;
  getChannelMembersByChannelId(channelId: number): Promise<(ChannelMember & { user: User })[]>;
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
      avatarUrl: null
    };
    this.users.set(seedUser.id, seedUser);
    
    // Create a seed workspace
    const seedWorkspace: Workspace = {
      id: this.workspaceId++,
      name: "Demo Workspace",
      ownerId: seedUser.id,
      iconText: "DW",
      createdAt: new Date()
    };
    this.workspaces.set(seedWorkspace.id, seedWorkspace);
    
    // Add the user to the workspace
    const membershipId = this.workspaceMemberId++;
    const membership: WorkspaceMember = {
      id: membershipId,
      workspaceId: seedWorkspace.id,
      userId: seedUser.id,
      role: "owner"
    };
    this.workspaceMembers.set(membershipId, membership);
    
    // Create a general channel
    const generalChannel: Channel = {
      id: this.channelId++,
      name: "general",
      workspaceId: seedWorkspace.id,
      description: "General discussion channel",
      isPrivate: false,
      createdAt: new Date()
    };
    this.channels.set(generalChannel.id, generalChannel);
    
    // Add the user to the general channel
    const channelMemberId = this.channelMemberId++;
    const channelMember: ChannelMember = {
      id: channelMemberId,
      channelId: generalChannel.id,
      userId: seedUser.id
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

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.userId++;
    const user: User = { 
      ...insertUser, 
      id, 
      status: "online",
      avatarUrl: insertUser.avatarUrl || null
    };
    this.users.set(id, user);
    return user;
  }

  async updateUserStatus(id: number, status: string): Promise<User | undefined> {
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
      role: "owner"
    });

    // Create a default general channel
    await this.createChannel({
      name: "general",
      workspaceId: id,
      description: "General discussions",
      isPrivate: false
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
    
    return memberships.map(
      (member) => this.workspaces.get(member.workspaceId)
    ).filter((workspace): workspace is Workspace => workspace !== undefined);
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
      isPrivate: insertChannel.isPrivate ?? false
    };
    this.channels.set(id, channel);

    // Add the creator to the channel automatically
    await this.addChannelMember({
      channelId: id,
      userId: (await this.getWorkspace(insertChannel.workspaceId))?.ownerId || 0
    });

    return channel;
  }

  async getChannel(id: number): Promise<Channel | undefined> {
    return this.channels.get(id);
  }

  async getChannelsByWorkspaceId(workspaceId: number): Promise<ChannelWithMemberCount[]> {
    const channels = Array.from(this.channels.values()).filter(
      (channel) => channel.workspaceId === workspaceId
    );

    return Promise.all(
      channels.map(async (channel) => {
        const members = await this.getChannelMembersByChannelId(channel.id);
        return {
          ...channel,
          memberCount: members.length
        };
      })
    );
  }

  // Message operations
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
      messageType: insertMessage.messageType || 'text',
      mediaUrl: insertMessage.mediaUrl || null,
      mediaType: insertMessage.mediaType || null,
      mediaSize: insertMessage.mediaSize || null,
      replyToId: insertMessage.replyToId || null,
      isEdited: false,
      editedAt: null,
      reactions: null
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
          user
        };
      })
    );
  }

  async getMessagesByDirectMessageId(directMessageId: number): Promise<MessageWithUser[]> {
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
          user
        };
      })
    );
  }

  // Direct Message operations
  async createDirectMessage(insertDM: InsertDirectMessage): Promise<DirectMessage> {
    const id = this.directMessageId++;
    const now = new Date();
    const dm: DirectMessage = { ...insertDM, id, createdAt: now };
    this.directMessages.set(id, dm);
    return dm;
  }

  async getDirectMessage(id: number): Promise<DirectMessage | undefined> {
    return this.directMessages.get(id);
  }

  async getDirectMessageByUserIds(user1Id: number, user2Id: number): Promise<DirectMessage | undefined> {
    return Array.from(this.directMessages.values()).find(
      (dm) => (dm.user1Id === user1Id && dm.user2Id === user2Id) || 
              (dm.user1Id === user2Id && dm.user2Id === user1Id)
    );
  }

  async getDirectMessagesByUserId(userId: number): Promise<DirectMessageWithUser[]> {
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
        const lastMessage = messages.length > 0 ? messages[messages.length - 1] : undefined;
        
        return { 
          ...dm, 
          otherUser,
          lastMessage
        };
      })
    );
  }

  // Workspace membership operations
  async addWorkspaceMember(insertMember: InsertWorkspaceMember): Promise<WorkspaceMember> {
    const id = this.workspaceMemberId++;
    const member: WorkspaceMember = { 
      ...insertMember, 
      id,
      role: insertMember.role || "member"
    };
    this.workspaceMembers.set(id, member);
    return member;
  }

  async getWorkspaceMembersByWorkspaceId(workspaceId: number): Promise<(WorkspaceMember & { user: User })[]> {
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

  async isUserInWorkspace(userId: number, workspaceId: number): Promise<boolean> {
    return Array.from(this.workspaceMembers.values()).some(
      (member) => member.userId === userId && member.workspaceId === workspaceId
    );
  }

  // Channel membership operations
  async addChannelMember(insertMember: InsertChannelMember): Promise<ChannelMember> {
    const id = this.channelMemberId++;
    const member: ChannelMember = { ...insertMember, id };
    this.channelMembers.set(id, member);
    return member;
  }

  async getChannelMembersByChannelId(channelId: number): Promise<(ChannelMember & { user: User })[]> {
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
  
  // Search users by username or display name
  async searchUsers(searchTerm: string): Promise<User[]> {
    return Array.from(this.users.values())
      .filter(user => {
        return user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
               user.displayName.toLowerCase().includes(searchTerm.toLowerCase());
      });
  }
}

import { db } from './db';
import { eq, and, or, desc, count, sql, ilike } from 'drizzle-orm';
import bcrypt from 'bcrypt';

export class DatabaseStorage implements IStorage {
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    // Hash password if not already hashed
    if (insertUser.password && !insertUser.password.startsWith('$2b$')) {
      const hashedPassword = await bcrypt.hash(insertUser.password, 10);
      insertUser.password = hashedPassword;
    }
    
    // Set default values
    const userToInsert = {
      ...insertUser,
      status: 'online',
      avatarUrl: insertUser.avatarUrl || null
    };
    
    const [user] = await db.insert(users).values(userToInsert).returning();
    return user;
  }

  async updateUserStatus(id: number, status: string): Promise<User | undefined> {
    const [updatedUser] = await db
      .update(users)
      .set({ status })
      .where(eq(users.id, id))
      .returning();
    
    return updatedUser || undefined;
  }

  async createWorkspace(insertWorkspace: InsertWorkspace): Promise<Workspace> {
    // Start a transaction to ensure all operations are atomic
    return await db.transaction(async (tx) => {
      // Create the workspace
      const [workspace] = await tx
        .insert(workspaces)
        .values(insertWorkspace)
        .returning();
      
      // Add the owner as a member with 'owner' role
      await tx
        .insert(workspaceMembers)
        .values({
          workspaceId: workspace.id,
          userId: insertWorkspace.ownerId,
          role: 'owner'
        });
      
      // Create a default general channel
      const [channel] = await tx
        .insert(channels)
        .values({
          name: 'general',
          workspaceId: workspace.id,
          description: 'General discussions',
          isPrivate: false
        })
        .returning();
      
      // Add the owner to the general channel
      await tx
        .insert(channelMembers)
        .values({
          channelId: channel.id,
          userId: insertWorkspace.ownerId
        });
      
      return workspace;
    });
  }

  async getWorkspace(id: number): Promise<Workspace | undefined> {
    const [workspace] = await db
      .select()
      .from(workspaces)
      .where(eq(workspaces.id, id));
    
    return workspace || undefined;
  }

  async getWorkspacesByUserId(userId: number): Promise<Workspace[]> {
    return await db
      .select({
        id: workspaces.id,
        name: workspaces.name,
        ownerId: workspaces.ownerId,
        iconText: workspaces.iconText,
        createdAt: workspaces.createdAt
      })
      .from(workspaces)
      .innerJoin(workspaceMembers, eq(workspaces.id, workspaceMembers.workspaceId))
      .where(eq(workspaceMembers.userId, userId));
  }

  async createChannel(insertChannel: InsertChannel): Promise<Channel> {
    const [channel] = await db
      .insert(channels)
      .values({
        ...insertChannel,
        description: insertChannel.description || null,
        isPrivate: insertChannel.isPrivate || false
      })
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

  async getChannelsByWorkspaceId(workspaceId: number): Promise<ChannelWithMemberCount[]> {
    return await db
      .select({
        id: channels.id,
        name: channels.name,
        workspaceId: channels.workspaceId,
        description: channels.description,
        isPrivate: channels.isPrivate,
        createdAt: channels.createdAt,
        memberCount: count(channelMembers.id).as('memberCount')
      })
      .from(channels)
      .leftJoin(channelMembers, eq(channels.id, channelMembers.channelId))
      .where(eq(channels.workspaceId, workspaceId))
      .groupBy(channels.id);
  }

  async createMessage(insertMessage: InsertMessage): Promise<MessageWithUser> {
    const [message] = await db
      .insert(messages)
      .values({
        ...insertMessage,
        channelId: insertMessage.channelId || null,
        directMessageId: insertMessage.directMessageId || null
      })
      .returning();
    
    // Get the user who created the message
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, message.userId));
    
    if (!user) {
      throw new Error(`User with id ${message.userId} not found`);
    }
    
    return { ...message, user };
  }

  async getMessagesByChannelId(channelId: number): Promise<MessageWithUser[]> {
    return await db
      .select({
        id: messages.id,
        content: messages.content,
        userId: messages.userId,
        channelId: messages.channelId,
        directMessageId: messages.directMessageId,
        createdAt: messages.createdAt,
        user: users
      })
      .from(messages)
      .innerJoin(users, eq(messages.userId, users.id))
      .where(eq(messages.channelId, channelId))
      .orderBy(messages.createdAt);
  }

  async getMessagesByDirectMessageId(directMessageId: number): Promise<MessageWithUser[]> {
    return await db
      .select({
        id: messages.id,
        content: messages.content,
        userId: messages.userId,
        channelId: messages.channelId,
        directMessageId: messages.directMessageId,
        createdAt: messages.createdAt,
        user: users
      })
      .from(messages)
      .innerJoin(users, eq(messages.userId, users.id))
      .where(eq(messages.directMessageId, directMessageId))
      .orderBy(messages.createdAt);
  }

  async createDirectMessage(insertDM: InsertDirectMessage): Promise<DirectMessage> {
    const [dm] = await db
      .insert(directMessages)
      .values(insertDM)
      .returning();
    
    return dm;
  }

  async getDirectMessage(id: number): Promise<DirectMessage | undefined> {
    const [dm] = await db
      .select()
      .from(directMessages)
      .where(eq(directMessages.id, id));
    
    return dm || undefined;
  }

  async getDirectMessageByUserIds(user1Id: number, user2Id: number): Promise<DirectMessage | undefined> {
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

  async getDirectMessagesByUserId(userId: number): Promise<DirectMessageWithUser[]> {
    const results = await db.transaction(async (tx) => {
      // Get all direct messages for the user
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
          // Determine the other user in the conversation
          const otherUserId = dm.user1Id === userId ? dm.user2Id : dm.user1Id;
          
          // Get the other user's information
          const [otherUser] = await tx
            .select()
            .from(users)
            .where(eq(users.id, otherUserId));
          
          if (!otherUser) {
            throw new Error(`User with id ${otherUserId} not found`);
          }
          
          // Get the most recent message
          const [lastMessage] = await tx
            .select({
              id: messages.id,
              content: messages.content,
              userId: messages.userId,
              channelId: messages.channelId,
              directMessageId: messages.directMessageId,
              createdAt: messages.createdAt,
              user: users
            })
            .from(messages)
            .innerJoin(users, eq(messages.userId, users.id))
            .where(eq(messages.directMessageId, dm.id))
            .orderBy(desc(messages.createdAt))
            .limit(1);
          
          return {
            ...dm,
            otherUser,
            lastMessage
          };
        })
      );
    });
    
    return results;
  }

  async addWorkspaceMember(insertMember: InsertWorkspaceMember): Promise<WorkspaceMember> {
    const [member] = await db
      .insert(workspaceMembers)
      .values({
        ...insertMember,
        role: insertMember.role || 'member'
      })
      .returning();
    
    return member;
  }

  async getWorkspaceMembersByWorkspaceId(workspaceId: number): Promise<(WorkspaceMember & { user: User })[]> {
    return await db
      .select({
        id: workspaceMembers.id,
        workspaceId: workspaceMembers.workspaceId,
        userId: workspaceMembers.userId,
        role: workspaceMembers.role,
        user: users
      })
      .from(workspaceMembers)
      .innerJoin(users, eq(workspaceMembers.userId, users.id))
      .where(eq(workspaceMembers.workspaceId, workspaceId));
  }

  async isUserInWorkspace(userId: number, workspaceId: number): Promise<boolean> {
    const result = await db
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

  async addChannelMember(insertMember: InsertChannelMember): Promise<ChannelMember> {
    const [member] = await db
      .insert(channelMembers)
      .values(insertMember)
      .returning();
    
    return member;
  }

  async getChannelMembersByChannelId(channelId: number): Promise<(ChannelMember & { user: User })[]> {
    return await db
      .select({
        id: channelMembers.id,
        channelId: channelMembers.channelId,
        userId: channelMembers.userId,
        user: users
      })
      .from(channelMembers)
      .innerJoin(users, eq(channelMembers.userId, users.id))
      .where(eq(channelMembers.channelId, channelId));
  }

  async isUserInChannel(userId: number, channelId: number): Promise<boolean> {
    const result = await db
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
  
  // Search users by username or display name
  async searchUsers(searchTerm: string): Promise<User[]> {
    return await db
      .select()
      .from(users)
      .where(
        or(
          // Using ilike for case-insensitive search
          ilike(users.username, `%${searchTerm}%`),
          ilike(users.displayName, `%${searchTerm}%`)
        )
      )
      .limit(20); // Limit results for performance
  }
}

// Use the MemStorage implementation for reliable functionality
export const storage = new MemStorage();

// Add missing methods to DatabaseStorage class
DatabaseStorage.prototype.getMessage = async function(id: number): Promise<Message | undefined> {
  const [message] = await db
    .select()
    .from(messages)
    .where(eq(messages.id, id));
  
  return message || undefined;
};

DatabaseStorage.prototype.createCall = async function(insertCall: any): Promise<any> {
  const id = Date.now();
  const call = { ...insertCall, id, status: 'initiated', startTime: new Date() };
  return call;
};

DatabaseStorage.prototype.getCall = async function(id: number): Promise<any> {
  return { id, status: 'initiated' };
};

DatabaseStorage.prototype.updateCallStatus = async function(callId: number, status: string): Promise<void> {
  // Implementation for calls table updates
};

DatabaseStorage.prototype.addCallParticipant = async function(participant: any): Promise<any> {
  return participant;
};

DatabaseStorage.prototype.getCallParticipants = async function(callId: number): Promise<any[]> {
  return [];
};

DatabaseStorage.prototype.isCallParticipant = async function(callId: number, userId: number): Promise<boolean> {
  return true;
};

DatabaseStorage.prototype.updateCallEndTime = async function(callId: number): Promise<void> {
  // Implementation for calls table updates
};

DatabaseStorage.prototype.updateParticipantLeftTime = async function(callId: number, userId: number): Promise<void> {
  // Implementation for call_participants table updates
};
