import { beforeEach, describe, expect, it, vi } from "vitest";
import { useAuthStore } from "@/stores/authStore";
import { useFollowStore } from "@/stores/followStore";

const mocked = vi.hoisted(() => ({ followUser: vi.fn(), unfollowUser: vi.fn() }));
vi.mock("@/services/followService", () => ({
  FollowService: { followUser: mocked.followUser, unfollowUser: mocked.unfollowUser },
}));

beforeEach(() => {
  mocked.followUser.mockReset();
  mocked.unfollowUser.mockReset();
  useFollowStore.getState().reset();
  useAuthStore.setState({ user: { clerkId: "self", username: "self" } } as never);
});

describe("follow store refresh", () => {
  it("rolls back a failed follow and allows retry", async () => {
    useFollowStore.getState().hydrateCounts("target", { followersCount: 7 });
    useFollowStore.getState().hydrateCounts("self", { followingCount: 2 });
    mocked.followUser.mockRejectedValueOnce(new Error("network"));
    await expect(useFollowStore.getState().follow("target")).rejects.toThrow("network");
    expect(useFollowStore.getState().isFollowingByTarget.target).toBe(false);
    expect(useFollowStore.getState().followersCountByUser.target).toBe(7);
    expect(useFollowStore.getState().followingCountByUser.self).toBe(2);
    mocked.followUser.mockResolvedValueOnce(undefined);
    await useFollowStore.getState().follow("target");
    expect(useFollowStore.getState().isFollowingByTarget.target).toBe(true);
    expect(useFollowStore.getState().followersCountByUser.target).toBe(8);
  });

  it("refreshes stale relationship state on subsequent server visits", () => {
    useFollowStore.getState().hydrateRelationshipIfMissing("target", false);
    useFollowStore.getState().syncRelationshipFromServer("target", true);
    expect(useFollowStore.getState().isFollowingByTarget.target).toBe(true);
    useFollowStore.getState().syncRelationshipFromServer("target", false);
    expect(useFollowStore.getState().isFollowingByTarget.target).toBe(false);
  });

  it("does not override optimistic follow while request is pending", async () => {
    let complete!: () => void;
    mocked.followUser.mockImplementation(() => new Promise<void>((resolve) => { complete = resolve; }));
    const pending = useFollowStore.getState().follow("target");
    expect(useFollowStore.getState().pendingByTarget.target).toBe(true);
    useFollowStore.getState().syncRelationshipFromServer("target", false);
    expect(useFollowStore.getState().isFollowingByTarget.target).toBe(true);
    complete();
    await pending;
    expect(useFollowStore.getState().isFollowingByTarget.target).toBe(true);
  });
});
