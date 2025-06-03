import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useSocket } from '@/lib/socket';
import { useAuth } from '@/contexts/AuthWrapper';
import { useToast } from '@/hooks/use-toast';

// Define types for our chat messages and state
export interface Message {
  id: number;
  content: string;
  createdAt: string;
  userId: number;
  channelId?: number;
  directMessageId?: number;
  user: {
    id: number;
    username: string;
    displayName: string;
    avatarUrl?: string | null;
  };
}

export interface Channel {
  id: number;
  name: string;
  workspaceId: number;
  description?: string;
  isPrivate: boolean;
  memberCount: number;
}

export interface DirectMessage {
  id: number;
  user1Id: number;
  user2Id: number;
  createdAt: string;
  otherUser: {
    id: number;
    username: string;
    displayName: string;
    status: string;
    avatarUrl?: string | null;
  };
  lastMessage?: Message;
}

export interface Workspace {
  id: number;
  name: string;
  ownerId: number;
  description?: string;
  iconUrl?: string;
}

interface ChatContextType {
  // State
  activeWorkspace: Workspace | null;
  workspaces: Workspace[];
  activeChannel: Channel | null;
  channels: Channel[];
  activeDM: DirectMessage | null;
  directMessages: DirectMessage[];
  messages: Message[];
  isLoadingMessages: boolean;
  isConnected: boolean;

  // Actions
  setActiveWorkspace: (workspace: Workspace | null) => void;
  setActiveChannel: (channel: Channel | null) => void;
  setActiveDM: (dm: DirectMessage | null) => void;
  sendMessage: (content: string, channelId?: number, directMessageId?: number, messageType?: string, mediaFile?: File) => Promise<boolean>;
  loadMoreMessages: () => Promise<boolean>;
  refreshChannels: () => Promise<void>;
  createChannel: (name: string, isPrivate?: boolean, description?: string) => Promise<Channel | null>;
  createWorkspace: (name: string, description?: string) => Promise<Workspace | null>;
  startDirectMessage: (userId: number) => Promise<DirectMessage | null>;
  startCall: (type: 'audio' | 'video') => Promise<void>;
}

export const ChatContext = createContext<ChatContextType | null>(null);

