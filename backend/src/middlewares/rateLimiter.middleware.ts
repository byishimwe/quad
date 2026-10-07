/**
 * Rate limiting middleware to prevent abuse and DoS attacks
 */
import rateLimit from "express-rate-limit";
import type { Request, Response, NextFunction } from "express";
import { logger } from "../utils/logger.util.js";

import { env } from "../config/env.config.js";

const generalRetryAfterSeconds = Math.ceil(env.RATE_LIMIT_GENERAL_WINDOW_MS / 1000);
const uploadRetryAfterSeconds = Math.ceil(env.RATE_LIMIT_UPLOAD_WINDOW_MS / 1000);
const authRetryAfterSeconds = Math.ceil(env.RATE_LIMIT_AUTH_WINDOW_MS / 1000);
const writeRetryAfterSeconds = Math.ceil(env.RATE_LIMIT_WRITE_WINDOW_MS / 1000);

/**
 * General rate limiter for all API endpoints
 */
export const generalRateLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_GENERAL_WINDOW_MS,
  max:
    env.NODE_ENV === "development" ? 1000000 : env.RATE_LIMIT_GENERAL_MAX, // Higher limit in development
  message: {
    success: false,
    message: "Too many requests from this IP, please try again later.",
    retryAfter: generalRetryAfterSeconds,
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  handler: (req: Request, res: Response) => {
    logger.warn(`Rate limit exceeded for IP: ${req.ip} on ${req.path}`);
    res.status(429).json({
      success: false,
      message: "Too many requests from this IP, please try again later.",
      retryAfter: generalRetryAfterSeconds,
    });
  },
});

/**
 * Upload rate limiter for file upload endpoints
 */
export const uploadRateLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_UPLOAD_WINDOW_MS,
  max: env.RATE_LIMIT_UPLOAD_MAX,
  message: {
    success: false,
    message: "Too many upload requests, please wait before uploading again.",
    retryAfter: uploadRetryAfterSeconds,
  },
  handler: (req: Request, res: Response) => {
    logger.warn(`Upload rate limit exceeded for IP: ${req.ip} on ${req.path}`);
    res.status(429).json({
      success: false,
      message: "Too many upload requests, please wait before uploading again.",
      retryAfter: uploadRetryAfterSeconds,
    });
  },
});

/**
 * Authentication rate limiter for auth-related endpoints
 */
export const authRateLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_AUTH_WINDOW_MS,
  max: env.RATE_LIMIT_AUTH_MAX,
  message: {
    success: false,
    message: "Too many authentication attempts, please try again later.",
    retryAfter: authRetryAfterSeconds,
  },
  handler: (req: Request, res: Response) => {
    logger.warn(`Auth rate limit exceeded for IP: ${req.ip} on ${req.path}`);
    res.status(429).json({
      success: false,
      message: "Too many authentication attempts, please try again later.",
      retryAfter: authRetryAfterSeconds,
    });
  },
});

/**
 * Strict rate limiter for write operations (create, update, delete)
 */
export const writeRateLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WRITE_WINDOW_MS,
  max: env.RATE_LIMIT_WRITE_MAX,
  message: {
    success: false,
    message: "Too many write operations, please slow down.",
    retryAfter: writeRetryAfterSeconds,
  },
  handler: (req: Request, res: Response) => {
    logger.warn(`Write rate limit exceeded for IP: ${req.ip} on ${req.path}`);
    res.status(429).json({
      success: false,
      message: "Too many write operations, please slow down.",
      retryAfter: writeRetryAfterSeconds,
    });
  },
});

export function limitWrites(req: Request, res: Response, next: NextFunction) {
  if (["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) {
    return writeRateLimiter(req, res, next);
  }
  next();
}
