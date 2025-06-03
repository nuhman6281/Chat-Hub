import React from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Users } from 'lucide-react';
import { useState } from 'react';

interface InviteUserDialogProps {
  isOpen: boolean;
  onClose: () => void;
  targetType: 'workspace' | 'channel';
  targetId: number;
  targetName: string;
}

export function InviteUserDialog({ 
  isOpen, 
  onClose, 
  targetType, 
  targetId, 
  targetName 
}: InviteUserDialogProps) {
  const [username, setUsername] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleInvite = async () => {
    if (!username.trim()) {
      toast({
        title: "Username required",
        description: "Please enter a username to invite",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const url = targetType === 'workspace' 
        ? `/api/workspaces/${targetId}/members`
        : `/api/channels/${targetId}/members`;
      
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim() }),
      });
      
      if (response.ok) {
        toast({
          title: "User invited successfully",
          description: `${username} has been added to ${targetName}`,
        });
        setUsername('');
        onClose();
      } else {
        const error = await response.json();
        toast({
          title: "Invitation failed",
          description: error.message || "Failed to invite user",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Something went wrong while inviting the user",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setUsername('');
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Invite User to {targetType === 'workspace' ? 'Workspace' : 'Channel'}
          </DialogTitle>
          <DialogDescription>
            Invite a user to join "{targetName}" by entering their username.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div>
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              placeholder="Enter username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleInvite();
                }
              }}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={handleClose}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleInvite}
            disabled={isLoading || !username.trim()}
          >
            {isLoading ? "Inviting..." : "Invite User"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}