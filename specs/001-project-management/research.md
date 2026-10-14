# Research & Architecture Decisions: Project Management

**Feature**: `001-project-management` | **Date**: 2026-10-06 | **Plan**: [plan.md](plan.md)

This document resolves every open technical question for the feature and records the
architecture decisions that the Constitution (v1.3.0, "Decisions Pending") requires before the
first feature is planned. Each decision uses the format Decision / Rationale / Alternatives.

---

## R1. Repository layout

- **Decision**: Single Git repository using **npm workspaces** with four workspaces: `backend/`,
  `frontend/`, `packages/api-contract/` (OpenAPI document + generated TypeScript types), and
  `e2e/` (Playwright). Shared root config for TypeScript (`tsconfig.base.json`), ESLint (flat
  config), and Prettier.
- **Rationale**: One place for the API contract that both frontend and backend consume, one
  lockfile, one CI pipeline. npm workspaces ship with Node.js, so no extra tooling is needed.
- **Alternatives considered**: Separate repositories (contract drift, duplicated CI); Nx or
  Turborepo (unjustified extra tooling for two apps); pnpm/Yarn workspaces (adds a package
  manager without a clear benefit at this size).

## R2. Backend architecture

- **Decision**: Layered modular monolith in `backend/src/`:
  - `domain/` — `Project` aggregate, value objects (`ChargeCode`, `ProjectName`, `EmailAddress`,
    `CalendarDate`), domain errors, and ports (`ProjectRepository`, `ChargeCodeGenerator`,
    `Clock`). No imports from Express, `pg`, or any infrastructure library.
  - `application/` — one use case per operation (`createProject`, `getProject`, `listProjects`,
    `updateProject`, `deleteProject`); owns transaction boundaries via a `UnitOfWork` port.
  - `infrastructure/` — PostgreSQL repository, random charge-code generator, business-time-zone
    clock, configuration, logging.
  - `http/` — Express app, routers, OpenAPI validation, Problem Details error mapping, health
    checks, Swagger UI.
- **Rationale**: Satisfies Principle II (dependencies point to the domain; business rules
  unit-testable without HTTP or DB). The three ports each isolate infrastructure **and** enable
  deterministic tests (fixed clock, predictable charge codes, fake repository), so they meet the
  Constitution's "abstraction only where meaningful" test.
- **Alternatives considered**: Controller-service-model without ports (business rules leak into
  SQL/handlers; hard to test date rules); full hexagonal/CQRS (unjustified complexity).

## R3. Data access and migrations

- **Decision**: **`pg` (node-postgres)** with hand-written, parameterized SQL inside
  `PgProjectRepository`; **`node-pg-migrate`** for forward-only, version-controlled SQL migrations.
- **Rationale**: Only one table and ~6 queries; direct SQL gives full access to PostgreSQL features
  needed here (partial unique index, `CHECK` constraints, `ILIKE` with escaping, constraint names
  for error mapping) with no code generation or runtime abstraction. Parameterized queries are
  required by Principle III. `node-pg-migrate` is a mature, SQL-friendly migration runner that
  works with plain `pg` and runs identically in Docker Compose and Testcontainers.
- **Alternatives considered**: Prisma (schema DSL + codegen; partial unique indexes and custom
  `CHECK`s need raw SQL anyway); TypeORM (heavier, decorator-driven entities couple domain to ORM);
  Drizzle/Kysely (good type safety, but an extra abstraction not yet justified by query volume —
  revisit when more aggregates arrive).

## R4. API contract and request validation

