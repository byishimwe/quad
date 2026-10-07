import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  PiSpinnerBold,
  PiArchiveBold,
  PiPaperPlaneRightBold,
} from "react-icons/pi";
import { showSuccessToast, showErrorToast } from "@/lib/error-handling/toasts";

import { LoadingPage } from "@/components/ui/loading";
import { UploadService } from "@/services/uploadService";
import { StoryService } from "@/services/storyService";
import type { Story, StoryStatus, UpdateStoryInput } from "@/types/story";
import { createStorySchema } from "@/schemas/story.schema";
import { logError } from "@/lib/errorHandling";
import { ErrorMessage } from "@/components/ui/error-message";

import { CreateStoryForm } from "./create-story/CreateStoryForm";
import { useStoryEditor } from "./create-story/useStoryEditor";
import { formatErrorMessage } from "@/lib/error-handling/formatters";
import { BackButton } from "@/components/ui/BackButton";
import { Button } from "@/components/ui/button";

export default function EditStoryPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [story, setStory] = useState<Story | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [coverImage, setCoverImage] = useState<string | undefined>(undefined);
  const [initialCoverImage, setInitialCoverImage] = useState<
    string | undefined
  >(undefined);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editorHtml, setEditorHtml] = useState<string>("");
  const [validationErrors, setValidationErrors] = useState<{
    title?: string;
    content?: string;
  }>({});

  const editor = useStoryEditor();

  useEffect(() => {
    if (!id) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setError("Story ID is required");
      setLoading(false);
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        setLoading(true);
        setError(null);

        const res = await StoryService.getById(id);
        if (!cancelled && res.success && res.data) {
          setStory(res.data);
          setTitle(res.data.title);
          setCoverImage(res.data.coverImage);
          setInitialCoverImage(res.data.coverImage);

          if (editor) {
            editor.commands.setContent(res.data.content || "");
          }
        } else if (!cancelled) {
          setError(res.message || "Failed to load story");
        }
      } catch (err) {
        logError(err, {
          component: "EditStoryPage",
          action: "loadStory",
          metadata: { id },
        });
        if (!cancelled) setError(formatErrorMessage(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [id, editor]);

  useEffect(() => {
    if (!editor) return;

    const update = () => {
      if (editor.isDestroyed) return;
      setEditorHtml(editor.getHTML());
    };

    update();
    editor.on("update", update);
    return () => {
      editor.off("update", update);
    };
  }, [editor]);

  const canSubmit = useMemo(() => {
    const textContent = editorHtml.replace(/<[^>]*>/g, "").trim();
    return title.trim().length > 0 && textContent.length > 0;
  }, [title, editorHtml]);

  const handleInsertLink = () => {
    if (!editor) return;
    const url = window.prompt("Enter URL");
    if (!url) return;
    editor.chain().focus().setLink({ href: url }).run();
  };

  const handleUploadCover = async (file: File | null) => {
    if (!file) return;
    try {
      setUploadingCover(true);
      const res = await UploadService.uploadStoryMedia(file);
      setCoverImage(res.url);
      showSuccessToast("Cover image set");
    } catch (err) {
      logError(err, {
        component: "EditStoryPage",
        action: "uploadCoverImage",
        metadata: { id },
      });
      showErrorToast(formatErrorMessage(err));
    } finally {
      setUploadingCover(false);
    }
  };

  const handleSubmit = async (status: StoryStatus) => {
    if (!id || !story || !canSubmit || submitting) return;

    setValidationErrors({});

    const content = editor?.getHTML() || "";
    const validation = createStorySchema.safeParse({
      title: title.trim(),
      content,
      coverImage,
      status,
    });

    if (!validation.success) {
      const errors: { title?: string; content?: string } = {};
      validation.error.issues.forEach((err) => {
        if (err.path[0] === "title") {
          errors.title = err.message;
        } else if (err.path[0] === "content") {
          errors.content = err.message;
        }
      });
      setValidationErrors(errors);
      showErrorToast("Fix validation errors");
      return;
    }

    try {
      setSubmitting(true);

      const payload: UpdateStoryInput = {
        title: title.trim(),
        content,
        status,
      };

      if (coverImage) {
        payload.coverImage = coverImage;
      } else if (initialCoverImage) {
        payload.coverImage = null;
      }

      const res = await StoryService.update(id, payload);
      if (!res.success) {
        showErrorToast(res.message || "Failed to update story");
        return;
      }

      showSuccessToast(
        status === "published" ? "Story updated" : "Draft updated",
      );
      navigate(`/stories/${id}`, {
        state: { story: res.data, refreshKey: Date.now() },
      });
    } catch (err) {
      logError(err, {
        component: "EditStoryPage",
        action: "updateStory",
        metadata: { id },
      });
      showErrorToast(formatErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <LoadingPage />;
  }

  if (error || !story) {
    return (
      <ErrorMessage
        title="Unable to edit story"
        description={
          error ||
          "The story you are trying to edit does not exist or cannot be loaded."
        }
        onGoHome={() => navigate("/stories")}
        goHomeLabel="Back to Stories"
        showRetry={false}
        variant="not-found"
      />
    );
  }

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="mx-auto max-w-2xl">
        <div className="mb-6 flex items-center justify-between">
          <BackButton label="Edit Story" />

          <div className="flex items-center gap-3">
            <Button
              variant="secondary"
              disabled={submitting}
              onClick={() => void handleSubmit("draft")}
              className="h-9 rounded-full border border-border/40 bg-muted hover:bg-accent text-foreground font-semibold px-4">
              {submitting ? (
                <PiSpinnerBold className="h-4 w-4 animate-spin sm:mr-2" />
              ) : (
                <PiArchiveBold className="h-4 w-4 sm:mr-2" />
              )}
              <span className="hidden sm:inline">Save as Draft</span>
            </Button>
            <Button
              disabled={!canSubmit || submitting}
              onClick={() => void handleSubmit("published")}
              className="h-9 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold px-5">
              {submitting ? (
                <PiSpinnerBold className="h-4 w-4 animate-spin sm:mr-2" />
              ) : (
                <PiPaperPlaneRightBold className="h-4 w-4 sm:mr-2 fill-current" />
              )}
              <span className="hidden sm:inline">Publish</span>
            </Button>
          </div>
        </div>

        <CreateStoryForm
          title={title}
          coverImage={coverImage}
          uploadingCover={uploadingCover}
          validationErrors={validationErrors}
          autoSaving={false}
          lastSaved={null}
          editor={editor}
          onTitleChange={(value) => {
            setTitle(value);
            if (validationErrors.title) {
              setValidationErrors((prev) => ({
                ...prev,
                title: undefined,
              }));
            }
          }}
          onUploadCover={(file) => void handleUploadCover(file)}
          onRemoveCover={() => setCoverImage(undefined)}
          onInsertLink={handleInsertLink}
          onMention={() => {
            const username = window.prompt(
              "Enter username to mention (without @)",
            );
            if (username) {
              editor?.chain().focus().insertContent(`@${username} `).run();
            }
          }}
        />
      </div>
    </div>
  );
}
