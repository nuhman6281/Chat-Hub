// WebRTC Configuration based on documentation best practices
export const ICE_SERVERS = {
  iceServers: [
    {
      urls: [
        'stun:stun1.l.google.com:19302',
        'stun:stun2.l.google.com:19302',
        'stun:stun.l.google.com:19302'
      ]
    }
    // Production TURN servers should be added here
    // {
    //   urls: 'turn:your-turn-server.com:3478',
    //   username: 'your-username',
    //   credential: 'your-password'
    // }
  ],
  iceCandidatePoolSize: 10
};

export const MEDIA_CONSTRAINTS = {
  video: {
    width: { min: 640, ideal: 1280, max: 1920 },
    height: { min: 480, ideal: 720, max: 1080 },
    frameRate: { min: 16, ideal: 30, max: 60 }
  },
  audio: {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
    sampleRate: 44100
  }
};

export const AUDIO_ONLY_CONSTRAINTS = {
  video: false,
  audio: {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
    sampleRate: 44100
  }
};

export const CONNECTION_TIMEOUT = 30000; // 30 seconds
export const ICE_GATHERING_TIMEOUT = 10000; // 10 seconds