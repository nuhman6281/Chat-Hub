import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { useChat } from "@/contexts/ChatContext";
import { useToast } from "@/hooks/use-toast";
import { Loader2, CheckCircle2, XCircle, ArrowRight } from "lucide-react";

// Interface for workspace info from invite token
interface InviteInfo {
  workspaceId: number;
  workspaceName: string;
  inviterName: string;
  role: string;
}

export default function InvitePage() {
  const { token } = useParams<{ token: string }>();
  const { user } = useAuth();
  const { workspaces } = useChat();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [isLoading, setIsLoading] = useState(true);
  const [isAccepting, setIsAccepting] = useState(false);
  const [inviteInfo, setInviteInfo] = useState<InviteInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isAlreadyMember, setIsAlreadyMember] = useState(false);

  // Verify the invite token
  useEffect(() => {
    if (!token) {
      setError("Invalid invite link");
      setIsLoading(false);
      return;
    }

    const verifyInvite = async () => {
      try {
        const response = await fetch(`/api/invites/verify/${token}`);

        if (response.ok) {
          const data = await response.json();
          setInviteInfo(data);

          // Check if user is already a member of this workspace
          if (user && workspaces) {
            const isMember = workspaces.some((w) => w.id === data.workspaceId);
            setIsAlreadyMember(isMember);
          }
        } else {
          const errorData = await response.json();
          setError(errorData.message || "Invalid or expired invite link");
        }
      } catch (error) {
        console.error("Error verifying invite:", error);
        setError("Failed to verify invite link");
      } finally {
        setIsLoading(false);
      }
    };

    verifyInvite();
  }, [token, user, workspaces]);

  // Accept the invite and join the workspace
  const acceptInvite = async () => {
    if (!user || !inviteInfo) return;

    setIsAccepting(true);
    try {
      const response = await fetch(`/api/invites/accept/${token}`, {
        method: "POST",
      });

      if (response.ok) {
        toast({
          title: "Success!",
          description: `You've joined ${inviteInfo.workspaceName}`,
        });

        // Navigate to the workspace
        navigate("/");
      } else {
        const errorData = await response.json();
        setError(errorData.message || "Failed to join workspace");
        toast({
          title: "Error",
          description: errorData.message || "Failed to join workspace",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error accepting invite:", error);
      setError("Failed to join workspace");
      toast({
        title: "Error",
        description: "Failed to join workspace",
        variant: "destructive",
      });
    } finally {
      setIsAccepting(false);
    }
  };

  // Redirect to login/signup if not authenticated
  const redirectToAuth = () => {
    // Store invite token in session storage so we can retrieve it after auth
    sessionStorage.setItem("pendingInvite", token || "");
    navigate("/auth");
  };

  // If not authenticated, show login/signup prompt
  if (!isLoading && !user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Join Workspace</CardTitle>
            <CardDescription>
              {inviteInfo
                ? `You've been invited to join ${inviteInfo.workspaceName}`
                : "Please sign in to accept this invitation"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {error ? (
              <div className="flex items-center gap-2 text-red-500 mb-4">
                <XCircle className="h-5 w-5" />
                <span>{error}</span>
              </div>
            ) : inviteInfo ? (
              <div className="text-sm text-muted-foreground">
                <p>
                  You need to sign in or create an account to join this
                  workspace.
                </p>
                <p className="mt-2">Invitation details:</p>
                <ul className="list-disc pl-5 mt-1">
                  <li>Workspace: {inviteInfo.workspaceName}</li>
                  <li>Invited by: {inviteInfo.inviterName}</li>
                  <li>Role: {inviteInfo.role}</li>
                </ul>
              </div>
            ) : (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            )}
          </CardContent>
          <CardFooter className="flex justify-end">
            <Button onClick={redirectToAuth} disabled={!!error}>
              Sign in to join
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Workspace Invitation</CardTitle>
          <CardDescription>
            {inviteInfo
              ? `You've been invited to join ${inviteInfo.workspaceName}`
              : "Verifying invitation..."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : error ? (
            <div className="flex flex-col items-center gap-4 py-6">
              <XCircle className="h-12 w-12 text-red-500" />
              <div className="text-center">
                <h3 className="font-semibold text-lg">Invalid Invitation</h3>
                <p className="text-muted-foreground">{error}</p>
              </div>
              <Button onClick={() => navigate("/")} className="mt-2">
                Go to Home
              </Button>
            </div>
          ) : isAlreadyMember ? (
            <div className="flex flex-col items-center gap-4 py-6">
              <CheckCircle2 className="h-12 w-12 text-green-500" />
              <div className="text-center">
                <h3 className="font-semibold text-lg">Already a Member</h3>
                <p className="text-muted-foreground">
                  You're already a member of {inviteInfo?.workspaceName}.
                </p>
              </div>
              <Button onClick={() => navigate("/")} className="mt-2">
                Go to Workspace
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-lg bg-muted p-4">
                <h3 className="font-medium mb-2">Invitation Details</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Workspace:</span>
                    <span className="font-medium">
                      {inviteInfo?.workspaceName}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Invited by:</span>
                    <span>{inviteInfo?.inviterName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      Your role will be:
                    </span>
                    <span className="capitalize">{inviteInfo?.role}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
        {!isLoading && !error && !isAlreadyMember && (
          <CardFooter className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => navigate("/")}>
              Decline
            </Button>
            <Button onClick={acceptInvite} disabled={isAccepting}>
              {isAccepting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Joining...
                </>
              ) : (
                "Join Workspace"
              )}
            </Button>
          </CardFooter>
        )}
      </Card>
    </div>
  );
}
