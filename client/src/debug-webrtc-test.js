// WebRTC Debug Test Script
// Run this in browser console to test WebRTC functionality step by step

console.log("🧪 Starting WebRTC Debug Test");

// Test 1: Check if WebRTC is available
console.log("1️⃣ Testing WebRTC availability...");
console.log("RTCPeerConnection available:", !!window.RTCPeerConnection);
console.log("getUserMedia available:", !!navigator.mediaDevices?.getUserMedia);

// Test 2: Test media access
console.log("2️⃣ Testing media access...");
navigator.mediaDevices
  .getUserMedia({ audio: true, video: false })
  .then((stream) => {
    console.log("✅ Media access successful");
    console.log("Audio tracks:", stream.getAudioTracks().length);
    console.log("Video tracks:", stream.getVideoTracks().length);

    // Test 3: Create peer connection
    console.log("3️⃣ Testing peer connection creation...");
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });

    console.log("✅ Peer connection created");
    console.log("Connection state:", pc.connectionState);
    console.log("Signaling state:", pc.signalingState);

    // Test 4: Add tracks
    console.log("4️⃣ Testing track addition...");
    stream.getTracks().forEach((track) => {
      pc.addTrack(track, stream);
      console.log("Added track:", track.kind);
    });

    // Test 5: Create offer
    console.log("5️⃣ Testing offer creation...");
    return pc.createOffer({
      offerToReceiveAudio: true,
      offerToReceiveVideo: false,
    });
  })
  .then((offer) => {
    console.log("✅ Offer created successfully");
    console.log("Offer type:", offer.type);
    console.log("SDP length:", offer.sdp?.length);
    console.log("Has audio:", offer.sdp?.includes("m=audio"));

    // Test JSON serialization
    console.log("6️⃣ Testing JSON serialization...");
    const serialized = JSON.stringify(offer);
    const deserialized = JSON.parse(serialized);
    console.log("✅ JSON serialization successful");
    console.log("Serialized length:", serialized.length);
    console.log("Deserialized type:", deserialized.type);
    console.log("SDP preserved:", !!deserialized.sdp);

    console.log("🎉 All WebRTC tests passed!");
  })
  .catch((error) => {
    console.error("❌ WebRTC test failed:", error);
  });

// Test current call context state
console.log("7️⃣ Checking current call context state...");
if (window.WebRTCDebugger) {
  console.log("WebRTCDebugger available:", true);
  console.log("Recent logs:");
  window.WebRTCDebugger.getLogs()
    .slice(-10)
    .forEach((log) => console.log(log));
} else {
  console.log("WebRTCDebugger not available");
}

console.log("🧪 Debug test script complete - check results above");
