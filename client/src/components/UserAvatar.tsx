import { ClientUser } from "@shared/schema";

interface UserAvatarProps {
  user?: ClientUser | null;
  className?: string;
  showStatus?: boolean;
}

export function UserAvatar({
  user,
  className = "",
  showStatus = false,
}: UserAvatarProps) {
  if (!user) {
    return (
      <div
        className={`flex items-center justify-center bg-gray-200 rounded-full ${className}`}
      >
        <span className="text-gray-500">?</span>
      </div>
    );
  }

  if (user.avatarUrl) {
    return (
      <div className="relative">
        <img
          src={user.avatarUrl}
          alt={user.displayName}
          className={`rounded-full object-cover ${className}`}
        />
        {showStatus && (
          <div
            className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white ${
              user.status === "online"
                ? "bg-green-500"
                : user.status === "away"
                ? "bg-yellow-500"
                : "bg-gray-500"
            }`}
          />
        )}
      </div>
    );
  }

  const initials = user.displayName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase();

  return (
    <div className="relative">
      <div
        className={`flex items-center justify-center bg-blue-500 text-white rounded-full ${className}`}
      >
        <span>{initials}</span>
      </div>
      {showStatus && (
        <div
          className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white ${
            user.status === "online"
              ? "bg-green-500"
              : user.status === "away"
              ? "bg-yellow-500"
              : "bg-gray-500"
          }`}
        />
      )}
    </div>
  );
}
