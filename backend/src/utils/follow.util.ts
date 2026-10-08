import { Follow } from "../models/Follow.model.js";
import { User } from "../models/User.model.js";
import type { IFollowStats } from "../types/follow.types.js";

/**
 * Check if a user is following another user
 */
export const isFollowing = async (
  userId: string,
  followingId: string,
): Promise<boolean> => {
  const follow = await Follow.findOne({ userId, followingId });
  return !!follow;
};

/**
 * Get follow statistics for a user
 */
export const getFollowStats = async (
  targetUserId: string,
  currentUserId?: string,
): Promise<IFollowStats> => {
  if (!(await User.exists({ clerkId: targetUserId }))) {
    return { followersCount: 0, followingCount: 0, isFollowing: false };
  }
  // Edges are authoritative; stored counters can drift after account deletion.
  const [followersCount, followingCount, following] = await Promise.all([
    Follow.countDocuments({ followingId: targetUserId }),
    Follow.countDocuments({ userId: targetUserId }),
    currentUserId && currentUserId !== targetUserId
      ? isFollowing(currentUserId, targetUserId)
      : Promise.resolve(false),
  ]);
  return { followersCount, followingCount, isFollowing: following };
};

/**
 * Update user follow counts
 */
export const updateFollowCounts = async (
  userId: string,
  followingId: string,
  increment: boolean,
): Promise<void> => {
  const change = increment ? 1 : -1;

  await Promise.all([
    // Update follower count for the user being followed
    User.updateOne({ clerkId: followingId }, [
      {
        $set: {
          followersCount: {
            $max: [0, { $add: [{ $ifNull: ["$followersCount", 0] }, change] }],
          },
        },
      },
    ]),
    // Update following count for the user who is following
    User.updateOne({ clerkId: userId }, [
      {
        $set: {
          followingCount: {
            $max: [0, { $add: [{ $ifNull: ["$followingCount", 0] }, change] }],
          },
        },
      },
    ]),
  ]);
};
