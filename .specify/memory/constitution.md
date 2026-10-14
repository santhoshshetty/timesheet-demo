<!--
SYNC IMPACT REPORT (temporary — remove before committing)
Version change: 1.2.0 → 1.3.0
Bump rationale: MINOR — adds a bounded "Pre-identity audit deferral" to Principle VI, mirroring
  the Principle III development-only exemption. No rule is removed; full audit requirements still
  apply once identity exists and before any production deployment.
Modified principles:
  VI. Auditability — added "Pre-identity audit deferral".
Modified sections: Definition of Done (audit bullet references the deferral).
Added sections: none
Removed sections: none
Prior amendments in this working copy (uncommitted): 1.0.0 → 1.1.0 testing/code-quality
  toolchain (SonarQube deferred); 1.1.0 → 1.2.0 Principle III development-only exemption.
Templates reviewed (not modified by this command):
  ✅ .specify/templates/plan-template.md — deferral is recorded via Complexity Tracking.
  ✅ .specify/templates/spec-template.md, tasks-template.md — no change required.
Follow-up TODOs:
  - TODO(STANDARDS_LOCATION): create docs/standards/ for implementation-level conventions,
    including ESLint/Prettier configuration.
  - Decide SonarQube adoption timing, hosting, and thresholds (see Decisions Pending).
  - Feature 001 plan: reference the Principle III exemption and Principle VI deferral.
-->

# timesheet-demo Constitution

## Core Principles

### I. Specification-Driven, Traceable Delivery (NON-NEGOTIABLE)

- Every feature MUST progress through Spec Kit artifacts in order: specification →
  clarification → plan → tasks → implementation → verification/convergence.
- The feature specification MUST be the source of truth for expected behavior. Code, tests, and
  API contracts that diverge from it MUST be corrected, or the specification MUST be amended first.
- Ambiguous business requirements MUST be resolved through clarification before implementation.
  AI agents MUST NOT invent business rules, roles, permissions, or data-retention behavior.
- Each functional requirement MUST be traceable: requirement → acceptance criteria → plan → task →
  implementation → test. Requirement changes MUST trigger reassessment of affected downstream
  artifacts.
- AI-generated artifacts MUST be human-reviewed and held to the same standards as hand-written
  work.

**Rationale**: Traceability is what keeps AI-assisted delivery auditable and prevents silent
scope drift in an enterprise system.

### II. Domain-Centric, Layered Architecture

- The backend MUST separate presentation (HTTP), application (use-case orchestration), domain
  (business rules), and infrastructure (persistence, external services, configuration).
- Dependencies MUST point toward the domain. Domain code MUST NOT import Express, database
  drivers, React, or other infrastructure-specific libraries.
- Business rules MUST live in the domain/application layers and MUST NOT be embedded in
  controllers, SQL queries, or UI components. They MUST be unit-testable without HTTP or a
  database.
- Domain terminology MUST be used consistently across specifications, code, APIs, database
  schema, tests, and documentation.
- SOLID principles MUST be applied pragmatically: an abstraction (interface, port, repository) is
  introduced only where it isolates infrastructure, enables meaningful testing, or has more than
  one realistic implementation.
- The system MUST remain a modular monolith unless an amendment justifies otherwise.

**Rationale**: Isolating business rules keeps the core stable while infrastructure evolves, without
paying for speculative indirection.

### III. Security by Design (NON-NEGOTIABLE)

- Every non-public endpoint MUST require authentication via validated JWT bearer tokens
  (signature, issuer, audience, and expiry verified; algorithm explicitly pinned).
- Authorization MUST use Role-Based Access Control and MUST be enforced server-side on every
  protected operation. Frontend permission checks are usability aids only.
- Authorization rules that depend on data ownership (e.g., "own timesheet only") MUST be enforced
  in the application layer, not inferred from UI state.
- All untrusted input MUST be validated at the system boundary before any business operation.
- Database access MUST use parameterized queries; dynamic SQL from user input is prohibited.
- Secrets, credentials, and tokens MUST NOT be hard-coded, committed, logged, or returned in
  responses.
