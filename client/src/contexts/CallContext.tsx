import React, { createContext, useContext, useState, ReactNode, useRef, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthWrapper';
import { useToast } from '@/hooks/use-toast';
import { useWebSocket } from '@/hooks/use-websocket';
import { WebRTCService } from '@/lib/webrtc-service';

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

const CallContext = createContext<CallContextType | null>(null);

export function CallProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const { sendMessage, isConnected } = useWebSocket();

  // Call state
  const [isInCall, setIsInCall] = useState(false);
  const [isInitiating, setIsInitiating] = useState(false);
  const [callType, setCallType] = useState<CallType | null>(null);
  const [participants, setParticipants] = useState<CallParticipant[]>([]);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  
  // UI state
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
  const [incomingCallOffer, setIncomingCallOffer] = useState<any>(null);
  
  // WebRTC and audio management
  const ringtoneRef = useRef<HTMLAudioElement | null>(null);
  const webrtcService = useRef<WebRTCService>(new WebRTCService());
  const ringtoneIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize ringtone
  useEffect(() => {
    ringtoneRef.current = new Audio('data:audio/wav;base64,UklGRpQEAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YXAEAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBj2a2/LDciUFLYDO8tiJOQgZaLvt559NEAxQp+PwtmMcBj2a2/LDciUFLYDO8tiJOQgZaLvt559NEAxQp+PwtmMcBj2a2/LDciUFLYDO8tiJOQgZaLvt559NEAxQp+PwtmMcBj2a2/LDciUFLYDO8tiJOQgZaLvt559NEAxQp+PwtmMcBj2a2/LDciUFLYDO8tiJOQgZaLvt559NEAxQp+PwtmMcBj2a2/LDciUFLYDO8tiJOQgZaLvt559NEAxQp+PwtmMcBj2a2/LDciUFLYDO8tiJOQgZaLvt559NEAxQp+PwtmMcBj2a2/LDciUFLYDO8tiJOQgZaLvt559NEAxQp+PwtmMcBj2a2/LDciUFLYDO8tiJOQgZaLvt');
    
    if (ringtoneRef.current) {
      ringtoneRef.current.loop = true;
      ringtoneRef.current.volume = 0.5;
    }
  }, []);

  // Initialize WebRTC service
  useEffect(() => {
    const webrtc = webrtcService.current;
    
    // Set up WebRTC callbacks
    webrtc.onRemoteStream((stream) => {
      console.log('Remote stream received in CallContext');
      setRemoteStream(stream);
    });
    
    webrtc.onConnectionState((state) => {
      console.log('WebRTC connection state:', state);
      if (state === 'connected') {
        console.log('WebRTC connection established successfully');
        toast({
          title: 'Call connected',
          description: 'Audio/video transmission active'
        });
      } else if (state === 'failed' || state === 'disconnected') {
        console.log('WebRTC connection failed or disconnected');
        endCall();
      }
    });
    
    webrtc.onSignaling((message) => {
      console.log('WebRTC signaling message:', message.type);
      
      if (sendMessage && currentCallId) {
        if (message.type === 'offer') {
          sendMessage({
            type: 'webrtc_offer',
            payload: {
              offer: message.data,
              callId: currentCallId,
              targetUserId: message.targetUserId
            }
          });
        } else if (message.type === 'answer') {
          sendMessage({
            type: 'webrtc_answer',
            payload: {
              answer: message.data,
              callId: currentCallId,
              targetUserId: message.targetUserId
            }
          });
        } else if (message.type === 'candidate') {
          sendMessage({
            type: 'webrtc_candidate',
            payload: {
              candidate: message.data,
              callId: currentCallId,
              targetUserId: message.targetUserId
            }
          });
        }
      }
    });
    
    return () => {
      webrtc.endCall();
    };
  }, [sendMessage, currentCallId, toast]);

  // WebSocket event handlers for calls
  useEffect(() => {
    if (!isConnected || !sendMessage) return;
    
    const handleWebSocketMessage = (event: MessageEvent) => {
      const data = JSON.parse(event.data);
      console.log('CallContext: WebSocket message received:', data.type);
      
      if (data.type === 'incoming_call') {
        const payload = data.payload;
        console.log('Incoming call from user:', payload.fromUserId);
        
        setCallerName(payload.callerName || payload.from?.displayName || `User ${payload.fromUserId}`);
        setCallType(payload.callType);
        setCurrentCallId(payload.callId);
        setIncomingCallOffer(payload.offer);
        setIncomingCall(true);
        setShowIncomingCall(true);
        
        // Play ringtone
        playRingtone();
        
        toast({
          title: 'Incoming call',
          description: `${payload.callerName || 'Someone'} is calling you`,
          duration: 10000
        });
      }
      
      if (data.type === 'call_answered') {
        const payload = data.payload;
        console.log('Call answered by user:', payload.fromUserId);
        
        stopRingtone();
        setOutgoingCall(false);
        setActiveCall(true);
        
        // Handle WebRTC answer
        if (payload.answer) {
          webrtcService.current.handleAnswer(payload.answer);
        }
      }
      
      if (data.type === 'call_ended') {
        console.log('Call ended by remote user');
        endCall();
      }
      
      if (data.type === 'webrtc_offer') {
        const payload = data.payload;
        console.log('WebRTC offer received');
        setIncomingCallOffer(payload.offer);
      }
      
      if (data.type === 'webrtc_answer') {
        const payload = data.payload;
        console.log('WebRTC answer received');
        
        if (payload.answer) {
          webrtcService.current.handleAnswer(payload.answer);
        }
      }
      
      if (data.type === 'webrtc_candidate') {
        const payload = data.payload;
        console.log('WebRTC ICE candidate received');
        
        if (payload.candidate) {
          webrtcService.current.handleIceCandidate(payload.candidate);
        }
      }
    };

    // Add event listener
    const ws = (sendMessage as any).__ws;
    if (ws) {
      ws.addEventListener('message', handleWebSocketMessage);
      
      return () => {
        ws.removeEventListener('message', handleWebSocketMessage);
      };
    }
  }, [isConnected, sendMessage, toast]);

  // Ringtone management
  const playRingtone = () => {
    if (ringtoneRef.current) {
      ringtoneRef.current.currentTime = 0;
      ringtoneRef.current.play().catch(e => console.error('Error playing ringtone:', e));
    }
  };

  const stopRingtone = () => {
    if (ringtoneRef.current) {
      ringtoneRef.current.pause();
      ringtoneRef.current.currentTime = 0;
    }
    
    if (ringtoneIntervalRef.current) {
      clearInterval(ringtoneIntervalRef.current);
      ringtoneIntervalRef.current = null;
    }
  };

  const resetCallState = () => {
    setIsInCall(false);
    setIsInitiating(false);
    setCallType(null);
    setParticipants([]);
    setLocalStream(null);
    setRemoteStream(null);
    setIsMuted(false);
    setIsVideoEnabled(true);
    setShowIncomingCall(false);
    setIncomingCall(false);
    setOutgoingCall(false);
    setActiveCall(false);
    setCallerName(null);
    setLocalAudioEnabled(true);
    setLocalVideoEnabled(true);
    setCurrentCallId(null);
    setIncomingCallOffer(null);
    stopRingtone();
  };

  // Call functions
  const initiateCall = async (targetUserId: number, type: CallType) => {
    if (!user || isInCall) return;
    
    console.log(`Initiating ${type} call to user ${targetUserId}`);
    
    try {
      setIsInitiating(true);
      setCallType(type);
      setOutgoingCall(true);
      setIsInCall(true);
      
      // Generate call ID
      const callId = `call_${user.id}_${targetUserId}_${Date.now()}`;
      setCurrentCallId(callId);
      
      // Start WebRTC call
      const offer = await webrtcService.current.startCall(callId, type === 'video');
      
      // Get local stream from WebRTC service
      const stream = webrtcService.current.getLocalStream();
      if (stream) {
        setLocalStream(stream);
        setLocalAudioEnabled(true);
        setLocalVideoEnabled(type === 'video');
      }
      
      // Make API call to initiate call
      const response = await fetch('/api/calls/initiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetUserId,
          callType: type,
          callId,
          offer
        })
      });
      
      if (!response.ok) {
        throw new Error('Failed to initiate call');
      }
      
      // Play outgoing call tone
      playRingtone();
      
      toast({
        title: 'Calling...',
        description: `Calling user ${targetUserId}`
      });
    } catch (error) {
      console.error('Error initiating call:', error);
      webrtcService.current.endCall();
      resetCallState();
      toast({
        title: 'Call failed',
        description: 'Failed to start the call',
        variant: 'destructive'
      });
    } finally {
      setIsInitiating(false);
    }
  };

  const answerCall = async () => {
    if (!currentCallId || !incomingCallOffer) return;
    
    console.log('Answering call:', currentCallId);
    
    try {
      stopRingtone();
      setActiveCall(true);
      setIncomingCall(false);
      setShowIncomingCall(false);
      setIsInCall(true);
      
      // Answer the call using WebRTC service
      const answer = await webrtcService.current.answerCall(
        currentCallId,
        incomingCallOffer,
        callType === 'video'
      );
      
      // Get local stream from WebRTC service
      const stream = webrtcService.current.getLocalStream();
      if (stream) {
        setLocalStream(stream);
        setLocalAudioEnabled(true);
        setLocalVideoEnabled(callType === 'video');
      }
      
      // Call API to accept the call
      const response = await fetch('/api/calls/answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          callId: currentCallId,
          accepted: true,
          answer
        })
      });
      
      if (!response.ok) {
        throw new Error('Failed to answer call');
      }
      
      console.log('Call answered successfully');
    } catch (error) {
      console.error('Error answering call:', error);
      endCall();
      toast({
        title: 'Call failed',
        description: 'Failed to answer the call',
        variant: 'destructive'
      });
    }
  };

  const rejectCall = () => {
    console.log('Rejecting call');
    
    if (currentCallId) {
      // Call API to reject the call
      fetch('/api/calls/hangup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          callId: currentCallId,
          accepted: false
        })
      }).catch(console.error);
    }
    
    resetCallState();
    
    toast({
      title: 'Call rejected',
      description: 'Call declined'
    });
  };

  const endCall = () => {
    console.log('Ending call');
    
    if (currentCallId) {
      // Call API to end the call
      fetch('/api/calls/hangup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          callId: currentCallId
        })
      }).catch(console.error);
    }
    
    // End WebRTC call
    webrtcService.current.endCall();
    
    resetCallState();
    
    toast({
      title: 'Call ended',
      description: 'The call has ended'
    });
  };

  const toggleMute = () => {
    const newMuted = webrtcService.current.toggleAudio();
    setIsMuted(!newMuted);
    setLocalAudioEnabled(newMuted);
  };

  const toggleVideo = () => {
    const newVideoEnabled = webrtcService.current.toggleVideo();
    setIsVideoEnabled(newVideoEnabled);
    setLocalVideoEnabled(newVideoEnabled);
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
    localVideoEnabled
  };

  return (
    <CallContext.Provider value={value}>
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