// Placeholder for Workspace Settings Modal
import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  AlertCircle,
  Check,
  Copy,
  Link,
  Users,
  Plus,
  UserPlus,
  X,
  User,
  Settings,
  MoreHorizontal,
  Crown,
  Shield,
  Mail,
  RefreshCw,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

// Define proper types for workspace and members
interface WorkspaceMember {
  id: number;
  userId: number;
  workspaceId: number;
  role: "owner" | "admin" | "member";
  user: {
    id: number;
    displayName: string;
    username: string;
    avatarUrl: string | null;
    email: string;
  };
}

interface Workspace {
  id: number;
  name: string;
  iconText: string;
  description?: string;
  ownerId: number;
  createdAt: Date;
}

interface WorkspaceSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  workspace: Workspace | null;
}

export const WorkspaceSettingsModal: React.FC<WorkspaceSettingsModalProps> = ({
  isOpen,
  onClose,
  workspace,
}) => {
  const [activeTab, setActiveTab] = useState<string>("members");
  const [inviteEmail, setInviteEmail] = useState<string>("");
  const [inviteRole, setInviteRole] = useState<"admin" | "member">("member");
  const [workspaceMembers, setWorkspaceMembers] = useState<WorkspaceMember[]>(
    []
  );
  const [isLoadingMembers, setIsLoadingMembers] = useState(false);
  const [workspaceName, setWorkspaceName] = useState("");
  const [workspaceDescription, setWorkspaceDescription] = useState("");
  const [inviteLink, setInviteLink] = useState("");
  const [isGeneratingLink, setIsGeneratingLink] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [showDeleteAlert, setShowDeleteAlert] = useState(false);
  const [memberToRemove, setMemberToRemove] = useState<WorkspaceMember | null>(
    null
  );
  const { toast } = useToast();
  const { user } = useAuth();

  // Load workspace details when opened
  useEffect(() => {
    if (isOpen && workspace) {
      setWorkspaceName(workspace.name || "");
      setWorkspaceDescription(workspace.description || "");
      fetchWorkspaceMembers();
    }
  }, [isOpen, workspace]);

  // Function to get initials for avatar fallback
  const getInitials = (name: string | undefined | null): string => {
    if (!name) return "?";
    return name
      .split(" ")
      .map((part) => part.charAt(0))
      .join("")
      .toUpperCase();
  };

  // Fetch workspace members
  const fetchWorkspaceMembers = async () => {
    if (!workspace) return;

    setIsLoadingMembers(true);
    try {
      const response = await fetch(`/api/workspaces/${workspace.id}/members`);
      if (response.ok) {
        const data = await response.json();
        setWorkspaceMembers(data);
      } else {
        toast({
          title: "Error",
          description: "Failed to load workspace members",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error fetching workspace members:", error);
      toast({
        title: "Error",
        description: "Failed to load workspace members",
        variant: "destructive",
      });
    } finally {
      setIsLoadingMembers(false);
    }
  };

  // Generate invite link - with improved error handling for missing endpoint
  const generateInviteLink = async () => {
    if (!workspace) return;

    setIsGeneratingLink(true);
    try {
      const response = await fetch(
        `/api/workspaces/${workspace.id}/invite-links`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            role: inviteRole,
            expiresIn: "7d",
          }),
        }
      );

      // Check if the response is JSON before parsing
      const contentType = response.headers.get("content-type");
      if (
        !response.ok ||
        !contentType ||
        !contentType.includes("application/json")
      ) {
        // Handle non-JSON responses or errors (like 404 or HTML error pages)
        throw new Error(
          response.status === 404
            ? "Invite link feature not available on the server."
            : `Server error (${response.status})`
        );
      }

      const data = await response.json();
      const baseUrl = window.location.origin;
      setInviteLink(`${baseUrl}/invite/${data.token || data.id}`);
      toast({
        title: "Invite link generated",
        description: "Share this link to invite people to your workspace",
      });
    } catch (error) {
      console.error("Error generating invite link:", error);
      toast({
        title: "Error",
        description:
          error instanceof Error
            ? error.message
            : "Failed to generate invite link.",
        variant: "destructive",
      });
      // Clear any previously generated link on error
      setInviteLink("");
    } finally {
      setIsGeneratingLink(false);
    }
  };

  // Handle email invite - reverting to send email, assuming server handles lookup
  const handleEmailInvite = async () => {
    if (!workspace || !inviteEmail.trim()) return;

    try {
      // Send email and role, trusting the server to find/invite the user
      const response = await fetch(`/api/workspaces/${workspace.id}/members`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: inviteEmail,
          workspaceId: workspace.id, // Keep sending workspaceId as it's likely needed
          role: inviteRole,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = `Server error (${response.status})`;
        try {
          const errorData = JSON.parse(errorText);
          // Use a more specific error message if available
          errorMessage =
            errorData.message ||
            `Failed to add member. Server responded with ${response.status}`;
          if (response.status === 400 && errorData.errors) {
            errorMessage =
              "Invalid data provided. Please check the email and role.";
          }
        } catch (e) {
          // Keep the generic server error message if JSON parsing fails
        }
        throw new Error(errorMessage);
      }

      // If successful, assume member was added or invite sent
      toast({
        title: "Member Added/Invited",
        description: `Successfully processed request for ${inviteEmail}`,
      });
      setInviteEmail("");
      fetchWorkspaceMembers(); // Refresh members list
    } catch (error) {
      console.error("Error inviting user by email:", error);
      toast({
        title: "Invitation Failed",
        description:
          error instanceof Error
            ? error.message
            : "Could not process the invitation request.",
        variant: "destructive",
      });
    }
  };

  // Copy invite link to clipboard
  const copyInviteLink = () => {
    if (!inviteLink) return;

    navigator.clipboard.writeText(inviteLink);
    setLinkCopied(true);
    toast({
      title: "Link copied",
      description: "Invite link copied to clipboard",
    });

    setTimeout(() => {
      setLinkCopied(false);
    }, 3000);
  };

  // Update workspace settings
  const saveWorkspaceSettings = async () => {
    if (!workspace) return;

    try {
      const response = await fetch(`/api/workspaces/${workspace.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: workspaceName,
          description: workspaceDescription,
        }),
      });

      if (response.ok) {
        toast({
          title: "Workspace updated",
          description: "Workspace settings have been updated",
        });
      } else {
        const errorData = await response.json();
        toast({
          title: "Failed to update workspace",
          description: errorData.message || "An error occurred",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error updating workspace:", error);
      toast({
        title: "Error",
        description: "Failed to update workspace settings",
        variant: "destructive",
      });
    }
  };

  // Update member role
  const updateMemberRole = async (memberId: number, newRole: string) => {
    if (!workspace) return;

    try {
      const response = await fetch(
        `/api/workspaces/${workspace.id}/members/${memberId}/role`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ role: newRole }),
        }
      );

      if (response.ok) {
        fetchWorkspaceMembers(); // Refresh the members list
        toast({
          title: "Member role updated",
          description: "The member's role has been updated",
        });
      } else {
        const errorData = await response.json();
        toast({
          title: "Failed to update role",
          description: errorData.message || "An error occurred",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error updating member role:", error);
      toast({
        title: "Error",
        description: "Failed to update member role",
        variant: "destructive",
      });
    }
  };

  // Remove member from workspace
  const removeMember = async () => {
    if (!workspace || !memberToRemove) return;

    try {
      const response = await fetch(
        `/api/workspaces/${workspace.id}/members/${memberToRemove.userId}`,
        {
          method: "DELETE",
        }
      );

      if (response.ok) {
        fetchWorkspaceMembers(); // Refresh the members list
        toast({
          title: "Member removed",
          description: `${memberToRemove.user.displayName} has been removed from the workspace`,
        });
      } else {
        const errorData = await response.json();
        toast({
          title: "Failed to remove member",
          description: errorData.message || "An error occurred",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error removing member:", error);
      toast({
        title: "Error",
        description: "Failed to remove member from workspace",
        variant: "destructive",
      });
    } finally {
      setMemberToRemove(null);
      setShowDeleteAlert(false);
    }
  };

  // Delete workspace
  const deleteWorkspace = async () => {
    if (!workspace) return;

    try {
      const response = await fetch(`/api/workspaces/${workspace.id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        toast({
          title: "Workspace deleted",
          description: "The workspace has been deleted",
        });
        onClose();
      } else {
        const errorData = await response.json();
        toast({
          title: "Failed to delete workspace",
          description: errorData.message || "An error occurred",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error deleting workspace:", error);
      toast({
        title: "Error",
        description: "Failed to delete workspace",
        variant: "destructive",
      });
    }
  };

  // Check if the current user is the owner
  const isUserOwner = () => {
    if (!workspace || !user) return false;
    return workspace.ownerId === user.id;
  };

  // Get role icon
  const getRoleIcon = (role: string) => {
    switch (role) {
      case "owner":
        return <Crown className="h-4 w-4 text-amber-500" />;
      case "admin":
        return <Shield className="h-4 w-4 text-blue-500" />;
      default:
        return <User className="h-4 w-4 text-gray-500" />;
    }
  };

  // Get role display name
  const getRoleDisplayName = (role: string) => {
    switch (role) {
      case "owner":
        return "Owner";
      case "admin":
        return "Admin";
      default:
        return "Member";
    }
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-[500px] h-auto max-h-[90vh] overflow-hidden flex flex-col p-0">
          <DialogHeader className="flex-shrink-0 px-6 pt-6 pb-2">
            <DialogTitle>Workspace Settings</DialogTitle>
            <DialogDescription>
              Manage settings for {workspace?.name || "Workspace"}
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 min-h-0 overflow-auto px-6">
            <Tabs
              defaultValue="members"
              value={activeTab}
              onValueChange={setActiveTab}
              className="w-full"
            >
              <TabsList className="w-full sticky top-0 z-10 bg-background mb-4">
                <TabsTrigger value="members" className="flex-1">
                  <Users className="h-4 w-4 mr-2" />
                  Members
                </TabsTrigger>
                <TabsTrigger value="settings" className="flex-1">
                  <Settings className="h-4 w-4 mr-2" />
                  Settings
                </TabsTrigger>
              </TabsList>

              <TabsContent
                value="members"
                className="space-y-4 data-[state=active]:block"
              >
                {/* Invite Forms */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium">
                      Invite Members
                    </CardTitle>
                    <CardDescription>
                      Add new members to this workspace
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Role selector */}
                    <div className="space-y-2">
                      <Label>Role for new members</Label>
                      <RadioGroup
                        value={inviteRole}
                        onValueChange={(value) =>
                          setInviteRole(value as "admin" | "member")
                        }
                        className="flex space-x-4"
                      >
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="member" id="role-member" />
                          <Label
                            htmlFor="role-member"
                            className="cursor-pointer"
                          >
                            Member
                          </Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="admin" id="role-admin" />
                          <Label
                            htmlFor="role-admin"
                            className="cursor-pointer"
                          >
                            Admin
                          </Label>
                        </div>
                      </RadioGroup>
                    </div>

                    {/* Email invite */}
                    <div>
                      <Label className="text-xs font-medium text-muted-foreground mb-2 block">
                        <Mail className="h-3 w-3 inline mr-1" />
                        Invite by email
                      </Label>
                      <div className="flex gap-2">
                        <div className="flex-1">
                          <Input
                            value={inviteEmail}
                            onChange={(e) => setInviteEmail(e.target.value)}
                            placeholder="Enter email address"
                            type="email"
                          />
                        </div>
                        <Button
                          onClick={handleEmailInvite}
                          disabled={!inviteEmail.trim()}
                        >
                          <UserPlus className="h-4 w-4 mr-2" />
                          Invite
                        </Button>
                      </div>
                    </div>

                    {/* Invite link */}
                    <div>
                      <Label className="text-xs font-medium text-muted-foreground mb-2 block">
                        <Link className="h-3 w-3 inline mr-1" />
                        Invite by link
                      </Label>
                      <div className="flex gap-2 mb-2">
                        <div className="flex-1">
                          <Input
                            value={inviteLink}
                            readOnly
                            placeholder="Generate an invite link"
                            className={
                              inviteLink ? "" : "text-muted-foreground"
                            }
                          />
                        </div>
                        {inviteLink ? (
                          <Button variant="outline" onClick={copyInviteLink}>
                            {linkCopied ? (
                              <Check className="h-4 w-4" />
                            ) : (
                              <Copy className="h-4 w-4" />
                            )}
                          </Button>
                        ) : (
                          <Button
                            onClick={generateInviteLink}
                            disabled={isGeneratingLink}
                          >
                            {isGeneratingLink ? (
                              <RefreshCw className="h-4 w-4 animate-spin" />
                            ) : (
                              <Link className="h-4 w-4" />
                            )}
                          </Button>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        This link will expire in 7 days
                      </p>
                    </div>
                  </CardContent>
                </Card>

                {/* Members List */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium">
                      Members
                    </CardTitle>
                    <CardDescription>
                      {workspaceMembers.length} member
                      {workspaceMembers.length !== 1 ? "s" : ""} in this
                      workspace
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-0">
                    <ScrollArea className="h-[180px] px-4 pb-4">
                      {isLoadingMembers ? (
                        <div className="flex justify-center items-center h-20">
                          <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                        </div>
                      ) : (
                        <div className="space-y-4 pt-1">
                          {workspaceMembers.map((member) => (
                            <div
                              key={member.id}
                              className="flex items-center justify-between"
                            >
                              <div className="flex items-center gap-3">
                                <Avatar className="h-8 w-8">
                                  <AvatarImage
                                    src={member.user.avatarUrl || ""}
                                  />
                                  <AvatarFallback>
                                    {getInitials(member.user.displayName)}
                                  </AvatarFallback>
                                </Avatar>
                                <div>
                                  <div className="flex items-center gap-2">
                                    <p className="text-sm font-medium">
                                      {member.user.displayName}
                                    </p>
                                    <TooltipProvider>
                                      <Tooltip>
                                        <TooltipTrigger>
                                          {getRoleIcon(member.role)}
                                        </TooltipTrigger>
                                        <TooltipContent>
                                          <p>
                                            {getRoleDisplayName(member.role)}
                                          </p>
                                        </TooltipContent>
                                      </Tooltip>
                                    </TooltipProvider>
                                  </div>
                                  <p className="text-xs text-muted-foreground">
                                    {member.user.email || member.user.username}
                                  </p>
                                </div>
                              </div>
                              {member.user.id !== user?.id && isUserOwner() && (
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon">
                                      <MoreHorizontal className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem
                                      disabled={member.role === "admin"}
                                      onClick={() =>
                                        updateMemberRole(member.id, "admin")
                                      }
                                    >
                                      <Shield className="h-4 w-4 mr-2 text-blue-500" />
                                      Make Admin
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      disabled={member.role === "member"}
                                      onClick={() =>
                                        updateMemberRole(member.id, "member")
                                      }
                                    >
                                      <User className="h-4 w-4 mr-2" />
                                      Make Member
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                      className="text-red-500 focus:text-red-500"
                                      onClick={() => {
                                        setMemberToRemove(member);
                                        setShowDeleteAlert(true);
                                      }}
                                    >
                                      <X className="h-4 w-4 mr-2" />
                                      Remove from Workspace
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              )}
                            </div>
                          ))}
                          {workspaceMembers.length === 0 && (
                            <div className="text-center py-4 text-muted-foreground">
                              No members found
                            </div>
                          )}
                        </div>
                      )}
                    </ScrollArea>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent
                value="settings"
                className="mt-4 space-y-4 data-[state=active]:block"
              >
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium">
                      Workspace Information
                    </CardTitle>
                    <CardDescription>Update workspace details</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="workspace-name">Name</Label>
                      <Input
                        id="workspace-name"
                        value={workspaceName}
                        onChange={(e) => setWorkspaceName(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="workspace-description">Description</Label>
                      <Input
                        id="workspace-description"
                        value={workspaceDescription}
                        onChange={(e) =>
                          setWorkspaceDescription(e.target.value)
                        }
                      />
                    </div>
                    <Button
                      className="w-full"
                      onClick={saveWorkspaceSettings}
                      disabled={!workspaceName.trim()}
                    >
                      Save Changes
                    </Button>
                  </CardContent>
                </Card>

                {isUserOwner() && (
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium text-red-500">
                        Danger Zone
                      </CardTitle>
                      <CardDescription>Irreversible actions</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Button
                        variant="destructive"
                        className="w-full"
                        onClick={() => setShowDeleteAlert(true)}
                      >
                        Delete Workspace
                      </Button>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>
            </Tabs>
          </div>

          <DialogFooter className="flex-shrink-0 px-6 py-4 border-t mt-auto">
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Combined AlertDialog with conditional content */}
      <AlertDialog open={showDeleteAlert} onOpenChange={setShowDeleteAlert}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {memberToRemove ? "Remove Member" : "Delete Workspace"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {memberToRemove
                ? `Are you sure you want to remove ${memberToRemove?.user.displayName} from this workspace?
                   This action cannot be undone.`
                : "Are you sure you want to delete this workspace? All channels and messages will be permanently deleted. This action cannot be undone."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => memberToRemove && setMemberToRemove(null)}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={memberToRemove ? removeMember : deleteWorkspace}
              className="bg-red-500 hover:bg-red-600"
            >
              {memberToRemove ? "Remove" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
