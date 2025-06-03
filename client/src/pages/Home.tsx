import React, { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/contexts/AuthContext";
import { useChat } from "@/contexts/ChatContext";
import { useCall } from "@/contexts/CallContext";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2,
  Menu,
  Plus,
  Hash,
  LogOut,
  User,
  Users,
  MessageSquare,
  Phone,
  Video,
  Settings,
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { WorkspaceSettingsModal } from "@/components/modals/WorkspaceSettingsModal";
import {
  workspaces as workspacesTable,
  users as usersTable,
  type Message,
  type Channel,
  type DirectMessageWithUser,
} from "@shared/schema";
import { useNavigate, useParams, useLocation } from "react-router-dom";
// Import chat components
import MessageList from "@/components/chat/MessageList";
import MessageInput from "@/components/chat/MessageInput";

// Infer TypeScript types from table objects
type Workspace = typeof workspacesTable.$inferSelect;
type User = typeof usersTable.$inferSelect;
type DirectMessage = DirectMessageWithUser;

// Create workspace/channel form schemas
const createWorkspaceSchema = z.object({
  name: z.string().min(3, "Name must be at least 3 characters"),
  description: z.string().optional(),
});

const createChannelSchema = z.object({
  name: z.string().min(3, "Name must be at least 3 characters"),
  description: z.string().optional(),
  isPrivate: z.boolean().default(false),
});

type CreateWorkspaceValues = z.infer<typeof createWorkspaceSchema>;
type CreateChannelValues = z.infer<typeof createChannelSchema>;

export default function HomePage() {
  // Use non-null assertion operator to assure TypeScript the context isn't null
  const { user, logoutMutation } = useAuth()!;
  const {
    isConnected,
    activeWorkspace,
    workspaces,
    activeChannel,
    channels,
    activeDM,
    directMessages,
    messages,
    isLoadingMessages,
    setActiveWorkspace,
    setActiveChannel,
    setActiveDM,
    sendMessage,
    createWorkspace,
    createChannel,
  } = useChat();
  const callContext = useCall();
  const { toast } = useToast();
  const navigate = useNavigate();
  const params = useParams();
  const location = useLocation();

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeTab, setActiveTab] = useState<"channels" | "direct">("channels");
  const [isCreatingWorkspace, setIsCreatingWorkspace] = useState(false);
  const [isCreatingChannel, setIsCreatingChannel] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [selectedWorkspaceForSettings, setSelectedWorkspaceForSettings] =
    useState<Workspace | null>(null);

  // Add refs to track previous route params to prevent unnecessary navigation
  const prevParamsRef = useRef<{
    workspaceId: number | null;
    channelId: number | null;
    userId: number | null;
  }>({ workspaceId: null, channelId: null, userId: null });

  // Create a stable navigation function using useCallback to prevent excessive re-renders
  const navigateToResource = useCallback(
    (path: string) => {
      // Don't replace URLs when navigating between workspaces
      // This allows the browser history to work properly
      const navigateOptions = { replace: false };

      // For hash-based routing, we need to compare with location.hash (without the # character)
      const currentPath = location.hash.replace("#", "");

      // Check if we're already at this path to avoid unnecessary navigation
      if (currentPath !== path) {
        // Check for potential navigation loops
        const lastPath = sessionStorage.getItem("lastNavPath");
        const navCount = parseInt(
          sessionStorage.getItem("navLoopCount") || "0"
        );

        if (lastPath === path && navCount > 2) {
          console.log(
            `Navigation loop detected to ${path}, cancelling navigation`
          );
          // Reset the navigation tracking to break the loop
          sessionStorage.removeItem("lastNavPath");
          sessionStorage.removeItem("navLoopCount");
          return;
        }

        // Update navigation tracking
        sessionStorage.setItem("lastNavPath", path);
        if (lastPath === path) {
          sessionStorage.setItem("navLoopCount", (navCount + 1).toString());
        } else {
          sessionStorage.setItem("navLoopCount", "1");
        }

        console.log(`Navigating to: ${path} (from ${currentPath})`);
        navigate(path, navigateOptions);
      } else {
        console.log(`Already at ${currentPath}, skipping navigation`);
      }
    },
    [navigate, location.hash]
  );

  // Update URL when active components change
  useEffect(() => {
    // Don't update URL during initial load
    if (!workspaces.length) return;

    // Get current params
    const currentWorkspaceId = activeWorkspace?.id || null;
    const currentChannelId = activeChannel?.id || null;
    const currentUserId = activeDM?.otherUser.id || null;

    // Check if params have changed to prevent unnecessary navigation
    const paramsChanged =
      currentWorkspaceId !== prevParamsRef.current.workspaceId ||
      currentChannelId !== prevParamsRef.current.channelId ||
      currentUserId !== prevParamsRef.current.userId;

    // Only navigate if params have changed
    if (paramsChanged) {
      // Update the refs with current values
      prevParamsRef.current = {
        workspaceId: currentWorkspaceId,
        channelId: currentChannelId,
        userId: currentUserId,
      };

      // Check if this update was triggered by a URL change
      // If the current URL already matches what we want to navigate to, don't navigate
      let targetUrl = "";
      if (activeWorkspace && activeChannel) {
        targetUrl = `/workspace/${activeWorkspace.id}/channel/${activeChannel.id}`;
      } else if (activeWorkspace && activeDM) {
        targetUrl = `/workspace/${activeWorkspace.id}/direct/${activeDM.otherUser.id}`;
      } else if (activeWorkspace) {
        targetUrl = `/workspace/${activeWorkspace.id}`;
      }

      // For hash-based routing, we need to compare with location.hash (without the # character)
      const currentPath = location.hash.replace("#", "");

      // Don't navigate if we're already at this URL (this breaks the circular dependency)
      if (currentPath === targetUrl) {
        console.log(`Already at ${targetUrl}, skipping navigation`);
        return;
      }

      // Check if we're in a navigation loop
      const isNavigationLoop =
        sessionStorage.getItem("lastNavPath") === targetUrl &&
        parseInt(sessionStorage.getItem("navLoopCount") || "0") > 3;

      if (isNavigationLoop) {
        console.log(`Preventing navigation loop to: ${targetUrl}`);
        // Clear the navigation tracking to break out of the loop completely
        sessionStorage.removeItem("lastNavPath");
        sessionStorage.removeItem("navLoopCount");
        return;
      }

      // Use a flag in sessionStorage to indicate this state change was triggered by URL
      const isFromUrlChange =
        sessionStorage.getItem("fromUrlChange") === "true";
      if (isFromUrlChange) {
        // If this state change was triggered by URL, don't navigate back
        console.log("State change was from URL, not navigating");
        sessionStorage.removeItem("fromUrlChange");
        return;
      }

      // Navigate if we have a valid URL
      if (targetUrl && currentPath !== targetUrl) {
        console.log(`State changed, navigating to: ${targetUrl}`);
        navigateToResource(targetUrl);
      }
    }
  }, [
    activeWorkspace,
    activeChannel,
    activeDM,
    workspaces.length,
    navigateToResource,
    location.hash,
  ]);

  // Modify the first useEffect to set a flag when it updates state from URL
  useEffect(() => {
    // Process route parameters to restore state on page load
    const loadFromUrlParams = async () => {
      try {
        // Check if this is a direct navigation (from click handlers)
        const isDirectNavigation =
          sessionStorage.getItem("directNavigation") === "true";
        if (isDirectNavigation) {
          console.log(
            "Direct navigation detected, skipping URL parameter processing"
          );
          sessionStorage.removeItem("directNavigation");
          return;
        }

        // Set a flag to indicate we're updating state from URL
        sessionStorage.setItem("fromUrlChange", "true");

        // If we have a workspace ID in the URL
        if (params.workspaceId && workspaces.length > 0) {
          const workspaceId = parseInt(params.workspaceId);
          const workspace = workspaces.find((w) => w.id === workspaceId);

          // Store the current URL to detect if we're in a navigation loop
          const currentPath = location.hash.replace("#", "");
          const isNavigationLoop =
            sessionStorage.getItem("lastNavPath") === currentPath &&
            sessionStorage.getItem("navLoopCount")
              ? parseInt(sessionStorage.getItem("navLoopCount") || "0") > 3
              : false;

          if (isNavigationLoop) {
            console.log(
              `Detected navigation loop for path: ${currentPath}, breaking loop`
            );
            sessionStorage.removeItem("lastNavPath");
            sessionStorage.removeItem("navLoopCount");
            return;
          }

          // Update navigation tracking
          if (sessionStorage.getItem("lastNavPath") === currentPath) {
            const count =
              parseInt(sessionStorage.getItem("navLoopCount") || "0") + 1;
            sessionStorage.setItem("navLoopCount", count.toString());
          } else {
            sessionStorage.setItem("lastNavPath", currentPath);
            sessionStorage.setItem("navLoopCount", "1");
          }

          // Only update if the workspace is different from the active one
          const shouldUpdateWorkspace =
            workspace &&
            (!activeWorkspace || activeWorkspace.id !== workspaceId);

          if (shouldUpdateWorkspace) {
            console.log(`Setting workspace from URL: ${workspace?.id}`);
            setActiveWorkspace(workspace);
          } else {
            console.log(
              `Workspace already active or not found: ${workspaceId}`
            );
          }

          // If we have a channel ID
          if (params.channelId && channels.length > 0) {
            const channelId = parseInt(params.channelId);
            const channel = channels.find((c) => c.id === channelId);

            // Only update if the channel is different from the active one
            const shouldUpdateChannel =
              channel && (!activeChannel || activeChannel.id !== channelId);

            if (shouldUpdateChannel) {
              console.log(`Setting channel from URL: ${channel?.id}`);
              // We'll manually set the channel without auto-joining
              // This avoids the infinite loop of join attempts
              setActiveChannel(channel);
              setActiveDM(null); // Ensure DM is not active
              setActiveTab("channels");
            } else {
              console.log(`Channel already active or not found: ${channelId}`);
            }
          }
          // If we have a direct message user ID
          else if (params.userId && directMessages.length > 0) {
            const userId = parseInt(params.userId);
            const dm = directMessages.find((d) => d.otherUser.id === userId);

            // Only update if the DM is different from the active one
            const shouldUpdateDM = dm && (!activeDM || activeDM.id !== dm.id);

            if (shouldUpdateDM) {
              console.log(`Setting DM from URL: ${dm?.id}`);
              setActiveDM(dm);
              setActiveChannel(null); // Ensure channel is not active
              setActiveTab("direct");
            } else {
              console.log(`DM already active or not found: ${userId}`);
            }
          }
        }
      } catch (error) {
        console.error("Error processing URL parameters:", error);
      }
    };

    loadFromUrlParams();
  }, [
    params,
    workspaces,
    channels,
    directMessages,
    // We need these to check if we should update
    activeWorkspace,
    activeChannel,
    activeDM,
    setActiveWorkspace,
    setActiveChannel,
    setActiveDM,
    setActiveTab,
    location.hash,
  ]);

  // Form for creating a workspace
  const workspaceForm = useForm<CreateWorkspaceValues>({
    resolver: zodResolver(createWorkspaceSchema),
    defaultValues: {
      name: "",
      description: "",
    },
  });

  // Form for creating a channel
  const channelForm = useForm<CreateChannelValues>({
    resolver: zodResolver(createChannelSchema),
    defaultValues: {
      name: "",
      description: "",
      isPrivate: false,
    },
  });

  // Handle creating a workspace
  const onCreateWorkspace = async (values: CreateWorkspaceValues) => {
    const newWorkspace = await createWorkspace(
      values.name,
      values.description || ""
    );
    if (newWorkspace) {
      setIsCreatingWorkspace(false);
      workspaceForm.reset();
    }
  };

  // Handle creating a channel
  const onCreateChannel = async (values: CreateChannelValues) => {
    const newChannel = await createChannel(values.name, values.description);
    if (newChannel !== undefined) {
      setIsCreatingChannel(false);
      channelForm.reset();
    }
  };

  // Handle logout - Rely on ProtectedRoute for redirection
  const handleLogout = () => {
    console.log("HomePage: Calling logoutMutation.mutate");
    logoutMutation.mutate(undefined, {
      onSuccess: () => {
        console.log("HomePage: Logout mutation succeeded (no navigation here)");
      },
      onError: (error: Error) => {
        console.error("Logout failed:", error);
        toast({
          title: "Logout Error",
          description: error.message || "Could not log out. Please try again.",
          variant: "destructive",
        });
      },
    });
  };

  // Get initials for avatar fallback
  const getInitials = (name: string | undefined | null): string => {
    if (!name) return "?";
    return name
      .split(" ")
      .map((part) => part.charAt(0))
      .join("")
      .toUpperCase();
  };

  // Format message timestamp
  const formatMessageTime = (timestamp: string | Date): string => {
    const date =
      typeof timestamp === "string" ? new Date(timestamp) : timestamp;
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  // Render connection status
  const renderConnectionStatus = () => {
    return (
      <div className="flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground">
        <div
          className={`w-2 h-2 rounded-full ${
            isConnected ? "bg-green-500" : "bg-red-500"
          }`}
        />
        {isConnected ? "Connected" : "Disconnected"}
      </div>
    );
  };

  // Function to open settings modal for a specific workspace
  const handleOpenWorkspaceSettings = (workspace: Workspace) => {
    setSelectedWorkspaceForSettings(workspace);
    setIsSettingsModalOpen(true);
  };

  return (
    <>
      <div className="flex h-screen bg-background">
        {/* Sidebar */}
        <div
          className={`border-r flex flex-col ${
            sidebarOpen ? "w-64" : "w-20"
          } transition-all duration-300 h-full`}
        >
          {/* User Section */}
          <div className="p-4 border-b flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Avatar>
                <AvatarImage src={user?.avatarUrl || ""} />
                <AvatarFallback>
                  {user?.displayName ? getInitials(user.displayName) : "U"}
                </AvatarFallback>
              </Avatar>
              {sidebarOpen && (
                <div className="flex flex-col">
                  <span className="font-medium">{user?.displayName}</span>
                  <span className="text-xs text-muted-foreground">
                    @{user?.username}
                  </span>
                </div>
              )}
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSidebarOpen((prev) => !prev)}
            >
              <Menu className="h-5 w-5" />
            </Button>
          </div>

          {/* Workspaces Section */}
          <div className="p-4 border-b flex-shrink-0">
            <div className="flex items-center justify-between mb-3">
              {sidebarOpen && (
                <h2 className="text-sm font-semibold">Workspaces</h2>
              )}
              <Dialog
                open={isCreatingWorkspace}
                onOpenChange={setIsCreatingWorkspace}
              >
                <DialogTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-7 w-7">
                    <Plus className="h-4 w-4" />
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create a new workspace</DialogTitle>
                    <DialogDescription>
                      Create a new workspace to organize your channels and
                      conversations.
                    </DialogDescription>
                  </DialogHeader>
                  <Form {...workspaceForm}>
                    <form
                      onSubmit={workspaceForm.handleSubmit(onCreateWorkspace)}
                      className="space-y-4"
                    >
                      <FormField
                        control={workspaceForm.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Name</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="Enter workspace name"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={workspaceForm.control}
                        name="description"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Description (optional)</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="Enter workspace description"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <DialogFooter>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setIsCreatingWorkspace(false)}
                        >
                          Cancel
                        </Button>
                        <Button type="submit">Create Workspace</Button>
                      </DialogFooter>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>
            </div>

            <ScrollArea
              className="flex-grow overflow-y-auto"
              style={{ maxHeight: "calc(100vh - 300px)" }}
            >
              <div className="space-y-1">
                {workspaces.map((workspace: Workspace) => {
                  return (
                    <div key={workspace.id} className="flex items-center group">
                      <Button
                        variant={
                          activeWorkspace?.id === workspace.id
                            ? "secondary"
                            : "ghost"
                        }
                        className={`flex-1 justify-start h-10 ${
                          !sidebarOpen && "justify-center p-2"
                        }`}
                        onClick={() => {
                          // Don't do anything if this workspace is already active
                          if (activeWorkspace?.id === workspace.id) {
                            console.log(
                              `Workspace ${workspace.id} already active, ignoring click`
                            );
                            return;
                          }

                          console.log(
                            `Workspace button clicked: ${workspace.id}`
                          );

                          // Important: Clear the fromUrlChange flag to allow navigation
                          sessionStorage.removeItem("fromUrlChange");

                          // Set direct navigation flag
                          sessionStorage.setItem("directNavigation", "true");

                          // Reset navigation loop detection for this action
                          sessionStorage.removeItem("lastNavPath");
                          sessionStorage.removeItem("navLoopCount");

                          // Directly set the workspace without relying on URL navigation
                          setActiveWorkspace(workspace);

                          // Clear any channel/DM selection to prevent conflicts
                          setActiveChannel(null);
                          setActiveDM(null);

                          // Find the first channel in this workspace if available
                          const workspaceChannels = channels.filter(
                            (c) => c.workspaceId === workspace.id
                          );

                          let targetUrl = `/workspace/${workspace.id}`;

                          // If we have channels in this workspace, navigate to the first one
                          if (workspaceChannels.length > 0) {
                            const firstChannel = workspaceChannels[0];
                            setActiveChannel(firstChannel);
                            targetUrl = `/workspace/${workspace.id}/channel/${firstChannel.id}`;
                          }

                          // Force navigation to the workspace URL
                          console.log(`Directly navigating to: ${targetUrl}`);
                          navigate(targetUrl, { replace: false });
                        }}
                      >
                        <div className="w-8 h-8 rounded bg-primary/10 flex items-center justify-center mr-3 flex-shrink-0">
                          <span className="font-medium text-primary">
                            {workspace.iconText?.charAt(0).toUpperCase() ||
                              workspace.name?.charAt(0).toUpperCase() ||
                              "W"}
                          </span>
                        </div>
                        {sidebarOpen && (
                          <span className="truncate flex-grow min-w-0">
                            {workspace.name}
                          </span>
                        )}
                      </Button>
                      {sidebarOpen ? (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 ml-1 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenWorkspaceSettings(workspace);
                          }}
                          aria-label="Workspace Settings"
                        >
                          <Settings className="h-4 w-4" />
                        </Button>
                      ) : (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 ml-1"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenWorkspaceSettings(workspace);
                          }}
                          aria-label="Workspace Settings"
                        >
                          <Settings className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </div>

          {/* Channels/Direct Messages Section */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {sidebarOpen && (
              <Tabs
                defaultValue="channels"
                value={activeTab}
                onValueChange={(value) =>
                  setActiveTab(value as "channels" | "direct")
                }
                className="w-full"
              >
                <div className="px-4 pt-4">
                  <TabsList className="w-full">
                    <TabsTrigger value="channels" className="flex-1">
                      Channels
                    </TabsTrigger>
                    <TabsTrigger value="direct" className="flex-1">
                      Direct
                    </TabsTrigger>
                  </TabsList>
                </div>

                <TabsContent
                  value="channels"
                  className="flex-1 flex flex-col overflow-hidden"
                >
                  <div className="px-4 py-2 flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground">
                      CHANNELS
                    </span>
                    {activeWorkspace && (
                      <Dialog
                        open={isCreatingChannel}
                        onOpenChange={setIsCreatingChannel}
                      >
                        <DialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                          >
                            <Plus className="h-3 w-3" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Create a new channel</DialogTitle>
                            <DialogDescription>
                              Create a new channel in the {activeWorkspace.name}{" "}
                              workspace.
                            </DialogDescription>
                          </DialogHeader>
                          <Form {...channelForm}>
                            <form
                              onSubmit={channelForm.handleSubmit(
                                onCreateChannel
                              )}
                              className="space-y-4"
                            >
                              <FormField
                                control={channelForm.control}
                                name="name"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>Name</FormLabel>
                                    <FormControl>
                                      <Input
                                        placeholder="Enter channel name"
                                        {...field}
                                      />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                              <FormField
                                control={channelForm.control}
                                name="description"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>
                                      Description (optional)
                                    </FormLabel>
                                    <FormControl>
                                      <Input
                                        placeholder="Enter channel description"
                                        {...field}
                                      />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                              <DialogFooter>
                                <Button
                                  type="button"
                                  variant="outline"
                                  onClick={() => setIsCreatingChannel(false)}
                                >
                                  Cancel
                                </Button>
                                <Button type="submit">Create Channel</Button>
                              </DialogFooter>
                            </form>
                          </Form>
                        </DialogContent>
                      </Dialog>
                    )}
                  </div>

                  <ScrollArea className="flex-1 px-2">
                    <div className="space-y-[2px] py-2">
                      {channels.map((channel: Channel) => (
                        <Button
                          key={channel.id}
                          variant={
                            activeChannel?.id === channel.id
                              ? "secondary"
                              : "ghost"
                          }
                          className="w-full justify-start h-8 px-2"
                          onClick={() => {
                            // Don't do anything if this channel is already active
                            if (activeChannel?.id === channel.id) {
                              console.log(
                                `Channel ${channel.id} already active, ignoring click`
                              );
                              return;
                            }

                            console.log(
                              `Channel button clicked: ${channel.id}`
                            );

                            // Important: Clear the fromUrlChange flag to allow navigation
                            sessionStorage.removeItem("fromUrlChange");

                            // Set direct navigation flag
                            sessionStorage.setItem("directNavigation", "true");

                            // Reset navigation loop detection
                            sessionStorage.removeItem("lastNavPath");
                            sessionStorage.removeItem("navLoopCount");

                            // Directly set the channel
                            setActiveChannel(channel);
                            setActiveDM(null);

                            // Force navigation to the channel URL if we have an active workspace
                            if (activeWorkspace) {
                              const targetUrl = `/workspace/${activeWorkspace.id}/channel/${channel.id}`;
                              console.log(
                                `Directly navigating to: ${targetUrl}`
                              );
                              navigate(targetUrl, { replace: false });
                            }
                          }}
                        >
                          <Hash className="mr-2 h-4 w-4 text-muted-foreground" />
                          <span className="truncate text-sm">
                            {channel.name}
                          </span>
                        </Button>
                      ))}
                    </div>
                  </ScrollArea>
                </TabsContent>

                <TabsContent
                  value="direct"
                  className="flex-1 flex flex-col overflow-hidden"
                >
                  <div className="px-4 py-2">
                    <span className="text-xs font-medium text-muted-foreground">
                      DIRECT MESSAGES
                    </span>
                  </div>

                  <ScrollArea className="flex-1 px-2">
                    <div className="space-y-[2px] py-2">
                      {directMessages.map((dm: any) => {
                        const otherUser = dm.otherUser as User | undefined;
                        return (
                          <Button
                            key={dm.id}
                            variant={
                              activeDM?.id === dm.id ? "secondary" : "ghost"
                            }
                            className="w-full justify-start h-8 px-2"
                            onClick={() => {
                              // Don't do anything if this DM is already active
                              if (activeDM?.id === dm.id) {
                                console.log(
                                  `DM ${dm.id} already active, ignoring click`
                                );
                                return;
                              }

                              console.log(`DM button clicked: ${dm.id}`);

                              // Important: Clear the fromUrlChange flag to allow navigation
                              sessionStorage.removeItem("fromUrlChange");

                              // Set direct navigation flag
                              sessionStorage.setItem(
                                "directNavigation",
                                "true"
                              );

                              // Reset navigation loop detection
                              sessionStorage.removeItem("lastNavPath");
                              sessionStorage.removeItem("navLoopCount");

                              // Directly set the DM
                              setActiveDM(dm);
                              setActiveChannel(null);
                              setActiveTab("direct");

                              // Force navigation to the DM URL if we have an active workspace
                              if (activeWorkspace) {
                                const targetUrl = `/workspace/${activeWorkspace.id}/direct/${dm.otherUser.id}`;
                                console.log(
                                  `Directly navigating to: ${targetUrl}`
                                );
                                navigate(targetUrl, { replace: false });
                              }
                            }}
                          >
                            <Avatar className="h-5 w-5 mr-2">
                              <AvatarImage src={otherUser?.avatarUrl || ""} />
                              <AvatarFallback className="text-[10px]">
                                {getInitials(otherUser?.displayName)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex flex-col items-start">
                              <span className="truncate text-sm">
                                {otherUser?.displayName || "Unknown User"}
                              </span>
                            </div>
                          </Button>
                        );
                      })}
                    </div>
                  </ScrollArea>
                </TabsContent>
              </Tabs>
            )}

            {!sidebarOpen && (
              <div className="flex-1 overflow-auto py-2">
                <div className="flex flex-col items-center space-y-2">
                  <Button
                    variant={activeTab === "channels" ? "secondary" : "ghost"}
                    size="icon"
                    onClick={() => setActiveTab("channels")}
                  >
                    <Users className="h-5 w-5" />
                  </Button>
                  <Button
                    variant={activeTab === "direct" ? "secondary" : "ghost"}
                    size="icon"
                    onClick={() => setActiveTab("direct")}
                  >
                    <MessageSquare className="h-5 w-5" />
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Connection status and logout */}
          <div className="mt-auto border-t">
            {renderConnectionStatus()}
            <div className="p-2">
              <Button
                variant="ghost"
                className={`w-full justify-${sidebarOpen ? "start" : "center"}`}
                onClick={handleLogout}
                disabled={logoutMutation.isPending}
              >
                {logoutMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <LogOut className="h-4 w-4 mr-2" />
                )}
                {sidebarOpen && (
                  <span>
                    {logoutMutation.isPending ? "Logging out..." : "Log out"}
                  </span>
                )}
              </Button>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col">
          {/* Channel/DM Header */}
          <header className="h-16 border-b flex items-center px-6">
            {activeChannel && (
              <div className="flex items-center gap-2">
                <Hash className="h-5 w-5 text-muted-foreground" />
                <h2 className="font-semibold">{activeChannel.name}</h2>
                {activeChannel.description && (
                  <>
                    <Separator orientation="vertical" className="h-5 mx-2" />
                    <p className="text-sm text-muted-foreground">
                      {activeChannel.description}
                    </p>
                  </>
                )}
              </div>
            )}

            {activeDM &&
              (() => {
                const otherUser = (activeDM as any).otherUser as
                  | User
                  | undefined;
                if (!otherUser) return null;
                return (
                  <div className="flex items-center gap-2">
                    <Avatar className="h-7 w-7">
                      <AvatarImage src={otherUser.avatarUrl || ""} />
                      <AvatarFallback>
                        {getInitials(otherUser.displayName)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <h2 className="font-semibold">{otherUser.displayName}</h2>
                      <div className="flex items-center text-xs text-muted-foreground">
                        <div
                          className={`w-1.5 h-1.5 rounded-full ${
                            otherUser.status === "online"
                              ? "bg-green-500"
                              : "bg-amber-500"
                          } mr-1`}
                        />
                        {otherUser.status === "online" ? "Online" : "Away"}
                      </div>
                    </div>
                  </div>
                );
              })()}

            {!activeChannel && !activeDM && (
              <div className="text-muted-foreground">
                Select a channel or conversation
              </div>
            )}

            <div className="ml-auto flex items-center gap-2">
              {activeDM &&
                (() => {
                  const otherUser = (activeDM as any).otherUser as
                    | User
                    | undefined;
                  if (!otherUser) return null;
                  return (
                    <>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-green-600"
                        onClick={() =>
                          callContext.startCall(otherUser.id, "audio")
                        }
                        title="Audio call"
                      >
                        <Phone className="h-5 w-5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-blue-600"
                        onClick={() =>
                          callContext.startCall(otherUser.id, "video")
                        }
                        title="Video call"
                      >
                        <Video className="h-5 w-5" />
                      </Button>
                      <Separator orientation="vertical" className="h-6 mx-1" />
                    </>
                  );
                })()}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    disabled={logoutMutation.isPending}
                  >
                    <User className="h-5 w-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onClick={handleLogout}
                    disabled={logoutMutation.isPending}
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Log out</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </header>

          {/* Messages */}
          <div className="flex-1 overflow-hidden flex flex-col">
            {isLoadingMessages ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : (
              <>
                {!activeChannel && !activeDM ? (
                  <div className="flex flex-col items-center justify-center h-full text-center p-6">
                    <h2 className="text-2xl font-bold mb-2">
                      Welcome to ChatHub
                    </h2>
                    <p className="text-muted-foreground max-w-md">
                      Select a channel or direct message from the sidebar to
                      start chatting.
                      {!workspaces.length &&
                        " Or create your first workspace to get started."}
                    </p>
                    {!workspaces.length && (
                      <Button
                        className="mt-4"
                        onClick={() => setIsCreatingWorkspace(true)}
                      >
                        Create Workspace
                      </Button>
                    )}
                  </div>
                ) : (
                  <>
                    {/* Use the MessageList component instead of implementing it directly */}
                    <MessageList />

                    {/* Use the MessageInput component instead of implementing a basic form */}
                    <div className="border-t">
                      <MessageInput />
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Render the Workspace Settings Modal */}
      <WorkspaceSettingsModal
        workspace={selectedWorkspaceForSettings}
        isOpen={isSettingsModalOpen}
        onClose={() => {
          setIsSettingsModalOpen(false);
          setSelectedWorkspaceForSettings(null);
        }}
      />
    </>
  );
}
