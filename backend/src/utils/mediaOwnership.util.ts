import { env } from "../config/env.config.js";
import { UploadedAsset } from "../models/UploadedAsset.model.js";
import { AppError } from "./appError.util.js";

/**
 * Only Quad's own Cloudinary assets need attachment authorization.
 * External image URLs remain supported; they never grant Cloudinary delete rights.
 */
function isQuadCloudinaryUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return (
      parsed.protocol === "https:" &&
      parsed.hostname === "res.cloudinary.com" &&
      parsed.pathname.startsWith(`/${env.CLOUDINARY_CLOUD_NAME}/`)
    );
  } catch {
    return false;
  }
}

/**
 * Validate newly attached managed-media URLs against upload records written by
 * the server after a successful upload. Never infer ownership from references
 * in content created by the caller.
 */
export async function assertOwnedUploadedMedia(
  ownerClerkId: string,
  urls: readonly string[],
): Promise<void> {
  const managedUrls = [...new Set(urls.filter(isQuadCloudinaryUrl))];
  if (managedUrls.length === 0) return;

  const uploads = await UploadedAsset.find({
    ownerClerkId,
    url: { $in: managedUrls },
  })
    .select("url")
    .lean();

  const ownedUrls = new Set(uploads.map((upload) => upload.url));
  if (managedUrls.some((url) => !ownedUrls.has(url))) {
    throw new AppError("You can only attach media uploaded by your account", 403);
  }
}
