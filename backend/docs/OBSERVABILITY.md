# Observability (Logging, Request IDs, Error Tracking)

This document explains how the backend currently logs requests and handles error tracking.

## Request logging

- Middleware: `backend/src/middlewares/requestLogger.middleware.ts`

Key features:

- Skips `/health`.
- Establishes a request start time and logs on response `finish`.
- Creates/propagates a `requestId`:
  - Uses `x-request-id` header if provided
  - Otherwise generates a UUID
- Attaches `req.requestId` and sets `x-request-id` response header.

Log levels:

- `>= 500`: error
- `>= 400`: warn
- else: info

## Central error handler

- Middleware: `backend/src/middlewares/error.middleware.ts`

Key features:

- Differentiates `AppError` vs unexpected errors.
- Logs:
  - request method/path
  - status
  - userId (from Clerk auth context)
  - requestId
- Captures unexpected errors via `errorTracker`.

## Error tracking

- Utility: `backend/src/utils/errorTracking.util.ts`

Behavior:

- Errors are captured when:
  - error is not an `AppError`, or
  - status code is `>= 500`

The current error tracker writes to application logs. There is no active Sentry integration or DSN setting.

## Correlating logs

Use `x-request-id` to correlate:

- frontend requests
- backend logs
- backend error responses
