import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useSocket } from '@/lib/socket';
import { useAuth } from '@/contexts/AuthWrapper';
import { useToast } from '@/hooks/use-toast';
import { encryptionService } from '@/lib/encryption';

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

export interface WorkspaceMember {
  id: number;
  userId: number;
  workspaceId: number;
  role: string;
  user: {
    id: number;
    username: string;
    displayName: string;
    status: string;
    avatarUrl?: string | null;
  };
}

export interface Workspace {
  id: number;
  name: string;
  ownerId: number;
  description?: string;
  iconUrl?: string;
}

export interface CallData {
  callId: string;
  callType: 'voice' | 'video';
  isIncoming: boolean;
  user: {
    id: number;
    username: string;
    displayName: string;
    avatarUrl?: string;
  };
}

interface ChatContextType {
  // State
  activeWorkspace: Workspace | null;
  workspaces: Workspace[];
  activeChannel: Channel | null;
  channels: Channel[];
  activeDM: DirectMessage | null;
  directMessages: DirectMessage[];
  workspaceMembers: WorkspaceMember[];
  messages: Message[];
  isLoadingMessages: boolean;
  isConnected: boolean;
  
  // Call state
  currentCall: CallData | null;
  isCallModalOpen: boolean;

  // Actions
  setActiveWorkspace: (workspace: Workspace | null) => void;
  setActiveChannel: (channel: Channel | null) => void;
  setActiveDM: (dm: DirectMessage | null) => void;
  sendMessage: (content: string, channelId?: number, directMessageId?: number, messageType?: string, mediaFile?: File) => Promise<boolean>;
  loadMoreMessages: () => Promise<boolean>;
  refreshChannels: () => Promise<void>;
  refreshWorkspaceMembers: () => Promise<void>;
  createChannel: (name: string, isPrivate?: boolean, description?: string) => Promise<Channel | null>;
  createWorkspace: (name: string, description?: string) => Promise<Workspace | null>;
  startDirectMessage: (userId: number) => Promise<DirectMessage | null>;
  
