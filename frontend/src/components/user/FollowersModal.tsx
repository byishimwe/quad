import { useState, useEffect, useCallback } from "react";
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
  try {
    const result = await FollowService.getFollowers(userId, { page, limit });
    return {
      users: result.followers.map(convertApiFollowUserToUserCard),
      hasMore: result.hasMore,
      total: result.total,
    };
  } catch (error) {
    logError(error, {
      component: "FollowersModal",
      action: "getFollowers",
      metadata: { userId, page, limit },
    });
    return { users: [], hasMore: false, total: 0 };
  }
};

const getFollowing = async (
  userId: string,
  page: number,
  limit: number,
): Promise<{ users: UserCardData[]; hasMore: boolean; total: number }> => {
  try {
    const result = await FollowService.getFollowing(userId, { page, limit });
    return {
      users: result.following.map(convertApiFollowUserToUserCard),
      hasMore: result.hasMore,
      total: result.total,
    };
  } catch (error) {
    logError(error, {
      component: "FollowersModal",
      action: "getFollowing",
      metadata: { userId, page, limit },
    });
    return { users: [], hasMore: false, total: 0 };
  }
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
  const [totalCount, setTotalCount] = useState(initialCount || 0);

  const follow = useFollowStore((s) => s.follow);
  const unfollow = useFollowStore((s) => s.unfollow);
  const hydrateRelationshipsIfMissing = useFollowStore(
    (s) => s.hydrateRelationshipsIfMissing,
  );

  const loadUsers = useCallback(
    async (pageToLoad: number = 1) => {
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
          setUsers((prev) =>
            pageToLoad === 1 ? result.users : [...prev, ...result.users],
          );
          setHasMore(result.hasMore);
          setTotalCount(result.total || initialCount || result.users.length);

          hydrateRelationshipsIfMissing(result.users);
        } else {
          const result = await getFollowing(userId, pageToLoad, 20);
          setUsers((prev) =>
            pageToLoad === 1 ? result.users : [...prev, ...result.users],
          );
          setHasMore(result.hasMore);
          setTotalCount(result.total || initialCount || result.users.length);

          hydrateRelationshipsIfMissing(result.users);
        }

        setPage(pageToLoad);
      } catch (error) {
        logError(error, {
          component: "FollowersModal",
          action: "loadUsers",
          metadata: { userId, type, pageToLoad },
        });
      } finally {
        if (pageToLoad === 1) {
          setIsLoading(false);
        } else {
          setIsLoadingMore(false);
        }
      }
    },
    [userId, type, initialCount, hydrateRelationshipsIfMissing],
  );

  // Load users when modal opens
  useEffect(() => {
    if (isOpen) {
      // This loads remote data when the modal opens; loading state is set by loadUsers.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      loadUsers(1);
    }
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
    loadUsers(page + 1);
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
