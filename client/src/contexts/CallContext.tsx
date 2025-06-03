import React, { createContext, useContext, useState, ReactNode, useRef, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthWrapper';
import { useToast } from '@/hooks/use-toast';
import { useSocket } from '@/lib/socket';

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
  isInCall: boolean;
  isInitiating: boolean;
  callType: CallType | null;
  participants: CallParticipant[];
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  
  // Actions
  initiateCall: (targetUserId: number, type: CallType) => Promise<void>;
  answerCall: () => Promise<void>;
  rejectCall: () => void;
  endCall: () => void;
  toggleMute: () => void;
  toggleVideo: () => void;
  
  // UI state
  isMuted: boolean;
  isVideoEnabled: boolean;
  showIncomingCall: boolean;
  incomingCall: boolean;
  outgoingCall: boolean;
  activeCall: boolean;
  callerName: string | null;
  localAudioEnabled: boolean;
  localVideoEnabled: boolean;
}

const CallContext = createContext<CallContextType | undefined>(undefined);

export function useCall() {
  const context = useContext(CallContext);
  if (!context) {
    throw new Error('useCall must be used within a CallProvider');
  }
  return context;
}

export function CallProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const { isConnected, on, send } = useSocket();
  
  // Call state
  const [isInCall, setIsInCall] = useState(false);
  const [isInitiating, setIsInitiating] = useState(false);
  const [callType, setCallType] = useState<CallType | null>(null);
  const [participants, setParticipants] = useState<CallParticipant[]>([]);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [showIncomingCall, setShowIncomingCall] = useState(false);
  const [incomingCall, setIncomingCall] = useState(false);
  const [outgoingCall, setOutgoingCall] = useState(false);
  const [activeCall, setActiveCall] = useState(false);
  const [callerName, setCallerName] = useState<string | null>(null);
  const [localAudioEnabled, setLocalAudioEnabled] = useState(true);
  const [localVideoEnabled, setLocalVideoEnabled] = useState(true);
  const [currentCallId, setCurrentCallId] = useState<string | null>(null);
  
  // Ringing sound management
  const ringtoneRef = useRef<HTMLAudioElement | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);

  // Initialize ringtone
  useEffect(() => {
    ringtoneRef.current = new Audio('data:audio/wav;base64,UklGRpQEAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YXAEAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBj2a2/LDciUFLYDO8tiJOQgZaLvt559NEAxQp+PwtmMcBj2a2/LDciUFLYDO8tiJOQgZaLvt559NEAxQp+PwtmMcBj2a2/LDciUFLYDO8tiJOQgZaLvt559NEAxQp+PwtmMcBj2a2/LDciUFLYDO8tiJOQgZaLvt559NEAxQp+PwtmMcBj2a2/LDciUFLYDO8tiJOQgZaLvt559NEAxQp+PwtmMcBj2a2/LDciUFLYDO8tiJOQgZaLvt559NEAxQp+PwtmMcBj2a2/LDciUFLYDO8tiJOQgZaLvt559NEAxQp+PwtmMcBj2a2/LDciUFLYDO8tiJOQgZaLvt559NEAxQp+PwtmMcBj2a2/LDciUFLYDO8tiJOQgZaLvt');
    ringtoneRef.current.loop = true;
    ringtoneRef.current.volume = 0.5;
  }, []);

  // WebSocket event handlers for calls
  useEffect(() => {
    if (!isConnected) return;

    const handleIncomingCall = (payload: any) => {
      console.log('Incoming call received:', payload);
      setCurrentCallId(payload.callId);
      setIncomingCall(true);
      setCallType(payload.callType);
      setCallerName(payload.from.displayName);
      setShowIncomingCall(true);
      
      // Play ringtone
      if (ringtoneRef.current) {
        ringtoneRef.current.play().catch(e => console.log('Could not play ringtone:', e));
      }

      toast({
        title: 'Incoming call',
        description: `${payload.from.displayName} is calling you`,
        duration: 10000
      });
    };

    const handleCallAnswered = (payload: any) => {
      console.log('CallContext: Call answered event received:', payload);
      stopRingtone();
      setOutgoingCall(false);
      setIncomingCall(false);
      setShowIncomingCall(false);
      setActiveCall(true);
      setIsInCall(true);
      toast({
        title: 'Call answered',
        description: 'Call connected'
      });
    };

    const handleCallRejected = (payload: any) => {
      console.log('CallContext: Call rejected event received:', payload);
      stopRingtone();
      resetCallState();
      toast({
        title: 'Call declined',
        description: 'The call was declined'
      });
    };

    const handleCallEnded = (payload: any) => {
      console.log('CallContext: Call ended event received:', payload);
      stopRingtone();
      resetCallState();
      toast({
        title: 'Call ended',
        description: 'The call has ended'
      });
    };

    on('incoming_call', handleIncomingCall);
    on('call_answered', handleCallAnswered);
    on('call_rejected', handleCallRejected);
    on('call_ended', handleCallEnded);

    return () => {
      // Cleanup would go here if the socket library supported it
    };
  }, [isConnected, on]);

  const stopRingtone = () => {
    if (ringtoneRef.current) {
      ringtoneRef.current.pause();
      ringtoneRef.current.currentTime = 0;
    }
  };

  const resetCallState = () => {
    setIsInCall(false);
    setIsInitiating(false);
    setIncomingCall(false);
    setOutgoingCall(false);
    setActiveCall(false);
    setShowIncomingCall(false);
    setCallType(null);
    setCallerName(null);
    setCurrentCallId(null);
    setParticipants([]);
    
    // Stop local stream
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
      setLocalStream(null);
    }
    
    // Stop remote stream
    if (remoteStream) {
      remoteStream.getTracks().forEach(track => track.stop());
      setRemoteStream(null);
    }
    
    // Close peer connection
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
  };

  const initiateCall = async (targetUserId: number, type: CallType) => {
    try {
      setIsInitiating(true);
      setOutgoingCall(true);
      setCallType(type);
      
      // Generate call ID
      const callId = `call_${user?.id}_${targetUserId}_${Date.now()}`;
      setCurrentCallId(callId);
      
      // Get user media
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: type === 'video'
      });
      
      setLocalStream(stream);
      setLocalAudioEnabled(true);
      setLocalVideoEnabled(type === 'video');
      
      // Make API call to initiate call
      const response = await fetch('/api/calls/initiate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          targetUserId,
          callType: type
        })
      });
      
      if (response.ok) {
        toast({
          title: "Call initiated",
          description: `${type === 'video' ? 'Video' : 'Voice'} call started`,
        });
      } else {
        throw new Error('Failed to initiate call');
      }
    } catch (error) {
      toast({
        title: "Call failed",
        description: "Unable to start call. Please check your microphone/camera permissions.",
        variant: "destructive",
      });
      resetCallState();
    } finally {
      setIsInitiating(false);
    }
  };

  const answerCall = async () => {
    if (!incomingCall) return;
    
    try {
      stopRingtone();
      
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: callType === 'video'
      });
      
      setLocalStream(stream);
      setLocalAudioEnabled(true);
      setLocalVideoEnabled(callType === 'video');
      setActiveCall(true);
      setIncomingCall(false);
      setShowIncomingCall(false);
      
      // Call API to accept the call
      await fetch('/api/calls/answer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          callId: currentCallId,
          accepted: true
        })
      });
      
      toast({
        title: "Call answered",
        description: `${callType === 'video' ? 'Video' : 'Voice'} call connected`,
      });
    } catch (error) {
      toast({
        title: "Failed to answer call",
        description: "Please check your microphone/camera permissions.",
        variant: "destructive",
      });
      resetCallState();
    }
  };

  const rejectCall = async () => {
    stopRingtone();
    
    try {
      await fetch('/api/calls/hangup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          callId: currentCallId
        })
      });
    } catch (error) {
      console.error('Failed to reject call:', error);
    }
    
    resetCallState();
  };

  const endCall = async () => {
    stopRingtone();
    
    try {
      await fetch('/api/calls/hangup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          callId: currentCallId
        })
      });
    } catch (error) {
      console.error('Failed to end call:', error);
    }
    
    resetCallState();
  };

  const toggleMute = () => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
        setLocalAudioEnabled(audioTrack.enabled);
      }
    }
  };

  const toggleVideo = () => {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoEnabled(videoTrack.enabled);
        setLocalVideoEnabled(videoTrack.enabled);
      }
    }
  };

  const value: CallContextType = {
    // Call state
    isInCall,
    isInitiating,
    callType,
    participants,
    localStream,
    remoteStream,
    
    // Actions
    initiateCall,
    answerCall,
    rejectCall,
    endCall,
    toggleMute,
    toggleVideo,
    
    // UI state
    isMuted,
    isVideoEnabled,
    showIncomingCall,
    incomingCall,
    outgoingCall,
    activeCall,
    callerName,
    localAudioEnabled,
    localVideoEnabled,
  };

  return (
    <CallContext.Provider value={value}>
      {children}
    </CallContext.Provider>
  );
}