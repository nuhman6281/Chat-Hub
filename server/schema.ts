import {
  pgTable,
  serial,
  text,
  timestamp,
  boolean,
  integer,
} from "drizzle-orm/pg-core";

// User table
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  displayName: text("display_name").notNull(),
  status: text("status").default("offline").notNull(),
  avatarUrl: text("avatar_url"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Workspace table
export const workspaces = pgTable("workspaces", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  ownerId: integer("owner_id").references(() => users.id),
  iconText: text("icon_text"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Channel table
export const channels = pgTable("channels", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  workspaceId: integer("workspace_id").references(() => workspaces.id),
  isPrivate: boolean("is_private").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Message table
export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  content: text("content").notNull(),
  userId: integer("user_id").references(() => users.id),
  channelId: integer("channel_id").references(() => channels.id),
  directMessageId: integer("direct_message_id").references(
    () => directMessages.id
  ),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Direct Message table
export const directMessages = pgTable("direct_messages", {
  id: serial("id").primaryKey(),
  user1Id: integer("user1_id").references(() => users.id),
  user2Id: integer("user2_id").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Workspace Member table
export const workspaceMembers = pgTable("workspace_members", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id),
  workspaceId: integer("workspace_id").references(() => workspaces.id),
  role: text("role").notNull(),
});

// Channel Member table
export const channelMembers = pgTable("channel_members", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id),
  channelId: integer("channel_id").references(() => channels.id),
});

// Workspace Invitation table
export const workspaceInvitations = pgTable("workspace_invitations", {
  id: serial("id").primaryKey(),
  workspaceId: integer("workspace_id").references(() => workspaces.id),
  email: text("email").notNull(),
  role: text("role").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Reactions table
export const reactions = pgTable("reactions", {
  id: serial("id").primaryKey(),
  messageId: integer("message_id").references(() => messages.id),
  userId: integer("user_id").references(() => users.id),
  emoji: text("emoji").notNull(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Types
export type User = typeof users.$inferSelect;
export type ClientUser = Omit<User, "password">;
export type Workspace = typeof workspaces.$inferSelect;
export type Channel = typeof channels.$inferSelect;
export type Message = typeof messages.$inferSelect;
export type DirectMessage = typeof directMessages.$inferSelect;
export type WorkspaceMember = typeof workspaceMembers.$inferSelect;
export type ChannelMember = typeof channelMembers.$inferSelect;
export type WorkspaceInvitation = typeof workspaceInvitations.$inferSelect;
export type Reaction = typeof reactions.$inferSelect;

// Insert types
export type InsertUser = typeof users.$inferInsert;
export type InsertWorkspace = typeof workspaces.$inferInsert;
export type InsertChannel = typeof channels.$inferInsert;
export type InsertMessage = typeof messages.$inferInsert;
export type InsertDirectMessage = typeof directMessages.$inferInsert;
export type InsertWorkspaceMember = typeof workspaceMembers.$inferInsert;
export type InsertChannelMember = typeof channelMembers.$inferInsert;
export type InsertWorkspaceInvitation =
  typeof workspaceInvitations.$inferInsert;
export type InsertReaction = typeof reactions.$inferInsert;

// Extended types
export type MessageWithUser = Message & { user: ClientUser };
export type ChannelWithMemberCount = Channel & { memberCount: number };
export type DirectMessageWithUser = DirectMessage & {
  otherUser: ClientUser;
  lastMessage?: MessageWithUser;
};

export type ReactionWithUser = Reaction & {
  user: {
    id: number;
    displayName: string;
  };
};
