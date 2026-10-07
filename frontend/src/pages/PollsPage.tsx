import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";

import { PollService } from "@/services/pollService";
import type { Poll, PollQueryParams } from "@/types/poll";
import { PollsListSkeleton, LoadMoreButton } from "@/components/ui/loading";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorMessage } from "@/components/ui/error-message";
import { PiChartBarBold } from "react-icons/pi";
import { useSocketStore } from "@/stores/socketStore";
import { showSuccessToast, showErrorToast } from "@/lib/error-handling/toasts";
import type {
  FeedEngagementUpdatePayload,
  PollVotedPayload,
} from "@/lib/socket";
import { logError } from "@/lib/errorHandling";

import { getErrorMessage } from "./polls/getErrorMessage";
import { PollCard } from "@/components/polls/PollCard";

export default function PollsPage() {
  const location = useLocation();
  const [polls, setPolls] = useState<Poll[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const socket = useSocketStore((state) => state.socket);

  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);

  const handlePollUpdate = (updatedPoll: Poll) => {
    setPolls((prevPolls) =>
      prevPolls.map((poll) =>
        poll.id === updatedPoll.id ? updatedPoll : poll,
      ),
    );
  };

  const handleDeletePoll = async (pollId: string) => {
    try {
      const res = await PollService.delete(pollId);

      if (res.success) {
        setPolls((prev) => prev.filter((p) => p.id !== pollId));
        showSuccessToast("Poll deleted");
      } else {
        showErrorToast(res.message || "Failed to delete poll");
      }
    } catch (err) {
      logError(err, {
        component: "PollsPage",
        action: "deletePoll",
        metadata: { pollId },
      });
      showErrorToast(getErrorMessage(err));
    }
  };

  const queryParams: PollQueryParams = useMemo(
    () => ({
      page,
      limit: 10,
    }),
    [page],
  );

  useEffect(() => {
    const createdPollRaw = (location.state as { createdPoll?: Poll } | null)
      ?.createdPoll;
    if (!createdPollRaw) return;

    const createdObj = createdPollRaw as unknown as Record<string, unknown>;
    const createdId =
      (typeof createdObj.id === "string" && createdObj.id) ||
      (typeof createdObj._id === "string" && createdObj._id) ||
      undefined;

    const createdPoll = {
      ...createdPollRaw,
      ...(createdId ? { id: createdId } : {}),
    };

    // Navigation state carries the newly created poll into this list.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPolls((prev) => {
      if (prev.some((p) => p.id === createdPoll.id)) return prev;
      return [createdPoll, ...prev];
    });
  }, [location.state]);

  useEffect(() => {
    const updatedPollRaw = (location.state as { updatedPoll?: Poll } | null)
      ?.updatedPoll;
    if (!updatedPollRaw) return;

    const updatedObj = updatedPollRaw as unknown as Record<string, unknown>;
    const updatedId =
      (typeof updatedObj.id === "string" && updatedObj.id) ||
      (typeof updatedObj._id === "string" && updatedObj._id) ||
      undefined;

    if (!updatedId) return;

    const updatedPoll = {
      ...updatedPollRaw,
      id: updatedId,
    };

    // Navigation state carries the edited poll into this list.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPolls((prev) => {
      const exists = prev.some((p) => p.id === updatedPoll.id);
      if (!exists) return [updatedPoll, ...prev];
      return prev.map((p) => (p.id === updatedPoll.id ? updatedPoll : p));
    });
  }, [location.state]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await PollService.getAll(queryParams);
        if (!cancelled && res.success) {
          const fetched = res.data || [];
          setPolls((prev) => {
            // Page 1: show newest from API, but keep any locally-inserted polls
            // (e.g. createdPoll via navigation state) at the very top.
            if (page === 1) {
              if (prev.length === 0) return fetched;
              const fetchedIds = new Set(fetched.map((p) => p.id));
              const extras = prev.filter((p) => !fetchedIds.has(p.id));
              return [...extras, ...fetched];
            }

            // Page > 1: append new unique items (infinite pagination)
            const existingIds = new Set(prev.map((p) => p.id));
            const newOnes = fetched.filter((p) => !existingIds.has(p.id));
            return [...prev, ...newOnes];
          });
          setHasMore(res.pagination?.hasMore ?? false);
        }
      } catch (err) {
        logError(err, {
          component: "PollsPage",
          action: "loadPolls",
          metadata: queryParams,
        });
        if (!cancelled) setError(getErrorMessage(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [page, queryParams]);

  // Set up Socket.IO listeners for real-time poll updates
  useEffect(() => {
    if (!socket) return;

    const handleEngagementUpdate = (payload: FeedEngagementUpdatePayload) => {
      if (payload.contentType === "poll") {
        setPolls((prevPolls) =>
          prevPolls.map((poll) => {
            if (poll.id === payload.contentId) {
              return {
                ...poll,
                totalVotes: payload.votes ?? poll.totalVotes,
                reactionsCount: payload.reactionsCount ?? poll.reactionsCount,
              };
            }
            return poll;
          }),
        );
      }
    };

    socket.on("feed:engagement-update", handleEngagementUpdate);

    const handlePollVoted = (payload: PollVotedPayload) => {
      if (!payload?.pollId) return;

      setPolls((prevPolls) =>
        prevPolls.map((poll) => {
          if (String(poll.id) !== String(payload.pollId)) return poll;

          const totalVotes =
            typeof payload.totalVotes === "number"
              ? payload.totalVotes
              : poll.totalVotes;

          const options = poll.options.map((opt, idx) => {
            const optionIndex = typeof opt.index === "number" ? opt.index : idx;
            const votesCountRaw = payload.updatedVoteCounts?.[optionIndex];
            const votesCount =
              typeof votesCountRaw === "number"
                ? votesCountRaw
                : (opt.votesCount ?? 0);

            return {
              ...opt,
              votesCount,
              percentage:
                totalVotes > 0
                  ? Math.round((votesCount / totalVotes) * 100)
                  : 0,
            };
          });

          return {
            ...poll,
            totalVotes,
            options,
          };
        }),
      );
    };

    socket.on("pollVoted", handlePollVoted);

    const handlePollExpired = (pollId: string) => {
      setPolls((prevPolls) =>
        prevPolls.map((poll) => {
          if (poll.id !== pollId) return poll;
          return {
            ...poll,
            status: "expired",
          };
        }),
      );
    };

    socket.on("pollExpired", handlePollExpired);

    return () => {
      socket.off("feed:engagement-update", handleEngagementUpdate);
      socket.off("pollVoted", handlePollVoted);
      socket.off("pollExpired", handlePollExpired);
    };
  }, [socket]);

  const handleChangePage = (next: number) => {
    setPage(next);
  };

  const handleRetry = () => {
    setError(null);
    setPage(1);
  };

  return (
    <div className="mx-auto max-w-[620px] px-3 sm:px-0 space-y-6">
      {error && (
        <ErrorMessage
          description={error}
          onRetry={handleRetry}
        />
      )}

      {loading && polls.length === 0 && (
        <div className="py-4">
          <PollsListSkeleton />
        </div>
      )}

      {!loading && !error && polls.length === 0 && (
        <EmptyState
          icon={<PiChartBarBold className="h-8 w-8 text-primary" />}
          title="No polls found"
          description="It looks like there are no polls matching this view yet."
          className="mt-4"
        />
      )}

      <div className="space-y-6">
        {polls.map((poll) => (
          <PollCard
            key={poll.id}
            poll={poll}
            onUpdate={handlePollUpdate}
            onDelete={handleDeletePoll}
          />
        ))}
      </div>

      {!loading && hasMore && (
        <LoadMoreButton
          loading={loading}
          onClick={() => handleChangePage(page + 1)}
        />
      )}
    </div>
  );
}
