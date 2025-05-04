import { useState, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { Paperclip, X } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

interface FileUploadProps {
  onUpload: (file: File) => Promise<void>;
}

export function FileUpload({ onUpload }: FileUploadProps) {
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      toast({ title: "Error", description: "File size must be less than 10MB" });
      return;
    }

    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => setPreview(e.target?.result as string);
      reader.readAsDataURL(file);
    }

    try {
      setUploading(true);
      await onUpload(file);
      toast({ title: "Success", description: "File uploaded successfully" });
    } catch (error) {
      toast({ title: "Error", description: "Failed to upload file" });
    } finally {
      setUploading(false);
      if (fileRef.current) {
        fileRef.current.value = '';
      }
    }
  };

  return (
    <div className="relative">
      <input
        type="file"
        ref={fileRef}
        className="hidden"
        onChange={handleFileChange}
        accept="image/*,video/*,audio/*,.pdf,.doc,.docx"
      />
      
      <Button
        variant="ghost"
        size="sm"
        onClick={() => fileRef.current?.click()}
        disabled={uploading}
      >
        <Paperclip className="h-4 w-4" />
      </Button>

      {preview && (
        <div className="absolute bottom-full mb-2 p-2 bg-background border rounded-md">
          <Button
            variant="ghost"
            size="sm"
            className="absolute top-1 right-1"
            onClick={() => setPreview(null)}
          >
            <X className="h-4 w-4" />
          </Button>
          <img src={preview} alt="Preview" className="max-w-[200px] max-h-[200px]" />
        </div>
      )}
    </div>
  );
}
