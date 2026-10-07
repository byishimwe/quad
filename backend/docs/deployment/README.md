# Backend deployment

This package deploys as a long-running Node.js process with HTTP and WebSocket support. Quad does not commit a provider-specific deployment definition; configure these requirements on the host you choose.

## Runtime

- Node.js 24.19.0, matching the repository `.nvmrc`
- Start command: `npm run start` after `npm ci` and `npm run build`
- A persistent MongoDB deployment reachable through `MONGODB_URI`
- HTTPS termination and WebSocket upgrades for Socket.IO
- Clerk and Cloudinary credentials supplied as host-managed secrets

Use [`backend/.env.production.example`](../../.env.production.example) as the configuration template. Set `NODE_ENV=production`, the deployed `FRONTEND_URL`, and the exact `TRUST_PROXY_HOPS` for the trusted proxy chain. Block direct process access when trusting proxy headers. Swagger is disabled in production unless `ENABLE_API_DOCS=true` is deliberately set.

The local filesystem is temporary upload staging only. Cloudinary stores uploaded media; MongoDB stores application and uploaded-asset ownership records. Configure the hosting ingress size and timeout to accommodate the chosen upload limits.

Before deployment, run `npm run check` at the repository root. After deployment, verify `/health`, authentication, an allowed-origin API request, Socket.IO connectivity, uploads, and the Clerk webhook. See the shared [deployment guide](../../../docs/DEPLOYMENT.md), [checklist](../../../docs/DEPLOYMENT_CHECKLIST.md), and [current quality status](../../../docs/QUALITY_STATUS.md).
