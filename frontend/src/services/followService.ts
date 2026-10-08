import { endpoints } from "@/lib/api";
import { invalidateCache } from "@/lib/api/cache";
import type { FollowListQueryParams } from "@/lib/api/paginationTypes";
import type {
  ApiFollowUser,
  ApiFollowStats,
} from "@/types/api";

export class FollowService {
  // Follow a user
  static async followUser(
    userId: string,
  ): Promise<{ success: boolean; message?: string }> {
    const response = await endpoints.follow.followUser(userId);
    if (!response.data?.success) throw new Error("Unable to follow user");
    invalidateCache();
    return response.data;
  }

  // Unfollow a user
  static async unfollowUser(
    userId: string,
  ): Promise<{ success: boolean; message?: string }> {
    const response = await endpoints.follow.unfollowUser(userId);
    if (!response.data?.success) throw new Error("Unable to unfollow user");
    invalidateCache();
    return response.data;
  }

  // Get user's followers
  static async getFollowers(
    userId: string,
    params: FollowListQueryParams = {},
  ): Promise<{ followers: ApiFollowUser[]; hasMore: boolean; total: number }> {
    const response = await endpoints.follow.getFollowers(userId, params);
    const payload = response.data;
    const followers: ApiFollowUser[] = Array.isArray(payload.data)
      ? payload.data
      : [];
    const pagination = payload.pagination || {};

    return {
      followers,
      hasMore: pagination.hasMore || false,
      total: pagination.total || followers.length,
    };
  }

  // Get users that a user is following
  static async getFollowing(
    userId: string,
    params: FollowListQueryParams = {},
  ): Promise<{ following: ApiFollowUser[]; hasMore: boolean; total: number }> {
    const response = await endpoints.follow.getFollowing(userId, params);
    const payload = response.data;
    const following: ApiFollowUser[] = Array.isArray(payload.data)
      ? payload.data
      : [];
    const pagination = payload.pagination || {};

    return {
      following,
      hasMore: pagination.hasMore || false,
      total: pagination.total || following.length,
    };
  }

  // Check if currently following a user
  static async checkFollowing(
    userId: string,
  ): Promise<{ isFollowing: boolean }> {
    const response = await endpoints.follow.checkFollowing(userId);
    return {
      isFollowing: response.data.data.isFollowing || false,
    };
  }

  // Get follow statistics
  static async getFollowStats(userId: string): Promise<ApiFollowStats> {
    const response = await endpoints.follow.getStats(userId);
    const data = (response.data?.data ?? {}) as ApiFollowStats;
    return {
      followersCount:
        typeof data.followersCount === "number" ? data.followersCount : 0,
      followingCount:
        typeof data.followingCount === "number" ? data.followingCount : 0,
      ...(typeof data.isFollowing === "boolean"
        ? { isFollowing: data.isFollowing }
        : {}),
    };
  }

  // Batch follow operations
  static async batchFollow(
    userIds: string[],
  ): Promise<{ succeeded: string[]; failed: string[] }> {
    const results = await Promise.allSettled(
      userIds.map((userId) => this.followUser(userId)),
    );

    const succeeded: string[] = [];
    const failed: string[] = [];

    results.forEach((result, index) => {
      if (result.status === "fulfilled") {
        succeeded.push(userIds[index]);
      } else {
        failed.push(userIds[index]);
      }
    });

    return { succeeded, failed };
  }

  // Batch unfollow operations
  static async batchUnfollow(
    userIds: string[],
  ): Promise<{ succeeded: string[]; failed: string[] }> {
    const results = await Promise.allSettled(
      userIds.map((userId) => this.unfollowUser(userId)),
    );

    const succeeded: string[] = [];
    const failed: string[] = [];

    results.forEach((result, index) => {
      if (result.status === "fulfilled") {
        succeeded.push(userIds[index]);
      } else {
        failed.push(userIds[index]);
      }
    });

    return { succeeded, failed };
  }
}
