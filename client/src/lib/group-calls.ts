/**
 * Group Video Call System
 * Supports multi-party video calls, meeting management, and advanced calling features
 */

export interface CallParticipant {
  userId: number;
  username: string;
  displayName: string;
  stream?: MediaStream;
  audioEnabled: boolean;
  videoEnabled: boolean;
  isScreenSharing: boolean;
  connectionState: RTCPeerConnectionState;
  joinedAt: Date;
  isModerator: boolean;
  isPresenting: boolean;
}

export interface GroupCall {
  id: string;
  roomId: string;
  title: string;
  description?: string;
  hostId: number;
  participants: Map<number, CallParticipant>;
  startTime: Date;
  endTime?: Date;
  isRecording: boolean;
  recordingUrl?: string;
  meetingType: "video" | "audio" | "screen_share";
  maxParticipants: number;
  isLocked: boolean;
  waitingRoom: boolean;
  settings: GroupCallSettings;
}

export interface GroupCallSettings {
  allowParticipantVideo: boolean;
  allowParticipantAudio: boolean;
  allowParticipantScreenShare: boolean;
  allowParticipantChat: boolean;
  muteParticipantsOnJoin: boolean;
  requireModeratorApproval: boolean;
  recordingEnabled: boolean;
  transcriptionEnabled: boolean;
  backgroundBlurEnabled: boolean;
  virtualBackgroundsEnabled: boolean;
}

export interface WaitingRoomParticipant {
  userId: number;
  displayName: string;
  joinRequestTime: Date;
  approved: boolean;
}

export interface CallInvitation {
  callId: string;
  invitedBy: number;
  invitedUsers: number[];
  scheduledTime?: Date;
  recurring?: RecurrencePattern;
  calendarEvent?: CalendarEventData;
}

export interface RecurrencePattern {
  frequency: "daily" | "weekly" | "monthly";
  interval: number;
  daysOfWeek?: number[];
  endDate?: Date;
  occurrences?: number;
}

export interface CalendarEventData {
  title: string;
  description: string;
  startTime: Date;
  endTime: Date;
  timeZone: string;
  location?: string;
  attendees: string[];
}

class GroupCallManager {
  private peerConnections: Map<number, RTCPeerConnection> = new Map();
  private localStream: MediaStream | null = null;
  private screenStream: MediaStream | null = null;
  private currentCall: GroupCall | null = null;
  private socket: WebSocket | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private recordingChunks: Blob[] = [];
  private waitingRoomParticipants: Map<number, WaitingRoomParticipant> =
    new Map();

  private readonly iceServers = [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" },
  ];

  /**
   * Create a new group call
   */
  async createCall(callData: {
    title: string;
    description?: string;
    participants: number[];
    settings: Partial<GroupCallSettings>;
    scheduledTime?: Date;
    recurring?: RecurrencePattern;
  }): Promise<GroupCall> {
    const callId = this.generateCallId();
    const roomId = this.generateRoomId();

    const defaultSettings: GroupCallSettings = {
      allowParticipantVideo: true,
      allowParticipantAudio: true,
      allowParticipantScreenShare: true,
      allowParticipantChat: true,
      muteParticipantsOnJoin: false,
      requireModeratorApproval: false,
      recordingEnabled: true,
      transcriptionEnabled: false,
      backgroundBlurEnabled: true,
      virtualBackgroundsEnabled: true,
    };

    const call: GroupCall = {
      id: callId,
      roomId,
      title: callData.title,
      description: callData.description,
      hostId: this.getCurrentUserId(),
      participants: new Map(),
      startTime: callData.scheduledTime || new Date(),
      isRecording: false,
      meetingType: "video",
      maxParticipants: 50,
      isLocked: false,
      waitingRoom: false,
      settings: { ...defaultSettings, ...callData.settings },
    };

    // Send invitations
    await this.sendInvitations({
      callId,
      invitedBy: this.getCurrentUserId(),
      invitedUsers: callData.participants,
      scheduledTime: callData.scheduledTime,
      recurring: callData.recurring,
    });

    // Store call information
    await this.storeCallData(call);

    return call;
  }

