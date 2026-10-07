import { useCallback, useEffect, useState } from "react";
import { CommentComposer } from "@/components/comments/CommentComposer";
import { CommentItem } from "@/components/comments/CommentItem";
import { Button } from "@/components/ui/button";
import { CommentService } from "@/services/commentService";
import type { Comment } from "@/types/comment";
import { ErrorMessage } from "@/components/ui/error-message";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { PiCaretDownBold, PiChatCircleBold } from "react-icons/pi";
import { useSocketStore } from "@/stores/socketStore";

function getErrorMessage(error: unknown): string {
  if (typeof error === "object" && error !== null && "response" in error) {
    const response = (error as { response?: { data?: { message?: string } } })
      .response;
    const apiMessage = response?.data?.message;
    if (typeof apiMessage === "string" && apiMessage.length > 0) {
      return apiMessage;
    }
  }
  if (error instanceof Error && error.message) return error.message;
  return "Failed to load comments";
}

type CommentAddedPayload = {
  contentType: "post" | "story";
  contentId: string;
  comment: unknown;
};

type CommentUpdatedPayload = {
  contentType: "post" | "story";
  contentId: string;
  commentId: string;
  comment: unknown;
};

type CommentDeletedPayload = {
  contentType: "post" | "story";
  contentId: string;
  commentId: string;
};

interface CommentsSectionProps {
  contentType: "post" | "story";
  contentId: string;
  contentAuthorClerkId?: string;
  initialPageSize?: number;
}

interface CommentsCursor {
  skip: number;
  limit: number;
  hasMore: boolean;
}

