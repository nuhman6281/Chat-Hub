import { pgTable, text, serial, integer, boolean, timestamp, primaryKey } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

// User model
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  displayName: text("display_name").notNull(),
  status: text("status").default("offline").notNull(),
  avatarUrl: text("avatar_url"),
  publicKey: text("public_key"), // For end-to-end encryption
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
  displayName: true,
  avatarUrl: true,
  status: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// Define user relations
export const usersRelations = relations(users, ({ many }) => ({
  workspaceMembers: many(workspaceMembers),
  channelMembers: many(channelMembers),
  messages: many(messages),
  ownedWorkspaces: many(workspaces, { relationName: 'owner' }),
}));

// Workspace model
export const workspaces = pgTable("workspaces", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  ownerId: integer("owner_id").notNull(),
  iconText: text("icon_text").notNull(),
  iconColor: text("icon_color").default("#3b82f6"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertWorkspaceSchema = createInsertSchema(workspaces).pick({
  name: true,
  ownerId: true,
  iconText: true,
  iconColor: true,
}).extend({
  iconText: z.string().optional().default("W"),
  iconColor: z.string().optional().default("#3b82f6")
});

export type InsertWorkspace = z.infer<typeof insertWorkspaceSchema>;
export type Workspace = typeof workspaces.$inferSelect;

// Define workspace relations
export const workspacesRelations = relations(workspaces, ({ one, many }) => ({
  owner: one(users, {
    fields: [workspaces.ownerId],
    references: [users.id],
    relationName: 'owner'
  }),
  channels: many(channels),
  members: many(workspaceMembers)
}));

// Channel model
export const channels = pgTable("channels", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  workspaceId: integer("workspace_id").notNull(),
  description: text("description"),
  createdBy: integer("created_by").notNull(),
  isPrivate: boolean("is_private").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertChannelSchema = createInsertSchema(channels).pick({
  name: true,
  workspaceId: true,
  description: true,
  createdBy: true,
  isPrivate: true,
});

export type InsertChannel = z.infer<typeof insertChannelSchema>;
export type Channel = typeof channels.$inferSelect;

// Define channel relations
export const channelsRelations = relations(channels, ({ one, many }) => ({
  workspace: one(workspaces, {
    fields: [channels.workspaceId],
    references: [workspaces.id]
  }),
  messages: many(messages),
  members: many(channelMembers)
}));

// Enhanced Message model with media support and encryption
export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  content: text("content").notNull(),
  messageType: text("message_type").default("text").notNull(), // text, image, file, voice, video, system
  mediaUrl: text("media_url"), // URL for media files
  mediaType: text("media_type"), // image/png, audio/mp3, video/mp4, etc.
  mediaSize: integer("media_size"), // file size in bytes
  userId: integer("user_id").notNull(),
  channelId: integer("channel_id"),
  directMessageId: integer("direct_message_id"),
  replyToId: integer("reply_to_id"), // for threaded messages
  isEdited: boolean("is_edited").default(false),
  editedAt: timestamp("edited_at"),
  // Thread information
  threadId: integer("thread_id"), // ID of the parent message that started the thread
  threadCount: integer("thread_count").default(0), // Number of replies in thread
  // Encryption fields
  isEncrypted: boolean("is_encrypted").default(false),
  encryptedContent: text("encrypted_content"), // Encrypted message content
  nonce: text("nonce"), // Encryption nonce
  senderPublicKey: text("sender_public_key"), // Sender's public key for verification
  createdAt: timestamp("created_at").defaultNow().notNull(),
});



export const insertMessageSchema = createInsertSchema(messages).pick({
  content: true,
  messageType: true,
  mediaUrl: true,
  mediaType: true,
  mediaSize: true,
  userId: true,
  channelId: true,
  directMessageId: true,
  replyToId: true,
  threadId: true,
  isEncrypted: true,
  encryptedContent: true,
  nonce: true,
  senderPublicKey: true,
});

export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type Message = typeof messages.$inferSelect;

// Define message relations
export const messagesRelations = relations(messages, ({ one }) => ({
  user: one(users, {
    fields: [messages.userId],
    references: [users.id]
  }),
  channel: one(channels, {
    fields: [messages.channelId],
    references: [channels.id]
  }),
  directMessage: one(directMessages, {
    fields: [messages.directMessageId],
    references: [directMessages.id]
  })
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

export type InsertDirectMessage = z.infer<typeof insertDirectMessageSchema>;
export type DirectMessage = typeof directMessages.$inferSelect;

// Define direct message relations
export const directMessagesRelations = relations(directMessages, ({ one, many }) => ({
  user1: one(users, {
    fields: [directMessages.user1Id],
    references: [users.id]
  }),
  user2: one(users, {
    fields: [directMessages.user2Id],
    references: [users.id]
  }),
  messages: many(messages)
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

export type InsertWorkspaceMember = z.infer<typeof insertWorkspaceMemberSchema>;
export type WorkspaceMember = typeof workspaceMembers.$inferSelect;

// Define workspace member relations
export const workspaceMembersRelations = relations(workspaceMembers, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [workspaceMembers.workspaceId],
    references: [workspaces.id]
  }),
  user: one(users, {
    fields: [workspaceMembers.userId],
    references: [users.id]
  })
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

export type InsertChannelMember = z.infer<typeof insertChannelMemberSchema>;
export type ChannelMember = typeof channelMembers.$inferSelect;

// Define channel member relations
export const channelMembersRelations = relations(channelMembers, ({ one }) => ({
  channel: one(channels, {
    fields: [channelMembers.channelId],
    references: [channels.id]
  }),
  user: one(users, {
    fields: [channelMembers.userId],
    references: [users.id]
  })
}));

// Message with user information
export type MessageWithUser = Message & {
  user: User;
};

// Channel with member count
export type ChannelWithMemberCount = Channel & {
  memberCount: number;
};

// Direct message with other user info
export type DirectMessageWithUser = DirectMessage & {
  otherUser: User;
  lastMessage?: MessageWithUser;
};

// Calls model for voice/video calls
export const calls = pgTable("calls", {
  id: serial("id").primaryKey(),
  callType: text("call_type").notNull(), // voice, video
  status: text("status").default("initiated").notNull(), // initiated, ringing, active, ended, missed
  initiatorId: integer("initiator_id").notNull(),
  receiverId: integer("receiver_id"), // for direct calls
  channelId: integer("channel_id"), // for channel calls
  startTime: timestamp("start_time").defaultNow().notNull(),
  endTime: timestamp("end_time"),
  duration: integer("duration"), // in seconds
  recordingUrl: text("recording_url"), // if call was recorded
});

export const insertCallSchema = createInsertSchema(calls).pick({
  callType: true,
  initiatorId: true,
  receiverId: true,
  channelId: true,
});

export type InsertCall = z.infer<typeof insertCallSchema>;
export type Call = typeof calls.$inferSelect;

// Call participants for group calls
export const callParticipants = pgTable("call_participants", {
  id: serial("id").primaryKey(),
  callId: integer("call_id").notNull(),
  userId: integer("user_id").notNull(),
  joinedAt: timestamp("joined_at").defaultNow().notNull(),
  leftAt: timestamp("left_at"),
  muted: boolean("muted").default(false),
  videoEnabled: boolean("video_enabled").default(false),
});

export const insertCallParticipantSchema = createInsertSchema(callParticipants).pick({
  callId: true,
  userId: true,
  muted: true,
  videoEnabled: true,
});

export type InsertCallParticipant = z.infer<typeof insertCallParticipantSchema>;
export type CallParticipant = typeof callParticipants.$inferSelect;

// User status tracking
export const userStatus = pgTable("user_status", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  status: text("status").default("offline").notNull(), // online, away, busy, do-not-disturb, offline
  customMessage: text("custom_message"),
  lastSeen: timestamp("last_seen").defaultNow().notNull(),
  isInCall: boolean("is_in_call").default(false),
});

export const insertUserStatusSchema = createInsertSchema(userStatus).pick({
  userId: true,
  status: true,
  customMessage: true,
  isInCall: true,
});

export type InsertUserStatus = z.infer<typeof insertUserStatusSchema>;
export type UserStatus = typeof userStatus.$inferSelect;

// Message Reactions table
export const messageReactions = pgTable("message_reactions", {
  id: serial("id").primaryKey(),
  messageId: integer("message_id").notNull(),
  userId: integer("user_id").notNull(),
  emoji: text("emoji").notNull(), // The emoji used for reaction
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertMessageReactionSchema = createInsertSchema(messageReactions).pick({
  messageId: true,
  userId: true,
  emoji: true,
});

export type InsertMessageReaction = z.infer<typeof insertMessageReactionSchema>;
export type MessageReaction = typeof messageReactions.$inferSelect;

// Message reactions relations
export const messageReactionsRelations = relations(messageReactions, ({ one }) => ({
  message: one(messages, {
    fields: [messageReactions.messageId],
    references: [messages.id]
  }),
  user: one(users, {
    fields: [messageReactions.userId],
    references: [users.id]
  })
}));

// File uploads table for media sharing
export const fileUploads = pgTable("file_uploads", {
  id: serial("id").primaryKey(),
  filename: text("filename").notNull(),
  originalName: text("original_name").notNull(),
  mimeType: text("mime_type").notNull(),
  size: integer("size").notNull(), // file size in bytes
  uploadedBy: integer("uploaded_by").notNull(),
  url: text("url").notNull(), // Storage URL or path
  isPublic: boolean("is_public").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertFileUploadSchema = createInsertSchema(fileUploads).pick({
  filename: true,
  originalName: true,
  mimeType: true,
  size: true,
  uploadedBy: true,
  url: true,
  isPublic: true,
});

export type InsertFileUpload = z.infer<typeof insertFileUploadSchema>;
export type FileUpload = typeof fileUploads.$inferSelect;

// File upload relations
export const fileUploadsRelations = relations(fileUploads, ({ one }) => ({
  uploader: one(users, {
    fields: [fileUploads.uploadedBy],
    references: [users.id]
  })
}));
