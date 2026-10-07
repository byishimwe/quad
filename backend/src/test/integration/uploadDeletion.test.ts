import request from "supertest";
import express from "express";
import { writeFile, stat, rm } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { createTestApp } from "../utils/testApp.js";
import { UploadedAsset } from "../../models/UploadedAsset.model.js";
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
