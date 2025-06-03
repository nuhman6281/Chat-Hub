import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Paperclip, 
  Send, 
  Smile, 
  Image as ImageIcon, 
  FileText, 
  Mic, 
  Video,
  Phone,
  X
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';

interface MessageInputProps {
  onSendMessage: (content: string, messageType?: string, mediaUrl?: string, mediaType?: string, mediaSize?: number) => void;
  onStartCall?: (callType: 'voice' | 'video') => void;
  placeholder?: string;
  disabled?: boolean;
  replyingTo?: {
    id: number;
    content: string;
    user: { displayName: string };
  };
  onCancelReply?: () => void;
}

const MessageInput: React.FC<MessageInputProps> = ({
  onSendMessage,
  onStartCall,
  placeholder = "Type a message...",
  disabled = false,
  replyingTo,
  onCancelReply
}) => {
  const [message, setMessage] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [uploadingFile, setUploadingFile] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const { toast } = useToast();

  const handleSend = async () => {
    if (!message.trim() && !uploadingFile) return;
    
    try {
      await onSendMessage(message.trim() || 'Shared a file');
      setMessage('');
      setUploadingFile(null);
      onCancelReply?.();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to send message",
        variant: "destructive",
      });
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileUpload = async (file: File, messageType: string) => {
    if (!file) return;

    setUploadingFile(file.name);
    
    try {
      // Mock file upload - in production, implement actual file upload
      const formData = new FormData();
      formData.append('file', file);
      formData.append('filename', file.name);
      formData.append('mimetype', file.type);

      // Simulate upload delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const mockUrl = `/uploads/${Date.now()}-${file.name}`;
      
      await onSendMessage(
        `Shared ${messageType}: ${file.name}`,
        messageType,
        mockUrl,
        file.type,
        file.size
      );
      
      setUploadingFile(null);
      toast({
        title: "Success",
        description: `${messageType} uploaded successfully`,
      });
    } catch (error) {
      setUploadingFile(null);
      toast({
        title: "Error",
        description: `Failed to upload ${messageType}`,
        variant: "destructive",
      });
    }
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileUpload(file, 'image');
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileUpload(file, 'file');
    }
  };

  const startVoiceRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];

      mediaRecorder.ondataavailable = (e) => {
        chunks.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        const blob = new Blob(chunks, { type: 'audio/wav' });
        const file = new File([blob], `voice-${Date.now()}.wav`, { type: 'audio/wav' });
        await handleFileUpload(file, 'voice');
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();
      setIsRecording(true);
      
      toast({
        title: "Recording",
        description: "Voice recording started",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to start voice recording",
        variant: "destructive",
      });
    }
  };

  const stopVoiceRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      toast({
        title: "Recording stopped",
        description: "Processing voice message...",
      });
    }
  };

  const insertEmoji = (emoji: string) => {
    setMessage(prev => prev + emoji);
  };

  const commonEmojis = ['😀', '😂', '❤️', '👍', '👎', '😢', '😮', '😡', '🔥', '💯'];

  return (
    <div className="border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
      {/* Reply Preview */}
      {replyingTo && (
        <div className="px-4 py-2 bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Replying to {replyingTo.user.displayName}
              </p>
              <p className="text-sm text-gray-700 dark:text-gray-300 truncate">
                {replyingTo.content}
              </p>
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={onCancelReply}
              className="h-6 w-6 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* File Upload Progress */}
      {uploadingFile && (
        <div className="px-4 py-2 bg-blue-50 dark:bg-blue-900/20 border-b border-blue-200 dark:border-blue-800">
          <div className="flex items-center space-x-2">
            <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-500 border-t-transparent"></div>
            <span className="text-sm text-blue-600 dark:text-blue-400">
              Uploading {uploadingFile}...
            </span>
          </div>
        </div>
      )}

      <div className="flex items-end space-x-2 p-4">
        {/* Attachment Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" variant="ghost" disabled={disabled || uploadingFile !== null}>
              <Paperclip className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" side="top">
            <DropdownMenuItem onClick={() => imageInputRef.current?.click()}>
              <ImageIcon className="h-4 w-4 mr-2" />
              Image
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => fileInputRef.current?.click()}>
              <FileText className="h-4 w-4 mr-2" />
              File
            </DropdownMenuItem>
            <DropdownMenuItem onClick={isRecording ? stopVoiceRecording : startVoiceRecording}>
              <Mic className={`h-4 w-4 mr-2 ${isRecording ? 'text-red-500' : ''}`} />
              {isRecording ? 'Stop Recording' : 'Voice Message'}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Call Buttons */}
        {onStartCall && (
          <>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onStartCall('voice')}
              disabled={disabled}
              title="Start voice call"
            >
              <Phone className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onStartCall('video')}
              disabled={disabled}
              title="Start video call"
            >
              <Video className="h-4 w-4" />
            </Button>
          </>
        )}

        {/* Message Input */}
        <div className="flex-1 flex items-end space-x-2">
          <div className="flex-1 relative">
            <Input
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={placeholder}
              disabled={disabled || uploadingFile !== null}
              className="pr-10 resize-none"
              multiline
            />
            
            {/* Emoji Picker */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  size="sm"
                  variant="ghost"
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0"
                  disabled={disabled}
                >
                  <Smile className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" side="top">
                <div className="grid grid-cols-5 gap-1 p-2">
                  {commonEmojis.map((emoji) => (
                    <Button
                      key={emoji}
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 p-0 text-lg"
                      onClick={() => insertEmoji(emoji)}
                    >
                      {emoji}
                    </Button>
                  ))}
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <Button
            onClick={handleSend}
            disabled={disabled || (!message.trim() && !uploadingFile) || uploadingFile !== null}
            size="sm"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Hidden file inputs */}
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        onChange={handleImageSelect}
        className="hidden"
      />
      <input
        ref={fileInputRef}
        type="file"
        onChange={handleFileSelect}
        className="hidden"
      />
    </div>
  );
};

export default MessageInput;