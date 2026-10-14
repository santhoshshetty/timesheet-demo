---

description: "Task list for feature 001-project-management"
---

# Tasks: Project Management

**Input**: Design documents from `specs/001-project-management/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md),
[data-model.md](data-model.md), [contracts/openapi.yaml](contracts/openapi.yaml),
[contracts/ui-routes.md](contracts/ui-routes.md), [quickstart.md](quickstart.md)

**Tests**: Included. The Constitution (v1.3.0, Principle VIII) requires tests and mandates the
toolchain: Jest (unit), Jest + Testcontainers (DB integration), Jest + Supertest (API),
Jest + React Testing Library (frontend), and Playwright (end-to-end). Within each story, write
the tests first and confirm they fail before implementing.

**Organization**: Tasks are grouped by user story so each story can be implemented and tested on
its own.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on incomplete tasks)
- **[Story]**: User story the task belongs to (US1–US4)
- Every task names the exact file path(s)

## Path Conventions

npm-workspaces monorepo (see [plan.md](plan.md#project-structure)): `backend/`, `frontend/`,
`packages/api-contract/`, `e2e/`, with shared configuration at the repository root.

## Story → Scope Mapping

| Story | Priority | Delivers | Endpoints | Screens |
|---|---|---|---|---|
| US1 Create a Project | P1 🎯 MVP | Create with generated charge code, then view the created project | `POST /api/v1/projects`, `GET /api/v1/projects/{projectId}` | `/projects/new`, `/projects/:projectId` |
| US2 Find and View Projects | P1 | List, search, sort, and page projects | `GET /api/v1/projects` | `/projects` |
| US3 Edit a Project | P2 | Edit with date rules and concurrent-edit protection | `PUT /api/v1/projects/{projectId}` | `/projects/:projectId/edit` |
| US4 Delete a Project | P3 | Soft delete with confirmation | `DELETE /api/v1/projects/{projectId}` | Delete dialog on detail page |

US1 includes the single-project read endpoint and detail screen because its acceptance
scenarios require showing the created project and its charge code.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Monorepo, tooling, and workspace initialization

- [X] T001 Create root `package.json` with npm workspaces `["backend", "frontend", "packages/api-contract", "e2e"]`, `"engines": { "node": ">=22" }`, and root scripts `typecheck`, `lint`, `format`, `format:check`, `generate:api-types`, `build`, `test:unit`, `test:integration`, `test:api`, `test:web`, `test:e2e` that delegate to workspace scripts, in package.json
- [X] T002 [P] Create shared strict TypeScript settings (`"strict": true`, `"noUncheckedIndexedAccess": true`, `"noImplicitOverride": true`, `"useUnknownInCatchVariables": true`, `"forceConsistentCasingInFileNames": true`, `"target": "ES2022"`) in tsconfig.base.json
- [X] T003 [P] Create ESLint flat config using `typescript-eslint` (type-aware, `@typescript-eslint/no-explicit-any: "error"`), `eslint-plugin-react-hooks` and `eslint-plugin-jsx-a11y` for `frontend/**`, `eslint-config-prettier` last, and a `no-restricted-imports` rule for `backend/src/domain/**` that forbids `express`, `pg`, `pino`, `pino-http`, `node-pg-migrate`, and any path into `infrastructure/` or `http/` (Principle II); plus `@typescript-eslint/consistent-type-imports: "error"` so type-only imports (e.g. from `@timesheet/api-contract`) are erased from compiled output, in eslint.config.mjs
- [X] T004 [P] Create Prettier config (`printWidth: 100`, `singleQuote: true`) and ignore file (`dist`, `coverage`, `playwright-report`, `test-results`, `packages/api-contract/src/schema.d.ts`) in .prettierrc.json and .prettierignore
- [X] T005 [P] Create `.gitignore` (`node_modules/`, `dist/`, `coverage/`, `.env`, `.env.local`, `playwright-report/`, `test-results/`) and `.dockerignore` (same plus `.git`, `specs/`, `e2e/`) in .gitignore and .dockerignore
- [X] T006 [P] Create `.env.example` with placeholder values only: `APP_ENV=development`, `PORT=3000`, `DATABASE_URL=postgres://timesheet:change-me@db:5432/timesheet`, `POSTGRES_USER=timesheet`, `POSTGRES_PASSWORD=change-me`, `POSTGRES_DB=timesheet`, `BUSINESS_TIME_ZONE=UTC`, `LOG_LEVEL=info`, `SWAGGER_ENABLED=true`, each with a one-line comment, plus commented-out optional overrides `# CONTRACT_PATH=` and `# STATIC_DIR=` with the note "leave unset: defaults work for local development and the Docker image sets container paths"; and create `.env.local.example` for running the backend on the host (outside Compose) with the same keys except `DATABASE_URL=postgres://timesheet:change-me@localhost:5432/timesheet` and a header comment "copy to .env.local; used by `npm run dev -w backend`; the database still runs in Compose (`docker compose up db migrate`)", in .env.example and .env.local.example
- [X] T007 [P] Create the contract workspace: copy `specs/001-project-management/contracts/openapi.yaml` to `packages/api-contract/openapi.yaml`; add `packages/api-contract/package.json` (name `@timesheet/api-contract`, `"private": true`, `"types": "src/index.d.ts"` and no `"main"` — a declaration file is never compiled as source, so consumers' `rootDir` is not violated and nothing is loaded at runtime; dev dependency `openapi-typescript`; script `generate`: `openapi-typescript openapi.yaml -o src/schema.d.ts`); add `packages/api-contract/src/index.d.ts` containing **only type exports** (re-exporting `components` and `paths` from `./schema` plus aliases `Project`, `ProjectInput`, `ProjectPage`, `Problem`, `FieldError`) so consumers use `import type`, in packages/api-contract/
- [X] T008 [P] Initialize the backend workspace: `backend/package.json` (dependencies `express@5`, `pg`, `node-pg-migrate`, `express-openapi-validator`, `swagger-ui-express`, `yaml`, `helmet`, `pino`, `pino-http`; dev dependencies `@timesheet/api-contract` (types only), `typescript`, `tsx`, `jest`, `ts-jest`, `@types/jest`, `@types/node`, `@types/express`, `@types/pg`, `@types/swagger-ui-express`, `supertest`, `@types/supertest`, `@testcontainers/postgresql`; scripts `dev` = `tsx watch --env-file=../.env.local src/server.ts` (Node's built-in env-file loading; no `dotenv`), `build` = `tsc -p tsconfig.build.json`, `start` = `node dist/server.js`, `migrate` = `node-pg-migrate up -m migrations --migration-file-language sql`, `typecheck` = `tsc -p tsconfig.json`, `test:unit`, `test:integration`, `test:api`); `backend/tsconfig.json` extending `../tsconfig.base.json` with `"module": "commonjs"`, `"moduleResolution": "node10"`, `"esModuleInterop": true`, `"noEmit": true`, and `include: ["src", "tests", "scripts"]` (used by type checking and ts-jest); `backend/tsconfig.build.json` extending it with `"noEmit": false`, `rootDir: src`, `outDir: dist`, and `include: ["src"]` (so tests and scripts never trip `rootDir`); and `backend/jest.config.cjs` (plain CommonJS, so Jest needs no `ts-node` to load it) with three projects `unit` (`tests/unit`), `integration` (`tests/integration`), and `api` (`tests/api`), each using the `ts-jest` transform with `tsconfig: "tsconfig.json"` (CommonJS output, matching the backend module format). Before pinning versions, confirm the chosen `express-openapi-validator` release supports Express 5; if not, use `express@4.21.x` (research.md R4 risk note), in backend/
- [X] T009 [P] Initialize the frontend workspace: `frontend/package.json` (dependencies `react@19`, `react-dom@19`, `react-router`, `@mui/material`, `@emotion/react`, `@emotion/styled`; dev dependencies `@timesheet/api-contract` (types only), `vite`, `@vitejs/plugin-react`, `typescript`, `jest`, `ts-jest`, `jest-environment-jsdom`, `@testing-library/react`, `@testing-library/user-event`, `@testing-library/jest-dom`, `jest-axe`, `@types/jest-axe`; scripts `dev`, `build`, `typecheck`, `test`), `frontend/tsconfig.json`, `frontend/index.html`, `frontend/vite.config.ts` (React plugin; dev-server proxy for `/api` and `/health` to `http://localhost:3000`; `build.outDir = "dist"`), and `frontend/jest.config.cjs` (plain CommonJS, no `ts-node`; `testEnvironment: "jsdom"`; `setupFilesAfterEnv: ["<rootDir>/tests/setupTests.ts"]`; `ts-jest` transform with inline `tsconfig` overrides `{ "jsx": "react-jsx", "module": "commonjs", "esModuleInterop": true }` because the Vite `tsconfig.json` targets ESM bundling), in frontend/
- [X] T010 [P] Initialize the E2E workspace: `e2e/package.json` (dev dependencies `@playwright/test`, `@axe-core/playwright`; script `test`), and `e2e/playwright.config.ts` (`baseURL` = `process.env.E2E_BASE_URL ?? "http://localhost:3000"`, projects `chromium`, `firefox`, `webkit`, `retries: 1` on CI, HTML reporter), in e2e/
- [X] T011 Run `npm install` at the repository root to create the lockfile, then run `npm run generate:api-types` and commit the generated types, in package-lock.json and packages/api-contract/src/schema.d.ts

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Configuration, domain building blocks, database, HTTP pipeline, test harness,
frontend shell, and containers that every story needs.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

### Backend configuration, logging, and clock

- [X] T012 [P] Write unit tests for configuration parsing covering: missing `DATABASE_URL` fails; invalid `BUSINESS_TIME_ZONE` (e.g. `Mars/Base`) fails; `APP_ENV=production` throws `DevelopmentOnlyError` with message "This application is development-only (FR-036) and cannot run with APP_ENV=production"; `SWAGGER_ENABLED` defaults to `true` outside production; `CONTRACT_PATH` and `STATIC_DIR` default to absolute paths of `packages/api-contract/openapi.yaml` and `frontend/dist` resolved from the module location (not `process.cwd()`), and explicit values override them, in backend/tests/unit/infrastructure/config.test.ts
- [X] T013 Implement `loadConfig(env)` returning a typed `AppConfig` (`appEnv: "development" | "test" | "staging"`, `port`, `databaseUrl`, `businessTimeZone`, `logLevel`, `swaggerEnabled`, `contractPath`, `staticDir`), validating `BUSINESS_TIME_ZONE` via `Intl.DateTimeFormat` and throwing `DevelopmentOnlyError` when `APP_ENV=production`, without third-party libraries. `contractPath` comes from `CONTRACT_PATH`, defaulting to `path.resolve(__dirname, "../../../../packages/api-contract/openapi.yaml")`; `staticDir` comes from `STATIC_DIR`, defaulting to `path.resolve(__dirname, "../../../../frontend/dist")`. These defaults are correct for both `backend/src` (tsx) and `backend/dist` (compiled) because both sit at the same depth. The config fails fast if `contractPath` does not exist; if `staticDir` is missing, static hosting is disabled with an info log. Never derive paths from `process.cwd()`, in backend/src/infrastructure/config/config.ts
- [X] T014 [P] Implement a `Logger` interface (`info`, `warn`, `error`, `child`) and a pino-backed implementation that never logs request or response bodies and redacts `req.headers.authorization` and `req.headers.cookie`, in backend/src/infrastructure/logging/logger.ts
- [X] T015 [P] Write unit tests for `BusinessTimeZoneClock.today()` using fixed instants: `2026-10-06T23:30:00Z` returns `2026-10-07` in `Asia/Tokyo` and `2026-10-06` in `UTC`, in backend/tests/unit/infrastructure/businessTimeZoneClock.test.ts
- [X] T016 Implement `BusinessTimeZoneClock` (implements domain `Clock`; `today()` formats the current instant as `YYYY-MM-DD` with `Intl.DateTimeFormat("en-CA", { timeZone })`; `now()` returns `new Date()`), with an injectable time source for tests, in backend/src/infrastructure/clock/BusinessTimeZoneClock.ts

### Domain building blocks (shared by all stories)

- [X] T017 [P] Define domain errors: `ProjectValidationError` (holds `FieldError[]` of `{ field, code, message }` where `code` is one of `REQUIRED`, `TOO_LONG`, `INVALID_EMAIL`, `INVALID_DATE`, `START_DATE_IN_PAST`, `END_BEFORE_START`, `END_DATE_SHORTENED`, `CLIENT_NAME_REQUIRED`), `ProjectNotFoundError`, `ProjectNameTakenError`, `VersionConflictError`, `ChargeCodeUnavailableError`, in backend/src/domain/project/errors.ts
- [X] T018 [P] Write unit tests for value objects: `CalendarDate` accepts `2026-02-28`, rejects `2026-02-31`, `2026-13-01`, `26-01-01`, and compares correctly; `ChargeCode` accepts `00412345`, rejects `1234567`, `123456789`, `1234567a`, and preserves leading zeros in `toString()`; `ProjectName` trims, rejects blank or > 100 characters after trim; `EmailAddress` trims, lower-cases, accepts and rejects exactly the same values as the contract's `format: email` (shared fixture `backend/tests/support/emailCases.ts` with accepted values such as `priya.shah@example.com`, `a@b`, `first.last+tag@sub.example.co.uk` and rejected values such as `no-at-sign`, `a@`, `@example.com`, `a b@example.com`, and a 255-character address), in backend/tests/unit/domain/valueObjects.test.ts and backend/tests/support/emailCases.ts
- [X] T019 [P] Implement `CalendarDate`: "`YYYY-MM-DD`, validated as a real calendar date (rejects `2026-02-31`); comparable" — string-backed, with `isBefore`, `isAfter`, `equals`, and no use of `Date` for comparison, in backend/src/domain/project/CalendarDate.ts
- [X] T020 [P] Implement `ChargeCode`: "wraps an 8-character digit string" matching `^[0-9]{8}$`, "Never parsed as a number", immutable, in backend/src/domain/project/ChargeCode.ts
- [X] T021 [P] Implement `ProjectName`: "trims input; rejects blank or > 100 characters", in backend/src/domain/project/ProjectName.ts
- [X] T022 [P] Implement `EmailAddress`: trims and lower-cases; validates with the **same regular expression the request validator uses for `format: email`** (ajv-formats "fast" mode, with T035 pinning `validateFormats: "fast"`), copied into this file with a one-line comment naming its source, plus length ≤ 254, so the API and the domain never disagree on what is a valid email, in backend/src/domain/project/EmailAddress.ts
- [X] T023 [P] Define ports: `ProjectRepository` (`insert`, `findActiveById`, `findByCreateRequestId`, `search`, `update`, `softDelete`), `ChargeCodeGenerator` (`next(): ChargeCode`), and `Clock` (`today(): CalendarDate`, `now(): Date`), plus `SearchCriteria` (`search?`, `sort: "name" | "chargeCode" | "startDate" | "endDate"`, `order: "asc" | "desc"`, `page`, `pageSize`) and `SearchResult` types, in backend/src/domain/project/ports.ts
- [X] T024 [P] Define the `UnitOfWork` port (`run<T>(work: (repos: { projects: ProjectRepository }) => Promise<T>): Promise<T>`) used by use cases to own transaction boundaries, in backend/src/application/shared/UnitOfWork.ts
- [X] T025 [P] Write unit tests for shared field validation `validateProjectFields(input)`: reports all errors at once; `name` "Trimmed; 1–100 chars after trim"; `projectManager.name` "Trimmed; 1–100 chars after trim"; `projectManager.email` "Trimmed, stored lower-case; valid email format; ≤ 254 chars"; `startDate`/`endDate` must be real calendar dates (`INVALID_DATE`); `endDate` "≥ `startDate`" (`END_BEFORE_START`); `clientName` "Required (trimmed, 1–100) when `CLIENT`; always `null` when `INTERNAL` — any submitted value is discarded"; any `projectType`/`billingType` combination is allowed (FR-005), in backend/tests/unit/domain/projectFields.test.ts
- [X] T026 Implement the `Project` aggregate skeleton: fields exactly as in data-model.md (`id`, `chargeCode`, `name`, `projectManager { name, email }`, `startDate`, `endDate`, `projectType` enum `INTERNAL | CLIENT`, `clientName: string | null`, `billingType` enum `BILLABLE | NON_BILLABLE`, `version` "integer ≥ 1", `createdAt`, `updatedAt`, `deletedAt | null`, `createRequestId`), `Project.fromPersistence(snapshot)`, `toSnapshot()`, and `validateProjectFields(input)` (throws `ProjectValidationError` with all field errors), in backend/src/domain/project/Project.ts

### Database

- [X] T027 Create the forward-only migration (only an `-- Up Migration` section; no down migration) for table `project` with exactly these columns and constraints from data-model.md: `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`; `charge_code char(8) NOT NULL` with `CONSTRAINT project_charge_code_uq UNIQUE (charge_code)` and `CHECK (charge_code ~ '^[0-9]{8}$')`; `name varchar(100) NOT NULL CHECK (name = btrim(name) AND name <> '')`; `project_manager_name varchar(100) NOT NULL CHECK (project_manager_name = btrim(project_manager_name) AND project_manager_name <> '')`; `project_manager_email varchar(254) NOT NULL CHECK (project_manager_email = lower(btrim(project_manager_email)))`; `start_date date NOT NULL`; `end_date date NOT NULL CHECK (end_date >= start_date)`; `project_type varchar(16) NOT NULL CHECK (project_type IN ('INTERNAL','CLIENT'))`; `client_name varchar(100) NULL` with `CHECK ((project_type = 'CLIENT' AND client_name IS NOT NULL AND client_name = btrim(client_name) AND client_name <> '') OR (project_type = 'INTERNAL' AND client_name IS NULL))`; `billing_type varchar(16) NOT NULL CHECK (billing_type IN ('BILLABLE','NON_BILLABLE'))`; `create_request_id uuid NOT NULL` with `CONSTRAINT project_create_request_id_uq UNIQUE (create_request_id)`; `version integer NOT NULL DEFAULT 1 CHECK (version >= 1)`; `created_at timestamptz NOT NULL DEFAULT now()`; `updated_at timestamptz NOT NULL DEFAULT now()`; `deleted_at timestamptz NULL`; plus indexes `project_name_active_uq UNIQUE (lower(name)) WHERE deleted_at IS NULL`, `project_active_start_date_idx (start_date) WHERE deleted_at IS NULL`, `project_active_end_date_idx (end_date) WHERE deleted_at IS NULL`, in backend/migrations/0001_create_project.sql
- [X] T028 Implement the PostgreSQL pool (from `config.databaseUrl`; register a type parser so `date` columns (OID 1082) are returned as raw `YYYY-MM-DD` strings) and `PgUnitOfWork` (`BEGIN`/`COMMIT`/`ROLLBACK` on one client, releasing it in `finally`), in backend/src/infrastructure/db/pool.ts and backend/src/infrastructure/db/PgUnitOfWork.ts
- [X] T029 [P] Implement `mapUniqueViolation(error)` that inspects PostgreSQL error code `23505` and `constraint` name and returns `"NAME_TAKEN"` for `project_name_active_uq`, `"CHARGE_CODE_COLLISION"` for `project_charge_code_uq`, `"DUPLICATE_CREATE_REQUEST"` for `project_create_request_id_uq`, otherwise `null`, in backend/src/infrastructure/db/pgErrors.ts
- [X] T030 Create `PgProjectRepository` with row ↔ domain mapping (`charge_code` kept as a string, dates as strings, `project_manager_email` lower-case) and a private `ACTIVE` SQL fragment `deleted_at IS NULL` used by every read and update; method bodies are added in the story phases, in backend/src/infrastructure/db/PgProjectRepository.ts

### HTTP pipeline

- [X] T031 [P] Implement the request-ID middleware: accept `X-Request-Id` if it is a valid UUID, otherwise generate one with `crypto.randomUUID()`; set it on the response header and `res.locals.requestId`, in backend/src/http/requestId.ts
- [X] T032 [P] Define HTTP-layer errors `PreconditionRequiredError` (missing `If-Match`) and `InvalidIfMatchError` (malformed `If-Match`) in backend/src/http/httpErrors.ts, and implement Problem Details mapping (`Content-Type: application/problem+json`, always including `requestId`, never a stack trace): express-openapi-validator errors → `400 VALIDATION_FAILED` with `errors[]` (path `/body/projectManager/email` → field `projectManager.email`; `required` → `REQUIRED`; `minLength` → `REQUIRED`; `additionalProperties` → `UNKNOWN_FIELD` with message "Charge code is generated by the system and cannot be supplied." when the field is `chargeCode`; `maxLength` → `TOO_LONG`; `format: date` → `INVALID_DATE`; `format: email` → `INVALID_EMAIL`; other format → `INVALID_FORMAT`; `enum`, `minimum`, `maximum`, `pattern` → `INVALID_VALUE`); validator "not found" (unknown path) → `404 ROUTE_NOT_FOUND`; validator "method not allowed" → `405 METHOD_NOT_ALLOWED`; body too large → `400 VALIDATION_FAILED`; `InvalidIfMatchError` (malformed `If-Match`, raised by the PUT handler) → `400 VALIDATION_FAILED` with `errors: [{ field: "If-Match", code: "INVALID_FORMAT", message: "If-Match must be the quoted version from the ETag, e.g. \"3\"." }]`; `PreconditionRequiredError` (missing `If-Match`, raised by the PUT handler — the header is optional in the schema so the validator never intercepts it) → `428 PRECONDITION_REQUIRED`; `ProjectValidationError` → `422 BUSINESS_RULE_VIOLATION`; `ProjectNotFoundError` → `404 PROJECT_NOT_FOUND`; `ProjectNameTakenError` → `409 PROJECT_NAME_TAKEN` with `errors: [{ field: "name", code: "INVALID_VALUE", message: "A project with this name already exists." }]`; `VersionConflictError` → `412 VERSION_CONFLICT`; `ChargeCodeUnavailableError` → `503 CHARGE_CODE_UNAVAILABLE`; a final not-found middleware for anything unmatched → `404 ROUTE_NOT_FOUND`; anything else → `500 INTERNAL_ERROR` with a generic `detail` and the error logged with `requestId`, in backend/src/http/httpErrors.ts and backend/src/http/problemDetails.ts
- [X] T033 [P] Implement health routes: `GET /health/live` → `200 {"status":"ok"}`; `GET /health/ready` runs `SELECT 1` → `200 {"status":"ok"}` or `503 {"status":"unavailable"}`, in backend/src/http/health.ts
- [X] T034 [P] Implement Swagger UI at `/api/docs` serving the document at `config.contractPath` (parsed with `yaml`), mounted only when `config.swaggerEnabled` is true, in backend/src/http/swagger.ts
- [X] T035 Implement `createApp(deps)` with middleware in exactly this order: (1) `app.disable("x-powered-by")`; `helmet()` with a CSP that allows `style-src 'self' 'unsafe-inline'` (needed by Emotion/MUI and Swagger UI); `express.json({ limit: "100kb" })`; request-ID middleware; `pino-http` without bodies. (2) Health routes and Swagger UI. (3) Frontend hosting, **before** the validator: `express.static(config.staticDir)` (when present) and an SPA fallback written as plain middleware (`app.use((req, res, next) => …)`, not `app.get("*")`, which Express 5 rejects) that serves `index.html` only for `GET`/`HEAD` requests whose path does not start with `/api` or `/health`. (4) `express-openapi-validator` with `apiSpec` = `config.contractPath`, `ignorePaths: /^(?!\/(api\/v1|health)\/)/` so it only checks `/api/v1/*` and `/health/*`, `validateRequests: true`, `validateFormats: "fast"` (pinned so the email rule matches T022), and `validateResponses: true` when `appEnv` is `development` or `test`. (5) A single `/api/v1` router (the one place where authentication middleware will be added later). (6) The not-found middleware (`404 ROUTE_NOT_FOUND`) and the Problem Details error handler last. All file locations come from `config` (T013), never from the working directory: locally the defaults point into the repository, and in the container the Dockerfile (T049) sets `CONTRACT_PATH=/app/packages/api-contract/openapi.yaml` and `STATIC_DIR=/app/frontend/dist`, in backend/src/http/app.ts
- [X] T036 Implement the composition root: load config (on `DevelopmentOnlyError` log the message and exit with code 1), create pool, `PgUnitOfWork`, `BusinessTimeZoneClock`, logger, build the app, listen on `config.port`, and close the server and pool on `SIGTERM`/`SIGINT`, in backend/src/server.ts

### Backend test harness

- [X] T037 [P] Implement the Testcontainers helper: start PostgreSQL (same pinned `postgres:16.x-alpine` tag as docker-compose.yml) once per Jest worker, apply `backend/migrations` by running the `node-pg-migrate` CLI in a child process started with `process.execPath` and the CLI script path resolved from `require.resolve("node-pg-migrate/package.json")` plus its `bin` entry (no shell, no `.bin` shim, so it works on Windows, macOS, and Linux), with arguments `up -m <abs path> --migration-file-language sql` and `DATABASE_URL` set to the container URL — this avoids importing the migration library into the CommonJS Jest runtime — and expose `getPool()`, `truncateProjects()`, and `stop()`, in backend/tests/support/postgres.ts
- [X] T038 [P] Implement test doubles: `FixedClock` (settable `today`/`now`), `SequenceChargeCodeGenerator` (returns configured codes in order, e.g. `["00412345", "00412345", "87654321"]`), and an `InMemoryUnitOfWork`/`InMemoryProjectRepository` that enforces name and charge-code uniqueness for use-case unit tests, in backend/tests/support/fakes.ts
- [X] T039 Implement `buildTestApp(overrides)` that wires `createApp` to the Testcontainers pool with `FixedClock` and an overridable `ChargeCodeGenerator`, with `appEnv: "test"` (response validation on), in backend/tests/support/testApp.ts
- [X] T040 [P] Write API tests for the pipeline: `/health/live` 200; `/health/ready` 200; `X-Request-Id` echoed when valid and generated when absent; security headers from helmet present and `X-Powered-By` absent; `GET /api/v1/unknown` → `404 ROUTE_NOT_FOUND` Problem Details with `requestId`; `PATCH /api/v1/projects` → `405 METHOD_NOT_ALLOWED`; a 200 KB JSON body returns `400 VALIDATION_FAILED`; with `STATIC_DIR` pointing at a temp folder containing `index.html` and `assets/app.js`, `GET /projects/new` returns `index.html` (SPA fallback), `GET /assets/app.js` returns the file, `GET /api/docs/` returns Swagger UI, and `GET /api/v1/unknown` still returns Problem Details (validator scope and middleware order from T035), in backend/tests/api/pipeline.api.test.ts

### Frontend shell

- [X] T041 [P] Create the MUI theme: neutral enterprise palette with text contrast ≥ 4.5:1, visible focus outline on all interactive components, compact data-table density, no third-party branding, in frontend/src/app/theme.ts
- [X] T042 [P] Implement the typed API client: `request<T>(method, path, { body?, headers? })` using `fetch`, typed with `@timesheet/api-contract`; returns `{ data, headers }`; parses `application/problem+json` into an `ApiProblem` (`status`, `code`, `title`, `detail`, `requestId`, `errors[]`); network failures become `ApiProblem` with `code: "NETWORK_ERROR"`; no `import.meta.env` usage (Jest compatibility). Also implement `newIdempotencyKey()` that returns `crypto.randomUUID()` when available and otherwise builds an RFC 4122 v4 UUID from `crypto.getRandomValues` (needed because `randomUUID` exists only in secure contexts, and lower environments may be served over plain HTTP on a non-localhost host), with unit tests for both paths, in frontend/src/api/client.ts, frontend/src/api/idempotencyKey.ts, frontend/tests/api/idempotencyKey.test.ts
- [X] T043 [P] Implement shared UI states: `PageHeader` (h1 title, optional breadcrumbs and actions), `LoadingState` (`role="status"`, accessible label), `EmptyState` (message plus optional action), `ErrorState` (message, request ID, "Retry" button), and `ErrorSummary` (`role="alert"`, lists field errors as links that focus the field, receives focus when shown), in frontend/src/shared/PageHeader.tsx, frontend/src/shared/LoadingState.tsx, frontend/src/shared/EmptyState.tsx, frontend/src/shared/ErrorState.tsx, frontend/src/shared/ErrorSummary.tsx
- [X] T044 [P] Implement the notification provider: MUI Snackbar plus a visually hidden `aria-live="polite"` region; exposes `notify(message)` via a hook (FR-027), in frontend/src/app/NotificationProvider.tsx
- [X] T045 [P] Implement the non-dismissible development banner with the exact text "Development environment — no sign-in. Do not enter confidential data." (FR-036), in frontend/src/app/DevelopmentBanner.tsx
- [X] T046 [P] Implement display helpers: labels `INTERNAL` → "Internal Project", `CLIENT` → "Client Project", `BILLABLE` → "Billable", `NON_BILLABLE` → "Non-Billable"; `formatDate("2026-10-06")` → `06 Oct 2026` without time-zone shifts; and a `ChargeCodeText` component rendering all 8 digits in a monospace font, in frontend/src/features/projects/labels.ts, frontend/src/features/projects/format.ts, frontend/src/features/projects/ChargeCodeText.tsx
- [X] T047 Implement the app shell, router, and page titles: `main.tsx` (ThemeProvider, CssBaseline, NotificationProvider, RouterProvider via `createBrowserRouter`); `App.tsx` layout with a header showing the product name, a "Projects" navigation link, the development banner, and a `<main>` landmark; `routes.tsx` with `/` redirecting to `/projects`, a placeholder `/projects` page with a "Create project" button, and `*` → `NotFoundPage` with a link back to the list; and a `usePageTitle(pageName)` hook (implemented with `useEffect`, no new dependency) that sets `document.title` to `"{pageName} – timesheet-demo"` on mount and whenever `pageName` changes, so titles update on client-side navigation. Required unique, descriptive titles (WCAG 2.4.2, FR-034, SC-007): list "Projects"; create "Create project"; detail "{project name} – Project"; edit "Edit {project name}"; project not found "Project not found"; unknown route "Page not found"; while loading a project "Loading project". Add an RTL test that navigates between routes and asserts `document.title` changes each time, in frontend/src/main.tsx, frontend/src/app/App.tsx, frontend/src/app/routes.tsx, frontend/src/app/NotFoundPage.tsx, frontend/src/app/usePageTitle.ts, frontend/tests/app/pageTitle.test.tsx
- [X] T048 [P] Create frontend test setup (`@testing-library/jest-dom`, `jest-axe` `toHaveNoViolations`, `crypto.getRandomValues` available from Node's `webcrypto` in jsdom) and helpers `renderWithProviders(ui, { route })` and `mockFetch(handlers)`, in frontend/tests/setupTests.ts and frontend/tests/support/render.tsx

### Containers

- [X] T049 Create the multi-stage root Dockerfile with base images pinned to exact tags (e.g. `node:22.<minor>.<patch>-alpine3.<n>`, chosen at implementation time and recorded in the README): `deps` stage (`npm ci`); `build` stage (generate API types, `npm run build -w frontend` → `frontend/dist`, `npm run build -w backend` → `backend/dist`); `runtime` stage with `WORKDIR /app`, `NODE_ENV=production`, `CONTRACT_PATH=/app/packages/api-contract/openapi.yaml`, `STATIC_DIR=/app/frontend/dist`; install production dependencies by copying the root `package.json`, `package-lock.json`, and every workspace `package.json` (`backend/`, `frontend/`, `packages/api-contract/`, `e2e/` — `npm ci` validates the lockfile against all workspaces) and running `npm ci --omit=dev -w backend`; then copy `backend/dist` → `/app/backend/dist`, `backend/migrations` → `/app/backend/migrations`, `packages/api-contract/openapi.yaml` → `/app/packages/api-contract/openapi.yaml`, and `frontend/dist` → `/app/frontend/dist`; runs as `USER node`; `EXPOSE 3000`; `CMD ["node", "backend/dist/server.js"]`, in Dockerfile
- [X] T050 Create Docker Compose with services `db` (pinned `postgres:16.<minor>-alpine` tag, env from `.env`, named volume `pgdata`, `pg_isready` health check, port `5432:5432`), `migrate` (built from `.`, `env_file: .env` so it receives the same `DATABASE_URL` as `app`, runs `npx node-pg-migrate up -m /app/backend/migrations --migration-file-language sql`, `depends_on: db: condition: service_healthy`), and `app` (built from `.`, `env_file: .env`, port `3000:3000`, `depends_on` `db` healthy and `migrate` `service_completed_successfully`). `CONTRACT_PATH` and `STATIC_DIR` come from the image (T049) and are not set in `.env`, in docker-compose.yml

**Checkpoint**: `docker compose up --build` starts `db`, `migrate`, and `app`; `/health/ready` returns
`ok`; the shell UI loads with the development banner; `APP_ENV=production` refuses to start.

---

## Phase 3: User Story 1 - Create a Project (Priority: P1) 🎯 MVP

**Goal**: A user fills in the create form, the system validates it, generates a unique 8-digit
charge code in the backend, stores the project, and shows its details.

**Independent Test**: Create a project with valid data (Start Date = today) and confirm the detail
page shows the entered values and an 8-digit charge code; invalid input is rejected with
field-specific messages; a double submit creates only one project.

### Tests for User Story 1 ⚠️ (write first; they must fail)

- [X] T051 [P] [US1] Write unit tests for `Project.create(input, today, chargeCode)`: Start Date = today accepted; Start Date yesterday → `START_DATE_IN_PAST`; End Date = Start Date accepted; End Date before Start Date → `END_BEFORE_START`; `CLIENT` without Client Name → `CLIENT_NAME_REQUIRED`; `INTERNAL` with a Client Name stores `null`; name of 101 characters → `TOO_LONG`; name of spaces only → `REQUIRED`; Project Manager Name of 101 characters → `TOO_LONG`; email `bad` → `INVALID_EMAIL`; email `Priya@Example.COM` stored as `priya@example.com`; several invalid fields reported together; new project has `version = 1`, in backend/tests/unit/domain/projectCreate.test.ts
- [X] T052 [P] [US1] Write unit tests for the `createProject` use case with fakes: success uses `clock.today()` and the generator's code; a charge-code collision retries with the next code; 5 consecutive collisions throw `ChargeCodeUnavailableError` and store nothing; an existing active project with the same `createRequestId` is returned with `replayed: true` without generating a code; an existing deleted project with that key throws `ProjectNotFoundError`; duplicate active name throws `ProjectNameTakenError`, in backend/tests/unit/application/createProject.test.ts
- [X] T053 [P] [US1] Write Testcontainers integration tests for `PgProjectRepository.insert`, `findActiveById`, and `findByCreateRequestId`: round-trip preserves `00412345`; inserting a code already used by a **deleted** row violates `project_charge_code_uq`; `Apollo Migration` then `apollo migration` violates `project_name_active_uq`; the same name is allowed when the existing project is deleted; 10 concurrent inserts with the same name → exactly one succeeds; `CLIENT` with `client_name` NULL and `INTERNAL` with a `client_name` are rejected by the CHECK constraint; duplicate `create_request_id` violates `project_create_request_id_uq`; `findActiveById` returns `null` for a deleted row, in backend/tests/integration/projectRepository.create.test.ts
- [X] T054 [P] [US1] Write Supertest API tests for `POST /api/v1/projects`: `201` with `Location: /api/v1/projects/{id}`, `ETag: "1"`, and `chargeCode` matching `^[0-9]{8}$`; repeating with the same `Idempotency-Key` → `200` with the same `id` and `chargeCode`; missing `Idempotency-Key` → `400`; empty body → `400` with `REQUIRED` for every required field; `name: ""` → `400 REQUIRED` (schema `minLength`); body containing `chargeCode` → `400` with `UNKNOWN_FIELD` on `chargeCode`; `projectType: "OTHER"` → `400 INVALID_VALUE`; Start Date yesterday → `422 START_DATE_IN_PAST`; End Date before Start Date → `422 END_BEFORE_START`; `CLIENT` without Client Name → `422 CLIENT_NAME_REQUIRED`; name of spaces only → `422 REQUIRED`; case-insensitive duplicate name → `409 PROJECT_NAME_TAKEN`; generator that always collides → `503 CHARGE_CODE_UNAVAILABLE` and no row stored; 20 parallel `POST`s with distinct names and keys (real `RandomChargeCodeGenerator`) → 20 × `201` with 20 distinct 8-digit charge codes (SC-002); every value in `backend/tests/support/emailCases.ts` gets the same accept/reject outcome from the API as from `EmailAddress` (rejected values → `400 INVALID_EMAIL`); every error is `application/problem+json` with `requestId` and no stack trace, in backend/tests/api/createProject.api.test.ts
- [X] T055 [P] [US1] Write Supertest API tests for `GET /api/v1/projects/{projectId}`: `200` with `ETag` and all `Project` fields (`clientName` `null` for `INTERNAL`); unknown UUID → `404 PROJECT_NOT_FOUND`; non-UUID id → `400`; soft-deleted row (inserted directly) → `404`, in backend/tests/api/getProject.api.test.ts
- [X] T056 [P] [US1] Write RTL tests for the create page: sections "General", "Project Manager", "Schedule", "Billing" present; no charge code input; Client Name shown only when "Client Project" is selected; submitting empty shows the error summary (focused) and per-field messages; server `422`/`409` `errors[]` appear on the matching fields; entered values preserved after errors; submit button disabled while the request is in flight; the same `Idempotency-Key` header is sent on retry after a network error; a Start Date before the browser's date shows a non-blocking hint and the form still submits (a server `422 START_DATE_IN_PAST` is then shown on the field); success (`201`) navigates to `/projects/{id}` and announces "Project created"; a replay (`200`) navigates to the saved project and announces "This project was already created. Showing the saved project."; `document.title` is "Create project – timesheet-demo"; no axe violations, in frontend/tests/features/projects/ProjectCreatePage.test.tsx
- [X] T057 [P] [US1] Write RTL tests for the detail page: shows name, charge code (8 digits, e.g. `00412345`), Project Manager Name and Email, Start/End Date as `DD MMM YYYY`, Project Type and Billing Type labels, and Client Name for Client Projects; loading state; `404` shows "Project not found" with a link to `/projects`; network error shows error state and Retry re-fetches; no axe violations, in frontend/tests/features/projects/ProjectDetailPage.test.tsx
- [X] T058 [P] [US1] Create E2E test-data helpers — `uniqueName(prefix)` appending a per-run suffix (timestamp plus random digits) so re-runs never collide with the active-name uniqueness rule, and `todayUtc()` returning `new Date().toISOString().slice(0, 10)` to match `BUSINESS_TIME_ZONE=UTC` — and write the Playwright "create and view" test using them: open `/projects/new`, fill all fields as a Client Project with Start Date = `todayUtc()`, save, assert the detail page shows the values and a charge code matching `^[0-9]{8}$`; run an axe scan on the create and detail pages with no critical or serious violations, in e2e/tests/support/data.ts and e2e/tests/project-lifecycle.spec.ts

### Implementation for User Story 1

- [X] T059 [US1] Implement `Project.create(input, today, chargeCode)`: run `validateProjectFields`, add `START_DATE_IN_PAST` when `startDate` is before `today` (FR-006a), normalize (trim names, lower-case email, `clientName = null` for `INTERNAL`), set `version = 1`, in backend/src/domain/project/Project.ts
- [X] T060 [P] [US1] Implement `RandomChargeCodeGenerator`: `crypto.randomInt(0, 100_000_000)` left-padded to 8 digits with `padStart(8, "0")`, returned as `ChargeCode`, in backend/src/infrastructure/charge-code/RandomChargeCodeGenerator.ts
- [X] T061 [US1] Implement `PgProjectRepository.insert(project)` (parameterized `INSERT … RETURNING *`; unique violations mapped via `mapUniqueViolation` to `ChargeCodeCollisionError` (internal), `ProjectNameTakenError`, or `DuplicateCreateRequestError` (internal)), `findActiveById(id)` (filters `deleted_at IS NULL`), and `findByCreateRequestId(key)` (returns the project and whether it is deleted), in backend/src/infrastructure/db/PgProjectRepository.ts
- [X] T062 [US1] Implement the `createProject` use case: look up `createRequestId` first (active → return `{ project, replayed: true }`; deleted → `ProjectNotFoundError`); build with `Project.create(input, clock.today(), generator.next())`; run each insert attempt in its **own** unit of work (a failed INSERT aborts the PostgreSQL transaction); retry on charge-code collision up to 5 attempts total, then throw `ChargeCodeUnavailableError`; on `DuplicateCreateRequestError` re-read and return the replay, in backend/src/application/project/createProject.ts
- [X] T063 [P] [US1] Implement the `getProject` use case (active project or `ProjectNotFoundError`), in backend/src/application/project/getProject.ts
- [X] T064 [P] [US1] Implement the response mapper from domain `Project` to the contract `Project` schema (`id`, `chargeCode`, `name`, `projectManager { name, email }`, `startDate`, `endDate`, `projectType`, `clientName`, `billingType`, `version`, `createdAt`, `updatedAt`; never `createRequestId` or `deletedAt`) and `toETag(version)` → `"<version>"`, in backend/src/http/mappers/projectMapper.ts
- [X] T065 [US1] Implement the project router with `POST /api/v1/projects` (reads `Idempotency-Key`, returns `201` with `Location` and `ETag`, or `200` with `ETag` on replay) and `GET /api/v1/projects/{projectId}` (returns `200` with `ETag`), mounted under the single `/api/v1` router, in backend/src/http/routes/projects.ts
- [X] T066 [US1] Wire `RandomChargeCodeGenerator`, `createProject`, `getProject`, and the project router into the composition root and the test app, in backend/src/server.ts and backend/tests/support/testApp.ts
- [X] T067 [P] [US1] Implement frontend project API functions `createProject(input, idempotencyKey)` and `getProject(id)` returning `{ project, etag }`, in frontend/src/features/projects/api.ts
- [X] T068 [P] [US1] Implement client-side validation mirroring the server rules and messages: required fields; name and Project Manager Name "1–100 chars after trim"; email checked with the same ajv-formats "fast" email pattern used by the server (T022); real calendar dates; End Date on or after Start Date; Client Name required for Client Project. A Start Date before the browser's local date is reported as a **non-blocking hint** (helper text, not an error, does not prevent submit) because the browser's date can differ from `BUSINESS_TIME_ZONE`; the server alone enforces FR-006a, in frontend/src/features/projects/validation.ts
- [X] T069 [US1] Implement `ProjectForm`: sections General (Project Name, Project Type, Client Name shown only for Client Project), Project Manager (Name, Email), Schedule (Start Date, End Date as native date inputs), Billing (Billing Type); required markers with `aria-required`; field errors linked via `aria-describedby`; `ErrorSummary` on submit; optional read-only `chargeCode` display for edit mode; values preserved on error; submit disabled while submitting, in frontend/src/features/projects/ProjectForm.tsx
- [X] T070 [US1] Implement `ProjectCreatePage`: call `usePageTitle("Create project")`; generate the `Idempotency-Key` with `newIdempotencyKey()` (T042) once on mount and reuse it for retries; validate client-side; map `ApiProblem.errors[]` onto fields; on network/5xx show an error alert with Retry and keep values; on `201` navigate to `/projects/{id}` and `notify("Project created. Charge code {chargeCode}.")`; on `200` (replay) navigate to `/projects/{id}` and `notify("This project was already created. Showing the saved project.")` so the user sees the stored values, in frontend/src/features/projects/ProjectCreatePage.tsx
- [X] T071 [US1] Implement the `useProject(id)` hook (loading, data, ETag, not-found, error, `reload`) and `ProjectDetailPage` (page title via `usePageTitle`: "Loading project", then "{name} – Project", or "Project not found"; breadcrumbs "Projects › {name}", all fields with labels and `ChargeCodeText`, an actions area for Edit/Delete added in US3/US4, loading/not-found/error states), in frontend/src/features/projects/useProject.ts and frontend/src/features/projects/ProjectDetailPage.tsx
- [X] T072 [US1] Register routes `/projects/new` → `ProjectCreatePage` and `/projects/:projectId` → `ProjectDetailPage`, in frontend/src/app/routes.tsx

**Checkpoint**: US1 is fully functional and testable on its own (MVP).

---

## Phase 4: User Story 2 - Find and View Projects (Priority: P1)

**Goal**: Users see a paged list of non-deleted projects, search by name, charge code, Project
Manager name/email, or Client Name, sort, and open a project.

**Independent Test**: With several projects present, open `/projects`, search by part of a name,
charge code (e.g. `0041`), manager email, or client name, sort by a column, page, and open a
project's detail view.

### Tests for User Story 2 ⚠️ (write first; they must fail)

- [X] T073 [P] [US2] Write Testcontainers integration tests for `PgProjectRepository.search`: case-insensitive substring match on `name`, `charge_code`, `project_manager_name`, `project_manager_email`, and `client_name`; `0041` matches `00412345`; deleted projects never returned; search terms containing `%`, `_`, and `\` are matched literally; sort by `name` (case-insensitive), `chargeCode`, `startDate`, `endDate` in `asc`/`desc` with `id` as tie-breaker; correct `totalItems` and page slicing; with 10,000 seeded projects a search completes in < 500 ms, in backend/tests/integration/projectRepository.search.test.ts
- [X] T074 [P] [US2] Write unit tests for the `listProjects` use case: trims `search`; empty or whitespace-only search means no filter; `totalPages = ceil(totalItems / pageSize)` and `0` when empty, in backend/tests/unit/application/listProjects.test.ts
- [X] T075 [P] [US2] Write Supertest API tests for `GET /api/v1/projects`: defaults `page=1`, `pageSize=25`, `sort=name`, `order=asc`; `pageSize=101` → `400 INVALID_VALUE`; `sort=createdAt` → `400 INVALID_VALUE`; `page=0` → `400 INVALID_VALUE`; empty database → `200` with `items: []`, `totalItems: 0`, `totalPages: 0`; search finds by manager email and client name; response validated against the contract, in backend/tests/api/listProjects.api.test.ts
- [X] T076 [P] [US2] Write RTL tests for the list page: columns Project Name, Charge Code, Project Manager, Start Date, End Date, Project Type, Billing Type (FR-016); loading state; empty state with "Create project" action when no projects exist; "No matching projects" with "Clear search" when a search has no results; error state with Retry; search runs after a 300 ms pause or on Enter; sortable headers expose `aria-sort`; pagination changes page; search, sort, order, and page reflected in the URL query; the project name links to its detail page; no axe violations, in frontend/tests/features/projects/ProjectListPage.test.tsx
- [X] T077 [US2] Add the Playwright "find" test: create two projects with `uniqueName()` names and client names, search by part of one project's client name and by its charge-code prefix, assert only that project is listed, open it from the list; axe scan of the list page, in e2e/tests/project-lifecycle.spec.ts

### Implementation for User Story 2

- [X] T078 [P] [US2] Implement `escapeLike(term)` escaping `\`, `%`, and `_` for use with `ILIKE … ESCAPE '\'`, in backend/src/infrastructure/db/escapeLike.ts
- [X] T079 [US2] Implement `PgProjectRepository.search(criteria)`: `WHERE deleted_at IS NULL` plus, when a term is given, `(name ILIKE $1 OR charge_code ILIKE $1 OR project_manager_name ILIKE $1 OR project_manager_email ILIKE $1 OR client_name ILIKE $1)` with `$1 = '%' || escaped || '%'`; `ORDER BY` from a fixed whitelist (`name` → `lower(name)`, `chargeCode` → `charge_code`, `startDate` → `start_date`, `endDate` → `end_date`) and direction, then `id`; `LIMIT/OFFSET`; `COUNT(*) OVER()` for `totalItems`, in backend/src/infrastructure/db/PgProjectRepository.ts
- [X] T080 [US2] Implement the `listProjects` use case, in backend/src/application/project/listProjects.ts
- [X] T081 [US2] Add `GET /api/v1/projects` (query `search`, `sort`, `order`, `page`, `pageSize`) returning `ProjectPage`, and wire `listProjects` in the composition root and test app, in backend/src/http/routes/projects.ts, backend/src/server.ts, backend/tests/support/testApp.ts
- [X] T082 [P] [US2] Add `listProjects(params)` to the frontend project API, in frontend/src/features/projects/api.ts
- [X] T083 [P] [US2] Implement `ProjectTable` (MUI Table with caption, sortable headers via `TableSortLabel` for name, charge code, start date, end date with `aria-sort`, name cells linking to `/projects/{id}`, `ChargeCodeText` and formatted dates), in frontend/src/features/projects/ProjectTable.tsx
- [X] T084 [US2] Implement `useProjectList` (reads/writes `search`, `sort`, `order`, `page` in URL search params, 300 ms debounce, loading/error/data, `retry`) and `ProjectListPage` (`usePageTitle("Projects")`, PageHeader "Projects" with "Create project" primary action, labelled "Search projects" field, table, pagination, empty/no-match/error states), and replace the `/projects` placeholder route, in frontend/src/features/projects/useProjectList.ts, frontend/src/features/projects/ProjectListPage.tsx, frontend/src/app/routes.tsx

**Checkpoint**: US1 and US2 together form the complete P1 slice; each remains independently
testable.

---

## Phase 5: User Story 3 - Edit a Project (Priority: P2)

**Goal**: Users edit any field except the charge code, with the same validation as create plus the
edit-only date rules and protection against overwriting someone else's changes.

**Independent Test**: Edit an existing project's name and extend its End Date; confirm the changes
are shown and the charge code is unchanged; a stale edit is rejected with a reload prompt.

### Tests for User Story 3 ⚠️ (write first; they must fail)

- [X] T085 [P] [US3] Write unit tests for `project.update(input, today)`: charge code unchanged; an unchanged Start Date already in the past is accepted; a changed Start Date before today → `START_DATE_IN_PAST`; End Date earlier than the saved End Date → `END_DATE_SHORTENED`; extended End Date accepted; End Date before (new) Start Date → `END_BEFORE_START`; `CLIENT` → `INTERNAL` clears `clientName`; `INTERNAL` → `CLIENT` without Client Name → `CLIENT_NAME_REQUIRED`; `version` increments by 1, in backend/tests/unit/domain/projectUpdate.test.ts
- [X] T086 [P] [US3] Write unit tests for the `updateProject` use case: missing or deleted project → `ProjectNotFoundError`; `expectedVersion` different from current → `VersionConflictError`; repository returns no row on update → re-read distinguishes not-found from version conflict; duplicate name → `ProjectNameTakenError`, in backend/tests/unit/application/updateProject.test.ts
- [X] T087 [P] [US3] Write Testcontainers integration tests for `PgProjectRepository.update`: succeeds only when `version` matches and the row is not deleted; stale version updates 0 rows; `charge_code` is unchanged after every update; renaming to another active project's name in different case violates `project_name_active_uq`; renaming to a deleted project's name succeeds; two concurrent updates with the same expected version → exactly one succeeds, in backend/tests/integration/projectRepository.update.test.ts
- [X] T088 [P] [US3] Write Supertest API tests for `PUT /api/v1/projects/{projectId}`: `200` with `ETag: "2"` and unchanged `chargeCode`; missing `If-Match` → `428 PRECONDITION_REQUIRED` produced by the route handler (the header is optional in the OpenAPI schema, so the request validator must not answer `400`); malformed `If-Match` (`abc`, `"0"`, `W/"1"`, `"1.5"`) → `400 VALIDATION_FAILED` with `errors[0].field = "If-Match"` and `code = "INVALID_FORMAT"`; stale `If-Match` → `412 VERSION_CONFLICT`; deleted or unknown id → `404`; duplicate name → `409`; changed Start Date in the past → `422 START_DATE_IN_PAST`; shortened End Date → `422 END_DATE_SHORTENED`; body containing `chargeCode` → `400 UNKNOWN_FIELD`, in backend/tests/api/updateProject.api.test.ts
- [X] T089 [P] [US3] Write RTL tests for the edit page: form prefilled from the project; charge code displayed read-only and not submitted; `If-Match` header sent with the loaded ETag; `412` shows "This project was changed by someone else" with a "Reload" action that refetches; `404` shows "Project not found"; leaving with unsaved changes prompts a confirmation; success navigates to detail and announces "Project updated"; no axe violations, in frontend/tests/features/projects/ProjectEditPage.test.tsx
- [X] T090 [US3] Add the Playwright "edit" test: from the created project's detail page choose Edit, change the name and extend the End Date, save, assert the new values are shown and the charge code is unchanged; axe scan of the edit page, in e2e/tests/project-lifecycle.spec.ts

### Implementation for User Story 3

- [X] T091 [US3] Implement `project.update(input, today)`: run `validateProjectFields`; if `startDate` changed and is before `today` → `START_DATE_IN_PAST` (FR-006a); if `endDate` is before the saved `endDate` → `END_DATE_SHORTENED` (FR-006b); keep `chargeCode`; `CLIENT → INTERNAL` sets `clientName = null`; increment `version`, in backend/src/domain/project/Project.ts
- [X] T092 [US3] Implement `PgProjectRepository.update(project, expectedVersion)`: `UPDATE project SET name, project_manager_name, project_manager_email, start_date, end_date, project_type, client_name, billing_type, version = version + 1, updated_at = now() WHERE id = $1 AND version = $2 AND deleted_at IS NULL RETURNING *` — `charge_code` is never in the `SET` list; returns `null` when no row was updated; maps `project_name_active_uq` to `ProjectNameTakenError`, in backend/src/infrastructure/db/PgProjectRepository.ts
- [X] T093 [US3] Implement the `updateProject` use case within one unit of work: `findActiveById` (else `ProjectNotFoundError`), compare `expectedVersion` (else `VersionConflictError`), `project.update(input, clock.today())`, `repository.update`; on `null` re-read to raise `ProjectNotFoundError` or `VersionConflictError`, in backend/src/application/project/updateProject.ts
- [X] T094 [US3] Add `PUT /api/v1/projects/{projectId}`: the handler enforces `If-Match` itself — missing → throw `PreconditionRequiredError` (`428 PRECONDITION_REQUIRED`); present but not a quoted positive integer `"<n>"` → throw `InvalidIfMatchError` (`400 VALIDATION_FAILED`, field `If-Match`, code `INVALID_FORMAT`); otherwise pass `n` as `expectedVersion` to `updateProject` (a mismatch there yields `412 VERSION_CONFLICT`); return `200` with `ETag`; wire in the composition root and test app, in backend/src/http/routes/projects.ts, backend/src/server.ts, backend/tests/support/testApp.ts
- [X] T095 [P] [US3] Add `updateProject(id, input, etag)` to the frontend project API (sends `If-Match`), in frontend/src/features/projects/api.ts
- [X] T096 [US3] Implement `ProjectEditPage`: `usePageTitle("Edit {project name}")` (or "Loading project" / "Project not found"); load with `useProject`, render `ProjectForm` in edit mode with read-only charge code, track unsaved changes (React Router `useBlocker` plus `beforeunload`), handle `412` with a Reload action, `404` not found, field errors, and success → navigate to detail with `notify("Project updated.")`; register `/projects/:projectId/edit`; add an "Edit" action on the detail page, in frontend/src/features/projects/ProjectEditPage.tsx, frontend/src/app/routes.tsx, frontend/src/features/projects/ProjectDetailPage.tsx

**Checkpoint**: US1–US3 work independently.

---

## Phase 6: User Story 4 - Delete a Project (Priority: P3)

**Goal**: Users soft-delete a project after confirming; it disappears from all views but its data
and charge code are kept and the code is never reused.

**Independent Test**: Delete a project, confirm it is gone from the list, search, and detail views,
that its row is still stored with `deleted_at` set, and that new projects never receive its
charge code.

### Tests for User Story 4 ⚠️ (write first; they must fail)

- [X] T097 [P] [US4] Write unit tests for `project.delete(now)` (sets `deletedAt`, increments `version`) and the `deleteProject` use case (missing or already deleted → `ProjectNotFoundError`), in backend/tests/unit/domain/projectDelete.test.ts and backend/tests/unit/application/deleteProject.test.ts
- [X] T098 [P] [US4] Write Testcontainers integration tests for `PgProjectRepository.softDelete`: sets `deleted_at` and `updated_at`, increments `version`, row still exists; `findActiveById` then returns `null`; `search` excludes it; its charge code still blocks reuse; deleting again affects 0 rows, in backend/tests/integration/projectRepository.delete.test.ts
- [X] T099 [P] [US4] Write Supertest API tests for `DELETE /api/v1/projects/{projectId}`: `204`; then `GET` → `404`, `DELETE` again → `404`, `PUT` → `404`; list no longer contains it; repeating the original create request with its `Idempotency-Key` → `404`, in backend/tests/api/deleteProject.api.test.ts
- [X] T100 [P] [US4] Write RTL tests for the delete dialog: shows the project name and charge code; Cancel closes without a request and returns focus to the Delete button; Confirm sends `DELETE`, navigates to `/projects`, and announces "Project deleted"; `404` shows "Project not found"; no restore or purge action exists; no axe violations, in frontend/tests/features/projects/DeleteProjectDialog.test.tsx
- [X] T101 [US4] Add the Playwright "delete" test: from the detail page choose Delete, confirm, assert the list and a search no longer show the project and visiting its URL shows "Project not found", in e2e/tests/project-lifecycle.spec.ts

### Implementation for User Story 4

- [X] T102 [US4] Implement `project.delete(now)`: requires an active project; sets `deletedAt = now`; increments `version`, in backend/src/domain/project/Project.ts
- [X] T103 [US4] Implement `PgProjectRepository.softDelete(id)`: `UPDATE project SET deleted_at = now(), updated_at = now(), version = version + 1 WHERE id = $1 AND deleted_at IS NULL`, returning whether a row changed — no SQL `DELETE` statement anywhere, in backend/src/infrastructure/db/PgProjectRepository.ts
- [X] T104 [US4] Implement the `deleteProject` use case (one unit of work; `ProjectNotFoundError` when nothing changed), in backend/src/application/project/deleteProject.ts
- [X] T105 [US4] Add `DELETE /api/v1/projects/{projectId}` returning `204`; wire in the composition root and test app, in backend/src/http/routes/projects.ts, backend/src/server.ts, backend/tests/support/testApp.ts
- [X] T106 [P] [US4] Add `deleteProject(id)` to the frontend project API, in frontend/src/features/projects/api.ts
- [X] T107 [US4] Implement `DeleteProjectDialog` (MUI Dialog, title "Delete project?", body with project name and `ChargeCodeText`, Cancel and "Delete project" buttons, deleting state, focus returned on close) and add a "Delete" action on the detail page that opens it, in frontend/src/features/projects/DeleteProjectDialog.tsx and frontend/src/features/projects/ProjectDetailPage.tsx

**Checkpoint**: All four user stories are independently functional.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Documentation, CI quality gates, and end-to-end verification

- [X] T108 [P] Write a log-privacy API test: perform create, update, and failed requests and assert captured log output contains no Project Manager email and no request bodies, in backend/tests/api/logging.api.test.ts
- [X] T109 [P] Write the repository README: purpose, development-only warning (FR-036, Constitution Principle III exemption), prerequisites, `docker compose up --build`, environment variables from `.env.example`, running the backend on the host (copy `.env.local.example` to `.env.local`, start only `docker compose up db migrate`, then `npm run dev -w backend`, which loads `.env.local` via Node's `--env-file`), hot-reload frontend with `npm run dev -w frontend`, pinned base-image tags, npm scripts, test commands per layer, Swagger URL, architecture overview with links to `specs/001-project-management/plan.md` and `research.md`, in README.md
- [X] T110 [P] Create the CI pipeline implementing the Constitution's quality gates in order: `npm ci`; `npm run typecheck`; `npm run format:check` and `npm run lint`; `npm run test:unit`; `npm run test:integration` and `npm run test:api` (Docker available on `ubuntu-latest`); `npm run test:web`; contract check (`npm run generate:api-types` then `git diff --exit-code packages/api-contract/src/schema.d.ts`; the contract's validity is also checked when the API tests load it into `express-openapi-validator`, which fails on an invalid document); `npm run build`; `docker build .`; `Copy-Item`/`cp .env.example .env` then `docker compose up -d --build` then `npm run test:e2e`; `npm audit --audit-level=high`; SonarQube step omitted (deferred per Constitution v1.3.0), in .github/workflows/ci.yml
- [X] T111 Verify the contract copy is in sync: diff `packages/api-contract/openapi.yaml` against `specs/001-project-management/contracts/openapi.yaml`; reconcile any implementation-time change in both files and regenerate types, in packages/api-contract/openapi.yaml
- [X] T112 Run `npm run typecheck`, `npm run lint`, and `npm run format:check` across all workspaces and fix any findings (no `any` without an inline justification), in package.json
- [X] T113 Write a performance smoke script (Node 22 built-in `fetch` and `performance.now()`, run with `tsx`, no new dependency) that, against the running Compose stack: (1) seeds 10,000 projects via `POST /api/v1/projects`, each with a unique name `perf-{runId}-{index}` (`runId` = timestamp plus random digits), a fresh `Idempotency-Key` per request, Start Date = today in UTC, and a client name for Client Projects, with at most 20 requests in flight; the seeding phase is **not** timed and aborts on any non-`201` response; (2) then measures 200 requests each of create (new unique names and keys), get-by-id, update (with the current `If-Match`), and search (mixed terms: name fragment, charge-code prefix, manager email, client name); (3) fails if p95 exceeds the plan's targets (create/read/update < 300 ms; list/search < 500 ms) and prints p50/p95/max per operation; add root script `perf:smoke`, in backend/scripts/perf-smoke.ts and package.json
- [X] T114 Run every validation scenario V1–V15 in quickstart.md against a fresh `docker compose up --build` (start with `docker compose down -v`), including the keyboard-only runs (V14) and the production guard (V15); run `npm run perf:smoke` **last** because it seeds 10,000 projects (V8 needs an empty database), then reset with `docker compose down -v`; record any deviations as follow-up tasks, in specs/001-project-management/quickstart.md
- [ ] T115 Follow-up from T114: a human reviewer performs the manual keyboard-only runs of V1, V9, and V12 (V14) in a real browser; automated axe scans (Playwright, all three browsers) and jest-axe already pass, in specs/001-project-management/quickstart.md

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies. T011 runs after T001–T010.
- **Foundational (Phase 2)**: Depends on Setup. **Blocks all user stories.**
- **User Stories (Phases 3–6)**: Each depends only on Foundational. They can run in parallel by
  different people or sequentially in priority order (US1 → US2 → US3 → US4).
- **Polish (Phase 7)**: Depends on the stories you plan to ship.

### User Story Dependencies

- **US1 (P1)**: Independent once Foundational is done. Contains the read-by-id endpoint and detail
  page.
- **US2 (P1)**: Independent of US1 for its tests (seeds data directly). The list links to
  `/projects/:projectId`, which US1 provides; without US1 the link leads to the not-found route.
- **US3 (P2)**: Uses `GET /projects/{id}` and `ProjectDetailPage` from US1 to load and return to
  the project. Its backend tests seed data directly.
- **US4 (P3)**: Adds a button and dialog to `ProjectDetailPage` from US1. Its backend tests seed
  data directly.

### Shared-file sequencing (same file, so not parallel across stories)

- `backend/src/domain/project/Project.ts`: T026 → T059 (US1) → T091 (US3) → T102 (US4)
- `backend/src/infrastructure/db/PgProjectRepository.ts`: T030 → T061 → T079 → T092 → T103
- `backend/src/http/routes/projects.ts`: T065 → T081 → T094 → T105
- `backend/src/server.ts` / `backend/tests/support/testApp.ts`: T036/T039 → T066 → T081 → T094 → T105
- `frontend/src/features/projects/api.ts`: T067 → T082 → T095 → T106
- `frontend/src/app/routes.tsx`: T047 → T072 → T084 → T096
- `frontend/src/features/projects/ProjectDetailPage.tsx`: T071 → T096 → T107
- `e2e/tests/project-lifecycle.spec.ts`: T058 → T077 → T090 → T101

### Within Each User Story

- Tests first (they must fail), then domain → repository → use case → route → frontend API →
  components/pages → routes.
- A story is done when all its tests pass and its checkpoint is verified.

### Parallel Opportunities

- Setup: T002–T010 in parallel.
- Foundational: T012, T014, T015, T017–T025, T029, T031–T034, T037, T038, T040–T046, T048 in
  parallel (respecting each test-then-implementation pair).
- Each story: all test tasks marked [P] in parallel; then the [P] implementation tasks.
- Across stories: after Foundational, different developers can take US1, US2, US3, and US4,
  sequencing only the shared files listed above.

---

## Parallel Example: User Story 1

```text
# Tests (all [P], different files):
T051 backend/tests/unit/domain/projectCreate.test.ts
T052 backend/tests/unit/application/createProject.test.ts
T053 backend/tests/integration/projectRepository.create.test.ts
T054 backend/tests/api/createProject.api.test.ts
T055 backend/tests/api/getProject.api.test.ts
T056 frontend/tests/features/projects/ProjectCreatePage.test.tsx
T057 frontend/tests/features/projects/ProjectDetailPage.test.tsx
T058 e2e/tests/project-lifecycle.spec.ts

# Then implementation in parallel where marked [P]:
T060 backend/src/infrastructure/charge-code/RandomChargeCodeGenerator.ts
T063 backend/src/application/project/getProject.ts
T064 backend/src/http/mappers/projectMapper.ts
T067 frontend/src/features/projects/api.ts
T068 frontend/src/features/projects/validation.ts
```

## Parallel Example: User Story 2

```text
T073 backend/tests/integration/projectRepository.search.test.ts
T074 backend/tests/unit/application/listProjects.test.ts
T075 backend/tests/api/listProjects.api.test.ts
T076 frontend/tests/features/projects/ProjectListPage.test.tsx
# then
T078 backend/src/infrastructure/db/escapeLike.ts
T082 frontend/src/features/projects/api.ts
T083 frontend/src/features/projects/ProjectTable.tsx
```

## Parallel Example: User Story 3

```text
T085 backend/tests/unit/domain/projectUpdate.test.ts
T086 backend/tests/unit/application/updateProject.test.ts
T087 backend/tests/integration/projectRepository.update.test.ts
T088 backend/tests/api/updateProject.api.test.ts
T089 frontend/tests/features/projects/ProjectEditPage.test.tsx
```

## Parallel Example: User Story 4

```text
T097 backend/tests/unit/domain/projectDelete.test.ts + backend/tests/unit/application/deleteProject.test.ts
T098 backend/tests/integration/projectRepository.delete.test.ts
T099 backend/tests/api/deleteProject.api.test.ts
T100 frontend/tests/features/projects/DeleteProjectDialog.test.tsx
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup.
2. Complete Phase 2: Foundational (blocks all stories).
3. Complete Phase 3: US1.
4. **Stop and validate**: run the US1 tests and quickstart scenarios V1–V6.
5. Demo in a lower environment if ready (never production, FR-036).

### Incremental Delivery

1. Setup + Foundational → foundation ready.
2. + US1 → create and view (MVP).
3. + US2 → find and browse (complete P1 slice).
4. + US3 → edit.
5. + US4 → delete.
6. Polish → CI gates, README, full quickstart validation.

### Parallel Team Strategy

1. The team completes Setup and Foundational together.
2. Then: Developer A on US1, Developer B on US2, Developer C on US3 (backend first), Developer D
   on US4 (backend first), coordinating the shared files listed above.

---

## Notes

- [P] = different files, no dependency on incomplete tasks.
- [Story] labels trace tasks to spec user stories; FR references trace to requirements.
- Verify each test fails before implementing it.
- Commit after each task or logical group, referencing the task ID.
- Stop at any checkpoint to validate a story on its own.
