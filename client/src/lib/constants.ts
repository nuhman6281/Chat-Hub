/**
 * Application constants
 */

// Status options for users
export const USER_STATUS = {
  ONLINE: "online",
  AWAY: "away",
  BUSY: "busy",
  OFFLINE: "offline",
};

// User roles in workspaces
export const WORKSPACE_ROLES = {
  OWNER: "owner",
  ADMIN: "admin",
  MEMBER: "member",
};

// Default avatar placeholders
export const DEFAULT_AVATARS = {
  USER: "https://ui-avatars.com/api/?background=6366F1&color=fff",
  WORKSPACE: "https://ui-avatars.com/api/?background=8B5CF6&color=fff",
};

// Typing indicator timeout (milliseconds)
export const TYPING_TIMEOUT = 3000;

// Maximum message length
export const MAX_MESSAGE_LENGTH = 5000;

// Message fetch limits
export const MESSAGE_FETCH_LIMIT = 50;

// Avatar colors
export const AVATAR_COLORS = [
  "bg-blue-500",
  "bg-green-500",
  "bg-yellow-500",
  "bg-red-500",
  "bg-purple-500",
  "bg-pink-500",
  "bg-indigo-500",
  "bg-teal-500",
];

// Route paths
export const ROUTES = {
  HOME: "/",
  AUTH: "/auth",
  WORKSPACE: "/workspace/:workspaceId",
  CHANNEL: "/workspace/:workspaceId/channel/:channelId",
  DIRECT_MESSAGE: "/dm/:dmId",
  SETTINGS: "/settings",
  PROFILE: "/profile",
};

// Local storage keys
export const STORAGE_KEYS = {
  THEME: "theme",
  AUTH_TOKEN: "auth_token",
  ACTIVE_WORKSPACE: "active_workspace",
};

// Notification sounds
export const NOTIFICATION_SOUNDS = {
  MESSAGE: "/sounds/message.mp3",
  MENTION: "/sounds/mention.mp3",
  CALL: "/sounds/call.mp3",
};
