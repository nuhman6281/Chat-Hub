/**
 * WebRTC Test Utility
 * Use this to verify WebRTC functionality in your EventSentinel app
 */

export class WebRTCTester {
  static async testMediaAccess(
    constraints: MediaStreamConstraints = { audio: true, video: true }
  ) {
    console.log("🧪 Testing media access with constraints:", constraints);

    try {
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      console.log("✅ Media access successful");
      console.log("📊 Stream details:");
      console.log("  - Stream ID:", stream.id);
      console.log("  - Total tracks:", stream.getTracks().length);
      console.log("  - Audio tracks:", stream.getAudioTracks().length);
      console.log("  - Video tracks:", stream.getVideoTracks().length);

      stream.getTracks().forEach((track, index) => {
        console.log(
          `  - Track ${index}: ${track.kind}, enabled: ${track.enabled}, readyState: ${track.readyState}`
        );
      });

      // Clean up
      stream.getTracks().forEach((track) => track.stop());

      return { success: true, stream };
    } catch (error) {
      console.error("❌ Media access failed:", error);
      return { success: false, error };
    }
  }

  static async testICEConnectivity() {
    console.log("🧪 Testing ICE connectivity...");

    const iceServers = [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun1.l.google.com:19302" },
      { urls: "stun:stun2.l.google.com:19302" },
    ];

    try {
      const pc = new RTCPeerConnection({ iceServers });

      return new Promise((resolve) => {
        const candidates: RTCIceCandidate[] = [];
        let gatheringCompleted = false;

        pc.onicecandidate = (event) => {
          if (event.candidate) {
            candidates.push(event.candidate);
            console.log(
              "🧊 ICE candidate:",
              event.candidate.type,
              event.candidate.protocol
            );
          } else if (!gatheringCompleted) {
            gatheringCompleted = true;
            console.log("✅ ICE gathering completed");
            console.log("📊 Gathered candidates:", candidates.length);

            const candidateTypes = candidates.reduce((acc, candidate) => {
              acc[candidate.type] = (acc[candidate.type] || 0) + 1;
              return acc;
            }, {} as Record<string, number>);

            console.log("📊 Candidate types:", candidateTypes);

            pc.close();
            resolve({ success: true, candidates, candidateTypes });
          }
        };

        pc.onicegatheringstatechange = () => {
          console.log("🧊 ICE gathering state:", pc.iceGatheringState);
        };

        // Start gathering by creating a dummy offer
        pc.createOffer().then((offer) => pc.setLocalDescription(offer));

        // Timeout after 10 seconds
        setTimeout(() => {
          if (!gatheringCompleted) {
            console.warn("⏰ ICE gathering timeout");
            pc.close();
            resolve({ success: false, error: "Timeout" });
          }
        }, 10000);
      });
    } catch (error) {
      console.error("❌ ICE connectivity test failed:", error);
      return { success: false, error };
    }
  }

  static async testFullWebRTCConnection() {
    console.log("🧪 Testing full WebRTC connection (loopback)...");

    try {
      // Create two peer connections
      const pc1 = new RTCPeerConnection({
        iceServers: [
          { urls: "stun:stun.l.google.com:19302" },
          { urls: "stun:stun1.l.google.com:19302" },
        ],
      });

      const pc2 = new RTCPeerConnection({
        iceServers: [
          { urls: "stun:stun.l.google.com:19302" },
          { urls: "stun:stun1.l.google.com:19302" },
        ],
      });

      // Get media
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: true,
      });

      // Add stream to pc1
      stream.getTracks().forEach((track) => pc1.addTrack(track, stream));

      let remoteStreamReceived = false;

      return new Promise((resolve) => {
        // Set up connection handlers
        pc1.onicecandidate = (event) => {
          if (event.candidate) {
            pc2.addIceCandidate(event.candidate);
          }
        };

        pc2.onicecandidate = (event) => {
          if (event.candidate) {
            pc1.addIceCandidate(event.candidate);
          }
        };

        pc2.ontrack = (event) => {
          console.log("📺 Remote track received:", event.track.kind);
          const [remoteStream] = event.streams;
          if (remoteStream && !remoteStreamReceived) {
            remoteStreamReceived = true;
            console.log("✅ Full WebRTC connection successful");
            console.log(
              "📊 Remote stream tracks:",
              remoteStream.getTracks().length
            );

            // Cleanup
            stream.getTracks().forEach((track) => track.stop());
            remoteStream.getTracks().forEach((track) => track.stop());
            pc1.close();
            pc2.close();

            resolve({ success: true, remoteStream });
          }
        };

        // Connection state monitoring
        pc1.onconnectionstatechange = () => {
          console.log("🔗 PC1 connection state:", pc1.connectionState);
        };

        pc2.onconnectionstatechange = () => {
          console.log("🔗 PC2 connection state:", pc2.connectionState);
        };

        // Start negotiation
        pc1
          .createOffer()
          .then((offer) => pc1.setLocalDescription(offer))
          .then(() => pc2.setRemoteDescription(pc1.localDescription!))
          .then(() => pc2.createAnswer())
          .then((answer) => pc2.setLocalDescription(answer))
          .then(() => pc1.setRemoteDescription(pc2.localDescription!))
          .catch((error) => {
            console.error("❌ Negotiation failed:", error);
            stream.getTracks().forEach((track) => track.stop());
            pc1.close();
            pc2.close();
            resolve({ success: false, error });
          });

        // Timeout after 30 seconds
        setTimeout(() => {
          if (!remoteStreamReceived) {
            console.warn("⏰ Connection timeout");
            stream.getTracks().forEach((track) => track.stop());
            pc1.close();
            pc2.close();
            resolve({ success: false, error: "Connection timeout" });
          }
        }, 30000);
      });
    } catch (error) {
      console.error("❌ Full WebRTC test failed:", error);
      return { success: false, error };
    }
  }

  static async runAllTests() {
    console.log("🧪 Running all WebRTC tests...");

    const results = {
      mediaAccess: await this.testMediaAccess(),
      audioOnly: await this.testMediaAccess({ audio: true, video: false }),
      iceConnectivity: await this.testICEConnectivity(),
      fullConnection: await this.testFullWebRTCConnection(),
    };

    console.log("📊 Test Results:", results);

    const allPassed = Object.values(results).every((result) => result.success);
    console.log(allPassed ? "✅ All tests passed!" : "❌ Some tests failed");

    return results;
  }
}

// Make it available globally for debugging
if (typeof window !== "undefined") {
  (window as any).WebRTCTester = WebRTCTester;
}
