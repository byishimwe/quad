import { useCallback, useEffect, useRef } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormField,
  FormItem,
  FormControl,
  FormMessage,
} from "@/components/ui/form";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuthStore } from "@/stores/authStore";
import { PiImageBold, PiVideoCameraBold, PiSpinnerBold } from "react-icons/pi";
import { cn } from "@/lib/utils";
import { MediaUploadDropzone } from "./create-post-modal/MediaUploadDropzone";
import { MediaPreviewGrid } from "./create-post-modal/MediaPreviewGrid";
import { useCreatePostMedia } from "./create-post-modal/useCreatePostMedia";
import { createPostSchema, type CreatePostData } from "@/schemas/post.schema";

interface CreatePostFormProps {
  onSubmit?: (data: CreatePostData) => void | Promise<void>;
  onCancel?: () => void;
  isLoading?: boolean;
  initialValues?: Partial<CreatePostData>;
}

export function CreatePostForm({
  onSubmit,
  onCancel,
  isLoading = false,
  initialValues,
}: CreatePostFormProps) {
  const { user } = useAuthStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    uploadedMedia,
    uploadingFiles,
    isDragging,
    handleFileSelect,
    removeMedia,
    removeUploadingFile,
    handleDrop,
    handleDragOver,
    handleDragLeave,
    setUploadedMedia,
  } = useCreatePostMedia();

  // Sync initial media once
  useEffect(() => {
    if (initialValues?.media && initialValues.media.length > 0) {
      setUploadedMedia(initialValues.media);
    }
  }, [initialValues?.media, setUploadedMedia]);

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const adjustTextareaHeight = () => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = `${textarea.scrollHeight}px`;
    }
  };

  const form = useForm<CreatePostData>({
    resolver: zodResolver(createPostSchema),
    mode: "onChange",
    defaultValues: {
      text: initialValues?.text ?? "",
      media: initialValues?.media ?? [],
    },
  });

  const handleFormSubmit = async (data: CreatePostData) => {
    const submitData: CreatePostData = {
      ...(typeof data.text === "string" && data.text.trim().length > 0
        ? { text: data.text }
        : {}),
      media: uploadedMedia,
    };
    await onSubmit?.(submitData);
  };

  const handleMediaChangeCb = useCallback(() => {
    form.setValue("media", uploadedMedia, { shouldValidate: true });
  }, [form, uploadedMedia]);

  void handleMediaChangeCb;

  const textValue =
    useWatch({ control: form.control, name: "text", defaultValue: "" }) || "";
  const charCount = textValue.length;
  const isOverLimit = charCount > 1000;
  const hasMedia = uploadedMedia.length > 0;
  const isUploading = uploadingFiles.length > 0;
  const canPost = hasMedia && !isUploading && !isOverLimit && !isLoading;

  const openFilePicker = (accept: string) => {
    if (!fileInputRef.current) return;
    fileInputRef.current.accept = accept;
    fileInputRef.current.click();
  };

  useEffect(() => {
    if (initialValues?.text) {
      setTimeout(adjustTextareaHeight, 0);
    }
  }, [initialValues?.text]);

  return (
    <div className="rounded-[2rem] border border-border/40 bg-card shadow-card transition-all hover:border-border/60">
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*,video/*"
        className="hidden"
        onChange={(e) => {
          void handleFileSelect(e.target.files);
          e.currentTarget.value = "";
        }}
      />

      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleFormSubmit)}>
          {/* Top: avatar + textarea */}
          <div className="flex gap-4 p-4 pb-2">
            <Avatar className="h-11 w-11 shrink-0 border-2 border-border/40 mt-1">
              <AvatarImage src={user?.profileImage} />
              <AvatarFallback className="bg-secondary text-secondary-foreground font-semibold">
                {user?.username?.[0]?.toUpperCase() || "U"}
              </AvatarFallback>
            </Avatar>

            <div className="flex-1 min-w-0">
              <FormField
                control={form.control}
                name="text"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <textarea
                        {...field}
                        id="post-text"
                        ref={(e) => {
                          field.ref(e);
                          textareaRef.current = e;
                        }}
                        onInput={() => {
                          adjustTextareaHeight();
                        }}
                        placeholder="What's happening?"
                        rows={1}
                        disabled={isLoading}
                        className={cn(
                          "seamless-field w-full bg-transparent",
                          "text-foreground placeholder:text-muted-foreground text-lg resize-none min-h-[48px] py-2",
                        )}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Character count */}
              <div className="flex justify-end mt-1">
                <span
                  className={cn(
                    "text-xs font-medium tabular-nums transition-colors",
                    charCount === 0
                      ? "text-muted-foreground/40"
                      : isOverLimit
                        ? "text-destructive font-semibold"
                        : charCount > 800
                          ? "text-amber-500"
                          : "text-muted-foreground",
                  )}>
                  {charCount > 0 && `${charCount}/1000`}
                </span>
              </div>
            </div>
          </div>

          {/* Media preview */}
          {(uploadedMedia.length > 0 || uploadingFiles.length > 0) && (
            <div className="px-4 pb-3">
              <MediaPreviewGrid
                uploadedMedia={uploadedMedia}
                uploadingFiles={uploadingFiles}
                onRemoveMedia={removeMedia}
                onRemoveUploadingFile={removeUploadingFile}
              />
            </div>
          )}

          {/* Dropzone — always visible */}
          <div className="px-4 pb-4">
            <MediaUploadDropzone
              isDragging={isDragging}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onSelectFiles={handleFileSelect}
            />
          </div>

          {/* Toolbar + submit */}
          <div className="flex items-center justify-between px-4 py-3 border-t border-border/40">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => openFilePicker("image/*")}
                disabled={isLoading}
                className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-accent transition-all"
                aria-label="Add image"
                title="Add image">
                <PiImageBold className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={() => openFilePicker("video/*")}
                disabled={isLoading}
                className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-accent transition-all"
                aria-label="Add video"
                title="Add video">
                <PiVideoCameraBold className="h-5 w-5" />
              </button>
            </div>

            <div className="flex items-center gap-2">
              {onCancel && (
                <Button
                  type="button"
                  variant="ghost"
                  className="rounded-full"
                  disabled={isLoading}
                  onClick={onCancel}>
                  Cancel
                </Button>
              )}

              <Button
                type="submit"
                disabled={!canPost}
                className={cn(
                  "rounded-full px-8 font-bold transition-all active:scale-95",
                  canPost
                    ? "bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/20"
                    : "bg-muted text-muted-foreground/40 cursor-not-allowed shadow-none",
                )}>
                {isLoading ? (
                  <span className="inline-flex items-center gap-2">
                    <PiSpinnerBold className="h-4 w-4 animate-spin" />
                    Posting...
                  </span>
                ) : (
                  "Post"
                )}
              </Button>
            </div>
          </div>
        </form>
      </Form>
    </div>
  );
}