export function ChatProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { isConnected, on, send } = useSocket();
  const { toast } = useToast();
  
  // State
  const [activeWorkspace, setActiveWorkspace] = useState<Workspace | null>(null);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [activeChannel, setActiveChannel] = useState<Channel | null>(null);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [activeDM, setActiveDM] = useState<DirectMessage | null>(null);
  const [directMessages, setDirectMessages] = useState<DirectMessage[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  
  // Fetch workspaces when user changes
  useEffect(() => {
    if (user) {
      fetchWorkspaces();
    } else {
      setWorkspaces([]);
      setActiveWorkspace(null);
    }
  }, [user]);
  
  // Fetch channels when active workspace changes
  useEffect(() => {
    if (activeWorkspace) {
      fetchChannels(activeWorkspace.id);
    } else {
      setChannels([]);
      setActiveChannel(null);
    }
  }, [activeWorkspace]);
  
  // Fetch direct messages when user changes
  useEffect(() => {
    if (user) {
      fetchDirectMessages();
    } else {
      setDirectMessages([]);
      setActiveDM(null);
    }
  }, [user]);
  
  // Fetch messages when active channel or DM changes
  useEffect(() => {
    if (activeChannel) {
      fetchMessages('channel', activeChannel.id);
      setActiveDM(null);
    } else if (activeDM) {
      fetchMessages('dm', activeDM.id);
      setActiveChannel(null);
    } else {
      setMessages([]);
    }
  }, [activeChannel, activeDM]);
  
  // Authenticate WebSocket connection when user and connection are available
  useEffect(() => {
    if (user && isConnected) {
      authenticateWebSocket();
    }
  }, [user, isConnected]);
  
  // Listen for new messages via WebSocket
  useEffect(() => {
    if (!isConnected) return;
    
    const handleNewMessage = (payload: any) => {
      console.log('Received new message:', payload);
      const message = payload.message || payload;
      
      // Only add message if it belongs to the active conversation
      if (
        (activeChannel && message.channelId === activeChannel.id) ||
        (activeDM && message.directMessageId === activeDM.id)
      ) {
        setMessages(prev => [...prev, message]);
        console.log('Added message to active conversation');
      }
      
      // Update last message in direct messages list
      if (message.directMessageId) {
        setDirectMessages(prev => 
          prev.map(dm => 
            dm.id === message.directMessageId 
              ? { ...dm, lastMessage: message } 
              : dm
          )
        );
      }
    };
    
    const unsubscribe = on('new_message', handleNewMessage);
    
    return () => {
      unsubscribe();
    };
  }, [isConnected, activeChannel, activeDM, on]);
  
  // API calls
  const fetchWorkspaces = async () => {
    try {
      const response = await fetch('/api/workspaces');
      if (response.ok) {
        const data = await response.json();
        setWorkspaces(data);
        
        // Select first workspace if none is active
        if (data.length > 0 && !activeWorkspace) {
          setActiveWorkspace(data[0]);
        }
      }
    } catch (error) {
      console.error('Failed to fetch workspaces:', error);
    }
  };
  
  const fetchChannels = async (workspaceId: number) => {
    try {
      const response = await fetch(`/api/workspaces/${workspaceId}/channels`);
      if (response.ok) {
        const data = await response.json();
        setChannels(data);
        
        // Select first channel if none is active
        if (data.length > 0 && !activeChannel) {
          setActiveChannel(data[0]);
        }
      }
    } catch (error) {
      console.error('Failed to fetch channels:', error);
    }
  };
  
  const fetchDirectMessages = async () => {
    try {
      const response = await fetch('/api/direct-messages');
      if (response.ok) {
        const data = await response.json();
        setDirectMessages(data);
      }
    } catch (error) {
      console.error('Failed to fetch direct messages:', error);
    }
  };
  
  const fetchMessages = async (type: 'channel' | 'dm', id: number) => {
    setIsLoadingMessages(true);
    try {
      const endpoint = type === 'channel' 
        ? `/api/channels/${id}/messages` 
        : `/api/direct-messages/${id}/messages`;
      
      const response = await fetch(endpoint);
      if (response.ok) {
        const data = await response.json();
        setMessages(data);
      }
    } catch (error) {
      console.error('Failed to fetch messages:', error);
    } finally {
      setIsLoadingMessages(false);
    }
  };
  
  const authenticateWebSocket = () => {
    if (user) {
      send('auth', { userId: user.id });
    }
  };
  
  // Actions
  const sendMessage = async (
    content: string, 
    channelId?: number, 
    directMessageId?: number, 
    messageType: string = 'text', 
    mediaFile?: File
  ): Promise<boolean> => {
    if (!user) return false;
    
    try {
      let mediaUrl = null;
      let mediaSize = null;
      let mediaType = null;

      // Handle file upload if present
      if (mediaFile) {
        const formData = new FormData();
        formData.append('file', mediaFile);
        
        const uploadResponse = await fetch('/api/upload', {
          method: 'POST',
          body: formData
        });
        
        if (uploadResponse.ok) {
          const uploadData = await uploadResponse.json();
          mediaUrl = uploadData.url;
          mediaSize = mediaFile.size;
          mediaType = mediaFile.type;
        }
      }

      // Use provided IDs or fallback to active conversation
      const targetChannelId = channelId || (activeChannel ? activeChannel.id : undefined);
      const targetDMId = directMessageId || (activeDM ? activeDM.id : undefined);

      if (targetChannelId) {
        // Channel message
        const result = send('message', {
          content,
          channelId: targetChannelId,
          messageType,
          mediaUrl,
          mediaType,
          mediaSize
        });
        
        if (!result) {
          toast({
            title: 'Failed to send message',
            description: 'Connection is not available. Please try again.',
            variant: 'destructive'
          });
        }
        
        return result;
      } else if (targetDMId) {
        // Direct message
        const result = send('message', {
          content,
          directMessageId: targetDMId,
          messageType,
          mediaUrl,
          mediaType,
          mediaSize
        });
        
        if (!result) {
          toast({
            title: 'Failed to send message',
            description: 'Connection is not available. Please try again.',
            variant: 'destructive'
          });
        }
        
        return result;
      }
    } catch (error) {
      console.error('Error sending message:', error);
      toast({
        title: 'Failed to send message',
        description: 'An error occurred while sending your message.',
        variant: 'destructive'
      });
    }
    
    return false;
  };
  
  const loadMoreMessages = async (): Promise<boolean> => {
    // This would implement pagination for messages
    // For now, return false
    return false;
  };
  
  const refreshChannels = async (): Promise<void> => {
    if (activeWorkspace) {
      await fetchChannels(activeWorkspace.id);
    }
  };
  
  const createChannel = async (
    name: string, 
    isPrivate: boolean = false, 
    description?: string
  ): Promise<Channel | null> => {
    if (!activeWorkspace || !user) return null;
    
    try {
      const response = await fetch('/api/channels', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name,
          workspaceId: activeWorkspace.id,
          isPrivate,
          description
        })
      });
      
      if (response.ok) {
        const newChannel = await response.json();
        // Refresh channels list
        await refreshChannels();
        toast({
          title: 'Channel created',
          description: `Channel #${name} has been created.`
        });
        return newChannel;
      } else {
        const error = await response.json();
        toast({
          title: 'Failed to create channel',
          description: error.message || 'An error occurred.',
          variant: 'destructive'
        });
      }
    } catch (error) {
      console.error('Error creating channel:', error);
      toast({
        title: 'Failed to create channel',
        description: 'An error occurred while creating the channel.',
        variant: 'destructive'
      });
    }
    
    return null;
  };
  
  const createWorkspace = async (
    name: string, 
    description?: string
  ): Promise<Workspace | null> => {
    if (!user) return null;
    
    try {
      const response = await fetch('/api/workspaces', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name,
          description
        })
      });
      
      if (response.ok) {
        const newWorkspace = await response.json();
        // Refresh workspaces list
        await fetchWorkspaces();
        toast({
          title: 'Workspace created',
          description: `Workspace "${name}" has been created.`
        });
        return newWorkspace;
      } else {
        const error = await response.json();
        toast({
          title: 'Failed to create workspace',
          description: error.message || 'An error occurred.',
          variant: 'destructive'
        });
      }
    } catch (error) {
      console.error('Error creating workspace:', error);
      toast({
        title: 'Failed to create workspace',
        description: 'An error occurred while creating the workspace.',
        variant: 'destructive'
      });
    }
    
    return null;
  };
  
  const startDirectMessage = async (userId: number): Promise<DirectMessage | null> => {
    if (!user) return null;
    
    try {
      const response = await fetch('/api/direct-messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId
        })
      });
      
      if (response.ok) {
        const newDM = await response.json();
        // Refresh DM list
        await fetchDirectMessages();
        return newDM;
      } else {
        const error = await response.json();
        toast({
          title: 'Failed to start conversation',
          description: error.message || 'An error occurred.',
          variant: 'destructive'
        });
      }
    } catch (error) {
      console.error('Error starting direct message:', error);
      toast({
        title: 'Failed to start conversation',
        description: 'An error occurred while creating the conversation.',
        variant: 'destructive'
      });
    }
    
    return null;
  };

  const startCall = async (type: 'audio' | 'video') => {
    if (!user) return;
    
    try {
      const response = await fetch('/api/calls/initiate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          type,
          channelId: activeChannel?.id,
          directMessageId: activeDM?.id
        })
      });
      
      if (response.ok) {
        const callData = await response.json();
        toast({
          title: `${type === 'audio' ? 'Audio' : 'Video'} call initiated`,
          description: 'Connecting...'
        });
        
        // Notify via WebSocket
        send('call_initiated', {
          callId: callData.id,
          type,
          channelId: activeChannel?.id,
          directMessageId: activeDM?.id
        });
      } else {
        toast({
          title: 'Failed to start call',
          description: 'Unable to initiate the call. Please try again.',
          variant: 'destructive'
        });
      }
    } catch (error) {
      console.error('Error starting call:', error);
      toast({
        title: 'Call failed',
        description: 'An error occurred while starting the call.',
        variant: 'destructive'
      });
    }
  };
  
  return (
    <ChatContext.Provider
      value={{
        activeWorkspace,
        workspaces,
        activeChannel,
        channels,
        activeDM,
        directMessages,
        messages,
        isLoadingMessages,
        isConnected,
        setActiveWorkspace,
        setActiveChannel,
        setActiveDM,
        sendMessage,
        loadMoreMessages,
        refreshChannels,
        createChannel,
        createWorkspace,
        startDirectMessage,
        startCall
      }}
    >
      {children}
    </ChatContext.Provider>
  );
}

export function useChat() {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  return context;
}