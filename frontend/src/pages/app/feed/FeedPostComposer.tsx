import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/stores/authStore";
import { PiImageBold, PiVideoCameraBold, PiSpinnerBold } from "react-icons/pi";
import { cn } from "@/lib/utils";
import { showErrorToast } from "@/lib/error-handling/toasts";

import { MediaPreviewGrid } from "@/components/forms/create-post-modal/MediaPreviewGrid";
import { MediaUploadDropzone } from "@/components/forms/create-post-modal/MediaUploadDropzone";
import { useCreatePostMedia } from "@/components/forms/create-post-modal/useCreatePostMedia";

import type { CreatePostData } from "@/schemas/post.schema";

export function FeedPostComposer({
  onCreatePost,
  disabled = false,
}: {
  onCreatePost: (payload: {
    text?: string;
    media: CreatePostData["media"];
  }) => Promise<void>;
  disabled?: boolean;
}) {
  const { user } = useAuthStore();
  const [text, setText] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    const focusParam =
      searchParams.get("create") === "post" ||
      searchParams.get("focus") === "post";

    const handleFocus = () => {
      setIsExpanded(true);
      window.scrollTo({ top: 0, behavior: "smooth" });

      // Also scroll container specifically if it's inside a scrollable div
      containerRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });

      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    };

    if (focusParam) {
      handleFocus();
      // Clear the param after focusing to avoid re-focusing on every re-render
      const newParams = new URLSearchParams(searchParams);
      newParams.delete("create");
      newParams.delete("focus");
      setSearchParams(newParams, { replace: true });
    }

    const handleFocusEvent = () => {
      handleFocus();
    };

    window.addEventListener("focus-post-composer", handleFocusEvent);
    return () =>
      window.removeEventListener("focus-post-composer", handleFocusEvent);
  }, [searchParams, setSearchParams]);

  const openFilePicker = (accept: string) => {
    if (disabled) return;
    setIsExpanded(true);

    const input = fileInputRef.current;
    if (!input) return;

    input.accept = accept;
    input.click();
  };

  const {
    uploadedMedia,
    uploadingFiles,
    isDragging,
    resetMediaState,
    handleFileSelect,
    removeMedia,
    removeUploadingFile,
    handleDrop,
    handleDragOver,
    handleDragLeave,
  } = useCreatePostMedia();

  const trimmedText = text.trim();
  const charCount = text.length;
  const isOverLimit = charCount > 1000;
  const hasMedia = uploadedMedia.length > 0;
  const canSubmit =
    !isOverLimit && hasMedia && uploadingFiles.length === 0 && !disabled;

  useEffect(() => {
    if (!disabled && isExpanded) {
      inputRef.current?.focus();
    }
  }, [disabled, isExpanded]);

  const resetComposer = () => {
    setText("");
    resetMediaState();
    setIsExpanded(false);
  };

  const submit = async () => {
    if (disabled || isSubmitting) return;

    if (!hasMedia) {
      showErrorToast("Post must have at least one media item");
      setIsExpanded(true);
      inputRef.current?.focus();
      return;
    }

    if (uploadingFiles.length > 0) {
      showErrorToast("Please wait for uploads to finish");
      return;
    }

    try {
      setIsSubmitting(true);
      await onCreatePost({
        ...(trimmedText.length > 0 ? { text: trimmedText } : {}),
        media: uploadedMedia,
      });
      resetComposer();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      ref={containerRef}
      className={cn(
        "bg-card border border-border/40 rounded-[1.5rem] sm:rounded-[2rem] p-3 sm:p-4 shadow-card transition-all hover:border-border/60 focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/20",
        disabled && "opacity-60",
      )}
      onClick={() => {
        if (!disabled) setIsExpanded(true);
      }}
    >
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

      <div className="flex gap-2 sm:gap-4">
        <Avatar className="h-9 w-9 sm:h-12 sm:w-12 border-2 border-border/40 shrink-0">
          <AvatarImage src={user?.profileImage} />
          <AvatarFallback className="bg-secondary text-secondary-foreground">
            {user?.username?.[0]?.toUpperCase() || "U"}
          </AvatarFallback>
        </Avatar>

        <div className="flex-1 flex flex-col gap-4">
          <textarea
            ref={inputRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="What's on your mind?"
            rows={1}
            disabled={disabled || isSubmitting}
            onFocus={() => {
              if (!disabled) setIsExpanded(true);
            }}
            onInput={(e) => {
              const target = e.target as HTMLTextAreaElement;
              target.style.height = "auto";
              target.style.height = `${target.scrollHeight}px`;
            }}
            className="seamless-field w-full bg-transparent text-foreground placeholder:text-muted-foreground text-lg resize-none min-h-[48px] py-2"
          />

          {/* Character count */}
          {isExpanded && (
            <div className="flex justify-end">
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
                )}
              >
                {charCount > 0 && `${charCount}/1000`}
              </span>
            </div>
          )}

          {isExpanded && (
            <div className="space-y-3">
              <MediaPreviewGrid
                uploadedMedia={uploadedMedia}
                uploadingFiles={uploadingFiles}
                onRemoveMedia={removeMedia}
                onRemoveUploadingFile={removeUploadingFile}
              />

              <MediaUploadDropzone
                isDragging={isDragging}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onSelectFiles={handleFileSelect}
              />
            </div>
          )}

          <div className="flex items-center justify-between pt-2 border-t border-border/40">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  openFilePicker("image/*");
                }}
                className="p-2 text-muted-foreground hover:text-foreground hover:bg-accent rounded-xl transition-all"
                aria-label="Add image"
                title="Add image"
              >
                <PiImageBold className="w-5 h-5" />
              </button>
              <button
                type="button"
                onClick={() => {
                  openFilePicker("video/*");
                }}
                className="p-2 text-muted-foreground hover:text-foreground hover:bg-accent rounded-xl transition-all"
                aria-label="Add video"
                title="Add video"
              >
                <PiVideoCameraBold className="w-5 h-5" />
              </button>
            </div>

            <div className="flex items-center gap-2">
              {isExpanded && (
                <Button
                  type="button"
                  variant="ghost"
                  className="rounded-full"
                  disabled={disabled || isSubmitting}
                  onClick={(e) => {
                    e.stopPropagation();
                    resetComposer();
                  }}
                >
                  Cancel
                </Button>
              )}

              <Button
                type="button"
                className={cn(
                  "rounded-full px-8 font-bold transition-all active:scale-95",
                  canSubmit
                    ? "bg-primary hover:bg-primary/90 text-primary-foreground scale-100 shadow-lg shadow-primary/20"
                    : "bg-muted text-muted-foreground/40 cursor-not-allowed shadow-none",
                )}
                disabled={!canSubmit || isSubmitting}
                onClick={(e) => {
                  e.stopPropagation();
                  void submit();
                }}
              >
                {isSubmitting ? (
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
        </div>
      </div>
    </div>
  );
}
