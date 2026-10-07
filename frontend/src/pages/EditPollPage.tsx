import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { PiSpinnerBold } from "react-icons/pi";
import { BackButton } from "@/components/ui/BackButton";
import { showSuccessToast, showErrorToast } from "@/lib/error-handling/toasts";

import { Button } from "@/components/ui/button";
import { LoadingPage } from "@/components/ui/loading";
import { PollService } from "@/services/pollService";
import { UploadService } from "@/services/uploadService";
import type { Poll, PollMedia } from "@/types/poll";
import { logError } from "@/lib/errorHandling";
import { invalidateCache } from "@/lib/api";
import { ErrorMessage } from "@/components/ui/error-message";

import type {
  LocalOption,
  PollDuration,
  PollSettingsState,
  ValidationErrors,
} from "./create-poll/types";
import { CreatePollForm } from "./create-poll/CreatePollForm";
import { formatErrorMessage } from "@/lib/error-handling/formatters";
import { mapFileToMedia } from "./create-poll/pollUtils";

export default function EditPollPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [poll, setPoll] = useState<Poll | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [question, setQuestion] = useState("");
  const [questionMedia, setQuestionMedia] = useState<PollMedia | undefined>();
  const [options, setOptions] = useState<LocalOption[]>([]);
  const [settings, setSettings] = useState<PollSettingsState>({
    anonymousVoting: false,
  });
  const [duration, setDuration] = useState<PollDuration>("none");
  const [initialState, setInitialState] = useState<{
    question: string;
    questionMedia?: PollMedia;
    optionTexts: string[];
    anonymousVoting: boolean;
    duration: PollDuration;
  } | null>(null);
  const [uploadingQuestionMedia, setUploadingQuestionMedia] = useState(false);
  const [validationErrors, setValidationErrors] = useState<ValidationErrors>(
    {},
  );

  const [isSubmitting, setIsSubmitting] = useState(false);

  const inferDurationFromExpiresAt = (
    expiresAt?: string | null,
  ): PollDuration => {
    if (!expiresAt) return "none";
    const d = new Date(expiresAt);
    const ms = d.getTime();
    if (Number.isNaN(ms)) return "none";

    const remainingMs = ms - Date.now();
    if (remainingMs <= 0) return "none";

    const candidates: Array<{ key: PollDuration; ms: number }> = [
      { key: "1d", ms: 24 * 60 * 60 * 1000 },
      { key: "1w", ms: 7 * 24 * 60 * 60 * 1000 },
      { key: "1m", ms: 30 * 24 * 60 * 60 * 1000 },
    ];

    let best: PollDuration = "1d";
    let bestDiff = Infinity;

    for (const c of candidates) {
      const diff = Math.abs(remainingMs - c.ms);
      if (diff < bestDiff) {
        bestDiff = diff;
        best = c.key;
      }
    }

    return best;
  };

  useEffect(() => {
    if (!id) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setError("Poll ID is required");
      setLoading(false);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        setError(null);

        const res = await PollService.getById(id);
        if (!res.success || !res.data) {
          throw new Error(res.message || "Failed to load poll");
        }

        if (cancelled) return;

        if ((res.data.totalVotes ?? 0) > 0) {
          showErrorToast("Cannot edit poll with votes");
          setPoll(null);
          setError("You can't edit a poll after votes have been cast");
          return;
        }

        const now = new Date();
        const expiresAtDate = res.data.expiresAt
          ? new Date(res.data.expiresAt)
          : null;
        const hasValidExpiresAt = Boolean(
          expiresAtDate && !Number.isNaN(expiresAtDate.getTime()),
        );
        const isExpiredByTime = Boolean(
          hasValidExpiresAt &&
          expiresAtDate &&
          expiresAtDate.getTime() <= now.getTime(),
        );
        const isExpired = res.data.status === "expired" || isExpiredByTime;
        if (isExpired) {
          showErrorToast("Cannot edit expired poll");
          setPoll(null);
          setError("You can't edit an expired poll");
          return;
        }

        setPoll(res.data);
        setQuestion(res.data.question ?? "");
        setQuestionMedia(res.data.questionMedia);
        const loadedOptions = (res.data.options || []).map((opt) => ({
          id: crypto.randomUUID(),
          text: opt.text,
        }));
        setOptions(loadedOptions);
        setSettings({
          anonymousVoting: Boolean(res.data.settings?.anonymousVoting),
        });
        const loadedDuration = inferDurationFromExpiresAt(res.data.expiresAt);
        setDuration(loadedDuration);

        setInitialState({
          question: res.data.question ?? "",
          questionMedia: res.data.questionMedia,
          optionTexts: loadedOptions.map((o) => o.text.trim()),
          anonymousVoting: Boolean(res.data.settings?.anonymousVoting),
          duration: loadedDuration,
        });
      } catch (err: unknown) {
        logError(err, {
          component: "EditPollPage",
          action: "fetchPoll",
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
  }, [id]);

  const isDirty = useMemo(() => {
    if (!initialState) return false;

    const currentOptionTexts = options.map((o) => o.text.trim());
    const optionsChanged =
      currentOptionTexts.length !== initialState.optionTexts.length ||
      currentOptionTexts.some((t, i) => t !== initialState.optionTexts[i]);

    const currentMediaKey = questionMedia
      ? JSON.stringify({
          url: questionMedia.url,
          type: questionMedia.type,
          aspectRatio: questionMedia.aspectRatio,
        })
      : "";
    const initialMediaKey = initialState.questionMedia
      ? JSON.stringify({
          url: initialState.questionMedia.url,
          type: initialState.questionMedia.type,
          aspectRatio: initialState.questionMedia.aspectRatio,
        })
      : "";
    const questionMediaChanged = currentMediaKey !== initialMediaKey;

    const questionChanged = question.trim() !== initialState.question.trim();
    const settingsChanged =
      settings.anonymousVoting !== initialState.anonymousVoting;
    const durationChanged = duration !== initialState.duration;

    return (
      questionChanged ||
      questionMediaChanged ||
      optionsChanged ||
      settingsChanged ||
      durationChanged
    );
  }, [duration, initialState, options, question, questionMedia, settings]);

  const canSubmit = useMemo(() => {
    const q = question.trim();
    const filledOptions = options
      .map((o) => o.text.trim())
      .filter((t) => t.length > 0);
    return (
      q.length >= 10 &&
      q.length <= 500 &&
      filledOptions.length >= 2 &&
      filledOptions.length <= 5 &&
      isDirty &&
      !isSubmitting
    );
  }, [question, options, isSubmitting, isDirty]);

  const now = new Date();
  const expiresAtDate = poll?.expiresAt ? new Date(poll.expiresAt) : null;
  const isExpiredByTime = Boolean(
    expiresAtDate &&
    !Number.isNaN(expiresAtDate.getTime()) &&
    expiresAtDate.getTime() <= now.getTime(),
  );
  const isExpired = poll?.status === "expired" || isExpiredByTime;
  const canEditRestricted = !isExpired;
  const canEditOptions = canEditRestricted && (poll?.totalVotes ?? 0) === 0;

  const handleAddOption = () => {
    if (!canEditOptions) return;
    if (options.length < 5) {
      setOptions((prev) => [...prev, { id: crypto.randomUUID(), text: "" }]);
    }
  };

  const handleRemoveOption = (optId: string) => {
    if (!canEditOptions) return;
    if (options.length > 2) {
      setOptions((prev) => prev.filter((opt) => opt.id !== optId));
    }
  };

  const handleOptionChange = (optId: string, text: string) => {
    if (!canEditOptions) return;
    setOptions((prev) =>
      prev.map((opt) => (opt.id === optId ? { ...opt, text } : opt)),
    );
    if (validationErrors.options) {
      setValidationErrors((prev) => ({ ...prev, options: undefined }));
    }
  };

  const handleUploadQuestionMedia = async (file: File | null) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      showErrorToast("Images only");
      return;
    }

    try {
      setUploadingQuestionMedia(true);
      const res = await UploadService.uploadPollMedia(file);
      setQuestionMedia(mapFileToMedia(file, res.url));
      showSuccessToast("Media updated");
    } catch (err: unknown) {
      logError(err, {
        component: "EditPollPage",
        action: "uploadQuestionMedia",
      });
      showErrorToast(formatErrorMessage(err));
    } finally {
      setUploadingQuestionMedia(false);
    }
  };

  const handleSubmit = async () => {
    if (!id) return;
    if (isSubmitting) return;

    setValidationErrors({});

    const trimmed = question.trim();
    if (trimmed.length < 10) {
      setValidationErrors({
        question: "Question must be at least 10 characters",
      });
      showErrorToast("Fix validation errors");
      return;
    }

    const finalOptions = options
      .map((o) => ({ ...o, text: o.text.trim() }))
      .filter((o) => o.text.length > 0)
      .slice(0, 5);

    if (finalOptions.length < 2) {
      setValidationErrors((prev) => ({
        ...prev,
        options: "Poll must have at least 2 options",
      }));
      showErrorToast("Fix validation errors");
      return;
    }

    try {
      setIsSubmitting(true);

      const questionChanged =
        !initialState || question.trim() !== initialState.question.trim();
      const settingsChanged =
        !initialState ||
        settings.anonymousVoting !== initialState.anonymousVoting;
      const durationChanged =
        !initialState || duration !== initialState.duration;
      const optionsChanged =
        !initialState ||
        options
          .map((o) => o.text.trim())
          .some((t, i) => t !== (initialState.optionTexts[i] ?? "")) ||
        options.length !== initialState.optionTexts.length;

      const questionMediaKey = questionMedia
        ? JSON.stringify({
            url: questionMedia.url,
            type: questionMedia.type,
            aspectRatio: questionMedia.aspectRatio,
          })
        : "";
      const initialMediaKey = initialState?.questionMedia
        ? JSON.stringify({
            url: initialState.questionMedia.url,
            type: initialState.questionMedia.type,
            aspectRatio: initialState.questionMedia.aspectRatio,
          })
        : "";
      const questionMediaChanged = questionMediaKey !== initialMediaKey;

      const expiresAt = !durationChanged
        ? undefined
        : duration === "none"
          ? null
          : new Date(
              Date.now() +
                (duration === "1d"
                  ? 24 * 60 * 60 * 1000
                  : duration === "1w"
                    ? 7 * 24 * 60 * 60 * 1000
                    : 30 * 24 * 60 * 60 * 1000),
            ).toISOString();

      const payload = {
        ...(questionChanged ? { question: trimmed } : {}),
        ...(questionMediaChanged
          ? { questionMedia: questionMedia ?? null }
          : {}),
        ...(canEditRestricted
          ? {
              ...(settingsChanged
                ? {
                    settings: {
                      anonymousVoting: settings.anonymousVoting,
                    },
                  }
                : {}),
              ...(expiresAt !== undefined ? { expiresAt } : {}),
              ...(canEditOptions && optionsChanged
                ? { options: finalOptions.map((o) => ({ text: o.text })) }
                : {}),
            }
          : {}),
      };

      const res = await PollService.update(id, payload);

      if (!res.success) {
        throw new Error(res.message || "Failed to update poll");
      }

      invalidateCache(/\/polls/);

      showSuccessToast("Poll updated");
      navigate("/polls", {
        state: res.data ? { updatedPoll: res.data } : undefined,
      });
    } catch (err: unknown) {
      logError(err, {
        component: "EditPollPage",
        action: "updatePoll",
        metadata: { id },
      });
      showErrorToast(formatErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return <LoadingPage />;
  }

  if (error || !poll) {
    return (
      <ErrorMessage
        title="Unable to edit poll"
        description={
          error ||
          "The poll you are trying to edit does not exist or cannot be loaded."
        }
        onGoHome={() => navigate("/polls")}
        goHomeLabel="Back to Polls"
        showRetry={false}
        variant="not-found"
      />
    );
  }

  return (
    <div className="mx-auto w-full px-3 py-4 sm:px-4 sm:py-6">
      <div className="space-y-3 sm:space-y-4">
        <div className="flex items-center justify-between">
          <BackButton label="Edit Poll" fallbackPath="/polls" />

          <Button
            type="button"
            disabled={!canSubmit || isSubmitting}
            onClick={() => void handleSubmit()}
            className="h-8 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold px-4">
            {isSubmitting ? (
              <span className="inline-flex items-center gap-2">
                <PiSpinnerBold className="h-4 w-4 animate-spin" />
                Saving
              </span>
            ) : (
              "Save"
            )}
          </Button>
        </div>

        <CreatePollForm
          question={question}
          setQuestion={setQuestion}
          questionMedia={questionMedia}
          setQuestionMedia={setQuestionMedia}
          uploadingQuestionMedia={uploadingQuestionMedia}
          onUploadQuestionMedia={handleUploadQuestionMedia}
          options={options}
          onAddOption={handleAddOption}
          onRemoveOption={handleRemoveOption}
          onOptionChange={handleOptionChange}
          settings={settings}
          setSettings={setSettings}
          duration={duration}
          setDuration={setDuration}
          optionsDisabled={!canEditOptions}
          restrictedDisabled={!canEditRestricted}
          canSubmit={canSubmit}
          submitting={isSubmitting}
          onSubmit={() => void handleSubmit()}
          submitLabel="Save"
          submitSubmittingLabel="Saving..."
          validationErrors={validationErrors}
          setValidationErrors={setValidationErrors}
        />
      </div>
    </div>
  );
}
