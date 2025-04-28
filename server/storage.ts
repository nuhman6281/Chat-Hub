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
      ...insertMessage, 
      id, 
      createdAt: now,
      channelId: insertMessage.channelId || null,
      directMessageId: insertMessage.directMessageId || null
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
        return { ...message, user };
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

export const storage = new MemStorage();
