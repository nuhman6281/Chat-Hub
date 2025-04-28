import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useChat } from "@/hooks/useChat";
import { useAuth } from "@/hooks/useAuth";
import { X, MicOff, Volume2, PhoneOff, UserPlus } from "lucide-react";
import UserAvatar from "@/components/UserAvatar";

interface VoiceCallModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function VoiceCallModal({ isOpen, onClose }: VoiceCallModalProps) {
  const { activeChat, activeChannel, activeDirectMessage } = useChat();
  const { user } = useAuth();
  
  if (!activeChat) return null;

  const mockParticipants = [
    { id: 1, displayName: "Sarah Johnson", status: "online" },
    { id: 2, displayName: "David Wilson", status: "online" },
    { id: 3, displayName: "Emily Chen", status: "online" }
  ];
  
  // Use actual user data if available
  const participants = activeDirectMessage 
    ? [activeDirectMessage.otherUser] 
    : mockParticipants;
  
  // Group initial for channels or direct message display name
  const chatInitials = activeChat.type === "channel" 
    ? activeChat.name.substring(0, 2).toUpperCase()
    : activeChat.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md p-0 overflow-hidden">
        <DialogHeader className="p-4 border-b border-gray-200 dark:border-dark-100 flex items-center justify-between">
          <div className="flex items-center">
            <PhoneOff className="text-primary mr-2 h-5 w-5" />
            <DialogTitle>
              Voice Call - {activeChat.type === "channel" ? "#" + activeChat.name : activeChat.name}
            </DialogTitle>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8">
            <X className="h-4 w-4" />
          </Button>
        </DialogHeader>
        
        <div className="p-8 flex flex-col items-center">
          <div className="w-24 h-24 rounded-full bg-gradient-to-r from-primary to-secondary flex items-center justify-center text-white text-3xl font-bold mb-4">
            {chatInitials}
          </div>
          
          <h3 className="text-xl font-semibold mb-1">{activeChat.name}</h3>
          <p className="text-gray-500 dark:text-gray-400 mb-6">Voice call in progress...</p>
          
          <div className="flex items-center space-x-3 mb-8">
            {participants.map((participant, index) => (
              <div key={index} className="flex items-center justify-center">
                <UserAvatar
                  user={participant}
                  className="h-10 w-10"
                  showStatus
                />
              </div>
            ))}
            
            {user && (
              <div className="flex items-center justify-center">
                <UserAvatar
                  user={user}
                  className="h-10 w-10"
                  showStatus
                />
              </div>
            )}
            
            <Button 
              variant="outline" 
              size="icon" 
              className="flex items-center justify-center w-10 h-10 rounded-full bg-light-300 dark:bg-dark-100 text-gray-600 dark:text-gray-300"
            >
              <UserPlus className="h-4 w-4" />
            </Button>
          </div>
          
          <div className="flex items-center space-x-4">
            <Button 
              variant="outline" 
              size="icon" 
              className="h-12 w-12 rounded-full bg-gray-200 dark:bg-dark-100 hover:bg-gray-300 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300"
            >
              <MicOff className="h-5 w-5" />
            </Button>
            <Button 
              variant="outline" 
              size="icon" 
              className="h-12 w-12 rounded-full bg-gray-200 dark:bg-dark-100 hover:bg-gray-300 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300"
            >
              <Volume2 className="h-5 w-5" />
            </Button>
            <Button 
              variant="destructive" 
              size="icon" 
              onClick={onClose}
              className="h-12 w-12 rounded-full animate-pulse"
            >
              <PhoneOff className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
