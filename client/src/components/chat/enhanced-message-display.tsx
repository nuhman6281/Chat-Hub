import { useState } from 'react';
import { MessageSquare, MoreHorizontal, Reply, Download, Play, Pause, Volume2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { MessageReactions, EmojiReactionButton } from '@/components/ui/message-reactions';
import { MessageThread } from '@/components/ui/message-thread';
import { formatDistanceToNow } from 'date-fns';
import { useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

interface EnhancedMessageDisplayProps {
  message: any;
  currentUserId: number;
  onReply?: (message: any) => void;
  channelId?: number;
  directMessageId?: number;
}

export function EnhancedMessageDisplay({ 
  message, 
  currentUserId, 
  onReply, 
  channelId, 
  directMessageId 
}: EnhancedMessageDisplayProps) {
  const [showThread, setShowThread] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const { toast } = useToast();

  const reactionMutation = useMutation({
    mutationFn: async ({ emoji }: { emoji: string }) => {
      const response = await apiRequest('POST', `/api/messages/${message.id}/react`, {
        emoji,
        action: 'add'
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/channels'] });
      queryClient.invalidateQueries({ queryKey: ['/api/direct-messages'] });
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to react',
        description: error.message,
        variant: 'destructive',
      });
    }
  });

  const handleReaction = (emoji: string) => {
    reactionMutation.mutate({ emoji });
  };

  const handleDownload = (url: string, filename: string) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const toggleAudioPlayback = () => {
    const audio = document.getElementById(`audio-${message.id}`) as HTMLAudioElement;
    if (audio) {
      if (isPlaying) {
        audio.pause();
      } else {
        audio.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const renderMessageContent = () => {
    switch (message.messageType) {
      case 'image':
        return (
          <div className="mt-2">
            <img
              src={message.mediaUrl}
              alt={message.content}
              className="max-w-sm max-h-64 rounded-lg cursor-pointer"
              onClick={() => window.open(message.mediaUrl, '_blank')}
            />
            <div className="text-xs text-muted-foreground mt-1">
              {message.content} • {formatFileSize(message.mediaSize)}
            </div>
          </div>
        );

      case 'video':
        return (
          <div className="mt-2">
            <video
              src={message.mediaUrl}
              controls
              className="max-w-sm max-h-64 rounded-lg"
            />
            <div className="text-xs text-muted-foreground mt-1">
              {message.content} • {formatFileSize(message.mediaSize)}
            </div>
          </div>
        );

      case 'voice':
        return (
          <div className="mt-2 flex items-center gap-2 bg-muted/50 rounded-lg p-3 max-w-sm">
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleAudioPlayback}
              className="flex-shrink-0"
            >
              {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            </Button>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <Volume2 className="h-3 w-3 text-muted-foreground" />
                <span className="text-sm">{message.content}</span>
              </div>
              <audio
                id={`audio-${message.id}`}
                src={message.mediaUrl}
                onEnded={() => setIsPlaying(false)}
                preload="metadata"
              />
            </div>
          </div>
        );

      case 'file':
        return (
          <div className="mt-2">
            <div className="flex items-center gap-2 bg-muted/50 rounded-lg p-3 max-w-sm">
              <div className="flex-1">
                <div className="font-medium text-sm">{message.content}</div>
                <div className="text-xs text-muted-foreground">
                  {message.mediaType} • {formatFileSize(message.mediaSize)}
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleDownload(message.mediaUrl, message.content)}
              >
                <Download className="h-4 w-4" />
              </Button>
            </div>
          </div>
        );

      default:
        return <div className="text-sm">{message.content}</div>;
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (!bytes) return '0 B';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const mockReactions = [
    { emoji: '👍', count: 2, users: [], hasUserReacted: false },
    { emoji: '❤️', count: 1, users: [], hasUserReacted: true }
  ];

  return (
    <div className="group flex items-start gap-3 p-3 hover:bg-muted/50 transition-colors">
      <Avatar className="h-8 w-8 flex-shrink-0">
        <AvatarFallback>
          {message.user?.displayName?.charAt(0) || 'U'}
        </AvatarFallback>
      </Avatar>

      <div className="flex-1 min-w-0">
        {/* Message header */}
        <div className="flex items-center gap-2 mb-1">
          <span className="font-medium text-sm">{message.user?.displayName}</span>
          <span className="text-xs text-muted-foreground">
            {formatDistanceToNow(new Date(message.createdAt), { addSuffix: true })}
          </span>
          {message.isEdited && (
            <span className="text-xs text-muted-foreground">(edited)</span>
          )}
        </div>

        {/* Reply indicator */}
        {message.replyToId && (
          <div className="text-xs text-muted-foreground mb-1 pl-2 border-l-2 border-muted">
            Replying to a message
          </div>
        )}

        {/* Message content */}
        {renderMessageContent()}

        {/* Reactions */}
        <MessageReactions
          messageId={message.id}
          reactions={mockReactions}
          currentUserId={currentUserId}
        />

        {/* Thread indicator */}
        {message.threadCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="mt-2 h-auto p-2 text-xs"
            onClick={() => setShowThread(true)}
          >
            <MessageSquare className="h-3 w-3 mr-1" />
            {message.threadCount} {message.threadCount === 1 ? 'reply' : 'replies'}
          </Button>
        )}
      </div>

      {/* Message actions */}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <EmojiReactionButton
          messageId={message.id}
          onReact={handleReaction}
        />

        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0"
          onClick={() => setShowThread(true)}
        >
          <MessageSquare className="h-3 w-3" />
        </Button>

        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0"
          onClick={() => onReply?.(message)}
        >
          <Reply className="h-3 w-3" />
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
              <MoreHorizontal className="h-3 w-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onReply?.(message)}>
              Reply
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setShowThread(true)}>
              View thread
            </DropdownMenuItem>
            {message.userId === currentUserId && (
              <>
                <DropdownMenuItem>Edit message</DropdownMenuItem>
                <DropdownMenuItem className="text-destructive">
                  Delete message
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Thread modal */}
      <MessageThread
        isOpen={showThread}
        onClose={() => setShowThread(false)}
        parentMessage={message}
        channelId={channelId}
        directMessageId={directMessageId}
      />
    </div>
  );
}