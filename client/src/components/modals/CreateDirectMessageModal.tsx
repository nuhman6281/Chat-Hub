import { useState, useEffect } from "react";
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
import { useChat } from "@/contexts/ChatContext";
import { useAuth } from "@/contexts/AuthContext";
import { apiRequest } from "@/lib/queryClient";
import { Search } from "lucide-react";
import { UserAvatar } from "@/components/UserAvatar";
import { ClientUser } from "@shared/schema";

interface CreateDirectMessageModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface UserSearchResult extends ClientUser {}

export default function CreateDirectMessageModal({
  isOpen,
  onClose,
}: CreateDirectMessageModalProps) {
  const { createDirectMessage } = useChat();
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<UserSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserSearchResult | null>(
    null
  );

  // Handle search term changes
  useEffect(() => {
    if (searchTerm.length < 3) {
      setSearchResults([]);
      return;
    }

    const searchUsers = async () => {
      try {
        setIsSearching(true);
        const response = await fetch(
          `/api/users?search=${encodeURIComponent(searchTerm)}`,
          {
            credentials: "include",
          }
        );

        if (response.ok) {
          const users = await response.json();
          // Filter out current user
          const filteredUsers = users.filter(
            (u: UserSearchResult) => u.id !== user?.id
          );
          setSearchResults(filteredUsers);
        } else {
          setSearchResults([]);
        }
      } catch (error) {
        console.error("Error searching users:", error);
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    };

    const timeoutId = setTimeout(searchUsers, 500);
    return () => clearTimeout(timeoutId);
  }, [searchTerm, user?.id]);

  const handleCreateConversation = async () => {
    if (!selectedUser) return;

    try {
      setIsSubmitting(true);
      await createDirectMessage(selectedUser.id);
      onClose();
    } catch (error) {
      console.error("Failed to create conversation:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setSearchTerm("");
    setSelectedUser(null);
    setSearchResults([]);
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          resetForm();
          onClose();
        }
      }}
    >
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>New Message</DialogTitle>
          <DialogDescription>
            Start a direct message conversation with a team member.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="user-search">To:</Label>
            <div className="relative">
              <Input
                id="user-search"
                placeholder="Search by name or email"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                disabled={!!selectedUser}
                className="pr-8"
              />
              <Search className="absolute right-3 top-2.5 h-4 w-4 text-gray-400" />
            </div>

            {isSearching && (
              <div className="py-2 text-center">
                <span className="animate-spin h-4 w-4 mr-2 border-2 border-t-transparent border-primary rounded-full inline-block"></span>
                Searching...
              </div>
            )}

            {selectedUser ? (
              <div className="mt-2 flex items-center p-2 border rounded-md bg-light-300 dark:bg-dark-100">
                <UserAvatar
                  user={selectedUser}
                  className="h-8 w-8 mr-2"
                  showStatus
                />
                <div className="flex-1">
                  <div className="font-medium">{selectedUser.displayName}</div>
                  <div className="text-xs text-gray-500">
                    {selectedUser.email}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedUser(null)}
                >
                  Remove
                </Button>
              </div>
            ) : searchResults.length > 0 ? (
              <div className="max-h-48 overflow-y-auto border rounded-md divide-y">
                {searchResults.map((user) => (
                  <div
                    key={user.id}
                    className="p-2 hover:bg-light-400 dark:hover:bg-dark-100 cursor-pointer flex items-center"
                    onClick={() => setSelectedUser(user)}
                  >
                    <UserAvatar
                      user={user}
                      className="h-8 w-8 mr-2"
                      showStatus
                    />
                    <div>
                      <div className="font-medium">{user.displayName}</div>
                      <div className="text-xs text-gray-500">{user.email}</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              searchTerm.length >= 3 &&
              !isSearching && (
                <div className="py-2 text-center text-gray-500">
                  No users found. Try a different search term.
                </div>
              )
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleCreateConversation}
            disabled={isSubmitting || !selectedUser}
          >
            {isSubmitting ? (
              <>
                <span className="animate-spin h-4 w-4 mr-2 border-2 border-t-transparent border-white rounded-full inline-block"></span>
                Creating...
              </>
            ) : (
              "Start Conversation"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
