# Getting started

Quad contains a React/Vite frontend and an Express/Socket.IO backend. Use Node.js 24.19.0, npm, MongoDB, Clerk credentials, and Cloudinary credentials.

1. Run `npm run setup` at the repository root. This runs `npm ci` against both committed lockfiles.
2. Copy `backend/.env.example` to `backend/.env` and `frontend/.env.example` to `frontend/.env`. Set the credentials and URLs described in [environment variables](ENVIRONMENT_VARIABLES.md).
3. Start the backend with `npm --prefix backend run dev` and the frontend with `npm --prefix frontend run dev`, in separate terminals.
4. Open the Vite URL (normally `http://localhost:5173`). The API defaults to port 4000. Development Swagger is at `/api-docs` on the backend; production Swagger requires `ENABLE_API_DOCS=true`.
5. Run `npm run check` at the repository root for lint, typecheck, tests, and builds. Backend integration tests start a temporary MongoDB server and need local loopback access.

See the [deployment guide](DEPLOYMENT.md) for production configuration and [current quality status](QUALITY_STATUS.md) for verified results.
