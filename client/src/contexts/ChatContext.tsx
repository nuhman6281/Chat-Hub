import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from "react";
import { useSocket } from "@/lib/socket";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import {
  User,
  Workspace,
  Channel,
  Message,
  DirectMessage,
} from "@shared/schema";

// Define types for our chat messages and state
interface ChatContextType {
  activeWorkspace: Workspace | null;
  workspaces: Workspace[];
  activeChannel: Channel | null;
  channels: Channel[];
  activeDM: DirectMessage | null;
  directMessages: DirectMessage[];
  messages: Message[];
  isLoadingMessages: boolean;
  isConnected: boolean;
  setActiveWorkspace: (workspace: Workspace | null) => void;
  setActiveChannel: (channel: Channel | null) => void;
  setActiveDM: (dm: DirectMessage | null) => void;
  sendMessage: (content: string) => Promise<boolean>;
  loadMoreMessages: () => Promise<void>;
  createWorkspace: (
    name: string,
    iconText: string
  ) => Promise<Workspace | null>;
  createChannel: (
    name: string,
    isPrivate: boolean,
    description?: string
  ) => Promise<Channel | null>;
  refreshChannels: () => Promise<void>;
  reconnectSocket: () => void;
}

export const ChatContext = createContext<ChatContextType | null>(null);

export const ChatProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const socket = useSocket();
  const [isConnected, setIsConnected] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // State
  const [currentWorkspace, setCurrentWorkspace] = useState<Workspace | null>(
    null
  );
  const [currentChannel, setCurrentChannel] = useState<Channel | null>(null);
  const [currentDirectMessage, setCurrentDirectMessage] =
    useState<DirectMessage | null>(null);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [directMessages, setDirectMessages] = useState<DirectMessage[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);

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
      if (data.type === "message" || (data.data && data.data.content)) {
        // Handle incoming message - normalize data structure
        const message = data.data || data;
        if (
          (currentChannel && message.channelId === currentChannel.id) ||
          (currentDirectMessage &&
            message.directMessageId === currentDirectMessage.id)
        ) {
          setMessages((prev) => [message, ...prev]);
        }
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

    const handleNewMessage = (message: Message) => {
      console.log("New message received:", message);
      // Only add message if it belongs to the active conversation
      if (
        (currentChannel && message.channelId === currentChannel.id) ||
        (currentDirectMessage &&
          message.directMessageId === currentDirectMessage.id)
      ) {
        setMessages((prev) => [message, ...prev]);
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
        setMessages(data);
      }
    } catch (error) {
      console.error("Failed to fetch messages:", error);
    } finally {
      setIsLoadingMessages(false);
    }
  };

  // Actions
  const sendMessage = useCallback(
    async (content: string) => {
      if (!user) {
        console.error("Cannot send message: User not authenticated");
        toast({
          title: "Authentication Error",
          description: "Please log in to send messages.",
          variant: "destructive",
        });
        return false;
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
        return false;
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
          console.log(
            "Attempting to re-authenticate socket for user:",
            user.id
          );
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
        return false;
      }

      if (!currentChannel && !currentDirectMessage) {
        console.error(
          "Cannot send message: No active channel or direct message"
        );
        toast({
          title: "No Active Conversation",
          description: "Please select a channel or direct message to send to.",
          variant: "destructive",
        });
        return false;
      }

      try {
        const messageData = {
          content,
          userId: user.id,
          ...(currentChannel && { channelId: currentChannel.id }),
          ...(currentDirectMessage && {
            directMessageId: currentDirectMessage.id,
          }),
        };

        console.log("Sending message:", messageData);
        const success = socket.send("message", messageData);
        if (!success) {
          toast({
            title: "Failed to send message",
            description: "Could not send message. Please try again.",
            variant: "destructive",
          });
          return false;
        }
        return true;
      } catch (error) {
        console.error("Error sending message:", error);
        toast({
          title: "Failed to send message",
          description: "An error occurred while sending your message.",
          variant: "destructive",
        });
        return false;
      }
    },
    [
      user,
      isConnected,
      isAuthenticated,
      currentChannel,
      currentDirectMessage,
      socket,
      toast,
    ]
  );

  const loadMoreMessages = async (): Promise<void> => {
    // This would implement pagination for messages
    // For now, just return
    return;
  };

  const refreshChannels = async (): Promise<void> => {
    if (currentWorkspace) {
      await fetchChannels(currentWorkspace.id);
    }
  };

  const createChannel = async (
    name: string,
    isPrivate: boolean = false,
    description?: string
  ): Promise<Channel | null> => {
    if (!currentWorkspace || !user) return null;

    try {
      const response = await fetch("/api/channels", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          workspaceId: currentWorkspace.id,
          isPrivate,
          description,
        }),
      });

      if (response.ok) {
        const newChannel = await response.json();
        // Refresh channels list
        await refreshChannels();
        toast({
          title: "Channel created",
          description: `Channel #${name} has been created.`,
        });
        return newChannel;
      } else {
        const error = await response.json();
        toast({
          title: "Failed to create channel",
          description: error.message || "An error occurred.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error creating channel:", error);
      toast({
        title: "Failed to create channel",
        description: "An error occurred while creating the channel.",
        variant: "destructive",
      });
    }

    return null;
  };

  const createWorkspace = async (
    name: string,
    iconText: string
  ): Promise<Workspace | null> => {
    if (!user) return null;

    try {
      const response = await fetch("/api/workspaces", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          iconText,
          ownerId: user.id,
        }),
      });

      if (response.ok) {
        const newWorkspace = await response.json();
        // Refresh workspaces list
        await fetchWorkspaces();
        toast({
          title: "Workspace created",
          description: `Workspace "${name}" has been created.`,
        });
        return newWorkspace;
      } else {
        const error = await response.json();
        toast({
          title: "Failed to create workspace",
          description: error.message || "An error occurred.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error creating workspace:", error);
      toast({
        title: "Failed to create workspace",
        description: "An error occurred while creating the workspace.",
        variant: "destructive",
      });
    }

    return null;
  };

  // Add reconnect function with better authentication handling
  const reconnectSocket = useCallback(() => {
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
  }, [user, socket, toast, isConnected, isAuthenticated]);

  return (
    <ChatContext.Provider
      value={{
        activeWorkspace: currentWorkspace,
        workspaces,
        activeChannel: currentChannel,
        channels,
        activeDM: currentDirectMessage,
        directMessages,
        messages,
        isLoadingMessages,
        isConnected,
        setActiveWorkspace: setCurrentWorkspace,
        setActiveChannel: setCurrentChannel,
        setActiveDM: setCurrentDirectMessage,
        sendMessage,
        loadMoreMessages,
        createWorkspace,
        createChannel,
        refreshChannels,
        reconnectSocket,
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
