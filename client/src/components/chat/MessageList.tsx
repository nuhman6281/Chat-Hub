import { useEffect, useRef } from "react";
import { useChat } from "@/hooks/useChat";
import Message from "@/components/chat/Message";
import { format } from "date-fns";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2 } from "lucide-react";

export default function MessageList() {
  const chat = useChat();
  if (!chat) throw new Error("Chat context is null");

  const { messages, isLoadingMessages, activeChannel, activeDM } = chat;
  const messageEndRef = useRef<HTMLDivElement>(null);

  // Ref for the scroll container
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    // Scroll to bottom immediately when channel/DM changes
    if (scrollAreaRef.current && (activeChannel || activeDM)) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
      messageEndRef.current?.scrollIntoView({ behavior: "auto" });
    }
  }, [activeChannel, activeDM]);

  // Separate effect for message updates
  useEffect(() => {
    if (messages.length === 0) return;

    // Use a small timeout to ensure DOM is updated
    const scrollTimer = setTimeout(() => {
      // Check if user is already near the bottom (within 300px)
      const isNearBottom =
        scrollAreaRef.current &&
        scrollAreaRef.current.scrollHeight -
          scrollAreaRef.current.scrollTop -
          scrollAreaRef.current.clientHeight <
          300;

      // Auto-scroll only if user is already near the bottom
      if (isNearBottom) {
        messageEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }
    }, 100);

    return () => clearTimeout(scrollTimer);
  }, [messages.length]);

  // Group messages by date - ensuring correct chronological order
  const messageGroups = messages
    // Sort messages by date (oldest first)
    .sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    )
    .reduce<{
      [date: string]: typeof messages;
    }>((groups, message) => {
      const date = format(new Date(message.createdAt), "yyyy-MM-dd");
      if (!groups[date]) {
        groups[date] = [];
      }
      groups[date].push(message);
      return groups;
    }, {});

  // Get sorted dates (oldest to newest)
  const sortedDates = Object.keys(messageGroups).sort((a, b) => {
    return new Date(a).getTime() - new Date(b).getTime();
  });

  // Format date for display
  const formatDateHeading = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    if (format(date, "yyyy-MM-dd") === format(today, "yyyy-MM-dd")) {
      return "Today";
    } else if (format(date, "yyyy-MM-dd") === format(yesterday, "yyyy-MM-dd")) {
      return "Yesterday";
    }
    return format(date, "MMMM d, yyyy");
  };

  // We'll simplify the typing indicator for now
  // const typingUsers = usersTyping ? Array.from(usersTyping.entries())
  //   .filter(([userId, isTyping]) => isTyping)
  //   .map(([userId]) => userId) : [];

  if (isLoadingMessages) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex flex-col items-center gap-2 text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading messages...</p>
        </div>
      </div>
    );
  }

  if (!activeChannel && !activeDM) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-6">
        <div className="animate-in fade-in-50 slide-in-from-bottom-5 duration-300 ease-in-out">
          <h2 className="text-2xl font-bold mb-3 bg-clip-text text-transparent bg-gradient-to-r from-primary to-primary/70">
            Welcome to ChatHub
          </h2>
          <p className="text-muted-foreground max-w-md mb-6">
            Select a channel or direct message from the sidebar to start
            chatting.
          </p>
          <div className="p-4 rounded-lg border border-border bg-card/50 max-w-md mx-auto">
            <p className="text-sm text-card-foreground">
              <span className="font-medium">💡 Tip:</span> Use the{" "}
              <kbd className="px-1.5 py-0.5 text-xs rounded-md bg-muted text-muted-foreground font-mono">
                #
              </kbd>{" "}
              key to quickly search for a channel.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <ScrollArea className="flex-1 pt-4 overflow-y-auto" ref={scrollAreaRef}>
      <div className="px-4 relative space-y-6">
        {/* Render messages grouped by date */}
        {sortedDates.map((date) => (
          <div key={date} className="space-y-3">
            {/* Date separator */}
            <div className="sticky top-2 z-10 flex justify-center">
              <div className="px-3 py-1 text-xs font-medium rounded-full bg-background/80 backdrop-blur-sm border text-muted-foreground">
                {formatDateHeading(date)}
              </div>
            </div>

            {/* Messages for this date */}
            {messageGroups[date].map((msg) => (
              <Message key={msg.id} message={msg} />
            ))}
          </div>
        ))}

        {/* Uncomment when typing indicator is implemented
        {typingUsers.length > 0 && (
          <div className="flex items-start mt-2">
            <div className="bg-light-300 dark:bg-dark-100 rounded-xl py-2 px-3 text-gray-500 dark:text-gray-400 text-sm">
              <div className="typing-indicator flex items-center">
                Someone is typing
                <span className="mx-1 h-1.5 w-1.5 rounded-full bg-current ml-1"></span>
                <span className="h-1.5 w-1.5 rounded-full bg-current ml-1"></span>
                <span className="h-1.5 w-1.5 rounded-full bg-current ml-1"></span>
              </div>
            </div>
          </div>
        )}
        */}

        <div ref={messageEndRef} />
      </div>
    </ScrollArea>
  );
}
