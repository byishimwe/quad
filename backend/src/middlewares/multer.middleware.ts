import multer from "multer";
import os from "os";
import type { Request } from "express";
import { env } from "../config/env.config.js";

// Shared file type constants
const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/heic",
];

const ALLOWED_VIDEO_TYPES = [
  "video/mp4",
  "video/quicktime", // .mov
  "video/x-msvideo", // .avi
  "video/x-matroska", // .mkv
  "video/webm",
];

const ALLOWED_ALL_TYPES = [...ALLOWED_IMAGE_TYPES, ...ALLOWED_VIDEO_TYPES];

// Store files in memory as buffers (for small images)
const memoryStorage = multer.memoryStorage();

// Store large files on disk (for videos to prevent memory exhaustion)
const diskStorage = multer.diskStorage({
  destination: os.tmpdir(),
  filename: (_req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${uniqueSuffix}-${file.originalname}`);
  },
});

// File filter function
const fileFilter = (
  req: Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback,
) => {
  if (ALLOWED_ALL_TYPES.includes(file.mimetype)) {
    cb(null, true); // Accept file
  } else {
    cb(
      new Error(
        `Invalid file type. Allowed: images (JPEG, PNG, WebP, GIF, HEIC) and videos (MP4, MOV, AVI, MKV, WebM)`,
      ),
    );
  }
};

// Multer config for single file upload - use disk storage to prevent memory exhaustion
// The upload controller's getFileBuffer handles both memory and disk storage
export const uploadSingle = multer({
  storage: diskStorage,
  fileFilter,
  limits: {
    fileSize: env.UPLOAD_MAX_FILE_SIZE_BYTES,
  },
}).single("file");

// Multer config for multiple files upload (max 10 files)
// Uses diskStorage instead of memoryStorage to prevent memory exhaustion
// Files are written to disk, with a bounded limit from environment config.
export const uploadMultiple = multer({
  storage: diskStorage,
  fileFilter,
  limits: {
    fileSize: env.UPLOAD_MAX_FILE_SIZE_BYTES,
    files: 10,
  },
}).array("files", 10);

// Image-only upload
export const uploadImage = multer({
  storage: memoryStorage,
  fileFilter: (req, file, cb) => {
    if (ALLOWED_IMAGE_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed (JPEG, PNG, WebP, GIF, HEIC)"));
    }
  },
  limits: {
    fileSize: env.IMAGE_MAX_FILE_SIZE_BYTES,
  },
}).single("image");

// Video-only upload - use disk storage to prevent memory exhaustion
export const uploadVideo = multer({
  storage: diskStorage,
  fileFilter: (req, file, cb) => {
    if (ALLOWED_VIDEO_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only video files are allowed (MP4, MOV, AVI, MKV, WebM)"));
    }
  },
  limits: {
    fileSize: env.UPLOAD_MAX_FILE_SIZE_BYTES,
  },
}).single("video");

// Multiple images upload
export const uploadImages = multer({
  storage: memoryStorage,
  fileFilter: (req, file, cb) => {
    if (ALLOWED_IMAGE_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed"));
    }
  },
  limits: {
    fileSize: env.IMAGE_MAX_FILE_SIZE_BYTES,
    files: 10,
  },
}).array("images", 10);
