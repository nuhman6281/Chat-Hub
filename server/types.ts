export interface User {
  id: number;
  username: string;
  email: string;
  password: string;
  displayName: string;
  status: string;
  avatarUrl: string | null;
}

export interface Message {
  id: number;
  content: string;
  userId: number;
  channelId: number | null;
  directMessageId: number | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface MessageWithUser extends Message {
  user: User;
}

export interface DirectMessage {
  id: number;
  user1Id: number;
  user2Id: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface DirectMessageWithUser {
  id: number;
  user1Id: number;
  user2Id: number;
  createdAt: Date;
  updatedAt: Date;
  otherUser: User;
  lastMessage?: MessageWithUser;
}
