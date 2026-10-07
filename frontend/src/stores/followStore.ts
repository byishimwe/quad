import { create } from "zustand";

import { FollowService } from "@/services/followService";
import { useAuthStore } from "@/stores/authStore";

export type FollowEventPayload = {
  userId: string; // follower
  followingId: string; // followed
};

type FollowState = {
  isFollowingByTarget: Record<string, boolean | undefined>;
  followersCountByUser: Record<string, number | undefined>;
  followingCountByUser: Record<string, number | undefined>;
  pendingByTarget: Record<string, boolean | undefined>;
  pendingActionByTarget: Record<string, "follow" | "unfollow" | undefined>;

  hydrateRelationshipIfMissing: (
    targetUserId: string,
    isFollowing: boolean,
  ) => void;
  hydrateRelationshipsIfMissing: (
    items: Array<{ clerkId: string; isFollowing?: boolean }>,
  ) => void;
  hydrateCounts: (
    userId: string,
    counts: { followersCount?: number; followingCount?: number },
  ) => void;

  follow: (targetUserId: string) => Promise<void>;
  unfollow: (targetUserId: string) => Promise<void>;

  applyFollowNewEvent: (payload: FollowEventPayload) => void;
  applyFollowRemovedEvent: (payload: FollowEventPayload) => void;
  reset: () => void;
};

function getCurrentUserId(): string | null {
  return useAuthStore.getState().user?.clerkId ?? null;
}

function clampToZero(n: number): number {
  return n < 0 ? 0 : n;
}