  // Call actions
  initiateCall: (targetUserId: number, callType: 'audio' | 'video') => Promise<void>;
  answerCall: (accepted: boolean) => Promise<void>;
  hangupCall: () => Promise<void>;
  setIsCallModalOpen: (open: boolean) => void;
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
  const [workspaceMembers, setWorkspaceMembers] = useState<WorkspaceMember[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  
  // Call state
  const [currentCall, setCurrentCall] = useState<CallData | null>(null);
  const [isCallModalOpen, setIsCallModalOpen] = useState(false);
  
  // Initialize encryption and fetch workspaces when user changes
  useEffect(() => {
    if (user) {
      // Initialize encryption keys for the user
      const userKeys = encryptionService.getOrCreateKeyPair();
      
      // Register the public key with the server
      fetch('/api/users/public-key', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          publicKey: userKeys.publicKeyString
        })
      }).catch(error => {
        console.error('Failed to register public key:', error);
      });
      
      fetchWorkspaces();
    } else {
      setWorkspaces([]);
      setActiveWorkspace(null);
    }
  }, [user]);
  
  // Fetch channels and workspace members when active workspace changes
  useEffect(() => {
    if (activeWorkspace) {
      fetchChannels(activeWorkspace.id);
      fetchWorkspaceMembers(activeWorkspace.id);
    } else {
      setChannels([]);
      setActiveChannel(null);
      setWorkspaceMembers([]);
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
    if (activeChannel && !activeDM) {
      fetchMessages('channel', activeChannel.id);
    } else if (activeDM && !activeChannel) {
      fetchMessages('dm', activeDM.id);
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
  
  // Listen for WebSocket events
  useEffect(() => {
    if (!isConnected) return;
    
    const handleNewMessage = (payload: any) => {
      console.log('Received new message:', payload);
      let message = payload;
      
      // Decrypt message if it's encrypted and addressed to current user
      if (message.isEncrypted && message.directMessageId && user) {
        try {
          const encryptedMessage = {
            encryptedContent: message.encryptedContent,
            nonce: message.nonce,
            senderPublicKey: message.senderPublicKey
          };
          const decryptedContent = encryptionService.decryptMessage(encryptedMessage);
          message = { ...message, content: decryptedContent };
        } catch (error) {
          console.error('Failed to decrypt message:', error);
          message = { ...message, content: '[Encrypted message - failed to decrypt]' };
        }
      }
      
      // Play notification sound for new messages (if not from current user)
      if (message.userId !== user?.id) {
        try {
          const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBj2a2/LDciUFLYDO8tiJOQgZaLvt559NEAxQp+PwtmMcBj2a2/LDciUFLYDO8tiJOQgZaLvt559NEAxQp+PwtmMcBj2a2/LDciUFLYDO8tiJOQgZaLvt559NEAxQp+PwtmMcBj2a2/LDciUFLYDO8tiJOQgZaLvt559NEAxQp+PwtmMcBj2a2/LDciUFLYDO8tiJOQgZaLvt559NEAxQp+PwtmMcBj2a2/LDciUFLYDO8tiJOQgZaLvt559NEAxQp+PwtmMcBj2a2/LDciUFLYDO8tiJOQgZaLvt559NEAxQp+PwtmMcBj2a2/LDciUFLYDO8tiJOQgZaLvt559NEAxQp+PwtmMcBj2a2/LDciUFLYDO8tiJOQgZaLvt559NEAxQp+PwtmMcBj2a2/LDciUFLYDO8tiJOQgZaLvt559NEAxQp+PwtmMcBj2a2/LDciUFLYDO8tiJOQgZaLvt');
          audio.volume = 0.3;
          audio.play().catch(e => console.log('Could not play notification sound:', e));
        } catch (error) {
          console.log('Notification sound not available');
        }
      }

      // Add message to the list if it belongs to the active conversation
      if (
        (activeChannel && message.channelId === activeChannel.id) ||
        (activeDM && message.directMessageId === activeDM.id)
      ) {
        setMessages(prev => {
          // Avoid duplicates
          const exists = prev.some(m => m.id === message.id);
          if (exists) return prev;
          return [...prev, message];
        });
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

    // Handle incoming calls
    const handleIncomingCall = (payload: any) => {
      console.log('Received incoming call:', payload);
      setCurrentCall({
        callId: payload.callId,
        callType: payload.callType,
        isIncoming: true,
        user: payload.from
      });
      setIsCallModalOpen(true);
      
      toast({
        title: 'Incoming call',
        description: `${payload.from.displayName} is calling you`,
        duration: 5000
      });
    };

    // Handle call status updates
    const handleCallAccepted = (payload: any) => {
      toast({
        title: 'Call accepted',
        description: `${payload.by.displayName} accepted your call`
      });
    };

    const handleCallRejected = (payload: any) => {
      toast({
        title: 'Call declined',
        description: `${payload.by.displayName} declined your call`
      });
      setCurrentCall(null);
      setIsCallModalOpen(false);
    };

    const handleCallEnded = (payload: any) => {
      toast({
        title: 'Call ended',
        description: `Call ended by ${payload.endedBy.displayName}`
      });
      setCurrentCall(null);
      setIsCallModalOpen(false);
    };

    const handleCallRinging = (payload: any) => {
      toast({
        title: 'Ringing',
        description: `Calling ${payload.to.displayName}...`
      });
    };
    
    const unsubscribeMessage = on('new_message', handleNewMessage);
    const unsubscribeIncomingCall = on('incoming_call', handleIncomingCall);
    const unsubscribeCallAccepted = on('call_accepted', handleCallAccepted);
    const unsubscribeCallRejected = on('call_rejected', handleCallRejected);
    const unsubscribeCallEnded = on('call_ended', handleCallEnded);
    const unsubscribeCallRinging = on('call_ringing', handleCallRinging);
    
    return () => {
      unsubscribeMessage();
      unsubscribeIncomingCall();
      unsubscribeCallAccepted();
      unsubscribeCallRejected();
      unsubscribeCallEnded();
      unsubscribeCallRinging();
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

  const fetchWorkspaceMembers = async (workspaceId: number) => {
    try {
      const response = await fetch(`/api/workspaces/${workspaceId}/members`);
      if (response.ok) {
        const data = await response.json();
        setWorkspaceMembers(data);
      }
    } catch (error) {
      console.error('Failed to fetch workspace members:', error);
    }
  };

  const refreshWorkspaceMembers = async () => {
    if (activeWorkspace) {
      await fetchWorkspaceMembers(activeWorkspace.id);
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

      // Prepare message payload
      let messagePayload: any = {
        content,
        messageType,
        mediaUrl,
        mediaType,
        mediaSize,
        isEncrypted: false
      };

      // For direct messages, encrypt the content
      if (targetDMId) {
        try {
          // Get recipient's public key from the DM data
          const dmResponse = await fetch(`/api/direct-messages/${targetDMId}`);
          if (dmResponse.ok) {
            const dmData = await dmResponse.json();
            const otherUser = dmData.user1Id === user.id ? dmData.user2 : dmData.user1;
            
            if (otherUser?.publicKey && messageType === 'text') {
              const encryptedMessage = encryptionService.encryptMessage(content, otherUser.publicKey);
              messagePayload = {
                ...messagePayload,
                content: '', // Clear text content for encrypted messages
                isEncrypted: true,
                encryptedContent: encryptedMessage.encryptedContent,
                nonce: encryptedMessage.nonce,
                senderPublicKey: encryptedMessage.senderPublicKey
              };
            }
          }
        } catch (encryptError) {
          console.error('Encryption failed, sending unencrypted:', encryptError);
        }
      }

      if (targetChannelId) {
        // Channel message
        const result = send('message', {
          ...messagePayload,
          channelId: targetChannelId
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
          ...messagePayload,
          directMessageId: targetDMId
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

  // Call action handlers
  const initiateCall = async (targetUserId: number, callType: 'audio' | 'video') => {
    if (!user) return;
    
    try {
      const response = await fetch('/api/calls/initiate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          targetUserId,
          callType
        })
      });
      
      if (response.ok) {
        const callData = await response.json();
        
        // Set up outgoing call state
        setCurrentCall({
          callId: callData.callId,
          callType: callType === 'audio' ? 'voice' : callType,
          isIncoming: false,
          user: callData.receiver
        });
        setIsCallModalOpen(true);
        
        toast({
          title: `${callType === 'audio' ? 'Audio' : 'Video'} call initiated`,
          description: `Calling ${callData.receiver.displayName}...`
        });
      } else {
        const error = await response.json();
        toast({
          title: 'Failed to start call',
          description: error.message || 'Unable to initiate the call.',
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

  const answerCall = async (accepted: boolean) => {
    if (!currentCall) return;
    
    try {
      const response = await fetch('/api/calls/answer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          callId: currentCall.callId,
          accepted
        })
      });
      
      if (response.ok) {
        if (!accepted) {
          setCurrentCall(null);
          setIsCallModalOpen(false);
          toast({
            title: 'Call declined',
            description: 'You declined the call.'
          });
        }
      } else {
        toast({
          title: 'Failed to respond to call',
          description: 'Unable to respond to the call.',
          variant: 'destructive'
        });
      }
    } catch (error) {
      console.error('Error answering call:', error);
      toast({
        title: 'Call error',
        description: 'An error occurred while responding to the call.',
        variant: 'destructive'
      });
    }
  };

  const hangupCall = async () => {
    if (!currentCall) return;
    
    try {
      const response = await fetch('/api/calls/hangup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          callId: currentCall.callId
        })
      });
      
      if (response.ok) {
        setCurrentCall(null);
        setIsCallModalOpen(false);
        toast({
          title: 'Call ended',
          description: 'The call has been ended.'
        });
      }
    } catch (error) {
      console.error('Error hanging up call:', error);
      setCurrentCall(null);
      setIsCallModalOpen(false);
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
        workspaceMembers,
        messages,
        isLoadingMessages,
        isConnected,
        setActiveWorkspace,
        setActiveChannel,
        setActiveDM,
        sendMessage,
        loadMoreMessages,
        refreshChannels,
        refreshWorkspaceMembers,
        createChannel,
        createWorkspace,
        startDirectMessage,
        // Call functionality
        currentCall,
        isCallModalOpen,
        initiateCall,
        answerCall,
        hangupCall,
        setIsCallModalOpen
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