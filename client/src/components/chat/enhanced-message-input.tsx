import { useState, useRef } from 'react';
import { Send, Paperclip, Mic, Search, Smile } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FileUpload } from '@/components/ui/file-upload';
import { VoiceRecorder, QuickVoiceButton } from '@/components/ui/voice-recorder';
import { MessageSearchModal } from '@/components/ui/message-search';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useChat } from '@/contexts/ChatContext';

interface EnhancedMessageInputProps {
  channelId?: number;
  directMessageId?: number;
  replyTo?: any;
  onClearReply?: () => void;
}

export function EnhancedMessageInput({ 
  channelId, 
  directMessageId, 
  replyTo, 
  onClearReply 
}: EnhancedMessageInputProps) {
  const [message, setMessage] = useState('');
  const [showFileUpload, setShowFileUpload] = useState(false);
  const [showVoiceRecorder, setShowVoiceRecorder] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const { sendMessage, messages } = useChat();
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;

    const payload: any = {
      content: message.trim(),
      messageType: 'text'
    };

    if (replyTo) {
      payload.replyToId = replyTo.id;
      payload.threadId = replyTo.threadId || replyTo.id; // Start new thread or continue existing
    }

    const success = await sendMessage(
      payload.content,
      channelId,
      directMessageId,
      payload.messageType,
      undefined
    );

    if (success) {
      setMessage('');
      onClearReply?.();
    }
  };

  const handleFileSelect = async (file: File, preview?: string) => {
    // Convert file to base64 for sending
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result as string;
      
      const payload: any = {
        content: file.name,
        messageType: file.type.startsWith('image/') ? 'image' : 
                    file.type.startsWith('video/') ? 'video' :
                    file.type.startsWith('audio/') ? 'audio' : 'file',
        mediaUrl: base64,
        mediaType: file.type,
        mediaSize: file.size
      };

      if (replyTo) {
        payload.replyToId = replyTo.id;
        payload.threadId = replyTo.threadId || replyTo.id;
      }

      await sendMessage(
        payload.content,
        channelId,
        directMessageId,
        payload.messageType,
        file
      );
    };
    reader.readAsDataURL(file);
    setShowFileUpload(false);
  };

  const handleVoiceMessage = async (audioBlob: Blob, duration: number) => {
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result as string;
      
      const payload: any = {
        content: `Voice message (${Math.round(duration)}s)`,
        messageType: 'voice',
        mediaUrl: base64,
        mediaType: 'audio/webm',
        mediaSize: audioBlob.size
      };

      if (replyTo) {
        payload.replyToId = replyTo.id;
        payload.threadId = replyTo.threadId || replyTo.id;
      }

      await sendMessage(
        payload.content,
        channelId,
        directMessageId,
        payload.messageType,
        new File([audioBlob], 'voice-message.webm', { type: 'audio/webm' })
      );
    };
    reader.readAsDataURL(audioBlob);
  };

  const handleMessageSelect = (messageId: number, targetChannelId?: number, targetDirectMessageId?: number) => {
    // Navigate to the selected message
    console.log('Navigate to message:', messageId, targetChannelId, targetDirectMessageId);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend(e);
    }
  };

  return (
    <div className="border-t bg-background p-4">
      {/* Reply indicator */}
      {replyTo && (
        <div className="mb-2 p-2 bg-muted rounded-lg flex items-center justify-between">
          <div className="text-sm">
            <span className="text-muted-foreground">Replying to </span>
            <span className="font-medium">{replyTo.user?.displayName}</span>
            <div className="text-xs text-muted-foreground truncate">
              {replyTo.content}
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={onClearReply}>
            ×
          </Button>
        </div>
      )}

      <form onSubmit={handleSend} className="flex items-end gap-2">
        {/* Main input area */}
        <div className="flex-1 relative">
          <Input
            ref={inputRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={replyTo ? "Reply..." : "Type a message..."}
            className="pr-12"
          />
          
          {/* Emoji button */}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="absolute right-2 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0"
          >
            <Smile className="h-4 w-4" />
          </Button>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-1">
          {/* Search button */}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setShowSearch(true)}
          >
            <Search className="h-4 w-4" />
          </Button>

          {/* File upload button */}
          <Dialog open={showFileUpload} onOpenChange={setShowFileUpload}>
            <DialogTrigger asChild>
              <Button type="button" variant="ghost" size="sm">
                <Paperclip className="h-4 w-4" />
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Share Files</DialogTitle>
              </DialogHeader>
              <FileUpload
                onFileSelect={handleFileSelect}
                accept="*/*"
                maxSize={50 * 1024 * 1024} // 50MB
                multiple={false}
              />
            </DialogContent>
          </Dialog>

          {/* Voice recording */}
          <QuickVoiceButton onVoiceMessage={handleVoiceMessage} />
          
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setShowVoiceRecorder(true)}
          >
            <Mic className="h-4 w-4" />
          </Button>

          {/* Send button */}
          <Button 
            type="submit" 
            disabled={!message.trim()}
            size="sm"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </form>

      {/* Modals */}
      <VoiceRecorder
        isOpen={showVoiceRecorder}
        onClose={() => setShowVoiceRecorder(false)}
        onVoiceMessage={handleVoiceMessage}
      />

      <MessageSearchModal
        isOpen={showSearch}
        onClose={() => setShowSearch(false)}
        messages={messages}
        onMessageSelect={handleMessageSelect}
      />
    </div>
  );
}