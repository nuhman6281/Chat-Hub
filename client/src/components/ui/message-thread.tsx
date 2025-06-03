import { useState, useEffect } from 'react';
import { MessageSquare, X, Send, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { formatDistanceToNow } from 'date-fns';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

interface MessageThreadProps {
  isOpen: boolean;
  onClose: () => void;
  parentMessage: any;
  channelId?: number;
  directMessageId?: number;
}

export function MessageThread({ isOpen, onClose, parentMessage, channelId, directMessageId }: MessageThreadProps) {
  const [replyContent, setReplyContent] = useState('');
  const { toast } = useToast();

  // Fetch thread messages
  const { data: threadMessages = [], isLoading } = useQuery({
    queryKey: ['thread-messages', parentMessage?.id],
    queryFn: async () => {
      if (!parentMessage?.id) return [];
      const response = await fetch(`/api/messages/${parentMessage.id}/thread`);
      if (!response.ok) throw new Error('Failed to fetch thread messages');
      return response.json();
    },
    enabled: isOpen && !!parentMessage?.id
  });

  // Send thread reply mutation
  const sendReplyMutation = useMutation({
    mutationFn: async (content: string) => {
      const payload = {
        content,
        messageType: 'text',
        threadId: parentMessage.id,
        replyToId: parentMessage.id,
        ...(channelId ? { channelId } : { directMessageId })
      };
      
      const response = await apiRequest('POST', channelId ? `/api/channels/${channelId}/messages` : `/api/direct-messages/${directMessageId}/messages`, payload);
      return response.json();
    },
    onSuccess: () => {
      setReplyContent('');
      queryClient.invalidateQueries({ queryKey: ['thread-messages', parentMessage?.id] });
      queryClient.invalidateQueries({ queryKey: [channelId ? '/api/channels' : '/api/direct-messages'] });
      toast({
        title: 'Reply sent',
        description: 'Your reply has been added to the thread.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to send reply',
        description: error.message,
        variant: 'destructive',
      });
    }
  });

  const handleSendReply = (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyContent.trim()) return;
    
    sendReplyMutation.mutate(replyContent.trim());
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendReply(e);
    }
  };

  if (!parentMessage) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Thread
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 flex flex-col min-h-0">
          {/* Parent message */}
          <div className="border-b pb-4 mb-4">
            <div className="flex items-start gap-3">
              <Avatar className="h-8 w-8">
                <AvatarFallback>
                  {parentMessage.user?.displayName?.charAt(0) || 'U'}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-sm">{parentMessage.user?.displayName}</span>
                  <span className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(parentMessage.createdAt), { addSuffix: true })}
                  </span>
                </div>
                <div className="text-sm">{parentMessage.content}</div>
                <div className="text-xs text-muted-foreground mt-2">
                  {threadMessages.length} {threadMessages.length === 1 ? 'reply' : 'replies'}
                </div>
              </div>
            </div>
          </div>

          {/* Thread messages */}
          <ScrollArea className="flex-1 pr-4">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : (
              <div className="space-y-4">
                {threadMessages.map((message: any) => (
                  <div key={message.id} className="flex items-start gap-3">
                    <Avatar className="h-7 w-7">
                      <AvatarFallback className="text-xs">
                        {message.user?.displayName?.charAt(0) || 'U'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-sm">{message.user?.displayName}</span>
                        <span className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(message.createdAt), { addSuffix: true })}
                        </span>
                      </div>
                      <div className="text-sm">{message.content}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>

          {/* Reply input */}
          <div className="border-t pt-4 mt-4">
            <form onSubmit={handleSendReply} className="flex gap-2">
              <Input
                value={replyContent}
                onChange={(e) => setReplyContent(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Reply to thread..."
                className="flex-1"
                disabled={sendReplyMutation.isPending}
              />
              <Button 
                type="submit" 
                disabled={!replyContent.trim() || sendReplyMutation.isPending}
                size="sm"
              >
                {sendReplyMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </form>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}