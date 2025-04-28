import { Button } from "@/components/ui/button";
import { useChat } from "@/hooks/useChat";
import { ChevronDown, Video, Phone, UserPlus, Info } from "lucide-react";

interface ChannelHeaderProps {
  onVideoCall: () => void;
  onVoiceCall: () => void;
}

export default function ChannelHeader({ onVideoCall, onVoiceCall }: ChannelHeaderProps) {
  const { activeChat, activeChannel } = useChat();
  
  if (!activeChat) return null;
  
  return (
    <div className="h-14 border-b border-gray-200 dark:border-dark-100 flex items-center px-4 bg-white dark:bg-dark-200">
      <div className="flex-1">
        <div className="flex items-center">
          {activeChat.type === "channel" ? (
            <>
              <span className="text-gray-500 dark:text-gray-400 mr-2">#</span>
              <h2 className="font-semibold">{activeChat.name}</h2>
            </>
          ) : (
            <h2 className="font-semibold">{activeChat.name}</h2>
          )}
          <Button variant="ghost" size="icon" className="ml-1 h-6 w-6">
            <ChevronDown className="h-4 w-4 text-gray-400" />
          </Button>
        </div>
        
        {activeChat.type === "channel" && activeChannel && (
          <div className="text-xs text-gray-500 dark:text-gray-400">
            <span>{activeChannel.memberCount} members</span>
            {activeChannel.description && (
              <>
                <span className="mx-1">•</span>
                <span>{activeChannel.description}</span>
              </>
            )}
          </div>
        )}
      </div>
      
      <div className="flex items-center space-x-2">
        <Button 
          variant="ghost" 
          size="icon"
          onClick={onVoiceCall}
          className="text-gray-600 dark:text-gray-300"
        >
          <Phone className="h-5 w-5" />
        </Button>
        <Button 
          variant="ghost" 
          size="icon"
          onClick={onVideoCall}
          className="text-gray-600 dark:text-gray-300"
        >
          <Video className="h-5 w-5" />
        </Button>
        <Button variant="ghost" size="icon" className="text-gray-600 dark:text-gray-300">
          <UserPlus className="h-5 w-5" />
        </Button>
        <Button variant="ghost" size="icon" className="text-gray-600 dark:text-gray-300">
          <Info className="h-5 w-5" />
        </Button>
      </div>
    </div>
  );
}
