import React from "react";
import { useChat } from "@/contexts/ChatContext";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Phone } from "lucide-react";

interface VoiceCallModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const VoiceCallModal: React.FC<VoiceCallModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { activeChannel, activeDM } = useChat();
  const { user } = useAuth();

  if (!activeChannel && !activeDM) return null;

  const handleVoiceCall = () => {
    // Implement voice call functionality
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={handleVoiceCall}
      className="text-gray-600 dark:text-gray-300"
    >
      <Phone className="h-5 w-5" />
    </Button>
  );
};
