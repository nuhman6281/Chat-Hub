import { useState, useCallback, useRef } from 'react';
import { Upload, File, Image, Video, Music, X, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { useMutation } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

interface FileUploadProps {
  onFileSelect: (file: File, preview?: string) => void;
  accept?: string;
  maxSize?: number; // in bytes
  multiple?: boolean;
}

interface FilePreview {
  file: File;
  preview?: string;
  type: 'image' | 'video' | 'audio' | 'document';
}

export function FileUpload({ onFileSelect, accept = "*/*", maxSize = 50 * 1024 * 1024, multiple = false }: FileUploadProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [previews, setPreviews] = useState<FilePreview[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const getFileType = (file: File): 'image' | 'video' | 'audio' | 'document' => {
    if (file.type.startsWith('image/')) return 'image';
    if (file.type.startsWith('video/')) return 'video';
    if (file.type.startsWith('audio/')) return 'audio';
    return 'document';
  };

  const getFileIcon = (type: string) => {
    switch (type) {
      case 'image': return <Image className="h-8 w-8" />;
      case 'video': return <Video className="h-8 w-8" />;
      case 'audio': return <Music className="h-8 w-8" />;
      default: return <File className="h-8 w-8" />;
    }
  };

  const createPreview = async (file: File): Promise<FilePreview> => {
    const type = getFileType(file);
    let preview: string | undefined;

    if (type === 'image') {
      preview = URL.createObjectURL(file);
    } else if (type === 'video') {
      preview = URL.createObjectURL(file);
    }

    return { file, preview, type };
  };

  const processFiles = async (files: FileList) => {
    const fileArray = Array.from(files);
    
    // Validate file sizes
    const invalidFiles = fileArray.filter(file => file.size > maxSize);
    if (invalidFiles.length > 0) {
      toast({
        title: 'File too large',
        description: `Maximum file size is ${Math.round(maxSize / (1024 * 1024))}MB`,
        variant: 'destructive',
      });
      return;
    }

    const newPreviews = await Promise.all(fileArray.map(createPreview));
    setPreviews(multiple ? [...previews, ...newPreviews] : newPreviews);
    setShowPreview(true);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      processFiles(files);
    }
  }, [maxSize, multiple, previews]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      processFiles(files);
    }
  };

  const removePreview = (index: number) => {
    const newPreviews = previews.filter((_, i) => i !== index);
    setPreviews(newPreviews);
    if (newPreviews.length === 0) {
      setShowPreview(false);
    }
  };

  const confirmUpload = () => {
    previews.forEach(({ file, preview }) => {
      onFileSelect(file, preview);
    });
    setPreviews([]);
    setShowPreview(false);
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <>
      <div
        className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer ${
          isDragOver ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50'
        }`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => fileInputRef.current?.click()}
      >
        <Upload className="h-10 w-10 mx-auto mb-4 text-muted-foreground" />
        <div className="text-sm font-medium mb-2">
          Drop files here or click to browse
        </div>
        <div className="text-xs text-muted-foreground">
          Maximum file size: {Math.round(maxSize / (1024 * 1024))}MB
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          onChange={handleFileSelect}
          className="hidden"
        />
      </div>

      {/* File Preview Dialog */}
      <Dialog open={showPreview} onOpenChange={(open) => {
        if (!open) {
          setPreviews([]);
        }
        setShowPreview(open);
      }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>File Preview</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 max-h-96 overflow-y-auto">
            {previews.map((filePreview, index) => (
              <div key={index} className="border rounded-lg p-4">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0">
                    {filePreview.type === 'image' && filePreview.preview ? (
                      <img
                        src={filePreview.preview}
                        alt={filePreview.file.name}
                        className="w-16 h-16 object-cover rounded"
                      />
                    ) : filePreview.type === 'video' && filePreview.preview ? (
                      <video
                        src={filePreview.preview}
                        className="w-16 h-16 object-cover rounded"
                        muted
                      />
                    ) : (
                      <div className="w-16 h-16 bg-muted rounded flex items-center justify-center">
                        {getFileIcon(filePreview.type)}
                      </div>
                    )}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{filePreview.file.name}</div>
                    <div className="text-sm text-muted-foreground">
                      {formatFileSize(filePreview.file.size)} • {filePreview.file.type || 'Unknown type'}
                    </div>
                    
                    {uploadProgress[filePreview.file.name] !== undefined && (
                      <div className="mt-2">
                        <Progress value={uploadProgress[filePreview.file.name]} className="h-2" />
                        <div className="text-xs text-muted-foreground mt-1">
                          Uploading... {uploadProgress[filePreview.file.name]}%
                        </div>
                      </div>
                    )}
                  </div>
                  
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removePreview(index)}
                    className="flex-shrink-0"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
          
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowPreview(false)}>
              Cancel
            </Button>
            <Button onClick={confirmUpload} disabled={previews.length === 0}>
              Send {previews.length} {previews.length === 1 ? 'file' : 'files'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}