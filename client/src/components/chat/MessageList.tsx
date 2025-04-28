import { useEffect, useRef } from "react";
import { useChat } from "@/hooks/useChat";
import Message from "@/components/chat/Message";
import { format } from "date-fns";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

export default function MessageList() {
  const { messages, usersTyping, activeChat } = useChat();
  const messageEndRef = useRef<HTMLDivElement>(null);
  
  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);
  
  // Group messages by date
  const messageGroups = messages.reduce<{
    [date: string]: typeof messages;
  }>((groups, message) => {
    const date = format(new Date(message.createdAt), "yyyy-MM-dd");
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(message);
    return groups;
  }, {});
  
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
  
  // Check for typing users
  const typingUsers = Array.from(usersTyping.entries())
    .filter(([userId, isTyping]) => isTyping)
    .map(([userId]) => userId);
  
  return (
    <div className="flex-1 overflow-y-auto p-4 scrollbar-thin bg-light-100 dark:bg-dark-300">
      {Object.entries(messageGroups).map(([date, dateMessages]) => (
        <div key={date}>
          <div className="flex items-center justify-center my-4">
            <Separator className="flex-grow" />
            <div className="mx-4 text-xs text-gray-500 dark:text-gray-400 font-medium">
              {formatDateHeading(date)}
            </div>
            <Separator className="flex-grow" />
          </div>
          
          {dateMessages.map((message) => (
            <Message
              key={message.id}
              message={message}
            />
          ))}
        </div>
      ))}
      
      {/* Typing indicator */}
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
      
      <div ref={messageEndRef} />
    </div>
  );
}
