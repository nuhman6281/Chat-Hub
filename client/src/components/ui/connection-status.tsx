import React from "react";
import {
  Wifi,
  WifiOff,
  AlertCircle,
  CheckCircle,
  RotateCcw,
} from "lucide-react";
import { cn } from "../../lib/utils";

interface ConnectionStatusProps {
  connectionState:
    | "disconnected"
    | "connecting"
    | "connected"
    | "failed"
    | "reconnecting";
  iceConnectionState: string;
  isReconnecting: boolean;
  lastConnectionError?: string | null;
  className?: string;
}

const ConnectionStatus: React.FC<ConnectionStatusProps> = ({
  connectionState,
  iceConnectionState,
  isReconnecting,
  lastConnectionError,
  className,
}) => {
  const getStatusConfig = () => {
    switch (connectionState) {
      case "connected":
        return {
          icon: CheckCircle,
          color: "text-green-500",
          bgColor: "bg-green-500/10",
          label: "Connected",
          description: "High quality connection",
        };
      case "connecting":
        return {
          icon: Wifi,
          color: "text-yellow-500",
          bgColor: "bg-yellow-500/10",
          label: "Connecting...",
          description: "Establishing connection",
        };
      case "reconnecting":
        return {
          icon: RotateCcw,
          color: "text-orange-500",
          bgColor: "bg-orange-500/10",
          label: "Reconnecting...",
          description: "Restoring connection",
        };
      case "failed":
        return {
          icon: AlertCircle,
          color: "text-red-500",
          bgColor: "bg-red-500/10",
          label: "Connection Failed",
          description: lastConnectionError || "Network issues detected",
        };
      case "disconnected":
      default:
        return {
          icon: WifiOff,
          color: "text-gray-500",
          bgColor: "bg-gray-500/10",
          label: "Disconnected",
          description: "No active connection",
        };
    }
  };

  const config = getStatusConfig();
  const IconComponent = config.icon;

  return (
    <div
      className={cn(
        "flex items-center gap-2 px-3 py-2 rounded-lg transition-all duration-200",
        config.bgColor,
        className
      )}
    >
      <div className="relative">
        <IconComponent
          className={cn("h-4 w-4", config.color, {
            "animate-spin": connectionState === "connecting" || isReconnecting,
          })}
        />
        {connectionState === "connected" && (
          <div className="absolute -top-1 -right-1 h-2 w-2 bg-green-500 rounded-full animate-pulse" />
        )}
      </div>

      <div className="flex flex-col min-w-0">
        <span className={cn("text-sm font-medium", config.color)}>
          {config.label}
        </span>
        <span className="text-xs text-muted-foreground truncate">
          {config.description}
        </span>
      </div>

      {/* ICE state debug info in development */}
      {process.env.NODE_ENV === "development" && (
        <span className="text-xs text-muted-foreground ml-auto">
          ICE: {iceConnectionState}
        </span>
      )}
    </div>
  );
};

export default ConnectionStatus;
