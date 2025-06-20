import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Monitor,
  MonitorSpeaker,
  Square,
  X,
  ChevronDown,
  Info,
  Settings,
  Maximize,
  Minimize,
  RotateCcw,
  Pause,
  Play,
} from "lucide-react";

interface ScreenShareControlsProps {
  isScreenSharing: boolean;
  remoteIsScreenSharing: boolean;
  screenShareError: string | null;
  remoteUserName?: string;
  onStartScreenShare: () => Promise<void>;
  onStopScreenShare: () => void;
  className?: string;
}

export function ScreenShareControls({
  isScreenSharing,
  remoteIsScreenSharing,
  screenShareError,
  remoteUserName,
  onStartScreenShare,
  onStopScreenShare,
  className = "",
}: ScreenShareControlsProps) {
  const [showScreenShareDialog, setShowScreenShareDialog] = useState(false);
  const [isStarting, setIsStarting] = useState(false);

  const handleStartScreenShare = async () => {
    setIsStarting(true);
    try {
      await onStartScreenShare();
      setShowScreenShareDialog(false);
    } catch (error) {
      console.error("Failed to start screen share:", error);
    } finally {
      setIsStarting(false);
    }
  };

  const handleStopScreenShare = () => {
    onStopScreenShare();
  };

  return (
    <>
      <div className={`flex items-center gap-2 ${className}`}>
        {/* Main screen share button */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant={isScreenSharing ? "default" : "secondary"}
              size="sm"
              className={`${
                isScreenSharing
                  ? "bg-green-600 hover:bg-green-700 text-white"
                  : "bg-gray-600 hover:bg-gray-700 text-white"
              }`}
              disabled={!!screenShareError}
            >
              <Monitor className="h-4 w-4 mr-2" />
              {isScreenSharing ? "Sharing" : "Share"}
              <ChevronDown className="h-3 w-3 ml-1" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="flex items-center gap-2">
              <MonitorSpeaker className="h-4 w-4" />
              Screen Sharing
            </DropdownMenuLabel>
            <DropdownMenuSeparator />

            {isScreenSharing ? (
              <>
                <DropdownMenuItem className="text-green-600">
                  <Monitor className="h-4 w-4 mr-2" />
                  Currently sharing screen
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={handleStopScreenShare}
                  className="text-red-600 focus:text-red-700"
                >
                  <Square className="h-4 w-4 mr-2" />
                  Stop sharing
                </DropdownMenuItem>
              </>
            ) : (
              <>
                <DropdownMenuItem
                  onClick={() => setShowScreenShareDialog(true)}
                  disabled={!!screenShareError}
                >
                  <Monitor className="h-4 w-4 mr-2" />
                  Share entire screen
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setShowScreenShareDialog(true)}
                  disabled={!!screenShareError}
                >
                  <Square className="h-4 w-4 mr-2" />
                  Share a window
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setShowScreenShareDialog(true)}
                  disabled={!!screenShareError}
                >
                  <Maximize className="h-4 w-4 mr-2" />
                  Share a tab
                </DropdownMenuItem>
                {screenShareError && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem disabled className="text-red-500">
                      <X className="h-4 w-4 mr-2" />
                      {screenShareError}
                    </DropdownMenuItem>
                  </>
                )}
              </>
            )}

            <DropdownMenuSeparator />
            <DropdownMenuItem>
              <Settings className="h-4 w-4 mr-2" />
              Screen share settings
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Status indicators */}
        {isScreenSharing && (
          <Badge
            variant="default"
            className="bg-green-600/20 text-green-400 border-green-600 animate-pulse"
          >
            <Monitor className="h-3 w-3 mr-1" />
            Sharing
          </Badge>
        )}

        {remoteIsScreenSharing && (
          <Badge
            variant="default"
            className="bg-blue-600/20 text-blue-400 border-blue-600"
          >
            <Monitor className="h-3 w-3 mr-1" />
            {remoteUserName} sharing
          </Badge>
        )}
      </div>

      {/* Screen Share Dialog */}
      <Dialog
        open={showScreenShareDialog}
        onOpenChange={setShowScreenShareDialog}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Monitor className="h-5 w-5" />
              Share your screen
            </DialogTitle>
            <DialogDescription>
              Choose what you'd like to share with others in the call
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Share options */}
            <div className="grid gap-3">
              <Button
                variant="outline"
                className="h-16 justify-start p-4 hover:bg-blue-50 dark:hover:bg-blue-950"
                onClick={handleStartScreenShare}
                disabled={isStarting}
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
                    <Monitor className="h-5 w-5 text-blue-600" />
                  </div>
                  <div className="text-left">
                    <div className="font-medium">Entire screen</div>
                    <div className="text-sm text-gray-500">
                      Share everything on your screen
                    </div>
                  </div>
                </div>
              </Button>

              <Button
                variant="outline"
                className="h-16 justify-start p-4 hover:bg-purple-50 dark:hover:bg-purple-950"
                onClick={handleStartScreenShare}
                disabled={isStarting}
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-purple-100 dark:bg-purple-900 rounded-lg">
                    <Square className="h-5 w-5 text-purple-600" />
                  </div>
                  <div className="text-left">
                    <div className="font-medium">Application window</div>
                    <div className="text-sm text-gray-500">
                      Share a specific application
                    </div>
                  </div>
                </div>
              </Button>

              <Button
                variant="outline"
                className="h-16 justify-start p-4 hover:bg-green-50 dark:hover:bg-green-950"
                onClick={handleStartScreenShare}
                disabled={isStarting}
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-100 dark:bg-green-900 rounded-lg">
                    <Maximize className="h-5 w-5 text-green-600" />
                  </div>
                  <div className="text-left">
                    <div className="font-medium">Browser tab</div>
                    <div className="text-sm text-gray-500">
                      Share a specific browser tab
                    </div>
                  </div>
                </div>
              </Button>
            </div>

            <Separator />

            {/* Additional info */}
            <div className="flex items-start gap-3 p-3 bg-blue-50 dark:bg-blue-950/50 rounded-lg border border-blue-200 dark:border-blue-800">
              <Info className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm">
                <div className="font-medium text-blue-900 dark:text-blue-100">
                  Screen sharing tips
                </div>
                <div className="text-blue-700 dark:text-blue-300 mt-1">
                  • Your browser will ask which content to share • Others will
                  see your screen in real-time • You can stop sharing anytime by
                  clicking the stop button
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowScreenShareDialog(false)}
              disabled={isStarting}
            >
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// Professional screen sharing overlay for active sharing
interface ScreenShareOverlayProps {
  isScreenSharing: boolean;
  remoteIsScreenSharing: boolean;
  remoteUserName?: string;
  onStopScreenShare: () => void;
  callDuration?: string;
}

export function ScreenShareOverlay({
  isScreenSharing,
  remoteIsScreenSharing,
  remoteUserName,
  onStopScreenShare,
  callDuration,
}: ScreenShareOverlayProps) {
  if (!isScreenSharing && !remoteIsScreenSharing) return null;

  return (
    <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50">
      <div className="bg-gray-900/95 backdrop-blur-sm text-white px-4 py-2 rounded-lg border border-gray-700 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
            <Monitor className="h-4 w-4" />
            <span className="text-sm font-medium">
              {isScreenSharing
                ? "You are sharing your screen"
                : `${remoteUserName} is sharing their screen`}
            </span>
          </div>

          {callDuration && (
            <>
              <Separator orientation="vertical" className="h-4" />
              <span className="text-sm text-gray-300">{callDuration}</span>
            </>
          )}

          {isScreenSharing && (
            <>
              <Separator orientation="vertical" className="h-4" />
              <Button
                variant="destructive"
                size="sm"
                onClick={onStopScreenShare}
                className="h-7 px-3 bg-red-600 hover:bg-red-700"
              >
                <Square className="h-3 w-3 mr-1" />
                Stop
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
