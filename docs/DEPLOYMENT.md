# Deployment

Quad deploys as a static Vite frontend and a long-running Node.js API with Socket.IO. The frontend demo is at [joinquad.vercel.app](https://joinquad.vercel.app). These steps describe a deployment option; they do not assert that a particular backend provider is currently in use.

## Prerequisites

- Node.js 24.19.0 and npm; run `npm run setup` and `npm run check` before deployment.
- MongoDB reachable from the API, a Clerk application, and a Cloudinary account.
- HTTPS public URLs for the frontend and API; the host must support WebSocket upgrades.

## Backend

Build with `npm --prefix backend run build`, then run `npm --prefix backend run start` from the repository root. Set the backend variables documented in [environment variables](ENVIRONMENT_VARIABLES.md), especially `MONGODB_URI`, Clerk credentials and webhook secret, Cloudinary credentials, and `FRONTEND_URL`. The API listens on `PORT` (default 4000). Configure the Clerk webhook to reach the public `/api/webhooks/clerk` endpoint, using the route shown in the source when setting up a new environment.

Set `NODE_ENV=production`. Leave `ENABLE_API_DOCS=false` unless public Swagger access is intentionally required. Set `TRUST_PROXY_HOPS` to the exact count of trusted reverse proxies; leave it `0` when directly exposed. A nonzero setting requires blocking direct access to the Node process so clients cannot supply spoofed forwarding headers.

The upload limit defaults to 50 MiB for video and 10 MiB for images. Ensure the hosting ingress accepts the desired request size and timeout. Use persistent MongoDB and Cloudinary storage; the API's local upload directory is temporary.

## Frontend

Set `VITE_CLERK_PUBLISHABLE_KEY`, `VITE_API_BASE_URL` (include `/api`), and `VITE_SOCKET_URL` before `npm --prefix frontend run build`. Serve `frontend/dist/` with HTTPS and an SPA fallback to `index.html`. Do not place Clerk secret keys or Cloudinary secrets in `VITE_` variables. Ensure the frontend URL matches the backend `FRONTEND_URL` allowlist and Clerk's authorized URLs.

## Verify after deployment

Check the API health endpoint and browser console; sign in, load feeds and a profile, upload supported image and video formats, send a chat message, and receive a notification. Verify WebSocket transport, allowed-origin requests, mobile layout, theme choices, and service worker registration. Run the [manual checklist](MANUAL_TESTING_CHECKLIST.md) in the deployed environment. Current automated results and gaps are in [quality status](QUALITY_STATUS.md).
