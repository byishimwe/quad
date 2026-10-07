# Deployment checklist

- [ ] `npm run setup` and `npm run check` pass with Node.js 24.19.0.
- [ ] Backend production variables match [`backend/.env.production.example`](../backend/.env.production.example); secrets are set in the host and are absent from the frontend build.
- [ ] MongoDB, Clerk, Cloudinary, and the Clerk webhook are configured.
- [ ] `FRONTEND_URL`, `VITE_API_BASE_URL`, and `VITE_SOCKET_URL` use the deployed HTTPS origins.
- [ ] Proxy hop count reflects the actual trusted proxy chain; direct backend access is blocked when that count is nonzero.
- [ ] Upload ingress limit and timeout cover the configured video limit.
- [ ] Swagger is disabled in production unless intentionally enabled.
- [ ] SPA fallback, Socket.IO upgrades, API health, sign-in, uploads, chat, notifications, mobile layout, themes, and PWA are manually checked.
- [ ] [`QUALITY_STATUS.md`](QUALITY_STATUS.md) accurately records outstanding checks and limitations.