- **Decision**: **Contract-first OpenAPI 3.0.3**. The document in
  `packages/api-contract/openapi.yaml` (initialized from [contracts/openapi.yaml](contracts/openapi.yaml))
  is the single source of truth:
  - Backend: **`express-openapi-validator`** validates every request (structure, types, enums,
    formats, `additionalProperties: false`) and — in development/test — every response against
    the contract. It is scoped with `ignorePaths` to `/api/v1/*` and `/health/*` and mounted
    **after** the frontend's static files and SPA fallback, so browser routes and assets are
    never treated as unknown API paths. Format checking is pinned to `validateFormats: "fast"`,
    and the domain `EmailAddress` uses the same email pattern, so an email is never accepted by
    one layer and rejected by the other.
  - Types: **`openapi-typescript`** generates TypeScript types consumed by backend handlers and the
    frontend API client.
  - Docs: **`swagger-ui-express`** serves the same document at `/api/docs` when
    `SWAGGER_ENABLED=true` (never in production).
  - Business rules (blank-after-trim, date rules, conditional Client Name, uniqueness) are enforced
    in the domain, not in the schema.
- **Rationale**: Principle IV requires the OpenAPI document to match runtime behavior and be
  verified in CI; validating requests and responses against the document in API tests makes drift
  a test failure. Keeping structural checks in the schema and business rules in the domain
  matches the Constitution's distinction between syntactic, structural, and business validation.
- **Alternatives considered**: Code-first with Zod + `zod-to-openapi` (good DX, but the contract
  becomes a build artifact and reviewers lose a stable, diffable API document); hand-written
  validation (duplicates the contract).

## R5. API conventions

- **Decision**:
  - Versioning: URL prefix **`/api/v1`**.
  - Resource: `/api/v1/projects` and `/api/v1/projects/{projectId}`; IDs are UUIDs.
  - Update: `PUT` (full replacement of editable fields) — simplifies cross-field rules (dates,
    Client Name).
  - Errors: **RFC 9457 Problem Details** (`application/problem+json`) extended with `code`,
    `requestId`, and `errors[]` (`field`, `code`, `message`) for field-level messages.
  - Status codes: `400` structural validation (including a malformed `If-Match`), `404` not
    found / deleted (`PROJECT_NOT_FOUND`) or undocumented path (`ROUTE_NOT_FOUND`), `405`
    unsupported method (`METHOD_NOT_ALLOWED`), `409` name already in use, `412` version conflict,
    `422` business-rule violation, `428` missing `If-Match`, `503` charge code could not be
    generated, `500` unexpected (generic message only).
  - Validator-to-field-code mapping: `required`/`minLength` → `REQUIRED`; `maxLength` →
    `TOO_LONG`; `additionalProperties` → `UNKNOWN_FIELD`; `format` → `INVALID_DATE` /
    `INVALID_EMAIL` / `INVALID_FORMAT`; `enum`/`minimum`/`maximum`/`pattern` → `INVALID_VALUE`.
  - Pagination: `page` (≥1, default 1), `pageSize` (1–100, default 25); response contains
    `items`, `page`, `pageSize`, `totalItems`, `totalPages`.
- **Rationale**: Standard, documented error shape lets the UI map field errors uniformly and keeps
  internals out of responses (FR-026, FR-028). Distinct 400/422 satisfies the Constitution's
  syntactic vs. business validation distinction.
- **Alternatives considered**: Header-based versioning (harder to test/explore); custom error
  envelope (non-standard); `PATCH` with JSON Merge Patch (more complex cross-field validation).

## R6. Charge code generation (FR-010 – FR-015)

- **Decision**: Generate a **cryptographically random integer 0–99,999,999** (`crypto.randomInt`),
  left-pad to 8 digits, and insert. A `UNIQUE` constraint on `charge_code` across **all** rows
  (active and deleted) guarantees uniqueness and non-reuse. On a charge-code unique violation the
  use case retries with a new code, up to **5 attempts**; if all fail it returns `503`
  `CHARGE_CODE_UNAVAILABLE` and nothing is saved (FR-015). The generator sits behind the
  `ChargeCodeGenerator` port and runs **in the backend application**; the database only stores
  and enforces uniqueness (no sequence or column default). `charge_code` is never included in any
  `UPDATE` statement, making it immutable after insert (FR-014). *Confirmed by the product owner
  on 2026-10-06.*
