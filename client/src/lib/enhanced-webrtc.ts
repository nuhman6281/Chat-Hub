/**
 * Enhanced WebRTC implementation based on documentation best practices
 * Comprehensive peer-to-peer communication with advanced features
 */

export interface EnhancedWebRTCConfig {
  onRemoteStream?: (stream: MediaStream) => void;
  onIceCandidate?: (candidate: RTCIceCandidate) => void;
  onConnectionStateChange?: (state: RTCPeerConnectionState) => void;
  onIceConnectionStateChange?: (state: RTCIceConnectionState) => void;
  onError?: (error: Error) => void;
}

export class EnhancedWebRTC {
  private peerConnection: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private remoteStream: MediaStream | null = null;
  private config: EnhancedWebRTCConfig;

  private static readonly ICE_SERVERS = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' }
    ],
    iceCandidatePoolSize: 10
  };

  private static readonly AUDIO_CONSTRAINTS = {
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
      sampleRate: 44100
    },
    video: false
  };

  private static readonly VIDEO_CONSTRAINTS = {
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
      sampleRate: 44100
    },
    video: {
      width: { min: 640, ideal: 1280, max: 1920 },
      height: { min: 480, ideal: 720, max: 1080 },
      frameRate: { min: 16, ideal: 30, max: 60 }
    }
  };

  constructor(config: EnhancedWebRTCConfig = {}) {
    this.config = config;
  }

  async initializePeerConnection(): Promise<RTCPeerConnection> {
    console.log('🔄 Initializing enhanced WebRTC peer connection');
    
    if (this.peerConnection) {
      this.peerConnection.close();
    }

    this.peerConnection = new RTCPeerConnection(EnhancedWebRTC.ICE_SERVERS);
    this.setupEventHandlers();
    
    return this.peerConnection;
  }

  private setupEventHandlers(): void {
    if (!this.peerConnection) return;

    // Handle remote stream
    this.peerConnection.ontrack = (event) => {
      console.log('📺 Received remote track:', event.track.kind);
      const [remoteStream] = event.streams;
      
      if (remoteStream) {
        this.remoteStream = remoteStream;
        console.log('✅ Remote stream established with', remoteStream.getTracks().length, 'tracks');
        this.config.onRemoteStream?.(remoteStream);
      }
    };

    // Handle ICE candidates
    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        console.log('🧊 Generated ICE candidate:', event.candidate.type);
        this.config.onIceCandidate?.(event.candidate);
      } else {
        console.log('✅ ICE gathering completed');
      }
    };

    // Connection state monitoring
    this.peerConnection.onconnectionstatechange = () => {
      if (!this.peerConnection) return;
      
      const state = this.peerConnection.connectionState;
      console.log('🔄 Connection state:', state);
      
      switch (state) {
        case 'connected':
          console.log('✅ WebRTC connection established');
          break;
        case 'failed':
          console.error('❌ WebRTC connection failed');
          this.config.onError?.(new Error('Connection failed'));
          break;
      }
      
      this.config.onConnectionStateChange?.(state);
    };

    // ICE connection state monitoring
    this.peerConnection.oniceconnectionstatechange = () => {
      if (!this.peerConnection) return;
      
      const state = this.peerConnection.iceConnectionState;
      console.log('🧊 ICE connection state:', state);
      
      switch (state) {
        case 'connected':
        case 'completed':
          console.log('✅ ICE connection established - media should flow');
          break;
        case 'failed':
          console.error('❌ ICE connection failed');
          this.config.onError?.(new Error('ICE connection failed'));
          break;
      }
      
      this.config.onIceConnectionStateChange?.(state);
    };

    // Additional state monitoring
    this.peerConnection.onicegatheringstatechange = () => {
      if (!this.peerConnection) return;
      console.log('🧊 ICE gathering state:', this.peerConnection.iceGatheringState);
    };

    this.peerConnection.onsignalingstatechange = () => {
      if (!this.peerConnection) return;
      console.log('📡 Signaling state:', this.peerConnection.signalingState);
    };
  }

  async getUserMedia(isVideoCall: boolean = false): Promise<MediaStream> {
    try {
      console.log('🎥 Requesting user media for', isVideoCall ? 'video' : 'audio', 'call');
      
      const constraints = isVideoCall ? 
        EnhancedWebRTC.VIDEO_CONSTRAINTS : 
        EnhancedWebRTC.AUDIO_CONSTRAINTS;
      
      this.localStream = await navigator.mediaDevices.getUserMedia(constraints);
      
      console.log('✅ Media stream obtained:');
      console.log('  Audio tracks:', this.localStream.getAudioTracks().length);
      console.log('  Video tracks:', this.localStream.getVideoTracks().length);
      
      return this.localStream;
    } catch (error) {
      console.error('❌ Error accessing media devices:', error);
      
      let errorMessage = 'Could not access camera/microphone';
      if (error instanceof Error) {
        switch (error.name) {
          case 'NotAllowedError':
            errorMessage = 'Permission denied to access camera/microphone';
            break;
          case 'NotFoundError':
            errorMessage = 'No camera/microphone found';
            break;
          case 'NotReadableError':
            errorMessage = 'Camera/microphone is already in use';
            break;
        }
      }
      
      throw new Error(errorMessage);
    }
  }

  addLocalStream(stream: MediaStream): void {
    if (!this.peerConnection) {
      throw new Error('Peer connection not initialized');
    }

    console.log('📤 Adding local stream tracks');
    
    stream.getTracks().forEach((track, index) => {
      console.log(`📤 Adding track ${index}: ${track.kind}`);
      this.peerConnection!.addTrack(track, stream);
    });
  }

  async createOffer(options?: RTCOfferOptions): Promise<RTCSessionDescriptionInit> {
    if (!this.peerConnection) {
      throw new Error('Peer connection not initialized');
    }

    console.log('📋 Creating WebRTC offer');
    
    const defaultOptions = {
      offerToReceiveAudio: true,
      offerToReceiveVideo: true,
      ...options
    };

    const offer = await this.peerConnection.createOffer(defaultOptions);
    await this.peerConnection.setLocalDescription(offer);
    
    console.log('✅ Offer created and set as local description');
    return offer;
  }

  async createAnswer(): Promise<RTCSessionDescriptionInit> {
    if (!this.peerConnection) {
      throw new Error('Peer connection not initialized');
    }

    console.log('📋 Creating WebRTC answer');
    
    const answer = await this.peerConnection.createAnswer();
    await this.peerConnection.setLocalDescription(answer);
    
    console.log('✅ Answer created and set as local description');
    return answer;
  }

  async setRemoteDescription(description: RTCSessionDescriptionInit): Promise<void> {
    if (!this.peerConnection) {
      throw new Error('Peer connection not initialized');
    }

    console.log('📥 Setting remote description:', description.type);
    await this.peerConnection.setRemoteDescription(description);
    console.log('✅ Remote description set successfully');
  }

  async addIceCandidate(candidate: RTCIceCandidateInit): Promise<void> {
    if (!this.peerConnection) {
      throw new Error('Peer connection not initialized');
    }

    try {
      console.log('🧊 Adding ICE candidate');
      await this.peerConnection.addIceCandidate(candidate);
      console.log('✅ ICE candidate added successfully');
    } catch (error) {
      console.error('❌ Error adding ICE candidate:', error);
      // Don't throw - ICE candidate failures are recoverable
    }
  }

  toggleAudio(enabled?: boolean): boolean {
    if (!this.localStream) return false;

    const audioTracks = this.localStream.getAudioTracks();
    if (audioTracks.length === 0) return false;

    const newEnabled = enabled !== undefined ? enabled : !audioTracks[0].enabled;
    
    audioTracks.forEach(track => {
      track.enabled = newEnabled;
    });

    console.log('🔊 Audio', newEnabled ? 'enabled' : 'disabled');
    return newEnabled;
  }

  toggleVideo(enabled?: boolean): boolean {
    if (!this.localStream) return false;

    const videoTracks = this.localStream.getVideoTracks();
    if (videoTracks.length === 0) return false;

    const newEnabled = enabled !== undefined ? enabled : !videoTracks[0].enabled;
    
    videoTracks.forEach(track => {
      track.enabled = newEnabled;
    });

    console.log('📹 Video', newEnabled ? 'enabled' : 'disabled');
    return newEnabled;
  }

  close(): void {
    console.log('🔒 Closing enhanced WebRTC service');
    
    // Stop local stream
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => {
        track.stop();
        console.log('🛑 Stopped track:', track.kind);
      });
      this.localStream = null;
    }

    // Close peer connection
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }

    this.remoteStream = null;
    console.log('✅ Enhanced WebRTC service closed');
  }

  // Getters
  getConnectionState(): RTCPeerConnectionState | null {
    return this.peerConnection?.connectionState || null;
  }

  getIceConnectionState(): RTCIceConnectionState | null {
    return this.peerConnection?.iceConnectionState || null;
  }

  getLocalStream(): MediaStream | null {
    return this.localStream;
  }

  getRemoteStream(): MediaStream | null {
    return this.remoteStream;
  }

  isAudioEnabled(): boolean {
    if (!this.localStream) return false;
    const audioTracks = this.localStream.getAudioTracks();
    return audioTracks.length > 0 && audioTracks[0].enabled;
  }

  isVideoEnabled(): boolean {
    if (!this.localStream) return false;
    const videoTracks = this.localStream.getVideoTracks();
    return videoTracks.length > 0 && videoTracks[0].enabled;
  }
}