function CommentSkeletonRow() {
  return (
    <div className="py-4">
      <div className="flex gap-3">
        <Skeleton variant="circular" className="h-10 w-10 shrink-0" />
        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex items-center justify-between gap-3">
            <Skeleton variant="text" className="w-24 h-4 rounded-md" />
            <Skeleton variant="text" className="w-16 h-3 rounded-md opacity-40" />
          </div>
          <div className="space-y-2">
            <Skeleton variant="text" className="w-full h-4 rounded-md opacity-80" />
            <Skeleton variant="text" className="w-10/12 h-4 rounded-md opacity-80" />
          </div>
          <div className="pt-2 flex items-center gap-4">
            <Skeleton variant="text" className="w-20 h-4 rounded-md opacity-40" />
            <Skeleton variant="text" className="w-12 h-4 rounded-md opacity-40" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function CommentsSection({
  contentType,
  contentId,
  contentAuthorClerkId,
  initialPageSize = 20,
}: CommentsSectionProps) {
  const socket = useSocketStore((state) => state.socket);
  const [comments, setComments] = useState<Comment[]>([]);
  const [cursor, setCursor] = useState<CommentsCursor>({
    skip: 0,
    limit: initialPageSize,
    hasMore: true,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState<number | null>(null);

  const displayTotal = typeof total === "number" ? total : comments.length;
  const initialLoading = loading && comments.length === 0;
  const loadingMore = loading && comments.length > 0;

  const normalizeIncomingComment = useCallback(
    (incoming: unknown): Comment | null => {
      if (!incoming || typeof incoming !== "object") return null;
      const c = incoming as Record<string, unknown>;
      const id = c._id;
      const ct = c.contentType;
      const cid = c.contentId;
      const author = c.author;
      const text = c.text;
      if (typeof id !== "string") return null;
      if (ct !== "post" && ct !== "story") return null;
      if (typeof cid !== "string") return null;
      if (!author || typeof author !== "object") return null;
      if (typeof text !== "string") return null;

      const a = author as Record<string, unknown>;
      const createdAt = c.createdAt;
      const updatedAt = c.updatedAt;

      return {
        _id: id,
        contentType: ct,
        contentId: cid,
        author: {
          clerkId: typeof a.clerkId === "string" ? a.clerkId : "",
          username: typeof a.username === "string" ? a.username : "",
          email: typeof a.email === "string" ? a.email : "",
          profileImage:
            typeof a.profileImage === "string" ? a.profileImage : undefined,
        },
        text,
        reactionsCount:
          typeof c.reactionsCount === "number" ? c.reactionsCount : 0,
        likesCount: typeof c.likesCount === "number" ? c.likesCount : 0,
        createdAt:
          typeof createdAt === "string"
            ? createdAt
            : createdAt instanceof Date
              ? createdAt.toISOString()
              : new Date().toISOString(),
        updatedAt:
          typeof updatedAt === "string"
            ? updatedAt
            : updatedAt instanceof Date
              ? updatedAt.toISOString()
              : new Date().toISOString(),
      };
    },
    [],
  );

  const removeCommentById = useCallback((commentId: string) => {
    setComments((prev) => {
      const exists = prev.some((c) => c._id === commentId);
      if (exists) {
        setTotal((t) => (typeof t === "number" ? Math.max(0, t - 1) : t));
        setCursor((c) => ({ ...c, skip: Math.max(0, c.skip - 1) }));
      }
      return prev.filter((c) => c._id !== commentId);
    });
  }, []);

  const loadComments = async (reset = false) => {
    if (loading) return;
    if (!reset && !cursor.hasMore) return;

    try {
      setLoading(true);
      setError(null);
      const nextSkip = reset ? 0 : cursor.skip;
      const res = await CommentService.getByContent(contentType, contentId, {
        limit: cursor.limit,
        skip: nextSkip,
      });
      if (res.success) {
        const data = res.data || [];
        setComments((prev) => (reset ? data : [...prev, ...data]));
        const pag = res.pagination;
        if (typeof pag?.total === "number") {
          setTotal(pag.total);
        }
        setCursor({
          skip: nextSkip + data.length,
          limit: cursor.limit,
          hasMore: Boolean(pag?.hasMore),
        });
      } else if (res.message) {
        setError(res.message);
      }
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // reset when content changes
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setComments([]);
    setCursor({ skip: 0, limit: initialPageSize, hasMore: true });
    setTotal(null);
    void loadComments(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contentType, contentId, initialPageSize]);

  useEffect(() => {
    if (!socket) return;

    const onAdded = (payload: CommentAddedPayload) => {
      if (
        payload.contentType !== contentType ||
        payload.contentId !== contentId
      ) {
        return;
      }
      const normalized = normalizeIncomingComment(payload.comment);
      if (!normalized) return;

      setComments((prev) => {
        if (prev.some((c) => c._id === normalized._id)) return prev;
        return [normalized, ...prev];
      });
      setTotal((t) => (typeof t === "number" ? t + 1 : t));
      setCursor((c) => ({ ...c, skip: c.skip + 1 }));
    };

    const onUpdated = (payload: CommentUpdatedPayload) => {
      if (
        payload.contentType !== contentType ||
        payload.contentId !== contentId
      ) {
        return;
      }
      const normalized = normalizeIncomingComment(payload.comment);
      setComments((prev) =>
        prev.map((c) => {
          if (c._id !== payload.commentId) return c;
          return normalized ? { ...c, ...normalized } : c;
        }),
      );
    };

    const onDeleted = (payload: CommentDeletedPayload) => {
      if (
        payload.contentType !== contentType ||
        payload.contentId !== contentId
      ) {
        return;
      }

      removeCommentById(payload.commentId);
    };

    socket.on("commentAdded", onAdded);
    socket.on("commentUpdated", onUpdated);
    socket.on("commentDeleted", onDeleted);

    return () => {
      socket.off("commentAdded", onAdded);
      socket.off("commentUpdated", onUpdated);
      socket.off("commentDeleted", onDeleted);
    };
  }, [
    contentType,
    contentId,
    normalizeIncomingComment,
    removeCommentById,
    socket,
  ]);

  const handleRetry = () => {
    setError(null);
    loadComments(true);
  };

  const handleCommentCreated = (comment: Comment) => {
    setComments((prev) => {
      if (prev.some((c) => c._id === comment._id)) return prev;
      return [comment, ...prev];
    });
    setTotal((t) => (typeof t === "number" ? t + 1 : t));
    setCursor((c) => ({ ...c, skip: c.skip + 1 }));
  };

  const handleCommentDeleted = (id: string) => {
    removeCommentById(id);
  };

  return (
    <div className="rounded-3xl bg-card border border-border/40 p-5">
      <div className="flex items-center justify-between">
        <h3 className="text-[12px] font-semibold tracking-widest text-muted-foreground uppercase">
          Comments ({displayTotal})
        </h3>
      </div>

      <div className="mt-4">
        <CommentComposer
          contentType={contentType}
          contentId={contentId}
          placeholder="Add a comment..."
          onCreated={handleCommentCreated}
        />
      </div>

      {error && (
        <div className="mt-3">
          <ErrorMessage
            description={error}
            onRetry={handleRetry}
            showGoHome={false}
            className="min-h-0"
          />
        </div>
      )}

      <div className="mt-4 divide-y divide-border/40">
        {initialLoading && (
          <>
            {Array.from({ length: 3 }).map((_, i) => (
              <CommentSkeletonRow key={`comment-skeleton-initial-${i}`} />
            ))}
          </>
        )}

        {!initialLoading &&
          comments.map((c) => (
            <div key={c._id} className="py-4">
              <CommentItem
                comment={c}
                contentAuthorClerkId={contentAuthorClerkId}
                onDeleted={handleCommentDeleted}
              />
            </div>
          ))}

        {!initialLoading && comments.length === 0 && !error && (
          <EmptyState
            variant="inline"
            icon={<PiChatCircleBold className="h-8 w-8 text-primary" />}
            title="No comments yet"
            description="Be the first to share what you think."
            className="py-10"
          />
        )}

        {loadingMore && (
          <>
            {Array.from({ length: 2 }).map((_, i) => (
              <CommentSkeletonRow key={`comment-skeleton-more-${i}`} />
            ))}
          </>
        )}

        {cursor.hasMore && !initialLoading && (
          <div className="pt-4 flex justify-center">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => void loadComments(false)}
              loading={loading}
              className="text-muted-foreground hover:text-foreground">
              Load more comments
              {!loading && <PiCaretDownBold className="ml-2 h-4 w-4" />}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
