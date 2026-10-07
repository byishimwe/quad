import { EditorContent } from "@tiptap/react";
import type { Editor } from "@tiptap/core";
import { PiClockBold, PiSpinnerBold } from "react-icons/pi";

import { cn } from "@/lib/utils";
import { StoryCoverSection } from "./StoryCoverSection";
import { StoryEditorBubbleMenu } from "./StoryEditorBubbleMenu";
import { StoryEditorSlashMenu } from "./StoryEditorSlashMenu";
import { StoryEditorToolbar } from "./StoryEditorToolbar";

function getAutosaveLabel(autoSaving: boolean, lastSaved: Date | null) {
  if (autoSaving) return "Autosaving...";
  if (!lastSaved) return null;

  const diffMs = Date.now() - lastSaved.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);
  if (diffMinutes <= 0) return "Autosaved just now";
  if (diffMinutes < 60) return `Autosaved ${diffMinutes}m ago`;

  const hours = Math.floor(diffMinutes / 60);
  return `Autosaved ${hours}h ago`;
}

export function CreateStoryForm({
  title,
  coverImage,
  uploadingCover,
  validationErrors,
  autoSaving,
  lastSaved,
  editor,
  onTitleChange,
  onUploadCover,
  onRemoveCover,
  onInsertLink,
  onMention,
}: {
  title: string;
  coverImage: string | undefined;
  uploadingCover: boolean;
  validationErrors: { title?: string; content?: string };
  autoSaving: boolean;
  lastSaved: Date | null;
  editor: Editor | null;
  onTitleChange: (value: string) => void;
  onUploadCover: (file: File | null) => void;
  onRemoveCover: () => void;
  onInsertLink: () => void;
  onMention: () => void;
}) {
  const autosaveLabel = getAutosaveLabel(autoSaving, lastSaved);

  return (
    <div className="space-y-6">
      <StoryCoverSection
        coverImage={coverImage}
        uploadingCover={uploadingCover}
        onUploadCover={onUploadCover}
        onRemoveCover={onRemoveCover}
      />

      <div className="relative rounded-[2rem] border border-border/40 bg-card shadow-sm focus-within:border-primary/40 focus-within:ring-2 focus-within:ring-primary/20 transition-all flex flex-col">
        {/* Sticky Toolbar at the top instead of floating at the bottom */}
        <div className="sticky top-0 z-20 border-b border-border/40 bg-card/95 backdrop-blur-sm px-4 py-2 flex items-center justify-between rounded-t-[2rem]">
          <StoryEditorToolbar editor={editor} />
          {autosaveLabel && (
            <div className="text-[10px] font-semibold text-muted-foreground flex items-center gap-1.5 select-none pr-2">
              {autoSaving ? (
                <PiSpinnerBold className="h-3 w-3 animate-spin" />
              ) : (
                <PiClockBold className="h-3 w-3" />
              )}
              <span className="hidden sm:inline">{autosaveLabel}</span>
            </div>
          )}
        </div>

        <div className="p-6 md:p-8 space-y-6 flex-1">
          <div className="space-y-2">
            <input
              value={title}
              onChange={(e) => onTitleChange(e.target.value)}
              placeholder="Give your story a brilliant title..."
              className={cn(
                "seamless-field w-full bg-transparent text-3xl md:text-4xl font-extrabold text-foreground placeholder:text-muted-foreground/40 py-1 transition-colors",
                validationErrors.title && "text-destructive",
              )}
            />
            {validationErrors.title && (
              <p className="text-sm font-semibold text-destructive">
                {validationErrors.title}
              </p>
            )}
          </div>

          <div className="relative min-h-[400px]">
            <StoryEditorBubbleMenu
              editor={editor}
              onInsertLink={onInsertLink}
            />
            <StoryEditorSlashMenu
              editor={editor}
              onInsertLink={onInsertLink}
              onMention={onMention}
            />
            <EditorContent editor={editor} />
          </div>
        </div>
      </div>

      {validationErrors.content && (
        <p className="text-sm text-destructive">{validationErrors.content}</p>
      )}
    </div>
  );
}
