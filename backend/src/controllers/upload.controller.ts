import type { Request, Response } from "express";
import { fileTypeFromBuffer } from "file-type";
import { open, readFile, unlink } from "fs/promises";
import { uploadToCloudinary, deleteFromCloudinary, deleteOwnedAssets, extractPublicIdFromUrl, validateFileType, validateFileSize, getValidationRules } from "../utils/upload.util.js";
import { User } from "../models/User.model.js";
import { UploadedAsset } from "../models/UploadedAsset.model.js";
import { clerkClient } from "@clerk/express";
import type { AspectRatio } from "../config/cloudinary.config.js";
import { logger } from "../utils/logger.util.js";
import type { UploadResult } from "../utils/upload.util.js";

async function recordOwnedUpload(req: Request, result: UploadResult): Promise<void> {
  const ownerClerkId = req.auth?.userId;
  if (!ownerClerkId) {
    await deleteFromCloudinary(result.publicId, result.resourceType);
    throw new Error("Upload has no authenticated owner");
  }
  try {
    await UploadedAsset.create({
      ownerClerkId,
      url: result.url,
      publicId: result.publicId,
      resourceType: result.resourceType,
    });
  } catch (error) {
    await deleteFromCloudinary(result.publicId, result.resourceType);
    throw error;
  }
}

interface FileValidationResult {
  valid: boolean;
  detectedMime?: string;
  error?: string;
}

/**
 * Validate file content type by inspecting the actual file bytes
 * This prevents attackers from forging the Content-Type header
 */
async function validateFileContent(
  buffer: Buffer,
  allowedTypes: string[],
): Promise<FileValidationResult> {
  const detected = await fileTypeFromBuffer(buffer);
  if (!detected) {
    return { valid: false, error: "Unable to detect file type from content" };
  }

  if (!allowedTypes.includes(detected.mime)) {
    return {
      valid: false,
      detectedMime: detected.mime,
      error: `File type not allowed. Detected: ${detected.mime}`,
    };
  }

  return { valid: true, detectedMime: detected.mime };
}

/**
 * Read only the signature bytes for a disk-backed video. Images are capped at 10 MiB.
 */
async function getFileBuffer(file: Express.Multer.File): Promise<Buffer> {
  if (file.buffer) {
    return file.buffer;
  }
  if (file.path) {
    if (file.mimetype.startsWith("video/")) {
      const handle = await open(file.path, "r");
      try {
        const header = Buffer.alloc(4100);
        const { bytesRead } = await handle.read(header, 0, header.length, 0);
        return header.subarray(0, bytesRead);
      } finally {
        await handle.close();
      }
    }
    return await readFile(file.path);
  }
  throw new Error("File has no buffer or path");
}

/**
 * Clean up temporary file from disk storage
 * Should be called after file is processed to prevent disk exhaustion
 */
async function cleanupTempFile(file: Express.Multer.File): Promise<void> {
  if (file.path) {
    try {
      await unlink(file.path);
      logger.debug(`Cleaned up temp file: ${file.path}`);
    } catch (error) {
      // Log but don't throw - cleanup failure shouldn't fail the request
      logger.warn(`Failed to clean up temp file: ${file.path}`, error);
    }
  }
}

