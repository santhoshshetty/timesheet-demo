# timesheet-demo

Enterprise timesheet application. The first feature,
[Project Management](specs/001-project-management/spec.md), lets users create, find, view, edit,
and soft-delete projects. Each project gets a system-generated, unique, 8-digit charge code.

> **Development-only (FR-036).** There is no authentication or authorization yet
> (Constitution v1.3.0, Principle III development-only exemption). Deploy to lower environments
> (dev, test, staging) only. The app refuses to start with `APP_ENV=production`. Do not enter
> confidential data.

## Prerequisites

- Docker with Docker Compose v2 (Docker Desktop, Rancher Desktop, or Docker Engine)
- Node.js 22 LTS and npm 10+ (for tests and local development outside containers)
- Free ports `3000` (app) and `5432` (PostgreSQL)

## Run with Docker Compose

```powershell
Copy-Item .env.example .env     # macOS/Linux: cp .env.example .env
docker compose up --build
```

Compose starts three services:

| Service   | Role                                                            |
| --------- | --------------------------------------------------------------- |
| `db`      | PostgreSQL 16 with a named volume `pgdata` and a health check   |
| `migrate` | Applies `backend/migrations` with `node-pg-migrate`, then exits |
| `app`     | Express API plus the built React app on <http://localhost:3000> |

- UI: <http://localhost:3000>
- Swagger UI: <http://localhost:3000/api/docs> (when `SWAGGER_ENABLED=true`)
- Health: `/health/live` and `/health/ready` (readiness checks the database)

Reset everything, including the database: `docker compose down -v`.

### Environment variables

Defined in [.env.example](.env.example) (placeholders only; never commit `.env`):

| Variable                                            | Purpose                                                                         |
| --------------------------------------------------- | ------------------------------------------------------------------------------- |
| `APP_ENV`                                           | `development`, `test`, or `staging`; `production` is refused                    |
| `PORT`                                              | HTTP port (default `3000`)                                                      |
| `DATABASE_URL`                                      | PostgreSQL connection string used by `app` and `migrate`                        |
| `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` | Database container settings                                                     |
| `BUSINESS_TIME_ZONE`                                | IANA time zone that defines "today" for date rules                              |
| `LOG_LEVEL`                                         | pino log level                                                                  |
| `SWAGGER_ENABLED`                                   | Serve Swagger UI at `/api/docs`                                                 |
| `CONTRACT_PATH`, `STATIC_DIR`                       | Optional; leave unset. Defaults work locally and the image sets container paths |

### Pinned base images

| Image      | Tag                       | Where                                                           |
| ---------- | ------------------------- | --------------------------------------------------------------- |
| Node.js    | `node:22.20.0-alpine3.22` | [Dockerfile](Dockerfile)                                        |
| PostgreSQL | `postgres:16.10-alpine`   | [docker-compose.yml](docker-compose.yml), Testcontainers helper |

## Local development

Backend on the host (database still in Compose):

```powershell
Copy-Item .env.local.example .env.local
docker compose up db migrate
npm run dev -w backend          # loads .env.local via Node's --env-file; API on port 3000
```

Frontend with hot reload (proxies `/api` and `/health` to port 3000):

```powershell
npm run dev -w frontend         # http://localhost:5173
```

## npm scripts

| Script                            | What it does                                                           |
| --------------------------------- | ---------------------------------------------------------------------- |
| `npm run typecheck`               | `tsc` in backend, frontend, and e2e                                    |
| `npm run lint`                    | ESLint (typescript-eslint, react-hooks, jsx-a11y)                      |
| `npm run format` / `format:check` | Prettier write / check                                                 |
| `npm run generate:api-types`      | Regenerate `packages/api-contract/src/schema.d.ts` from `openapi.yaml` |
| `npm run build`                   | Build frontend (`frontend/dist`) and backend (`backend/dist`)          |
| `npm run perf:smoke`              | p95 checks against a running stack (seeds 10,000 projects)             |

## Tests

| Layer          | Command                    | Tooling                                 | Needs                 |
| -------------- | -------------------------- | --------------------------------------- | --------------------- |
| Unit           | `npm run test:unit`        | Jest                                    | —                     |
| DB integration | `npm run test:integration` | Jest + Testcontainers                   | Docker                |
| API            | `npm run test:api`         | Jest + Supertest                        | Docker                |
| Frontend       | `npm run test:web`         | Jest + React Testing Library + jest-axe | —                     |
| End-to-end     | `npm run test:e2e`         | Playwright + axe                        | Running Compose stack |

End-to-end tests run against <http://localhost:3000> (override with `E2E_BASE_URL`). Install
browsers once with `npx playwright install` in `e2e/`. To run one browser:
`cd e2e; npx playwright test --project=chromium`.

Run `npm run perf:smoke` last and reset the database afterwards (`docker compose down -v`); it
seeds 10,000 projects.

CI runs every gate in order: [.github/workflows/ci.yml](.github/workflows/ci.yml).

## Architecture

npm-workspaces monorepo:

| Workspace               | Contents                                                                                                                                                                                                 |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/api-contract` | OpenAPI 3.0.3 contract (runtime source of truth) and generated types                                                                                                                                     |
| `backend`               | Express 5 API: `domain/` (business rules), `application/` (use cases, transactions), `infrastructure/` (PostgreSQL, clock, charge codes, config, logging), `http/` (routes, validation, Problem Details) |
| `frontend`              | React 19 + MUI single-page app, served by the backend in the container                                                                                                                                   |
| `e2e`                   | Playwright journeys with accessibility scans                                                                                                                                                             |

Key decisions:

- Contract-first API: `express-openapi-validator` validates requests (and responses in
  development/test) against the OpenAPI document.
- Business rules live in the `Project` aggregate; PostgreSQL constraints back them up.
- Charge codes are random, generated in the backend, and unique across all projects, including
  deleted ones.
- Optimistic locking with `ETag`/`If-Match`; duplicate creates prevented with `Idempotency-Key`.
- Soft delete only; no restore or purge.

Details: [plan](specs/001-project-management/plan.md),
[research and decisions](specs/001-project-management/research.md),
[data model](specs/001-project-management/data-model.md),
[validation guide](specs/001-project-management/quickstart.md).
