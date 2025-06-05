/**
 * Professional WebRTC service for handling peer-to-peer audio/video communication
 * Implements industry-standard practices for reliable media transmission
 */

interface WebRTCConfig {
  iceServers: RTCIceServer[];
}

interface SignalingMessage {
  type: 'offer' | 'answer' | 'candidate';
  data: any;
  callId: string;
  fromUserId: number;
  targetUserId: number;
}

export class WebRTCService {
  private peerConnection: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private remoteStream: MediaStream | null = null;
  private callId: string | null = null;
  private isInitiator = false;
  
  private onRemoteStreamCallback?: (stream: MediaStream) => void;
  private onConnectionStateCallback?: (state: RTCPeerConnectionState) => void;
  private onSignalingCallback?: (message: SignalingMessage) => void;

  private config: WebRTCConfig = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
      { urls: 'stun:stun3.l.google.com:19302' }
    ]
  };

  constructor() {
    console.log('WebRTC Service initialized');
  }

  // Set callback functions
  onRemoteStream(callback: (stream: MediaStream) => void) {
    this.onRemoteStreamCallback = callback;
  }

  onConnectionState(callback: (state: RTCPeerConnectionState) => void) {
    this.onConnectionStateCallback = callback;
  }

  onSignaling(callback: (message: SignalingMessage) => void) {
    this.onSignalingCallback = callback;
  }

  // Initialize peer connection
  private createPeerConnection(): RTCPeerConnection {
    console.log('Creating new RTCPeerConnection');
    
    const pc = new RTCPeerConnection(this.config);

    // Handle remote stream
    pc.ontrack = (event) => {
      console.log('Received remote track:', event.track.kind);
      const [stream] = event.streams;
      if (stream) {
        this.remoteStream = stream;
        console.log('Remote stream set with tracks:', stream.getTracks().length);
        this.onRemoteStreamCallback?.(stream);
      }
    };

    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        console.log('Generated ICE candidate:', event.candidate.type);
        if (this.onSignalingCallback) {
          this.onSignalingCallback({
            type: 'candidate',
            data: event.candidate,
            callId: this.callId!,
            fromUserId: 0,
            targetUserId: 0
          });
        }
      }
    };

    // Handle connection state changes
    pc.onconnectionstatechange = () => {
      console.log('Connection state:', pc.connectionState);
      this.onConnectionStateCallback?.(pc.connectionState);
    };

    // Handle ICE connection state
    pc.oniceconnectionstatechange = () => {
      console.log('ICE connection state:', pc.iceConnectionState);
    };

    // Handle signaling state
    pc.onsignalingstatechange = () => {
      console.log('Signaling state:', pc.signalingState);
    };

    return pc;
  }

  // Start a call (initiator)
  async startCall(callId: string, isVideoCall = false): Promise<RTCSessionDescriptionInit> {
    console.log('Starting call:', callId, 'Video:', isVideoCall);
    
    this.callId = callId;
    this.isInitiator = true;
    this.peerConnection = this.createPeerConnection();

    // Get user media
    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: isVideoCall
      });
      
      console.log('Got local stream with tracks:', this.localStream.getTracks().length);
      
      // Add tracks to peer connection
      this.localStream.getTracks().forEach((track, index) => {
        console.log(`Adding track ${index}: ${track.kind}`);
        this.peerConnection!.addTrack(track, this.localStream!);
      });

      // Create offer
      const offer = await this.peerConnection.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: isVideoCall
      });

      await this.peerConnection.setLocalDescription(offer);
      console.log('Created and set local offer');

      return offer;
    } catch (error) {
      console.error('Error starting call:', error);
      throw error;
    }
  }

  // Answer a call (receiver)
  async answerCall(callId: string, offer: RTCSessionDescriptionInit, isVideoCall = false): Promise<RTCSessionDescriptionInit> {
    console.log('Answering call:', callId, 'Video:', isVideoCall);
    
    this.callId = callId;
    this.isInitiator = false;
    this.peerConnection = this.createPeerConnection();

    // Get user media
    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: isVideoCall
      });
      
      console.log('Got local stream for answer with tracks:', this.localStream.getTracks().length);
      
      // Add tracks to peer connection
      this.localStream.getTracks().forEach((track, index) => {
        console.log(`Adding track ${index}: ${track.kind}`);
        this.peerConnection!.addTrack(track, this.localStream!);
      });

      // Set remote description (offer)
      await this.peerConnection.setRemoteDescription(offer);
      console.log('Set remote offer');

      // Create answer
      const answer = await this.peerConnection.createAnswer();
      await this.peerConnection.setLocalDescription(answer);
      console.log('Created and set local answer');

      return answer;
    } catch (error) {
      console.error('Error answering call:', error);
      throw error;
    }
  }

  // Handle incoming answer
  async handleAnswer(answer: RTCSessionDescriptionInit): Promise<void> {
    if (!this.peerConnection) {
      throw new Error('No peer connection available');
    }

    try {
      await this.peerConnection.setRemoteDescription(answer);
      console.log('Set remote answer');
    } catch (error) {
      console.error('Error handling answer:', error);
      throw error;
    }
  }

  // Handle ICE candidate
  async handleIceCandidate(candidate: RTCIceCandidateInit): Promise<void> {
    if (!this.peerConnection) {
      console.warn('No peer connection for ICE candidate');
      return;
    }

    try {
      await this.peerConnection.addIceCandidate(candidate);
      console.log('Added ICE candidate');
    } catch (error) {
      console.error('Error adding ICE candidate:', error);
    }
  }

  // Toggle audio
  toggleAudio(): boolean {
    if (!this.localStream) return false;

    const audioTrack = this.localStream.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      console.log('Audio toggled:', audioTrack.enabled);
      return audioTrack.enabled;
    }
    return false;
  }

  // Toggle video
  toggleVideo(): boolean {
    if (!this.localStream) return false;

    const videoTrack = this.localStream.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled;
      console.log('Video toggled:', videoTrack.enabled);
      return videoTrack.enabled;
    }
    return false;
  }

  // Get local stream
  getLocalStream(): MediaStream | null {
    return this.localStream;
  }

  // Get remote stream
  getRemoteStream(): MediaStream | null {
    return this.remoteStream;
  }

  // End call and cleanup
  endCall(): void {
    console.log('Ending WebRTC call');

    // Stop local stream
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => {
        console.log('Stopping local track:', track.kind);
        track.stop();
      });
      this.localStream = null;
    }

    // Close peer connection
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }

    // Reset state
    this.remoteStream = null;
    this.callId = null;
    this.isInitiator = false;

    console.log('WebRTC call ended and cleaned up');
  }

  // Get connection stats (for debugging)
  async getStats(): Promise<RTCStatsReport | null> {
    if (!this.peerConnection) return null;
    return await this.peerConnection.getStats();
  }
}