- If passwords are ever stored, they MUST use a modern adaptive hashing algorithm.
- Standard HTTP security controls (security headers, CORS allow-listing, request size limits, rate
  limiting on authentication endpoints) MUST be applied.
- Security-sensitive changes MUST include tests covering denial paths (unauthenticated,
  unauthorized, invalid input).
- Specific roles, permissions, and token claims MUST be defined in feature specifications or a
  security architecture decision, not assumed.
- **Development-only exemption**: Foundational development features MAY temporarily operate
  without authentication and authorization when, and only while, all of the following hold:
  - the feature specification explicitly designates the feature as development-only and records
    the deferral of authentication/authorization;
  - the identity architecture has not yet been implemented;
  - the plan records the exemption in Complexity Tracking and describes how production
    deployment is prevented;
  - the design does not prevent authentication and authorization from being added later without
    rewriting business logic.

  Such functionality MUST NOT be deployed to production. All other rules of this principle (input
  validation, parameterized queries, secret handling, HTTP security controls) still apply. Once
  the identity architecture is implemented, the exemption ends for that functionality and it MUST
  be brought into full compliance before any production deployment.

**Rationale**: Time records feed payroll, billing, and compliance; unauthorized access or
tampering is a business-critical risk.

### IV. Explicit, Stable API Contracts

- All backend functionality MUST be exposed through RESTful HTTP APIs using consistent resource
  naming, correct HTTP methods, and correct status codes.
- Every API MUST be described in OpenAPI, including request/response schemas, validation rules,
  error responses, and authentication/authorization requirements. The OpenAPI document MUST match
  runtime behavior and be verified in CI.
- Swagger UI MUST be available in development and MAY be enabled in non-production environments;
  it MUST NOT be publicly exposed in production.
- Error responses MUST use a single, documented error format and MUST NOT leak stack traces,
  SQL, or internal identifiers.
- APIs MUST be versioned. Breaking changes MUST be deliberate, documented, and introduced in a
  way that does not silently break existing consumers.

**Rationale**: The contract is the interface between frontend, backend, and any future
integrations; drift there causes the most expensive defects.

### V. Data Integrity & Lifecycle

- PostgreSQL MUST be the authoritative store for application data.
- Core invariants MUST be enforced by database constraints (primary/foreign keys, unique,
  not-null, check) in addition to application-level validation that produces user-facing errors.
- All schema changes MUST be delivered as version-controlled, forward-only migrations that
  account for existing data. Destructive changes MUST be explicitly called out in the plan.
- Operations that modify multiple related records MUST execute in a single transaction managed at
  the use-case boundary.
- Where concurrent updates could corrupt business state (e.g., editing a submitted timesheet),
  the specification MUST define the expected behavior and the implementation MUST enforce it
  (e.g., optimistic locking, constraints, isolation level).
- Where a feature requires deletion of business records, soft deletion MUST be the default:
  deleted records are excluded from normal queries through a single consistent mechanism and are
  never hard-deleted implicitly. Restore and permanent purge MUST be explicitly specified.
- Queries SHOULD avoid N+1 patterns and SHOULD be supported by appropriate indexes.

**Rationale**: Timesheet data has financial and legal significance; correctness and history MUST
survive bugs, concurrency, and schema evolution.

### VI. Auditability

- Persistent business entities MUST record creation and last-modification metadata (timestamp
  and acting user).
- State transitions with business significance (e.g., submit, approve, reject, delete, restore)
  and security-sensitive or administrative actions (e.g., role changes) MUST be recorded in an
  audit trail capturing who, what, when, and the prior/new state where relevant.
- Audit records MUST NOT be modifiable through normal application operations.
- Audit content MUST respect privacy and retention requirements defined in specifications.
- **Pre-identity audit deferral**: Until the identity architecture is implemented, a feature MAY
  defer recording the acting user and the audit trail when its specification explicitly records
  the deferral. Such a feature MUST still record creation and last-modification timestamps, MUST
  NOT permanently erase data that a future audit would need, and its design MUST allow the audit
  trail and acting-user fields to be added later through additive changes. The deferral ends
  when the identity architecture is implemented; the feature MUST meet this principle in full
  before any production deployment.

