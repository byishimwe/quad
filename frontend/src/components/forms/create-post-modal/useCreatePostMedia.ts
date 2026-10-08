import { useCallback, useEffect, useRef, useState } from "react";
import type { DragEvent } from "react";
import { showSuccessToast, showErrorToast } from "@/lib/error-handling/toasts";
import { formatErrorMessage } from "@/lib/error-handling/formatters";
import { UploadService } from "@/services/uploadService";
import type { MediaData } from "@/schemas/post.schema";
import { logError } from "@/lib/errorHandling";
import type { UploadingFile } from "./types";

type MediaEntry = {
  id: string;
  fingerprint: string;
  file: File;
  preview: string;
  controller: AbortController;
  status: "pending" | "failed" | "uploaded";
  media?: MediaData;
  error?: string;
};

const MAX_FILES = 10;

function fingerprint(file: File): string {
  return [file.name, file.size, file.lastModified, file.type].join("\u0000");
}

// A corrupt or unreadable local image preview must never keep a finished
// network upload in the "uploading" state indefinitely.
function detectImageAspectRatio(preview: string): Promise<"1:1" | "16:9" | "9:16"> {
  return new Promise((resolve) => {
    const image = new Image();
    let finished = false;
    const finish = (ratio: "1:1" | "16:9" | "9:16" = "1:1") => {
      if (finished) return;
      finished = true;
      window.clearTimeout(timeout);
      image.onload = null;
      image.onerror = null;
      resolve(ratio);
    };
    const timeout = window.setTimeout(() => finish(), 5000);
    image.onload = () => {
      const width = image.naturalWidth || image.width;
      const height = image.naturalHeight || image.height;
      if (height <= 0) return finish();
      const ratio = width / height;
      if (Math.abs(ratio - 1) < 0.1) finish("1:1");
      else if (Math.abs(ratio - 16 / 9) < 0.2) finish("16:9");
      else if (Math.abs(ratio - 9 / 16) < 0.2) finish("9:16");
      else finish("1:1");
    };
    image.onerror = () => finish();
    image.src = preview;
  });
}

export function useCreatePostMedia() {
  const [uploadedMedia, setUploadedMedia] = useState<MediaData[]>([]);
  const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  // The ref is updated synchronously, so overlapping picker/drop events cannot
  // enqueue the same file or use stale array indices after an upload settles.
  const entriesRef = useRef<MediaEntry[]>([]);
  const nextIdRef = useRef(0);

  const publish = useCallback(() => {
    setUploadedMedia(
      entriesRef.current
        .filter((entry) => entry.status === "uploaded")
        .map((entry) => entry.media!),
    );
    setUploadingFiles(
      entriesRef.current
        .filter((entry) => entry.status !== "uploaded")
        .map(({ id, file, preview, error }) => ({
          id,
          file,
          preview,
          ...(error ? { error } : {}),
        })),
    );
  }, []);

  const clearEntries = useCallback(() => {
    for (const entry of entriesRef.current) {
      entry.controller.abort();
      URL.revokeObjectURL(entry.preview);
    }
    entriesRef.current = [];
  }, []);

  // Stable callback: the modal must NOT reset itself whenever upload state
  // changes (its close-effect cleanup previously depended on this callback).
  const resetMediaState = useCallback(() => {
    clearEntries();
    publish();
    setIsDragging(false);
  }, [clearEntries, publish]);

  // An unmounted composer must not append an upload result from a late response.
  useEffect(() => () => {
    clearEntries();
  }, [clearEntries]);

  const uploadEntry = useCallback(async (entry: MediaEntry) => {
    try {
      const result = await UploadService.uploadPostMedia(
        entry.file,
        undefined,
        entry.controller.signal,
      );
      const aspectRatio = entry.file.type.startsWith("image/")
        ? await detectImageAspectRatio(entry.preview)
        : undefined;

      // Removed/cancelled items cannot reappear when an old request resolves.
      if (!entriesRef.current.includes(entry) || entry.controller.signal.aborted) {
        // A request may have succeeded just before cancellation.
        void UploadService.deleteFile(result.url).catch(() => undefined);
        return;
      }

      entry.media = {
        url: result.url,
        type: entry.file.type.startsWith("video/") ? "video" : "image",
        ...(aspectRatio ? { aspectRatio } : {}),
      };
      entry.status = "uploaded";
      URL.revokeObjectURL(entry.preview);
      publish();
      showSuccessToast("Media uploaded successfully");
    } catch (error) {
      if (!entriesRef.current.includes(entry) || entry.controller.signal.aborted) return;
      entry.status = "failed";
      entry.error = formatErrorMessage(error);
      publish();
      logError(error, {
        component: "useCreatePostMedia",
        action: "uploadPostMedia",
        metadata: { fileType: entry.file.type, fileName: entry.file.name },
      });
      showErrorToast(error, "Failed to upload media");
    }
  }, [publish]);

  const handleFileSelect = useCallback((files: FileList | null) => {
    if (!files?.length) return;
    const selected = Array.from(files);

    const known = new Set(entriesRef.current.map((entry) => entry.fingerprint));
    const newFiles: File[] = [];
    for (const file of selected) {
      const key = fingerprint(file);
      if (known.has(key)) continue;
      const validation = UploadService.validateFile(file, "any");
      if (!validation.valid) {
        showErrorToast(validation.error || "Invalid file");
        continue;
      }
      known.add(key);
      newFiles.push(file);
    }

    if (entriesRef.current.length + newFiles.length > MAX_FILES) {
      showErrorToast("You can only upload up to 10 files");
      return;
    }

    if (newFiles.length === 0) return;
    const entries: MediaEntry[] = newFiles.map((file) => ({
      id: `upload-${++nextIdRef.current}`,
      fingerprint: fingerprint(file),
      file,
      preview: URL.createObjectURL(file),
      controller: new AbortController(),
      status: "pending",
    }));
    entriesRef.current = [...entriesRef.current, ...entries];
    publish();

    // Each upload settles by its stable ID/object, never a shifting array index.
    // A failed item remains removable, but cannot masquerade as "uploading".
    for (const entry of entries) void uploadEntry(entry);
  }, [publish, uploadEntry]);

  const removeMedia = useCallback((index: number) => {
    const entry = entriesRef.current.filter((item) => item.status === "uploaded")[index];
    if (!entry) return;
    entriesRef.current = entriesRef.current.filter((item) => item.id !== entry.id);
    publish();
  }, [publish]);

  const removeUploadingFile = useCallback((index: number) => {
    const entry = entriesRef.current.filter((item) => item.status !== "uploaded")[index];
    if (!entry) return;
    entry.controller.abort();
    URL.revokeObjectURL(entry.preview);
    entriesRef.current = entriesRef.current.filter((item) => item.id !== entry.id);
    publish();
  }, [publish]);

  const handleDrop = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);
    handleFileSelect(event.dataTransfer?.files || null);
  }, [handleFileSelect]);

  const handleDragOver = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => setIsDragging(false), []);

  return {
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
  };
}
