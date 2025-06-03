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
  User as SchemaUser,
} from "@shared/schema";

// Use the User type from AuthContext
type User = {
  id: number;
  username: string;
  displayName: string;
  status: string;
  avatarUrl?: string | null;
  email: string;
  password: string;
};

// Extend the MessageWithUser type to include optimistic properties
interface ExtendedMessage extends MessageWithUser {
  _isOptimistic?: boolean;
  updatedAt: Date;
}

// Extend the DirectMessage type to include user information
interface ExtendedDirectMessage extends DirectMessage {
  otherUser: User;
  lastMessage?: ExtendedMessage;
}

// Define types for our chat messages and state
interface ChatContextType {
  activeWorkspace: Workspace | null;
  activeChannel: Channel | null;
  activeDM: ExtendedDirectMessage | null;
  activeChat: Channel | ExtendedDirectMessage | null;
  messages: ExtendedMessage[];
  workspaces: Workspace[];
  channels: Channel[];
  directMessages: ExtendedDirectMessage[];
  isLoading: boolean;
  isLoadingMessages: boolean;
  isConnected: boolean;
  error: Error | null;
  setActiveWorkspace: (workspace: Workspace | null) => void;
  setActiveChannel: (channel: Channel | null) => void;
  setActiveDM: (dm: ExtendedDirectMessage | null) => void;
  sendMessage: (content: string) => Promise<void>;
  createChannel: (name: string, description?: string) => Promise<void>;
  createDirectMessage: (userId: number) => Promise<void>;
  reconnectSocket: () => void;
  refreshChannels: () => Promise<void>;
  loadMoreMessages: () => Promise<void>;
  createWorkspace: (
    name: string,
    iconText: string
  ) => Promise<Workspace | null>;
  joinChannel: (channelId: number) => Promise<any>;
  hasNewMessages: boolean;
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
  const [isConnected, setIsConnected] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const [currentWorkspace, setCurrentWorkspace] = useState<Workspace | null>(
    null
  );
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [currentChannel, setCurrentChannel] = useState<Channel | null>(null);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [currentDirectMessage, setCurrentDirectMessage] =
    useState<ExtendedDirectMessage | null>(null);
  const [directMessages, setDirectMessages] = useState<ExtendedDirectMessage[]>(
    []
  );
  const [messages, setMessages] = useState<ExtendedMessage[]>([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [activeChat, setActiveChat] = useState<
    Channel | ExtendedDirectMessage | null
  >(null);

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

    // Add handler for channel membership errors
    const handleChannelMembershipError = async (error: any) => {
      console.log("ChatContext: Received channel membership error", error);

      // Check if we have an active channel
      if (currentChannel && user) {
        try {
          console.log(
            `Automatically joining channel ${currentChannel.id} for user ${user.id}`
          );

          // Join the channel
          await joinChannel(currentChannel.id);

          toast({
            title: "Channel Joined",
            description:
              "You've been added to the channel. You can now send messages.",
          });

          // If there was a pending message, retry sending it
          if (lastAttemptedMessage) {
            console.log(
              "Retrying to send last attempted message:",
              lastAttemptedMessage
            );
            // Wait a moment to ensure the join has completed
            setTimeout(() => {
              sendMessage(lastAttemptedMessage);
              setLastAttemptedMessage(null);
            }, 500);
          }
        } catch (joinError) {
          console.error("Failed to join channel:", joinError);
          toast({
            title: "Error",
            description: "Failed to join channel. Please try again.",
            variant: "destructive",
          });
        }
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
    const cleanupChannelMembershipError = socket.on(
      "channel_membership_error",
      handleChannelMembershipError
    );
    const cleanupMessage = socket.on("message", handleMessage);

    // Connect socket when user is available and setup retry logic
    if (user) {
      console.log("ChatContext: Connecting socket for user:", user.id);
      socket.connect(String(user.id));

      // Set a timeout to retry authentication if it doesn't succeed
      authTimeoutId = setTimeout(() => {
        if (!isAuthenticated && socket.connected) {
          console.log(
            "ChatContext: Authentication timeout - retrying authentication explicitly"
          );
          // Try to authenticate again with the correct format
          const success = socket.authenticate();
          console.log("Authentication retry success:", success);
        }
      }, 3000);
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
      cleanupChannelMembershipError();
      cleanupMessage();
    };
  }, [socket, user, toast, currentChannel, currentDirectMessage]);

  // Listen for new messages via WebSocket
  useEffect(() => {
    if (!isConnected || !isAuthenticated) return;

    const handleNewMessage = (message: ExtendedMessage) => {
      console.log("New message received:", message);
      // Only add message if it belongs to the active conversation
      if (
        (currentChannel && message.channelId === currentChannel.id) ||
        (currentDirectMessage &&
          message.directMessageId === currentDirectMessage.id)
      ) {
        setMessages((prev) => {
          // Check if this message was already in the list (prevent duplicates)
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

          if (exists) {
            return prev;
          }

          // Check if this is a confirmation of an optimistic message
          const optimisticIndex = prev.findIndex(
            (m) =>
              m._isOptimistic === true &&
              m.content === message.content &&
              m.userId === message.userId
          );

          if (optimisticIndex >= 0) {
            // Replace the optimistic message with the real one
            const newMessages = [...prev];
            newMessages[optimisticIndex] = message;
            return newMessages.sort((a, b) => {
              return (
                new Date(a.createdAt).getTime() -
                new Date(b.createdAt).getTime()
              );
            });
          }

          // Otherwise add the new message and sort chronologically (oldest first)
          return [...prev, message].sort((a, b) => {
            return (
              new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
            );
          });
        });
      }

      // Update last message in direct messages list
      if (message.directMessageId) {
        setDirectMessages((prev) =>
          prev.map((dm) =>
            dm.id === message.directMessageId
              ? { ...dm, lastMessage: message }
              : dm
          )
        );
      }
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
      const response = await fetch("/api/workspaces");
      if (response.ok) {
        const data = await response.json();
        setWorkspaces(data);

        // Select first workspace if none is active
        if (data.length > 0 && !currentWorkspace) {
          setCurrentWorkspace(data[0]);
        }
      }
    } catch (error) {
      console.error("Failed to fetch workspaces:", error);
    }
  };

  const fetchChannels = async (workspaceId: number) => {
    try {
      const response = await fetch(`/api/workspaces/${workspaceId}/channels`);
      if (response.ok) {
        const data = await response.json();
        setChannels(data);

        // Select first channel if none is active
        if (data.length > 0 && !currentChannel) {
          setCurrentChannel(data[0]);
        }
      }
    } catch (error) {
      console.error("Failed to fetch channels:", error);
    }
  };

  const fetchDirectMessages = async () => {
    try {
      const response = await fetch("/api/direct-messages");
      if (response.ok) {
        const data = await response.json();
        setDirectMessages(data);
      }
    } catch (error) {
      console.error("Failed to fetch direct messages:", error);
    }
  };

  const fetchMessages = async (type: "channel" | "dm", id: number) => {
    setIsLoadingMessages(true);
    try {
      const endpoint =
        type === "channel"
          ? `/api/channels/${id}/messages`
          : `/api/direct-messages/${id}/messages`;

      const response = await fetch(endpoint);
      if (response.ok) {
        const data = await response.json();
        setMessages(
          data.map((msg: MessageWithUser) => ({
            ...msg,
            _isOptimistic: false,
          }))
        );
      }
    } catch (error) {
      console.error("Failed to fetch messages:", error);
    } finally {
      setIsLoadingMessages(false);
    }
  };

  const setActiveWorkspace = (workspace: Workspace | null) => {
    setCurrentWorkspace(workspace);
  };

  const setActiveChannel = async (channel: Channel | null) => {
    setCurrentChannel(channel);

    // Automatically join the channel if it's not null
    if (channel && user) {
      try {
        console.log(`Joining channel ${channel.id} for user ${user.id}`);
        await joinChannel(channel.id);
      } catch (error) {
        console.error("Failed to join channel:", error);
        // We still set the channel as active even if join fails
        // The join will be retried when sending a message
      }
    }
  };

  // Add a function to join a channel
  const joinChannel = async (channelId: number) => {
    if (!user) {
      console.error("Cannot join channel: User not authenticated");
      return;
    }

    try {
      const response = await fetch(`/api/channels/${channelId}/join`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (response.status === 400) {
        // Already a member, that's fine
        return;
      }

      if (!response.ok) {
        throw new Error(`Failed to join channel: ${response.statusText}`);
      }

      console.log(`Successfully joined channel ${channelId}`);
      return await response.json();
    } catch (error) {
      console.error("Error joining channel:", error);
      toast({
        title: "Error",
        description: "Failed to join channel. Please try again.",
        variant: "destructive",
      });
    }
  };

  const setActiveDM = (dm: ExtendedDirectMessage | null) => {
    setCurrentDirectMessage(dm);
  };

  // Update the sendMessage function to store the last attempted message
  const [lastAttemptedMessage, setLastAttemptedMessage] = useState<
    string | null
  >(null);

  const sendMessage = async (content: string) => {
    if (!user) {
      toast({
        title: "Error",
        description: "You need to be logged in to send messages",
        variant: "destructive",
      });
      return;
    }

    if (!socket.connected) {
      console.error("Cannot send message: Socket not connected");

      // Try to reconnect
      reconnectSocket();

      toast({
        title: "Connection Error",
        description: "Reconnecting to server...",
        variant: "destructive",
      });
      return;
    }

    // Save the message content in case we need to retry
    setLastAttemptedMessage(content);

    // Create message data based on current conversation
    const messageData: any = { content };

    if (currentChannel) {
      messageData.channelId = currentChannel.id;
    } else if (currentDirectMessage) {
      messageData.directMessageId = currentDirectMessage.id;
    } else {
      console.error("No active conversation to send message to");
      return;
    }

    // Add optimistic message to UI
    const optimisticMessage: ExtendedMessage = {
      id: -1, // Temporary ID
      content,
      userId: user.id,
      channelId: currentChannel?.id || null,
      directMessageId: currentDirectMessage?.id || null,
      createdAt: new Date(),
      updatedAt: new Date(),
      user: {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        status: user.status,
        avatarUrl: user.avatarUrl || null,
        email: user.email || "",
        password: "", // We don't have access to the password, but it's required by the type
      },
      _isOptimistic: true,
    };

    setMessages((prev) => [...prev, optimisticMessage]);

    // Send via WebSocket
    console.log("Sending message via socket:", messageData);
    const sent = socket.send("message", messageData);

    if (!sent) {
      console.error("Failed to send message via WebSocket");

      // If WebSocket send failed, try HTTP fallback
      try {
        const endpoint = currentChannel
          ? `/api/channels/${currentChannel.id}/messages`
          : `/api/direct-messages/${currentDirectMessage?.id}/messages`;

        const response = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ content }),
        });

        if (!response.ok) {
          throw new Error("Failed to send message via HTTP");
        }

        // Successfully sent via HTTP
        console.log("Message sent via HTTP fallback");
      } catch (error) {
        console.error("Error sending message:", error);

        // Remove optimistic message if both methods failed
        setMessages((prev) => prev.filter((msg) => msg !== optimisticMessage));

        toast({
          title: "Error",
          description: "Failed to send message. Please try again.",
          variant: "destructive",
        });
      }
    }
  };

