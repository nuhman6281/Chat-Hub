import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useChat } from "@/hooks/useChat";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Hash, Lock } from "lucide-react";

interface CreateChannelModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const channelSchema = z.object({
  name: z.string().min(2, "Channel name must be at least 2 characters").max(80, "Channel name too long"),
  description: z.string().optional(),
  isPrivate: z.boolean().default(false),
});

type ChannelFormValues = z.infer<typeof channelSchema>;

export default function CreateChannelModal({ isOpen, onClose }: CreateChannelModalProps) {
  const { createChannel, activeWorkspace } = useChat();
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const form = useForm<ChannelFormValues>({
    resolver: zodResolver(channelSchema),
    defaultValues: {
      name: "",
      description: "",
      isPrivate: false,
    },
  });
  
  const onSubmit = async (data: ChannelFormValues) => {
    if (!activeWorkspace) return;
    
    try {
      setIsSubmitting(true);
      await createChannel(data.name, data.description || "", data.isPrivate);
      form.reset();
      onClose();
    } catch (error) {
      console.error("Failed to create channel:", error);
    } finally {
      setIsSubmitting(false);
    }
  };
  
  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      if (!open) {
        form.reset();
        onClose();
      }
    }}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Create a Channel</DialogTitle>
          <DialogDescription>
            Channels are where your team communicates. They're best when organized around a topic — #marketing, for example.
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name" className="flex items-center gap-1">
                <Hash className="h-4 w-4" />
                Channel Name
              </Label>
              <Input
                id="name"
                placeholder="e.g. marketing"
                {...form.register("name")}
                autoComplete="off"
                autoCapitalize="off"
              />
              {form.formState.errors.name && (
                <p className="text-red-500 text-sm">{form.formState.errors.name.message}</p>
              )}
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="description">Description <span className="text-gray-500">(optional)</span></Label>
              <Textarea
                id="description"
                placeholder="What's this channel about?"
                {...form.register("description")}
                className="resize-none"
                rows={3}
              />
            </div>
            
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="private-channel" className="flex items-center gap-1">
                  <Lock className="h-4 w-4" />
                  Make private
                </Label>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Private channels are only visible to invited members.
                </p>
              </div>
              <Switch
                id="private-channel"
                checked={form.watch("isPrivate")}
                onCheckedChange={(checked) => form.setValue("isPrivate", checked)}
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" type="button" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || !form.formState.isValid}>
              {isSubmitting ? (
                <>
                  <span className="animate-spin h-4 w-4 mr-2 border-2 border-t-transparent border-white rounded-full inline-block"></span>
                  Creating...
                </>
              ) : (
                "Create Channel"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
