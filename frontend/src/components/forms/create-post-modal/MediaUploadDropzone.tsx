import type { DragEventHandler } from "react";

import { PiUploadSimpleBold } from "react-icons/pi";

import { cn } from "@/lib/utils";

export function MediaUploadDropzone({
  isDragging,
  onDrop,
  onDragOver,
  onDragLeave,
  onSelectFiles,
}: {
  isDragging: boolean;
  onDrop: DragEventHandler<HTMLDivElement>;
  onDragOver: DragEventHandler<HTMLDivElement>;
  onDragLeave: DragEventHandler<HTMLDivElement>;
  onSelectFiles: (files: FileList | null) => void;
}) {
  return (
    <div
      onDrop={onDrop}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      className={cn(
        "rounded-2xl border border-dashed p-6 text-center transition-colors cursor-pointer",
        "border-border bg-muted/30 hover:bg-muted/50",
        isDragging && "border-primary bg-primary/5",
      )}
      onClick={() => {
        const input = document.createElement("input");
        input.type = "file";
        input.multiple = true;
        input.accept = "image/*,video/*";
        input.onchange = (e) =>
          onSelectFiles((e.target as HTMLInputElement).files);
        input.click();
      }}>
      <div className="mx-auto h-12 w-12 rounded-2xl bg-muted flex items-center justify-center">
        <PiUploadSimpleBold className="h-5 w-5 text-primary" />
      </div>
      <p className="mt-3 text-sm font-semibold text-foreground">
        Click to upload or drag and drop
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        Images (max 10MB) or Videos (max 50MB)
      </p>
    </div>
  );
}
