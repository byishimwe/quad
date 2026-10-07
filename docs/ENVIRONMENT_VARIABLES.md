# Environment variables

The maintained templates are [`frontend/.env.example`](../frontend/.env.example), [`frontend/.env.production.example`](../frontend/.env.production.example), [`backend/.env.example`](../backend/.env.example), and [`backend/.env.production.example`](../backend/.env.production.example). Copy the relevant example, set real values, and keep `.env` files out of version control.

## Frontend

| Variable | Purpose |
| --- | --- |
| `VITE_CLERK_PUBLISHABLE_KEY` | Public Clerk key for the browser |
| `VITE_API_BASE_URL` | Backend API URL including `/api` |
| `VITE_SOCKET_URL` | Socket.IO server origin |
| `VITE_CLERK_SIGN_IN_URL`, `VITE_CLERK_SIGN_UP_URL` | Auth routes |
| `VITE_UPLOAD_TIMEOUT_MS`, `VITE_API_TIMEOUT_MS` | Client request timeouts |

Only public settings belong in `VITE_` variables; Vite embeds them in the browser bundle.

## Backend

| Variable | Purpose |
| --- | --- |
| `PORT`, `NODE_ENV` | Listener port and runtime mode |
| `MONGODB_URI` | Database connection |
| `CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, `CLERK_WEBHOOK_SECRET` | Authentication and webhook verification |
| `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | Media storage |
| `FRONTEND_URL` | Allowed frontend origin |
| `TRUST_PROXY_HOPS` | Number of trusted reverse proxies; default `0` |
| `ENABLE_API_DOCS` | Opt in to Swagger in production; default `false` |
| `UPLOAD_MAX_FILE_SIZE_BYTES`, `IMAGE_MAX_FILE_SIZE_BYTES` | File limits; defaults 50 MiB and 10 MiB |
| `RATE_LIMIT_*` | Request quota windows and maxima; see the example file |
| `SERVER_TIMEOUT_MS`, `CLOUDINARY_TIMEOUT_MS` | Request and media timeouts |

The example files are the authoritative list for optional settings and defaults. Quad has no Sentry integration; adding a DSN has no effect.