  /**
   * Join an existing group call
   */
  async joinCall(callId: string, userId: number): Promise<void> {
    try {
      // Get call information
      const call = await this.getCallData(callId);
      if (!call) {
        throw new Error("Call not found");
      }

      this.currentCall = call;

      // Check if call is locked or requires approval
      if (call.isLocked || call.settings.requireModeratorApproval) {
        await this.requestJoinApproval(callId, userId);
        return;
      }

      // Initialize media streams
      await this.initializeLocalMedia();

      // Connect to signaling server
      await this.connectToSignalingServer(callId);

      // Add participant to call
      const participant: CallParticipant = {
        userId,
        username: await this.getUserUsername(userId),
        displayName: await this.getUserDisplayName(userId),
        stream: this.localStream || undefined,
        audioEnabled: !call.settings.muteParticipantsOnJoin,
        videoEnabled: true,
        isScreenSharing: false,
        connectionState: "connecting",
        joinedAt: new Date(),
        isModerator: userId === call.hostId,
        isPresenting: false,
      };

      call.participants.set(userId, participant);

      // Notify other participants
      this.broadcastToCall("participant_joined", { participant });

      // Setup peer connections with existing participants
      for (const [participantId] of call.participants) {
        if (participantId !== userId) {
          await this.createPeerConnection(participantId);
        }
      }
    } catch (error) {
      console.error("Failed to join call:", error);
      throw error;
    }
  }

  /**
   * Leave the current call
   */
  async leaveCall(): Promise<void> {
    if (!this.currentCall) return;

    try {
      // Stop local streams
      if (this.localStream) {
        this.localStream.getTracks().forEach((track) => track.stop());
        this.localStream = null;
      }

      if (this.screenStream) {
        this.screenStream.getTracks().forEach((track) => track.stop());
        this.screenStream = null;
      }

      // Stop recording if active
      if (this.mediaRecorder && this.mediaRecorder.state === "recording") {
        await this.stopRecording();
      }

      // Close all peer connections
      this.peerConnections.forEach((pc) => pc.close());
      this.peerConnections.clear();

      // Remove from participants
      const userId = this.getCurrentUserId();
      this.currentCall.participants.delete(userId);

      // Notify other participants
      this.broadcastToCall("participant_left", { userId });

      // Disconnect from signaling server
      if (this.socket) {
        this.socket.close();
        this.socket = null;
      }

      this.currentCall = null;
    } catch (error) {
      console.error("Error leaving call:", error);
    }
  }

  /**
   * Start screen sharing
   */
  async startScreenShare(): Promise<void> {
    if (!this.currentCall) throw new Error("No active call");

    try {
      this.screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          cursor: "always",
          displaySurface: "monitor",
          width: { ideal: 1920, max: 1920 },
          height: { ideal: 1080, max: 1080 },
          frameRate: { ideal: 30, max: 60 },
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      // Replace video track in all peer connections
      const videoTrack = this.screenStream.getVideoTracks()[0];

      for (const [participantId, pc] of this.peerConnections) {
        const sender = pc.getSenders().find((s) => s.track?.kind === "video");
        if (sender) {
          await sender.replaceTrack(videoTrack);
        }
      }

      // Update participant status
      const userId = this.getCurrentUserId();
      const participant = this.currentCall.participants.get(userId);
      if (participant) {
        participant.isScreenSharing = true;
        participant.isPresenting = true;
      }

      // Handle screen share end
      videoTrack.addEventListener("ended", () => {
        this.stopScreenShare();
      });

      // Notify other participants
      this.broadcastToCall("screen_share_started", { userId });
    } catch (error) {
      console.error("Failed to start screen sharing:", error);
      throw error;
    }
  }

