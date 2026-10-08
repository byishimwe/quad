import { endpoints } from "@/lib/api";
import type { ApiUploadResponse } from "@/types/api";
import { compressImage, getCompressionSettings } from "@/lib/imageCompression";

type RawUploadResponse = {
  url?: string;
  secure_url?: string;
  publicId?: string;
  public_id?: string;
  width?: number;
  height?: number;
  format?: string;
  bytes?: number;
  size?: number;
};

export class UploadService {
  private static normalizeUploadResponse(raw: unknown): ApiUploadResponse {
    if (!raw || typeof raw !== "object") {
      throw new Error("Upload failed: Invalid response shape");
    }

    const data = raw as RawUploadResponse;
    const url = data.url || data.secure_url;
    if (!url) {
      throw new Error("Upload failed: Missing URL in response");
    }

    return {
      url,
      publicId: data.publicId || data.public_id || "",
      width: data.width,
      height: data.height,
      format: data.format,
      bytes: data.bytes ?? data.size,
    };
  }

  // Upload profile image
  static async uploadProfileImage(
    file: File,
    onProgress?: (progress: number) => void
  ): Promise<ApiUploadResponse> {
    // Compress image before upload
    const compressedFile = file.type.startsWith("image/")
      ? await compressImage(file, getCompressionSettings("profile"))
      : file;

    if (onProgress) onProgress(10); // Compression complete

    const response = await endpoints.upload.profile(compressedFile);
    if (onProgress) onProgress(100);

    const raw = response.data?.data ?? response.data;
    return this.normalizeUploadResponse(raw);
  }

  // Upload cover image
  static async uploadCoverImage(
    file: File,
    onProgress?: (progress: number) => void
  ): Promise<ApiUploadResponse> {
    // Compress image before upload
    const compressedFile = file.type.startsWith("image/")
      ? await compressImage(file, getCompressionSettings("cover"))
      : file;

    if (onProgress) onProgress(10);

    const response = await endpoints.upload.cover(compressedFile);
    if (onProgress) onProgress(100);

    const raw = response.data?.data ?? response.data;
    return this.normalizeUploadResponse(raw);
  }

  // Upload post media
  static async uploadPostMedia(
    file: File,
    onProgress: ((progress: number) => void) | undefined = undefined,
    signal?: AbortSignal,
  ): Promise<ApiUploadResponse> {
    // Compress image before upload
    const compressedFile = file.type.startsWith("image/")
      ? await compressImage(file, getCompressionSettings("post"))
      : file;

    if (onProgress) onProgress(10);

    const response = await endpoints.upload.post(compressedFile, signal);
    if (onProgress) onProgress(100);

    const raw = response.data?.data ?? response.data;
    return this.normalizeUploadResponse(raw);
  }

  // Upload story media
  static async uploadStoryMedia(
    file: File,
    onProgress?: (progress: number) => void
  ): Promise<ApiUploadResponse> {
    // Compress image before upload
    const compressedFile = file.type.startsWith("image/")
      ? await compressImage(file, getCompressionSettings("story"))
      : file;

    if (onProgress) onProgress(10);

    const response = await endpoints.upload.story(compressedFile);
    if (onProgress) onProgress(100);

    const raw = response.data?.data ?? response.data;
    return this.normalizeUploadResponse(raw);
  }

  // Upload poll media
  static async uploadPollMedia(
    file: File,
    onProgress?: (progress: number) => void
  ): Promise<ApiUploadResponse> {
    if (!file.type.startsWith("image/")) {
      throw new Error("Only images are allowed for polls");
    }
    // Compress image before upload
    const compressedFile = file.type.startsWith("image/")
      ? await compressImage(file, getCompressionSettings("post"))
      : file;

    if (onProgress) onProgress(10);

    const response = await endpoints.upload.poll(compressedFile);
    if (onProgress) onProgress(100);

    const raw = response.data?.data ?? response.data;
    return this.normalizeUploadResponse(raw);
  }

  // Delete uploaded file
  static async deleteFile(url: string): Promise<{ success: boolean }> {
    const response = await endpoints.upload.delete(url);
    return response.data;
  }

  // Batch upload multiple files
  static async batchUpload(
    files: File[],
    type: "post" | "story" | "poll"
  ): Promise<{ succeeded: ApiUploadResponse[]; failed: File[] }> {
    const uploadFn = {
      post: this.uploadPostMedia,
      story: this.uploadStoryMedia,
      poll: this.uploadPollMedia,
    }[type];

    const results = await Promise.allSettled(
      files.map((file) => uploadFn(file))
    );

    const succeeded: ApiUploadResponse[] = [];
    const failed: File[] = [];

    results.forEach((result, index) => {
      if (result.status === "fulfilled") {
        succeeded.push(result.value);
      } else {
        failed.push(files[index]);
      }
    });

    return { succeeded, failed };
  }

  // Get optimal image dimensions for different upload types
  static getOptimalDimensions(type: "profile" | "cover" | "post" | "story"): {
    width: number;
    height: number;
    aspectRatio: string;
  } {
    const dimensions = {
      profile: { width: 400, height: 400, aspectRatio: "1:1" },
      cover: { width: 1200, height: 400, aspectRatio: "3:1" },
      post: { width: 1080, height: 1080, aspectRatio: "1:1" },
      story: { width: 1080, height: 1920, aspectRatio: "9:16" },
    };

    return dimensions[type];
  }

  // Validate file before upload
  static validateFile(
    file: File,
    type: "image" | "video" | "any" = "any"
  ): {
    valid: boolean;
    error?: string;
  } {
    const maxSizes = {
      image: 10 * 1024 * 1024, // 10MB
      video: 50 * 1024 * 1024, // Matches backend's 50 MiB default
      profileImage: 10 * 1024 * 1024, // 10MB
      coverImage: 10 * 1024 * 1024, // 10MB
    };

    const imageTypes = [
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/gif",
      "image/heic",
    ];
    const videoTypes = [
      "video/mp4",
      "video/mov",
      "video/avi",
      "video/mkv",
      "video/webm",
    ];

    // Check file type
    if (type === "image" && !imageTypes.includes(file.type)) {
      return {
        valid: false,
        error:
          "Invalid image format. Please use JPEG, PNG, WebP, GIF, or HEIC.",
      };
    }

    if (type === "video" && !videoTypes.includes(file.type)) {
      return {
        valid: false,
        error: "Invalid video format. Please use MP4, MOV, AVI, MKV, or WebM.",
      };
    }

    if (type === "any" && ![...imageTypes, ...videoTypes].includes(file.type)) {
      return {
        valid: false,
        error:
          "Invalid file format. Please use a supported image or video format.",
      };
    }

    // Check file size
    let maxSize: number;
    let sizeLabel: string;

    if (file.type.startsWith("video/")) {
      maxSize = maxSizes.video;
      sizeLabel = "50MB";
    } else {
      maxSize = maxSizes.image;
      sizeLabel = "10MB";
    }

    if (file.size > maxSize) {
      return {
        valid: false,
        error: `File size too large. Maximum size is ${sizeLabel}.`,
      };
    }

    return { valid: true };
  }
}
