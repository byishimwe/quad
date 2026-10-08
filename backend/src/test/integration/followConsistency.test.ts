import request from "supertest";
import { describe, expect, it } from "vitest";
import { createTestApp } from "../utils/testApp.js";
import { getAuthHeaders } from "../utils/testAuth.js";
import { Follow } from "../../models/Follow.model.js";
import { User } from "../../models/User.model.js";

const ensureUser = async (app: ReturnType<typeof createTestApp>, id: string) => {
  const response = await request(app).post("/api/users").set(getAuthHeaders(id)).send({});
  expect([200, 201]).toContain(response.status);
};

describe("follow relationship consistency", () => {
  it("rejects nonexistent follower and target without creating relationships", async () => {
    const app = createTestApp();
    await ensureUser(app, "follow_target");
    expect((await request(app).post("/api/follow/follow_target").set(getAuthHeaders("missing"))).status).toBe(404);
    expect((await request(app).post("/api/follow/missing").set(getAuthHeaders("follow_target"))).status).toBe(404);
    expect(await Follow.countDocuments()).toBe(0);
  });

  it("rejects self follow, prevents duplicate relationships and lists the correct following account", async () => {
    const app = createTestApp();
    await ensureUser(app, "follow_a");
    await ensureUser(app, "follow_b");
    expect((await request(app).post("/api/follow/follow_a").set(getAuthHeaders("follow_a"))).status).toBe(400);
    expect((await request(app).post("/api/follow/follow_b").set(getAuthHeaders("follow_a"))).status).toBe(201);
    const repeated = await request(app).post("/api/follow/follow_b").set(getAuthHeaders("follow_a"));
    expect([400, 409]).toContain(repeated.status);
    expect(await Follow.countDocuments({ userId: "follow_a", followingId: "follow_b" })).toBe(1);
    const stats = await request(app).get("/api/follow/follow_b/stats").set(getAuthHeaders("follow_a"));
    expect(stats.body.data).toMatchObject({ followersCount: 1, followingCount: 0, isFollowing: true });
    const following = await request(app).get("/api/follow/follow_a/following").set(getAuthHeaders("follow_a"));
    expect(following.status).toBe(200);
    expect(following.body.data.map((u: { clerkId: string }) => u.clerkId)).toEqual(["follow_b"]);
  });

  it("uses real follow edges when legacy profile counters are stale", async () => {
    const app = createTestApp();
    await ensureUser(app, "follow_legacy_a");
    await ensureUser(app, "follow_legacy_b");
    await Follow.create({ userId: "follow_legacy_a", followingId: "follow_legacy_b" });
    await User.updateMany({ clerkId: { $in: ["follow_legacy_a", "follow_legacy_b"] } }, { $set: { followersCount: 0, followingCount: 0 } });
    const stats = await request(app).get("/api/follow/follow_legacy_b/stats").set(getAuthHeaders("follow_legacy_a"));
    expect(stats.status).toBe(200);
    expect(stats.body.data).toMatchObject({ followersCount: 1, followingCount: 0, isFollowing: true });
  });

  it("unfollowing updates the counts and relationship", async () => {
    const app = createTestApp();
    await ensureUser(app, "follow_delete_a");
    await ensureUser(app, "follow_delete_b");
    await request(app).post("/api/follow/follow_delete_b").set(getAuthHeaders("follow_delete_a"));
    expect((await request(app).delete("/api/follow/follow_delete_b").set(getAuthHeaders("follow_delete_a"))).status).toBe(200);
    const stats = await request(app).get("/api/follow/follow_delete_b/stats").set(getAuthHeaders("follow_delete_a"));
    expect(stats.body.data).toMatchObject({ followersCount: 0, followingCount: 0, isFollowing: false });
    expect(await Follow.countDocuments()).toBe(0);
  });
});
