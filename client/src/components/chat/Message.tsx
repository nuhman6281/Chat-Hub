import React from "react";
import { MessageWithUser } from "@shared/schema";
import { useAuth } from "@/contexts/AuthContext";

interface MessageProps {
  message: MessageWithUser;
}

export default function Message({ message }: MessageProps) {
  const { user: currentUser } = useAuth();

  return (
    <div className="message">
      <div className="message-content">{message.content}</div>
      <div className="message-user">{message.user.username}</div>
    </div>
  );
}
