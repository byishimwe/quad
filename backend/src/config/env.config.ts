import { z } from "zod";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  PORT: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 4000))
    .refine((val) => !isNaN(val), { message: "PORT must be a number" }),
  MONGODB_URI: z.string().min(1, "Missing MongoDB URI"),
  CLERK_PUBLISHABLE_KEY: z.string().min(1, "Missing CLERK_PUBLISHABLE_KEY"),
  CLERK_SECRET_KEY: z.string().min(1, "Missing CLERK_SECRET_KEY"),
  CLERK_WEBHOOK_SECRET: z.string().min(1, "Missing CLERK_WEBHOOK_SECRET"),
  CLOUDINARY_CLOUD_NAME: z.string().min(1, "Missing CLOUDINARY_CLOUD_NAME"),
  CLOUDINARY_API_KEY: z.string().min(1, "Missing CLOUDINARY_API_KEY"),
  CLOUDINARY_API_SECRET: z.string().min(1, "Missing CLOUDINARY_API_SECRET"),
  SKIP_INDEX_CREATION: z.string().optional().default("false"),
  // Production-specific variables
  FRONTEND_URL: z.string().optional(),
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(5).default(0),
  ENABLE_API_DOCS: z.enum(["true", "false"]).default("false"),
  RATE_LIMIT_GENERAL_WINDOW_MS: z.coerce
    .number()
    .int()
    .positive()
    .default(60_000),
  RATE_LIMIT_GENERAL_MAX: z.coerce.number().int().positive().default(500),
  RATE_LIMIT_UPLOAD_WINDOW_MS: z.coerce
    .number()
    .int()
    .positive()
    .default(900_000),
  RATE_LIMIT_UPLOAD_MAX: z.coerce.number().int().positive().default(60),
  RATE_LIMIT_AUTH_WINDOW_MS: z.coerce
    .number()
    .int()
    .positive()
    .default(900_000),
  RATE_LIMIT_AUTH_MAX: z.coerce.number().int().positive().default(10),
  RATE_LIMIT_WRITE_WINDOW_MS: z.coerce
    .number()
    .int()
    .positive()
    .default(60_000),
  RATE_LIMIT_WRITE_MAX: z.coerce.number().int().positive().default(120),
  SERVER_TIMEOUT_MS: z.coerce.number().int().positive().default(300_000),
  UPLOAD_MAX_FILE_SIZE_BYTES: z.coerce
    .number()
    .int()
    .positive()
    .default(52_428_800), // 50 MiB: bounded social video uploads
  IMAGE_MAX_FILE_SIZE_BYTES: z.coerce
    .number()
    .int()
    .positive()
    .default(10485760),
  CLOUDINARY_TIMEOUT_MS: z.coerce.number().int().positive().default(300000), // Default to 5 minutes
  SOCKET_PING_TIMEOUT_MS: z.coerce.number().int().positive().default(60000),
  SOCKET_PING_INTERVAL_MS: z.coerce.number().int().positive().default(25000),
  // Debug mode - enables stack traces in error responses
  // Should only be enabled in development, NEVER in production
  DEBUG_MODE: z.string().optional().default("false"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  // Use console.error here as logger isn't available yet
  console.error("❌ Invalid environment variables:");
  console.error(parsed.error.format());
  process.exit(1);
}

export const env = parsed.data;
