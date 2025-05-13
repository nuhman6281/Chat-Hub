import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useChat } from "@/hooks/useChat";
import EmojiPicker, {
  EmojiClickData,
  Theme as EmojiTheme,
} from "emoji-picker-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Bold,
  Italic,
  Link,
  Code,
  ListOrdered,
  Smile,
  Paperclip,
  AtSign,
  Send,
  PlusCircle,
  Mic,
  MicOff,
  Square,
  X,
  MoreVertical,
  Type as TextSelect,
  FileCode as SquareCode,
  Loader2,
} from "lucide-react";
import { FileUpload } from "./FileUpload";
import { useToast } from "@/components/ui/use-toast";
import { formatDuration } from "@/lib/utils";

export default function MessageInput() {
  // Voice recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const audioChunks = useRef<Blob[]>([]);
  const recordingInterval = useRef<NodeJS.Timeout | null>(null);
  const { toast } = useToast();

  const chat = useChat();
  if (!chat) throw new Error("Chat context is null");

  const { activeChannel, activeDM, sendMessage } = chat;

  // Simplified typing implementation for now
  const setTypingStatus = useCallback((isTyping: boolean) => {
    // Implement typing indicator here when the backend supports it
    console.log("Typing status:", isTyping);
  }, []);
  const [message, setMessage] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Text selection state for formatting
  const [selectionStart, setSelectionStart] = useState<number | null>(null);
  const [selectionEnd, setSelectionEnd] = useState<number | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [cancelUpload, setCancelUpload] = useState<() => void>(() => {});

  // Emoji picker state
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const emojiPickerRef = useRef<HTMLDivElement>(null);

  // Track active formatting states
  const [activeFormats, setActiveFormats] = useState({
    bold: false,
    italic: false,
    code: false,
    link: false,
  });

  // Error state for message sending
  const [sendError, setSendError] = useState<string | null>(null);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessage(e.target.value);

    // Handle typing indicator
    if (!isTyping) {
      setIsTyping(true);
      setTypingStatus(true);
    }

    // Reset typing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Set typing timeout - stop typing indicator after 3 seconds of inactivity
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      setTypingStatus(false);
    }, 3000);
  };

  // Track selection state for formatting
  const handleSelectionChange = () => {
    if (textareaRef.current) {
      setSelectionStart(textareaRef.current.selectionStart);
      setSelectionEnd(textareaRef.current.selectionEnd);
    }
  };

  // Check if text already has formatting applied
  const hasFormatting = (
    text: string,
    formatType: "bold" | "italic" | "code" | "link"
  ) => {
    switch (formatType) {
      case "bold":
        return /^\*\*.*\*\*$/.test(text);
      case "italic":
        return /^\*.*\*$/.test(text) && !/^\*\*.*\*\*$/.test(text);
      case "code":
        return /^`.*`$/.test(text);
      case "link":
        return /^\[.*\]\(.*\)$/.test(text);
      default:
        return false;
    }
  };

  // Apply or remove formatting to selected text
  const applyFormatting = (formatType: "bold" | "italic" | "code" | "link") => {
    if (!textareaRef.current) return;

    const textarea = textareaRef.current;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;

    // Set active formatting if nothing is selected
    if (start === end) {
      setActiveFormats((prev) => ({
        ...prev,
        [formatType]: !prev[formatType as keyof typeof prev],
      }));

      // If we're turning on formatting, insert placeholder
      if (!activeFormats[formatType as keyof typeof activeFormats]) {
        let formattedText = "";
        let cursorOffset = 0;

        switch (formatType) {
          case "bold":
            formattedText = "**bold text**";
            cursorOffset = 2;
            break;
          case "italic":
            formattedText = "*italic text*";
            cursorOffset = 1;
            break;
          case "code":
            formattedText = "`code`";
            cursorOffset = 1;
            break;
          case "link":
            formattedText = "[link text](url)";
            cursorOffset = 1;
            break;
        }

        const newMessage =
          message.substring(0, start) + formattedText + message.substring(end);

        setMessage(newMessage);

        // Set cursor position inside the formatting markers
        setTimeout(() => {
          textarea.focus();
          textarea.setSelectionRange(
            start + cursorOffset,
            start + formattedText.length - cursorOffset
          );
        }, 0);
      }
      return;
    }

    // Text is selected, check if we should apply or remove formatting
    const selectedText = message.substring(start, end);
    const isFormatted = hasFormatting(selectedText, formatType);

    let newText;
    let newCursorPos;

    if (isFormatted) {
      // Remove formatting
      switch (formatType) {
        case "bold":
          newText = selectedText.slice(2, -2); // Remove ** from both ends
          break;
        case "italic":
          newText = selectedText.slice(1, -1); // Remove * from both ends
          break;
        case "code":
          newText = selectedText.slice(1, -1); // Remove ` from both ends
          break;
        case "link":
          const linkMatch = selectedText.match(/^\[(.*?)\]\(.*\)$/);
          newText = linkMatch ? linkMatch[1] : selectedText;
          break;
        default:
          newText = selectedText;
      }
      newCursorPos = start + newText.length;
    } else {
      // Apply formatting
      switch (formatType) {
        case "bold":
          newText = `**${selectedText}**`;
          break;
        case "italic":
          newText = `*${selectedText}*`;
          break;
        case "code":
          newText = `\`${selectedText}\``;
          break;
        case "link":
          newText = `[${selectedText}](url)`;
          break;
        default:
          newText = selectedText;
      }
      newCursorPos = start + newText.length;
    }

    const newMessage =
      message.substring(0, start) + newText + message.substring(end);

    setMessage(newMessage);

    // Set cursor position after the formatted text
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(newCursorPos, newCursorPos);
    }, 0);
  };

  // Insert code block
  const insertCodeBlock = () => {
    if (!textareaRef.current) return;

    const textarea = textareaRef.current;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;

    const selectedText =
      start !== end ? message.substring(start, end) : "Enter code here";
    const codeBlock = `\`\`\`
${selectedText}
\`\`\``;

    const newMessage =
      message.substring(0, start) + codeBlock + message.substring(end);

    setMessage(newMessage);

    // Set cursor position inside the code block
    setTimeout(() => {
      textarea.focus();
      if (start === end) {
        textarea.setSelectionRange(
          start + 4,
          start + 4 + "Enter code here".length
        );
      } else {
        // Position cursor at the end of the code block
        const newPosition = start + codeBlock.length;
        textarea.setSelectionRange(newPosition, newPosition);
      }
    }, 0);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;

    try {
      await sendMessage(message.trim());
      setMessage("");
    } catch (err) {
      console.error("Failed to send message:", err);
    }
  };

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      const newHeight = Math.min(textareaRef.current.scrollHeight, 120);
      textareaRef.current.style.height = `${newHeight}px`;
    }
  }, [message]);

  // Voice recording functions
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorder.current = new MediaRecorder(stream);
      audioChunks.current = [];

      mediaRecorder.current.ondataavailable = (e) => {
        audioChunks.current.push(e.data);
      };

      mediaRecorder.current.onstop = async () => {
        if (audioChunks.current.length === 0) return;

        const audioBlob = new Blob(audioChunks.current, { type: "audio/wav" });
        handleVoiceMessage(audioBlob);
      };

      mediaRecorder.current.start();
      setIsRecording(true);

      // Update recording time
      recordingInterval.current = setInterval(() => {
        setRecordingTime((time) => time + 1);
      }, 1000);
    } catch (err) {
      console.error("Failed to start recording:", err);
      toast({
        title: "Error",
        description:
          "Could not access microphone. Please check your permissions.",
        variant: "destructive",
      });
    }
  };

  const stopRecording = () => {
    if (mediaRecorder.current && mediaRecorder.current.state !== "inactive") {
      mediaRecorder.current.stop();

      // Stop all audio tracks
      mediaRecorder.current.stream.getTracks().forEach((track) => track.stop());

      if (recordingInterval.current) {
        clearInterval(recordingInterval.current);
        recordingInterval.current = null;
      }

      setIsRecording(false);
      setRecordingTime(0);
    }
  };

  const handleVoiceMessage = async (audioBlob: Blob) => {
    if (!activeChannel && !activeDM) return;

    try {
      // Create a form data object to send the audio file
      const formData = new FormData();
      formData.append("file", audioBlob, "recording.webm");

      // Use the appropriate ID based on active channel or DM
      if (activeChannel) {
        formData.append("channelId", activeChannel.id.toString());
      } else if (activeDM) {
        formData.append("directMessageId", activeDM.id.toString());
      }

      // For now, we'll just add a mock implementation
      // In a real implementation, this would call an API to upload the file
      toast({
        title: "Voice message",
        description:
          "Voice message recording feature is implemented but backend API is pending",
      });

      // Send a text message indicating a voice message was attempted
      await sendMessage("[Voice message recorded - API integration pending]");
    } catch (error) {
      console.error("Failed to send voice message:", error);
      toast({
        title: "Error",
        description: "Failed to send voice message",
        variant: "destructive",
      });
    }
  };

  // Handle file upload
  const handleFileUpload = async (file: File) => {
    try {
      setIsUploading(true);

      // Create form data and cancelation token
      const formData = new FormData();
      formData.append("file", file);

      // Create a cancelable upload simulation
      const cancelTokenSource = { cancel: false };
      setCancelUpload(() => () => {
        cancelTokenSource.cancel = true;
      });

      // Simulate upload progress (would be replaced with real API call)
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          if (cancelTokenSource.cancel) {
            reject(new Error("Upload cancelled"));
          } else {
            resolve();
          }
        }, 2000); // Simulate 2 second upload

        // Store the timeout so it can be cleared if component unmounts
        return () => clearTimeout(timeout);
      });

      // If upload was cancelled, don't proceed
      if (cancelTokenSource.cancel) return;

      toast({
        title: "File uploaded",
        description: `File "${file.name}" uploaded successfully.`,
        variant: "default",
      });

      // Send a text message indicating a file was uploaded
      await sendMessage(
        `[File uploaded: ${file.name} - ${formatFileSize(file.size)}]`
      );
    } catch (error) {
      if ((error as Error).message === "Upload cancelled") {
        toast({
          title: "Upload cancelled",
          description: "File upload was cancelled.",
          variant: "default",
        });
        return;
      }

      console.error("Failed to upload file:", error);
      toast({
        title: "Error",
        description: "Failed to upload file. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  // Helper function for file size formatting
  const formatFileSize = (bytes: number): string => {
    const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
    if (bytes === 0) return "0 Bytes";
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return parseFloat((bytes / Math.pow(1024, i)).toFixed(2)) + " " + sizes[i];
  };

  // Handle emoji selection
  const handleEmojiClick = (emojiData: EmojiClickData) => {
    if (!textareaRef.current) return;

    const textarea = textareaRef.current;
    const start = textarea.selectionStart;

    // Insert emoji at cursor position
    const newMessage =
      message.substring(0, start) + emojiData.emoji + message.substring(start);

    setMessage(newMessage);

    // Set cursor position after the emoji
    setTimeout(() => {
      textarea.focus();
      const newPosition = start + emojiData.emoji.length;
      textarea.setSelectionRange(newPosition, newPosition);
    }, 0);

    // Close the emoji picker
    setShowEmojiPicker(false);
  };

  // Close emoji picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        emojiPickerRef.current &&
        !emojiPickerRef.current.contains(event.target as Node) &&
        !(event.target as Element).closest('[data-emoji-trigger="true"]')
      ) {
        setShowEmojiPicker(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Format recording time (MM:SS)
  const formatRecordingTime = (timeInSeconds: number): string => {
    const minutes = Math.floor(timeInSeconds / 60);
    const seconds = timeInSeconds % 60;
    return `${minutes.toString().padStart(2, "0")}:${seconds
      .toString()
      .padStart(2, "0")}`;
  };

  // Handle text selection for formatting
  const handleTextSelect = () => {
    if (textareaRef.current) {
      setSelectionStart(textareaRef.current.selectionStart);
      setSelectionEnd(textareaRef.current.selectionEnd);
    }
  };

  // Finish recording function
  const finishRecording = () => {
    if (!mediaRecorder.current) return;
    mediaRecorder.current.stop();

    if (recordingInterval.current) {
      clearInterval(recordingInterval.current);
      recordingInterval.current = null;
    }

    setIsRecording(false);

    // In a real implementation, you would process the audio blob and send it
    toast({
      title: "Voice message",
      description:
        "Voice message feature is implemented but backend API is pending",
    });

    // Reset state
    setRecordingTime(0);
    audioChunks.current = [];
  };

  // Disable the input if there's no active chat
  const isChatDisabled = !activeChannel && !activeDM;

  const placeholder = activeChannel
    ? `Message #${activeChannel.name}`
    : activeDM
    ? `Message User`
    : "Type a message...";
  return (
    <div className="px-2 py-2 border-t bg-background">
      {isRecording ? (
        <div className="flex items-center justify-between px-4 py-2 rounded-md bg-primary/5 animate-pulse">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-destructive" />
            <span>Recording {formatRecordingTime(recordingTime)}</span>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={stopRecording} size="sm" variant="ghost">
              <X className="w-4 h-4 mr-2" />
              Cancel
            </Button>
            <Button onClick={finishRecording} size="sm" variant="default">
              <Send className="w-4 h-4 mr-2" />
              Send
            </Button>
          </div>
        </div>
      ) : (
        <>
          {/* Formatting toolbar - hidden on mobile */}
          <div className="hidden md:flex items-center gap-1 px-3 pb-2">
            <Button
              variant={activeFormats.bold ? "secondary" : "ghost"}
              size="icon"
              className="h-8 w-8 rounded-md"
              onClick={() => applyFormatting("bold")}
              title="Bold (Ctrl+B)"
              tabIndex={-1}
            >
              <Bold className="h-4 w-4" />
            </Button>
            <Button
              variant={activeFormats.italic ? "secondary" : "ghost"}
              size="icon"
              className="h-8 w-8 rounded-md"
              onClick={() => applyFormatting("italic")}
              title="Italic (Ctrl+I)"
              tabIndex={-1}
            >
              <Italic className="h-4 w-4" />
            </Button>
            <Button
              variant={activeFormats.code ? "secondary" : "ghost"}
              size="icon"
              className="h-8 w-8 rounded-md"
              onClick={() => applyFormatting("code")}
              title="Inline Code (Ctrl+`)"
              tabIndex={-1}
            >
              <Code className="h-4 w-4" />
            </Button>
            <Button
              variant={activeFormats.link ? "secondary" : "ghost"}
              size="icon"
              className="h-8 w-8 rounded-md"
              onClick={() => applyFormatting("link")}
              title="Link (Ctrl+K)"
              tabIndex={-1}
            >
              <Link className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-md"
              onClick={insertCodeBlock}
              title="Code Block (Ctrl+\\)"
              tabIndex={-1}
            >
              <SquareCode className="h-4 w-4" />
            </Button>
          </div>

          <div className="relative flex items-center">
            <Textarea
              ref={textareaRef}
              placeholder={placeholder}
              className={`min-h-10 py-3 pr-24 resize-none ${
                sendError ? "border-destructive" : ""
              }`}
              rows={1}
              value={message}
              onChange={handleInputChange}
              onKeyDown={handleSubmit}
              onSelect={handleTextSelect}
              disabled={isChatDisabled}
            />

            {/* Emoji picker */}
            {showEmojiPicker && (
              <div
                className="absolute bottom-full right-0 mb-2 z-50"
                ref={emojiPickerRef}
              >
                <EmojiPicker
                  onEmojiClick={handleEmojiClick}
                  theme={
                    document.documentElement.classList.contains("dark")
                      ? EmojiTheme.DARK
                      : EmojiTheme.LIGHT
                  }
                  width={300}
                  height={400}
                  searchPlaceHolder="Search emoji..."
                  previewConfig={{ showPreview: false }}
                />
              </div>
            )}

            {/* Action buttons - aligned on the right */}
            <div className="absolute right-2 top-3 flex items-center gap-1">
              {/* Emoji button */}
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-full"
                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                disabled={isChatDisabled}
                data-emoji-trigger="true"
                title="Add emoji"
              >
                <Smile className="h-4 w-4" />
              </Button>

              {/* Send button */}
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-full"
                onClick={handleSubmit}
                disabled={isChatDisabled || !message.trim()}
                title="Send message"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>

            {/* Show formatting options on mobile */}
            <div className="md:hidden absolute right-[4.5rem] top-3">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 rounded-full"
                  >
                    <TextSelect className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => applyFormatting("bold")}>
                    <Bold className="h-4 w-4 mr-2" />
                    <span>Bold</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => applyFormatting("italic")}>
                    <Italic className="h-4 w-4 mr-2" />
                    <span>Italic</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => applyFormatting("code")}>
                    <Code className="h-4 w-4 mr-2" />
                    <span>Inline Code</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => applyFormatting("link")}>
                    <Link className="h-4 w-4 mr-2" />
                    <span>Link</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={insertCodeBlock}>
                    <SquareCode className="h-4 w-4 mr-2" />
                    <span>Code Block</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* Error message */}
          {sendError && (
            <div className="text-xs text-destructive mt-1 ml-3">
              {sendError}
            </div>
          )}

          {/* Bottom toolbar */}
          <div className="flex items-center justify-between pt-2 px-3">
            <div className="flex items-center gap-2">
              {/* File upload button */}
              <label htmlFor="file-upload" className="cursor-pointer">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-full"
                  tabIndex={-1}
                  disabled={isChatDisabled || isUploading}
                  title="Attach file"
                >
                  <Paperclip className="h-4 w-4" />
                </Button>
              </label>
              <input
                id="file-upload"
                type="file"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    handleFileUpload(e.target.files[0]);
                    e.target.value = ""; // Reset input
                  }
                }}
                disabled={isChatDisabled || isUploading}
              />

              {/* Voice recording button */}
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-full"
                onClick={startRecording}
                disabled={isRecording || isChatDisabled}
                title="Voice recording"
              >
                <Mic className="h-4 w-4" />
              </Button>
            </div>

            {/* Upload status indicator */}
            {isUploading && (
              <div className="flex items-center text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                Uploading...
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 ml-1"
                  onClick={() => cancelUpload()}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
