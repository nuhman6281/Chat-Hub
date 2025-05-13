export interface User {
  id: number;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Workspace {
  id: number;
  name: string;
  ownerId: number | null;
  iconText: string | null;
  createdAt: Date | null;
}

export interface Channel {
  id: number;
  name: string;
  workspaceId: number | null;
  description: string | null;
  isPrivate: boolean;
  createdAt: Date | null;
}

export interface ChannelWithMemberCount extends Channel {
  memberCount: number;
}

export interface Message {
  id: number;
  content: string;
  userId: number | null;
  channelId: number | null;
  directMessageId: number | null;
  createdAt: Date | null;
  updatedAt: Date | null;
}

export interface MessageWithUser extends Message {
  user: User;
}

export interface DirectMessage {
  id: number;
  user1Id: number | null;
  user2Id: number | null;
  createdAt: Date | null;
  updatedAt: Date | null;
}

export interface DirectMessageWithUser extends DirectMessage {
  otherUser: User;
  lastMessage?: MessageWithUser;
}
