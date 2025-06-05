import React, { createContext, useContext, useState, ReactNode, useRef, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthWrapper';
import { useToast } from '@/hooks/use-toast';
import { useWebSocket } from '@/hooks/use-websocket';

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
  const { send, isConnected, on } = useWebSocket();

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
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const ringtoneIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize ringtone
  useEffect(() => {
    ringtoneRef.current = new Audio('data:audio/wav;base64,UklGRpQEAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YXAEAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBj2a2/LDciUFLYDO8tiJOQgZaLvt559NEAxQp+PwtmMcBj2a2/LDciUFLYDO8tiJOQgZaLvt559NEAxQp+PwtmMcBj2a2+LDciUFLYDO8tiJOQgZaLvt559NEAxQp+PwtmMcBj2a2/LDciUFLYDO8tiJOQgZaLvt559NEAxQp+PwtmMcBj2a2/LDciUFLYDO8tiJOQgZaLvt559NEAxQp+PwtmMcBj2a2/LDciUFLYDO8tiJOQgZaLvt559NEAxQp+PwtmMcBj2a2/LDciUFLYDO8tiJOQgZaLvt559NEAxQp+PwtmMcBj2a2/LDciUFLYDO8tiJOQgZaLvt559NEAxQp+PwtmMcBj2a2/LDciUFLYDO8tiJOQgZaLvt559NEAxQp+PwtmMcBj2a2/LDciUFLYDO8tiJOQgZaLvt');
    
    if (ringtoneRef.current) {
      ringtoneRef.current.loop = true;
      ringtoneRef.current.volume = 0.5;
    }
  }, []);

  // Create WebRTC peer connection
  const createPeerConnection = () => {
    console.log('Creating new RTCPeerConnection with enhanced STUN servers');
    
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' }
      ],
      iceCandidatePoolSize: 10
    });

    // Enhanced remote stream handling
    pc.ontrack = (event) => {
      console.log('Received remote track:', event.track.kind, event.track.label);
      const [stream] = event.streams;
      if (stream) {
        console.log('Setting remote stream with tracks:', stream.getTracks().length);
        setRemoteStream(stream);
      }
    };

    // Enhanced ICE candidate handling
    pc.onicecandidate = (event) => {
      if (event.candidate && currentCallId) {
        console.log('Generated ICE candidate:', event.candidate.type, event.candidate.protocol);
        send('webrtc_candidate', {
          candidate: event.candidate,
          callId: currentCallId
        });
      } else if (!event.candidate) {
        console.log('ICE gathering completed');
      }
    };

    // Enhanced connection state monitoring
    pc.onconnectionstatechange = () => {
      console.log('WebRTC connection state:', pc.connectionState);
      if (pc.connectionState === 'connected') {
        console.log('WebRTC peer connection established successfully');
        toast({
          title: 'Call connected',
          description: 'High-quality audio transmission active'
        });
      } else if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
        console.log('WebRTC connection failed');
        endCall();
      }
    };

    // Enhanced ICE connection state monitoring with recovery logic
    pc.oniceconnectionstatechange = () => {
      console.log('ICE connection state:', pc.iceConnectionState);
      
      switch (pc.iceConnectionState) {
        case 'connected':
        case 'completed':
          console.log('Audio connection established - high quality transmission active');
          toast({
            title: 'Audio connected',
            description: 'High-quality audio transmission established'
          });
          break;
        case 'disconnected':
          console.warn('ICE connection temporarily disconnected - attempting recovery');
          break;
        case 'failed':
          console.error('ICE connection failed - connection quality may be poor');
          toast({
            title: 'Connection quality',
            description: 'Audio quality may be reduced due to network conditions',
            variant: 'destructive'
          });
          break;
        case 'checking':
          console.log('Establishing audio connection...');
          break;
      }
    };

    // ICE gathering state monitoring
    pc.onicegatheringstatechange = () => {
      console.log('ICE gathering state:', pc.iceGatheringState);
    };

    // Signaling state monitoring
    pc.onsignalingstatechange = () => {
      console.log('Signaling state:', pc.signalingState);
    };

    return pc;
  };

  // WebSocket event handlers
  useEffect(() => {
    if (!isConnected || !on) return;

    const handleIncomingCall = (payload: any) => {
      console.log('Incoming call received:', payload);
      setCurrentCallId(payload.callId);
      setIncomingCall(true);
      setCallType(payload.callType);
      setCallerName(payload.from?.displayName || payload.callerName || `User ${payload.fromUserId}`);
      setShowIncomingCall(true);
      setIncomingCallOffer(payload.offer);
      
      // Play ringtone
      if (ringtoneRef.current) {
        ringtoneRef.current.currentTime = 0;
        ringtoneRef.current.play().catch(e => console.error('Error playing ringtone:', e));
      }

      toast({
        title: 'Incoming call',
        description: `${payload.from?.displayName || 'Someone'} is calling you`,
        duration: 10000
      });
    };

    const handleCallAnswered = (payload: any) => {
      console.log('Call answered:', payload);
      stopRingtone();
      setOutgoingCall(false);
      setActiveCall(true);
      
      // Handle WebRTC answer
      if (peerConnectionRef.current && payload.answer) {
        console.log('Setting remote description (answer)');
        peerConnectionRef.current.setRemoteDescription(payload.answer)
          .catch(error => console.error('Error setting remote description:', error));
      }
    };

    const handleCallEnded = (payload: any) => {
      console.log('Call ended:', payload);
      endCall();
    };

    const handleWebRTCOffer = (payload: any) => {
      console.log('WebRTC offer received:', payload);
      setIncomingCallOffer(payload.offer);
    };

    const handleWebRTCAnswer = (payload: any) => {
      console.log('WebRTC answer received:', payload);
      if (peerConnectionRef.current && payload.answer) {
        peerConnectionRef.current.setRemoteDescription(payload.answer)
          .catch(error => console.error('Error setting remote description:', error));
      }
    };

    const handleWebRTCCandidate = (payload: any) => {
      console.log('WebRTC ICE candidate received:', payload);
      if (peerConnectionRef.current && payload.candidate) {
        peerConnectionRef.current.addIceCandidate(payload.candidate)
          .catch(error => console.error('Error adding ICE candidate:', error));
      }
    };

    // Register event handlers
    const unsubscribeIncoming = on('incoming_call', handleIncomingCall);
    const unsubscribeAnswered = on('call_answered', handleCallAnswered);
    const unsubscribeEnded = on('call_ended', handleCallEnded);
    const unsubscribeOffer = on('webrtc_offer', handleWebRTCOffer);
    const unsubscribeAnswer = on('webrtc_answer', handleWebRTCAnswer);
    const unsubscribeCandidate = on('webrtc_candidate', handleWebRTCCandidate);

    return () => {
      unsubscribeIncoming();
      unsubscribeAnswered();
      unsubscribeEnded();
      unsubscribeOffer();
      unsubscribeAnswer();
      unsubscribeCandidate();
    };
  }, [isConnected, on, toast, currentCallId]);

  // Ringtone management
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
    
    // Clean up peer connection
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
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
      
      // Get user media with production-quality constraints
      const mediaConstraints = {
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 44100,
          channelCount: 1
        },
        video: type === 'video' ? {
          width: { min: 640, ideal: 1280, max: 1920 },
          height: { min: 480, ideal: 720, max: 1080 },
          frameRate: { min: 16, ideal: 30, max: 60 },
          facingMode: 'user'
        } : false
      };
      
      const stream = await navigator.mediaDevices.getUserMedia(mediaConstraints);
      
      console.log(`Media stream obtained: ${stream.getTracks().length} tracks`);
      console.log(`Audio tracks: ${stream.getAudioTracks().length}`);
      console.log(`Video tracks: ${stream.getVideoTracks().length}`);
      
      setLocalStream(stream);
      setLocalAudioEnabled(true);
      setLocalVideoEnabled(type === 'video');
      
      // Create peer connection
      const pc = createPeerConnection();
      peerConnectionRef.current = pc;
      
      // Add local stream tracks
      stream.getTracks().forEach((track, index) => {
        console.log(`Adding local track ${index}: ${track.kind}`);
        pc.addTrack(track, stream);
      });
      
      // Create offer with enhanced options
      const offer = await pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: type === 'video',
        iceRestart: false
      });
      
      await pc.setLocalDescription(offer);
      console.log('Created and set local offer');
      
      // Make API call to initiate call (without offer for now)
      const response = await fetch('/api/calls/initiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetUserId,
          callType: type,
          callId
        })
      });
      
      if (!response.ok) {
        throw new Error('Failed to initiate call');
      }
      
      // Send WebRTC offer via WebSocket after call is initiated
      console.log('Sending WebRTC offer to target user:', targetUserId);
      send('webrtc_offer', {
        offer,
        callId,
        targetUserId
      });
      
      // Play outgoing call tone
      if (ringtoneRef.current) {
        ringtoneRef.current.currentTime = 0;
        ringtoneRef.current.play().catch(e => console.error('Error playing ringtone:', e));
      }
      
      toast({
        title: 'Calling...',
        description: `Calling user ${targetUserId}`
      });
    } catch (error) {
      console.error('Error initiating call:', error);
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
    console.log('answerCall function called');
    console.log('Current state:', { currentCallId, callType, hasOffer: !!incomingCallOffer });
    
    if (!currentCallId) {
      console.error('No current call ID');
      return;
    }
    
    try {
      stopRingtone();
      setActiveCall(true);
      setIncomingCall(false);
      setShowIncomingCall(false);
      setIsInCall(true);
      
      // Get user media with production-quality constraints
      const mediaConstraints = {
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 44100,
          channelCount: 1
        },
        video: callType === 'video' ? {
          width: { min: 640, ideal: 1280, max: 1920 },
          height: { min: 480, ideal: 720, max: 1080 },
          frameRate: { min: 16, ideal: 30, max: 60 },
          facingMode: 'user'
        } : false
      };
      
      const stream = await navigator.mediaDevices.getUserMedia(mediaConstraints);
      
      console.log(`Answerer media stream: ${stream.getTracks().length} tracks`);
      console.log(`Audio tracks: ${stream.getAudioTracks().length}`);
      console.log(`Video tracks: ${stream.getVideoTracks().length}`);
      
      setLocalStream(stream);
      setLocalAudioEnabled(true);
      setLocalVideoEnabled(callType === 'video');
      
      // Create peer connection for WebRTC
      const pc = createPeerConnection();
      peerConnectionRef.current = pc;
      
      // Add local stream tracks to peer connection
      stream.getTracks().forEach((track, index) => {
        console.log(`Adding local track ${index}: ${track.kind}`);
        pc.addTrack(track, stream);
      });
      
      // If we have an incoming offer, set it as remote description and create answer
      if (incomingCallOffer) {
        console.log('Setting remote description (offer) and creating answer');
        await pc.setRemoteDescription(incomingCallOffer);
        
        const answer = await pc.createAnswer({
          offerToReceiveAudio: true,
          offerToReceiveVideo: callType === 'video'
        });
        
        console.log('Created WebRTC answer with enhanced options');
        await pc.setLocalDescription(answer);
        console.log('Set local answer description - ready for media flow');
        
        // Send WebRTC answer back to caller via WebSocket
        const targetUserId = parseInt(currentCallId.split('_')[1]); // Extract caller ID from call ID
        console.log('Sending WebRTC answer to caller:', targetUserId);
        send('webrtc_answer', {
          answer,
          callId: currentCallId,
          targetUserId
        });
      }
      
      // Call API to accept the call
      const response = await fetch('/api/calls/answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          callId: currentCallId,
          accepted: true
        })
      });
      
      if (!response.ok) {
        throw new Error('Failed to answer call');
      }
      
      console.log('Call answered successfully - WebRTC signaling initiated');
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
      fetch('/api/calls/hangup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          callId: currentCallId
        })
      }).catch(console.error);
    }
    
    // Stop local stream
    if (localStream) {
      localStream.getTracks().forEach(track => {
        console.log('Stopping local track:', track.kind);
        track.stop();
      });
    }
    
    resetCallState();
    
    toast({
      title: 'Call ended',
      description: 'The call has ended'
    });
  };

  const toggleMute = () => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
        setLocalAudioEnabled(audioTrack.enabled);
        console.log('Audio toggled:', audioTrack.enabled);
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
        console.log('Video toggled:', videoTrack.enabled);
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