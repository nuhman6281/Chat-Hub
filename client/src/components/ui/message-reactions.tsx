import { useState } from 'react';
import { Smile, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

interface MessageReactionsProps {
  messageId: number;
  reactions: Array<{
    emoji: string;
    count: number;
    users: Array<{ id: number; displayName: string }>;
    hasUserReacted: boolean;
  }>;
  currentUserId: number;
}

const EMOJI_LIST = [
  '👍', '❤️', '😂', '😮', '😢', '😡',
  '🎉', '👏', '🔥', '💯', '👀', '🤔',
  '😊', '😍', '🤗', '😎', '🙄', '😴',
  '🚀', '⭐', '✨', '💡', '❗', '❓'
];

export function MessageReactions({ messageId, reactions, currentUserId }: MessageReactionsProps) {
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const { toast } = useToast();

  const reactionMutation = useMutation({
    mutationFn: async ({ emoji, action }: { emoji: string; action: 'add' | 'remove' }) => {
      const response = await apiRequest('POST', `/api/messages/${messageId}/react`, {
        emoji,
        action
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
    const existingReaction = reactions.find(r => r.emoji === emoji);
    const action = existingReaction?.hasUserReacted ? 'remove' : 'add';
    
    reactionMutation.mutate({ emoji, action });
    setShowEmojiPicker(false);
  };

  const handleExistingReaction = (emoji: string, hasUserReacted: boolean) => {
    const action = hasUserReacted ? 'remove' : 'add';
    reactionMutation.mutate({ emoji, action });
  };

  return (
    <div className="flex items-center gap-1 mt-1">
      {/* Existing reactions */}
      {reactions.map((reaction) => (
        <Button
          key={reaction.emoji}
          variant={reaction.hasUserReacted ? 'secondary' : 'ghost'}
          size="sm"
          className="h-6 px-2 text-xs"
          onClick={() => handleExistingReaction(reaction.emoji, reaction.hasUserReacted)}
          disabled={reactionMutation.isPending}
        >
          <span className="mr-1">{reaction.emoji}</span>
          <span>{reaction.count}</span>
        </Button>
      ))}

      {/* Add reaction button */}
      <Popover open={showEmojiPicker} onOpenChange={setShowEmojiPicker}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <Plus className="h-3 w-3" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-2">
          <div className="grid grid-cols-6 gap-1">
            {EMOJI_LIST.map((emoji) => (
              <Button
                key={emoji}
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 hover:bg-accent"
                onClick={() => handleReaction(emoji)}
                disabled={reactionMutation.isPending}
              >
                {emoji}
              </Button>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

interface EmojiReactionButtonProps {
  messageId: number;
  onReact: (emoji: string) => void;
}

export function EmojiReactionButton({ messageId, onReact }: EmojiReactionButtonProps) {
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  const handleEmojiSelect = (emoji: string) => {
    onReact(emoji);
    setShowEmojiPicker(false);
  };

  return (
    <Popover open={showEmojiPicker} onOpenChange={setShowEmojiPicker}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <Smile className="h-3 w-3" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-2">
        <div className="text-xs font-medium mb-2 text-muted-foreground">
          React with an emoji
        </div>
        <div className="grid grid-cols-6 gap-1">
          {EMOJI_LIST.map((emoji) => (
            <Button
              key={emoji}
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 hover:bg-accent"
              onClick={() => handleEmojiSelect(emoji)}
            >
              {emoji}
            </Button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}