**Rationale**: Enterprise time tracking must answer "who changed this and when" for disputes,
payroll corrections, and compliance reviews.

### VII. Observability & Consistent Error Handling

- The backend MUST emit structured (machine-parseable) logs with a correlation/request ID
  propagated across each request.
- Logs MUST contain enough context to diagnose application, API, database, authentication, and
  authorization failures, and MUST NOT contain secrets, tokens, or unnecessary personal data.
- Errors MUST be handled centrally. Expected business errors MUST be distinguishable from
  unexpected system failures in both logs and API responses.
- The backend MUST expose liveness and readiness health checks; readiness MUST reflect database
  availability.
- Application metrics SHOULD be exposed where they support operational decisions.
- Observability MUST be implemented behind thin abstractions so that vendors can be replaced
  without changing business logic.

**Rationale**: A system that cannot be diagnosed in production cannot be supported as an
enterprise service.

### VIII. Verified Behavior Through Automated Tests

- Automated tests are part of every feature; a feature that only compiles is not done.
- Tests MUST verify behavior against the specification's acceptance criteria and MUST prefer
  testing behavior and contracts over internal structure.
- Required coverage by layer, using the mandated toolchain (see Technology Stack):
  - Unit tests (Jest) MUST cover domain and application business rules.
  - Integration tests (Jest + Testcontainers) MUST cover persistence against a real,
    containerized PostgreSQL instance, including migrations, constraints, and transactions relied
    upon by the feature. Mocked databases MUST NOT substitute for these tests.
  - API tests (Jest + Supertest) MUST cover validation, authentication, authorization (allow and
    deny), and error responses for each endpoint.
  - Frontend tests (Jest + React Testing Library) MUST cover significant user interactions and
    form validation, querying by user-visible roles, labels, and text rather than implementation
    details.
  - End-to-end tests (Playwright) MUST cover each feature's critical business workflows through
    the browser.
- Tests MUST be deterministic and runnable locally and in CI without manual infrastructure setup.

**Rationale**: Tests are the executable evidence that the implementation satisfies the
specification.

### IX. Accessible, Resilient User Interface

- The React frontend MUST use a component-based architecture that separates presentation from
  data access and application logic. Complex business rules MUST NOT live in UI components.
- Every data-driven view MUST handle loading, empty, and error states, and MUST handle API
  failures gracefully.
- Forms MUST provide client-side validation for usability; backend validation remains
  authoritative.
- The UI MUST respect backend authorization (hide or disable unavailable actions) while never
  relying on it for enforcement.
- User interfaces MUST meet WCAG 2.1 Level AA as the target baseline: semantic HTML, keyboard
  operability, accessible labels, meaningful error messages, and sufficient contrast.
  Accessibility MUST be considered at design time.
- Frontend state management MUST stay as simple as practical; global state libraries require a
  documented justification.

**Rationale**: An internal tool used daily by every employee must be usable by everyone and must
fail gracefully.

### X. Simplicity & Deliberate Dependencies

- The simplest solution that satisfies the specification and this Constitution MUST be preferred.
  Speculative features, premature abstraction, and premature distribution (e.g., microservices)
  are prohibited without an amendment or documented exception.
- Code MUST prioritize readability, explicitness, and consistency. TypeScript `strict` mode MUST
  be enabled; `any` MUST NOT be used without an inline justification.
- All code MUST pass type checking, ESLint, and Prettier with zero errors. Disabling a lint rule
  MUST be scoped as narrowly as possible and carry an inline justification.
- SonarQube is the designated static-analysis and quality-gate tool. Its adoption is deferred;
  until it is adopted, features MUST NOT be blocked on it, and plans MUST NOT introduce an
  alternative static-analysis platform. Once adopted, code MUST pass the SonarQube quality gate,
  and its thresholds MUST NOT be lowered without technical-lead approval.
