import { useAuth } from "@/hooks/useAuth";
import { useChat } from "@/hooks/useChat";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import UserAvatar from "@/components/UserAvatar";
import { cn } from "@/lib/utils";
import { Plus, Search, LayoutGrid, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";

interface ChannelSidebarProps {
  className?: string;
  onCreateChannel: () => void;
  onCreateDirectMessage: () => void;
}

export default function ChannelSidebar({ 
  className, 
  onCreateChannel, 
  onCreateDirectMessage 
}: ChannelSidebarProps) {
  const { user } = useAuth();
  const { 
    activeWorkspace, 
    channels, 
    directMessages, 
    setActiveChannelById, 
    setActiveDirectMessageById,
    activeChannel,
    activeDirectMessage
  } = useChat();
  
  // Function to truncate text
  const truncate = (text: string, maxLength: number) => {
    if (!text) return '';
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
  };
  
  return (
    <div className={cn("flex flex-col bg-light-300 dark:bg-dark-200 w-64 shrink-0 border-r border-gray-200 dark:border-dark-100", className)}>
      <div className="p-4 border-b border-gray-200 dark:border-dark-100">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">
            {activeWorkspace?.name || "ChatHub"}
          </h2>
          <Button variant="ghost" size="icon">
            <Search className="h-4 w-4" />
          </Button>
        </div>
        <div className="mt-2 relative">
          <Input
            placeholder="Search channels and messages"
            className="bg-light-200 dark:bg-dark-100 pr-8"
          />
          <Search className="absolute right-3 top-2.5 h-4 w-4 text-gray-400" />
        </div>
      </div>
      
      <Tabs defaultValue="channels" className="flex-1 flex flex-col">
        <TabsList className="mx-3 mt-3 h-auto p-1">
          <TabsTrigger value="channels" className="flex-1 py-1.5 gap-1.5">
            <LayoutGrid className="h-4 w-4" />
            Channels
          </TabsTrigger>
          <TabsTrigger value="direct" className="flex-1 py-1.5 gap-1.5">
            <Users className="h-4 w-4" />
            Direct
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="channels" className="flex-1 overflow-y-auto scrollbar-thin">
          <div className="p-3">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs uppercase font-semibold text-gray-500 dark:text-gray-400">
                Channels
              </h3>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-5 w-5 text-gray-500 dark:text-gray-400"
                onClick={onCreateChannel}
              >
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </div>
            
            {channels.length === 0 ? (
              <div className="text-center py-3 text-sm text-gray-500">
                No channels yet. Create one to get started!
              </div>
            ) : (
              channels.map((channel) => (
                <Button
                  key={channel.id}
                  variant="ghost"
                  className={cn(
                    "w-full justify-start px-2 py-1.5 h-auto mb-1 font-medium",
                    channel.id === activeChannel?.id && "bg-light-400 dark:bg-dark-100"
                  )}
                  onClick={() => setActiveChannelById(channel.id)}
                >
                  <span className="text-gray-500 dark:text-gray-400 mr-2">#</span>
                  <span className="truncate">{channel.name}</span>
                  {channel.id % 2 === 0 && (
                    <Badge variant="destructive" className="ml-auto text-xs">
                      2
                    </Badge>
                  )}
                </Button>
              ))
            )}
          </div>
        </TabsContent>
        
        <TabsContent value="direct" className="flex-1 overflow-y-auto scrollbar-thin">
          <div className="p-3">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs uppercase font-semibold text-gray-500 dark:text-gray-400">
                Direct Messages
              </h3>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-5 w-5 text-gray-500 dark:text-gray-400"
                onClick={onCreateDirectMessage}
              >
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </div>
            
            {directMessages.length === 0 ? (
              <div className="text-center py-3 text-sm text-gray-500">
                No conversations yet. Start chatting!
              </div>
            ) : (
              directMessages.map((dm) => (
                <Button
                  key={dm.id}
                  variant="ghost"
                  className={cn(
                    "w-full flex items-center p-2 mb-1 h-auto",
                    dm.id === activeDirectMessage?.id && "bg-light-400 dark:bg-dark-100"
                  )}
                  onClick={() => setActiveDirectMessageById(dm.id)}
                >
                  <div className="relative mr-3">
                    <UserAvatar 
                      user={dm.otherUser} 
                      className="h-8 w-8"
                      showStatus
                    />
                  </div>
                  <div className="flex-1 text-left">
                    <div className="flex items-center justify-between">
                      <span className={cn(
                        "font-medium text-sm",
                        dm.id === activeDirectMessage?.id && "text-primary"
                      )}>
                        {dm.otherUser.displayName}
                      </span>
                      {dm.lastMessage && (
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {formatDistanceToNow(new Date(dm.lastMessage.createdAt), { addSuffix: true })}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                      {dm.lastMessage 
                        ? truncate(dm.lastMessage.content, 20)
                        : "No messages yet"}
                    </p>
                  </div>
                </Button>
              ))
            )}
          </div>
        </TabsContent>
      </Tabs>
      
      {/* User status area */}
      <div className="p-3 border-t border-gray-200 dark:border-dark-100 bg-light-200 dark:bg-dark-300">
        <div className="flex items-center">
          <UserAvatar 
            user={user}
            className="h-9 w-9 mr-3"
            showStatus 
          />
          <div>
            <div className="font-medium text-sm">{user?.displayName}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center">
              <span className="w-2 h-2 bg-success rounded-full mr-1"></span>
              Active
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
