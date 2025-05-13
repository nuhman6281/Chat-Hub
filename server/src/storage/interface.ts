import {
  User,
  ClientUser,
  Workspace,
  Channel,
  Message,
  DirectMessage,
  WorkspaceMember,
  ChannelMember,
  WorkspaceInvitation,
  InsertUser,
  InsertWorkspace,
  InsertChannel,
  InsertMessage,
  InsertDirectMessage,
  InsertWorkspaceMember,
  InsertChannelMember,
  InsertWorkspaceInvitation,
  MessageWithUser,
  ChannelWithMemberCount,
  DirectMessageWithUser,
  ReactionWithUser,
} from "../../schema";

export interface IStorage {
  // User methods
  getUser(userId: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(insertUser: InsertUser): Promise<User>;
  updateUserStatus(id: number, status: string): Promise<User | undefined>;

  // Workspace methods
  createWorkspace(insertWorkspace: InsertWorkspace): Promise<Workspace>;
  getWorkspace(id: number): Promise<Workspace | undefined>;
  getWorkspacesByUserId(userId: number): Promise<Workspace[]>;

  // Channel methods
  createChannel(insertChannel: InsertChannel): Promise<Channel>;
  getChannel(id: number): Promise<Channel | undefined>;
  getChannelsByWorkspaceId(
    workspaceId: number
  ): Promise<ChannelWithMemberCount[]>;

  // Message methods
  createMessage(insertMessage: InsertMessage): Promise<MessageWithUser>;
  getMessage(id: number): Promise<MessageWithUser | undefined>;
  getMessagesByChannelId(channelId: number): Promise<MessageWithUser[]>;
  getMessagesByDirectMessageId(
    directMessageId: number
  ): Promise<MessageWithUser[]>;

  // Direct Message methods
  createDirectMessage(insertDM: InsertDirectMessage): Promise<DirectMessage>;
  getDirectMessage(id: number): Promise<DirectMessage | undefined>;
  getDirectMessageByUserIds(
    user1Id: number,
    user2Id: number
  ): Promise<DirectMessage | undefined>;
  getDirectMessagesByUserId(userId: number): Promise<DirectMessageWithUser[]>;

  // Workspace Member methods
  addWorkspaceMember(
    insertMember: InsertWorkspaceMember
  ): Promise<WorkspaceMember>;
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

  // Channel Member methods
  addChannelMember(member: InsertChannelMember): Promise<ChannelMember>;
  getChannelMembersByChannelId(
    channelId: number
  ): Promise<(ChannelMember & { user: User })[]>;
  isUserInChannel(userId: number, channelId: number): Promise<boolean>;

  // Workspace Invitation methods
  createWorkspaceInvitation(
    data: InsertWorkspaceInvitation
  ): Promise<WorkspaceInvitation>;

  // Reaction methods
  getMessageReactions(messageId: number): Promise<ReactionWithUser[]>;
  toggleReaction(
    messageId: number,
    userId: number,
    emoji: string,
    name: string
  ): Promise<ReactionWithUser | undefined>;
}
