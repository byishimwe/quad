import { useState, useEffect, useCallback, useRef } from "react";
import type { UserCardData } from "@/components/user/UserCard";
import { FollowService } from "@/services/followService";
import type { ApiFollowUser } from "@/types/api";
import { logError, showErrorToast } from "@/lib/errorHandling";
import { useFollowStore } from "@/stores/followStore";

import { FollowersModalBody } from "./followers-modal/FollowersModalBody";
import { FollowersModalFooter } from "./followers-modal/FollowersModalFooter";
import { FollowersModalHeader } from "./followers-modal/FollowersModalHeader";

interface FollowersModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  type: "followers" | "following";
  initialCount?: number;
}

// Convert API follow user to UserCardData
const convertApiFollowUserToUserCard = (
  followUser: ApiFollowUser,
): UserCardData => ({
  _id: followUser._id,
  clerkId: followUser.clerkId,
  username: followUser.username,
  email: "", // Not provided in follow lists
  firstName: followUser.firstName,
  lastName: followUser.lastName,
  profileImage: followUser.profileImage,
  bio: followUser.bio,
  isVerified: followUser.isVerified,
  followersCount: 0, // Not provided in follow lists
  followingCount: 0, // Not provided in follow lists
  postsCount: 0, // Not provided in follow lists
  joinedAt: followUser.followedAt || new Date().toISOString(),
  isFollowing: followUser.isFollowing,
});

// Real API functions using backend endpoints
const getFollowers = async (
  userId: string,
  page: number,
  limit: number,
): Promise<{ users: UserCardData[]; hasMore: boolean; total: number }> => {
  const result = await FollowService.getFollowers(userId, { page, limit });
  return {
    users: result.followers.map(convertApiFollowUserToUserCard),
    hasMore: result.hasMore,
    total: result.total,
  };
};

const getFollowing = async (
  userId: string,
  page: number,
  limit: number,
): Promise<{ users: UserCardData[]; hasMore: boolean; total: number }> => {
  const result = await FollowService.getFollowing(userId, { page, limit });
  return {
    users: result.following.map(convertApiFollowUserToUserCard),
    hasMore: result.hasMore,
    total: result.total,
  };
};

export function FollowersModal({
  isOpen,
  onClose,
  userId,
  type,
  initialCount = 0,
}: FollowersModalProps) {
  const [users, setUsers] = useState<UserCardData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [totalCount, setTotalCount] = useState(initialCount);
  const [loadError, setLoadError] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  const follow = useFollowStore((s) => s.follow);
  const unfollow = useFollowStore((s) => s.unfollow);
  const hydrateRelationshipsIfMissing = useFollowStore(
    (s) => s.hydrateRelationshipsIfMissing,
  );

  const loadUsers = useCallback(
    async (pageToLoad: number = 1) => {
      const requestId = ++requestIdRef.current;
      setLoadError(null);
      if (pageToLoad === 1) {
        setUsers([]);
        setPage(1);
        setIsLoading(true);
      } else {
        setIsLoadingMore(true);
      }

      try {
        if (type === "followers") {
          const result = await getFollowers(userId, pageToLoad, 20);
          if (requestId !== requestIdRef.current) return;
          setUsers((prev) =>
            pageToLoad === 1 ? result.users : [...prev, ...result.users],
          );
          setHasMore(result.hasMore);
          setTotalCount(result.total);

          hydrateRelationshipsIfMissing(result.users);
        } else {
          const result = await getFollowing(userId, pageToLoad, 20);
          if (requestId !== requestIdRef.current) return;
          setUsers((prev) =>
            pageToLoad === 1 ? result.users : [...prev, ...result.users],
          );
          setHasMore(result.hasMore);
          setTotalCount(result.total);

          hydrateRelationshipsIfMissing(result.users);
        }

        if (requestId === requestIdRef.current) setPage(pageToLoad);
      } catch (error) {
        if (requestId === requestIdRef.current) setLoadError("Could not load this list. Please try again.");
        logError(error, {
          component: "FollowersModal",
          action: "loadUsers",
          metadata: { userId, type, pageToLoad },
        });
      } finally {
        if (requestId !== requestIdRef.current) return;
        if (pageToLoad === 1) {
          setIsLoading(false);
        } else {
          setIsLoadingMore(false);
        }
      }
    },
    [userId, type, hydrateRelationshipsIfMissing],
  );

  // Load users when modal opens
  useEffect(() => {
    if (isOpen) {
      // This loads remote data when the modal opens; loading state is set by loadUsers.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      void loadUsers(1);
    }
    return () => { requestIdRef.current += 1; };
  }, [isOpen, loadUsers]);

  // Handle follow/unfollow
  const handleFollow = async (targetUserId: string) => {
    try {
      await follow(targetUserId);
    } catch (error) {
      logError(error, {
        component: "FollowersModal",
        action: "followUser",
        metadata: { targetUserId },
      });
      showErrorToast(error);
    }
  };

  const handleLoadMore = () => {
    if (!hasMore || isLoadingMore) return;
    void loadUsers(page + 1);
  };

  const handleUnfollow = async (targetUserId: string) => {
    try {
      await unfollow(targetUserId);
    } catch (error) {
      logError(error, {
        component: "FollowersModal",
        action: "unfollowUser",
        metadata: { targetUserId },
      });
      showErrorToast(error);
    }
  };

  if (!isOpen) return null;

  const title = type === "followers" ? "Followers" : "Following";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/55 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-md mx-4 bg-background/95 rounded-2xl shadow-2xl border border-border/60 max-h-[80vh] flex flex-col overflow-hidden animate-in fade-in-0 zoom-in-95">
        {/* Header */}
        <FollowersModalHeader title={title} onClose={onClose} />

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {loadError && (
            <div role="alert" className="px-4 py-3 text-sm text-destructive">
              {loadError}
              <button type="button" onClick={() => void loadUsers(page === 1 ? 1 : page + 1)}
                className="ml-2 underline underline-offset-2 font-semibold">Retry</button>
            </div>
          )}
          <FollowersModalBody
            isLoading={isLoading}
            users={users}
            type={type}
            onFollow={handleFollow}
            onUnfollow={handleUnfollow}
          />
        </div>

        {/* Footer with count and pagination */}
        <FollowersModalFooter
          isLoading={isLoading}
          users={users}
          totalCount={totalCount || users.length}
          type={type}
          hasMore={hasMore}
          isLoadingMore={isLoadingMore}
          onLoadMore={handleLoadMore}
        />
      </div>
    </div>
  );
}
