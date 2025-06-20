/**
 * WebRTC Debug Utility for EventSentinel
 * Use this to diagnose exactly what's happening during calls
 */

export class WebRTCDebugger {
  private static logBuffer: string[] = [];

  static log(message: string, data?: any) {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] ${message}`;

    // Always log to console immediately and prominently
    if (data !== undefined) {
      console.log(`🔧 WebRTC DEBUG: ${logEntry}`, data);
    } else {
      console.log(`🔧 WebRTC DEBUG: ${logEntry}`);
    }

    this.logBuffer.push(logEntry + (data ? ` ${JSON.stringify(data)}` : ""));

    // Keep only last 100 logs
    if (this.logBuffer.length > 100) {
      this.logBuffer.shift();
    }
  }

  static getLogs(): string[] {
    return [...this.logBuffer];
  }

  static clearLogs() {
    this.logBuffer = [];
  }

  static async debugCallFlow(peerConnection: RTCPeerConnection | null) {
    this.log("🔍 === WEBRTC CALL FLOW DEBUG ===");

    if (!peerConnection) {
      this.log("❌ No peer connection available");
      return;
    }

    // Basic connection states
    this.log("📊 Connection States:", {
      connectionState: peerConnection.connectionState,
      iceConnectionState: peerConnection.iceConnectionState,
      iceGatheringState: peerConnection.iceGatheringState,
      signalingState: peerConnection.signalingState,
    });

    // Local description
    if (peerConnection.localDescription) {
      this.log("📋 Local Description:", {
        type: peerConnection.localDescription.type,
        sdpLength: peerConnection.localDescription.sdp.length,
        hasAudio: peerConnection.localDescription.sdp.includes("m=audio"),
        hasVideo: peerConnection.localDescription.sdp.includes("m=video"),
      });
    } else {
      this.log("❌ No local description set");
    }

    // Remote description
    if (peerConnection.remoteDescription) {
      this.log("📋 Remote Description:", {
        type: peerConnection.remoteDescription.type,
        sdpLength: peerConnection.remoteDescription.sdp.length,
        hasAudio: peerConnection.remoteDescription.sdp.includes("m=audio"),
        hasVideo: peerConnection.remoteDescription.sdp.includes("m=video"),
      });
    } else {
      this.log("❌ No remote description set");
    }

    // Get transceivers
    const transceivers = peerConnection.getTransceivers();
    this.log("🔄 Transceivers:", {
      count: transceivers.length,
      details: transceivers.map((t) => ({
        direction: t.direction,
        kind: t.receiver.track?.kind,
        trackId: t.receiver.track?.id,
        enabled: t.receiver.track?.enabled,
        readyState: t.receiver.track?.readyState,
      })),
    });

    // Get senders
    const senders = peerConnection.getSenders();
    this.log("📤 Senders:", {
      count: senders.length,
      details: senders.map((s) => ({
        kind: s.track?.kind,
        trackId: s.track?.id,
        enabled: s.track?.enabled,
        readyState: s.track?.readyState,
      })),
    });

    // Get receivers
    const receivers = peerConnection.getReceivers();
    this.log("📥 Receivers:", {
      count: receivers.length,
      details: receivers.map((r) => ({
        kind: r.track?.kind,
        trackId: r.track?.id,
        enabled: r.track?.enabled,
        readyState: r.track?.readyState,
      })),
    });

    // Get stats
    try {
      const stats = await peerConnection.getStats();
      const statsArray: any[] = [];
      stats.forEach((stat) => {
        if (
          [
            "inbound-rtp",
            "outbound-rtp",
            "candidate-pair",
            "local-candidate",
            "remote-candidate",
          ].includes(stat.type)
        ) {
          statsArray.push(stat);
        }
      });
      this.log("📊 WebRTC Stats Summary:", {
        totalStats: stats.size,
        relevantStats: statsArray.length,
        statsTypes: Array.from(
          new Set(Array.from(stats.values()).map((s) => s.type))
        ),
      });
    } catch (error) {
      this.log("❌ Failed to get stats:", error);
    }

    this.log("🔍 === DEBUG COMPLETE ===");
  }

  static debugMediaStream(stream: MediaStream | null, label: string) {
    if (!stream) {
      this.log(`❌ ${label}: No stream available`);
      return;
    }

    this.log(`📺 ${label} Stream Debug:`, {
      id: stream.id,
      active: stream.active,
      totalTracks: stream.getTracks().length,
      audioTracks: stream.getAudioTracks().length,
      videoTracks: stream.getVideoTracks().length,
    });

    stream.getTracks().forEach((track, index) => {
      this.log(`📺 ${label} Track ${index}:`, {
        kind: track.kind,
        id: track.id,
        label: track.label,
        enabled: track.enabled,
        readyState: track.readyState,
        muted: track.muted,
      });

      // Get track settings
      if ("getSettings" in track) {
        try {
          const settings = (track as any).getSettings();
          this.log(`📺 ${label} Track ${index} Settings:`, settings);
        } catch (e) {
          this.log(`❌ Failed to get track settings:`, e);
        }
      }
    });
  }

  static monitorPeerConnection(
    peerConnection: RTCPeerConnection,
    label: string = "PC"
  ) {
    this.log(`🔄 Monitoring peer connection: ${label}`);

    peerConnection.addEventListener("connectionstatechange", () => {
      this.log(`🔗 ${label} Connection State:`, peerConnection.connectionState);
    });

    peerConnection.addEventListener("iceconnectionstatechange", () => {
      this.log(
        `🧊 ${label} ICE Connection State:`,
        peerConnection.iceConnectionState
      );
    });

    peerConnection.addEventListener("icegatheringstatechange", () => {
      this.log(
        `🧊 ${label} ICE Gathering State:`,
        peerConnection.iceGatheringState
      );
    });

    peerConnection.addEventListener("signalingstatechange", () => {
      this.log(`📡 ${label} Signaling State:`, peerConnection.signalingState);
    });

    peerConnection.addEventListener("track", (event) => {
      this.log(`📺 ${label} Track Received:`, {
        kind: event.track.kind,
        id: event.track.id,
        enabled: event.track.enabled,
        readyState: event.track.readyState,
        streamCount: event.streams.length,
      });

      event.streams.forEach((stream, index) => {
        this.log(`📺 ${label} Remote Stream ${index}:`, {
          id: stream.id,
          active: stream.active,
          tracks: stream.getTracks().length,
        });
      });
    });

    peerConnection.addEventListener("icecandidate", (event) => {
      if (event.candidate) {
        this.log(`🧊 ${label} ICE Candidate:`, {
          type: event.candidate.type,
          protocol: event.candidate.protocol,
          address: event.candidate.address,
          port: event.candidate.port,
        });
      } else {
        this.log(`🧊 ${label} ICE Gathering Complete`);
      }
    });
  }

  static async runConnectionDiagnostics(
    localStream: MediaStream | null,
    remoteStream: MediaStream | null,
    peerConnection: RTCPeerConnection | null
  ) {
    this.log("🏥 === RUNNING CONNECTION DIAGNOSTICS ===");

    // Check media streams
    this.debugMediaStream(localStream, "Local");
    this.debugMediaStream(remoteStream, "Remote");

    // Check peer connection
    await this.debugCallFlow(peerConnection);

    // Check browser capabilities
    this.log("🌐 Browser Capabilities:", {
      getUserMedia: !!navigator.mediaDevices?.getUserMedia,
      RTCPeerConnection: !!window.RTCPeerConnection,
      webkitRTCPeerConnection: !!(window as any).webkitRTCPeerConnection,
      mediaDevices: !!navigator.mediaDevices,
    });

    // Check available media devices
    if (navigator.mediaDevices?.enumerateDevices) {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        this.log("🎙️ Available Devices:", {
          audioInput: devices.filter((d) => d.kind === "audioinput").length,
          audioOutput: devices.filter((d) => d.kind === "audiooutput").length,
          videoInput: devices.filter((d) => d.kind === "videoinput").length,
        });
      } catch (error) {
        this.log("❌ Failed to enumerate devices:", error);
      }
    }

    this.log("🏥 === DIAGNOSTICS COMPLETE ===");
  }

  static exportDebugReport(): string {
    const report = [
      "=== EventSentinel WebRTC Debug Report ===",
      `Generated: ${new Date().toISOString()}`,
      "",
      "=== Debug Logs ===",
      ...this.logBuffer,
      "",
      "=== Browser Info ===",
      `User Agent: ${navigator.userAgent}`,
      `Platform: ${navigator.platform}`,
      "",
      "=== End Report ===",
    ].join("\n");

    return report;
  }

  static downloadDebugReport() {
    const report = this.exportDebugReport();
    const blob = new Blob([report], { type: "text/plain" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = `webrtc-debug-${Date.now()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}

// Make it available globally for debugging
if (typeof window !== "undefined") {
  (window as any).WebRTCDebugger = WebRTCDebugger;
}
