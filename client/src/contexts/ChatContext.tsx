import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useSocket } from "@/lib/socket";
import { useToast } from "@/hooks/use-toast";
import {
  Workspace,
  Channel,
  Message,
  DirectMessage,
  MessageWithUser,
  User,
  ChannelWithMemberCount,
  DirectMessageWithUser,
  WorkspaceMember,
  ChannelMember,
  ClientUser,
} from "@shared/schema";
import { useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";

// Extend the MessageWithUser type to include optimistic properties
interface ExtendedMessage extends MessageWithUser {
  _isOptimistic?: boolean;
}

// Extend the DirectMessage type to include user information
interface ExtendedDirectMessage extends DirectMessageWithUser {
  _isOptimistic?: boolean;
}

// Define types for our chat messages and state
export interface ChatContextType {
  user: ClientUser | null;
  messages: MessageWithUser[];
  isLoadingMessages: boolean;
  activeChannel: Channel | null;
  activeDM: DirectMessageWithUser | null;
  activeWorkspace: Workspace | null;
  workspaces: Workspace[];
  channels: ChannelWithMemberCount[];
  directMessages: DirectMessageWithUser[];
  isConnected: boolean;
  createChannel: (
    name: string,
    description?: string,
    isPrivate?: boolean
  ) => Promise<void>;
  createDirectMessage: (userId: number) => Promise<void>;
  createWorkspace: (name: string, iconText?: string) => Promise<void>;
  sendMessage: (content: string) => void;
  setActiveChannel: (channel: Channel | null) => void;
  setActiveDM: (dm: DirectMessageWithUser | null) => void;
  setActiveWorkspace: (workspace: Workspace | null) => void;
  workspaceMembers: WorkspaceMember[];
  channelMembers: ChannelMember[];
  inviteToWorkspace: (email: string, workspaceId: string) => Promise<void>;
  joinChannel: (channelId: string) => Promise<void>;
  leaveChannel: (channelId: string) => Promise<void>;
}

const ChatContext = createContext<ChatContextType | null>(null);

export { ChatContext }; // Export the context

export const ChatProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const auth = useAuth();
  if (!auth) {
    throw new Error("Auth context is not available");
  }
  const { user } = auth;
  const socket = useSocket();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [isConnected, setIsConnected] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const [currentWorkspace, setCurrentWorkspace] = useState<Workspace | null>(
    null
  );
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [currentChannel, setCurrentChannel] = useState<Channel | null>(null);
  const [channels, setChannels] = useState<ChannelWithMemberCount[]>([]);
  const [currentDirectMessage, setCurrentDirectMessage] =
    useState<ExtendedDirectMessage | null>(null);
  const [directMessages, setDirectMessages] = useState<ExtendedDirectMessage[]>(
    []
  );
  const [messages, setMessages] = useState<ExtendedMessage[]>([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [activeChat, setActiveChat] = useState<Channel | DirectMessage | null>(
    null
  );

  // Fetch workspaces when user changes
  useEffect(() => {
    if (user) {
      fetchWorkspaces();
    } else {
      setWorkspaces([]);
      setCurrentWorkspace(null);
    }
  }, [user]);

  // Fetch channels when active workspace changes
  useEffect(() => {
    if (currentWorkspace) {
      fetchChannels(currentWorkspace.id);
    } else {
      setChannels([]);
      setCurrentChannel(null);
    }
  }, [currentWorkspace]);

  // Fetch direct messages when user changes
  useEffect(() => {
    if (user) {
      fetchDirectMessages();
    } else {
      setDirectMessages([]);
      setCurrentDirectMessage(null);
    }
  }, [user]);

  // Fetch messages when active channel or DM changes
  useEffect(() => {
    if (currentChannel) {
      fetchMessages("channel", currentChannel.id);
      setCurrentDirectMessage(null);
    } else if (currentDirectMessage) {
      fetchMessages("dm", currentDirectMessage.id);
      setCurrentChannel(null);
    } else {
      setMessages([]);
    }
  }, [currentChannel, currentDirectMessage]);

  // Handle socket connection state
  useEffect(() => {
    let authTimeoutId: NodeJS.Timeout;

    // Define event handlers
    const handleConnect = () => {
      console.log("ChatContext: Socket connected event received");
      setIsConnected(true);

      // Authenticate immediately after connection
      if (user) {
        setTimeout(() => {
          console.log("ChatContext: Authenticating after connection");
          const success = socket.authenticate();
          if (!success) {
            console.error("ChatContext: Initial authentication failed");
          }
        }, 100); // Short delay to ensure connection is fully established
      }
    };

    const handleDisconnect = () => {
      console.log("ChatContext: Socket disconnected event received");
      setIsConnected(false);
      setIsAuthenticated(false);
    };

    const handleAuthSuccess = (data: any) => {
      console.log("ChatContext: Authentication successful", data);
      setIsAuthenticated(true);

      // Clear any pending authentication timeout
      if (authTimeoutId) {
        clearTimeout(authTimeoutId);
      }

      toast({
        title: "Connected",
        description: "WebSocket connection established and authenticated.",
      });
    };

    const handleAuthError = (error: any) => {
      // This handler now catches general socket errors too
      console.error("ChatContext: Received error from socket", error);
      const errorMessage = error?.message || "An unknown error occurred.";

      // Check if it's specifically an authentication error
      if (
        errorMessage.toLowerCase().includes("authenticate") ||
        errorMessage.toLowerCase().includes("auth")
      ) {
        setIsAuthenticated(false);
        toast({
          title: "Authentication Error",
          description: `Failed to authenticate WebSocket connection: ${errorMessage}. Please try refreshing.`,
          variant: "destructive",
        });
      } else {
        // Handle other errors (like message sending errors)
        toast({
          title: "Server Error",
          description: errorMessage,
          variant: "destructive",
        });
      }
    };

    const handleMessage = (data: any) => {
      console.log("ChatContext: Message received", data);
      if (data.type === "message" || data.data?.content) {
        const message = data.data || data;

        setMessages((prev) => {
          // Check for duplicates using both ID and content/timestamp
          const exists = prev.some(
            (m) =>
              m.id === message.id ||
              (m.content === message.content &&
                m.userId === message.userId &&
                Math.abs(
                  new Date(m.createdAt).getTime() -
                    new Date(message.createdAt).getTime()
                ) < 5000)
          );

          if (exists) return prev;

          // Add new message and sort chronologically
          return [...prev, message].sort(
            (a, b) =>
              new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
          );
        });
      }
    };

    // Set up event listeners
    const cleanupConnect = socket.on("connect", handleConnect);
    const cleanupDisconnect = socket.on("disconnect", handleDisconnect);
    const cleanupAuthSuccess = socket.on("auth_success", handleAuthSuccess);
    const cleanupError = socket.on("error", handleAuthError);
    const cleanupMessage = socket.on("message", handleMessage);

    // Connect socket when user is available and setup retry logic
    if (user) {
      console.log("ChatContext: Connecting socket for user:", user.id);
      socket.connect(String(user.id));

      // Set a timeout to retry authentication if it doesn't succeed
      authTimeoutId = setTimeout(() => {
        if (!isAuthenticated && isConnected) {
          console.log(
            "ChatContext: Authentication timeout - retrying authentication"
          );
          socket.authenticate();
        }
      }, 2000);
    }

    // Clean up event listeners and timeout
    return () => {
      if (authTimeoutId) {
        clearTimeout(authTimeoutId);
      }
      cleanupConnect();
      cleanupDisconnect();
      cleanupAuthSuccess();
      cleanupError();
      cleanupMessage();
    };
  }, [socket, user, toast, currentChannel, currentDirectMessage]);

  // Listen for new messages via WebSocket
  useEffect(() => {
    if (!isConnected || !isAuthenticated) return;

    const handleNewMessage = (message: ExtendedMessage) => {
      // Ensure the message has all required User fields
      if (!message.user.email) {
        console.error("Message user is missing required fields");
        return;
      }

      setMessages((prev) => {
        // Check if message already exists
        const exists = prev.some((m) => m.id === message.id);
        if (exists) {
          return prev;
        }

        // Add new message
        return [...prev, message];
      });
    };

    const unsubscribe = socket.on("new_message", handleNewMessage);

    return () => {
      unsubscribe();
    };
  }, [
    isConnected,
    isAuthenticated,
    currentChannel,
    currentDirectMessage,
    socket,
  ]);

  // API calls
  const fetchWorkspaces = async () => {
    try {
      const response = await api.get("/workspaces");
      setWorkspaces(response.data);

      // Select first workspace if none is active
      if (response.data.length > 0 && !currentWorkspace) {
        setCurrentWorkspace(response.data[0]);
      }
    } catch (error) {
      console.error("Failed to fetch workspaces:", error);
    }
  };

  const fetchChannels = async (workspaceId: number) => {
    try {
      const response = await api.get(`/workspaces/${workspaceId}/channels`);
      setChannels(response.data);

      // Select first channel if none is active
      if (response.data.length > 0 && !currentChannel) {
        setCurrentChannel(response.data[0]);
      }
    } catch (error) {
      console.error("Failed to fetch channels:", error);
    }
  };

  const fetchDirectMessages = async () => {
    try {
      const response = await api.get("/direct-messages");
      setDirectMessages(response.data);
    } catch (error) {
      console.error("Failed to fetch direct messages:", error);
    }
  };

  const fetchMessages = async (type: "channel" | "dm", id: number) => {
    setIsLoadingMessages(true);
    try {
      const endpoint =
        type === "channel"
          ? `/channels/${id}/messages`
          : `/direct-messages/${id}/messages`;

      const response = await api.get(endpoint);
      setMessages(
        response.data.map((msg: MessageWithUser) => ({
          ...msg,
          _isOptimistic: false,
        }))
      );
    } catch (error) {
      console.error("Failed to fetch messages:", error);
    } finally {
      setIsLoadingMessages(false);
    }
  };

  const setActiveWorkspace = (workspace: Workspace | null) => {
    setCurrentWorkspace(workspace);
  };

  const setActiveChannel = (channel: Channel | null) => {
    setCurrentChannel(channel);
  };

  const setActiveDM = (dm: ExtendedDirectMessage | null) => {
    setCurrentDirectMessage(dm);
  };

  const sendMessage = (content: string) => {
    if (!user) {
      console.error("Cannot send message: User not authenticated");
      toast({
        title: "Authentication Error",
        description: "Please log in to send messages.",
        variant: "destructive",
      });
      return;
    }

    if (!isConnected) {
      console.error("Cannot send message: Socket not connected");
      toast({
        title: "Connection Error",
        description: "Please wait while we reconnect to the server.",
        variant: "destructive",
      });
      // Attempt to reconnect
      try {
        console.log("Attempting to reconnect socket for user:", user.id);
        socket.connect(String(user.id));
      } catch (error) {
        console.error("Failed to reconnect:", error);
      }
      return;
    }

    if (!isAuthenticated) {
      console.error("Cannot send message: Socket not authenticated");
      toast({
        title: "Authentication Error",
        description: "Please wait while we authenticate your connection.",
        variant: "destructive",
      });
      // Attempt to re-authenticate
      try {
        console.log("Attempting to re-authenticate socket for user:", user.id);
        socket.authenticate();

        // Give some time for authentication to complete
        setTimeout(() => {
          if (!isAuthenticated) {
            console.log(
              "Authentication timeout - please try sending your message again"
            );
          }
        }, 2000);
      } catch (error) {
        console.error("Failed to re-authenticate:", error);
      }
      return;
    }

    if (!currentChannel && !currentDirectMessage) {
      console.error("Cannot send message: No active channel or direct message");
      toast({
        title: "No Active Conversation",
        description: "Please select a channel or direct message to send to.",
        variant: "destructive",
      });
      return;
    }

    try {
      // Create message object
      const messageData = {
        content,
        userId: user.id,
        ...(currentChannel && { channelId: currentChannel.id }),
        ...(currentDirectMessage && {
          directMessageId: currentDirectMessage.id,
        }),
      };

      console.log("Sending message:", messageData);

      // Create a client-side ID to track this message
      const clientMessageId = Date.now();

      // Create an optimistic message for immediate UI feedback
      const optimisticMessage: ExtendedMessage = {
        id: clientMessageId,
        content,
        channelId: currentChannel?.id || null,
        directMessageId: currentDirectMessage?.id || null,
        userId: user.id,
        createdAt: new Date(),
        updatedAt: new Date(),
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          displayName: user.displayName,
          status: user.status,
          avatarUrl: user.avatarUrl || null,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
        },
        _isOptimistic: true,
      };

      // Add to messages with special handling to avoid duplicates
      setMessages((prev) => {
        // Only add if it doesn't exist yet (prevent duplicates)
        const exists = prev.some(
          (msg) =>
            msg._isOptimistic &&
            msg.content === content &&
            new Date(msg.createdAt).getTime() > Date.now() - 5000
        );

        if (exists) {
          return prev; // Don't add duplicate optimistic messages
        }

        const newMessages = [...prev, optimisticMessage];
        // Sort messages by date ascending (oldest first)
        return newMessages.sort((a, b) => {
          return (
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
          );
        });
      });

      // Send via Socket
      const success = socket.send("message", {
        ...messageData,
        clientMessageId,
      });

      if (!success) {
        // Remove optimistic message on failure
        setMessages((prev) => prev.filter((msg) => msg.id !== clientMessageId));

        toast({
          title: "Failed to send message",
          description: "Could not send message. Please try again.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error sending message:", error);
      toast({
        title: "Failed to send message",
        description: "An error occurred while sending your message.",
        variant: "destructive",
      });
    }
  };

  const loadMoreMessages = async () => {
    if (currentChannel) {
      fetchMessages("channel", currentChannel.id);
    } else if (currentDirectMessage) {
      fetchMessages("dm", currentDirectMessage.id);
    }
  };

  const createWorkspace = async (name: string, iconText?: string) => {
    try {
      const response = await api.post("/workspaces", {
        name,
        iconText,
      });

      if (response.status !== 200) {
        throw new Error("Failed to create workspace");
      }

      const newWorkspace = response.data;
      setWorkspaces((prev) => [...prev, newWorkspace]);
      setCurrentWorkspace(newWorkspace);
      toast({
        title: "Success",
        description: "Workspace created successfully",
      });
    } catch (error) {
      console.error("Error creating workspace:", error);
      toast({
        title: "Error",
        description: "Failed to create workspace",
        variant: "destructive",
      });
    }
  };

  const createChannel = async (
    name: string,
    description?: string,
    isPrivate?: boolean
  ) => {
    if (!user) {
      console.error("Cannot create channel: User not authenticated");
      toast({
        title: "Authentication Error",
        description: "Please log in to create a channel.",
        variant: "destructive",
      });
      return;
    }

    if (!currentWorkspace) {
      console.error("Cannot create channel: No active workspace");
      toast({
        title: "No Active Workspace",
        description: "Please select a workspace to create a channel in.",
        variant: "destructive",
      });
      return;
    }

    try {
      const response = await fetch(
        `/api/workspaces/${currentWorkspace.id}/channels`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name,
            isPrivate: isPrivate || false,
            description: description || "",
            creatorId: user.id,
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to create channel: ${response.statusText}`);
      }

      const newChannel = await response.json();

      // Update channels list
      setChannels((prev) => [...prev, newChannel]);

      // Set as active channel
      setCurrentChannel(newChannel);

      toast({
        title: "Channel Created",
        description: `#${name} channel has been created successfully.`,
      });
    } catch (error) {
      console.error("Error creating channel:", error);
      toast({
        title: "Failed to Create Channel",
        description: "An error occurred while creating your channel.",
        variant: "destructive",
      });
    }
  };

  const refreshChannels = async () => {
    if (!currentWorkspace) {
      console.error("Cannot refresh channels: No active workspace");
      return;
    }

    try {
      await fetchChannels(currentWorkspace.id);
      toast({
        title: "Channels Refreshed",
        description: "Channel list has been updated.",
      });
    } catch (error) {
      console.error("Error refreshing channels:", error);
      toast({
        title: "Refresh Failed",
        description: "Failed to refresh channels. Please try again.",
        variant: "destructive",
      });
    }
  };

  const reconnectSocket = () => {
    if (user) {
      console.log("Manually reconnecting socket for user:", user.id);
      setIsConnected(false);
      setIsAuthenticated(false);

      // Force disconnect then reconnect
      socket.disconnect();

      // Wait a bit then reconnect
      setTimeout(() => {
        toast({
          title: "Reconnecting",
          description: "Attempting to reconnect to the server...",
        });
        socket.connect(String(user.id));

        // Wait a bit more then authenticate
        setTimeout(() => {
          if (isConnected && !isAuthenticated) {
            console.log("Authenticating after manual reconnect");
            socket.authenticate();
          }
        }, 1000);
      }, 500);
    } else {
      toast({
        title: "Authentication Error",
        description: "You must be logged in to connect.",
        variant: "destructive",
      });
    }
  };

  const hasNewMessages = !!messages.find((m) => m._isOptimistic);

  const createDirectMessage = async (userId: number) => {
    if (!user) {
      console.error("Cannot create direct message: User not authenticated");
      toast({
        title: "Authentication Error",
        description: "Please log in to create a direct message.",
        variant: "destructive",
      });
      return;
    }

    try {
      const response = await fetch("/api/direct-messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          user2Id: userId,
        }),
      });

      if (!response.ok) {
        throw new Error(
          `Failed to create direct message: ${response.statusText}`
        );
      }

      const newDM = await response.json();

      // Update direct messages list
      setDirectMessages((prev) => [...prev, newDM]);

      // Set as active DM
      setCurrentDirectMessage(newDM);

      toast({
        title: "Direct Message Created",
        description: "You can now start chatting.",
      });
    } catch (error) {
      console.error("Error creating direct message:", error);
      toast({
        title: "Failed to Create Direct Message",
        description: "An error occurred while creating the direct message.",
        variant: "destructive",
      });
    }
  };

  const workspaceMembers =
    useQuery({
      queryKey: ["/api/workspace-members", currentWorkspace?.id],
      queryFn: async () => {
        if (!currentWorkspace) return [];
        const response = await api.get(
          `/workspaces/${currentWorkspace.id}/members`
        );
        return response.data;
      },
      enabled: !!currentWorkspace,
    }).data || [];

  const channelMembers =
    useQuery({
      queryKey: ["/api/channel-members", currentChannel?.id],
      queryFn: async () => {
        if (!currentChannel) return [];
        const response = await api.get(
          `/channels/${currentChannel.id}/members`
        );
        return response.data;
      },
      enabled: !!currentChannel,
    }).data || [];

  const inviteToWorkspace = async (email: string, workspaceId: string) => {
    if (!user) {
      console.error("Cannot invite to workspace: User not authenticated");
      toast({
        title: "Authentication Error",
        description: "Please log in to invite to a workspace.",
        variant: "destructive",
      });
      return;
    }

    try {
      const response = await api.post(`/workspaces/${workspaceId}/invite`, {
        email,
      });
      toast({
        title: "Invitation Sent",
        description: `Invitation to workspace has been sent to ${email}.`,
      });
    } catch (error) {
      console.error("Error inviting to workspace:", error);
      toast({
        title: "Failed to Invite to Workspace",
        description: "An error occurred while inviting to the workspace.",
        variant: "destructive",
      });
    }
  };

  const joinChannel = async (channelId: string) => {
    if (!user) {
      console.error("Cannot join channel: User not authenticated");
      toast({
        title: "Authentication Error",
        description: "Please log in to join a channel.",
        variant: "destructive",
      });
      return;
    }

    try {
      const response = await api.post(`/channels/${channelId}/join`);
      toast({
        title: "Joined Channel",
        description: `You have joined the channel.`,
      });
    } catch (error) {
      console.error("Error joining channel:", error);
      toast({
        title: "Failed to Join Channel",
        description: "An error occurred while joining the channel.",
        variant: "destructive",
      });
    }
  };

  const leaveChannel = async (channelId: string) => {
    if (!user) {
      console.error("Cannot leave channel: User not authenticated");
      toast({
        title: "Authentication Error",
        description: "Please log in to leave a channel.",
        variant: "destructive",
      });
      return;
    }

    try {
      const response = await api.post(`/channels/${channelId}/leave`);
      toast({
        title: "Left Channel",
        description: `You have left the channel.`,
      });
    } catch (error) {
      console.error("Error leaving channel:", error);
      toast({
        title: "Failed to Leave Channel",
        description: "An error occurred while leaving the channel.",
        variant: "destructive",
      });
    }
  };

  const contextValue: ChatContextType = {
    user,
    messages,
    isLoadingMessages,
    activeChannel: currentChannel,
    activeDM: currentDirectMessage,
    activeWorkspace: currentWorkspace,
    workspaces,
    channels,
    directMessages,
    isConnected,
    createChannel,
    createDirectMessage,
    createWorkspace,
    sendMessage,
    setActiveChannel,
    setActiveDM,
    setActiveWorkspace,
    workspaceMembers: [], // TODO: Implement this
    channelMembers: [], // TODO: Implement this
    inviteToWorkspace,
    joinChannel,
    leaveChannel,
  };

  return (
    <ChatContext.Provider value={contextValue}>{children}</ChatContext.Provider>
  );
};

export function useChat() {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error("useChat must be used within a ChatProvider");
  }
  return context;
}
