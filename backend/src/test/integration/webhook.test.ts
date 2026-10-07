import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createTestApp } from "../utils/testApp.js";
import { User } from "../../models/User.model.js";
import { Post } from "../../models/Post.model.js";
import { Story } from "../../models/Story.model.js";
import { Poll } from "../../models/Poll.model.js";

const { deleteOwnedAssets } = vi.hoisted(() => ({
  deleteOwnedAssets: vi.fn(async () => 0),
}));

vi.mock("../../utils/upload.util.js", async (importOriginal) => {
  const original = await importOriginal<
    typeof import("../../utils/upload.util.js")
  >();
  return { ...original, deleteOwnedAssets };
});

const sendWebhook = async (payload: unknown, headers?: Record<string, string>) => {
  const app = createTestApp();
  const body = JSON.stringify(payload as Record<string, unknown>);

  const req = request(app)
    .post("/api/webhooks/clerk")
    .set("Content-Type", "application/json")
    .send(body);

  if (headers) {
    for (const [k, v] of Object.entries(headers)) {
      req.set(k, v);
    }
  }

  return req;
};

describe("Webhook API", () => {
  beforeEach(() => {
    deleteOwnedAssets.mockReset();
    deleteOwnedAssets.mockResolvedValue(0);
  });

  it("accepts user.created and creates user", async () => {
    const payload = {
      type: "user.created",
      data: {
        id: "wh_user_1",
        username: "whuser",
        email_addresses: [{ email_address: "wh_user_1@example.com" }],
        image_url: "https://example.com/a.png",
        first_name: "Web",
        last_name: "Hook",
      },
    };

    const res = await sendWebhook(payload);

    expect(res.status).toBe(200);
    expect(res.body?.success).toBe(true);

    const app = createTestApp();
    const getRes = await request(app)
      .get("/api/users/wh_user_1")
      .set({ "x-test-user-id": "wh_user_1" });

    expect(getRes.status).toBe(200);
    expect(getRes.body?.data?.clerkId).toBe("wh_user_1");
  });

  it("accepts user.updated and updates user", async () => {
    const created = {
      type: "user.created",
      data: {
        id: "wh_user_2",
        username: "whuser2",
        email_addresses: [{ email_address: "wh_user_2@example.com" }],
        image_url: "https://example.com/a.png",
        first_name: "A",
        last_name: "B",
      },
    };

    await sendWebhook(created);

    const updated = {
      type: "user.updated",
      data: {
        id: "wh_user_2",
        username: "whuser2_new",
        email_addresses: [{ email_address: "wh_user_2@example.com" }],
        image_url: "https://example.com/b.png",
        first_name: "New",
        last_name: "Name",
      },
    };

    const res = await sendWebhook(updated);
    expect(res.status).toBe(200);

    const app = createTestApp();
    const getRes = await request(app)
      .get("/api/users/wh_user_2")
      .set({ "x-test-user-id": "wh_user_2" });

    expect(getRes.status).toBe(200);
    expect(getRes.body?.data?.username).toBe("whuser2_new");
  });

  it("accepts user.deleted and deletes user", async () => {
    const created = {
      type: "user.created",
      data: {
        id: "wh_user_3",
        username: "whuser3",
        email_addresses: [{ email_address: "wh_user_3@example.com" }],
        image_url: "https://example.com/a.png",
      },
    };

    await sendWebhook(created);

    const deleted = {
      type: "user.deleted",
      data: {
        id: "wh_user_3",
      },
    };

    const res = await sendWebhook(deleted);
    expect(res.status).toBe(200);

    const app = createTestApp();
    const getRes = await request(app)
      .get("/api/users/wh_user_3")
      .set({ "x-test-user-id": "wh_user_3" });

    expect(getRes.status).toBe(404);
  });

  it("removes account references before cleaning up owned media", async () => {
    const userId = "wh_cleanup_order";
    const mediaUrl =
      "https://res.cloudinary.com/cloud/image/upload/v1/quad/stories/account.png";
    const author = {
      clerkId: userId,
      username: "cleanup-order",
      email: "cleanup@example.com",
    };

    await User.create({ ...author });
    await Post.create({ userId, author, text: "Post", media: [] });
    await Story.create({
      userId,
      author,
      title: "Story",
      content: "Story content",
      coverImage: mediaUrl,
      status: "published",
    });
    await Poll.create({
      author,
      question: "Is cleanup ordered correctly?",
      questionMedia: { url: mediaUrl, type: "image" },
      options: [
        { text: "Yes", votesCount: 0 },
        { text: "No", votesCount: 0 },
      ],
      settings: { anonymousVoting: false },
      status: "active",
      totalVotes: 0,
      reactionsCount: 0,
    });

    deleteOwnedAssets.mockImplementationOnce(async () => {
      const references = await Promise.all([
        User.exists({ clerkId: userId }),
        Post.exists({ "author.clerkId": userId }),
        Story.exists({ "author.clerkId": userId }),
        Poll.exists({ "author.clerkId": userId }),
      ]);
      expect(references.every((reference) => reference === null)).toBe(true);
      return 0;
    });

    const response = await sendWebhook({
      type: "user.deleted",
      data: { id: userId },
    });

    expect(response.status).toBe(200);
    expect(deleteOwnedAssets).toHaveBeenCalledWith(userId);
  });

  it("returns an error so failed account media cleanup can be retried", async () => {
    const userId = "wh_cleanup_retry";
    await User.create({
      clerkId: userId,
      username: "cleanup-retry",
      email: "cleanup-retry@example.com",
    });
    const payload = { type: "user.deleted", data: { id: userId } };

    deleteOwnedAssets.mockResolvedValueOnce(1).mockResolvedValueOnce(0);

    const failed = await sendWebhook(payload);
    expect(failed.status).toBe(500);
    expect(await User.exists({ clerkId: userId })).toBeNull();

    const retried = await sendWebhook(payload);
    expect(retried.status).toBe(200);
    expect(deleteOwnedAssets).toHaveBeenCalledTimes(2);
  });

  it("rejects invalid signature", async () => {
    const payload = {
      type: "user.created",
      data: {
        id: "wh_user_4",
        username: "whuser4",
        email_addresses: [{ email_address: "wh_user_4@example.com" }],
        image_url: "https://example.com/a.png",
      },
    };

    const res = await sendWebhook(payload, { "x-test-invalid-signature": "1" });

    expect(res.status).toBe(400);
    expect(res.body?.error).toBe("Invalid webhook signature");
    expect(res.body?.details).toBeUndefined();
  });

  it("accepts repeated user.created delivery without duplicating the user", async () => {
    const payload = {
      type: "user.created",
      data: { id: "wh_repeat", username: "repeat", email_addresses: [{ email_address: "repeat@example.com" }] },
    };
    expect((await sendWebhook(payload)).status).toBe(200);
    expect((await sendWebhook(payload)).status).toBe(200);
    expect(await User.countDocuments({ clerkId: "wh_repeat" })).toBe(1);
  });

  it("gives a second user a unique username when Clerk names collide", async () => {
    const first = { type: "user.created", data: { id: "wh_first", username: "shared", email_addresses: [{ email_address: "first@example.com" }] } };
    const second = { type: "user.created", data: { id: "wh_second", username: "shared", email_addresses: [{ email_address: "second@example.com" }] } };
    expect((await sendWebhook(first)).status).toBe(200);
    expect((await sendWebhook(second)).status).toBe(200);
    const users = await User.find({ clerkId: { $in: ["wh_first", "wh_second"] } }).lean();
    expect(new Set(users.map((user) => user.username)).size).toBe(2);
  });
});
