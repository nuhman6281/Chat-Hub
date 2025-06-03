import React, { createContext, useContext, useState, useEffect, useRef, useCallback, ReactNode } from 'react';
import { useAuth } from '@/contexts/AuthWrapper';
import { useChat } from '@/contexts/ChatContext';
import { useSocket } from '@/lib/socket';
import { useToast } from '@/hooks/use-toast';

// WebRTC functionality temporarily disabled
// Will be re-implemented with native WebRTC APIs

export type CallType = 'audio' | 'video';

export interface CallParticipant {
  userId: number;
  username: string;
  displayName: string;
  stream?: MediaStream;
  audioEnabled: boolean;
  videoEnabled: boolean;
}

interface CallContextType {
  // Call state
  incomingCall: boolean;
  outgoingCall: boolean;
  activeCall: boolean;
  callType: CallType;
  callerId?: number;
  callerName?: string;
  participants: CallParticipant[];
  
  // Local media state
  localStream?: MediaStream;
  localAudioEnabled: boolean;
  localVideoEnabled: boolean;
  
  // Actions
  startCall: (userId: number, callType: CallType) => Promise<void>;
  answerCall: () => Promise<void>;
  rejectCall: () => void;
  endCall: () => void;
  toggleAudio: () => void;
  toggleVideo: () => void;
}

export const CallContext = createContext<CallContextType | null>(null);

