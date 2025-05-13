import { pgTable, text, serial, integer, boolean, timestamp, } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { relations } from "drizzle-orm";
// User model
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
export const insertUserSchema = createInsertSchema(users).pick({
    username: true,
    email: true,
    password: true,
    displayName: true,
    avatarUrl: true,
    status: true,
});
// Define user relations
export const usersRelations = relations(users, ({ many }) => ({
    workspaceMembers: many(workspaceMembers),
    channelMembers: many(channelMembers),
    messages: many(messages),
    ownedWorkspaces: many(workspaces, { relationName: "owner" }),
}));
// Workspace model
export const workspaces = pgTable("workspaces", {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    ownerId: integer("owner_id").notNull(),
    iconText: text("icon_text").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
});
export const insertWorkspaceSchema = createInsertSchema(workspaces).pick({
    name: true,
    ownerId: true,
    iconText: true,
});
// Define workspace relations
export const workspacesRelations = relations(workspaces, ({ one, many }) => ({
    owner: one(users, {
        fields: [workspaces.ownerId],
        references: [users.id],
        relationName: "owner",
    }),
    channels: many(channels),
    members: many(workspaceMembers),
}));
// Workspace invitations
export const workspaceInvitations = pgTable("workspace_invitations", {
    id: serial("id").primaryKey(),
    workspaceId: integer("workspace_id").notNull(),
    invitedByUserId: integer("invited_by_user_id").notNull(),
    email: text("email").notNull(),
    token: text("token").notNull().unique(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
});
export const insertWorkspaceInvitationSchema = createInsertSchema(workspaceInvitations);
// Channel model
export const channels = pgTable("channels", {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    workspaceId: integer("workspace_id").notNull(),
    description: text("description"),
    isPrivate: boolean("is_private").default(false).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
});
export const insertChannelSchema = createInsertSchema(channels).pick({
    name: true,
    workspaceId: true,
    description: true,
    isPrivate: true,
});
// Define channel relations
export const channelsRelations = relations(channels, ({ one, many }) => ({
    workspace: one(workspaces, {
        fields: [channels.workspaceId],
        references: [workspaces.id],
    }),
    messages: many(messages),
    members: many(channelMembers),
}));
// Message model
export const messages = pgTable("messages", {
    id: serial("id").primaryKey(),
    content: text("content").notNull(),
    userId: integer("user_id").notNull(),
    channelId: integer("channel_id"),
    directMessageId: integer("direct_message_id"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
export const insertMessageSchema = createInsertSchema(messages).pick({
    content: true,
    userId: true,
    channelId: true,
    directMessageId: true,
});
// Define message relations
export const messagesRelations = relations(messages, ({ one }) => ({
    user: one(users, {
        fields: [messages.userId],
        references: [users.id],
    }),
    channel: one(channels, {
        fields: [messages.channelId],
        references: [channels.id],
    }),
    directMessage: one(directMessages, {
        fields: [messages.directMessageId],
        references: [directMessages.id],
    }),
}));
// Direct message conversation model
export const directMessages = pgTable("direct_messages", {
    id: serial("id").primaryKey(),
    user1Id: integer("user1_id").notNull(),
    user2Id: integer("user2_id").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
});
export const insertDirectMessageSchema = createInsertSchema(directMessages).pick({
    user1Id: true,
    user2Id: true,
});
// Define direct message relations
export const directMessagesRelations = relations(directMessages, ({ one, many }) => ({
    user1: one(users, {
        fields: [directMessages.user1Id],
        references: [users.id],
    }),
    user2: one(users, {
        fields: [directMessages.user2Id],
        references: [users.id],
    }),
    messages: many(messages),
}));
// Workspace membership model
export const workspaceMembers = pgTable("workspace_members", {
    id: serial("id").primaryKey(),
    workspaceId: integer("workspace_id").notNull(),
    userId: integer("user_id").notNull(),
    role: text("role").default("member").notNull(),
});
export const insertWorkspaceMemberSchema = createInsertSchema(workspaceMembers).pick({
    workspaceId: true,
    userId: true,
    role: true,
});
// Define workspace member relations
export const workspaceMembersRelations = relations(workspaceMembers, ({ one }) => ({
    workspace: one(workspaces, {
        fields: [workspaceMembers.workspaceId],
        references: [workspaces.id],
    }),
    user: one(users, {
        fields: [workspaceMembers.userId],
        references: [users.id],
    }),
}));
// Channel membership model
export const channelMembers = pgTable("channel_members", {
    id: serial("id").primaryKey(),
    channelId: integer("channel_id").notNull(),
    userId: integer("user_id").notNull(),
});
export const insertChannelMemberSchema = createInsertSchema(channelMembers).pick({
    channelId: true,
    userId: true,
});
// Define channel member relations
export const channelMembersRelations = relations(channelMembers, ({ one }) => ({
    channel: one(channels, {
        fields: [channelMembers.channelId],
        references: [channels.id],
    }),
    user: one(users, {
        fields: [channelMembers.userId],
        references: [users.id],
    }),
}));
