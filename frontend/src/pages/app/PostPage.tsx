import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { BackButton } from "@/components/ui/BackButton";
import { PostCard } from "@/components/posts/PostCard";
import { PostService } from "@/services/postService";
import { showSuccessToast, showErrorToast } from "@/lib/error-handling/toasts";
import type { Post } from "@/types/post";
import { CommentsSection } from "@/components/comments/CommentsSection";
import { logError } from "@/lib/errorHandling";
import { SkeletonPost, CommentsSkeleton } from "@/components/ui/loading";
import { ErrorMessage } from "@/components/ui/error-message";

function getErrorMessage(error: unknown): string {
  if (typeof error === "object" && error !== null && "response" in error) {
    const response = (error as { response?: { data?: { message?: string } } })
      .response;
    const apiMessage = response?.data?.message;
    if (typeof apiMessage === "string" && apiMessage.length > 0) {
      return apiMessage;
    }
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "Failed to load post";
}

export default function PostPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setError("Post ID is required");
      setLoading(false);
      return;
    }

    const fetchPost = async () => {
      try {
        setLoading(true);
        const response = await PostService.getPostById(id);
        if (response.success) {
          setPost(response.data);
        } else {
          setError(response.message || "Failed to load post");
        }
      } catch (err: unknown) {
        logError(err, {
          component: "PostPage",
          action: "fetchPost",
          metadata: { id },
        });
        setError(getErrorMessage(err));
      } finally {
        setLoading(false);
      }
    };

    fetchPost();
  }, [id]);

  const handleDelete = async (deletedPostId: string) => {
    try {
      const response = await PostService.deletePost(deletedPostId);
      if (response.success) {
        showSuccessToast("Post deleted");
        navigate("/");
      } else {
        showErrorToast(response.message || "Failed to delete post");
      }
    } catch (err: unknown) {
      logError(err, {
        component: "PostPage",
        action: "deletePost",
        metadata: { postId: deletedPostId },
      });
      showErrorToast(err);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-2xl space-y-6">
        <div className="mb-4">
          <BackButton />
        </div>

        <SkeletonPost />
        <CommentsSkeleton />
      </div>
    );
  }

  if (error || !post) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-2xl space-y-6">
        <ErrorMessage
          variant={error ? "default" : "not-found"}
          title={error ? "Failed to Load Post" : "Post Not Found"}
          description={
            error ||
            "The post you are looking for does not exist or has been moved."
          }
          showRetry={false}
          showGoHome={true}
        />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl space-y-6">
      {/* Back button */}
      <div className="mb-2">
        <BackButton />
      </div>

      {/* Post card */}
      <PostCard post={post} onDelete={handleDelete} isSingleView />

      <CommentsSection
        contentType="post"
        contentId={post._id}
        contentAuthorClerkId={post.author.clerkId}
      />
    </div>
  );
}
