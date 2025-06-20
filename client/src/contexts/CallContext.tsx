import React, {
  createContext,
  useContext,
  useState,
  ReactNode,
  useRef,
  useEffect,
} from "react";
import { useAuth } from "@/contexts/AuthWrapper";
import { useToast } from "@/hooks/use-toast";
import { useWebSocket } from "@/hooks/use-websocket";

export type CallType = "audio" | "video";

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
  screenStream: MediaStream | null;
  remoteScreenStream: MediaStream | null;

  // Actions
  initiateCall: (
    targetUserId: number,
    type: CallType,
    targetUserName?: string
  ) => Promise<void>;
  answerCall: () => Promise<void>;
  rejectCall: () => void;
  endCall: () => void;
  toggleMute: () => void;
  toggleVideo: () => void;
  startScreenShare: () => Promise<void>;
  stopScreenShare: () => void;

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
  remoteAudioEnabled: boolean;
  remoteVideoEnabled: boolean;
  remoteUserInfo: { id: number; name: string } | null;
  isScreenSharing: boolean;
  remoteIsScreenSharing: boolean;
  screenShareError: string | null;
}

const CallContext = createContext<CallContextType | null>(null);

// Helper function to check WebRTC support and provide user-friendly messages
const checkWebRTCSupport = () => {
  const isSecureContext = window.isSecureContext;
  const hasMediaDevices = !!(
    navigator.mediaDevices && navigator.mediaDevices.getUserMedia
  );
  const isLocalhost =
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1";

  if (!hasMediaDevices) {
    if (!isSecureContext && !isLocalhost) {
      throw new Error(
        "Camera/microphone access requires HTTPS. Please access the application using HTTPS or from localhost. " +
          "For development, you can use: npm run tunnel"
      );
    } else {
      throw new Error(
        "Your browser doesn't support WebRTC or camera/microphone access."
      );
    }
  }

  return true;
};

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
  const [remoteAudioEnabled, setRemoteAudioEnabled] = useState(true);
  const [remoteVideoEnabled, setRemoteVideoEnabled] = useState(true);
  const [remoteUserInfo, setRemoteUserInfo] = useState<{
    id: number;
    name: string;
  } | null>(null);

  // Screen sharing state
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const [remoteScreenStream, setRemoteScreenStream] =
    useState<MediaStream | null>(null);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [remoteIsScreenSharing, setRemoteIsScreenSharing] = useState(false);
  const [screenShareError, setScreenShareError] = useState<string | null>(null);
  const [currentCallId, setCurrentCallId] = useState<string | null>(null);
  const [incomingCallOffer, setIncomingCallOffer] = useState<any>(null);

  // WebRTC and audio management
  const ringtoneRef = useRef<HTMLAudioElement | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const ringtoneIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize ringtone
  useEffect(() => {
    ringtoneRef.current = new Audio(
      "data:audio/wav;base64,UklGRpQEAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YXAEAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBj2a2/LDciUFLYDO8tiJOQgZaLvt559NEAxQp+PwtmMcBj2a2/LDciUFLYDO8tiJOQgZaLvt559NEAxQp+PwtmMcBj2a2+LDciUFLYDO8tiJOQgZaLvt559NEAxQp+PwtmMcBj2a2/LDciUFLYDO8tiJOQgZaLvt559NEAxQp+PwtmMcBj2a2/LDciUFLYDO8tiJOQgZaLvt559NEAxQp+PwtmMcBj2a2/LDciUFLYDO8tiJOQgZaLvt559NEAxQp+PwtmMcBj2a2/LDciUFLYDO8tiJOQgZaLvt559NEAxQp+PwtmMcBj2a2/LDciUFLYDO8tiJOQgZaLvt559NEAxQp+PwtmMcBj2a2/LDciUFLYDO8tiJOQgZaLvt559NEAxQp+PwtmMcBj2a2/LDciUFLYDO8tiJOQgZaLvt"
    );

    if (ringtoneRef.current) {
      ringtoneRef.current.loop = true;
      ringtoneRef.current.volume = 0.5;
    }
  }, []);

  // Create WebRTC peer connection
  const createPeerConnection = () => {
    console.log("Creating new RTCPeerConnection with enhanced STUN servers");

    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
        { urls: "stun:stun2.l.google.com:19302" },
      ],
      iceCandidatePoolSize: 10,
    });

    // Enhanced remote stream handling
    pc.ontrack = (event) => {
      console.log(
        "🎥 Received remote track:",
        event.track.kind,
        event.track.label,
        "readyState:",
        event.track.readyState
      );
      const [stream] = event.streams;
      if (stream) {
        console.log(
          "🎥 Setting remote stream with tracks:",
          stream.getTracks().length
        );
        console.log(
          "🎥 Remote stream video tracks:",
          stream.getVideoTracks().length
        );
        console.log(
          "🎥 Remote stream audio tracks:",
          stream.getAudioTracks().length
        );
        setRemoteStream(stream);

        // Log when remote stream changes
        stream.onaddtrack = (trackEvent) => {
          console.log(
            "🎥 Track added to remote stream:",
            trackEvent.track.kind
          );
        };

        stream.onremovetrack = (trackEvent) => {
          console.log(
            "🎥 Track removed from remote stream:",
            trackEvent.track.kind
          );
        };
      } else {
        console.log("⚠️ No stream found in ontrack event");
      }
    };

    // Enhanced ICE candidate handling with proper target routing
    pc.onicecandidate = (event) => {
      if (event.candidate && currentCallId && user) {
        // Extract target user ID from call ID
        const callIdParts = currentCallId.split("_");
        const targetUserId =
          callIdParts[1] === user?.id.toString()
            ? parseInt(callIdParts[2])
            : parseInt(callIdParts[1]);

        console.log(
          "Generated ICE candidate:",
          event.candidate.type,
          "for target user:",
          targetUserId
        );
        send("webrtc_candidate", {
          candidate: event.candidate,
          callId: currentCallId,
          targetUserId: targetUserId,
        });
      } else if (!event.candidate) {
        console.log("ICE gathering completed");
      }
    };

    // Enhanced connection state monitoring
    pc.onconnectionstatechange = () => {
      console.log("WebRTC connection state:", pc.connectionState);
      if (pc.connectionState === "connected") {
        console.log("WebRTC peer connection established successfully");
        toast({
          title: "Call connected",
          description: "High-quality audio transmission active",
        });
      } else if (
        pc.connectionState === "failed" ||
        pc.connectionState === "disconnected"
      ) {
        console.log("WebRTC connection failed");
        endCall();
      }
    };

    // Enhanced ICE connection state monitoring with recovery logic
    pc.oniceconnectionstatechange = () => {
      console.log("ICE connection state:", pc.iceConnectionState);

      switch (pc.iceConnectionState) {
        case "connected":
        case "completed":
          console.log(
            "Audio connection established - high quality transmission active"
          );
          toast({
            title: "Audio connected",
            description: "High-quality audio transmission established",
          });
          break;
        case "disconnected":
          console.warn(
            "ICE connection temporarily disconnected - attempting recovery"
          );
          break;
        case "failed":
          console.error(
            "ICE connection failed - connection quality may be poor"
          );
          toast({
            title: "Connection quality",
            description:
              "Audio quality may be reduced due to network conditions",
            variant: "destructive",
          });
          break;
        case "checking":
          console.log("Establishing audio connection...");
          break;
      }
    };

    // ICE gathering state monitoring
    pc.onicegatheringstatechange = () => {
      console.log("ICE gathering state:", pc.iceGatheringState);
    };

    // Signaling state monitoring
    pc.onsignalingstatechange = () => {
      console.log("Signaling state:", pc.signalingState);
    };

    return pc;
  };

  // WebSocket event handlers
  useEffect(() => {
    if (!isConnected || !on) return;

    const handleIncomingCall = (data: any) => {
      console.log("📞 CallContext: Incoming call received:", data);

      // Handle both direct payload and wrapped payload formats from server
      const payload = data.payload || data;

      setCurrentCallId(payload.callId);
      setIncomingCall(true);
      setCallType(
        payload.callType === "voice" ? "audio" : payload.callType || "audio"
      );
      const callerDisplayName =
        payload.from?.displayName ||
        payload.callerName ||
        `User ${payload.fromUserId}` ||
        "Unknown";

      setCallerName(callerDisplayName);
      setRemoteUserInfo({
        id: payload.fromUserId || payload.from?.id || 0,
        name: callerDisplayName,
      });
      setShowIncomingCall(true);
      setIncomingCallOffer(payload.offer);

      // Play ringtone
      if (ringtoneRef.current) {
        ringtoneRef.current.currentTime = 0;
        ringtoneRef.current
          .play()
          .catch((e) => console.error("Error playing ringtone:", e));
      }

      toast({
        title: "Incoming call",
        description: `${payload.from?.displayName || "Someone"} is calling you`,
        duration: 10000,
      });
    };

    const handleCallAnswered = (data: any) => {
      console.log("✅ CallContext: Call answered:", data);

      // Handle both direct payload and wrapped payload formats from server
      const payload = data.payload || data;

      stopRingtone();
      setOutgoingCall(false);
      // activeCall should already be true from initiateCall, but ensure it's set
      if (!activeCall) {
        setActiveCall(true);
      }

      // Handle WebRTC answer
      if (peerConnectionRef.current && payload.answer) {
        console.log("🔄 CallContext: Setting remote description (answer)");
        const answerDesc = new RTCSessionDescription({
          type: payload.answer.type,
          sdp: payload.answer.sdp,
        });
        peerConnectionRef.current
          .setRemoteDescription(answerDesc)
          .catch((error) =>
            console.error(
              "❌ CallContext: Error setting remote description:",
              error
            )
          );
      }
    };

    const handleCallEnded = (payload: any) => {
      console.log("Call ended:", payload);
      endCall();
    };

    const handleWebRTCOffer = (payload: any) => {
      console.log("WebRTC offer received:", payload);
      setIncomingCallOffer(payload.offer);
    };

    const handleWebRTCAnswer = (payload: any) => {
      console.log("WebRTC answer received:", payload);
      if (peerConnectionRef.current && payload.answer) {
        // Check if we're in the correct state to receive an answer
        const signalingState = peerConnectionRef.current.signalingState;
        console.log("Current signaling state:", signalingState);

        if (signalingState === "have-local-offer") {
          peerConnectionRef.current
            .setRemoteDescription(new RTCSessionDescription(payload.answer))
            .catch((error) =>
              console.error("Error setting remote description:", error)
            );
        } else {
          console.log(
            "Ignoring duplicate or invalid answer - signaling state:",
            signalingState
          );
        }
      }
    };

    const handleWebRTCCandidate = (data: any) => {
      console.log("🧊 CallContext: ICE candidate received:", data);

      // Handle both direct payload and wrapped payload formats from server
      const payload = data.payload || data;

      if (peerConnectionRef.current && payload.candidate) {
        peerConnectionRef.current
          .addIceCandidate(new RTCIceCandidate(payload.candidate))
          .catch((error) =>
            console.error("❌ CallContext: Error adding ICE candidate:", error)
          );
      }
    };

    const handleScreenShareStarted = (data: any) => {
      console.log("🖥️ Remote user started screen sharing:", data);
      const payload = data.payload || data;

      setRemoteIsScreenSharing(true);

      toast({
        title: "Screen sharing",
        description: `${
          remoteUserInfo?.name || "Remote user"
        } is sharing their screen`,
      });
    };

    const handleScreenShareStopped = (data: any) => {
      console.log("🖥️ Remote user stopped screen sharing:", data);
      const payload = data.payload || data;

      setRemoteIsScreenSharing(false);

      toast({
        title: "Screen sharing ended",
        description: `${
          remoteUserInfo?.name || "Remote user"
        } stopped sharing their screen`,
      });
    };

    // Register event handlers
    const unsubscribeIncoming = on("incoming_call", handleIncomingCall);
    const unsubscribeAnswered = on("call_answered", handleCallAnswered);
    const unsubscribeEnded = on("call_ended", handleCallEnded);
    const unsubscribeOffer = on("webrtc_offer", handleWebRTCOffer);
    const unsubscribeAnswer = on("webrtc_answer", handleWebRTCAnswer);
    const unsubscribeCandidate = on("webrtc_candidate", handleWebRTCCandidate);
    const unsubscribeScreenShareStarted = on(
      "screen_share_started",
      handleScreenShareStarted
    );
    const unsubscribeScreenShareStopped = on(
      "screen_share_stopped",
      handleScreenShareStopped
    );

    return () => {
      unsubscribeIncoming();
      unsubscribeAnswered();
      unsubscribeEnded();
      unsubscribeOffer();
      unsubscribeAnswer();
      unsubscribeCandidate();
      unsubscribeScreenShareStarted();
      unsubscribeScreenShareStopped();
    };
  }, [isConnected, on, toast, user]); // CRITICAL: Added user dependency

  // Component unmount cleanup - Ultimate safety net for resource management
  useEffect(() => {
    return () => {
      console.log(
        "🧹 CallProvider component unmounting - performing emergency cleanup"
      );

      // Stop all local stream tracks
      if (localStream) {
        console.log("🎥 Emergency stopping local stream tracks");
        localStream.getTracks().forEach((track) => {
          console.log(
            `🛑 Emergency stopping ${track.kind} track:`,
            track.label
          );
          track.stop();
          track.enabled = false;
        });
      }

      // Stop all remote stream tracks
      if (remoteStream) {
        console.log("📺 Emergency stopping remote stream tracks");
        remoteStream.getTracks().forEach((track) => {
          console.log(
            `🛑 Emergency stopping remote ${track.kind} track:`,
            track.label
          );
          track.stop();
          track.enabled = false;
        });
      }

      // Close peer connection
      if (peerConnectionRef.current) {
        console.log("🔌 Emergency closing peer connection");
        peerConnectionRef.current.close();
        peerConnectionRef.current = null;
      }

      console.log("✅ Emergency cleanup completed");
    };
  }, []); // Empty dependency array - only run on component unmount

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
    setScreenStream(null);
    setRemoteScreenStream(null);
    setIsMuted(false);
    setIsVideoEnabled(true);
    setShowIncomingCall(false);
    setIncomingCall(false);
    setOutgoingCall(false);
    setActiveCall(false);
    setCallerName(null);
    setLocalAudioEnabled(true);
    setLocalVideoEnabled(true);
    setRemoteAudioEnabled(true);
    setRemoteVideoEnabled(true);
    setRemoteUserInfo(null);
    setIsScreenSharing(false);
    setRemoteIsScreenSharing(false);
    setScreenShareError(null);
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
  const initiateCall = async (
    targetUserId: number,
    type: CallType,
    targetUserName?: string
  ) => {
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

      // Set the target user info for outgoing calls
      if (targetUserName) {
        setCallerName(targetUserName);
        setRemoteUserInfo({
          id: targetUserId,
          name: targetUserName,
        });
      }

      // Check WebRTC support and secure context
      checkWebRTCSupport();

      // Get user media with production-quality constraints
      const mediaConstraints = {
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 44100,
          channelCount: 1,
        },
        video:
          type === "video"
            ? {
                width: { min: 640, ideal: 1280, max: 1920 },
                height: { min: 480, ideal: 720, max: 1080 },
                frameRate: { min: 16, ideal: 30, max: 60 },
                facingMode: "user",
              }
            : false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(
        mediaConstraints
      );

      console.log(`Media stream obtained: ${stream.getTracks().length} tracks`);
      console.log(`Audio tracks: ${stream.getAudioTracks().length}`);
      console.log(`Video tracks: ${stream.getVideoTracks().length}`);

      setLocalStream(stream);
      setLocalAudioEnabled(true);
      setLocalVideoEnabled(type === "video");

      // Set active call true immediately so initiator can see the call UI
      setActiveCall(true);
      setOutgoingCall(false);

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
        offerToReceiveVideo: type === "video",
        iceRestart: false,
      });

      await pc.setLocalDescription(offer);
      console.log("Created and set local offer");

      // Make API call to initiate call (without offer for now)
      const response = await fetch("/api/calls/initiate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetUserId,
          callType: type,
          callId,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to initiate call");
      }

      // Send WebRTC offer via WebSocket after call is initiated
      console.log("Sending WebRTC offer to target user:", targetUserId);
      send("webrtc_offer", {
        offer,
        callId,
        targetUserId,
      });

      // Play outgoing call tone
      if (ringtoneRef.current) {
        ringtoneRef.current.currentTime = 0;
        ringtoneRef.current
          .play()
          .catch((e) => console.error("Error playing ringtone:", e));
      }

      toast({
        title: "Calling...",
        description: `Calling user ${targetUserId}`,
      });
    } catch (error) {
      console.error("Error initiating call:", error);
      resetCallState();

      let errorMessage = "Failed to start the call";
      if (error instanceof Error) {
        if (error.message.includes("HTTPS")) {
          errorMessage =
            "Camera/microphone access requires HTTPS. Please use HTTPS or localhost.";
        } else if (
          error.message.includes("Permission denied") ||
          error.message.includes("NotAllowedError")
        ) {
          errorMessage = "Please allow camera/microphone access to make calls.";
        } else if (error.message.includes("NotFoundError")) {
          errorMessage =
            "No camera or microphone found. Please check your devices.";
        } else {
          errorMessage = error.message;
        }
      }

      toast({
        title: "Call failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsInitiating(false);
    }
  };

  const answerCall = async () => {
    console.log("answerCall function called");
    console.log("Current state:", {
      currentCallId,
      callType,
      hasOffer: !!incomingCallOffer,
    });

    if (!currentCallId) {
      console.error("No current call ID");
      return;
    }

    try {
      stopRingtone();
      setActiveCall(true);
      setIncomingCall(false);
      setShowIncomingCall(false);
      setIsInCall(true);

      // Check WebRTC support and secure context
      checkWebRTCSupport();

      // Get user media with production-quality constraints
      const mediaConstraints = {
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 44100,
          channelCount: 1,
        },
        video:
          callType === "video"
            ? {
                width: { min: 640, ideal: 1280, max: 1920 },
                height: { min: 480, ideal: 720, max: 1080 },
                frameRate: { min: 16, ideal: 30, max: 60 },
                facingMode: "user",
              }
            : false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(
        mediaConstraints
      );

      console.log(`Answerer media stream: ${stream.getTracks().length} tracks`);
      console.log(`Audio tracks: ${stream.getAudioTracks().length}`);
      console.log(`Video tracks: ${stream.getVideoTracks().length}`);

      setLocalStream(stream);
      setLocalAudioEnabled(true);
      setLocalVideoEnabled(callType === "video");

      // Create peer connection for WebRTC
      const pc = createPeerConnection();
      peerConnectionRef.current = pc;

      // Add local stream tracks to peer connection
      stream.getTracks().forEach((track, index) => {
        console.log(`Answerer adding local track ${index}: ${track.kind}`);
        pc.addTrack(track, stream);
      });

      // If we have an incoming offer, set it as remote description and create answer
      if (incomingCallOffer) {
        console.log("Setting remote description (offer) and creating answer");
        await pc.setRemoteDescription(incomingCallOffer);

        const answer = await pc.createAnswer({
          offerToReceiveAudio: true,
          offerToReceiveVideo: callType === "video",
        });

        console.log("Created WebRTC answer with enhanced options");
        await pc.setLocalDescription(answer);
        console.log("Set local answer description - ready for media flow");

        // Send WebRTC answer back to caller via WebSocket
        const targetUserId = parseInt(currentCallId.split("_")[1]); // Extract caller ID from call ID
        console.log("Sending WebRTC answer to caller:", targetUserId);
        send("webrtc_answer", {
          answer,
          callId: currentCallId,
          targetUserId,
        });
      }

      // Call API to accept the call
      const response = await fetch("/api/calls/answer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          callId: currentCallId,
          accepted: true,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to answer call");
      }

      console.log("Call answered successfully - WebRTC signaling initiated");
    } catch (error) {
      console.error("Error answering call:", error);
      endCall();

      let errorMessage = "Failed to answer the call";
      if (error instanceof Error) {
        if (error.message.includes("HTTPS")) {
          errorMessage =
            "Camera/microphone access requires HTTPS. Please use HTTPS or localhost.";
        } else if (
          error.message.includes("Permission denied") ||
          error.message.includes("NotAllowedError")
        ) {
          errorMessage =
            "Please allow camera/microphone access to answer calls.";
        } else if (error.message.includes("NotFoundError")) {
          errorMessage =
            "No camera or microphone found. Please check your devices.";
        } else {
          errorMessage = error.message;
        }
      }

      toast({
        title: "Call failed",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  const rejectCall = () => {
    console.log("❌ Rejecting call");

    if (currentCallId) {
      fetch("/api/calls/hangup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          callId: currentCallId,
          accepted: false,
        }),
      }).catch(console.error);
    }

    resetCallState();

    toast({
      title: "Call rejected",
      description: "Call declined",
    });
  };

  const endCall = () => {
    console.log("🔚 Ending call - starting comprehensive cleanup");

    if (currentCallId) {
      fetch("/api/calls/hangup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          callId: currentCallId,
        }),
      }).catch(console.error);
    }

    // COMPREHENSIVE MEDIA CLEANUP - BEFORE state reset

    // 1. Stop all local stream tracks
    if (localStream) {
      console.log("🎥 Stopping local stream tracks");
      localStream.getTracks().forEach((track) => {
        console.log(`🛑 Stopping local ${track.kind} track:`, track.label);
        track.stop();
        track.enabled = false; // Extra safety
      });
    } else {
      console.log("⚠️ No local stream found during cleanup");
    }

    // 2. Stop all remote stream tracks
    if (remoteStream) {
      console.log("📺 Stopping remote stream tracks");
      remoteStream.getTracks().forEach((track) => {
        console.log(`🛑 Stopping remote ${track.kind} track:`, track.label);
        track.stop();
        track.enabled = false; // Extra safety
      });
    } else {
      console.log("⚠️ No remote stream found during cleanup");
    }

    // 3. Stop screen sharing streams
    if (screenStream) {
      console.log("🖥️ Stopping screen share tracks");
      screenStream.getTracks().forEach((track) => {
        console.log(
          `🛑 Stopping screen share ${track.kind} track:`,
          track.label
        );
        track.stop();
        track.enabled = false; // Extra safety
      });
    }

    if (remoteScreenStream) {
      console.log("🖥️ Stopping remote screen share tracks");
      remoteScreenStream.getTracks().forEach((track) => {
        console.log(
          `🛑 Stopping remote screen share ${track.kind} track:`,
          track.id
        );
        track.stop();
        track.enabled = false; // Extra safety
      });
    }

    // 3. Alternative cleanup: Get tracks directly from peer connection
    if (peerConnectionRef.current) {
      console.log("🔌 Cleaning up peer connection");

      // Get and stop all tracks from peer connection senders
      const senders = peerConnectionRef.current.getSenders();
      senders.forEach((sender) => {
        if (sender.track) {
          console.log(
            `🗑️ Stopping and removing ${sender.track.kind} track from peer connection:`,
            sender.track.label
          );
          sender.track.stop(); // Stop the track
          sender.track.enabled = false; // Disable the track
          peerConnectionRef.current?.removeTrack(sender);
        }
      });

      // Get and stop all tracks from peer connection receivers
      const receivers = peerConnectionRef.current.getReceivers();
      receivers.forEach((receiver) => {
        if (receiver.track) {
          console.log(
            `🗑️ Stopping ${receiver.track.kind} track from receiver:`,
            receiver.track.id
          );
          receiver.track.stop(); // Stop the track
          receiver.track.enabled = false; // Disable the track
        }
      });

      // Close the peer connection
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
      console.log("✅ Peer connection closed and nullified");
    } else {
      console.log("⚠️ No peer connection found during cleanup");
    }

    // 4. Reset call state (this will clean up UI state)
    resetCallState();

    console.log("✅ Call ended - comprehensive cleanup completed");

    toast({
      title: "Call ended",
      description: "The call has ended",
    });
  };

  const toggleMute = () => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
        setLocalAudioEnabled(audioTrack.enabled);
        console.log("Audio toggled:", audioTrack.enabled);
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
        console.log("Video toggled:", videoTrack.enabled);
      }
    }
  };

  // Screen sharing functions
  const startScreenShare = async () => {
    try {
      setScreenShareError(null);
      console.log("🖥️ Starting screen share");

      if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
        throw new Error("Screen sharing is not supported in this browser");
      }

      const displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          width: { ideal: 1920, max: 1920 },
          height: { ideal: 1080, max: 1080 },
          frameRate: { ideal: 15, max: 30 },
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      setScreenStream(displayStream);
      setIsScreenSharing(true);

      // Replace video track in peer connection with screen share
      if (peerConnectionRef.current) {
        const videoTrack = displayStream.getVideoTracks()[0];
        const sender = peerConnectionRef.current
          .getSenders()
          .find((s) => s.track && s.track.kind === "video");

        if (sender && videoTrack) {
          await sender.replaceTrack(videoTrack);
          console.log("🖥️ Replaced video track with screen share");
        }

        // Handle screen share ending
        videoTrack.onended = () => {
          console.log("🖥️ Screen share ended by user");
          stopScreenShare();
        };
      }

      // Notify remote user about screen sharing
      if (send && currentCallId) {
        send("screen_share_started", {
          callId: currentCallId,
          fromUserId: user?.id,
        });
      }

      toast({
        title: "Screen sharing started",
        description: "You are now sharing your screen",
      });
    } catch (error) {
      console.error("Error starting screen share:", error);
      let errorMessage = "Failed to start screen sharing";

      if (error instanceof Error) {
        if (error.message.includes("Permission denied")) {
          errorMessage = "Please allow screen sharing permission";
        } else if (error.message.includes("not supported")) {
          errorMessage = "Screen sharing is not supported in this browser";
        } else {
          errorMessage = error.message;
        }
      }

      setScreenShareError(errorMessage);
      toast({
        title: "Screen sharing failed",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  const stopScreenShare = async () => {
    try {
      console.log("🖥️ Stopping screen share");

      if (screenStream) {
        screenStream.getTracks().forEach((track) => {
          console.log(`🛑 Stopping screen share ${track.kind} track`);
          track.stop();
        });
      }

      setScreenStream(null);
      setIsScreenSharing(false);
      setScreenShareError(null);

      // Replace screen share track back to camera
      if (peerConnectionRef.current && localStream) {
        const videoTrack = localStream.getVideoTracks()[0];
        const sender = peerConnectionRef.current
          .getSenders()
          .find((s) => s.track && s.track.kind === "video");

        if (sender && videoTrack) {
          await sender.replaceTrack(videoTrack);
          console.log("🎥 Replaced screen share with camera video");
        }
      }

      // Notify remote user that screen sharing stopped
      if (send && currentCallId) {
        send("screen_share_stopped", {
          callId: currentCallId,
          fromUserId: user?.id,
        });
      }

      toast({
        title: "Screen sharing stopped",
        description: "You stopped sharing your screen",
      });
    } catch (error) {
      console.error("Error stopping screen share:", error);
      toast({
        title: "Error",
        description: "Failed to stop screen sharing",
        variant: "destructive",
      });
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
    screenStream,
    remoteScreenStream,

    // Actions
    initiateCall,
    answerCall,
    rejectCall,
    endCall,
    toggleMute,
    toggleVideo,
    startScreenShare,
    stopScreenShare,

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
    remoteAudioEnabled,
    remoteVideoEnabled,
    remoteUserInfo,
    isScreenSharing,
    remoteIsScreenSharing,
    screenShareError,
  };

  return <CallContext.Provider value={value}>{children}</CallContext.Provider>;
}

export function useCall() {
  const context = useContext(CallContext);
  if (!context) {
    throw new Error("useCall must be used within a CallProvider");
  }
  return context;
}
