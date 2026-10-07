import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { BackButton } from "@/components/ui/BackButton";
import { LoadingPage } from "@/components/ui/loading";
import { CreatePostForm } from "@/components/forms/CreatePostForm";
import { PostService } from "@/services/postService";
import type { CreatePostData } from "@/schemas/post.schema";
import type { Post } from "@/types/post";
import { showSuccessToast, showErrorToast } from "@/lib/error-handling/toasts";
import { logError } from "@/lib/errorHandling";
import { ErrorMessage } from "@/components/ui/error-message";

function getErrorMessage(error: unknown): string {
  if (typeof error === "object" && error !== null && "response" in error) {
    const response = (
      error as {
        response?: {
          data?: { message?: string };
        };
      }
    ).response;

    const apiMessage = response?.data?.message;
    if (typeof apiMessage === "string" && apiMessage.length > 0) {
      return apiMessage;
    }
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "An error occurred while updating the post";
}

export default function EditPostPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

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
          component: "EditPostPage",
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

  const handleSubmit = async (data: CreatePostData) => {
    if (!id) return;

    setIsSubmitting(true);
    try {
      const response = await PostService.updatePost(id, data);

      if (response.success) {
        showSuccessToast("Post updated");
        navigate(`/posts/${id}`);
      } else {
        showErrorToast(response.message || "Failed to update post");
      }
    } catch (err: unknown) {
      logError(err, {
        component: "EditPostPage",
        action: "updatePost",
        metadata: { id },
      });
      showErrorToast(getErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const initialValues = useMemo((): CreatePostData => {
    if (!post) return { text: "", media: [] };
    return {
      text: post.text ?? "",
      media: (post.media ?? []).map((m) => ({
        url: m.url,
        type: m.type,
        ...(m.aspectRatio ? { aspectRatio: m.aspectRatio } : {}),
      })),
    };
  }, [post]);

  if (loading) {
    return <LoadingPage />;
  }

  if (error || !post) {
    return (
      <ErrorMessage
        title="Unable to edit post"
        description={
          error ||
          "The post you are trying to edit does not exist or cannot be loaded."
        }
        onGoHome={() => navigate("/")}
        goHomeLabel="Back to Home"
        showRetry={false}
        variant="not-found"
      />
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <div className="mb-6 flex items-center justify-between">
        <BackButton label="Edit Post" />
      </div>

      <CreatePostForm
        onSubmit={handleSubmit}
        onCancel={() => navigate(-1)}
        isLoading={isSubmitting}
        initialValues={initialValues}
      />
    </div>
  );
}
