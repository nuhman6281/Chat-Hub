import { useState } from "react";
import { Message as MessageType } from "@/contexts/ChatContext";
import UserAvatar from "@/components/UserAvatar";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { Smile, Reply, MoreHorizontal, ThumbsUp, Heart, Download } from "lucide-react";
import { Button } from "@/components/ui/button";

interface MessageProps {
  message: MessageType;
}

export default function Message({ message }: MessageProps) {
  const [showActions, setShowActions] = useState(false);
  
  // Simple URL detection regex
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  
  // Simple code block detection
  const codeBlockRegex = /```([\s\S]*?)```/g;
  
  // Format message content with code blocks and links
  const formatContent = (content: string) => {
    // Replace code blocks first
    let formattedContent = content.replace(codeBlockRegex, (match, code) => {
      return `<pre class="bg-light-300 dark:bg-dark-100 rounded-lg p-3 border border-gray-200 dark:border-dark-100 text-sm font-mono overflow-x-auto my-2">${code}</pre>`;
    });
    
    // Then replace URLs
    formattedContent = formattedContent.replace(urlRegex, (url) => {
      return `<a href="${url}" target="_blank" rel="noopener noreferrer" class="text-primary hover:underline">${url}</a>`;
    });
    
    return formattedContent;
  };
  
  // Check if the message contains a file attachment
  const hasFileAttachment = message.content.includes("file:");
  
  return (
    <div 
      className="mb-6 animate-[messageIn_0.3s_ease-out_forwards]"
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      <div className="flex items-start group">
        <UserAvatar 
          user={message.user} 
          className="h-10 w-10 mr-3"
        />
        
        <div className="flex-1">
          <div className="flex items-center">
            <h4 className="font-medium">{message.user.displayName}</h4>
            <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">
              {format(new Date(message.createdAt), "h:mm a")}
            </span>
            
            {/* Message actions */}
            <div className={cn(
              "ml-2 items-center space-x-1",
              showActions ? "flex" : "hidden"
            )}>
              <Button variant="ghost" size="icon" className="h-6 w-6">
                <Smile className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="icon" className="h-6 w-6">
                <Reply className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="icon" className="h-6 w-6">
                <MoreHorizontal className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
          
          {/* Message content */}
          <div className="mt-1 text-gray-800 dark:text-gray-200 text-sm">
            {hasFileAttachment ? (
              // File attachment card
              <div className="bg-light-300 dark:bg-dark-100 rounded-lg p-3 border border-gray-200 dark:border-dark-100 max-w-xl mt-1">
                <div className="flex items-center">
                  <div className="mr-2 text-blue-500">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div>
                    <div className="text-sm font-medium">Document.pdf</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">2.4 MB • PDF File</div>
                  </div>
                  <Button variant="ghost" size="icon" className="ml-auto">
                    <Download className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ) : (
              <div 
                dangerouslySetInnerHTML={{ 
                  __html: formatContent(message.content) 
                }}
              />
            )}
          </div>
          
          {/* Message reactions */}
          <div className="mt-2 flex items-center space-x-1">
            <Button variant="outline" size="sm" className="h-6 px-2 rounded-full text-xs">
              <ThumbsUp className="h-3 w-3 text-blue-500 mr-1" />
              <span>8</span>
            </Button>
            <Button variant="outline" size="sm" className="h-6 px-2 rounded-full text-xs">
              <Heart className="h-3 w-3 text-red-500 mr-1" />
              <span>5</span>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
