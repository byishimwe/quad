import cloudinary, { UPLOAD_PRESETS } from "../config/cloudinary.config.js";
import { env } from "../config/env.config.js";
import { logger } from "./logger.util.js";
import { Readable } from "stream";
import { createReadStream } from "fs";
import { UploadedAsset } from "../models/UploadedAsset.model.js";
import type {
  UploadApiErrorResponse,
  UploadApiResponse,
  UploadResponseCallback,
} from "cloudinary";

// Upload result interface
export interface UploadResult {
  url: string;
  publicId: string;
  format: string;
  width: number;
  height: number;
  size: number;
  resourceType: "image" | "video";
  thumbnail?: string; // For videos
}

// Upload options type
type UploadPresetType = keyof typeof UPLOAD_PRESETS;

/**
 * Upload file buffer to Cloudinary
 */
export const uploadToCloudinary = async (
  source: Buffer | string,
  preset: UploadPresetType = "POST_IMAGE",
): Promise<UploadResult> => {
  return new Promise((resolve, reject) => {
    const uploadOptions = UPLOAD_PRESETS[preset];

    const isVideo = uploadOptions.resource_type === "video";

    const handleUploadResult: UploadResponseCallback = (
      error?: UploadApiErrorResponse,
      result?: UploadApiResponse,
    ) => {
      if (error) {
        return reject(new Error(`Cloudinary upload failed: ${error.message}`));
      }

      if (!result) {
        return reject(new Error("Upload failed: No result returned"));
      }

      const uploadResult: UploadResult = {
        url: result.secure_url,
        publicId: result.public_id,
        format: result.format,
        width: result.width,
        height: result.height,
        size: result.bytes,
        resourceType: result.resource_type as "image" | "video",
      };

      // Generate thumbnail for videos
      if (result.resource_type === "video") {
        uploadResult.thumbnail = cloudinary.url(result.public_id, {
          resource_type: "video",
          transformation: [
            { width: 400, height: 300, crop: "fill" },
            { start_offset: "1" },
          ],
          format: "jpg",
        });
      }

      resolve(uploadResult);
    };

    // Create upload stream
    const uploadStream = isVideo
      ? cloudinary.uploader.upload_chunked_stream(
          {
            folder: uploadOptions.folder,
            resource_type: uploadOptions.resource_type,
            eager: uploadOptions.transformation,
            eager_async: true,
            chunk_size: 20_000_000, // 20MB chunks
            timeout: env.CLOUDINARY_TIMEOUT_MS,
          },
          handleUploadResult,
        )
      : cloudinary.uploader.upload_stream(
          {
            folder: uploadOptions.folder,
            resource_type: uploadOptions.resource_type,
            transformation: uploadOptions.transformation,
            timeout: env.CLOUDINARY_TIMEOUT_MS,
          },
          handleUploadResult,
        );

    // Convert buffer to stream and pipe to Cloudinary
    const input = typeof source === "string" ? createReadStream(source) : Readable.from(source);
    input.on("error", reject);
    uploadStream.on("error", reject);
    input.pipe(uploadStream);
  });
};

/**
 * Upload multiple files to Cloudinary
 */
export const uploadMultipleToCloudinary = async (
  fileBuffers: Buffer[],
  preset: UploadPresetType = "POST_IMAGE",
): Promise<UploadResult[]> => {
  try {
    const uploadPromises = fileBuffers.map((buffer) =>
      uploadToCloudinary(buffer, preset),
    );
    return await Promise.all(uploadPromises);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    throw new Error(`Multiple upload failed: ${message}`);
  }
};

/**
 * Delete file from Cloudinary
 */
export const deleteFromCloudinary = async (
  publicId: string,
  resourceType: "image" | "video" = "image",
): Promise<{ success: boolean; message: string }> => {
  try {
    const result = await cloudinary.uploader.destroy(publicId, {
      resource_type: resourceType,
      invalidate: true, // Invalidate CDN cache
    });

    if (result.result === "ok" || result.result === "not found") {
      return {
        success: true,
        message:
          result.result === "ok"
            ? "File deleted successfully"
            : "File not found",
      };
    }

    return {
      success: false,
      message: "Deletion failed",
    };
  } catch (error: unknown) {
    logger.error("Cloudinary delete error", error);
    return {
      success: false,
      message: "Failed to delete file",
    };
  }
};

