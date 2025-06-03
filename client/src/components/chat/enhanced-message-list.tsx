import { useState, useEffect, useRef } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Search, ArrowDown } from 'lucide-react';
import { EnhancedMessageDisplay } from './enhanced-message-display';
import { MessageSearchModal } from '@/components/ui/message-search';
import { useAuth } from '@/hooks/use-auth';

interface EnhancedMessageListProps {
  messages: any[];
  channelId?: number;
  directMessageId?: number;
  onReply?: (message: any) => void;
  className?: string;
}

export function EnhancedMessageList({ 
  messages, 
  channelId, 
  directMessageId, 
  onReply,
  className 
}: EnhancedMessageListProps) {
  const [showSearch, setShowSearch] = useState(false);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const { user } = useAuth();

  useEffect(() => {
    // Auto-scroll to bottom when new messages arrive
    if (scrollAreaRef.current) {
      const scrollElement = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollElement) {
        scrollElement.scrollTop = scrollElement.scrollHeight;
      }
    }
  }, [messages]);

  const handleScroll = (event: React.UIEvent<HTMLDivElement>) => {
    const element = event.currentTarget;
    const isAtBottom = element.scrollHeight - element.scrollTop <= element.clientHeight + 100;
    setShowScrollButton(!isAtBottom);
  };

  const scrollToBottom = () => {
    if (scrollAreaRef.current) {
      const scrollElement = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollElement) {
        scrollElement.scrollTop = scrollElement.scrollHeight;
      }
    }
  };

  const handleMessageSelect = (messageId: number, targetChannelId?: number, targetDirectMessageId?: number) => {
    // Find and highlight the selected message
    const messageElement = document.getElementById(`message-${messageId}`);
    if (messageElement) {
      messageElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      messageElement.classList.add('bg-accent');
      setTimeout(() => {
        messageElement.classList.remove('bg-accent');
      }, 2000);
    }
  };

  const groupMessagesByDate = (messages: any[]) => {
    const groups: { [key: string]: any[] } = {};
    
    messages.forEach(message => {
      const date = new Date(message.createdAt).toDateString();
      if (!groups[date]) {
        groups[date] = [];
      }
      groups[date].push(message);
    });
    
    return groups;
  };

  const messageGroups = groupMessagesByDate(messages);

  const formatDateHeader = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString('en-US', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });
    }
  };

  if (!user) return null;

  return (
    <div className={`relative flex-1 ${className}`}>
      {/* Search button */}
      <div className="absolute top-4 right-4 z-10">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setShowSearch(true)}
          className="shadow-md"
        >
          <Search className="h-4 w-4" />
        </Button>
      </div>

      {/* Messages */}
      <ScrollArea 
        ref={scrollAreaRef}
        className="h-full"
        onScroll={handleScroll}
      >
        <div className="p-4 space-y-6">
          {Object.entries(messageGroups).map(([date, groupMessages]) => (
            <div key={date}>
              {/* Date header */}
              <div className="flex items-center justify-center my-4">
                <div className="bg-muted px-3 py-1 rounded-full text-xs font-medium text-muted-foreground">
                  {formatDateHeader(date)}
                </div>
              </div>

              {/* Messages for this date */}
              <div className="space-y-1">
                {groupMessages.map((message, index) => {
                  const prevMessage = index > 0 ? groupMessages[index - 1] : null;
                  const isGrouped = prevMessage && 
                    prevMessage.userId === message.userId &&
                    new Date(message.createdAt).getTime() - new Date(prevMessage.createdAt).getTime() < 5 * 60 * 1000; // 5 minutes

                  return (
                    <div key={message.id} id={`message-${message.id}`}>
                      <EnhancedMessageDisplay
                        message={message}
                        currentUserId={user.id}
                        onReply={onReply}
                        channelId={channelId}
                        directMessageId={directMessageId}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          {messages.length === 0 && (
            <div className="flex items-center justify-center h-32 text-muted-foreground">
              <div className="text-center">
                <div className="text-sm">No messages yet</div>
                <div className="text-xs mt-1">Start the conversation!</div>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Scroll to bottom button */}
      {showScrollButton && (
        <div className="absolute bottom-4 right-4">
          <Button
            variant="secondary"
            size="sm"
            onClick={scrollToBottom}
            className="rounded-full shadow-md"
          >
            <ArrowDown className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Search modal */}
      <MessageSearchModal
        isOpen={showSearch}
        onClose={() => setShowSearch(false)}
        messages={messages}
        onMessageSelect={handleMessageSelect}
      />
    </div>
  );
}