- Dead code, duplicated logic, and unexplained workarounds MUST be removed when encountered in the
  scope of a change.
- Each new third-party dependency MUST be justified in the plan (need, maintenance health,
  security history, license compatibility, runtime/bundle impact).
- Known dependency vulnerabilities MUST be triaged and remediated according to severity.

**Rationale**: Enterprise longevity comes from code that is easy to change, not from upfront
architectural weight.

### XI. Reproducible, Externally Configured Environments

- All runtime components (frontend, backend, database) MUST be containerized with Docker, and the
  full local development environment MUST start via Docker Compose.
- Container images MUST be reproducible, minimal, run as non-root, and contain no secrets.
- Configuration MUST be supplied externally (environment variables or a secret store) and
  validated at startup; the application MUST fail fast on missing or invalid configuration.
  Environment changes MUST NOT require source changes.
- A safe example configuration (e.g., `.env.example`) MUST be provided with no real credentials.
- Database initialization and migrations MUST run reproducibly in every environment.

**Rationale**: Reproducible environments remove "works on my machine" defects and make
deployments predictable.

## Technology Stack & Architectural Constraints

### Mandated Stack

| Concern | Technology |
|---|---|
| Language | TypeScript (frontend and backend) |
| Frontend | React with TypeScript |
| Backend | Node.js with Express and TypeScript |
| Persistence | PostgreSQL |
| API style | RESTful HTTP/JSON |
| API documentation | OpenAPI with Swagger UI |
| Authentication | JWT bearer tokens with server-side RBAC |
| Packaging | Docker; Docker Compose for local development |

### Quality & Testing Toolchain

| Concern | Tool |
|---|---|
| Type checking | TypeScript compiler, `strict` mode |
| Linting | ESLint (with TypeScript support) |
| Formatting | Prettier |
| Static code analysis & quality gate | SonarQube (planned; adoption deferred) |
| Unit and application tests | Jest |
| API tests | Jest + Supertest |
| Database integration tests | Jest + Testcontainers (real PostgreSQL) |
| Frontend component tests | Jest + React Testing Library |
| End-to-end browser tests | Playwright |

- Alternative test runners or E2E frameworks (e.g., Vitest, Cypress, Mocha) MUST NOT be
  introduced without an amendment.
- Supporting plugins for these tools (e.g., ESLint rule sets, Jest environments) MAY be added
  when justified in the plan.

- Changing or removing a mandated technology or tool requires a MAJOR amendment; adding one
  requires a MINOR amendment.
- Adding any other framework, library category, or infrastructure component (e.g., ORM,
  validation library, cache, message broker, state-management library) MUST be justified in the
  feature plan and recorded as an architecture decision. Infrastructure components (cache,
  broker, external IdP, observability backend) additionally require explicit approval before
  adoption.

### Decisions Pending

The following MUST be decided and recorded as architecture decisions before the first feature
that depends on them is planned. Until decided, plans MUST flag them rather than assume an answer:

- **Identity source**: application-issued JWTs vs. tokens issued by a corporate identity provider
  (e.g., OIDC/SSO); token lifetime and refresh strategy.
- **Data access approach**: query builder, ORM, or raw parameterized SQL; migration tool.
- **Validation and OpenAPI strategy**: schema-first vs. code-first, and how request validation is
  derived from (or checked against) the OpenAPI document.
- **Repository layout**: monorepo structure and sharing of types/contracts between frontend and
  backend.
- **SonarQube adoption**: when it is introduced, self-hosted SonarQube (edition) vs. SonarQube
  Cloud, branch/pull-request analysis support, and quality-gate thresholds (e.g., coverage on new
  code). Not required before the first feature is planned.
- **Logging/metrics libraries** and the target observability backend.
- **API versioning scheme** (e.g., URL prefix) and the standard error response format.
- **Time handling**: timezone and date storage conventions for time entries.

### Scope of Authority

