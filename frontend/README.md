# Quad frontend

The Quad web app presents posts, stories, polls, profiles, chat, and notifications. It uses React 19, TypeScript, Vite, React Router, Tailwind CSS, Clerk, Zustand, Axios, Socket.IO client, TipTap, Radix UI primitives, Framer Motion, Zod, React Hook Form, and Vitest.

## Start

Use Node.js 24.19.0. Copy `.env.example` to `.env` and set the Clerk publishable key, API URL, and Socket.IO URL. Start the backend and MongoDB first.

```sh
npm ci
npm run dev
```

The root `npm run setup` installs both packages. The Vite server normally opens at `http://localhost:5173`.

## Check

```sh
npm run lint
npm run typecheck
npm test
npm run build
```

`npm run build` writes `dist/`. Tests run with Vitest and React Testing Library. See the [frontend docs](docs/README.md), [shared docs](../docs/README.md), and [current quality status](../docs/QUALITY_STATUS.md).