// =========================
// UPLOAD POST MEDIA (Image or Video)
// =========================
export const uploadPostMedia = async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No file uploaded",
      });
    }

    const { mimetype, size } = req.file;
    const aspectRatio = (req.body.aspectRatio as AspectRatio) || "1:1";

    // Validate aspect ratio
    if (!["1:1", "16:9", "9:16"].includes(aspectRatio)) {
      return res.status(400).json({
        success: false,
        message: "Invalid aspect ratio. Must be 1:1, 16:9, or 9:16",
      });
    }

    // Determine if image or video
    const isVideo = mimetype.startsWith("video/");
    const preset = isVideo ? "POST_VIDEO" : "POST_IMAGE";
    const rules = getValidationRules(preset);

    // Validate file type
    if (!validateFileType(mimetype, rules.allowedTypes)) {
      return res.status(400).json({
        success: false,
        message: "Invalid file type. Only images and videos are allowed",
      });
    }

    // Validate file size
    if (!validateFileSize(size, rules.maxSize)) {
      return res.status(400).json({
        success: false,
        message: `File too large. Maximum size is ${rules.maxSize}MB`,
      });
    }

    // Get file buffer (handles both memory and disk storage)
    const buffer = await getFileBuffer(req.file);

    // Validate actual file content type (prevents forged Content-Type header)
    const contentValidation = await validateFileContent(buffer, rules.allowedTypes);
    if (!contentValidation.valid) {
      return res.status(400).json({
        success: false,
        message: contentValidation.error || "Invalid file content",
        detectedMime: contentValidation.detectedMime,
      });
    }

    // Upload to Cloudinary
    const result = await uploadToCloudinary(isVideo && req.file.path ? req.file.path : buffer, preset);
    await recordOwnedUpload(req, result);

    return res.status(200).json({
      success: true,
      message: `${isVideo ? "Video" : "Image"} uploaded successfully`,
      data: {
        ...result,
        aspectRatio,
      },
    });
  } catch (error: unknown) {
    logger.error("Post media upload error", error);
    return res.status(500).json({
      success: false,
      message: "Failed to upload media",
    });
  } finally {
    if (req.file) await cleanupTempFile(req.file);
  }
};

// =========================
// UPLOAD STORY MEDIA (Image or Video)
// =========================
export const uploadStoryMedia = async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No file uploaded",
      });
    }

    const { mimetype, size } = req.file;
    const aspectRatio = (req.body.aspectRatio as AspectRatio) || "9:16";

    // Validate aspect ratio
    if (!["1:1", "16:9", "9:16"].includes(aspectRatio)) {
      return res.status(400).json({
        success: false,
        message: "Invalid aspect ratio. Must be 1:1, 16:9, or 9:16",
      });
    }

    // Determine if image or video
    const isVideo = mimetype.startsWith("video/");
    const preset = isVideo ? "STORY_VIDEO" : "STORY_IMAGE";
    const rules = getValidationRules(preset);

    // Validate file type
    if (!validateFileType(mimetype, rules.allowedTypes)) {
      return res.status(400).json({
        success: false,
        message: "Invalid file type for story",
      });
    }

    // Validate file size
    if (!validateFileSize(size, rules.maxSize)) {
      return res.status(400).json({
        success: false,
        message: `File too large. Maximum size is ${rules.maxSize}MB`,
      });
    }

    // Get file buffer (handles both memory and disk storage)
    const buffer = await getFileBuffer(req.file);

    // Validate actual file content type (prevents forged Content-Type header)
    const contentValidation = await validateFileContent(buffer, rules.allowedTypes);
    if (!contentValidation.valid) {
      return res.status(400).json({
        success: false,
        message: contentValidation.error || "Invalid file content",
        detectedMime: contentValidation.detectedMime,
      });
    }

    // Upload to Cloudinary
    const result = await uploadToCloudinary(isVideo && req.file.path ? req.file.path : buffer, preset);
    await recordOwnedUpload(req, result);

    return res.status(200).json({
      success: true,
      message: "Story media uploaded successfully",
      data: {
        ...result,
        aspectRatio,
      },
    });
  } catch (error: unknown) {
    logger.error("Story upload error", error);
    return res.status(500).json({
      success: false,
      message: "Failed to upload story",
    });
  } finally {
    if (req.file) await cleanupTempFile(req.file);
  }
};

