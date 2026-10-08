import request from "supertest";
import express from "express";
import { writeFile, stat, rm } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { createTestApp } from "../utils/testApp.js";
import { UploadedAsset } from "../../models/UploadedAsset.model.js";
import { Story } from "../../models/Story.model.js";
import { Post } from "../../models/Post.model.js";
import { getAuthHeaders } from "../utils/testAuth.js";
import { StoryService } from "../../services/story.service.js";
import { uploadPostMedia } from "../../controllers/upload.controller.js";

const { destroy } = vi.hoisted(() => ({
  destroy: vi.fn(async () => ({ success: true, message: "File deleted successfully" })),
}));
vi.mock("../../utils/upload.util.js", async (importOriginal) => {
  const original = await importOriginal<typeof import("../../utils/upload.util.js")>();
  return { ...original, deleteFromCloudinary: destroy };
});

describe("upload deletion ownership", () => {
  const url = "https://res.cloudinary.com/cloud/image/upload/v1/quad/posts/owned.png";

  it("rejects a different user without deleting the asset", async () => {
    await UploadedAsset.create({ ownerClerkId: "user-a", url, publicId: "quad/posts/owned", resourceType: "image" });
    const response = await request(createTestApp())
      .delete("/api/upload")
      .set("x-test-user-id", "user-b")
      .send({ url });

    expect(response.status).toBe(403);
    expect(destroy).not.toHaveBeenCalled();
    expect(await UploadedAsset.exists({ ownerClerkId: "user-a", url })).toBeTruthy();
  });

  it("rejects a URL for another Cloudinary account", async () => {
    const response = await request(createTestApp())
      .delete("/api/upload")
      .set("x-test-user-id", "user-a")
      .send({ url: url.replace("/cloud/", "/someone-else/") });
    expect(response.status).toBe(400);
    expect(destroy).not.toHaveBeenCalled();
  });

  it("keeps a cover asset while another story still references it", async () => {
    const coverUrl =
      "https://res.cloudinary.com/cloud/image/upload/v1/quad/stories/shared.png";
    const author = {
      clerkId: "user-a",
      username: "shared-cover-author",
      email: "author@example.com",
    };

    await UploadedAsset.create({
      ownerClerkId: "user-a",
      url: coverUrl,
      publicId: "quad/stories/shared",
      resourceType: "image",
    });
    const draft = await Story.create({
      userId: "user-a",
      author,
      title: "Autosaved draft",
      content: "Draft content",
      coverImage: coverUrl,
      status: "draft",
    });
    const published = await Story.create({
      userId: "user-a",
      author,
      title: "Published story",
      content: "Published content",
      coverImage: coverUrl,
      status: "published",
    });

    await StoryService.deleteStory("user-a", String(draft._id));

    expect(destroy).not.toHaveBeenCalled();
    expect(await UploadedAsset.exists({ url: coverUrl })).toBeTruthy();
    await expect(Story.findById(published._id)).resolves.toMatchObject({
      coverImage: coverUrl,
    });
  });


  it("does not let a caller launder another user's media through a post reference", async () => {
    destroy.mockClear();
    const app = createTestApp();
    await UploadedAsset.create({
      ownerClerkId: "user-a",
      url,
      publicId: "quad/posts/owned",
      resourceType: "image",
    });
    await request(app).post("/api/users").set(getAuthHeaders("user-b")).send({});

    // Creating a new post with another user's Quad-hosted upload is forbidden.
    const attached = await request(app)
      .post("/api/posts")
      .set(getAuthHeaders("user-b"))
      .send({ text: "Attempted reuse", media: [{ url, type: "image" }] });
    expect(attached.status).toBe(403);

    // Simulate a pre-existing/legacy content reference from before this fix.
    await Post.create({
      userId: "user-b",
      author: { clerkId: "user-b", username: "user-b", email: "b@example.com" },
      text: "Legacy reference",
      media: [{ url, type: "image" }],
    });

    const deletion = await request(app)
      .delete("/api/upload")
      .set(getAuthHeaders("user-b"))
      .send({ url });

    expect(deletion.status).toBe(403);
    expect(destroy).not.toHaveBeenCalled();
    expect(await UploadedAsset.exists({ ownerClerkId: "user-a", url })).toBeTruthy();
  });

  it("allows an owner to delete their own unattached upload", async () => {
    destroy.mockClear();
    const app = createTestApp();
    await UploadedAsset.create({
      ownerClerkId: "user-a",
      url,
      publicId: "quad/posts/owned",
      resourceType: "image",
    });

    const deletion = await request(app)
      .delete("/api/upload")
      .set(getAuthHeaders("user-a"))
      .send({ url });

    expect(deletion.status).toBe(200);
    expect(destroy).toHaveBeenCalledWith("quad/posts/owned", "image");
    expect(await UploadedAsset.exists({ url })).toBeNull();
  });

  it("rejects another user's Cloudinary media in story covers and poll questions", async () => {
    const app = createTestApp();
    await UploadedAsset.create({
      ownerClerkId: "user-a",
      url,
      publicId: "quad/posts/owned",
      resourceType: "image",
    });
    await request(app).post("/api/users").set(getAuthHeaders("user-b")).send({});

    const story = await request(app)
      .post("/api/stories")
      .set(getAuthHeaders("user-b"))
      .send({ title: "Unauthorized cover", content: "<p>Text</p>", status: "draft", coverImage: url });
    expect(story.status).toBe(403);

    const poll = await request(app)
      .post("/api/polls")
      .set(getAuthHeaders("user-b"))
      .send({
        question: "Unauthorized media?",
        options: [{ text: "Yes" }, { text: "No" }],
        questionMedia: { url, type: "image" },
      });
    expect(poll.status).toBe(403);
  });

  it.each(["invalid ratio", "invalid signature"])("removes rejected video temp files: %s", async (reason) => {
    const path = join(process.cwd(), `.upload-reject-${reason.replace(" ", "-")}-${Date.now()}.mp4`);
    await writeFile(path, Buffer.from("not a video"));
    const app = express();
    app.post("/upload", (req, res) => {
      req.file = {
        path,
        mimetype: "video/mp4",
        size: 11,
      } as Express.Multer.File;
      req.body = { aspectRatio: reason === "invalid ratio" ? "bad" : "1:1" };
      return uploadPostMedia(req, res);
    });
    try {
      const response = await request(app).post("/upload");
      expect(response.status).toBe(400);
      await expect(stat(path)).rejects.toMatchObject({ code: "ENOENT" });
    } finally {
      await rm(path, { force: true });
    }
  });
});
