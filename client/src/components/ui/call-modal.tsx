import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Phone, PhoneOff, Video, VideoOff, Mic, MicOff } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';

interface CallModalProps {
  isOpen: boolean;
  onClose: () => void;
  callData: {
    callId: string;
    callType: 'voice' | 'video';
    isIncoming: boolean;
    user: {
      id: number;
      username: string;
      displayName: string;
      avatarUrl?: string;
    };
  } | null;
  onAnswer?: (accepted: boolean) => void;
  onHangup?: () => void;
}

export function CallModal({ isOpen, onClose, callData, onAnswer, onHangup }: CallModalProps) {
  const [callStatus, setCallStatus] = useState<'ringing' | 'connecting' | 'connected' | 'ended'>('ringing');
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const ringtoneRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (isOpen && callData) {
      if (callData.isIncoming) {
        // Play ringtone for incoming calls
        playRingtone();
      } else {
        // For outgoing calls, show ringing status
        setCallStatus('ringing');
      }
    }

    return () => {
      stopRingtone();
      cleanup();
    };
  }, [isOpen, callData]);

  const playRingtone = () => {
    // Create a simple ringtone using Web Audio API
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
    gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
    
    oscillator.start();
    
    setTimeout(() => {
      oscillator.stop();
    }, 1000);

    // Repeat every 2 seconds
    const interval = setInterval(() => {
      if (callStatus === 'ringing') {
        const newOscillator = audioContext.createOscillator();
        const newGainNode = audioContext.createGain();
        
        newOscillator.connect(newGainNode);
        newGainNode.connect(audioContext.destination);
        
        newOscillator.frequency.setValueAtTime(800, audioContext.currentTime);
        newGainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
        
        newOscillator.start();
        setTimeout(() => newOscillator.stop(), 1000);
      } else {
        clearInterval(interval);
      }
    }, 2000);
  };

  const stopRingtone = () => {
    if (ringtoneRef.current) {
      ringtoneRef.current.pause();
      ringtoneRef.current.currentTime = 0;
    }
  };

  const initializeWebRTC = async () => {
    try {
      // Get user media
      const constraints = {
        video: callData?.callType === 'video',
        audio: true
      };
      
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      setLocalStream(stream);
      
      if (localVideoRef.current && callData?.callType === 'video') {
        localVideoRef.current.srcObject = stream;
      }

      // Create peer connection
      const configuration = {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' }
        ]
      };
      
      const peerConnection = new RTCPeerConnection(configuration);
      peerConnectionRef.current = peerConnection;

      // Add local stream to peer connection
      stream.getTracks().forEach(track => {
        peerConnection.addTrack(track, stream);
      });

      // Handle remote stream
      peerConnection.ontrack = (event) => {
        const [remoteStream] = event.streams;
        setRemoteStream(remoteStream);
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = remoteStream;
        }
      };

      // Handle ICE candidates
      peerConnection.onicecandidate = async (event) => {
        if (event.candidate && callData) {
          try {
            await apiRequest('POST', '/api/calls/signal', {
              targetUserId: callData.user.id,
              signalData: event.candidate,
              callId: callData.callId,
              type: 'candidate'
            });
          } catch (error) {
            console.error('Failed to send ICE candidate:', error);
          }
        }
      };

      return peerConnection;
    } catch (error) {
      console.error('Failed to initialize WebRTC:', error);
      setCallStatus('ended');
    }
  };

  const handleAnswer = async (accepted: boolean) => {
    stopRingtone();
    
    if (!callData) return;

    try {
      await apiRequest('POST', '/api/calls/answer', {
        callId: callData.callId,
        accepted
      });

      if (accepted) {
        setCallStatus('connecting');
        await initializeWebRTC();
        setCallStatus('connected');
      } else {
        setCallStatus('ended');
        onClose();
      }
    } catch (error) {
      console.error('Failed to answer call:', error);
    }

    if (onAnswer) {
      onAnswer(accepted);
    }
  };

  const handleHangup = async () => {
    stopRingtone();
    
    if (!callData) return;

    try {
      await apiRequest('POST', '/api/calls/hangup', {
        callId: callData.callId
      });
    } catch (error) {
      console.error('Failed to hang up call:', error);
    }

    cleanup();
    setCallStatus('ended');
    onClose();

    if (onHangup) {
      onHangup();
    }
  };

  const toggleVideo = () => {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoEnabled(videoTrack.enabled);
      }
    }
  };

  const toggleAudio = () => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsAudioEnabled(audioTrack.enabled);
      }
    }
  };

  const cleanup = () => {
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
      setLocalStream(null);
    }
    
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    
    setRemoteStream(null);
  };

  if (!callData) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {callData.isIncoming ? 'Incoming' : 'Outgoing'} {callData.callType} Call
          </DialogTitle>
        </DialogHeader>
        
        <div className="flex flex-col items-center space-y-4">
          {/* User Info */}
          <div className="text-center">
            <div className="w-20 h-20 mx-auto mb-2 bg-gray-300 rounded-full flex items-center justify-center">
              {callData.user.avatarUrl ? (
                <img 
                  src={callData.user.avatarUrl} 
                  alt={callData.user.displayName}
                  className="w-full h-full rounded-full object-cover"
                />
              ) : (
                <span className="text-2xl font-bold text-gray-600">
                  {callData.user.displayName.charAt(0).toUpperCase()}
                </span>
              )}
            </div>
            <h3 className="text-lg font-semibold">{callData.user.displayName}</h3>
            <p className="text-sm text-gray-600">@{callData.user.username}</p>
            <p className="text-sm text-gray-500 mt-1">
              {callStatus === 'ringing' && (callData.isIncoming ? 'Incoming call...' : 'Ringing...')}
              {callStatus === 'connecting' && 'Connecting...'}
              {callStatus === 'connected' && 'Connected'}
              {callStatus === 'ended' && 'Call ended'}
            </p>
          </div>

          {/* Video Elements */}
          {callData.callType === 'video' && callStatus === 'connected' && (
            <div className="relative w-full max-w-lg">
              {/* Remote video */}
              <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                className="w-full h-64 bg-gray-900 rounded-lg"
              />
              
              {/* Local video (picture-in-picture) */}
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className="absolute top-4 right-4 w-24 h-18 bg-gray-800 rounded border-2 border-white"
              />
            </div>
          )}

          {/* Call Controls */}
          <div className="flex space-x-4">
            {callData.isIncoming && callStatus === 'ringing' && (
              <>
                <Button
                  onClick={() => handleAnswer(false)}
                  variant="destructive"
                  className="rounded-full w-12 h-12 p-0"
                >
                  <PhoneOff className="h-6 w-6" />
                </Button>
                <Button
                  onClick={() => handleAnswer(true)}
                  className="rounded-full w-12 h-12 p-0 bg-green-600 hover:bg-green-700"
                >
                  <Phone className="h-6 w-6" />
                </Button>
              </>
            )}

            {(callStatus === 'connected' || (!callData.isIncoming && callStatus === 'ringing')) && (
              <>
                {callData.callType === 'video' && (
                  <Button
                    onClick={toggleVideo}
                    variant={isVideoEnabled ? "secondary" : "destructive"}
                    className="rounded-full w-12 h-12 p-0"
                  >
                    {isVideoEnabled ? <Video className="h-6 w-6" /> : <VideoOff className="h-6 w-6" />}
                  </Button>
                )}
                
                <Button
                  onClick={toggleAudio}
                  variant={isAudioEnabled ? "secondary" : "destructive"}
                  className="rounded-full w-12 h-12 p-0"
                >
                  {isAudioEnabled ? <Mic className="h-6 w-6" /> : <MicOff className="h-6 w-6" />}
                </Button>
                
                <Button
                  onClick={handleHangup}
                  variant="destructive"
                  className="rounded-full w-12 h-12 p-0"
                >
                  <PhoneOff className="h-6 w-6" />
                </Button>
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}