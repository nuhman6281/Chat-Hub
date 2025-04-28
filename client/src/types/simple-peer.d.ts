declare module 'simple-peer' {
  interface PeerOptions {
    initiator?: boolean;
    channelConfig?: object;
    channelName?: string;
    config?: RTCConfiguration;
    offerOptions?: RTCOfferOptions;
    answerOptions?: RTCAnswerOptions;
    sdpTransform?: (sdp: string) => string;
    streams?: MediaStream[];
    stream?: MediaStream;
    trickle?: boolean;
    allowHalfTrickle?: boolean;
    objectMode?: boolean;
  }

  interface PeerEvents {
    signal: (data: any) => void;
    connect: () => void;
    data: (data: any) => void;
    stream: (stream: MediaStream) => void;
    track: (track: MediaStreamTrack, stream: MediaStream) => void;
    close: () => void;
    error: (err: Error) => void;
  }

  class Peer {
    constructor(opts?: PeerOptions);
    signal(data: any): void;
    send(data: any): void;
    addStream(stream: MediaStream): void;
    removeStream(stream: MediaStream): void;
    addTrack(track: MediaStreamTrack, stream: MediaStream): void;
    removeTrack(track: MediaStreamTrack, stream: MediaStream): void;
    replaceTrack(oldTrack: MediaStreamTrack, newTrack: MediaStreamTrack, stream: MediaStream): void;
    destroy(err?: Error): void;
    on<K extends keyof PeerEvents>(event: K, listener: PeerEvents[K]): this;
    once<K extends keyof PeerEvents>(event: K, listener: PeerEvents[K]): this;
    removeListener<K extends keyof PeerEvents>(event: K, listener: PeerEvents[K]): this;
    removeAllListeners<K extends keyof PeerEvents>(event?: K): this;
    
    readonly connected: boolean;
    readonly destroyed: boolean;
  }

  export default Peer;
}