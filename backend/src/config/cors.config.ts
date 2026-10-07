/**
 * CORS Configuration
 * Centralized CORS settings for Express and Socket.IO
 */

import type { CorsOptions } from "cors";
import { env } from "./env.config.js";
import { logger } from "../utils/logger.util.js";
import { AppError } from "../utils/appError.util.js";

/**
 * Get allowed origins based on environment
 */
export function getAllowedOrigins(): string[] {
  if (env.NODE_ENV === "production") {
    if (!env.FRONTEND_URL) {
      logger.warn(
        "FRONTEND_URL not set in production. CORS will block all requests!",
      );
      return [];
    }
    return env.FRONTEND_URL.split(",").map((url) => url.trim());
  }

  // Development: Allow common local development URLs
  return [
    "http://localhost:3000",
    "http://localhost:5173",
    "http://localhost:5174",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:5174",
  ];
}

/**
 * Express CORS options
 */
export function createCorsOptions(
  production: boolean,
  allowedOrigins: string[],
): CorsOptions {
  return {
    origin: (
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void,
    ) => {
      // Origin is absent on legitimate non-browser requests (webhooks, probes, CLI).
      if (!origin) {
        return callback(null, true);
      }

      // In production, strictly check allowed origins
      if (production) {
        if (allowedOrigins.includes(origin)) {
          callback(null, true);
        } else {
          logger.warn(`CORS blocked request from origin: ${origin}`);
          callback(new AppError("Origin not allowed by CORS", 403));
        }
      } else {
        // In development, allow all origins for easier testing
        callback(null, true);
      }
    },
    credentials: true, // Allow cookies and authorization headers
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-Requested-With",
      "Accept",
      "Origin",
      "x-retry-count",
    ],
    exposedHeaders: [
      "X-Total-Count",
      "X-Page-Count",
      "X-RateLimit-Limit",
      "X-RateLimit-Remaining",
      "X-RateLimit-Reset",
    ],
    maxAge: 86400, // 24 hours - how long browsers can cache preflight results
    optionsSuccessStatus: 204, // Some legacy browsers choke on 204
  };
}

export const corsOptions: CorsOptions = createCorsOptions(
  env.NODE_ENV === "production",
  getAllowedOrigins(),
);

/**
 * Socket.IO CORS options
 */
export function getSocketCorsOptions() {
  const allowedOrigins = getAllowedOrigins();

  if (env.NODE_ENV === "production") {
    return {
      origin: allowedOrigins,
      credentials: true,
      methods: ["GET", "POST"],
    };
  }

  // Development: Allow specific local origins (origin: "*" is forbidden with credentials: true)
  return {
    origin: allowedOrigins,
    credentials: true,
    methods: ["GET", "POST"],
  };
}

/**
 * Log CORS configuration on startup
 */
export function logCorsConfig(): void {
  const allowedOrigins = getAllowedOrigins();

  logger.info("CORS Configuration:");
  logger.info(`  Environment: ${env.NODE_ENV}`);
  logger.info(
    `  Allowed Origins: ${
      allowedOrigins.length > 0
        ? allowedOrigins.join(", ")
        : "NONE (will block all requests!)"
    }`,
  );
  logger.info(`  Credentials: enabled`);

  if (env.NODE_ENV === "production" && allowedOrigins.length === 0) {
    logger.error("⚠️  WARNING: No allowed origins configured for production!");
    logger.error("⚠️  Set FRONTEND_URL environment variable to enable CORS.");
  }
}
