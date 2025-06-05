/**
 * Enhanced WebRTC service based on documentation best practices
 * Implements comprehensive peer-to-peer communication with advanced features
 */

import { ICE_SERVERS, MEDIA_CONSTRAINTS, AUDIO_ONLY_CONSTRAINTS, CONNECTION_TIMEOUT, ICE_GATHERING_TIMEOUT } from './webrtc-config';

export interface WebRTCServiceConfig {
  onRemoteStream?: (stream: MediaStream) => void;
  onIceCandidate?: (candidate: RTCIceCandidate) => void;
  onConnectionStateChange?: (state: RTCPeerConnectionState) => void;
  onIceConnectionStateChange?: (state: RTCIceConnectionState) => void;
  onDataChannel?: (channel: RTCDataChannel) => void;
  onError?: (error: Error) => void;
}

export class WebRTCService {
  private peerConnection: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private remoteStream: MediaStream | null = null;
  private dataChannel: RTCDataChannel | null = null;
  private config: WebRTCServiceConfig;
  private connectionTimeout: NodeJS.Timeout | null = null;
  private iceGatheringTimeout: NodeJS.Timeout | null = null;

  constructor(config: WebRTCServiceConfig = {}) {
    this.config = config;
    console.log('Enhanced WebRTC Service initialized');
  }

  // Set callback functions for backward compatibility
  onRemoteStream(callback: (stream: MediaStream) => void) {
    this.config.onRemoteStream = callback;
  }

  onConnectionState(callback: (state: RTCPeerConnectionState) => void) {
    this.config.onConnectionStateChange = callback;
  }

  async initializePeerConnection(): Promise<RTCPeerConnection> {
    console.log('🔄 Initializing WebRTC peer connection with enhanced configuration');
    
    if (this.peerConnection) {
      console.log('♻️ Closing existing peer connection');
      this.peerConnection.close();
    }

    this.peerConnection = new RTCPeerConnection(ICE_SERVERS as RTCConfiguration);
    this.setupPeerConnectionHandlers();
    
    // Set connection timeout
    this.connectionTimeout = setTimeout(() => {
      console.error('❌ WebRTC connection timeout');
      this.config.onError?.(new Error('Connection timeout'));
      this.close();
    }, CONNECTION_TIMEOUT);

    return this.peerConnection;
  }

