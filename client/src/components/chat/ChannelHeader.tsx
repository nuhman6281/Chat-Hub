import React from "react";
import { useChat } from "@/contexts/ChatContext";
import { Button } from "@/components/ui/button";
import { VideoCallModal } from "@/components/modals/VideoCallModal";
import { VoiceCallModal } from "@/components/modals/VoiceCallModal";
import { ChevronDown, Video, Phone, UserPlus, Info } from "lucide-react";

export const ChannelHeader: React.FC = () => {
  const { activeChannel, activeDM } = useChat();

  if (!activeChannel && !activeDM) return null;

  const name = activeChannel?.name || activeDM?.otherUser.displayName;
  const isDirectMessage = !!activeDM;

  return (
    <div className="flex items-center justify-between p-4 border-b">
      <div className="flex items-center space-x-4">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground">
            {name
              ?.split(" ")
              .map((n) => n[0])
              .join("")
              .substring(0, 2)
              .toUpperCase()}
          </div>
          <h2 className="text-lg font-semibold">{name}</h2>
        </div>
      </div>
      <div className="flex items-center space-x-2">
        <VideoCallModal isOpen={false} onClose={() => {}} />
        <VoiceCallModal isOpen={false} onClose={() => {}} />
      </div>
    </div>
  );
};