// =========================
// UPLOAD POLL MEDIA (Image or Video)
// =========================
export const uploadPollMedia = async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No file uploaded",
      });
    }

    const { mimetype, size } = req.file;
    const aspectRatio = (req.body.aspectRatio as AspectRatio) || "1:1";

    // Validate aspect ratio
    if (!["1:1", "16:9", "9:16"].includes(aspectRatio)) {
      return res.status(400).json({
        success: false,
        message: "Invalid aspect ratio. Must be 1:1, 16:9, or 9:16",
      });
    }

    if (mimetype.startsWith("video/")) {
      return res.status(400).json({
        success: false,
        message: "Invalid file type. Only images are allowed for polls",
      });
    }

    const preset = "POLL_IMAGE";
    const rules = getValidationRules(preset);

    // Validate file type
    if (!validateFileType(mimetype, rules.allowedTypes)) {
      return res.status(400).json({
        success: false,
        message: "Invalid file type for poll",
      });
    }

    // Validate file size
    if (!validateFileSize(size, rules.maxSize)) {
      return res.status(400).json({
        success: false,
        message: `File too large. Maximum size is ${rules.maxSize}MB`,
      });
    }

    // Get file buffer (handles both memory and disk storage)
    const buffer = await getFileBuffer(req.file);

    // Validate actual file content type (prevents forged Content-Type header)
    const contentValidation = await validateFileContent(buffer, rules.allowedTypes);
    if (!contentValidation.valid) {
      return res.status(400).json({
        success: false,
        message: contentValidation.error || "Invalid file content",
        detectedMime: contentValidation.detectedMime,
      });
    }

    // Upload to Cloudinary
    const result = await uploadToCloudinary(buffer, preset);
    await recordOwnedUpload(req, result);


    return res.status(200).json({
      success: true,
      message: "Poll media uploaded successfully",
      data: {
        ...result,
        aspectRatio,
      },
    });
  } catch (error: unknown) {
    logger.error("Poll upload error", error);
    return res.status(500).json({
      success: false,
      message: "Failed to upload poll media",
    });
  } finally {
    if (req.file) await cleanupTempFile(req.file);
  }
};

// =========================
// UPLOAD PROFILE IMAGE (Image Only)
// =========================
export const uploadProfileImage = async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No file uploaded",
      });
    }

    const { mimetype, size } = req.file;
    const rules = getValidationRules("PROFILE");

    // Validate file type (images only)
    if (!validateFileType(mimetype, rules.allowedTypes)) {
      return res.status(400).json({
        success: false,
        message: "Invalid file type. Only images are allowed for profiles",
      });
    }

    // Validate file size
    if (!validateFileSize(size, rules.maxSize)) {
      return res.status(400).json({
        success: false,
        message: `File too large. Maximum size is ${rules.maxSize}MB`,
      });
    }

    // Get file buffer (handles both memory and disk storage)
    const buffer = await getFileBuffer(req.file);

    // Validate actual file content type (prevents forged Content-Type header)
    const contentValidation = await validateFileContent(buffer, rules.allowedTypes);
    if (!contentValidation.valid) {
      return res.status(400).json({
        success: false,
        message: contentValidation.error || "Invalid file content",
        detectedMime: contentValidation.detectedMime,
      });
    }

    // Upload to Cloudinary
    const result = await uploadToCloudinary(buffer, "PROFILE");
    await recordOwnedUpload(req, result);

    // Persist new profile image URL to MongoDB for the current user
    const clerkId = req.auth?.userId;
    if (clerkId) {
      try {
        const previous = await User.findOneAndUpdate(
          { clerkId },
          { $set: { profileImage: result.url } },
          { returnDocument: "before" },
        );

        // Optionally sync to Clerk as well so avatars stay consistent
        await clerkClient.users.updateUser(clerkId, {
          imageUrl: result.url,
        } as unknown as Parameters<typeof clerkClient.users.updateUser>[1]);
        if (previous?.profileImage && previous.profileImage !== result.url) {
          await deleteOwnedAssets(clerkId, [previous.profileImage]);
        }
      } catch (persistError) {
        logger.error("Failed to persist profile image URL", persistError);
      }
    }


    return res.status(200).json({
      success: true,
      message: "Profile image uploaded successfully",
      data: {
        ...result,
        aspectRatio: "1:1", // Profile images are always square
      },
    });
  } catch (error: unknown) {
    logger.error("Profile image upload error", error);
    return res.status(500).json({
      success: false,
      message: "Failed to upload profile image",
    });
  } finally {
    if (req.file) await cleanupTempFile(req.file);
  }
};