- **Rationale**: Codes are opaque (no sequence to guess or infer project volume), leading zeros are
  naturally valid (FR-011), and correctness relies on the database constraint rather than
  application locking, so concurrent creates are safe (SC-002). With 10⁸ possible codes and a
  design target of ≤100k projects, the chance of even one retry per create is ≤0.1%.
- **Alternatives considered**: PostgreSQL sequence with `LPAD` (simple, but sequential codes like
  `00000001` leak volume and look non-opaque); sequence + format-preserving permutation (opaque
  and collision-free, but more code to own and test than the risk warrants); pre-generated code
  pool table (extra table and replenishment job).

## R7. Project name uniqueness (FR-007, FR-008)

- **Decision**: Store the trimmed name. Enforce uniqueness with a **partial unique index on
  `lower(name)` WHERE `deleted_at IS NULL`**. The repository maps a violation of that index to
  `NameAlreadyInUseError` → `409 PROJECT_NAME_TAKEN`.
- **Rationale**: The database guarantees the rule under concurrent create/rename (spec edge case)
  without race-prone "check then insert" logic; deleted names are excluded so they can be reused.
- **Alternatives considered**: `citext` extension (adds an extension for one column); application
  pre-check only (race condition).

## R8. Concurrent edits (FR-020, SC-006)

- **Decision**: **Optimistic locking** with an integer `version` column. Responses return
  `ETag: "<version>"`; `PUT` requires `If-Match: "<version>"`. The update runs
  `UPDATE … WHERE id = $1 AND version = $2 AND deleted_at IS NULL`; zero rows → reload to
  distinguish `404` (deleted/missing) from `412 VERSION_CONFLICT`. The header is **optional in the
  OpenAPI schema** and enforced by the PUT handler, so the request validator never turns a missing
  header into `400`: missing → `428 PRECONDITION_REQUIRED`; not a quoted positive integer →
  `400 VALIDATION_FAILED`; stale → `412`.
  Delete increments `version` too, so a concurrent edit after delete yields `404`.
- **Rationale**: Standard HTTP semantics, no locks held across user think-time, and directly
  testable.
- **Alternatives considered**: Pessimistic row locks (unsuitable across HTTP requests);
  last-write-wins (violates SC-006); timestamp comparison (precision pitfalls).

## R9. Duplicate submission prevention (FR-009)

- **Decision**: The client generates a UUID **`Idempotency-Key`** when the create form opens and
  sends it with `POST`. The key comes from `newIdempotencyKey()`, which uses `crypto.randomUUID()`
  when available and otherwise builds a v4 UUID from `crypto.getRandomValues` (`randomUUID` exists
  only in secure contexts, and lower environments may use plain HTTP). It is stored in a `UNIQUE`
  column `create_request_id`. A repeated request
  with the same key returns the already-created project with `200` (first success returns `201`).
  The UI also disables the submit button while a request is in flight. On a replay (`200`) the UI
  shows the saved project with the notice "This project was already created. Showing the saved
  project.", so a user who edited the form before retrying sees what was actually stored.
- **Rationale**: Covers double-clicks and retries after timeouts (where the first request may have
  succeeded). Storing the key on the project row avoids a separate idempotency table.
- **Alternatives considered**: UI-only button disabling (does not cover network retries); separate
  idempotency-key table with TTL (more moving parts than needed).

## R10. Soft deletion (FR-021, FR-022)

- **Decision**: Nullable `deleted_at timestamptz`. `PgProjectRepository` is the **single
  mechanism** that excludes deleted rows: every read/update method includes
  `deleted_at IS NULL`; only charge-code uniqueness spans all rows. No hard-delete path exists in
  code or API. Delete is `DELETE /api/v1/projects/{id}` → `204`; already deleted → `404`.
