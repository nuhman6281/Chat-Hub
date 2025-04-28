import { useEffect } from "react";
import AppLayout from "@/components/layout/AppLayout";
import { useChat } from "@/hooks/useChat";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useForm } from "react-hook-form";
import { useState } from "react";

export default function Home() {
  const { workspaces, isLoading, createWorkspace } = useChat();
  const [showCreateWorkspaceDialog, setShowCreateWorkspaceDialog] = useState(false);
  
  const form = useForm({
    defaultValues: {
      name: "",
      iconText: "",
    },
  });

  useEffect(() => {
    // If there are no workspaces and data is loaded, show dialog to create one
    if (!isLoading && workspaces.length === 0) {
      setShowCreateWorkspaceDialog(true);
    }
  }, [isLoading, workspaces]);

  const handleCreateWorkspace = async (data: { name: string; iconText: string }) => {
    await createWorkspace(data.name, data.iconText);
    setShowCreateWorkspaceDialog(false);
    form.reset();
  };

  return (
    <>
      <AppLayout />
      
      {/* Create First Workspace Dialog */}
      <Dialog open={showCreateWorkspaceDialog} onOpenChange={setShowCreateWorkspaceDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Create Your Workspace</DialogTitle>
            <DialogDescription>
              Create your first workspace to start chatting with your team
            </DialogDescription>
          </DialogHeader>
          
          <form onSubmit={form.handleSubmit(handleCreateWorkspace)}>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="name">Workspace Name</Label>
                <Input
                  id="name"
                  placeholder="My Workspace"
                  {...form.register("name", { required: true })}
                />
                {form.formState.errors.name && (
                  <p className="text-red-500 text-sm">Workspace name is required</p>
                )}
              </div>
              
              <div className="grid gap-2">
                <Label htmlFor="iconText">Workspace Icon Text (2 characters)</Label>
                <Input
                  id="iconText"
                  placeholder="WS"
                  maxLength={2}
                  {...form.register("iconText", { 
                    required: true,
                    maxLength: 2,
                    minLength: 1
                  })}
                />
                {form.formState.errors.iconText && (
                  <p className="text-red-500 text-sm">
                    Icon text is required and must be 1-2 characters
                  </p>
                )}
              </div>
            </div>
            
            <DialogFooter>
              <Button type="submit">Create Workspace</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