// =========================
// UPLOAD COVER IMAGE (Image Only)
// =========================
export const uploadCoverImage = async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No file uploaded",
      });
    }

    const { mimetype, size } = req.file;
    const rules = getValidationRules("COVER");

    // Validate file type (images only)
    if (!validateFileType(mimetype, rules.allowedTypes)) {
      return res.status(400).json({
        success: false,
        message: "Invalid file type. Only images are allowed for cover images",
      });
    }

    // Validate file size
    if (!validateFileSize(size, rules.maxSize)) {
      return res.status(400).json({
        success: false,
        message: `File too large. Maximum size is ${rules.maxSize}MB`,
      });
    }

    // Get file buffer (handles both memory and disk storage)
    const buffer = await getFileBuffer(req.file);

    // Validate actual file content type (prevents forged Content-Type header)
    const contentValidation = await validateFileContent(buffer, rules.allowedTypes);
    if (!contentValidation.valid) {
      return res.status(400).json({
        success: false,
        message: contentValidation.error || "Invalid file content",
        detectedMime: contentValidation.detectedMime,
      });
    }

    // Upload to Cloudinary
    const result = await uploadToCloudinary(buffer, "COVER");
    await recordOwnedUpload(req, result);

    // Persist new cover image URL to MongoDB for the current user
    const clerkId = req.auth?.userId;
    if (clerkId) {
      try {
        const previous = await User.findOneAndUpdate(
          { clerkId },
          { $set: { coverImage: result.url } },
          { returnDocument: "before" },
        );
        if (previous?.coverImage && previous.coverImage !== result.url) {
          await deleteOwnedAssets(clerkId, [previous.coverImage]);
        }
      } catch (persistError) {
        logger.error("Failed to persist cover image URL", persistError);
      }
    }


    return res.status(200).json({
      success: true,
      message: "Cover image uploaded successfully",
      data: {
        ...result,
        aspectRatio: "3:1", // Cover images are 3:1 aspect ratio
      },
    });
  } catch (error: unknown) {
    logger.error("Cover image upload error", error);
    return res.status(500).json({
      success: false,
      message: "Failed to upload cover image",
    });
  } finally {
    if (req.file) await cleanupTempFile(req.file);
  }
};

// =========================
// DELETE FILE
// =========================
export const deleteFile = async (req: Request, res: Response) => {
  try {
    const userId = req.auth?.userId;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const { url } = req.body;

    if (!url) {
      return res.status(400).json({
        success: false,
        message: "URL is required",
      });
    }

    // Extract publicId from URL
    const publicId = extractPublicIdFromUrl(url);

    if (!publicId) {
      return res.status(400).json({
        success: false,
        message: "Invalid Cloudinary URL",
      });
    }

    // Only the immutable server-created upload record can authorize deletion.
    // Referencing an asset in a post, story, poll, or profile does not prove ownership.
    const ownedUpload = await UploadedAsset.findOne({
      ownerClerkId: userId,
      url,
      publicId,
    }).select("resourceType").lean();

    if (!ownedUpload) {
      return res.status(403).json({
        success: false,
        message: "You do not have permission to delete this file",
      });
    }

    // Use the trusted upload record, not a client-controlled URL segment.
    const resourceType = ownedUpload.resourceType;

    // Delete from Cloudinary
    const result = await deleteFromCloudinary(publicId, resourceType);

    if (result.success) {
      await UploadedAsset.deleteOne({ ownerClerkId: userId, url, publicId });
      return res.status(200).json({
        success: true,
        message: result.message,
      });
    }

    return res.status(400).json({
      success: false,
      message: "Unable to delete media right now",
    });
  } catch (error: unknown) {
    logger.error("File deletion error", error);
    return res.status(500).json({
      success: false,
      message: "Failed to delete file",
    });
  }
};