export function CallProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { activeDM } = useChat();
  const { isConnected, on, send } = useSocket();
  const { toast } = useToast();
  
  // Call state
  const [incomingCall, setIncomingCall] = useState(false);
  const [outgoingCall, setOutgoingCall] = useState(false);
  const [activeCall, setActiveCall] = useState(false);
  const [callType, setCallType] = useState<CallType>('audio');
  const [callerId, setCallerId] = useState<number>();
  const [callerName, setCallerName] = useState<string>();
  const [participants, setParticipants] = useState<CallParticipant[]>([]);
  
  // Media state
  const [localStream, setLocalStream] = useState<MediaStream>();
  const [localAudioEnabled, setLocalAudioEnabled] = useState(true);
  const [localVideoEnabled, setLocalVideoEnabled] = useState(true);
  
  // References
  const peersRef = useRef<{ [userId: number]: any }>({});
  
  // Handle incoming call
  useEffect(() => {
    if (!isConnected || !user) return;
    
    const handleIncomingCall = (data: any) => {
      if (activeCall || incomingCall) {
        // Already in a call, send busy signal
        send('call_response', {
          to: data.from,
          accepted: false,
          reason: 'busy'
        });
        return;
      }
      
      setCallerId(data.from);
      setCallerName(data.fromName);
      setCallType(data.callType);
      setIncomingCall(true);
      
      // Play ringtone
      const audio = new Audio('/sounds/ringtone.mp3');
      audio.loop = true;
      audio.play().catch(err => console.error('Error playing ringtone:', err));
      
      // Auto-reject call after 30 seconds
      const timeout = setTimeout(() => {
        if (incomingCall) {
          send('call_response', {
            to: data.from,
            accepted: false,
            reason: 'timeout'
          });
          setIncomingCall(false);
          audio.pause();
        }
      }, 30000);
      
      return () => {
        clearTimeout(timeout);
        audio.pause();
      };
    };
    
    const unsubscribe = on('call_request', handleIncomingCall);
    
    return () => {
      unsubscribe();
    };
  }, [isConnected, user, activeCall, incomingCall, send, on]);
  
  // Handle call accepted
  useEffect(() => {
    if (!isConnected || !user) return;
    
    const handleCallAccepted = (data: any) => {
      if (!outgoingCall) return;
      
      setOutgoingCall(false);
      setActiveCall(true);
      
      // Initialize peer connections with the callee
      initializeCallWithUser(data.from, data.fromName, callType);
    };
    
    const unsubscribe = on('call_accepted', handleCallAccepted);
    
    return () => {
      unsubscribe();
    };
  }, [isConnected, user, outgoingCall, callType, on]);
  
  // Handle call rejected
  useEffect(() => {
    if (!isConnected || !user) return;
    
    const handleCallRejected = (data: any) => {
      if (!outgoingCall) return;
      
      setOutgoingCall(false);
      
      const reason = data.reason || 'declined';
      let message = 'Call was declined';
      
      if (reason === 'busy') {
        message = 'User is busy in another call';
      } else if (reason === 'timeout') {
        message = 'Call was not answered';
      } else if (reason === 'unavailable') {
        message = 'User is unavailable';
      }
      
      toast({
        title: 'Call Ended',
        description: message,
      });
    };
    
    const unsubscribe = on('call_rejected', handleCallRejected);
    
    return () => {
      unsubscribe();
    };
  }, [isConnected, user, outgoingCall, toast, on]);
  
  // Handle call ended
  useEffect(() => {
    if (!isConnected || !user) return;
    
    const handleCallEnded = () => {
      if (!activeCall) return;
      
      // Clean up call state
      cleanupCall();
      
      toast({
        title: 'Call Ended',
        description: 'The call has been ended by the other participant.',
      });
    };
    
    const unsubscribe = on('call_ended', handleCallEnded);
    
    return () => {
      unsubscribe();
    };
  }, [isConnected, user, activeCall, toast, on]);
  
  // Initialize media stream
  const initializeMediaStream = async (callType: CallType): Promise<MediaStream | null> => {
    try {
      const constraints = {
        audio: true,
        video: callType === 'video'
      };
      
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      setLocalStream(stream);
      setLocalAudioEnabled(true);
      setLocalVideoEnabled(callType === 'video');
      
      return stream;
    } catch (error) {
      console.error('Error accessing media devices:', error);
      toast({
        title: 'Media Error',
        description: 'Could not access camera or microphone. Please check permissions.',
        variant: 'destructive'
      });
      return null;
    }
  };
  
  // Initialize call with a specific user
  const initializeCallWithUser = async (userId: number, username: string, callType: CallType) => {
    if (!user || !isConnected) return;
    
    const stream = localStream || await initializeMediaStream(callType);
    if (!stream) return;
    
    try {
      // Add local user to participants
      const localParticipant: CallParticipant = {
        userId: user.id,
        username: user.username,
        displayName: user.displayName,
        stream,
        audioEnabled: localAudioEnabled,
        videoEnabled: localVideoEnabled && callType === 'video'
      };
      
      // Add remote user to participants (without stream yet)
      const remoteParticipant: CallParticipant = {
        userId,
        username,
        displayName: username, // We'll use username as displayName initially
        audioEnabled: true,
        videoEnabled: callType === 'video'
      };
      
      setParticipants([localParticipant, remoteParticipant]);
      
      // Create peer connection for the remote user
      const peer = new Peer({
        initiator: true,
        trickle: false,
        stream
      });
      
      peer.on('signal', (data: any) => {
        send('call_signal', {
          to: userId,
          signal: data
        });
      });
      
      peer.on('stream', (remoteStream: MediaStream) => {
        setParticipants(prev => 
          prev.map(p => 
            p.userId === userId 
              ? { ...p, stream: remoteStream } 
              : p
          )
        );
      });
      
      peer.on('error', (err: Error) => {
        console.error('Peer connection error:', err);
        toast({
          title: 'Connection Error',
          description: 'There was an error with the call connection.',
          variant: 'destructive'
        });
        cleanupCall();
      });
      
      peersRef.current[userId] = peer;
    } catch (error) {
      console.error('Error initializing call:', error);
      toast({
        title: 'Call Error',
        description: 'Failed to initialize call. Please try again.',
        variant: 'destructive'
      });
      cleanupCall();
    }
  };
  
  // Clean up call resources
  const cleanupCall = () => {
    // Stop all peer connections
    Object.values(peersRef.current).forEach(peer => {
      if (peer) {
        peer.destroy();
      }
    });
    
    // Clear peers reference
    peersRef.current = {};
    
    // Stop local media streams
    if (localStream) {
      localStream.getTracks().forEach(track => {
        track.stop();
      });
    }
    
    // Reset state
    setLocalStream(undefined);
    setIncomingCall(false);
    setOutgoingCall(false);
    setActiveCall(false);
    setCallerId(undefined);
    setCallerName(undefined);
    setParticipants([]);
  };
  
  // Actions
  const startCall = async (userId: number, type: CallType): Promise<void> => {
    if (!user || !isConnected) {
      toast({
        title: 'Connection Error',
        description: 'You must be connected to make calls.',
        variant: 'destructive'
      });
      return;
    }
    
    if (activeCall || outgoingCall || incomingCall) {
      toast({
        title: 'Call Error',
        description: 'You are already in a call.',
        variant: 'destructive'
      });
      return;
    }
    
    setCallType(type);
    setOutgoingCall(true);
    
    // Initialize media stream
    const stream = await initializeMediaStream(type);
    if (!stream) {
      setOutgoingCall(false);
      return;
    }
    
    // Send call request
    send('call_request', {
      to: userId,
      from: user.id,
      fromName: user.displayName,
      callType: type
    });
    
    // Play ringback tone
    const audio = new Audio('/sounds/ringback.mp3');
    audio.loop = true;
    audio.play().catch(err => console.error('Error playing ringback tone:', err));
    
    // Auto-cancel call after 30 seconds of no answer
    setTimeout(() => {
      if (outgoingCall) {
        setOutgoingCall(false);
        cleanupCall();
        
        toast({
          title: 'Call Timed Out',
          description: 'The call was not answered.',
        });
      }
      
      audio.pause();
    }, 30000);
  };
  
  const answerCall = async (): Promise<void> => {
    if (!user || !callerId || !isConnected || !incomingCall) return;
    
    // Initialize media stream
    const stream = await initializeMediaStream(callType);
    if (!stream) return;
    
    setIncomingCall(false);
    setActiveCall(true);
    
    // Send acceptance to caller
    send('call_response', {
      to: callerId,
      accepted: true,
      from: user.id,
      fromName: user.displayName
    });
    
    // Add participants to the call
    const localParticipant: CallParticipant = {
      userId: user.id,
      username: user.username,
      displayName: user.displayName,
      stream,
      audioEnabled: localAudioEnabled,
      videoEnabled: localVideoEnabled && callType === 'video'
    };
    
    const remoteParticipant: CallParticipant = {
      userId: callerId,
      username: callerName || 'User',
      displayName: callerName || 'User',
      audioEnabled: true,
      videoEnabled: callType === 'video'
    };
    
    setParticipants([localParticipant, remoteParticipant]);
    
    // Create peer connection
    const peer = new Peer({
      initiator: false,
      trickle: false,
      stream
    });
    
    peer.on('signal', (data: any) => {
      send('call_signal', {
        to: callerId,
        signal: data
      });
    });
    
    peer.on('stream', (remoteStream: MediaStream) => {
      setParticipants(prev => 
        prev.map(p => 
          p.userId === callerId 
            ? { ...p, stream: remoteStream } 
            : p
        )
      );
    });
    
    peer.on('error', (err: Error) => {
      console.error('Peer connection error:', err);
      toast({
        title: 'Connection Error',
        description: 'There was an error with the call connection.',
        variant: 'destructive'
      });
      cleanupCall();
    });
    
    peersRef.current[callerId] = peer;
    
    // Handle incoming signals
    const handleSignal = (data: any) => {
      if (data.from === callerId && peersRef.current[callerId]) {
        peersRef.current[callerId].signal(data.signal);
      }
    };
    
    on('call_signal', handleSignal);
  };
  
  const rejectCall = () => {
    if (!callerId || !isConnected) return;
    
    send('call_response', {
      to: callerId,
      accepted: false,
      reason: 'declined'
    });
    
    setIncomingCall(false);
    setCallerId(undefined);
    setCallerName(undefined);
  };
  
  const endCall = () => {
    if (!isConnected || (!activeCall && !outgoingCall)) return;
    
    // Notify all participants that call is ended
    Object.keys(peersRef.current).forEach(userId => {
      send('call_ended', {
        to: parseInt(userId)
      });
    });
    
    cleanupCall();
  };
  
  const toggleAudio = () => {
    if (!localStream) return;
    
    const audioTracks = localStream.getAudioTracks();
    const newState = !localAudioEnabled;
    
    audioTracks.forEach(track => {
      track.enabled = newState;
    });
    
    setLocalAudioEnabled(newState);
    
    // Update local participant in the list
    setParticipants(prev => 
      prev.map(p => 
        p.userId === user?.id 
          ? { ...p, audioEnabled: newState } 
          : p
      )
    );
    
    // Notify other participants of mute state change
    if (user) {
      Object.keys(peersRef.current).forEach(userId => {
        send('call_mute_update', {
          to: parseInt(userId),
          userId: user.id,
          audioEnabled: newState,
          videoEnabled: localVideoEnabled
        });
      });
    }
  };
  
  const toggleVideo = () => {
    if (!localStream || callType === 'audio') return;
    
    const videoTracks = localStream.getVideoTracks();
    const newState = !localVideoEnabled;
    
    videoTracks.forEach(track => {
      track.enabled = newState;
    });
    
    setLocalVideoEnabled(newState);
    
    // Update local participant in the list
    setParticipants(prev => 
      prev.map(p => 
        p.userId === user?.id 
          ? { ...p, videoEnabled: newState } 
          : p
      )
    );
    
    // Notify other participants of video state change
    if (user) {
      Object.keys(peersRef.current).forEach(userId => {
        send('call_mute_update', {
          to: parseInt(userId),
          userId: user.id,
          audioEnabled: localAudioEnabled,
          videoEnabled: newState
        });
      });
    }
  };
  
  // Clean up resources when component unmounts
  useEffect(() => {
    return () => {
      cleanupCall();
    };
  }, []);
  
  return (
    <CallContext.Provider
      value={{
        incomingCall,
        outgoingCall,
        activeCall,
        callType,
        callerId,
        callerName,
        participants,
        localStream,
        localAudioEnabled,
        localVideoEnabled,
        startCall,
        answerCall,
        rejectCall,
        endCall,
        toggleAudio,
        toggleVideo
      }}
    >
      {children}
    </CallContext.Provider>
  );
}

export function useCall() {
  const context = useContext(CallContext);
  if (!context) {
    throw new Error('useCall must be used within a CallProvider');
  }
  return context;
}