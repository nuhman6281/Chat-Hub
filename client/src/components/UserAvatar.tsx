import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

interface User {
  id?: number;
  displayName?: string;
  username?: string;
  status?: string;
  avatarUrl?: string;
}

interface UserAvatarProps {
  user?: User | null;
  className?: string;
  showStatus?: boolean;
}

export default function UserAvatar({ user, className, showStatus = false }: UserAvatarProps) {
  if (!user) {
    return (
      <Avatar className={className}>
        <AvatarFallback>?</AvatarFallback>
      </Avatar>
    );
  }

  // Get initial from display name or username
  const getInitials = () => {
    if (user.displayName) {
      return user.displayName.charAt(0).toUpperCase();
    } else if (user.username) {
      return user.username.charAt(0).toUpperCase();
    }
    return "?";
  };

  const getStatusColor = () => {
    switch (user.status) {
      case "online":
        return "bg-success";
      case "away":
        return "bg-warning";
      case "busy":
        return "bg-destructive";
      case "offline":
      default:
        return "bg-gray-400";
    }
  };

  return (
    <div className="relative">
      <Avatar className={className}>
        {user.avatarUrl ? (
          <AvatarImage src={user.avatarUrl} alt={user.displayName || user.username} />
        ) : (
          <AvatarFallback className="bg-gradient-to-br from-primary to-secondary text-primary-foreground">
            {getInitials()}
          </AvatarFallback>
        )}
      </Avatar>
      
      {showStatus && (
        <span 
          className={cn(
            "absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white dark:border-dark-200",
            getStatusColor()
          )}
        />
      )}
    </div>
  );
}