  const loadMoreMessages = async () => {
    if (currentChannel) {
      fetchMessages("channel", currentChannel.id);
    } else if (currentDirectMessage) {
      fetchMessages("dm", currentDirectMessage.id);
    }
  };

  const createWorkspace = async (name: string, iconText: string) => {
    if (!user) {
      console.error("Cannot create workspace: User not authenticated");
      toast({
        title: "Authentication Error",
        description: "Please log in to create a workspace.",
        variant: "destructive",
      });
      return null;
    }

    try {
      const response = await fetch("/api/workspaces", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          iconText,
          userId: user.id,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to create workspace: ${response.statusText}`);
      }

      const newWorkspace = await response.json();

      // Update workspaces list
      setWorkspaces((prev) => [...prev, newWorkspace]);

      // Set as active workspace
      setCurrentWorkspace(newWorkspace);

      toast({
        title: "Workspace Created",
        description: `${name} workspace has been created successfully.`,
      });

      return newWorkspace;
    } catch (error) {
      console.error("Error creating workspace:", error);
      toast({
        title: "Failed to Create Workspace",
        description: "An error occurred while creating your workspace.",
        variant: "destructive",
      });
      return null;
    }
  };

  const createChannel = async (name: string, description?: string) => {
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
            isPrivate: false,
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
    if (!user) {
      console.error("Cannot reconnect socket: No user available");
      return;
    }

    console.log("Attempting to reconnect socket for user:", user.id);

    // First disconnect if already connected
    socket.disconnect();

    // Then connect again
    setTimeout(() => {
      socket.connect(String(user.id));
    }, 500);
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

  return (
    <ChatContext.Provider
      value={{
        workspaces,
        channels,
        directMessages,
        activeWorkspace: currentWorkspace,
        activeChannel: currentChannel,
        activeDM: currentDirectMessage,
        activeChat: currentChannel || currentDirectMessage,
        messages: messages as ExtendedMessage[],
        isLoadingMessages,
        isConnected,
        isLoading,
        error,
        setActiveWorkspace,
        setActiveChannel,
        setActiveDM: setActiveDM as (dm: ExtendedDirectMessage | null) => void,
        sendMessage,
        loadMoreMessages,
        createWorkspace,
        createChannel,
        reconnectSocket,
        refreshChannels,
        hasNewMessages,
        createDirectMessage,
        joinChannel,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
};

export function useChat() {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error("useChat must be used within a ChatProvider");
  }
  return context;
}
