import type { Request, Response, NextFunction } from "express";
import { AppError } from "../utils/appError.util.js";
import { logger } from "../utils/logger.util.js";
import { env } from "../config/env.config.js";

export const errorHandler = (
  err: Error | AppError,
  req: Request,
  res: Response,
  _next: NextFunction
) => {
  const isAppError = err instanceof AppError;
  const statusCode = isAppError ? err.statusCode : 500;
  const message = isAppError ? err.message : "Internal server error";

  const userId = req.auth?.userId;
  const requestId =
    req.requestId ||
    (typeof req.headers["x-request-id"] === "string" ? req.headers["x-request-id"] : undefined);

  logger.error(`[${req.method}] ${req.path} - ${err.message}`, {
    stack: err.stack,
    statusCode,
    userId,
    requestId,
  });

  res.status(statusCode).json({
    success: false,
    message,
    ...(requestId && { requestId }),
    // Stack traces only shown when DEBUG_MODE explicitly enabled
    // Never expose stack traces based solely on NODE_ENV
    ...(env.NODE_ENV !== "production" && env.DEBUG_MODE === "true" && { stack: err.stack }),
  });
};