/**
 * Delete multiple files from Cloudinary
 */
export const deleteMultipleFromCloudinary = async (
  publicIds: string[],
  resourceType: "image" | "video" = "image",
): Promise<{ success: boolean; deleted: string[]; failed: string[] }> => {
  const results = await Promise.allSettled(
    publicIds.map((id) => deleteFromCloudinary(id, resourceType)),
  );

  const deleted: string[] = [];
  const failed: string[] = [];

  results.forEach((result, index) => {
    const publicId = publicIds[index];
    if (publicId) {
      if (result.status === "fulfilled" && result.value.success) {
        deleted.push(publicId);
      } else {
        failed.push(publicId);
      }
    }
  });

  return {
    success: failed.length === 0,
    deleted,
    failed,
  };
};

/** Delete assets recorded as uploaded by this user; retain failed records for retry. */
export async function deleteOwnedAssets(ownerClerkId: string, urls?: string[]): Promise<number> {
  const assets = await UploadedAsset.find({
    ownerClerkId,
    ...(urls ? { url: { $in: urls } } : {}),
  }).lean();
  let failures = 0;
  for (const asset of assets) {
    const result = await deleteFromCloudinary(asset.publicId, asset.resourceType);
    if (result.success) await UploadedAsset.deleteOne({ _id: asset._id });
    else {
      failures++;
      logger.warn("Owned media cleanup failed", { publicId: asset.publicId, ownerClerkId });
    }
  }
  return failures;
}

/**
 * Extract publicId from Cloudinary URL
 */
export const extractPublicIdFromUrl = (url: string): string | null => {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" || parsed.hostname !== "res.cloudinary.com" || parsed.search || parsed.hash) return null;
    const parts = parsed.pathname.split("/").filter(Boolean);
    if (parts[0] !== env.CLOUDINARY_CLOUD_NAME || !["image", "video"].includes(parts[1] ?? "") || parts[2] !== "upload") return null;
    const rest = parts.slice(3);
    if (/^v\d+$/.test(rest[0] || "")) rest.shift();
    if (rest[0] !== "quad" || !["posts", "stories", "polls", "profiles", "covers"].includes(rest[1] ?? "") || rest.length < 3) return null;
    if (rest.some((part) => part === "." || part === "..")) return null;
    const filename = rest.pop()!;
    if (!/\.[a-zA-Z0-9]+$/.test(filename)) return null;
    rest.push(filename.replace(/\.[a-zA-Z0-9]+$/, ""));
    return rest.join("/");
  } catch {
    return null;
  }
};

/**
 * Validate file type
 */
export const validateFileType = (
  mimetype: string,
  allowedTypes: string[],
): boolean => {
  return allowedTypes.includes(mimetype.toLowerCase().trim());
};

/**
 * Validate file size
 */
export const validateFileSize = (size: number, maxSizeMB: number): boolean => {
  const maxSizeBytes = maxSizeMB * 1024 * 1024;
  return size <= maxSizeBytes;
};

/**
 * Get file validation rules
 */
export const getValidationRules = (preset: UploadPresetType) => {
  const imageTypes = [
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
    "image/gif",
    "image/heic",
  ];
  const videoTypes = [
    "video/mp4",
    "video/quicktime",
    "video/x-msvideo",
    "video/x-matroska",
    "video/webm",
  ];

  const rules = {
    POST_IMAGE: {
      maxSize: 10, // 10MB
      allowedTypes: imageTypes,
    },
    POST_VIDEO: {
      maxSize: env.UPLOAD_MAX_FILE_SIZE_BYTES / 1024 / 1024,
      allowedTypes: videoTypes,
    },
    STORY_IMAGE: {
      maxSize: 10, // 10MB
      allowedTypes: imageTypes,
    },
    STORY_VIDEO: {
      maxSize: env.UPLOAD_MAX_FILE_SIZE_BYTES / 1024 / 1024,
      allowedTypes: videoTypes,
    },
    POLL_IMAGE: {
      maxSize: 10, // 10MB
      allowedTypes: imageTypes,
    },
    PROFILE: {
      maxSize: 10, // 10MB
      allowedTypes: imageTypes,
    },
    COVER: {
      maxSize: 10, // 10MB
      allowedTypes: imageTypes,
    },
  };

  return rules[preset];
};