- **Rationale**: Meets Principle V (soft delete by default, no implicit hard delete, restore/purge
  explicitly out of scope).
- **Alternatives considered**: Boolean `is_deleted` (loses when); moving rows to an archive table
  (complicates charge-code uniqueness); database view `active_project` (adds an object; reconsider
  if more read paths appear).

## R11. Dates and "today" (FR-006, FR-006a, FR-006b)

- **Decision**: Store dates as PostgreSQL **`date`**; transport as ISO `YYYY-MM-DD` strings; model
  them in the domain as a `CalendarDate` value object (string-backed, compared lexicographically).
  "Today" comes from the `Clock` port, implemented with the built-in `Intl.DateTimeFormat` using
  the IANA time zone in **`BUSINESS_TIME_ZONE`** (validated at startup). No date library.
  The frontend uses the browser's local date only for a **non-blocking hint** (it never prevents
  submission, because the browser's date can differ from the business time zone); the backend
  decides.
- **Rationale**: Calendar dates have no time-of-day or offset, avoiding JavaScript `Date` time-zone
  bugs. A single configurable business zone matches the spec assumption. `Intl` is built in.
- **Alternatives considered**: `Date`/`timestamptz` (time-zone drift); date-fns/Luxon/Temporal
  polyfill (unneeded dependency for comparisons and "today").

## R12. Frontend stack

- **Decision**:
  - Build/dev server: **Vite** (React + TypeScript template).
  - Routing: **React Router** (`/projects`, `/projects/new`, `/projects/:projectId`,
    `/projects/:projectId/edit`; `/` redirects to `/projects`).
  - UI components: **MUI (Material UI)** with a custom neutral enterprise theme (no third-party
    branding), using its accessible table, dialog, form, and snackbar components. *Confirmed by
    the product owner on 2026-10-06.*
  - Data access: a thin typed `fetch` wrapper using the generated contract types; small custom
    hooks for loading/error state. **No global state library** and **no form library** (one form
    with ~9 fields).
  - Client validation mirrors the field rules for fast feedback; server responses remain
    authoritative and their `errors[]` are mapped onto fields.
  - Page titles: a small `usePageTitle` hook sets a unique `document.title` per route
    (`"{page} – timesheet-demo"`), updated on client-side navigation (WCAG 2.4.2). No extra
    dependency.
- **Rationale**: Principle IX requires accessible, consistent UI with loading/empty/error states;
  a mature component library provides WCAG-tested primitives (focus management in dialogs,
  keyboard-operable tables) that would be costly and risky to build. Keeping state local follows
  the Constitution's "simplest state management" rule.
- **Alternatives considered**: Create React App (deprecated); Next.js (an alternative core
  framework; SSR not needed); Fluent UI (also strong, smaller community); hand-built components
  (accessibility risk); TanStack Query / Redux (unjustified for four pages); React Hook Form
  (unjustified for one form).

## R13. Testing strategy (user input: "Jest for unit testing, Playwright for integration tests")

- **Decision**: Follow the Constitution v1.3.0 toolchain; the user's input maps onto it as follows:

  | Layer | Tool | Scope in this feature |
  |---|---|---|
  | Unit | **Jest** (`ts-jest`) | Domain rules (dates, names, Client Name, charge code format), use cases with fakes |
  | DB integration | Jest + **Testcontainers** (`@testcontainers/postgresql`) | Migrations, constraints, partial unique index, optimistic locking, soft-delete filtering, concurrent creates |
  | API | Jest + **Supertest** | Every endpoint: success, 400/404/405/409/412/422/428/503, Problem Details shape, response matches OpenAPI |
  | Frontend | Jest + **React Testing Library** (+ `user-event`, `jest-axe`) | Forms, validation messages, loading/empty/error states, delete dialog, a11y smoke checks |
  | End-to-end ("integration through the browser") | **Playwright** (+ `@axe-core/playwright`) | Create → view → edit → delete journey against the Docker Compose stack; WCAG checks per page |

