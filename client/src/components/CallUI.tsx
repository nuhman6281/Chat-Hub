import React, { useRef, useEffect } from 'react';
import { useCall, CallParticipant } from '@/contexts/CallContext';
import { Button } from '@/components/ui/button';
import { 
  X, 
  Phone, 
  PhoneOff, 
  Mic, 
  MicOff, 
  Video, 
  VideoOff, 
  UserPlus 
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

// VideoTile component for displaying a participant's video
const VideoTile = ({ participant }: { participant: CallParticipant }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  
  useEffect(() => {
    if (videoRef.current && participant.stream) {
      videoRef.current.srcObject = participant.stream;
    }
  }, [participant.stream]);
  
  // Get initials for avatar
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(part => part.charAt(0))
      .join('')
      .toUpperCase();
  };
  
  return (
    <div className="relative rounded-lg overflow-hidden bg-muted aspect-video">
      {participant.stream && participant.videoEnabled ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={participant.userId === 0} // Mute if local user
          className="w-full h-full object-cover"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center">
          <Avatar className="h-24 w-24">
            <AvatarImage src={''} alt={participant.displayName} />
            <AvatarFallback className="text-4xl">
              {getInitials(participant.displayName)}
            </AvatarFallback>
          </Avatar>
        </div>
      )}
      
      <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between">
        <div className="bg-background/80 px-2 py-1 rounded-full text-sm flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${participant.audioEnabled ? 'bg-green-500' : 'bg-red-500'}`} />
          <span>{participant.displayName}</span>
        </div>
      </div>
    </div>
  );
};

// Incoming call dialog
export function IncomingCallDialog() {
  const { showIncomingCall, callType, callerName, answerCall, rejectCall } = useCall();
  
  if (!showIncomingCall) return null;
  
  return (
    <Dialog open={showIncomingCall} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Incoming {callType === 'video' ? 'Video' : 'Audio'} Call</DialogTitle>
          <DialogDescription>
            {callerName} is calling you
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex justify-center my-6">
          <Avatar className="h-20 w-20">
            <AvatarFallback className="text-4xl">
              {callerName?.charAt(0).toUpperCase() || 'U'}
            </AvatarFallback>
          </Avatar>
        </div>
        
        <DialogFooter className="flex justify-center gap-4 sm:justify-center">
          <Button 
            variant="destructive" 
            size="icon" 
            className="rounded-full h-12 w-12"
            onClick={rejectCall}
          >
            <PhoneOff className="h-5 w-5" />
          </Button>
          <Button 
            variant="default" 
            size="icon" 
            className="rounded-full h-12 w-12 bg-green-600 hover:bg-green-700"
            onClick={answerCall}
          >
            <Phone className="h-5 w-5" />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Outgoing call dialog
export function OutgoingCallDialog() {
  const { outgoingCall, callType, callerName, endCall } = useCall();
  
  if (!outgoingCall) return null;
  
  return (
    <Dialog open={outgoingCall} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Calling...</DialogTitle>
          <DialogDescription>
            Calling {callerName || 'user'} with {callType === 'video' ? 'video' : 'audio'}
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex justify-center my-6">
          <Avatar className="h-20 w-20">
            <AvatarFallback className="text-4xl">
              {callerName?.charAt(0).toUpperCase() || 'U'}
            </AvatarFallback>
          </Avatar>
        </div>
        
        <DialogFooter className="flex justify-center sm:justify-center">
          <Button 
            variant="destructive" 
            size="icon" 
            className="rounded-full h-12 w-12"
            onClick={endCall}
          >
            <PhoneOff className="h-5 w-5" />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Active call UI
export function ActiveCallUI() {
  const { 
    activeCall, 
    callType, 
    participants, 
    localAudioEnabled, 
    localVideoEnabled, 
    localStream,
    remoteStream,
    endCall, 
    toggleMute, 
    toggleVideo 
  } = useCall();
  
  if (!activeCall) return null;

  // Create local participant if we have a local stream
  const localParticipant: CallParticipant = {
    userId: 0, // Local user ID
    username: 'You',
    displayName: 'You',
    stream: localStream || undefined,
    audioEnabled: localAudioEnabled,
    videoEnabled: localVideoEnabled
  };

  // Combine local and remote participants
  const allParticipants = [localParticipant, ...participants];
  
  return (
    <Dialog open={activeCall} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-[800px] max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>
            {callType === 'video' ? 'Video' : 'Audio'} Call
          </DialogTitle>
          <Button 
            variant="ghost" 
            size="icon" 
            className="absolute right-4 top-4" 
            onClick={endCall}
          >
            <X className="h-4 w-4" />
          </Button>
        </DialogHeader>
        
        <div className="flex-1 overflow-y-auto p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          {allParticipants.map(participant => (
            <VideoTile 
              key={participant.userId} 
              participant={participant} 
            />
          ))}
        </div>
        
        <div className="flex justify-center gap-4 py-4">
          <Button 
            variant="outline" 
            size="icon" 
            className={`rounded-full h-10 w-10 ${!localAudioEnabled ? 'bg-red-100 text-red-500' : ''}`}
            onClick={toggleMute}
          >
            {localAudioEnabled ? (
              <Mic className="h-5 w-5" />
            ) : (
              <MicOff className="h-5 w-5" />
            )}
          </Button>
          
          {callType === 'video' && (
            <Button 
              variant="outline" 
              size="icon" 
              className={`rounded-full h-10 w-10 ${!localVideoEnabled ? 'bg-red-100 text-red-500' : ''}`}
              onClick={toggleVideo}
            >
              {localVideoEnabled ? (
                <Video className="h-5 w-5" />
              ) : (
                <VideoOff className="h-5 w-5" />
              )}
            </Button>
          )}
          
          <Button 
            variant="destructive" 
            size="icon" 
            className="rounded-full h-10 w-10"
            onClick={endCall}
          >
            <PhoneOff className="h-5 w-5" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Call UI wrapper component
export default function CallUI() {
  return (
    <>
      <IncomingCallDialog />
      <OutgoingCallDialog />
      <ActiveCallUI />
    </>
  );
}