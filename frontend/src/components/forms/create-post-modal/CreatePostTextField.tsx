import type { Control } from "react-hook-form";

import { AutoExpandingTextarea } from "@/components/ui/auto-expanding-textarea";
import {
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@/components/ui/form";
import { cn } from "@/lib/utils";
import type { CreatePostData } from "@/schemas/post.schema";

export function CreatePostTextField({
  control,
  isLoading,
  charCount,
  isOverLimit,
}: {
  control: Control<CreatePostData>;
  isLoading: boolean;
  charCount: number;
  isOverLimit: boolean;
}) {
  return (
    <FormField
      control={control}
      name="text"
      render={({ field }) => (
        <FormItem>
          <p className="text-sm font-semibold text-foreground">
            What's happening?
          </p>
          <FormControl>
            <div className="relative rounded-2xl border border-border bg-muted/30 focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/20 transition-all">
              <AutoExpandingTextarea
                placeholder="Share your thoughts..."
                className="seamless-field bg-transparent text-sm text-foreground/90 placeholder:text-muted-foreground px-4 py-3 pr-24"
                minHeight={120}
                maxHeight={320}
                disabled={isLoading}
                {...field}
              />
              <span
                className={cn(
                  "absolute bottom-2 right-3 text-xs text-muted-foreground",
                  isOverLimit && "text-destructive font-medium",
                )}
              >
                {charCount}/1000
              </span>
            </div>
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