- **Rationale**: "Playwright for integration tests" is interpreted as browser-level, full-stack
  integration (end-to-end). Constitution Principle VIII still requires DB integration tests
  against real PostgreSQL (Testcontainers) and API tests (Supertest); Playwright cannot replace
  those because it cannot exercise constraint and concurrency behavior precisely.
- **Alternatives considered**: Playwright as the only integration layer (violates Principle VIII;
  slow feedback for DB rules); Vitest (prohibited by Constitution without amendment).

## R14. Observability

- **Decision**: **`pino`** structured JSON logs + **`pino-http`** request logging. Request ID taken
  from `X-Request-Id` (if a valid UUID) or generated, echoed in the response header and in every
  Problem Details body. Request/response bodies are **not** logged (Project Manager email is
  personal data). Health: `GET /health/live` (process up) and `GET /health/ready` (`SELECT 1`).
  Metrics endpoint deferred (Constitution: SHOULD).
- **Rationale**: Meets Principle VII with minimal footprint; the logger is wrapped in a small
  `Logger` interface so the vendor is replaceable.
- **Alternatives considered**: Winston (slower, more config); OpenTelemetry now (no backend chosen
  yet; add with the observability decision).

## R15. Security controls and development-only guard

- **Decision**:
  - **Production guard**: on startup the backend exits with a clear error if
    `APP_ENV=production` (FR-036, Principle III exemption). Allowed values: `development`, `test`,
    `staging`.
  - **`helmet`** security headers; `express.json({ limit: '100kb' })`; `x-powered-by` disabled.
  - Same-origin deployment (Express serves the built frontend and the API), so no CORS middleware.
  - All SQL parameterized; search input has `%`, `_`, `\` escaped before `ILIKE`.
  - Secrets only via environment variables; `.env.example` contains placeholders only.
  - Single `/api/v1` router so authentication middleware can be added later in one place.
- **Rationale**: Applies every Principle III rule that remains in force under the exemption and
  makes "MUST NOT be deployed to production" enforceable by the application itself.
- **Alternatives considered**: Relying on pipeline convention only (not enforceable); interim
  API-key auth (throwaway, invents identity rules the spec excludes).

## R16. Containerization and local environment

- **Decision**: Docker Compose services:
  - `db` — PostgreSQL 16 Alpine pinned to an exact minor tag, named volume, health check.
  - `migrate` — the app image running `node-pg-migrate up` with `env_file: .env` (same
    `DATABASE_URL` as `app`); runs to completion before `app`.
  - `app` — one multi-stage image (root `Dockerfile`, Node.js 22 Alpine pinned to an exact patch
    tag) that builds the frontend and backend and runs as the non-root `node` user from
    `WORKDIR /app`. Express serves the API, Swagger UI, health checks, and the built frontend
    (`express.static` plus an SPA fallback written as plain middleware — Express 5 rejects
    `app.get("*")` — that returns `index.html` for non-API `GET`s). The runtime stage installs
    only the backend's production dependencies (`npm ci --omit=dev -w backend`, with every
    workspace `package.json` copied so the lockfile validates).
  - File locations are configuration, not working-directory assumptions: `CONTRACT_PATH` and
    `STATIC_DIR` default to repository paths resolved from the module location (local
    development) and are set by the image to `/app/packages/api-contract/openapi.yaml` and
    `/app/frontend/dist`. They are not set in `.env`, so the same `.env` works locally and in
    Compose.
  - Configuration via `.env` (copied from `.env.example`); backend validates config at startup and
    fails fast.
  - Local development outside containers: Vite dev server with a proxy for `/api` and `/health`
    to the backend; the backend can also run on the host with `npm run dev -w backend`, which
    loads `.env.local` (copied from `.env.local.example`, database at `localhost:5432`) through
    Node's built-in `--env-file` — no `dotenv` dependency — while `db` and `migrate` run in
    Compose.
- **Rationale**: Simplest reproducible setup (Principle X, XI): one runtime container, no extra
  web server, same origin without CORS, and migrations run explicitly and repeatably. *Product
  owner decision on 2026-10-06: no nginx for now.*
- **Alternatives considered**: nginx container for static files and proxy (rejected for now as an
  extra infrastructure component; can be introduced later if static-asset performance or separate
  frontend releases require it); Vite dev server in containers (not a production-grade build).

## R17. Code quality

- **Decision**: TypeScript `strict` everywhere (`tsc --noEmit` per workspace); ESLint flat config
  with `typescript-eslint` (type-aware), `eslint-plugin-react-hooks`, `eslint-plugin-jsx-a11y`,
  and `eslint-config-prettier`; Prettier for formatting. SonarQube adoption deferred (Constitution
  v1.3.0).
- **Rationale**: Matches the Constitution toolchain; `jsx-a11y` catches accessibility defects early
  (SC-007).
- **Alternatives considered**: Biome (would replace mandated ESLint/Prettier).

## R18. Module format, Jest configuration, and dev runner

- **Decision**:
  - Backend compiles to **CommonJS** (`"module": "commonjs"`, `"moduleResolution": "node10"`).
  - Jest configuration files are plain **`jest.config.cjs`** in `backend/` and `frontend/`, so
    Jest loads them without `ts-node`. TypeScript tests are transformed by `ts-jest` (backend uses
    its CommonJS `tsconfig.json`; frontend overrides `jsx: react-jsx` and `module: commonjs`).
  - Integration tests apply migrations by running the `node-pg-migrate` CLI in a child process
    (`process.execPath` plus the CLI path resolved from the package's `bin` entry, so it works on
    Windows without shell shims), so the test runtime does not depend on that library's module
    format.
  - The shared contract package exposes TypeScript declarations only (`"types": "src/index.d.ts"`,
    no `"main"`) and is a dev dependency of backend and frontend. A `.d.ts` entry is never
    compiled as consumer source, so the backend's `rootDir` is not violated; consumers must use
    `import type` (enforced by `@typescript-eslint/consistent-type-imports`), so nothing from it
    is loaded at runtime.
  - Backend TypeScript configs: `tsconfig.json` (type checking and ts-jest; includes `src`,
    `tests`, `scripts`; `noEmit`) and `tsconfig.build.json` (`rootDir: src`, `outDir: dist`,
    includes `src` only) so tests and scripts never trip `rootDir`.
  - Backend development runner: **`tsx`** (`tsx watch --env-file=../.env.local src/server.ts`) for
    fast reload without a separate compile step. Production and containers run compiled `dist/`
    with plain `node`.
- **Rationale**: CommonJS keeps Jest + ts-jest configuration simple and avoids experimental ESM
  flags; `.cjs` config removes the only reason `ts-node` would be needed. `tsx` gives a
  single-command, watch-mode dev loop for TypeScript.
- **Alternatives considered**: ESM backend (requires Jest ESM mode and extra flags);
  `jest.config.ts` (requires `ts-node`, an extra dependency only for loading config);
  `node --watch dist/server.js` with `tsc --watch` (no extra dependency, but two watch processes
  and slower restarts; acceptable fallback if `tsx` is removed); `ts-node-dev` (slower).
- **Not used**: `identity-obj-proxy` (no CSS Modules in this design) and `ts-node`.

---

## Dependency justification (Constitution Principle X)

| Package | Workspace | Purpose | Why not built in-house |
|---|---|---|---|
| `express` (v5) | backend | Mandated HTTP framework | Mandated |
| `pg` | backend | PostgreSQL driver | Required to talk to PostgreSQL |
| `node-pg-migrate` | backend | Versioned migrations | Constitution requires managed migrations |
| `express-openapi-validator` | backend | Request/response validation from OpenAPI | Keeps runtime in sync with contract |
| `swagger-ui-express`, `yaml` | backend | Swagger UI; load YAML contract | Mandated Swagger UI |
| `helmet` | backend | Security headers | Principle III; well-maintained standard |
| `pino`, `pino-http` | backend | Structured logging, request logs | Principle VII |
| `openapi-typescript` (dev) | api-contract | Generate TS types from contract | Avoids hand-maintained duplicate types |
| `tsx` (dev) | backend | Backend dev runner (`tsx watch src/server.ts`) and perf-smoke script runner (R18) | Avoids a two-process `tsc --watch` + `node --watch` loop; never used at runtime |
| `typescript` and `@types/*` (dev) | all | Compiler and type definitions (`node`, `express`, `pg`, `swagger-ui-express`, `jest`, `supertest`, `jest-axe`) | Required for strict type checking |
| `react`, `react-dom`, `vite`, `@vitejs/plugin-react` | frontend | Mandated UI library; build tool and its React plugin | Mandated / standard React build |
| `react-router` (pinned v7) | frontend | Client-side routing | Standard; four routes with deep links. v8 is ESM-only and breaks the CommonJS Jest/ts-jest setup |
| `@mui/material`, `@emotion/*` | frontend | Accessible enterprise components | WCAG-tested primitives (R12) |
| `jest`, `ts-jest` (dev) | backend, frontend | Mandated test runner; TypeScript transform | Constitution toolchain |
| `jest-environment-jsdom`, `@testing-library/react`, `@testing-library/dom`, `@testing-library/user-event`, `@testing-library/jest-dom` (dev) | frontend | DOM environment and user-centred queries (`@testing-library/dom` is a required peer of RTL) | Constitution toolchain (RTL) |
| `@types/react`, `@types/react-dom` (dev) | frontend | React type definitions | Required for strict type checking |
| `jest-axe` (dev) | frontend | Automated WCAG checks in component tests | Supports FR-034 / SC-007 |
| `supertest` (dev) | backend | HTTP-level API tests | Constitution toolchain |
| `@testcontainers/postgresql` (dev) | backend | Real PostgreSQL in integration tests | Constitution toolchain |
| `@playwright/test`, `@axe-core/playwright` (dev) | e2e | Browser end-to-end tests with WCAG checks | Constitution toolchain; supports SC-007 |
| `eslint` (pinned v9), `@eslint/js`, `globals`, `typescript-eslint`, `eslint-plugin-react-hooks`, `eslint-plugin-jsx-a11y`, `eslint-config-prettier`, `prettier` (dev) | root | Linting, accessibility lint rules, formatting | Constitution toolchain. ESLint pinned to v9 because `eslint-plugin-jsx-a11y` does not yet support v10 |

All packages are MIT or Apache-2.0 licensed and actively maintained. Exact versions are pinned by
the lockfile during implementation. No other third-party package may be added without a row in
this table.

> **Risk**: confirm at implementation time that the chosen `express-openapi-validator` version
> supports Express 5; if not, use Express 4.21.x (no design impact).

## Deferred decisions (not required for this feature)

| Topic | Status |
|---|---|
| Identity source (own JWT vs. corporate IdP) | Deferred — feature uses the Principle III development-only exemption |
| Audit trail design | Deferred — FR-030; Constitution v1.3.0 pre-identity audit deferral; schema additions planned to be additive |
| Metrics / observability backend | Deferred — Constitution SHOULD; logs + health checks suffice for lower environments |
| SonarQube hosting and thresholds | Deferred per Constitution v1.3.0 |
| nginx (or other web server) in front of the app | Deferred — not needed for lower environments (R16) |
| Trigram (`pg_trgm`) search index | Deferred — 10k-row `ILIKE` meets SC-004; revisit if volume grows |
