import { useChat } from "@/hooks/useChat";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Plus, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useForm } from "react-hook-form";
import { useState } from "react";

interface WorkspaceSidebarProps {
  className?: string;
}

export default function WorkspaceSidebar({ className }: WorkspaceSidebarProps) {
  const { workspaces, activeWorkspace, setActiveWorkspace, createWorkspace } = useChat();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  
  const form = useForm({
    defaultValues: {
      name: "",
      iconText: "",
    },
  });
  
  const handleCreateWorkspace = async (data: { name: string; iconText: string }) => {
    await createWorkspace(data.name, data.iconText);
    setShowCreateDialog(false);
    form.reset();
  };
  
  return (
    <>
      <div className={cn("flex flex-col bg-primary dark:bg-dark-400 w-16 shrink-0 items-center py-4", className)}>
        {/* Current and other workspaces */}
        {workspaces.map((workspace) => (
          <Tooltip key={workspace.id} delayDuration={300}>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  "relative h-10 w-10 rounded-xl mb-3 flex items-center justify-center font-bold",
                  workspace.id === activeWorkspace?.id 
                    ? "bg-white dark:bg-dark-200 text-primary dark:text-gray-200" 
                    : "bg-gray-200 dark:bg-dark-200 text-gray-700 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-dark-100"
                )}
                onClick={() => setActiveWorkspace(workspace)}
              >
                {workspace.iconText}
                {workspace.id === activeWorkspace?.id && (
                  <div className="absolute -top-1 -right-1 bg-success h-3 w-3 rounded-full border-2 border-primary dark:border-dark-400"></div>
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">
              <p>{workspace.name}</p>
            </TooltipContent>
          </Tooltip>
        ))}
        
        {/* Add workspace button */}
        <Tooltip delayDuration={300}>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10 bg-gray-200 dark:bg-dark-200 rounded-xl mb-3 text-gray-700 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-dark-100"
              onClick={() => setShowCreateDialog(true)}
            >
              <Plus className="h-5 w-5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">
            <p>Create Workspace</p>
          </TooltipContent>
        </Tooltip>
        
        {/* Spacer */}
        <div className="flex-1"></div>
        
        {/* Settings */}
        <Tooltip delayDuration={300}>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10 rounded-xl text-white dark:text-gray-300 hover:bg-primary-600 dark:hover:bg-dark-300"
            >
              <Settings className="h-5 w-5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">
            <p>Settings</p>
          </TooltipContent>
        </Tooltip>
      </div>
      
      {/* Create Workspace Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Create Workspace</DialogTitle>
            <DialogDescription>
              Create a new workspace for your team
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
