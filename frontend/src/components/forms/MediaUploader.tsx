import { useState, useCallback, useRef, useEffect } from "react";
import { formatErrorMessage } from "@/lib/error-handling/formatters";
import { PiXBold, PiUploadSimpleBold, PiVideoCameraBold } from "react-icons/pi";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { UploadService } from "@/services/uploadService";
import type { MediaData } from "@/schemas/post.schema";
import { showSuccessToast, showErrorToast } from "@/lib/error-handling/toasts";
import { cn } from "@/lib/utils";
import { logError } from "@/lib/errorHandling";
import PulsingLogoSpinner from "@/components/ui/PulsingLogoSpinner";

interface MediaUploaderProps {
  onMediaChange: (media: MediaData[]) => void;
  maxFiles?: number;
  className?: string;
  initialMedia?: MediaData[];
}

interface UploadingFile {
  file: File;
  preview: string;
  error?: string;
}

export function MediaUploader({
  onMediaChange,
  maxFiles = 10,
  className,
  initialMedia,
}: MediaUploaderProps) {
  const [uploadedMedia, setUploadedMedia] = useState<MediaData[]>(
    initialMedia ?? [],
  );
  const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Notify parent of media changes via useEffect to avoid setState-in-render
  useEffect(() => {
    onMediaChange(uploadedMedia);
  }, [uploadedMedia, onMediaChange]);

  // Detect aspect ratio from image dimensions
  const detectAspectRatio = (
    width: number,
    height: number,
  ): "1:1" | "16:9" | "9:16" => {
    const ratio = width / height;
    if (Math.abs(ratio - 1) < 0.1) return "1:1";
    if (Math.abs(ratio - 16 / 9) < 0.2) return "16:9";
    if (Math.abs(ratio - 9 / 16) < 0.2) return "9:16";
    return "1:1"; // Default
  };

  const handleFileSelect = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return;

      const fileArray = Array.from(files);
      const totalFiles =
        uploadedMedia.length + uploadingFiles.length + fileArray.length;

      if (totalFiles > maxFiles) {
        showErrorToast(`Max ${maxFiles} files allowed`);
        return;
      }

      // Validate files
      const validFiles: File[] = [];
      for (const file of fileArray) {
        const validation = UploadService.validateFile(file, "any");
        if (!validation.valid) {
          showErrorToast(validation.error || "Invalid file");
        } else {
          validFiles.push(file);
        }
      }

      if (validFiles.length === 0) return;

      // Create preview URLs and add to uploading state
      const newUploadingFiles: UploadingFile[] = validFiles.map((file) => ({
        file,
        preview: URL.createObjectURL(file),
      }));

      setUploadingFiles((prev) => [...prev, ...newUploadingFiles]);

      // Upload files
      for (let i = 0; i < validFiles.length; i++) {
        const file = validFiles[i];
        const uploadingIndex = uploadingFiles.length + i;

        try {
          const uploadResult = await UploadService.uploadPostMedia(file);

          // Detect aspect ratio for images
          let aspectRatio: "1:1" | "16:9" | "9:16" | undefined;
          if (file.type.startsWith("image/")) {
            const img = new Image();
            img.src = newUploadingFiles[i].preview;
            await new Promise((resolve) => {
              img.onload = () => {
                aspectRatio = detectAspectRatio(img.width, img.height);
                resolve(null);
              };
            });
          }

          const newMedia: MediaData = {
            url: uploadResult.url,
            type: file.type.startsWith("video/") ? "video" : "image",
            aspectRatio,
          };

          // Update uploaded media - parent will be notified via useEffect
          setUploadedMedia((prev) => [...prev, newMedia]);

          // Remove from uploading
          setUploadingFiles((prev) =>
            prev.filter((_, idx) => idx !== uploadingIndex),
          );

          showSuccessToast("Media uploaded");
        } catch (error) {
          logError(error, {
            component: "MediaUploader",
            action: "uploadPostMedia",
            metadata: { fileType: file.type, fileName: file.name },
          });
          setUploadingFiles((prev) =>
            prev.map((uf, idx) =>
              idx === uploadingIndex
                ? { ...uf, error: formatErrorMessage(error) }
                : uf,
            ),
          );
          showErrorToast(error, "Failed to upload media");
        }
      }
    },
    [uploadedMedia.length, uploadingFiles.length, maxFiles],
  );

  const removeMedia = (index: number) => {
    // Update state - parent will be notified via useEffect
    setUploadedMedia((prev) => prev.filter((_, i) => i !== index));
  };

  const removeUploadingFile = (index: number) => {
    setUploadingFiles((prev) => {
      const file = prev[index];
      if (file?.preview) {
        URL.revokeObjectURL(file.preview);
      }
      return prev.filter((_, i) => i !== index);
    });
  };

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      handleFileSelect(e.dataTransfer.files);
    },
    [handleFileSelect],
  );

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  return (
    <div className={cn("space-y-4", className)}>
      {/* Upload Area */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={cn(
          "border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer",
          isDragging
            ? "border-primary bg-primary/5"
            : "border-border hover:border-primary/50",
        )}
        onClick={() => fileInputRef.current?.click()}>
        <PiUploadSimpleBold className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
        <p className="text-sm font-medium mb-1">
          Click to upload or drag and drop
        </p>
        <p className="text-xs text-muted-foreground">
          Images (max 10MB) or Videos (max 50MB)
        </p>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*,video/*"
          className="hidden"
          onChange={(e) => handleFileSelect(e.target.files)}
        />
      </div>

      {/* Media Grid */}
      {(uploadedMedia.length > 0 || uploadingFiles.length > 0) && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {/* Uploaded Media */}
          {uploadedMedia.map((media, index) => (
            <Card
              key={`uploaded-${index}`}
              className="relative aspect-square overflow-hidden group">
              {media.type === "image" ? (
                <img
                  src={media.url}
                  alt={`Upload ${index + 1}`}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-muted flex items-center justify-center">
                  <PiVideoCameraBold className="h-8 w-8 text-muted-foreground" />
                </div>
              )}
              <Button
                type="button"
                variant="destructive"
                size="sm"
                className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity h-6 w-6 p-0"
                onClick={() => removeMedia(index)}>
                <PiXBold className="h-4 w-4" />
              </Button>
              {media.aspectRatio && (
                <div className="absolute bottom-2 left-2 bg-black/60 text-white text-xs px-2 py-1 rounded">
                  {media.aspectRatio}
                </div>
              )}
            </Card>
          ))}

          {/* Uploading Files */}
          {uploadingFiles.map((file, index) => (
            <Card
              key={`uploading-${index}`}
              className="relative aspect-square overflow-hidden">
              {file.file.type.startsWith("image/") ? (
                <img
                  src={file.preview}
                  alt="Uploading..."
                  className="w-full h-full object-cover opacity-50"
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-lg">
                  <PulsingLogoSpinner />
                </div>
              )}
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                {file.error ? (
                  <div className="text-center">
                    <p className="text-white text-xs mb-2">{file.error}</p>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => removeUploadingFile(index)}>
                      Remove
                    </Button>
                  </div>
                ) : (
                  <PulsingLogoSpinner />
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