  private setupPeerConnectionHandlers(): void {
    if (!this.peerConnection) return;

    // Handle remote stream with enhanced logging
    this.peerConnection.ontrack = (event) => {
      console.log('📺 Received remote track:', event.track.kind, event.track.label);
      const [remoteStream] = event.streams;
      
      if (remoteStream) {
        this.remoteStream = remoteStream;
        console.log('✅ Remote stream established with', remoteStream.getTracks().length, 'tracks');
        this.config.onRemoteStream?.(remoteStream);
      }
    };

    // Enhanced ICE candidate handling
    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        console.log('🧊 Generated ICE candidate:', event.candidate.type, event.candidate.protocol);
        this.config.onIceCandidate?.(event.candidate);
      } else {
        console.log('✅ ICE gathering completed');
        if (this.iceGatheringTimeout) {
          clearTimeout(this.iceGatheringTimeout);
          this.iceGatheringTimeout = null;
        }
      }
    };

    // Enhanced connection state monitoring
    this.peerConnection.onconnectionstatechange = () => {
      if (!this.peerConnection) return;
      
      const state = this.peerConnection.connectionState;
      console.log('🔄 WebRTC connection state:', state);
      
      switch (state) {
        case 'connected':
          console.log('✅ WebRTC peer connection established successfully');
          if (this.connectionTimeout) {
            clearTimeout(this.connectionTimeout);
            this.connectionTimeout = null;
          }
          break;
        case 'disconnected':
          console.log('⚠️ WebRTC connection disconnected');
          break;
        case 'failed':
          console.error('❌ WebRTC connection failed');
          this.config.onError?.(new Error('Peer connection failed'));
          break;
        case 'closed':
          console.log('🔒 WebRTC connection closed');
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
        case 'disconnected':
          console.log('⚠️ ICE connection disconnected');
          break;
        case 'failed':
          console.error('❌ ICE connection failed - checking TURN server requirements');
          this.config.onError?.(new Error('ICE connection failed - may need TURN server'));
          break;
      }
      
      this.config.onIceConnectionStateChange?.(state);
    };

    // ICE gathering state monitoring
    this.peerConnection.onicegatheringstatechange = () => {
      if (!this.peerConnection) return;
      
      const state = this.peerConnection.iceGatheringState;
      console.log('🧊 ICE gathering state:', state);
      
      if (state === 'gathering') {
        this.iceGatheringTimeout = setTimeout(() => {
          console.warn('⏰ ICE gathering taking longer than expected');
        }, ICE_GATHERING_TIMEOUT);
      }
    };

    // Data channel handling
    this.peerConnection.ondatachannel = (event) => {
      console.log('📡 Data channel received:', event.channel.label);
      this.dataChannel = event.channel;
      this.setupDataChannelHandlers();
      this.config.onDataChannel?.(event.channel);
    };

    // Signaling state monitoring
    this.peerConnection.onsignalingstatechange = () => {
      if (!this.peerConnection) return;
      console.log('📡 Signaling state:', this.peerConnection.signalingState);
    };
  }

  private setupDataChannelHandlers(): void {
    if (!this.dataChannel) return;

    this.dataChannel.onopen = () => {
      console.log('📡 Data channel opened');
    };

    this.dataChannel.onclose = () => {
      console.log('📡 Data channel closed');
    };

    this.dataChannel.onerror = (error) => {
      console.error('📡 Data channel error:', error);
    };
  }

  async getUserMedia(constraints?: MediaStreamConstraints, isVideoCall: boolean = false): Promise<MediaStream> {
    try {
      console.log('🎥 Requesting user media with constraints:', constraints);
      
      const mediaConstraints = constraints || (isVideoCall ? MEDIA_CONSTRAINTS : AUDIO_ONLY_CONSTRAINTS);
      
      this.localStream = await navigator.mediaDevices.getUserMedia(mediaConstraints);
      
      console.log('✅ Local media stream obtained with', this.localStream.getTracks().length, 'tracks');
      console.log('📊 Audio tracks:', this.localStream.getAudioTracks().length);
      console.log('📹 Video tracks:', this.localStream.getVideoTracks().length);
      
      return this.localStream;
    } catch (error) {
      console.error('❌ Error accessing media devices:', error);
      
      let errorMessage = 'Could not access camera/microphone';
      if (error instanceof Error) {
        if (error.name === 'NotAllowedError') {
          errorMessage = 'Permission denied to access camera/microphone';
        } else if (error.name === 'NotFoundError') {
          errorMessage = 'No camera/microphone found';
        } else if (error.name === 'NotReadableError') {
          errorMessage = 'Camera/microphone is already in use';
        }
      }
      
      throw new Error(errorMessage);
    }
  }

  addLocalStream(stream: MediaStream): void {
    if (!this.peerConnection) {
      throw new Error('Peer connection not initialized');
    }

    console.log('📤 Adding local stream tracks to peer connection');
    
    stream.getTracks().forEach((track, index) => {
      console.log(`📤 Adding track ${index}: ${track.kind} (${track.label})`);
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
    
    console.log('✅ WebRTC offer created and set as local description');
    console.log('📋 Offer SDP type:', offer.type);
    
    return offer;
  }

  async createAnswer(): Promise<RTCSessionDescriptionInit> {
    if (!this.peerConnection) {
      throw new Error('Peer connection not initialized');
    }

    console.log('📋 Creating WebRTC answer');
    
    const answer = await this.peerConnection.createAnswer();
    await this.peerConnection.setLocalDescription(answer);
    
    console.log('✅ WebRTC answer created and set as local description');
    console.log('📋 Answer SDP type:', answer.type);
    
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
      console.log('🧊 Adding ICE candidate:', candidate.type);
      await this.peerConnection.addIceCandidate(candidate);
      console.log('✅ ICE candidate added successfully');
    } catch (error) {
      console.error('❌ Error adding ICE candidate:', error);
      // Don't throw error for ICE candidate failures as they're recoverable
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
    console.log('🔒 Closing WebRTC service');
    
    // Clear timeouts
    if (this.connectionTimeout) {
      clearTimeout(this.connectionTimeout);
      this.connectionTimeout = null;
    }
    
    if (this.iceGatheringTimeout) {
      clearTimeout(this.iceGatheringTimeout);
      this.iceGatheringTimeout = null;
    }

    // Close data channel
    if (this.dataChannel) {
      this.dataChannel.close();
      this.dataChannel = null;
    }

    // Stop local stream
    if (this.localStream) {
      console.log('🛑 Stopping local media tracks');
      this.localStream.getTracks().forEach(track => {
        track.stop();
        console.log('🛑 Stopped track:', track.kind);
      });
      this.localStream = null;
    }

    // Close peer connection
    if (this.peerConnection) {
      console.log('🔒 Closing peer connection');
      this.peerConnection.close();
      this.peerConnection = null;
    }

    this.remoteStream = null;
    console.log('✅ WebRTC service closed successfully');
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