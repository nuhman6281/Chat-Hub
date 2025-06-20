import React, { useRef, useEffect, useState } from "react";
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
  Monitor,
  Settings,
  MoreVertical,
  Maximize2,
  Minimize2,
  Volume2,
  VolumeX,
  Camera,
  SwitchCamera,
  Grid3X3,
  Users,
  MessageCircle,
  Share,
  Circle,
  Pause,
  Play,
  RotateCcw,
  Maximize,
  PictureInPicture2,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import {
  ScreenShareControls,
  ScreenShareOverlay,
} from "@/components/ui/screen-share-controls";
import ConnectionStatus from "@/components/ui/connection-status";

// Enhanced participant component
const ParticipantTile = ({
  participant,
  isLocal = false,
  isMainView = false,
  onSwapToMain,
  className = "",
}: {
  participant: CallParticipant;
  isLocal?: boolean;
  isMainView?: boolean;
  onSwapToMain?: () => void;
  className?: string;
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    if (videoRef.current && participant.stream) {
      videoRef.current.srcObject = participant.stream;
      if (!isLocal) {
        videoRef.current.play().catch(console.error);
      }
    }
  }, [participant.stream, isLocal]);

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((part) => part.charAt(0))
      .join("")
      .toUpperCase();
  };

  return (
    <div
      className={`relative rounded-xl overflow-hidden bg-gray-900 border-2 border-gray-700 transition-all duration-200 hover:border-blue-500 group ${className}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={onSwapToMain}
      style={{ cursor: onSwapToMain ? "pointer" : "default" }}
    >
      {participant.stream && participant.videoEnabled ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isLocal}
          className="w-full h-full object-cover"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-800 to-gray-900">
          <Avatar className={isMainView ? "h-32 w-32" : "h-16 w-16"}>
            <AvatarImage src={""} alt={participant.displayName} />
            <AvatarFallback
              className={`${
                isMainView ? "text-4xl" : "text-xl"
              } bg-blue-600 text-white`}
            >
              {getInitials(participant.displayName)}
            </AvatarFallback>
          </Avatar>
        </div>
      )}

      {/* Participant info overlay */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Badge
              variant={participant.audioEnabled ? "default" : "destructive"}
              className="text-xs"
            >
              {participant.audioEnabled ? (
                <Mic className="h-3 w-3" />
              ) : (
                <MicOff className="h-3 w-3" />
              )}
            </Badge>
            <span className="text-white text-sm font-medium truncate">
              {participant.displayName}
            </span>
            {isLocal && (
              <Badge variant="secondary" className="text-xs">
                You
              </Badge>
            )}
          </div>

          {!participant.videoEnabled && (
            <VideoOff className="h-4 w-4 text-red-400" />
          )}
        </div>
      </div>

      {/* Connection quality indicator */}
      <div className="absolute top-3 right-3">
        <div className="flex items-center gap-1">
          <div className="w-1 h-3 bg-green-500 rounded-full"></div>
          <div className="w-1 h-2 bg-green-400 rounded-full"></div>
          <div className="w-1 h-1 bg-green-300 rounded-full"></div>
        </div>
      </div>

      {/* Swap to main view button */}
      {onSwapToMain && isHovered && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/20">
          <Button
            size="sm"
            variant="secondary"
            className="opacity-90 hover:opacity-100"
            onClick={(e) => {
              e.stopPropagation();
              onSwapToMain();
            }}
          >
            <Maximize2 className="h-4 w-4 mr-1" />
            View
          </Button>
        </div>
      )}
    </div>
  );
};

// Incoming call dialog with enhanced UI
export function IncomingCallDialog() {
  const { showIncomingCall, callType, callerName, answerCall, rejectCall } =
    useCall();

  if (!showIncomingCall) return null;

  return (
    <Dialog open={showIncomingCall} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="text-center">
          <DialogTitle className="text-2xl">
            Incoming {callType === "video" ? "Video" : "Audio"} Call
          </DialogTitle>
          <DialogDescription className="text-lg mt-2">
            {callerName} is calling you
          </DialogDescription>
        </DialogHeader>

        <div className="flex justify-center my-8">
          <div className="relative">
            <Avatar className="h-24 w-24 border-4 border-blue-500 animate-pulse">
              <AvatarFallback className="text-3xl bg-blue-600 text-white">
                {callerName?.charAt(0).toUpperCase() || "U"}
              </AvatarFallback>
            </Avatar>
            <div className="absolute -top-2 -right-2">
              {callType === "video" ? (
                <Video className="h-6 w-6 text-blue-500" />
              ) : (
                <Phone className="h-6 w-6 text-green-500" />
              )}
            </div>
          </div>
        </div>

        <DialogFooter className="flex justify-center gap-6 sm:justify-center">
          <Button
            variant="destructive"
            size="lg"
            className="rounded-full h-14 w-14"
            onClick={rejectCall}
          >
            <PhoneOff className="h-6 w-6" />
          </Button>
          <Button
            variant="default"
            size="lg"
            className="rounded-full h-14 w-14 bg-green-600 hover:bg-green-700"
            onClick={answerCall}
          >
            <Phone className="h-6 w-6" />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Outgoing call dialog with enhanced UI
export function OutgoingCallDialog() {
  const { outgoingCall, callType, callerName, endCall } = useCall();

  if (!outgoingCall) return null;

  return (
    <Dialog open={outgoingCall} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="text-center">
          <DialogTitle className="text-2xl">Calling...</DialogTitle>
          <DialogDescription className="text-lg mt-2">
            Calling {callerName || "user"} with{" "}
            {callType === "video" ? "video" : "audio"}
          </DialogDescription>
        </DialogHeader>

        <div className="flex justify-center my-8">
          <div className="relative">
            <Avatar className="h-24 w-24 border-4 border-blue-500 animate-pulse">
              <AvatarFallback className="text-3xl bg-blue-600 text-white">
                {callerName?.charAt(0).toUpperCase() || "U"}
              </AvatarFallback>
            </Avatar>
            <div className="absolute inset-0 border-4 border-blue-500 rounded-full animate-ping"></div>
          </div>
        </div>

        <DialogFooter className="flex justify-center sm:justify-center">
          <Button
            variant="destructive"
            size="lg"
            className="rounded-full h-14 w-14"
            onClick={endCall}
          >
            <PhoneOff className="h-6 w-6" />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Professional active call UI
export function ActiveCallUI() {
  const {
    activeCall,
    callType,
    participants,
    localAudioEnabled,
    localVideoEnabled,
    localStream,
    remoteStream,
    remoteAudioEnabled,
    remoteVideoEnabled,
    remoteUserInfo,
    endCall,
    toggleMute,
    toggleVideo,
    screenStream,
    remoteScreenStream,
    isScreenSharing,
    remoteIsScreenSharing,
    screenShareError,
    startScreenShare,
    stopScreenShare,
    connectionState,
    iceConnectionState,
    isReconnecting,
    lastConnectionError,
    handleConnectionRecovery,
    handleMediaStreamRecovery,
  } = useCall();

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);

  // UI state
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [viewMode, setViewMode] = useState<"speaker" | "gallery">("speaker");
  const [showControls, setShowControls] = useState(true);
  const [volume, setVolume] = useState([80]);
  const [isRecording, setIsRecording] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [mainParticipant, setMainParticipant] = useState<"local" | "remote">(
    "remote"
  );

  // Call duration timer
  useEffect(() => {
    if (!activeCall) return;

    const timer = setInterval(() => {
      setCallDuration((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [activeCall]);

  // Auto-hide controls
  useEffect(() => {
    if (!showControls) return;

    const timer = setTimeout(() => {
      setShowControls(false);
    }, 3000);

    return () => clearTimeout(timer);
  }, [showControls]);

  // Media setup
  useEffect(() => {
    if (localVideoRef.current) {
      // Prioritize screen sharing, then regular video
      const streamToUse =
        isScreenSharing && screenStream ? screenStream : localStream;

      if (streamToUse) {
        localVideoRef.current.srcObject = streamToUse;
        console.log(
          "🎥 Setting local video source:",
          isScreenSharing ? "screen share" : "camera"
        );
      }
    }
  }, [localStream, screenStream, isScreenSharing, mainParticipant]);

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
      remoteVideoRef.current.play().catch(console.error);
      console.log(
        "🎥 Setting remote video source:",
        remoteIsScreenSharing ? "screen share" : "camera"
      );
    }
  }, [remoteStream, remoteIsScreenSharing, mainParticipant]);

  useEffect(() => {
    if (remoteAudioRef.current && remoteStream) {
      remoteAudioRef.current.srcObject = remoteStream;
      remoteAudioRef.current.volume = volume[0] / 100;
      remoteAudioRef.current.play().catch(console.error);
    }
  }, [remoteStream, volume]);

  if (!activeCall) return null;

  const formatDuration = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, "0")}:${secs
        .toString()
        .padStart(2, "0")}`;
    }
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const localParticipant: CallParticipant = {
    userId: 0,
    username: "You",
    displayName: "You",
    stream: localStream || undefined,
    audioEnabled: localAudioEnabled,
    videoEnabled: localVideoEnabled,
  };

  const remoteParticipant: CallParticipant | null = remoteStream
    ? {
        userId: remoteUserInfo?.id || 1,
        username: remoteUserInfo?.name || "Remote User",
        displayName: remoteUserInfo?.name || "Remote User",
        stream: remoteStream,
        audioEnabled: remoteAudioEnabled,
        videoEnabled: remoteVideoEnabled,
      }
    : null;

  const allParticipants = [
    localParticipant,
    ...(remoteParticipant ? [remoteParticipant] : []),
  ];

  return (
    <>
      {/* Screen sharing overlay - appears outside dialog */}
      <ScreenShareOverlay
        isScreenSharing={isScreenSharing}
        remoteIsScreenSharing={remoteIsScreenSharing}
        remoteUserName={remoteUserInfo?.name}
        onStopScreenShare={stopScreenShare}
        callDuration={formatDuration(callDuration)}
      />

      <Dialog open={activeCall} onOpenChange={() => {}}>
        <DialogContent
          className={`${
            isFullscreen
              ? "max-w-full max-h-full w-screen h-screen"
              : "sm:max-w-6xl max-h-[90vh]"
          } p-0 bg-gray-900 border-gray-700`}
          onMouseMove={() => setShowControls(true)}
        >
          {/* Hidden accessibility elements */}
          <VisuallyHidden>
            <DialogTitle>
              {callType === "video" ? "Video Call" : "Audio Call"} in Progress
            </DialogTitle>
            <DialogDescription>
              Active {callType} call with{" "}
              {remoteUserInfo?.name || "another user"}. Use controls to manage
              audio, video, and screen sharing.
            </DialogDescription>
          </VisuallyHidden>

          {/* Hidden audio element */}
          <audio
            ref={remoteAudioRef}
            autoPlay
            playsInline
            style={{ display: "none" }}
          />

          {/* Header with call info */}
          <div
            className={`absolute top-0 left-0 right-0 z-50 bg-gradient-to-b from-black/80 to-transparent p-4 transition-opacity duration-300 ${
              showControls ? "opacity-100" : "opacity-0"
            }`}
          >
            <div className="flex items-center justify-between text-white">
              <div className="flex items-center gap-4">
                <Badge
                  variant="secondary"
                  className="bg-green-600/20 text-green-400 border-green-600"
                >
                  <div className="w-2 h-2 bg-green-400 rounded-full mr-2 animate-pulse"></div>
                  {callType === "video" ? "Video Call" : "Audio Call"}
                </Badge>
                <span className="text-sm font-mono">
                  {formatDuration(callDuration)}
                </span>

                {/* Connection Status */}
                <ConnectionStatus
                  connectionState={connectionState}
                  iceConnectionState={iceConnectionState}
                  isReconnecting={isReconnecting}
                  lastConnectionError={lastConnectionError}
                  className="bg-black/40 border border-white/20"
                />

                {isScreenSharing && (
                  <Badge
                    variant="default"
                    className="bg-blue-600/20 text-blue-400 border-blue-600"
                  >
                    <Monitor className="h-3 w-3 mr-1" />
                    Sharing Screen
                  </Badge>
                )}
                {remoteIsScreenSharing && (
                  <Badge
                    variant="default"
                    className="bg-purple-600/20 text-purple-400 border-purple-600"
                  >
                    <Monitor className="h-3 w-3 mr-1" />
                    {remoteUserInfo?.name || "Remote"} Sharing
                  </Badge>
                )}
                {isRecording && (
                  <Badge variant="destructive" className="animate-pulse">
                    <Circle className="h-3 w-3 mr-1 fill-current" />
                    Recording
                  </Badge>
                )}
              </div>

              <div className="flex items-center gap-2">
                {/* Connection Recovery Controls */}
                {(connectionState === "failed" ||
                  connectionState === "reconnecting") && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-white border-orange-500 hover:bg-orange-500/20"
                      >
                        <RotateCcw className="h-4 w-4 mr-1" />
                        Recovery
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={handleConnectionRecovery}>
                        <RotateCcw className="h-4 w-4 mr-2" />
                        Reconnect Call
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => handleMediaStreamRecovery("both")}
                      >
                        <Camera className="h-4 w-4 mr-2" />
                        Reset Audio & Video
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => handleMediaStreamRecovery("video")}
                      >
                        <Video className="h-4 w-4 mr-2" />
                        Reset Video Only
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => handleMediaStreamRecovery("audio")}
                      >
                        <Mic className="h-4 w-4 mr-2" />
                        Reset Audio Only
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}

                <Button
                  variant="ghost"
                  size="icon"
                  className="text-white hover:bg-white/20"
                  onClick={() => setIsFullscreen(!isFullscreen)}
                >
                  {isFullscreen ? (
                    <Minimize2 className="h-4 w-4" />
                  ) : (
                    <Maximize2 className="h-4 w-4" />
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-white hover:bg-white/20"
                  onClick={endCall}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          {/* Main video area */}
          <div className="relative w-full h-full bg-gray-900 flex flex-col">
            {callType === "video" ? (
              <div className="flex-1 relative">
                {viewMode === "speaker" ? (
                  <>
                    {/* Main speaker view */}
                    <div className="w-full h-full relative">
                      {/* Prioritize screen sharing - remote screen share takes precedence */}
                      {remoteIsScreenSharing && remoteStream ? (
                        <video
                          ref={remoteVideoRef}
                          autoPlay
                          playsInline
                          className="w-full h-full object-contain bg-black"
                        />
                      ) : isScreenSharing && screenStream ? (
                        <video
                          ref={localVideoRef}
                          autoPlay
                          playsInline
                          muted
                          className="w-full h-full object-contain bg-black"
                        />
                      ) : mainParticipant === "remote" && remoteStream ? (
                        <video
                          ref={remoteVideoRef}
                          autoPlay
                          playsInline
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <video
                          ref={localVideoRef}
                          autoPlay
                          playsInline
                          muted
                          className="w-full h-full object-cover"
                        />
                      )}

                      {/* Main view participant info */}
                      <div className="absolute bottom-4 left-4">
                        <Badge className="bg-black/50 text-white border-gray-600">
                          {remoteIsScreenSharing ? (
                            <>
                              <Monitor className="h-3 w-3 mr-1" />
                              {remoteUserInfo?.name || "Remote User"}'s Screen
                            </>
                          ) : isScreenSharing ? (
                            <>
                              <Monitor className="h-3 w-3 mr-1" />
                              Your Screen Share
                            </>
                          ) : mainParticipant === "remote" ? (
                            remoteUserInfo?.name || "Remote User"
                          ) : (
                            "You (Main View)"
                          )}
                        </Badge>
                      </div>

                      {/* Screen sharing overlay */}
                      {(isScreenSharing || remoteIsScreenSharing) && (
                        <div className="absolute top-4 left-1/2 transform -translate-x-1/2">
                          <Badge className="bg-green-600/90 text-white border-green-500 animate-pulse">
                            <Monitor className="h-3 w-3 mr-1" />
                            Screen Sharing Active
                          </Badge>
                        </div>
                      )}
                    </div>

                    {/* Picture-in-picture thumbnails */}
                    <div className="absolute top-20 right-4 space-y-3">
                      {allParticipants.map((participant, index) => {
                        const isMainView =
                          (participant.displayName === "You" &&
                            mainParticipant === "local") ||
                          (participant.displayName !== "You" &&
                            mainParticipant === "remote");

                        if (isMainView) return null;

                        return (
                          <ParticipantTile
                            key={index}
                            participant={participant}
                            isLocal={participant.displayName === "You"}
                            className="w-48 h-36"
                            onSwapToMain={() =>
                              setMainParticipant(
                                participant.displayName === "You"
                                  ? "local"
                                  : "remote"
                              )
                            }
                          />
                        );
                      })}
                    </div>
                  </>
                ) : (
                  /* Gallery view */
                  <div className="w-full h-full p-4">
                    <div
                      className={`grid gap-4 h-full ${
                        allParticipants.length <= 2
                          ? "grid-cols-2"
                          : "grid-cols-2 grid-rows-2"
                      }`}
                    >
                      {allParticipants.map((participant, index) => (
                        <ParticipantTile
                          key={index}
                          participant={participant}
                          isLocal={participant.displayName === "You"}
                          className="w-full h-full"
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* Audio call UI */
              <div className="flex-1 flex items-center justify-center bg-gradient-to-br from-blue-900 to-purple-900">
                <div className="text-center text-white">
                  <div className="flex justify-center gap-8 mb-8">
                    {allParticipants.map((participant, index) => (
                      <div key={index} className="text-center">
                        <Avatar className="h-32 w-32 mx-auto mb-4 border-4 border-white/20">
                          <AvatarFallback className="text-4xl bg-gradient-to-br from-blue-600 to-purple-600 text-white">
                            {participant.displayName.charAt(0)}
                          </AvatarFallback>
                        </Avatar>
                        <Badge
                          variant={
                            participant.audioEnabled ? "default" : "destructive"
                          }
                          className="mb-2"
                        >
                          {participant.audioEnabled ? (
                            <Mic className="h-3 w-3 mr-1" />
                          ) : (
                            <MicOff className="h-3 w-3 mr-1" />
                          )}
                          {participant.audioEnabled ? "Speaking" : "Muted"}
                        </Badge>
                        <p className="font-medium">{participant.displayName}</p>
                      </div>
                    ))}
                  </div>
                  <p className="text-2xl font-light mb-2">
                    Audio Call in Progress
                  </p>
                  <p className="text-lg opacity-75">
                    {formatDuration(callDuration)}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Bottom control panel */}
          <div
            className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent p-6 transition-opacity duration-300 ${
              showControls ? "opacity-100" : "opacity-0"
            }`}
          >
            <div className="flex items-center justify-between">
              {/* Left controls */}
              <div className="flex items-center gap-3">
                {/* Professional screen sharing controls */}
                <ScreenShareControls
                  isScreenSharing={isScreenSharing}
                  remoteIsScreenSharing={remoteIsScreenSharing}
                  screenShareError={screenShareError}
                  remoteUserName={remoteUserInfo?.name}
                  onStartScreenShare={startScreenShare}
                  onStopScreenShare={stopScreenShare}
                />

                {/* Volume control */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-white hover:bg-white/20"
                    >
                      {volume[0] > 0 ? (
                        <Volume2 className="h-5 w-5" />
                      ) : (
                        <VolumeX className="h-5 w-5" />
                      )}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-48">
                    <div className="p-3">
                      <p className="text-sm font-medium mb-2">Volume</p>
                      <Slider
                        value={volume}
                        onValueChange={setVolume}
                        max={100}
                        step={1}
                        className="w-full"
                      />
                    </div>
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* View mode toggle */}
                {callType === "video" && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-white hover:bg-white/20"
                    onClick={() =>
                      setViewMode(
                        viewMode === "speaker" ? "gallery" : "speaker"
                      )
                    }
                  >
                    {viewMode === "speaker" ? (
                      <Grid3X3 className="h-5 w-5" />
                    ) : (
                      <Users className="h-5 w-5" />
                    )}
                  </Button>
                )}
              </div>

              {/* Center controls */}
              <div className="flex items-center gap-4">
                {/* Microphone */}
                <Button
                  variant={localAudioEnabled ? "secondary" : "destructive"}
                  size="lg"
                  className="rounded-full h-12 w-12"
                  onClick={toggleMute}
                >
                  {localAudioEnabled ? (
                    <Mic className="h-5 w-5" />
                  ) : (
                    <MicOff className="h-5 w-5" />
                  )}
                </Button>

                {/* Screen sharing */}
                <Button
                  variant={isScreenSharing ? "default" : "secondary"}
                  size="lg"
                  className={`rounded-full h-12 w-12 ${
                    isScreenSharing
                      ? "bg-green-600 hover:bg-green-700 text-white"
                      : ""
                  }`}
                  onClick={isScreenSharing ? stopScreenShare : startScreenShare}
                  title={
                    isScreenSharing ? "Stop sharing screen" : "Share screen"
                  }
                >
                  <Monitor className="h-5 w-5" />
                </Button>

                {/* End call */}
                <Button
                  variant="destructive"
                  size="lg"
                  className="rounded-full h-14 w-14 bg-red-600 hover:bg-red-700"
                  onClick={endCall}
                >
                  <PhoneOff className="h-6 w-6" />
                </Button>

                {/* Video toggle */}
                {callType === "video" && (
                  <Button
                    variant={localVideoEnabled ? "secondary" : "destructive"}
                    size="lg"
                    className="rounded-full h-12 w-12"
                    onClick={toggleVideo}
                  >
                    {localVideoEnabled ? (
                      <Video className="h-5 w-5" />
                    ) : (
                      <VideoOff className="h-5 w-5" />
                    )}
                  </Button>
                )}
              </div>

              {/* Right controls */}
              <div className="flex items-center gap-3">
                {/* More options */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-white hover:bg-white/20"
                    >
                      <MoreVertical className="h-5 w-5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onClick={() => setIsRecording(!isRecording)}
                    >
                      {isRecording ? (
                        <Pause className="h-4 w-4 mr-2" />
                      ) : (
                        <Circle className="h-4 w-4 mr-2 fill-current" />
                      )}
                      {isRecording ? "Stop Recording" : "Start Recording"}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={
                        isScreenSharing ? stopScreenShare : startScreenShare
                      }
                      disabled={!!screenShareError}
                    >
                      <Monitor className="h-4 w-4 mr-2" />
                      {isScreenSharing ? "Stop Screen Share" : "Share Screen"}
                    </DropdownMenuItem>
                    {screenShareError && (
                      <DropdownMenuItem disabled className="text-red-400">
                        <X className="h-4 w-4 mr-2" />
                        {screenShareError}
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem>
                      <MessageCircle className="h-4 w-4 mr-2" />
                      Open Chat
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem>
                      <Settings className="h-4 w-4 mr-2" />
                      Settings
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

// Enhanced call UI wrapper
export default function CallUI() {
  return (
    <>
      <IncomingCallDialog />
      <OutgoingCallDialog />
      <ActiveCallUI />
    </>
  );
}
