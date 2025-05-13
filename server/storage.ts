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
  reactions,
  type Reaction,
  type InsertReaction,
  type ReactionWithUser,
} from "./schema";
import { drizzle, NodePgDatabase } from "drizzle-orm/node-postgres";
import { eq, and, or, desc, count, sql, ilike } from "drizzle-orm";
import bcrypt from "bcrypt";
import { Pool } from "pg";
import { IStorage } from "./src/storage/interface";

export class DatabaseStorage implements IStorage {
  private db: NodePgDatabase;

  constructor() {
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
    });
    this.db = drizzle(pool);
  }

  async createUser(user: InsertUser): Promise<User> {
    if (user.password && !user.password.startsWith("$2b$")) {
      const hashedPassword = await bcrypt.hash(user.password, 10);
      user.password = hashedPassword;
    }

    const userToInsert = {
      ...user,
      status: user.status || "offline",
      avatarUrl: user.avatarUrl || null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const [result] = await this.db
      .insert(users)
      .values(userToInsert)
      .returning();
    return result;
  }

  async addWorkspaceMember(
    member: InsertWorkspaceMember
  ): Promise<WorkspaceMember> {
    if (!member.workspaceId || !member.userId) {
      throw new Error("Workspace ID and User ID are required");
    }

    const memberToInsert = {
      ...member,
      role: member.role || "member",
    };

    const [result] = await this.db
      .insert(workspaceMembers)
      .values(memberToInsert)
      .returning();
    return result;
  }

  async getWorkspaceMember(
    userId: number,
    workspaceId: number
  ): Promise<WorkspaceMember | undefined> {
    const [result] = await this.db
      .select()
      .from(workspaceMembers)
      .where(
        and(
          eq(workspaceMembers.userId, userId),
          eq(workspaceMembers.workspaceId, workspaceId)
        )
      );
    return result || undefined;
  }

  async updateWorkspaceMemberRole(
    userId: number,
    workspaceId: number,
    role: string
  ): Promise<WorkspaceMember | undefined> {
    const [result] = await this.db
      .update(workspaceMembers)
      .set({ role })
      .where(
        and(
          eq(workspaceMembers.userId, userId),
          eq(workspaceMembers.workspaceId, workspaceId)
        )
      )
      .returning();
    return result || undefined;
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
    return result.rowCount ? result.rowCount > 0 : false;
  }

  async getWorkspaceMembersByWorkspaceId(
    workspaceId: number
  ): Promise<(WorkspaceMember & { user: User })[]> {
    const results = await this.db
      .select({
        id: workspaceMembers.id,
        userId: workspaceMembers.userId,
        workspaceId: workspaceMembers.workspaceId,
        role: workspaceMembers.role,
        user: users,
      })
      .from(workspaceMembers)
      .innerJoin(users, eq(workspaceMembers.userId, users.id))
      .where(eq(workspaceMembers.workspaceId, workspaceId));

    return results.map((result) => {
      const { user, ...memberData } = result;
      return {
        ...memberData,
        user,
      };
    });
  }

  async isUserInWorkspace(
    userId: number,
    workspaceId: number
  ): Promise<boolean> {
    const result = await this.db
      .select({ count: count() })
      .from(workspaceMembers)
      .where(
        and(
          eq(workspaceMembers.userId, userId),
          eq(workspaceMembers.workspaceId, workspaceId)
        )
      );
    return result[0].count > 0;
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

  async getUser(userId: number | null): Promise<User | undefined> {
    if (userId === null) {
      return undefined;
    }

    const [result] = await this.db
      .select()
      .from(users)
      .where(eq(users.id, userId));
    return result || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [result] = await this.db
      .select()
      .from(users)
      .where(eq(users.username, username));
    return result || undefined;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [result] = await this.db
      .select()
      .from(users)
      .where(eq(users.email, email));
    return result || undefined;
  }

  async updateUserStatus(
    id: number,
    status: string
  ): Promise<User | undefined> {
    const [result] = await this.db
      .update(users)
      .set({ status })
      .where(eq(users.id, id))
      .returning();
    return result || undefined;
  }

  async createWorkspace(workspace: InsertWorkspace): Promise<Workspace> {
    const workspaceToInsert = {
      ...workspace,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const [result] = await this.db
      .insert(workspaces)
      .values(workspaceToInsert)
      .returning();
    return result;
  }

  async getWorkspace(id: number): Promise<Workspace | undefined> {
    const [result] = await this.db
      .select()
      .from(workspaces)
      .where(eq(workspaces.id, id));
    return result || undefined;
  }

  async getWorkspacesByUserId(userId: number): Promise<Workspace[]> {
    const results = await this.db
      .select({
        id: workspaces.id,
        name: workspaces.name,
        description: workspaces.description,
        ownerId: workspaces.ownerId,
        iconText: workspaces.iconText,
        createdAt: workspaces.createdAt,
        updatedAt: workspaces.updatedAt,
      })
      .from(workspaces)
      .innerJoin(
        workspaceMembers,
        eq(workspaces.id, workspaceMembers.workspaceId)
      )
      .where(eq(workspaceMembers.userId, userId));

    return results;
  }

  async createChannel(channel: InsertChannel): Promise<Channel> {
    const channelToInsert = {
      ...channel,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const [result] = await this.db
      .insert(channels)
      .values(channelToInsert)
      .returning();
    return result;
  }

  async getChannel(id: number): Promise<Channel | undefined> {
    const [result] = await this.db
      .select()
      .from(channels)
      .where(eq(channels.id, id));
    return result || undefined;
  }

  async getChannelsByWorkspaceId(
    workspaceId: number
  ): Promise<ChannelWithMemberCount[]> {
    const channelResults = await this.db
      .select()
      .from(channels)
      .where(eq(channels.workspaceId, workspaceId));

    const channelsWithMemberCount = await Promise.all(
      channelResults.map(async (channel) => {
        const result = await this.db
          .select({ count: count() })
          .from(channelMembers)
          .where(eq(channelMembers.channelId, channel.id));
        return {
          ...channel,
          memberCount: Number(result[0].count),
        };
      })
    );

    return channelsWithMemberCount;
  }

  async createMessage(message: InsertMessage): Promise<MessageWithUser> {
    if (!message.userId) {
      throw new Error("User ID is required for creating a message");
    }

    const messageToInsert = {
      ...message,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const [result] = await this.db
      .insert(messages)
      .values(messageToInsert)
      .returning();

    const user = await this.getUser(result.userId);
    if (!user) {
      throw new Error(`User with id ${result.userId} not found`);
    }

    return {
      ...result,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        displayName: user.displayName,
        status: user.status,
        avatarUrl: user.avatarUrl,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
    };
  }

  async getMessage(id: number): Promise<MessageWithUser | undefined> {
    const [message] = await this.db
      .select()
      .from(messages)
      .where(eq(messages.id, id));

    if (!message || !message.userId) {
      return undefined;
    }

    const user = await this.getUser(message.userId);
    if (!user) {
      throw new Error(`User with id ${message.userId} not found`);
    }

    return {
      ...message,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        displayName: user.displayName,
        status: user.status,
        avatarUrl: user.avatarUrl,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
    };
  }

  async getMessagesByChannelId(channelId: number): Promise<MessageWithUser[]> {
    const messageResults = await this.db
      .select()
      .from(messages)
      .where(eq(messages.channelId, channelId))
      .orderBy(desc(messages.createdAt));

    return Promise.all(
      messageResults.map(async (message: Message) => {
        if (!message.userId) {
          throw new Error(`Message ${message.id} has no user ID`);
        }

        const user = await this.getUser(message.userId);
        if (!user) {
          throw new Error(`User with id ${message.userId} not found`);
        }

        return {
          ...message,
          user: {
            id: user.id,
            username: user.username,
            email: user.email,
            displayName: user.displayName,
            status: user.status,
            avatarUrl: user.avatarUrl,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt,
          },
        };
      })
    );
  }

  async getMessagesByDirectMessageId(
    directMessageId: number
  ): Promise<MessageWithUser[]> {
    const messageResults = await this.db
      .select()
      .from(messages)
      .where(eq(messages.directMessageId, directMessageId))
      .orderBy(desc(messages.createdAt));

    return Promise.all(
      messageResults.map(async (message: Message) => {
        if (!message.userId) {
          throw new Error(`Message ${message.id} has no user ID`);
        }

        const user = await this.getUser(message.userId);
        if (!user) {
          throw new Error(`User with id ${message.userId} not found`);
        }

        return {
          ...message,
          user: {
            id: user.id,
            username: user.username,
            email: user.email,
            displayName: user.displayName,
            status: user.status,
            avatarUrl: user.avatarUrl,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt,
          },
        };
      })
    );
  }

  async createDirectMessage(dm: InsertDirectMessage): Promise<DirectMessage> {
    const dmToInsert = {
      ...dm,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const [result] = await this.db
      .insert(directMessages)
      .values(dmToInsert)
      .returning();
    return result;
  }

  async getDirectMessage(id: number): Promise<DirectMessage | undefined> {
    const [result] = await this.db
      .select()
      .from(directMessages)
      .where(eq(directMessages.id, id));
    return result || undefined;
  }

  async getDirectMessageByUserIds(
    user1Id: number,
    user2Id: number
  ): Promise<DirectMessage | undefined> {
    const [result] = await this.db
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
    return result || undefined;
  }

  async getDirectMessagesByUserId(
    userId: number
  ): Promise<DirectMessageWithUser[]> {
    if (userId === null) {
      return [];
    }

    const dms = await this.db
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
        if (!otherUserId) {
          throw new Error(`Direct message ${dm.id} has no other user ID`);
        }

        const otherUser = await this.getUser(otherUserId);
        if (!otherUser) {
          throw new Error(`User with id ${otherUserId} not found`);
        }

        const lastMessage = await this.db
          .select()
          .from(messages)
          .where(eq(messages.directMessageId, dm.id))
          .orderBy(desc(messages.createdAt))
          .limit(1);

        let lastMessageWithUser: MessageWithUser | undefined;
        if (lastMessage[0]) {
          if (!lastMessage[0].userId) {
            throw new Error(`Message ${lastMessage[0].id} has no user ID`);
          }

          const messageUser = await this.getUser(lastMessage[0].userId);
          if (!messageUser) {
            throw new Error(`User with id ${lastMessage[0].userId} not found`);
          }

          lastMessageWithUser = {
            ...lastMessage[0],
            user: {
              id: messageUser.id,
              username: messageUser.username,
              email: messageUser.email,
              displayName: messageUser.displayName,
              status: messageUser.status,
              avatarUrl: messageUser.avatarUrl,
              createdAt: messageUser.createdAt,
              updatedAt: messageUser.updatedAt,
            },
          };
        }

        return {
          ...dm,
          otherUser: {
            id: otherUser.id,
            username: otherUser.username,
            email: otherUser.email,
            displayName: otherUser.displayName,
            status: otherUser.status,
            avatarUrl: otherUser.avatarUrl,
            createdAt: otherUser.createdAt,
            updatedAt: otherUser.updatedAt,
          },
          lastMessage: lastMessageWithUser,
        };
      })
    );
  }

  async addChannelMember(member: InsertChannelMember): Promise<ChannelMember> {
    const [result] = await this.db
      .insert(channelMembers)
      .values(member)
      .returning();
    return result;
  }

  async getChannelMembersByChannelId(
    channelId: number
  ): Promise<(ChannelMember & { user: User })[]> {
    const results = await this.db
      .select({
        id: channelMembers.id,
        userId: channelMembers.userId,
        channelId: channelMembers.channelId,
        user: users,
      })
      .from(channelMembers)
      .innerJoin(users, eq(channelMembers.userId, users.id))
      .where(eq(channelMembers.channelId, channelId));

    return results.map((result) => {
      const { user, ...memberData } = result;
      return {
        ...memberData,
        user,
      };
    });
  }

  async isUserInChannel(userId: number, channelId: number): Promise<boolean> {
    const result = await this.db
      .select({ count: count() })
      .from(channelMembers)
      .where(
        and(
          eq(channelMembers.userId, userId),
          eq(channelMembers.channelId, channelId)
        )
      );
    return result[0].count > 0;
  }

  async createWorkspaceInvitation(
    data: InsertWorkspaceInvitation
  ): Promise<WorkspaceInvitation> {
    const invitationToInsert = {
      ...data,
      createdAt: new Date(),
    };

    const [result] = await this.db
      .insert(workspaceInvitations)
      .values(invitationToInsert)
      .returning();
    return result;
  }

  // Reaction methods
  async getMessageReactions(messageId: number): Promise<ReactionWithUser[]> {
    const result = await this.db
      .select({
        id: reactions.id,
        messageId: reactions.messageId,
        emoji: reactions.emoji,
        name: reactions.name,
        userId: reactions.userId,
        createdAt: reactions.createdAt,
        user: {
          id: users.id,
          displayName: users.displayName,
        },
      })
      .from(reactions)
      .innerJoin(users, eq(reactions.userId, users.id))
      .where(eq(reactions.messageId, messageId));

    return result;
  }

  async toggleReaction(
    messageId: number,
    userId: number,
    emoji: string,
    name: string
  ): Promise<ReactionWithUser | undefined> {
    // Check if reaction exists
    const existingReaction = await this.db
      .select()
      .from(reactions)
      .where(
        and(
          eq(reactions.messageId, messageId),
          eq(reactions.userId, userId),
          eq(reactions.emoji, emoji)
        )
      );

    if (existingReaction.length > 0) {
      // Remove reaction
      await this.db
        .delete(reactions)
        .where(
          and(
            eq(reactions.messageId, messageId),
            eq(reactions.userId, userId),
            eq(reactions.emoji, emoji)
          )
        );
      return undefined;
    } else {
      // Add reaction
      const [result] = await this.db
        .insert(reactions)
        .values({
          messageId,
          userId,
          emoji,
          name,
          createdAt: new Date(),
        })
        .returning();

      const user = await this.getUser(userId);
      if (!user) {
        throw new Error("User not found");
      }

      return {
        id: result.id,
        messageId: result.messageId,
        emoji: result.emoji,
        name: result.name,
        userId: result.userId,
        createdAt: result.createdAt,
        user: {
          id: user.id,
          displayName: user.displayName,
        },
      };
    }
  }
}

// Export the storage instance
export const storage = new DatabaseStorage();