  /**
   * Stop screen sharing
   */
  async stopScreenShare(): Promise<void> {
    if (!this.currentCall || !this.screenStream) return;

    try {
      // Stop screen stream
      this.screenStream.getTracks().forEach((track) => track.stop());
      this.screenStream = null;

      // Restore camera stream
      if (this.localStream) {
        const videoTrack = this.localStream.getVideoTracks()[0];

        for (const [participantId, pc] of this.peerConnections) {
          const sender = pc.getSenders().find((s) => s.track?.kind === "video");
          if (sender && videoTrack) {
            await sender.replaceTrack(videoTrack);
          }
        }
      }

      // Update participant status
      const userId = this.getCurrentUserId();
      const participant = this.currentCall.participants.get(userId);
      if (participant) {
        participant.isScreenSharing = false;
        participant.isPresenting = false;
      }

      // Notify other participants
      this.broadcastToCall("screen_share_stopped", { userId });
    } catch (error) {
      console.error("Failed to stop screen sharing:", error);
    }
  }

  /**
   * Start call recording
   */
  async startRecording(): Promise<void> {
    if (!this.currentCall) throw new Error("No active call");
    if (!this.currentCall.settings.recordingEnabled) {
      throw new Error("Recording is not enabled for this call");
    }

    try {
      // Create mixed audio stream from all participants
      const audioContext = new AudioContext();
      const destination = audioContext.createMediaStreamDestination();

      // Mix audio from all participants
      for (const [participantId, participant] of this.currentCall
        .participants) {
        if (participant.stream && participant.audioEnabled) {
          const source = audioContext.createMediaStreamSource(
            participant.stream
          );
          source.connect(destination);
        }
      }

      // Create recording stream with video from presenter or main speaker
      const recordingStream = new MediaStream();

      // Add mixed audio
      destination.stream.getAudioTracks().forEach((track) => {
        recordingStream.addTrack(track);
      });

      // Add video from presenter or main participant
      const presenter = Array.from(this.currentCall.participants.values()).find(
        (p) => p.isPresenting || p.isScreenSharing
      );

      if (presenter?.stream) {
        presenter.stream.getVideoTracks().forEach((track) => {
          recordingStream.addTrack(track);
        });
      }

      // Start recording
      this.mediaRecorder = new MediaRecorder(recordingStream, {
        mimeType: "video/webm;codecs=vp9,opus",
      });

      this.recordingChunks = [];

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.recordingChunks.push(event.data);
        }
      };

      this.mediaRecorder.onstop = async () => {
        await this.saveRecording();
      };

      this.mediaRecorder.start(1000); // Collect data every second
      this.currentCall.isRecording = true;

