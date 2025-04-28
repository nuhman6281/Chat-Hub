import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useChat } from "@/hooks/useChat";
import { useAuth } from "@/hooks/useAuth";
import { X, Maximize, Mic, MicOff, Video, VideoOff, Monitor, MoreHorizontal, PhoneOff } from "lucide-react";

interface VideoCallModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function VideoCallModal({ isOpen, onClose }: VideoCallModalProps) {
  const { activeChat } = useChat();
  const { user } = useAuth();
  
  if (!activeChat) return null;
  
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl p-0 overflow-hidden">
        <DialogHeader className="p-4 border-b border-gray-200 dark:border-dark-100 flex items-center justify-between">
          <div className="flex items-center">
            <Video className="text-primary mr-2 h-5 w-5" />
            <DialogTitle>
              Video Call - {activeChat.type === "channel" ? "#" + activeChat.name : activeChat.name}
            </DialogTitle>
          </div>
          <div className="flex items-center space-x-2">
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <Maximize className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>
        
        <div className="p-0 bg-gray-800 relative h-96 flex flex-wrap justify-center items-center">
          <div className="w-full h-full absolute top-0 left-0 right-0 bottom-0 z-0">
            <div className="w-full h-full bg-gradient-to-r from-gray-900 to-gray-800 flex items-center justify-center">
              <div className="text-center text-white">
                <VideoOff className="mx-auto h-10 w-10 mb-2 opacity-50" />
                <p className="text-gray-300">Waiting for participants...</p>
              </div>
            </div>
          </div>
          
          {/* User's own video preview */}
          <div className="absolute bottom-4 right-4 h-36 w-48 bg-gray-900 rounded-lg overflow-hidden z-10 shadow-lg border-2 border-primary">
            <div className="w-full h-full relative">
              {user?.avatarUrl ? (
                <img 
                  src={user.avatarUrl} 
                  className="w-full h-full object-cover" 
                  alt="Your video" 
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gray-800">
                  <div className="h-14 w-14 rounded-full bg-primary flex items-center justify-center text-white text-xl font-semibold">
                    {user?.displayName?.charAt(0) || "U"}
                  </div>
                </div>
              )}
              <div className="absolute bottom-1 left-1 text-xs text-white bg-black bg-opacity-50 px-2 py-0.5 rounded">
                You
              </div>
            </div>
          </div>
        </div>
        
        <div className="p-4 bg-gray-900 flex items-center justify-center space-x-4">
          <Button 
            variant="outline" 
            size="icon" 
            className="bg-gray-700 hover:bg-gray-600 border-0 text-white h-12 w-12 rounded-full"
          >
            <MicOff className="h-5 w-5" />
          </Button>
          <Button 
            variant="outline" 
            size="icon" 
            className="bg-gray-700 hover:bg-gray-600 border-0 text-white h-12 w-12 rounded-full"
          >
            <Video className="h-5 w-5" />
          </Button>
          <Button 
            variant="outline" 
            size="icon" 
            className="bg-gray-700 hover:bg-gray-600 border-0 text-white h-12 w-12 rounded-full"
          >
            <Monitor className="h-5 w-5" />
          </Button>
          <Button 
            variant="outline" 
            size="icon" 
            className="bg-gray-700 hover:bg-gray-600 border-0 text-white h-12 w-12 rounded-full"
          >
            <MoreHorizontal className="h-5 w-5" />
          </Button>
          <Button 
            variant="destructive" 
            size="icon" 
            onClick={onClose}
            className="animate-pulse h-12 w-12 rounded-full"
          >
            <PhoneOff className="h-5 w-5" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
