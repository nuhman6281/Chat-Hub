import { IStorage } from "./interface";
import {
  User,
  Message,
  Channel,
  Workspace,
  DirectMessage,
  WorkspaceMember,
  ChannelMember,
  InsertWorkspace,
  InsertChannel,
  InsertDirectMessage,
  ReactionWithUser,
  Reaction,
  InsertReaction,
} from "../../schema";
import sqlite3 from "sqlite3";
import { promisify } from "util";

interface DBRow {
  id: number;
  messageId: number;
  userId: number;
  emoji: string;
  name: string;
  createdAt: string;
  userDisplayName: string;
}

export class SQLiteStorage implements IStorage {
  private db: sqlite3.Database;
  private allAsync: (sql: string, params?: any[]) => Promise<any[]>;
  private getAsync: (sql: string, params?: any[]) => Promise<any>;
  private runAsync: (sql: string, params?: any[]) => Promise<sqlite3.RunResult>;

  constructor(dbPath: string) {
    this.db = new sqlite3.Database(dbPath);
    this.allAsync = promisify(this.db.all.bind(this.db));
    this.getAsync = promisify(this.db.get.bind(this.db));
    this.runAsync = promisify(this.db.run.bind(this.db));
  }

  // Implement required interface methods
  async getUser(userId: number | null): Promise<User | undefined> {
    if (!userId) return undefined;
    const user = await this.getAsync("SELECT * FROM users WHERE id = ?", [
      userId,
    ]);
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const user = await this.getAsync("SELECT * FROM users WHERE username = ?", [
      username,
    ]);
    return user || undefined;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const user = await this.getAsync("SELECT * FROM users WHERE email = ?", [
      email,
    ]);
    return user || undefined;
  }