- **This Constitution** governs durable, project-wide principles.
- **Project engineering standards** (`docs/standards/`) hold implementation conventions: folder
  structure, naming, lint/format rules, error-code catalog, logging fields, commit conventions,
  CI configuration. Standards MUST NOT contradict this Constitution.
- **Feature specifications** hold feature-specific rules: roles and permissions, timesheet
  states and transitions, approval workflows, retention periods, concurrency behavior, and which
  entities are soft-deleted or restorable.

## Development Workflow & Quality Gates

### Workflow

- Work MUST be tracked through Spec Kit artifacts under `specs/<feature>/`.
- Each plan MUST pass the "Constitution Check" gate before design and again after design. Any
  violation MUST be recorded in the plan's "Complexity Tracking" section (see Governance →
  Exceptions).
- Changes MUST be small, focused, reviewed by at least one human, and traceable to a task.
- Commit messages MUST describe intent and SHOULD reference the related task or requirement.
- Documentation (README, local setup, architecture decisions, API docs, migration notes,
  configuration reference) MUST be updated in the same change that alters the behavior or
  architecture it describes.

### CI Quality Gates

CI MUST pass, in order, before merge:

1. Dependency installation (lockfile-respecting)
2. Type checking (TypeScript compiler)
3. Formatting check (Prettier) and linting (ESLint)
4. Unit tests (Jest)
5. Integration and API tests (Jest, Supertest, Testcontainers)
6. Frontend component tests (Jest, React Testing Library)
7. OpenAPI contract validation
8. Application build
9. Container image build
10. End-to-end tests (Playwright) against the built application
11. Dependency vulnerability scan (no unresolved critical/high findings without a documented
    exception)
12. SonarQube analysis with a passing quality gate (required once SonarQube is adopted)

### Definition of Done

A feature is done only when all of the following hold:

- Requirements are specified and all clarifications are resolved.
- The technical plan is documented and passed the Constitution Check.
- All tasks are complete and traceable to requirements.
- Required automated tests exist and pass; acceptance criteria are verified.
- Critical workflows are covered by passing Playwright end-to-end tests.
- Code passes type checking, ESLint, and Prettier (and the SonarQube quality gate once adopted).
- OpenAPI documentation matches the implemented behavior.
- Authentication, authorization, and input validation are enforced and tested (authentication and
  authorization may be omitted only under the Principle III development-only exemption).
- Audit, observability, and error-handling requirements are satisfied (the audit trail and acting
  user may be deferred only under the Principle VI pre-identity audit deferral).
- Database migrations are included and tested against existing data where applicable.
- The feature runs in the Docker Compose environment.
- Relevant documentation is updated.
- All CI quality gates pass and no known critical defects remain.

## Governance

- This Constitution supersedes conflicting practices, standards, and templates. Feature
  specifications, plans, tasks, and implementations MUST comply with it.
- **Amendments** MUST be proposed as a reviewed change to this file and MUST state: the principle
  affected, the reason, the impact on existing features, and the migration or remediation
  approach. Amendments require approval from the project's technical lead (or designated
  architecture owner).
- **Versioning** follows semantic versioning:
  - MAJOR: removal or incompatible redefinition of a principle, or removal/replacement of a
    mandated technology or tool.
  - MINOR: a new principle or section, a newly mandated technology or tool, or materially
    expanded guidance.
  - PATCH: clarifications and wording changes with no change in meaning.
- **Exceptions** to any MUST rule MUST be documented in the affected plan's Complexity Tracking
  section with the rule, justification, simpler alternative rejected, scope, and approver.
  Silent violations are prohibited. Exceptions to NON-NEGOTIABLE principles require an
  amendment.
- **Compliance review**: every code review and every `/speckit-analyze` run MUST check work
  against this Constitution. The Constitution SHOULD be reviewed at least once per quarter, or
  whenever recurring exceptions indicate a principle no longer fits.

**Version**: 1.3.0 | **Ratified**: 2026-10-06 | **Last Amended**: 2026-10-06
