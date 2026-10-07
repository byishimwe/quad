# Quad backend

The backend serves the Quad API and Socket.IO events. It uses Express 5, TypeScript, MongoDB/Mongoose, Clerk, Cloudinary, Zod, and Vitest/Supertest.

Use Node.js 24.19.0. Copy `.env.example` to `.env`, set MongoDB, Clerk, Cloudinary, and frontend origin values, then run:

```sh
npm ci
npm run dev
```

The API defaults to port 4000. `GET /health` is the health endpoint; API routes are under `/api/*`. Swagger is at `/api-docs` in development and disabled by default in production.

`npm run lint`, `npm run typecheck`, `npm run test:run`, and `npm run build` verify the package. Integration tests start a temporary MongoDB server and need localhost access. See the [backend docs](docs/README.md), [shared docs](../docs/README.md), and [quality status](../docs/QUALITY_STATUS.md).