export const useFollowStore = create<FollowState>((set, get) => ({
  isFollowingByTarget: {},
  followersCountByUser: {},
  followingCountByUser: {},
  pendingByTarget: {},
  pendingActionByTarget: {},
  reset: () => set({
    isFollowingByTarget: {},
    followersCountByUser: {},
    followingCountByUser: {},
    pendingByTarget: {},
    pendingActionByTarget: {},
  }),

  hydrateRelationshipIfMissing: (targetUserId, isFollowing) => {
    const curr = get().isFollowingByTarget[targetUserId];
    if (typeof curr === "boolean") return;

    set((state) => ({
      isFollowingByTarget: {
        ...state.isFollowingByTarget,
        [targetUserId]: isFollowing,
      },
    }));
  },

  hydrateRelationshipsIfMissing: (items) => {
    set((state) => {
      const next = { ...state.isFollowingByTarget };

      for (const item of items) {
        if (!item?.clerkId) continue;
        if (typeof item.isFollowing !== "boolean") continue;
        if (typeof next[item.clerkId] === "boolean") continue;
        next[item.clerkId] = item.isFollowing;
      }

      return { isFollowingByTarget: next };
    });
  },

  hydrateCounts: (userId, counts) => {
    set((state) => ({
      followersCountByUser: {
        ...state.followersCountByUser,
        ...(typeof counts.followersCount === "number"
          ? { [userId]: clampToZero(counts.followersCount) }
          : {}),
      },
      followingCountByUser: {
        ...state.followingCountByUser,
        ...(typeof counts.followingCount === "number"
          ? { [userId]: clampToZero(counts.followingCount) }
          : {}),
      },
    }));
  },

  follow: async (targetUserId) => {
    const currentUserId = getCurrentUserId();
    if (!currentUserId) return;
    if (currentUserId === targetUserId) return;

    const isPending = !!get().pendingByTarget[targetUserId];
    if (isPending) return;

    const prevIsFollowing = get().isFollowingByTarget[targetUserId] ?? false;
    if (prevIsFollowing) return;

    const prevTargetFollowers = get().followersCountByUser[targetUserId];
    const prevCurrentFollowing = get().followingCountByUser[currentUserId];

    set((state) => ({
      pendingByTarget: { ...state.pendingByTarget, [targetUserId]: true },
      pendingActionByTarget: {
        ...state.pendingActionByTarget,
        [targetUserId]: "follow",
      },
      isFollowingByTarget: {
        ...state.isFollowingByTarget,
        [targetUserId]: true,
      },
      followersCountByUser: {
        ...state.followersCountByUser,
        ...(typeof prevTargetFollowers === "number"
          ? { [targetUserId]: prevTargetFollowers + 1 }
          : {}),
      },
      followingCountByUser: {
        ...state.followingCountByUser,
        ...(typeof prevCurrentFollowing === "number"
          ? { [currentUserId]: prevCurrentFollowing + 1 }
          : {}),
      },
    }));

    try {
      await FollowService.followUser(targetUserId);
    } catch (e) {
      // rollback
      set((state) => ({
        isFollowingByTarget: {
          ...state.isFollowingByTarget,
          [targetUserId]: prevIsFollowing,
        },
        followersCountByUser: {
          ...state.followersCountByUser,
          ...(typeof prevTargetFollowers === "number"
            ? { [targetUserId]: prevTargetFollowers }
            : {}),
        },
        followingCountByUser: {
          ...state.followingCountByUser,
          ...(typeof prevCurrentFollowing === "number"
            ? { [currentUserId]: prevCurrentFollowing }
            : {}),
        },
      }));
      throw e;
    } finally {
      set((state) => ({
        pendingByTarget: { ...state.pendingByTarget, [targetUserId]: false },
        pendingActionByTarget: {
          ...state.pendingActionByTarget,
          [targetUserId]: undefined,
        },
      }));
    }
  },

  unfollow: async (targetUserId) => {
    const currentUserId = getCurrentUserId();
    if (!currentUserId) return;
    if (currentUserId === targetUserId) return;

    const isPending = !!get().pendingByTarget[targetUserId];
    if (isPending) return;

    const prevIsFollowing = get().isFollowingByTarget[targetUserId] ?? false;
    if (!prevIsFollowing) return;

    const prevTargetFollowers = get().followersCountByUser[targetUserId];
    const prevCurrentFollowing = get().followingCountByUser[currentUserId];

    set((state) => ({
      pendingByTarget: { ...state.pendingByTarget, [targetUserId]: true },
      pendingActionByTarget: {
        ...state.pendingActionByTarget,
        [targetUserId]: "unfollow",
      },
      isFollowingByTarget: {
        ...state.isFollowingByTarget,
        [targetUserId]: false,
      },
      followersCountByUser: {
        ...state.followersCountByUser,
        ...(typeof prevTargetFollowers === "number"
          ? { [targetUserId]: clampToZero(prevTargetFollowers - 1) }
          : {}),
      },
      followingCountByUser: {
        ...state.followingCountByUser,
        ...(typeof prevCurrentFollowing === "number"
          ? { [currentUserId]: clampToZero(prevCurrentFollowing - 1) }
          : {}),
      },
    }));

    try {
      await FollowService.unfollowUser(targetUserId);
    } catch (e) {
      // rollback
      set((state) => ({
        isFollowingByTarget: {
          ...state.isFollowingByTarget,
          [targetUserId]: prevIsFollowing,
        },
        followersCountByUser: {
          ...state.followersCountByUser,
          ...(typeof prevTargetFollowers === "number"
            ? { [targetUserId]: prevTargetFollowers }
            : {}),
        },
        followingCountByUser: {
          ...state.followingCountByUser,
          ...(typeof prevCurrentFollowing === "number"
            ? { [currentUserId]: prevCurrentFollowing }
            : {}),
        },
      }));
      throw e;
    } finally {
      set((state) => ({
        pendingByTarget: { ...state.pendingByTarget, [targetUserId]: false },
        pendingActionByTarget: {
          ...state.pendingActionByTarget,
          [targetUserId]: undefined,
        },
      }));
    }
  },

  applyFollowNewEvent: (payload) => {
    const currentUserId = getCurrentUserId();
    if (!currentUserId) return;

    const followerId = payload.userId;
    const followedId = payload.followingId;

    // If I am the follower, update my relationship to target + my followingCount.
    if (currentUserId === followerId) {
      const wasFollowing = get().isFollowingByTarget[followedId] ?? false;
      if (!wasFollowing) {
        const prevTargetFollowers = get().followersCountByUser[followedId];
        const prevCurrentFollowing = get().followingCountByUser[currentUserId];

        set((state) => ({
          isFollowingByTarget: {
            ...state.isFollowingByTarget,
            [followedId]: true,
          },
          followersCountByUser: {
            ...state.followersCountByUser,
            ...(typeof prevTargetFollowers === "number"
              ? { [followedId]: prevTargetFollowers + 1 }
              : {}),
          },
          followingCountByUser: {
            ...state.followingCountByUser,
            ...(typeof prevCurrentFollowing === "number"
              ? { [currentUserId]: prevCurrentFollowing + 1 }
              : {}),
          },
        }));
      }

      return;
    }

    // If I am the followed user, my followersCount increments.
    if (currentUserId === followedId) {
      const prevFollowers = get().followersCountByUser[currentUserId];
      if (typeof prevFollowers === "number") {
        set((state) => ({
          followersCountByUser: {
            ...state.followersCountByUser,
            [currentUserId]: prevFollowers + 1,
          },
        }));
      }
    }
  },

  applyFollowRemovedEvent: (payload) => {
    const currentUserId = getCurrentUserId();
    if (!currentUserId) return;

    const followerId = payload.userId;
    const followedId = payload.followingId;

    if (currentUserId === followerId) {
      const wasFollowing = get().isFollowingByTarget[followedId] ?? false;
      if (wasFollowing) {
        const prevTargetFollowers = get().followersCountByUser[followedId];
        const prevCurrentFollowing = get().followingCountByUser[currentUserId];

        set((state) => ({
          isFollowingByTarget: {
            ...state.isFollowingByTarget,
            [followedId]: false,
          },
          followersCountByUser: {
            ...state.followersCountByUser,
            ...(typeof prevTargetFollowers === "number"
              ? { [followedId]: clampToZero(prevTargetFollowers - 1) }
              : {}),
          },
          followingCountByUser: {
            ...state.followingCountByUser,
            ...(typeof prevCurrentFollowing === "number"
              ? { [currentUserId]: clampToZero(prevCurrentFollowing - 1) }
              : {}),
          },
        }));
      }

      return;
    }

    if (currentUserId === followedId) {
      const prevFollowers = get().followersCountByUser[currentUserId];
      if (typeof prevFollowers === "number") {
        set((state) => ({
          followersCountByUser: {
            ...state.followersCountByUser,
            [currentUserId]: clampToZero(prevFollowers - 1),
          },
        }));
      }
    }
  },
}));