      // Notify participants
      this.broadcastToCall("recording_started", {});
    } catch (error) {
      console.error("Failed to start recording:", error);
      throw error;
    }
  }

  /**
   * Stop call recording
   */
  async stopRecording(): Promise<string | null> {
    if (!this.mediaRecorder || this.mediaRecorder.state !== "recording") {
      return null;
    }

    return new Promise((resolve) => {
      this.mediaRecorder!.onstop = async () => {
        const recordingUrl = await this.saveRecording();
        if (this.currentCall) {
          this.currentCall.isRecording = false;
          this.currentCall.recordingUrl = recordingUrl;
        }

        // Notify participants
        this.broadcastToCall("recording_stopped", { recordingUrl });
        resolve(recordingUrl);
      };

      this.mediaRecorder!.stop();
    });
  }

  /**
   * Manage waiting room
   */
  async approveWaitingParticipant(userId: number): Promise<void> {
    const waitingParticipant = this.waitingRoomParticipants.get(userId);
    if (!waitingParticipant) return;

    waitingParticipant.approved = true;
    this.waitingRoomParticipants.delete(userId);

    // Send approval to participant
    this.sendToParticipant(userId, "join_approved", {});
  }

  async denyWaitingParticipant(userId: number): Promise<void> {
    const waitingParticipant = this.waitingRoomParticipants.get(userId);
    if (!waitingParticipant) return;

    this.waitingRoomParticipants.delete(userId);

    // Send denial to participant
    this.sendToParticipant(userId, "join_denied", {});
  }

  /**
   * Participant management
   */
  async muteParticipant(userId: number): Promise<void> {
    if (!this.currentCall) return;

    const participant = this.currentCall.participants.get(userId);
    if (participant) {
      participant.audioEnabled = false;
      this.sendToParticipant(userId, "force_mute", {});
      this.broadcastToCall("participant_muted", { userId });
    }
  }

  async removeParticipant(userId: number): Promise<void> {
    if (!this.currentCall) return;

    this.currentCall.participants.delete(userId);
    this.sendToParticipant(userId, "removed_from_call", {});
    this.broadcastToCall("participant_removed", { userId });

    // Close peer connection
    const pc = this.peerConnections.get(userId);
    if (pc) {
      pc.close();
      this.peerConnections.delete(userId);
    }
  }

  async makeParticipantModerator(userId: number): Promise<void> {
    if (!this.currentCall) return;

    const participant = this.currentCall.participants.get(userId);
    if (participant) {
      participant.isModerator = true;
      this.sendToParticipant(userId, "moderator_granted", {});
      this.broadcastToCall("moderator_assigned", { userId });
    }
  }

  /**
   * Private helper methods
   */
  private async initializeLocalMedia(): Promise<void> {
    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280, max: 1920 },
          height: { ideal: 720, max: 1080 },
          frameRate: { ideal: 30, max: 60 },
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 44100,
        },
      });
    } catch (error) {
      console.error("Failed to get user media:", error);
      throw error;
    }
  }

  private async createPeerConnection(
    participantId: number
  ): Promise<RTCPeerConnection> {
    const pc = new RTCPeerConnection({ iceServers: this.iceServers });

    // Add local stream tracks
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => {
        pc.addTrack(track, this.localStream!);
      });
    }

    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.sendToParticipant(participantId, "ice_candidate", {
          candidate: event.candidate,
        });
      }
    };

    // Handle remote stream
    pc.ontrack = (event) => {
      const [stream] = event.streams;
      const participant = this.currentCall?.participants.get(participantId);
      if (participant) {
        participant.stream = stream;
      }
    };

    // Handle connection state changes
    pc.onconnectionstatechange = () => {
      const participant = this.currentCall?.participants.get(participantId);
      if (participant) {
        participant.connectionState = pc.connectionState;
      }
    };

    this.peerConnections.set(participantId, pc);
    return pc;
  }

  private async connectToSignalingServer(callId: string): Promise<void> {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws/calls/${callId}`;

    this.socket = new WebSocket(wsUrl);

    this.socket.onopen = () => {
      console.log("Connected to signaling server");
    };

    this.socket.onmessage = (event) => {
      this.handleSignalingMessage(JSON.parse(event.data));
    };

    this.socket.onclose = () => {
      console.log("Disconnected from signaling server");
      // Attempt reconnection
      setTimeout(() => {
        if (this.currentCall) {
          this.connectToSignalingServer(callId);
        }
      }, 3000);
    };
  }

  private handleSignalingMessage(message: any): void {
    const { type, payload, fromUserId } = message;

    switch (type) {
      case "offer":
        this.handleOffer(payload, fromUserId);
        break;
      case "answer":
        this.handleAnswer(payload, fromUserId);
        break;
      case "ice_candidate":
        this.handleIceCandidate(payload, fromUserId);
        break;
      case "participant_joined":
        this.handleParticipantJoined(payload);
        break;
      case "participant_left":
        this.handleParticipantLeft(payload);
        break;
      default:
        console.log("Unknown signaling message:", type);
    }
  }

  private async handleOffer(
    offer: RTCSessionDescriptionInit,
    fromUserId: number
  ): Promise<void> {
    const pc = await this.createPeerConnection(fromUserId);
    await pc.setRemoteDescription(offer);

    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    this.sendToParticipant(fromUserId, "answer", { answer });
  }

  private async handleAnswer(
    answer: RTCSessionDescriptionInit,
    fromUserId: number
  ): Promise<void> {
    const pc = this.peerConnections.get(fromUserId);
    if (pc) {
      await pc.setRemoteDescription(answer);
    }
  }

  private async handleIceCandidate(
    candidate: RTCIceCandidateInit,
    fromUserId: number
  ): Promise<void> {
    const pc = this.peerConnections.get(fromUserId);
    if (pc) {
      await pc.addIceCandidate(candidate);
    }
  }

  private handleParticipantJoined(participant: CallParticipant): void {
    if (this.currentCall) {
      this.currentCall.participants.set(participant.userId, participant);
    }
  }

  private handleParticipantLeft(payload: { userId: number }): void {
    if (this.currentCall) {
      this.currentCall.participants.delete(payload.userId);

      const pc = this.peerConnections.get(payload.userId);
      if (pc) {
        pc.close();
        this.peerConnections.delete(payload.userId);
      }
    }
  }

  private broadcastToCall(type: string, payload: any): void {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(
        JSON.stringify({
          type: "broadcast",
          messageType: type,
          payload,
        })
      );
    }
  }

  private sendToParticipant(userId: number, type: string, payload: any): void {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(
        JSON.stringify({
          type: "direct_message",
          toUserId: userId,
          messageType: type,
          payload,
        })
      );
    }
  }

  private async saveRecording(): Promise<string> {
    const blob = new Blob(this.recordingChunks, { type: "video/webm" });
    const formData = new FormData();
    formData.append(
      "recording",
      blob,
      `call-${this.currentCall?.id}-${Date.now()}.webm`
    );

    const response = await fetch("/api/calls/recordings", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${localStorage.getItem("authToken")}`,
      },
      body: formData,
    });

    if (!response.ok) {
      throw new Error("Failed to save recording");
    }

    const result = await response.json();
    return result.url;
  }

  private generateCallId(): string {
    return `call-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateRoomId(): string {
    return Math.random().toString(36).substr(2, 12).toUpperCase();
  }

  private getCurrentUserId(): number {
    // Get from auth context
    return 1; // Placeholder
  }

  private async getUserUsername(userId: number): Promise<string> {
    // Fetch from API
    return `user-${userId}`;
  }

  private async getUserDisplayName(userId: number): Promise<string> {
    // Fetch from API
    return `User ${userId}`;
  }

  private async sendInvitations(invitation: CallInvitation): Promise<void> {
    await fetch("/api/calls/invitations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${localStorage.getItem("authToken")}`,
      },
      body: JSON.stringify(invitation),
    });
  }

  private async storeCallData(call: GroupCall): Promise<void> {
    await fetch("/api/calls", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${localStorage.getItem("authToken")}`,
      },
      body: JSON.stringify(call),
    });
  }

  private async getCallData(callId: string): Promise<GroupCall | null> {
    const response = await fetch(`/api/calls/${callId}`, {
      headers: {
        Authorization: `Bearer ${localStorage.getItem("authToken")}`,
      },
    });

    if (!response.ok) {
      return null;
    }

    return await response.json();
  }

  private async requestJoinApproval(
    callId: string,
    userId: number
  ): Promise<void> {
    const participant: WaitingRoomParticipant = {
      userId,
      displayName: await this.getUserDisplayName(userId),
      joinRequestTime: new Date(),
      approved: false,
    };

    this.waitingRoomParticipants.set(userId, participant);

    // Notify moderators
    this.broadcastToCall("join_request", { participant });
  }

  /**
   * Public getters
   */
  getCurrentCall(): GroupCall | null {
    return this.currentCall;
  }

  getWaitingRoomParticipants(): WaitingRoomParticipant[] {
    return Array.from(this.waitingRoomParticipants.values());
  }

  isRecording(): boolean {
    return this.currentCall?.isRecording || false;
  }

  getParticipantCount(): number {
    return this.currentCall?.participants.size || 0;
  }
}

export const groupCallManager = new GroupCallManager();
