import { useState, useRef, useEffect } from "react";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { AutoExpandingTextarea } from "@/components/ui/auto-expanding-textarea";
import { CommentService } from "@/services/commentService";
import { useAuthStore } from "@/stores/authStore";
import type { Comment } from "@/types/comment";
import { showSuccessToast, showErrorToast } from "@/lib/errorHandling";
import { PiPaperPlaneRightBold } from "react-icons/pi"; // Assumes react-icons is installed
import { cn } from "@/lib/utils";

interface CommentComposerProps {
  contentType: "post" | "story" | "poll";
  contentId: string;
  placeholder?: string;
  autoFocus?: boolean;
  onCreated?: (comment: Comment) => void;
}

export function CommentComposer({
  contentType,
  contentId,
  placeholder,
  autoFocus,
  onCreated,
}: CommentComposerProps) {
  const { user } = useAuthStore();
  const [text, setText] = useState("");
  const [pending, setPending] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const MAX_LENGTH = 2000;
  const charCount = text.length;
  const isOverLimit = charCount > MAX_LENGTH;
  const isNearLimit = charCount > MAX_LENGTH * 0.9;

  // Reset height on submit
  useEffect(() => {
    if (!text && textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }, [text]);

  const handleSubmit = async () => {
    const value = text.trim();
    if (!value || isOverLimit) return;
    if (pending) return;

    setPending(true);
    try {
      const res = await CommentService.create({
        contentType,
        contentId,
        text: value,
      });
      if (!res.success)
        throw new Error(res.message || "Failed to post comment");

      setText("");
      setIsFocused(false); // Optional: collapse focus state on send
      onCreated?.(res.data);
      showSuccessToast("Comment posted");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to post comment";
      showErrorToast(msg);
    } finally {
      setPending(false);
    }
  };

  const handleKeyDown = (e: ReactKeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      if (e.nativeEvent.isComposing) return;
      e.preventDefault();
      void handleSubmit();
    }
  };

  return (
    <div className="flex items-start gap-4 p-4">
      <Avatar className="h-10 w-10 shrink-0 border border-border/40">
        <AvatarImage src={user?.profileImage} alt={user?.username} />
        <AvatarFallback className="bg-secondary text-secondary-foreground font-medium">
          {user?.username?.charAt(0).toUpperCase() || "U"}
        </AvatarFallback>
      </Avatar>

      <div className="flex-1">
        <div
          className={cn(
            "relative rounded-2xl border bg-muted/70 transition-all duration-200 focus-within:bg-muted",
            isFocused
              ? "border-primary/50 shadow-[0_0_0_4px_rgba(59,130,246,0.1)]"
              : "border-border/40 hover:border-border/60",
          )}>
          <AutoExpandingTextarea
            ref={textareaRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onFocus={() => setIsFocused(true)}
            onBlur={() => {
              if (!text) setIsFocused(false);
            }}
            placeholder={placeholder || "Write a comment..."}
            className="seamless-field min-h-[48px] w-full resize-none bg-transparent px-4 py-3 text-[14px] leading-relaxed text-foreground placeholder:text-muted-foreground"
            maxLength={MAX_LENGTH}
            autoFocus={autoFocus}
            minHeight={48}
            maxHeight={200}
            onKeyDown={handleKeyDown}
          />

          {(isFocused || text.length > 0) && (
            <div className="flex items-center justify-between border-t border-border/40 px-3 py-2">
              <div>
                {text.length > 0 && (
                  <span
                    className={cn(
                      "text-xs transition-colors",
                      isOverLimit
                        ? "text-red-500 font-bold"
                        : isNearLimit
                          ? "text-yellow-500"
                          : "text-muted-foreground",
                    )}>
                    {charCount} / {MAX_LENGTH}
                  </span>
                )}
              </div>

              <Button
                type="button"
                size="sm"
                onClick={() => void handleSubmit()}
                disabled={pending || !text.trim() || isOverLimit}
                className={cn(
                  "h-8 rounded-full px-4 text-xs font-semibold transition-all shadow-sm",
                  text.trim()
                    ? "bg-primary text-primary-foreground hover:opacity-90"
                    : "bg-muted text-muted-foreground/50",
                )}>
                {pending ? (
                  <span className="flex items-center gap-2">
                    <span className="h-3 w-3 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    Posting
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    Post <PiPaperPlaneRightBold className="h-3 w-3" />
                  </span>
                )}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
