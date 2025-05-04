import { useState, useEffect, useRef } from "react";
import { useSocket } from "@/lib/socket";
import { useAuth } from "@/contexts/AuthContext";
import {
  Message as MessageType,
  MessageWithReactions,
  User,
  Reaction,
} from "@shared/schema";
import { format } from "date-fns";
import { cn, getInitials } from "@/lib/utils";
import {
  Smile,
  Reply,
  ThumbsUp,
  Heart,
  Download,
  File,
  MoreVertical,
  Plus,
  Check,
  Loader2,
  MessageSquare,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import CodeBlock from "./CodeBlock";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
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

interface MessageProps {
  message: MessageWithReactions;
  user?: User;
}

interface ReactionType {
  emoji: string;
  count: number;
  users: string[];
  name: string;
}

export default function Message({ message, user }: MessageProps) {
  // Get user from useAuth if not provided via props
  const auth = useAuth();
  const currentUser = user || auth?.user || null;
  const { toast } = useToast();
  const socket = useSocket();
  const [codeBlocks, setCodeBlocks] = useState<
    { code: string; language: string }[]
  >([]);
  const [contentWithoutCode, setContentWithoutCode] = useState(message.content);
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const [isAddingReaction, setIsAddingReaction] = useState(false);
  const reactionPickerRef = useRef<HTMLDivElement>(null);

  // Common reactions that can be added
  const commonReactions = [
    { emoji: "👍", name: "thumbs_up" },
    { emoji: "❤️", name: "heart" },
    { emoji: "😂", name: "joy" },
    { emoji: "🎉", name: "tada" },
    { emoji: "🙏", name: "pray" },
    { emoji: "👀", name: "eyes" },
  ];

  // Close reaction picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        reactionPickerRef.current &&
        !reactionPickerRef.current.contains(event.target as Node)
      ) {
        setShowReactionPicker(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Listen for socket reaction events
  useEffect(() => {
    const handleReactionEvent = (data: any) => {
      if (data && data.messageId === message.id) {
        // The server will send the updated message with reactions
        if (data.message) {
          message.reactions = data.message.reactions;
        }
      }
    };

    const cleanup = socket.on("message_reaction", handleReactionEvent);
    return () => cleanup();
  }, [message.id, socket]);

  // Function to add/remove reaction
  const handleToggleReaction = async (emoji: string, name: string) => {
    if (!currentUser?.id) {
      toast({
        title: "Authentication required",
        description: "You must be logged in to react to messages.",
        variant: "destructive",
      });
      return;
    }

    setIsAddingReaction(true);

    try {
      const response = await fetch(`/api/messages/${message.id}/reactions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          emoji,
          name,
          action: "toggle",
        }),
      });

      if (!response.ok) {
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          const errorData = await response.json();
          throw new Error(errorData.error || "Failed to toggle reaction");
        } else {
          throw new Error(`Server error: ${response.status}`);
        }
      }

      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        throw new Error("Invalid response format from server");
      }

      const updatedMessage = await response.json();
      if (updatedMessage && updatedMessage.reactions) {
        message.reactions = updatedMessage.reactions;
      }
    } catch (error) {
      console.error("Error updating reaction:", error);
      toast({
        title: "Failed to update reaction",
        description:
          error instanceof Error
            ? error.message
            : "Could not update the reaction. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsAddingReaction(false);
      setShowReactionPicker(false);
    }
  };

  // Group reactions by emoji
  const groupedReactions = message.reactions?.reduce((acc, reaction) => {
    const key = reaction.emoji;
    if (!acc[key]) {
      acc[key] = {
        emoji: reaction.emoji,
        name: reaction.name,
        count: 0,
        users: [],
      };
    }
    acc[key].count++;
    acc[key].users.push(reaction.userId.toString());
    return acc;
  }, {} as Record<string, { emoji: string; name: string; count: number; users: string[] }>);

  // Simple URL detection regex
  const urlRegex = /(https?:\/\/[^\s]+)/g;

  // Improved code block detection with language support
  const codeBlockRegex = /```([\w]*)?\s*\n([\s\S]*?)```/g;

  // Process content on mount to extract code blocks
  useEffect(() => {
    const blocks: { code: string; language: string }[] = [];
    let content = message.content;

    // Extract code blocks
    content = content.replace(
      codeBlockRegex,
      (match: string, language: string, code: string) => {
        blocks.push({
          code: code.trim(),
          language: (language || "").trim() || "plaintext",
        });
        return "{{CODE_BLOCK_" + (blocks.length - 1) + "}}";
      }
    );

    setCodeBlocks(blocks);
    setContentWithoutCode(content);
  }, [message.content]);

  // Format message content with markdown formatting
  const formatContent = (content: string) => {
    let formattedContent = content;

    // Replace URLs with link elements
    formattedContent = formattedContent.replace(urlRegex, (url) => {
      return `<a href="${url}" target="_blank" rel="noopener noreferrer" class="text-primary hover:underline">${url}</a>`;
    });

    // Handle markdown link format [text](url)
    formattedContent = formattedContent.replace(
      /\[([^\]]+)\]\(([^)]+)\)/g,
      (match, text, url) => {
        return `<a href="${url}" target="_blank" rel="noopener noreferrer" class="text-primary hover:underline">${text}</a>`;
      }
    );

    // Handle bold text with ** markers
    formattedContent = formattedContent.replace(
      /\*\*([^*]+)\*\*/g,
      (match, text) => {
        return `<strong class="font-bold">${text}</strong>`;
      }
    );

    // Handle italic text with * markers (but not if it's already part of a bold text)
    formattedContent = formattedContent.replace(
      /(?<!\*)\*([^*]+)\*(?!\*)/g,
      (match, text) => {
        return `<em class="italic">${text}</em>`;
      }
    );

    // Handle inline code with ` markers
    formattedContent = formattedContent.replace(/`([^`]+)`/g, (match, text) => {
      return `<code class="px-1.5 py-0.5 rounded bg-muted font-mono text-xs">${text}</code>`;
    });

    return formattedContent;
  };

  // Check if the message contains a file attachment
  const hasFileAttachment =
    message.content.includes("[File uploaded:") ||
    message.content.includes("file:");

  // Extract filename from message content for file attachments
  const getFileInfo = () => {
    if (!hasFileAttachment) return null;

    // Try to extract filename from the message content
    const fileMatch = message.content.match(/\[File uploaded: (.+?) -/i);
    const fileName = fileMatch ? fileMatch[1] : "File.pdf";

    // Get file extension to determine icon and type
    const extension = fileName.split(".").pop()?.toLowerCase() || "";
    const fileTypeMap: Record<string, string> = {
      pdf: "PDF Document",
      doc: "Word Document",
      docx: "Word Document",
      xls: "Excel Spreadsheet",
      xlsx: "Excel Spreadsheet",
      ppt: "PowerPoint Presentation",
      pptx: "PowerPoint Presentation",
      jpg: "JPEG Image",
      jpeg: "JPEG Image",
      png: "PNG Image",
      gif: "GIF Image",
      mp3: "Audio File",
      mp4: "Video File",
      wav: "Audio File",
    };

    const fileType = extension in fileTypeMap ? fileTypeMap[extension] : "File";

    return { name: fileName, type: fileType, extension };
  };

  const fileInfo = getFileInfo();

  // Render message content with code blocks and formatting
  const renderContent = () => {
    let content = contentWithoutCode;

    // Replace code block placeholders with actual code blocks
    codeBlocks.forEach((block, index) => {
      content = content.replace(
        `{{CODE_BLOCK_${index}}}`,
        `<pre class="bg-muted rounded-lg p-3 border border-border text-sm font-mono overflow-x-auto my-2"><code class="language-${block.language}">${block.code}</code></pre>`
      );
    });

    return <div dangerouslySetInnerHTML={{ __html: formatContent(content) }} />;
  };

  return (
    <div className="group relative mb-6 flex animate-in fade-in duration-200 w-full max-w-full">
      <div className="mr-3 flex-shrink-0">
        <Avatar className="h-9 w-9 border bg-primary/5 sm:h-10 sm:w-10">
          <AvatarImage src={message.user?.avatarUrl || ""} />
          <AvatarFallback className="text-primary">
            {message.user?.displayName
              ? getInitials(message.user.displayName)
              : "?"}
          </AvatarFallback>
        </Avatar>
      </div>

      <div className="flex-1 space-y-2 overflow-hidden min-w-0">
        <div className="flex items-center justify-between flex-wrap gap-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-sm hover:underline truncate max-w-[150px] sm:max-w-[300px]">
              {message.user?.displayName || "Unknown"}
            </span>
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              {format(new Date(message.createdAt), "p")}
            </span>
          </div>

          {/* Message actions menu */}
          <div className="opacity-0 transition-opacity duration-200 group-hover:opacity-100">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-full"
                >
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem>
                  <Reply className="mr-2 h-4 w-4" />
                  <span>Reply</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setShowReactionPicker(true)}>
                  <Smile className="mr-2 h-4 w-4" />
                  <span>Add Reaction</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem>
                  <MessageSquare className="mr-2 h-4 w-4" />
                  <span>Quote</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Message body */}
        <div className="prose max-w-none text-sm dark:prose-invert prose-p:leading-relaxed prose-pre:p-0 break-words overflow-hidden">
          {renderContent()}
        </div>

        {/* Message reactions */}
        <div className="flex flex-wrap gap-1 pt-1">
          {groupedReactions && Object.values(groupedReactions).length > 0 && (
            <>
              {Object.values(groupedReactions).map((reaction, index) => (
                <button
                  key={index}
                  onClick={() =>
                    handleToggleReaction(reaction.emoji, reaction.name)
                  }
                  className={cn(
                    "flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition-colors",
                    reaction.users.includes(currentUser?.id?.toString() || "")
                      ? "bg-primary/10 border-primary/20"
                      : "hover:bg-muted border-border"
                  )}
                >
                  <span>{reaction.emoji}</span>
                  <span>{reaction.count}</span>
                </button>
              ))}
            </>
          )}

          {/* Add reaction button */}
          <div className="relative">
            <button
              onClick={() => setShowReactionPicker(!showReactionPicker)}
              className="flex items-center rounded-full border border-border hover:bg-muted px-2 py-0.5 text-xs"
            >
              <Smile className="h-3 w-3 mr-1" />
              <span>Add Reaction</span>
            </button>

            {/* Reaction picker */}
            {showReactionPicker && (
              <div
                ref={reactionPickerRef}
                className="absolute bottom-full left-0 mb-1 bg-popover border rounded-lg shadow-md p-2 z-50 flex gap-1"
              >
                {commonReactions.map((reaction) => (
                  <button
                    key={reaction.name}
                    className="hover:bg-muted rounded p-1.5 transition-colors"
                    onClick={() =>
                      handleToggleReaction(reaction.emoji, reaction.name)
                    }
                  >
                    <span className="text-lg">{reaction.emoji}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* File attachment if present */}
        {fileInfo && (
          <div className="mt-2 rounded-lg border border-border bg-background/50 p-3">
            <div className="flex items-center gap-3">
              <div className="rounded-md bg-secondary p-2">
                <File className="h-6 w-6 text-secondary-foreground" />
              </div>
              <div className="flex-1 truncate">
                <div className="font-medium">{fileInfo.name}</div>
                <div className="text-xs text-muted-foreground">
                  {fileInfo.type}
                </div>
              </div>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <Download className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Download file</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
