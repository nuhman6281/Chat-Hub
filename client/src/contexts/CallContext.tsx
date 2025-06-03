import React, { createContext, useContext, useState, ReactNode } from 'react';
import { useAuth } from '@/contexts/AuthWrapper';
import { useToast } from '@/hooks/use-toast';

export type CallType = 'audio' | 'video';

export interface CallParticipant {
  userId: number;
  username: string;
  displayName: string;
  stream?: MediaStream;
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
  endCall: () => void;
  toggleMute: () => void;
  toggleVideo: () => void;
  
  // UI state
  isMuted: boolean;
  isVideoEnabled: boolean;
  showIncomingCall: boolean;
  incomingCall: { from: CallParticipant; type: CallType } | null;
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
  
  // State
  const [isInCall, setIsInCall] = useState(false);
  const [isInitiating, setIsInitiating] = useState(false);
  const [callType, setCallType] = useState<CallType | null>(null);
  const [participants, setParticipants] = useState<CallParticipant[]>([]);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [showIncomingCall, setShowIncomingCall] = useState(false);
  const [incomingCall, setIncomingCall] = useState<{ from: CallParticipant; type: CallType } | null>(null);

  const initiateCall = async (targetUserId: number, type: CallType) => {
    if (!user) return;
    
    setIsInitiating(true);
    
    // Show placeholder notification
    toast({
      title: "Call Feature Coming Soon",
      description: "Voice and video calls will be available soon",
    });
    
    setIsInitiating(false);
  };

  const answerCall = async () => {
    setShowIncomingCall(false);
    setIncomingCall(null);
    
    toast({
      title: "Call Feature Coming Soon",
      description: "Voice and video calls will be available soon",
    });
  };

  const endCall = () => {
    setIsInCall(false);
    setCallType(null);
    setParticipants([]);
    setLocalStream(null);
    setRemoteStream(null);
    setShowIncomingCall(false);
    setIncomingCall(null);
  };

  const toggleMute = () => {
    setIsMuted(!isMuted);
  };

  const toggleVideo = () => {
    setIsVideoEnabled(!isVideoEnabled);
  };

  const value: CallContextType = {
    isInCall,
    isInitiating,
    callType,
    participants,
    localStream,
    remoteStream,
    initiateCall,
    answerCall,
    endCall,
    toggleMute,
    toggleVideo,
    isMuted,
    isVideoEnabled,
    showIncomingCall,
    incomingCall,
  };

  return (
    <CallContext.Provider value={value}>
      {children}
    </CallContext.Provider>
  );
}