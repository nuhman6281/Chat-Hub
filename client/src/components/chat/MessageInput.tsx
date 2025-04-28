import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useChat } from "@/hooks/useChat";
import { 
  Bold, 
  Italic, 
  Link, 
  Code, 
  ListOrdered, 
  Smile, 
  Paperclip, 
  AtSign, 
  Send, 
  PlusCircle
} from "lucide-react";

export default function MessageInput() {
  const { activeChat, sendMessage, setTyping } = useChat();
  const [message, setMessage] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessage(e.target.value);
    
    // Handle typing indicator
    if (!isTyping) {
      setIsTyping(true);
      setTyping(true);
    }
    
    // Reset typing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    // Set typing timeout - stop typing indicator after 3 seconds of inactivity
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      setTyping(false);
    }, 3000);
  };

  const handleSendMessage = () => {
    if (!message.trim() || !activeChat) return;
    
    sendMessage(message.trim());
    setMessage("");
    
    // Reset typing status
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    setIsTyping(false);
    setTyping(false);
    
    // Focus textarea after sending
    textareaRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Send message on Enter (without Shift)
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const newHeight = Math.min(textareaRef.current.scrollHeight, 120);
      textareaRef.current.style.height = `${newHeight}px`;
    }
  }, [message]);

  // Disable the input if there's no active chat
  if (!activeChat) return null;

  const channelName = activeChat.type === "channel" ? activeChat.name : activeChat.name;
  const placeholder = `Message ${activeChat.type === "channel" ? "#" + channelName : channelName}`;

  return (
    <div className="p-3 border-t border-gray-200 dark:border-dark-100 bg-white dark:bg-dark-200">
      <div className="flex items-center mb-2">
        <Button variant="ghost" size="icon" className="text-gray-500 dark:text-gray-400 mr-1 h-8 w-8">
          <PlusCircle className="h-5 w-5" />
        </Button>
        <Button variant="ghost" size="icon" className="text-gray-500 dark:text-gray-400 mr-1 h-8 w-8">
          <Bold className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" className="text-gray-500 dark:text-gray-400 mr-1 h-8 w-8">
          <Italic className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" className="text-gray-500 dark:text-gray-400 mr-1 h-8 w-8">
          <Link className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" className="text-gray-500 dark:text-gray-400 mr-1 h-8 w-8">
          <Code className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" className="text-gray-500 dark:text-gray-400 mr-1 h-8 w-8">
          <ListOrdered className="h-4 w-4" />
        </Button>
      </div>
      
      <div className="relative">
        <Textarea
          ref={textareaRef}
          value={message}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="w-full py-2 px-3 bg-light-300 dark:bg-dark-100 rounded-lg resize-none min-h-[40px] pr-24"
          rows={1}
        />
        
        <div className="absolute bottom-2 right-2 flex items-center space-x-2">
          <Button variant="ghost" size="icon" className="text-gray-500 dark:text-gray-400 h-8 w-8">
            <Smile className="h-5 w-5" />
          </Button>
          <Button variant="ghost" size="icon" className="text-gray-500 dark:text-gray-400 h-8 w-8">
            <Paperclip className="h-5 w-5" />
          </Button>
          <Button variant="ghost" size="icon" className="text-gray-500 dark:text-gray-400 h-8 w-8">
            <AtSign className="h-5 w-5" />
          </Button>
          <Button 
            size="icon" 
            className="bg-primary text-white rounded-full h-8 w-8 hover:bg-primary/90"
            onClick={handleSendMessage}
            disabled={!message.trim()}
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
