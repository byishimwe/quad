# Scripts

Use Node.js 24.19.0. Run these commands from the repository root:

| Command | Action |
| --- | --- |
| `npm run setup` | `npm ci` for backend, then frontend |
| `npm run lint` | ESLint for frontend and backend |
| `npm run typecheck` | TypeScript checks for both packages |
| `npm test` | Frontend Vitest run, then backend Vitest run |
| `npm run build` | Backend TypeScript build, then frontend Vite build |
| `npm run check` | Lint, typecheck, tests, build |

From `frontend/`, `npm run dev` starts Vite, `npm run test:watch` starts Vitest watch mode, and `npm run preview` previews a build. From `backend/`, `npm run dev` starts the API and `npm run test:run` runs integration tests with two workers. Backend tests use a temporary local MongoDB server and must be able to bind to localhost.
