import { useState, useRef, useEffect } from 'react';
import { Mic, MicOff, Play, Pause, Send, Trash2, Square } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';

interface VoiceRecorderProps {
  onVoiceMessage: (audioBlob: Blob, duration: number) => void;
  isOpen: boolean;
  onClose: () => void;
}

export function VoiceRecorder({ onVoiceMessage, isOpen, onClose }: VoiceRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackTime, setPlaybackTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const { toast } = useToast();

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
    };
  }, [audioUrl]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } 
      });

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });

      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm;codecs=opus' });
        setAudioBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));
        setDuration(recordingTime);
        
        // Stop all tracks to release microphone
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start(100); // Collect data every 100ms
      setIsRecording(true);
      setRecordingTime(0);

      // Start timer
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 0.1);
      }, 100);

    } catch (error) {
      toast({
        title: 'Microphone access denied',
        description: 'Please allow microphone access to record voice messages.',
        variant: 'destructive',
      });
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setIsPaused(false);
      
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  };

  const pauseRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      if (isPaused) {
        mediaRecorderRef.current.resume();
        setIsPaused(false);
        // Resume timer
        timerRef.current = setInterval(() => {
          setRecordingTime(prev => prev + 0.1);
        }, 100);
      } else {
        mediaRecorderRef.current.pause();
        setIsPaused(true);
        // Pause timer
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
      }
    }
  };

  const playAudio = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
      } else {
        audioRef.current.play();
        setIsPlaying(true);
      }
    }
  };

  const discardRecording = () => {
    setAudioBlob(null);
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
      setAudioUrl(null);
    }
    setRecordingTime(0);
    setPlaybackTime(0);
    setDuration(0);
    setIsPlaying(false);
  };

  const sendVoiceMessage = () => {
    if (audioBlob) {
      onVoiceMessage(audioBlob, duration);
      discardRecording();
      onClose();
    }
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleClose = () => {
    if (isRecording) {
      stopRecording();
    }
    discardRecording();
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Voice Message</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Recording State */}
          {!audioBlob && (
            <div className="text-center space-y-4">
              <div className="relative">
                <div className={`w-32 h-32 mx-auto rounded-full border-4 flex items-center justify-center transition-colors ${
                  isRecording ? 'border-red-500 bg-red-50' : 'border-muted bg-muted/20'
                }`}>
                  <Mic className={`h-12 w-12 ${isRecording ? 'text-red-500' : 'text-muted-foreground'}`} />
                </div>
                
                {isRecording && (
                  <div className="absolute inset-0 rounded-full border-4 border-red-500 animate-pulse" />
                )}
              </div>

              <div className="text-2xl font-mono font-medium">
                {formatTime(recordingTime)}
              </div>

              <div className="flex justify-center gap-2">
                {!isRecording ? (
                  <Button onClick={startRecording} size="lg" className="rounded-full">
                    <Mic className="h-5 w-5 mr-2" />
                    Start Recording
                  </Button>
                ) : (
                  <>
                    <Button
                      onClick={pauseRecording}
                      variant="outline"
                      size="lg"
                      className="rounded-full"
                    >
                      {isPaused ? <Play className="h-5 w-5" /> : <Pause className="h-5 w-5" />}
                    </Button>
                    <Button
                      onClick={stopRecording}
                      variant="destructive"
                      size="lg"
                      className="rounded-full"
                    >
                      <Square className="h-5 w-5" />
                    </Button>
                  </>
                )}
              </div>

              {isRecording && (
                <div className="text-sm text-muted-foreground">
                  {isPaused ? 'Recording paused' : 'Recording...'}
                </div>
              )}
            </div>
          )}

          {/* Playback State */}
          {audioBlob && audioUrl && (
            <div className="space-y-4">
              <div className="text-center">
                <div className="text-lg font-medium mb-2">Recording complete</div>
                <div className="text-sm text-muted-foreground">
                  Duration: {formatTime(duration)}
                </div>
              </div>

              <audio
                ref={audioRef}
                src={audioUrl}
                onLoadedMetadata={() => {
                  if (audioRef.current) {
                    setDuration(audioRef.current.duration);
                  }
                }}
                onTimeUpdate={() => {
                  if (audioRef.current) {
                    setPlaybackTime(audioRef.current.currentTime);
                  }
                }}
                onEnded={() => {
                  setIsPlaying(false);
                  setPlaybackTime(0);
                }}
                className="hidden"
              />

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Button
                    onClick={playAudio}
                    variant="outline"
                    size="sm"
                    className="flex-shrink-0"
                  >
                    {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                  </Button>
                  <div className="flex-1">
                    <Progress 
                      value={duration > 0 ? (playbackTime / duration) * 100 : 0} 
                      className="h-2" 
                    />
                  </div>
                  <div className="text-xs text-muted-foreground font-mono">
                    {formatTime(playbackTime)} / {formatTime(duration)}
                  </div>
                </div>
              </div>

              <div className="flex justify-center gap-2">
                <Button onClick={discardRecording} variant="outline">
                  <Trash2 className="h-4 w-4 mr-2" />
                  Discard
                </Button>
                <Button onClick={sendVoiceMessage}>
                  <Send className="h-4 w-4 mr-2" />
                  Send
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Quick voice recording button for one-tap recording
interface QuickVoiceButtonProps {
  onVoiceMessage: (audioBlob: Blob, duration: number) => void;
  className?: string;
}

export function QuickVoiceButton({ onVoiceMessage, className }: QuickVoiceButtonProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const { toast } = useToast();

  const startQuickRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);

      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        onVoiceMessage(blob, recordingTime);
        stream.getTracks().forEach(track => track.stop());
        setRecordingTime(0);
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);

      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 0.1);
      }, 100);

    } catch (error) {
      toast({
        title: 'Microphone access denied',
        description: 'Please allow microphone access to record voice messages.',
        variant: 'destructive',
      });
    }
  };

  const stopQuickRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  };

  const handleMouseDown = () => {
    startQuickRecording();
  };

  const handleMouseUp = () => {
    if (isRecording) {
      stopQuickRecording();
    }
  };

  return (
    <Button
      variant={isRecording ? "destructive" : "ghost"}
      size="sm"
      className={`relative ${className}`}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onTouchStart={handleMouseDown}
      onTouchEnd={handleMouseUp}
    >
      {isRecording ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
      {isRecording && (
        <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-red-500 text-white text-xs px-2 py-1 rounded">
          {Math.floor(recordingTime)}s
        </div>
      )}
    </Button>
  );
}