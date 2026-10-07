import { cn } from "@/lib/utils";
import { PiPlusBold, PiXBold } from "react-icons/pi";
import type { Dispatch, SetStateAction } from "react";

import type { LocalOption, ValidationErrors } from "./types";

export function PollOptionsEditor({
  options,
  onAddOption,
  onRemoveOption,
  onOptionChange,
  validationErrors,
  setValidationErrors,
  disabled,
}: {
  options: LocalOption[];
  onAddOption: () => void;
  onRemoveOption: (id: string) => void;
  onOptionChange: (id: string, value: string) => void;
  validationErrors: ValidationErrors;
  setValidationErrors: Dispatch<SetStateAction<ValidationErrors>>;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
          Options
        </h3>
        <span className="text-[11px] font-semibold text-muted-foreground/70">
          {options.length}/5
        </span>
      </div>

      <div className="space-y-2.5">
        {options.map((opt, index) => (
          <div
            key={opt.id}
            className={cn(
              "group flex items-center gap-3 px-4 py-3 rounded-2xl border transition-all duration-200",
              "border-border/40 bg-muted/10",
              "hover:border-primary/30 hover:bg-primary/5",
              "focus-within:border-primary/50 focus-within:bg-primary/5 focus-within:ring-2 focus-within:ring-primary/20",
            )}>
            {/* Option index badge */}
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-card border border-border/40 font-bold text-sm text-primary shadow-sm">
              {index + 1}
            </div>

            <input
              value={opt.text}
              disabled={disabled}
              onChange={(e) => {
                onOptionChange(opt.id, e.target.value);
                if (validationErrors.options) {
                  setValidationErrors((prev: ValidationErrors) => ({
                    ...prev,
                    options: undefined,
                  }));
                }
              }}
              placeholder={`Option ${index + 1}`}
              maxLength={200}
              className="seamless-field flex-1 bg-transparent text-sm font-semibold text-foreground placeholder:text-muted-foreground/50 p-0"
            />

            <button
              type="button"
              onClick={() => onRemoveOption(opt.id)}
              disabled={disabled || options.length <= 2}
              className={cn(
                "p-1.5 rounded-lg transition-all shrink-0",
                disabled || options.length <= 2
                  ? "opacity-0 cursor-default pointer-events-none"
                  : "text-muted-foreground/50 hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100",
              )}>
              <PiXBold className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>

      {/* validation hint */}
      <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wide">
        <span
          className={
            validationErrors.options
              ? "text-destructive"
              : "text-muted-foreground/60"
          }>
          {validationErrors.options ?? "Minimum 2 options required"}
        </span>
      </div>

      <button
        type="button"
        onClick={onAddOption}
        disabled={disabled || options.length >= 5}
        className={cn(
          "w-full rounded-2xl border border-dashed px-4 py-3 text-center text-sm font-bold transition-all duration-200",
          disabled || options.length >= 5
            ? "border-border/30 text-muted-foreground/40 cursor-not-allowed opacity-50"
            : "border-border/60 text-primary hover:border-primary/50 hover:bg-primary/5",
        )}>
        <span className="inline-flex items-center justify-center gap-2">
          <PiPlusBold className="h-4 w-4" />
          Add option
        </span>
      </button>
    </div>
  );
}
