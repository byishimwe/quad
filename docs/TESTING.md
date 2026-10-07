# Testing Guide

This document describes how testing is structured in the Quad monorepo.

## Test tooling

- **Frontend**: Vitest + React Testing Library (see `frontend/package.json` devDependencies)
- **Backend**: Vitest + Supertest (see `backend/package.json` devDependencies)

## Running tests

Run `npm test` from the repository root to execute both frontend and backend suites. Run `npm run check` for the full lint, typecheck, test, and build gate.

### Frontend

From repo root:

```bash
npm --prefix frontend run test
```

From `frontend/`:

```bash
npm run test
```

### Backend

From repo root:

```bash
npm --prefix backend run test:run
```

From `backend/`:

```bash
npm run test:run
```

## Test locations

### Frontend

- Unit/component tests live under `frontend/src/test/`.

### Backend

- Backend tests live under `backend/src/test/`.

## Test types (recommended)

- **Unit tests**
  - Pure logic utilities, mappers, and schema validation.

- **Service/API tests**
  - Frontend services: validate endpoint calls and response handling (usually with Axios mocking).

- **Integration tests (backend)**
  - HTTP tests using Supertest against an Express app.

## Notes

- If you add new features, add tests close to the domain:
  - Backend: controller/service/model level + route tests for critical endpoints.
  - Frontend: service tests + component tests for user flows.
