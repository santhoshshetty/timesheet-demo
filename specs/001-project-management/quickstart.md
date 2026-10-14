# Quickstart & Validation Guide: Project Management

**Feature**: `001-project-management` | **Plan**: [plan.md](plan.md)

How to run the feature locally and prove it meets the specification. Commands assume the repository
root on Windows PowerShell; on macOS/Linux replace `Copy-Item` with `cp` and `curl.exe` with `curl`.

## Prerequisites

- Docker Desktop (with Docker Compose v2) running
- Node.js 22 LTS and npm 10+ (for running tests outside containers)
- Free ports: `3000` (app: UI + API), `5432` (PostgreSQL)

## 1. Start the environment

```powershell
Copy-Item .env.example .env
docker compose up --build
```

Expected:

- `db` becomes healthy, `migrate` applies migrations and exits with code 0, `app` starts.
- <http://localhost:3000> shows the Project list with the development-only banner.
- <http://localhost:3000/api/docs> shows Swagger UI for [contracts/openapi.yaml](contracts/openapi.yaml).
- `curl.exe http://localhost:3000/health/ready` → `{"status":"ok"}`.

Optional hot-reload frontend development: run `npm run dev -w frontend` and open
<http://localhost:5173> (Vite proxies `/api` and `/health` to the app on port 3000).

Optional host-run backend: `Copy-Item .env.local.example .env.local`, run only the database with
`docker compose up db migrate`, then `npm run dev -w backend` (loads `.env.local`; API on port
3000).

## 2. Run the quality gates

```powershell
npm ci
npm run typecheck          # tsc --noEmit in every workspace
npm run lint               # ESLint
npm run format:check       # Prettier
npm run test:unit          # Jest — domain and application rules
npm run test:integration   # Jest + Testcontainers — real PostgreSQL (Docker required)
npm run test:api           # Jest + Supertest — HTTP behavior validated against OpenAPI
npm run test:web           # Jest + React Testing Library — UI behavior and a11y checks
npm run test:e2e           # Playwright — full journey against the Compose stack
npm run perf:smoke         # p95 checks: create/read/update < 300 ms, search < 500 ms at 10k projects
```

Expected: every command exits with code 0.

## 3. Validation scenarios

Each scenario maps to the spec. The automated suites cover them; the manual steps below let a
reviewer confirm behavior quickly.

| # | Scenario (spec ref) | How to check | Expected outcome |
|---|---|---|---|
| V1 | Create a valid project (US1-1, FR-010/011) | UI: *Create project*, fill all fields with Start Date = today, save | Detail page shows the project and an 8-digit charge code; success message |
| V2 | Charge code cannot be supplied (FR-013) | `POST` with a `chargeCode` property (see below) | `400`, `errors[].field = chargeCode`, nothing saved |
| V3 | Required fields and Client Name (US1-3, US1-13/14) | UI: save an empty form; then pick *Client Project* without Client Name | All missing fields flagged; Client Name required message; values kept |
| V4 | Date rules (US1-4/11, FR-006a) | UI: Start Date yesterday; End Date before Start Date | `Start date cannot be in the past`; `End date must be on or after start date` |
| V5 | Name uniqueness (US1-8/9, FR-008) | Create "Apollo Migration", then "apollo migration" | Second save rejected: name already exists |
| V6 | Double submit (US1-7, FR-009) | Repeat the same `POST` twice with the same `Idempotency-Key` | First `201`, second `200` with the same `id` and `chargeCode` |
| V7 | Search (US2-2, FR-017) | Search by part of the manager email, client name, and `0041`-style charge code prefix | Only matching projects listed; leading zeros shown |
| V8 | Empty / error states (US2-3/4/6) | Fresh DB → open list; then `docker compose stop db` and reload | Empty state with create action; error message with *Retry* |
| V9 | Edit keeps charge code (US3-1/2/3) | Edit name and extend End Date | Saved; charge code unchanged and read-only |
| V10 | End Date cannot shrink (US3-13, FR-006b) | Edit End Date to an earlier date | `End date cannot be moved earlier than its current value` |
| V11 | Concurrent edit (US3-6, FR-020) | Open edit in two tabs; save tab A, then tab B | Tab B: "changed by someone else — reload" (`412`) |
| V12 | Soft delete (US4, FR-021/022) | Delete a project (confirm dialog shows name + charge code) | Gone from list/search; `GET` → `404`; row still in DB with `deleted_at` set |
| V13 | Charge code never reused (US4-4, FR-012) | Covered by integration test (DB constraint across deleted rows) | Test passes |
| V14 | Accessibility (FR-034, SC-007) | Keyboard-only run of V1, V9, V12; Playwright axe checks | All flows operable; 0 critical/serious axe violations |
| V15 | Development-only guard (FR-036) | `docker compose run --rm -e APP_ENV=production app` | App refuses to start with a "development-only" error; exit code ≠ 0 |

### API examples (PowerShell)

```powershell
$key = [guid]::NewGuid().ToString()
$today = (Get-Date).ToString('yyyy-MM-dd')
$body = @{
  name = 'Apollo Migration'
  projectManager = @{ name = 'Priya Shah'; email = 'priya.shah@example.com' }
  startDate = $today; endDate = $today
  projectType = 'CLIENT'; clientName = 'Contoso'; billingType = 'BILLABLE'
} | ConvertTo-Json

# V1 / V6: create, then replay with the same key
Invoke-RestMethod -Method Post -Uri http://localhost:3000/api/v1/projects `
  -Headers @{ 'Idempotency-Key' = $key } -ContentType 'application/json' -Body $body
Invoke-RestMethod -Method Post -Uri http://localhost:3000/api/v1/projects `
  -Headers @{ 'Idempotency-Key' = $key } -ContentType 'application/json' -Body $body

# V7: search
Invoke-RestMethod 'http://localhost:3000/api/v1/projects?search=contoso'
```

For V2, add `chargeCode = '12345678'` to `$body` and use a new key; expect HTTP 400.

## 4. Reset

Run `npm run perf:smoke` only after the other scenarios: it seeds 10,000 projects, so V8 (empty
state) needs a fresh database afterwards.

```powershell
docker compose down -v   # removes containers and the database volume
```