  async createUser(user: any): Promise<User> {
    const result = await this.runAsync(
      "INSERT INTO users (username, email, password, displayName, status, avatarUrl, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      [
        user.username,
        user.email,
        user.password,
        user.displayName,
        user.status || "offline",
        user.avatarUrl || null,
        new Date().toISOString(),
        new Date().toISOString(),
      ]
    );
    return { ...user, id: result.lastID };
  }

  async getMessageReactions(messageId: number): Promise<ReactionWithUser[]> {
    const rows = (await this.allAsync(
      "SELECT r.*, u.displayName as userDisplayName FROM reactions r JOIN users u ON r.userId = u.id WHERE r.messageId = ?",
      [messageId]
    )) as DBRow[];

    return rows.map((row) => ({
      id: row.id,
      messageId: row.messageId,
      emoji: row.emoji,
      name: row.name,
      userId: row.userId,
      createdAt: new Date(row.createdAt),
      user: {
        id: row.userId,
        displayName: row.userDisplayName,
      },
    }));
  }

  async toggleReaction(
    messageId: number,
    userId: number,
    emoji: string,
    name: string
  ): Promise<ReactionWithUser | undefined> {
    // Check if reaction exists
    const existingReaction = (await this.getAsync(
      "SELECT r.*, u.displayName as userDisplayName FROM reactions r JOIN users u ON r.userId = u.id WHERE r.messageId = ? AND r.userId = ? AND r.emoji = ?",
      [messageId, userId, emoji]
    )) as DBRow | undefined;

    if (existingReaction) {
      // Remove reaction
      await this.runAsync(
        "DELETE FROM reactions WHERE messageId = ? AND userId = ? AND emoji = ?",
        [messageId, userId, emoji]
      );
      return undefined;
    } else {
      const createdAt = new Date();
      // Add reaction
      const insertReaction: InsertReaction = {
        messageId,
        userId,
        emoji,
        name,
        createdAt,
      };

      const result = await this.runAsync(
        "INSERT INTO reactions (messageId, userId, emoji, name, createdAt) VALUES (?, ?, ?, ?, ?)",
        [
          insertReaction.messageId,
          insertReaction.userId,
          insertReaction.emoji,
          insertReaction.name,
          createdAt.toISOString(),
        ]
      );

      const user = await this.getAsync(
        "SELECT id, displayName FROM users WHERE id = ?",
        [userId]
      );

      if (!user) {
        throw new Error("User not found");
      }

      const reaction: ReactionWithUser = {
        id: result.lastID,
        messageId: messageId,
        emoji: emoji,
        name: name,
        userId: userId,
        createdAt: createdAt,
        user: {
          id: user.id,
          displayName: user.displayName,
        },
      };

      return reaction;
    }
  }

  // Add other required interface methods with proper implementations
  async updateUserStatus(
    id: number,
    status: string
  ): Promise<User | undefined> {
    await this.runAsync("UPDATE users SET status = ? WHERE id = ?", [
      status,
      id,
    ]);
    return this.getUser(id);
  }

  async createWorkspace(insertWorkspace: InsertWorkspace): Promise<Workspace> {
    const result = await this.runAsync(
      "INSERT INTO workspaces (name, ownerId, iconText, description, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)",
      [
        insertWorkspace.name,
        insertWorkspace.ownerId || null,
        insertWorkspace.iconText || null,
        null,
        new Date().toISOString(),
        new Date().toISOString(),
      ]
    );
    return {
      id: result.lastID,
      name: insertWorkspace.name,
      ownerId: insertWorkspace.ownerId || null,
      iconText: insertWorkspace.iconText || null,
      description: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  async getWorkspace(id: number): Promise<Workspace | undefined> {
    const workspace = await this.getAsync(
      "SELECT * FROM workspaces WHERE id = ?",
      [id]
    );
    if (!workspace) return undefined;
    return {
      id: workspace.id,
      name: workspace.name,
      ownerId: workspace.ownerId || null,
      iconText: workspace.iconText || null,
      description: workspace.description || null,
      createdAt: new Date(workspace.createdAt),
      updatedAt: new Date(workspace.updatedAt),
    };
  }

  async getWorkspacesByUserId(userId: number): Promise<Workspace[]> {
    const workspaces = await this.allAsync(
      "SELECT w.* FROM workspaces w JOIN workspace_members wm ON w.id = wm.workspaceId WHERE wm.userId = ?",
      [userId]
    );
    return workspaces.map((workspace) => ({
      id: workspace.id,
      name: workspace.name,
      ownerId: workspace.ownerId || null,
      iconText: workspace.iconText || null,
      description: workspace.description || null,
      createdAt: new Date(workspace.createdAt),
      updatedAt: new Date(workspace.updatedAt),
    }));
  }

  async createChannel(insertChannel: InsertChannel): Promise<Channel> {
    const result = await this.runAsync(
      "INSERT INTO channels (name, workspaceId, description, isPrivate, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)",
      [
        insertChannel.name,
        insertChannel.workspaceId || null,
        insertChannel.description || null,
        insertChannel.isPrivate || false,
        new Date().toISOString(),
        new Date().toISOString(),
      ]
    );
    return {
      id: result.lastID,
      name: insertChannel.name,
      workspaceId: insertChannel.workspaceId || null,
      description: insertChannel.description || null,
      isPrivate: insertChannel.isPrivate || false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  async getChannel(id: number): Promise<Channel | undefined> {
    const channel = await this.getAsync("SELECT * FROM channels WHERE id = ?", [
      id,
    ]);
    if (!channel) return undefined;
    return {
      id: channel.id,
      name: channel.name,
      workspaceId: channel.workspaceId || null,
      description: channel.description || null,
      isPrivate: channel.isPrivate || false,
      createdAt: new Date(channel.createdAt),
      updatedAt: new Date(channel.updatedAt),
    };
  }

  async getChannelsByWorkspaceId(workspaceId: number): Promise<any[]> {
    return this.allAsync("SELECT * FROM channels WHERE workspaceId = ?", [
      workspaceId,
    ]);
  }

  async createMessage(message: any): Promise<any> {
    const result = await this.runAsync(
      "INSERT INTO messages (content, userId, channelId, directMessageId, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)",
      [
        message.content,
        message.userId,
        message.channelId,
        message.directMessageId,
        new Date().toISOString(),
        new Date().toISOString(),
      ]
    );
    return { ...message, id: result.lastID };
  }

  async getMessage(id: number): Promise<any> {
    return this.getAsync("SELECT * FROM messages WHERE id = ?", [id]);
  }

  async getMessagesByChannelId(channelId: number): Promise<any[]> {
    return this.allAsync(
      "SELECT * FROM messages WHERE channelId = ? ORDER BY createdAt DESC",
      [channelId]
    );
  }

  async getMessagesByDirectMessageId(directMessageId: number): Promise<any[]> {
    return this.allAsync(
      "SELECT * FROM messages WHERE directMessageId = ? ORDER BY createdAt DESC",
      [directMessageId]
    );
  }

  async createDirectMessage(
    insertDM: InsertDirectMessage
  ): Promise<DirectMessage> {
    const result = await this.runAsync(
      "INSERT INTO direct_messages (user1Id, user2Id, createdAt, updatedAt) VALUES (?, ?, ?, ?)",
      [
        insertDM.user1Id || null,
        insertDM.user2Id || null,
        new Date().toISOString(),
        new Date().toISOString(),
      ]
    );
    return {
      id: result.lastID,
      user1Id: insertDM.user1Id || null,
      user2Id: insertDM.user2Id || null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  async getDirectMessage(id: number): Promise<DirectMessage | undefined> {
    const dm = await this.getAsync(
      "SELECT * FROM direct_messages WHERE id = ?",
      [id]
    );
    if (!dm) return undefined;
    return {
      id: dm.id,
      user1Id: dm.user1Id || null,
      user2Id: dm.user2Id || null,
      createdAt: new Date(dm.createdAt),
      updatedAt: new Date(dm.updatedAt),
    };
  }

  async getDirectMessageByUserIds(
    user1Id: number,
    user2Id: number
  ): Promise<DirectMessage | undefined> {
    const dm = await this.getAsync(
      "SELECT * FROM direct_messages WHERE (user1Id = ? AND user2Id = ?) OR (user1Id = ? AND user2Id = ?)",
      [user1Id, user2Id, user2Id, user1Id]
    );
    if (!dm) return undefined;
    return {
      id: dm.id,
      user1Id: dm.user1Id || null,
      user2Id: dm.user2Id || null,
      createdAt: new Date(dm.createdAt),
      updatedAt: new Date(dm.updatedAt),
    };
  }

  async getDirectMessagesByUserId(userId: number): Promise<any[]> {
    return this.allAsync(
      "SELECT * FROM direct_messages WHERE user1Id = ? OR user2Id = ?",
      [userId, userId]
    );
  }

  async addChannelMember(member: any): Promise<ChannelMember> {
    const result = await this.runAsync(
      "INSERT INTO channel_members (channelId, userId) VALUES (?, ?)",
      [member.channelId, member.userId]
    );
    return { ...member, id: result.lastID };
  }

  async getChannelMembersByChannelId(channelId: number): Promise<any[]> {
    return this.allAsync(
      "SELECT cm.*, u.* FROM channel_members cm JOIN users u ON cm.userId = u.id WHERE cm.channelId = ?",
      [channelId]
    );
  }

  async isUserInChannel(userId: number, channelId: number): Promise<boolean> {
    const result = await this.getAsync(
      "SELECT COUNT(*) as count FROM channel_members WHERE userId = ? AND channelId = ?",
      [userId, channelId]
    );
    return result.count > 0;
  }

  async addWorkspaceMember(member: any): Promise<WorkspaceMember> {
    const result = await this.runAsync(
      "INSERT INTO workspace_members (workspaceId, userId, role) VALUES (?, ?, ?)",
      [member.workspaceId, member.userId, member.role || "member"]
    );
    return { ...member, id: result.lastID };
  }

  async getWorkspaceMember(
    userId: number,
    workspaceId: number
  ): Promise<WorkspaceMember | undefined> {
    const member = await this.getAsync(
      "SELECT * FROM workspace_members WHERE userId = ? AND workspaceId = ?",
      [userId, workspaceId]
    );
    return member || undefined;
  }

  async updateWorkspaceMemberRole(
    userId: number,
    workspaceId: number,
    role: string
  ): Promise<WorkspaceMember | undefined> {
    await this.runAsync(
      "UPDATE workspace_members SET role = ? WHERE userId = ? AND workspaceId = ?",
      [role, userId, workspaceId]
    );
    return this.getWorkspaceMember(userId, workspaceId);
  }

  async removeWorkspaceMember(
    userId: number,
    workspaceId: number
  ): Promise<boolean> {
    const result = await this.runAsync(
      "DELETE FROM workspace_members WHERE userId = ? AND workspaceId = ?",
      [userId, workspaceId]
    );
    return result.changes > 0;
  }

  async getWorkspaceMembersByWorkspaceId(workspaceId: number): Promise<any[]> {
    return this.allAsync(
      "SELECT wm.*, u.* FROM workspace_members wm JOIN users u ON wm.userId = u.id WHERE wm.workspaceId = ?",
      [workspaceId]
    );
  }

  async isUserInWorkspace(
    userId: number,
    workspaceId: number
  ): Promise<boolean> {
    const result = await this.getAsync(
      "SELECT COUNT(*) as count FROM workspace_members WHERE userId = ? AND workspaceId = ?",
      [userId, workspaceId]
    );
    return result.count > 0;
  }

  async getWorkspaceOwners(workspaceId: number): Promise<WorkspaceMember[]> {
    return this.allAsync(
      "SELECT * FROM workspace_members WHERE workspaceId = ? AND role = 'owner'",
      [workspaceId]
    );
  }

  async createWorkspaceInvitation(data: any): Promise<any> {
    const result = await this.runAsync(
      "INSERT INTO workspace_invitations (workspaceId, email, role, createdAt) VALUES (?, ?, ?, ?)",
      [data.workspaceId, data.email, data.role, new Date().toISOString()]
    );
    return { ...data, id: result.lastID };
  }
}
