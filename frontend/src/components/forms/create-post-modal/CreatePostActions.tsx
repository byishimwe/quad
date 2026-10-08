import { PiSpinnerBold } from "react-icons/pi";

import { Button } from "@/components/ui/button";

export function CreatePostActions({
  hasContent,
  isSubmitted,
  isLoading,
  isUploading,
  isOverLimit,
  onCancel,
}: {
  hasContent: boolean;
  isSubmitted: boolean;
  isLoading: boolean;
  isUploading: boolean;
  isOverLimit: boolean;
  onCancel: () => void;
}) {
  return (
    <div className="flex items-center justify-between pt-4 border-t border-border/40">
      <div className="text-sm text-muted-foreground">
        {!hasContent && isSubmitted && (
          <span className="text-destructive">
            Post must have at least one media
          </span>
        )}
      </div>
      <div className="flex gap-2">
        <Button
          type="button"
          variant="ghost"
          onClick={onCancel}
          disabled={isLoading}
          className="text-muted-foreground hover:text-foreground hover:bg-accent">
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={isLoading || isUploading || isOverLimit || !hasContent}
          className="min-w-[110px] rounded-full">
          {isUploading ? (
            <>
              <PiSpinnerBold className="h-4 w-4 mr-2 animate-spin" />
              Uploading...
            </>
          ) : isLoading ? (
            <>
              <PiSpinnerBold className="h-4 w-4 mr-2 animate-spin" />
              Posting...
            </>
          ) : (
            "Post"
          )}
        </Button>
      </div>
    </div>
  );
}
