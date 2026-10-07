import { useRef, useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { PiSpinnerBold, PiPaperPlaneRightBold } from "react-icons/pi";
import { motion, AnimatePresence } from "framer-motion";
import { MAX_MESSAGE_LENGTH } from "./constants";
import { Button } from "@/components/ui/button";

export function ChatComposer({
  text,
  sending,
  onTextChange,
  onSend,
}: {
  text: string;
  sending: boolean;
  onTextChange: (v: string) => void;
  onSend: () => void;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [isFocused, setIsFocused] = useState(false);

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
  }, [text]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  };

  const canSend = text.trim().length > 0 && !sending;

  return (
    <div className="py-4 px-6 bg-card/80 backdrop-blur-xl border-t border-border/40 shadow-[0_-8px_30px_rgba(0,0,0,0.04)] z-10 sticky bottom-0">
      <div className="flex items-end gap-3 max-w-4xl mx-auto w-full">
        {/* Input container with glassmorphic treatment */}
        <div
          className={cn(
            "flex-1 min-w-0 flex items-end gap-2 rounded-2xl px-4 py-2.5 transition-all duration-300",
            "bg-background/60 backdrop-blur-sm border",
            isFocused
              ? "border-primary/30 shadow-[0_0_0_3px_rgba(var(--primary-rgb),0.06),0_0_20px_-5px_rgba(var(--primary-rgb),0.1)]"
              : "border-border/50 hover:border-border/80",
          )}>
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => onTextChange(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            maxLength={MAX_MESSAGE_LENGTH}
            placeholder="Type a message..."
            rows={1}
            className="seamless-field flex-1 bg-transparent text-foreground placeholder:text-muted-foreground/40 text-[15px] min-h-[24px] resize-none py-1 scrollbar-hide"
            aria-label="Message input"
          />

          {/* Character count - only when near limit */}
          <AnimatePresence>
            {text.length > MAX_MESSAGE_LENGTH * 0.8 && (
              <motion.span
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className={cn(
                  "text-[10px] font-bold tabular-nums shrink-0 self-center",
                  text.length > MAX_MESSAGE_LENGTH * 0.95
                    ? "text-destructive"
                    : "text-muted-foreground/40",
                )}>
                {text.length}/{MAX_MESSAGE_LENGTH}
              </motion.span>
            )}
          </AnimatePresence>
        </div>

        {/* Send button with smooth transitions */}
        <motion.div
          animate={{
            scale: canSend ? 1 : 0.9,
            opacity: canSend ? 1 : 0.4,
          }}
          transition={{ type: "spring", stiffness: 400, damping: 25 }}>
          <Button
            type="button"
            size="icon"
            onClick={onSend}
            disabled={!canSend}
            className={cn(
              "h-11 w-11 rounded-full shrink-0 transition-all duration-200",
              canSend
                ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 hover:scale-105 active:scale-95"
                : "bg-muted text-muted-foreground cursor-not-allowed shadow-none",
            )}>
            {sending ? (
              <PiSpinnerBold className="h-5 w-5 animate-spin" />
            ) : (
              <PiPaperPlaneRightBold className="h-5 w-5 ml-0.5" />
            )}
          </Button>
        </motion.div>
      </div>
    </div>
  );
}
