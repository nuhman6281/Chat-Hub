import { createContext, ReactNode, useCallback, useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { connectWebSocket } from "@/lib/socket";
import { useToast } from "@/hooks/use-toast";

export interface Message {
  id: number;
  content: string;
  userId: number;
  channelId?: number;
  directMessageId?: number;
  createdAt: Date;
  user: {
    id: number;
    username: string;
    displayName: string;
    status: string;
    avatarUrl?: string;
  };
}

interface Workspace {
  id: number;
  name: string;
  ownerId: number;
  iconText: string;
  createdAt: Date;
}

interface Channel {
  id: number;
  name: string;
  workspaceId: number;
  description?: string;
  isPrivate: boolean;
  createdAt: Date;
  memberCount: number;
}

interface DirectMessage {
  id: number;
  user1Id: number;
  user2Id: number;
  createdAt: Date;
  otherUser: {
    id: number;
    username: string;
    displayName: string;
    status: string;
    avatarUrl?: string;
  };
  lastMessage?: Message;
}

interface ActiveChat {
  type: "channel" | "direct";
  id: number;
  name: string;
  workspaceId?: number;
}

interface ChatContextType {
  workspaces: Workspace[];
  activeWorkspace: Workspace | null;
  setActiveWorkspace: (workspace: Workspace | null) => void;
  
  channels: Channel[];
  activeChannel: Channel | null;
  setActiveChannelById: (channelId: number | null) => void;
  
  directMessages: DirectMessage[];
  activeDirectMessage: DirectMessage | null;
  setActiveDirectMessageById: (dmId: number | null) => void;
  
  messages: Message[];
  sendMessage: (content: string) => void;
  
  activeChat: ActiveChat | null;
  createChannel: (name: string, description: string, isPrivate: boolean) => Promise<void>;
  createDirectMessage: (userId: number) => Promise<void>;
  
  usersTyping: Map<number, boolean>;
  setTyping: (isTyping: boolean) => void;
  
  isLoading: boolean;
  createWorkspace: (name: string, iconText: string) => Promise<void>;
}

export const ChatContext = createContext<ChatContextType>({
  workspaces: [],
  activeWorkspace: null,
  setActiveWorkspace: () => {},
  
  channels: [],
  activeChannel: null,
  setActiveChannelById: () => {},
  
  directMessages: [],
  activeDirectMessage: null,
  setActiveDirectMessageById: () => {},
  
  messages: [],
  sendMessage: () => {},
  
  activeChat: null,
  createChannel: async () => {},
  createDirectMessage: async () => {},
  
  usersTyping: new Map(),
  setTyping: () => {},
  
  isLoading: true,
  createWorkspace: async () => {},
});

export function ChatProvider({ children }: { children: ReactNode }) {
  const { user, isAuthenticated } = useAuth();
  const { toast } = useToast();
  
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [activeWorkspace, setActiveWorkspace] = useState<Workspace | null>(null);
  
  const [channels, setChannels] = useState<Channel[]>([]);
  const [activeChannel, setActiveChannel] = useState<Channel | null>(null);
  
  const [directMessages, setDirectMessages] = useState<DirectMessage[]>([]);
  const [activeDirectMessage, setActiveDirectMessage] = useState<DirectMessage | null>(null);
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [activeChat, setActiveChat] = useState<ActiveChat | null>(null);
  
  const [usersTyping, setUsersTyping] = useState<Map<number, boolean>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  
  const [socket, setSocket] = useState<WebSocket | null>(null);

  // Connect to WebSocket when user is authenticated
  useEffect(() => {
    if (!isAuthenticated || !user) {
      setSocket(null);
      return;
    }

    const newSocket = connectWebSocket(user.id);
    setSocket(newSocket);

    newSocket.addEventListener("message", (event) => {
      const data = JSON.parse(event.data);
      
      if (data.type === "message") {
        if (data.data.channelId === activeChannel?.id || 
            data.data.directMessageId === activeDirectMessage?.id) {
          setMessages(prev => [...prev, data.data]);
        }
        
        // Update last message in direct messages list
        if (data.data.directMessageId) {
          setDirectMessages(prev => prev.map(dm => 
            dm.id === data.data.directMessageId 
              ? { ...dm, lastMessage: data.data } 
              : dm
          ));
        }
      } else if (data.type === "typing") {
        setUsersTyping(prev => {
          const newMap = new Map(prev);
          newMap.set(data.data.userId, data.data.isTyping);
          return newMap;
        });
      }
    });

    return () => {
      newSocket.close();
    };
  }, [isAuthenticated, user, activeChannel, activeDirectMessage]);

  // Fetch workspaces when authenticated
  useEffect(() => {
    if (!isAuthenticated) {
      setWorkspaces([]);
      setIsLoading(false);
      return;
    }

    const fetchWorkspaces = async () => {
      try {
        setIsLoading(true);
        const response = await fetch("/api/workspaces", {
          credentials: "include",
        });
        
        if (response.ok) {
          const data = await response.json();
          setWorkspaces(data);
          
          // Set first workspace as active if none is selected
          if (data.length > 0 && !activeWorkspace) {
            setActiveWorkspace(data[0]);
          }
        }
      } catch (error) {
        console.error("Failed to fetch workspaces:", error);
        toast({
          title: "Error",
          description: "Failed to load workspaces",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchWorkspaces();
  }, [isAuthenticated, toast, activeWorkspace]);

  // Fetch channels when active workspace changes
  useEffect(() => {
    if (!activeWorkspace) {
      setChannels([]);
      return;
    }

    const fetchChannels = async () => {
      try {
        const response = await fetch(`/api/workspaces/${activeWorkspace.id}/channels`, {
          credentials: "include",
        });
        
        if (response.ok) {
          const data = await response.json();
          setChannels(data);
        }
      } catch (error) {
        console.error("Failed to fetch channels:", error);
      }
    };

    fetchChannels();
  }, [activeWorkspace]);

  // Fetch direct messages
  useEffect(() => {
    if (!isAuthenticated) {
      setDirectMessages([]);
      return;
    }

    const fetchDirectMessages = async () => {
      try {
        const response = await fetch("/api/direct-messages", {
          credentials: "include",
        });
        
        if (response.ok) {
          const data = await response.json();
          setDirectMessages(data);
        }
      } catch (error) {
        console.error("Failed to fetch direct messages:", error);
      }
    };

    fetchDirectMessages();
  }, [isAuthenticated]);

  // Fetch messages when active channel or direct message changes
  useEffect(() => {
    if (activeChannel) {
      setActiveChat({
        type: "channel",
        id: activeChannel.id,
        name: activeChannel.name,
        workspaceId: activeChannel.workspaceId
      });
      setActiveDirectMessage(null);
      fetchChannelMessages(activeChannel.id);
    } else if (activeDirectMessage) {
      setActiveChat({
        type: "direct",
        id: activeDirectMessage.id,
        name: activeDirectMessage.otherUser.displayName
      });
      setActiveChannel(null);
      fetchDirectMessages(activeDirectMessage.id);
    } else {
      setActiveChat(null);
      setMessages([]);
    }
  }, [activeChannel, activeDirectMessage]);

  const fetchChannelMessages = async (channelId: number) => {
    try {
      const response = await fetch(`/api/channels/${channelId}/messages`, {
        credentials: "include",
      });
      
      if (response.ok) {
        const data = await response.json();
        setMessages(data);
      }
    } catch (error) {
      console.error("Failed to fetch channel messages:", error);
    }
  };

  const fetchDirectMessages = async (dmId: number) => {
    try {
      const response = await fetch(`/api/direct-messages/${dmId}/messages`, {
        credentials: "include",
      });
      
      if (response.ok) {
        const data = await response.json();
        setMessages(data);
      }
    } catch (error) {
      console.error("Failed to fetch direct messages:", error);
    }
  };

  const setActiveChannelById = useCallback((channelId: number | null) => {
    if (!channelId) {
      setActiveChannel(null);
      return;
    }
    
    const channel = channels.find(c => c.id === channelId);
    if (channel) {
      setActiveChannel(channel);
    }
  }, [channels]);

  const setActiveDirectMessageById = useCallback((dmId: number | null) => {
    if (!dmId) {
      setActiveDirectMessage(null);
      return;
    }
    
    const dm = directMessages.find(d => d.id === dmId);
    if (dm) {
      setActiveDirectMessage(dm);
    }
  }, [directMessages]);

  const sendMessage = useCallback((content: string) => {
    if (!socket || !content.trim() || !activeChat) return;

    const message = {
      type: "message",
      content,
      ...(activeChat.type === "channel" 
        ? { channelId: activeChat.id } 
        : { directMessageId: activeChat.id })
    };

    socket.send(JSON.stringify(message));
  }, [socket, activeChat]);

  const setTyping = useCallback((isTyping: boolean) => {
    if (!socket || !activeChat || !user) return;

    const typingData = {
      type: "typing",
      isTyping,
      ...(activeChat.type === "channel" 
        ? { channelId: activeChat.id } 
        : { directMessageId: activeChat.id }),
      userId: user.id
    };

    socket.send(JSON.stringify(typingData));
  }, [socket, activeChat, user]);

  const createChannel = async (name: string, description: string, isPrivate: boolean) => {
    if (!activeWorkspace) return;

    try {
      const response = await fetch("/api/channels", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          name,
          description,
          isPrivate,
          workspaceId: activeWorkspace.id,
        }),
      });

      if (response.ok) {
        const newChannel = await response.json();
        setChannels(prev => [...prev, newChannel]);
        setActiveChannel(newChannel);
        toast({
          title: "Channel created",
          description: `#${name} has been created successfully`,
        });
      } else {
        throw new Error("Failed to create channel");
      }
    } catch (error) {
      console.error("Error creating channel:", error);
      toast({
        title: "Error",
        description: "Failed to create channel",
        variant: "destructive",
      });
    }
  };

  const createDirectMessage = async (userId: number) => {
    if (!user) return;

    try {
      const response = await fetch("/api/direct-messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          userId,
        }),
      });

      if (response.ok) {
        const newDm = await response.json();
        
        // Refresh direct messages to get the updated list with user info
        const dmResponse = await fetch("/api/direct-messages", {
          credentials: "include",
        });
        
        if (dmResponse.ok) {
          const dms = await dmResponse.json();
          setDirectMessages(dms);
          
          // Find and set the new DM as active
          const createdDm = dms.find((dm: DirectMessage) => dm.id === newDm.id);
          if (createdDm) {
            setActiveDirectMessage(createdDm);
          }
        }
      } else {
        throw new Error("Failed to create direct message");
      }
    } catch (error) {
      console.error("Error creating direct message:", error);
      toast({
        title: "Error",
        description: "Failed to create conversation",
        variant: "destructive",
      });
    }
  };

  const createWorkspace = async (name: string, iconText: string) => {
    try {
      const response = await fetch("/api/workspaces", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          name,
          iconText,
        }),
      });

      if (response.ok) {
        const newWorkspace = await response.json();
        setWorkspaces(prev => [...prev, newWorkspace]);
        setActiveWorkspace(newWorkspace);
        toast({
          title: "Workspace created",
          description: `${name} has been created successfully`,
        });
      } else {
        throw new Error("Failed to create workspace");
      }
    } catch (error) {
      console.error("Error creating workspace:", error);
      toast({
        title: "Error",
        description: "Failed to create workspace",
        variant: "destructive",
      });
    }
  };

  return (
    <ChatContext.Provider
      value={{
        workspaces,
        activeWorkspace,
        setActiveWorkspace,
        
        channels,
        activeChannel,
        setActiveChannelById,
        
        directMessages,
        activeDirectMessage,
        setActiveDirectMessageById,
        
        messages,
        sendMessage,
        
        activeChat,
        createChannel,
        createDirectMessage,
        
        usersTyping,
        setTyping,
        
        isLoading,
        createWorkspace,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
}
