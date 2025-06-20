import React, { useRef, useEffect } from "react";
import { useCall, CallParticipant } from "@/contexts/CallContext";
import { Button } from "@/components/ui/button";
import {
  X,
  Phone,
  PhoneOff,
  Mic,
  MicOff,
  Video,
  VideoOff,
  UserPlus,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

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
      .split(" ")
      .map((part) => part.charAt(0))
      .join("")
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
            <AvatarImage src={""} alt={participant.displayName} />
            <AvatarFallback className="text-4xl">
              {getInitials(participant.displayName)}
            </AvatarFallback>
          </Avatar>
        </div>
      )}

      <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between">
        <div className="bg-background/80 px-2 py-1 rounded-full text-sm flex items-center gap-2">
          <div
            className={`w-2 h-2 rounded-full ${
              participant.audioEnabled ? "bg-green-500" : "bg-red-500"
            }`}
          />
          <span>{participant.displayName}</span>
        </div>
      </div>
    </div>
  );
};

// Incoming call dialog
export function IncomingCallDialog() {
  const { showIncomingCall, callType, callerName, answerCall, rejectCall } =
    useCall();

  if (!showIncomingCall) return null;

  return (
    <Dialog open={showIncomingCall} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            Incoming {callType === "video" ? "Video" : "Audio"} Call
          </DialogTitle>
          <DialogDescription>{callerName} is calling you</DialogDescription>
        </DialogHeader>

        <div className="flex justify-center my-6">
          <Avatar className="h-20 w-20">
            <AvatarFallback className="text-4xl">
              {callerName?.charAt(0).toUpperCase() || "U"}
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
            onClick={() => {
              console.log("Green answer button clicked!");
              answerCall();
            }}
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
            Calling {callerName || "user"} with{" "}
            {callType === "video" ? "video" : "audio"}
          </DialogDescription>
        </DialogHeader>

        <div className="flex justify-center my-6">
          <Avatar className="h-20 w-20">
            <AvatarFallback className="text-4xl">
              {callerName?.charAt(0).toUpperCase() || "U"}
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
    toggleVideo,
  } = useCall();

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const localVideoPipRef = useRef<HTMLVideoElement>(null); // For picture-in-picture
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);

  // Set up local video streams when they change
  useEffect(() => {
    // Set up main local video (only when no remote stream)
    if (localVideoRef.current && localStream && !remoteStream) {
      console.log("📹 CallUI: Setting up local video playback (main view)");
      localVideoRef.current.srcObject = localStream;
      localVideoRef.current.play().catch((error) => {
        console.error("❌ CallUI: Error playing local video (main):", error);
      });
    }
  }, [localStream, remoteStream]);

  // Set up picture-in-picture local video separately
  useEffect(() => {
    if (localVideoPipRef.current && localStream && remoteStream) {
      console.log(
        "📹 CallUI: Setting up local video playback (picture-in-picture)"
      );
      localVideoPipRef.current.srcObject = localStream;
      localVideoPipRef.current.play().catch((error) => {
        console.error("❌ CallUI: Error playing local video (pip):", error);
      });
    }
  }, [localStream, remoteStream]);

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      console.log(
        "📹 CallUI: Setting up remote video playback with",
        remoteStream.getTracks().length,
        "tracks"
      );
      console.log(
        "📹 Remote stream video tracks:",
        remoteStream.getVideoTracks().length
      );
      console.log(
        "📹 Remote stream audio tracks:",
        remoteStream.getAudioTracks().length
      );

      remoteVideoRef.current.srcObject = remoteStream;
      remoteVideoRef.current.play().catch((error) => {
        console.error("❌ CallUI: Error playing remote video:", error);
      });
    } else if (remoteVideoRef.current && !remoteStream) {
      console.log("📹 CallUI: No remote stream available yet");
    }
  }, [remoteStream]);

  // CRITICAL: Set up audio playback for remote stream
  useEffect(() => {
    if (remoteAudioRef.current && remoteStream) {
      console.log(
        "🔊 CallUI: Setting up remote audio playback with",
        remoteStream.getTracks().length,
        "tracks"
      );
      remoteAudioRef.current.srcObject = remoteStream;
      remoteAudioRef.current.play().catch((error) => {
        console.error("❌ CallUI: Error playing remote audio:", error);
      });
    }
  }, [remoteStream]);

  if (!activeCall) return null;

  // Create local participant if we have a local stream
  const localParticipant: CallParticipant = {
    userId: 0, // Local user ID
    username: "You",
    displayName: "You",
    stream: localStream || undefined,
    audioEnabled: localAudioEnabled,
    videoEnabled: localVideoEnabled,
  };

  // Combine local and remote participants
  const allParticipants = [localParticipant, ...participants];

  return (
    <Dialog open={activeCall} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-[800px] max-h-[90vh] flex flex-col">
        {/* Hidden audio element for remote audio playback */}
        <audio
          ref={remoteAudioRef}
          autoPlay
          playsInline
          style={{ display: "none" }}
        />

        <DialogHeader>
          <DialogTitle>
            {callType === "video" ? "Video" : "Audio"} Call
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

        <div className="flex-1 overflow-y-auto p-4">
          {callType === "video" ? (
            <div className="relative w-full h-96 bg-gray-900 rounded-lg overflow-hidden">
              {/* Show local video in main view if no remote stream, otherwise show remote */}
              {remoteStream ? (
                /* Remote video (main view) when available */
                <video
                  ref={remoteVideoRef}
                  autoPlay
                  playsInline
                  className="w-full h-full object-cover"
                />
              ) : (
                /* Local video (main view) when no remote stream */
                localStream && (
                  <video
                    ref={localVideoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover"
                  />
                )
              )}

              {/* Local video (picture-in-picture) only when remote stream exists */}
              {remoteStream && localStream && (
                <video
                  ref={localVideoPipRef}
                  autoPlay
                  playsInline
                  muted
                  className="absolute top-4 right-4 w-32 h-24 bg-gray-800 rounded border-2 border-white object-cover"
                />
              )}

              {/* No video indicators */}
              {!remoteStream && !localStream && (
                <div className="absolute inset-0 flex items-center justify-center text-white">
                  <div className="text-center">
                    <VideoOff className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>Waiting for video...</p>
                  </div>
                </div>
              )}

              {!remoteStream && localStream && (
                <div className="absolute bottom-4 left-4 text-white text-sm bg-black/50 px-2 py-1 rounded">
                  Waiting for remote video...
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-center h-32">
              <div className="text-center">
                <div className="w-20 h-20 mx-auto mb-4 bg-gray-200 rounded-full flex items-center justify-center">
                  <Phone className="h-8 w-8 text-gray-600" />
                </div>
                <p className="text-lg font-medium">Audio Call Active</p>
                <p className="text-sm text-gray-500">
                  {localAudioEnabled ? "Microphone active" : "Microphone muted"}
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-center gap-4 py-4">
          <Button
            variant="outline"
            size="icon"
            className={`rounded-full h-10 w-10 ${
              !localAudioEnabled ? "bg-red-100 text-red-500" : ""
            }`}
            onClick={toggleMute}
          >
            {localAudioEnabled ? (
              <Mic className="h-5 w-5" />
            ) : (
              <MicOff className="h-5 w-5" />
            )}
          </Button>

          {callType === "video" && (
            <Button
              variant="outline"
              size="icon"
              className={`rounded-full h-10 w-10 ${
                !localVideoEnabled ? "bg-red-100 text-red-500" : ""
              }`}
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
