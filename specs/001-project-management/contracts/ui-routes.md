# UI Contract: Project Management Screens

**Feature**: `001-project-management` | **API**: [openapi.yaml](openapi.yaml)

Routes and the user-visible behavior each screen must provide. Component structure is an
implementation detail and is intentionally not specified here.

| Route | Screen | API calls | Required states |
|---|---|---|---|
| `/` | Redirect to `/projects` | — | — |
| `/projects` | Project list with search, sort, paging, "Create project" action | `GET /api/v1/projects` | Loading, empty (no projects → create CTA), no matches (clear search), error + retry |
| `/projects/new` | Create form | `POST /api/v1/projects` with `Idempotency-Key` | Field errors inline + error summary, submitting (button disabled), API error + retry, success → detail with confirmation |
| `/projects/:projectId` | Project detail with Edit and Delete actions | `GET /api/v1/projects/{id}` | Loading, not found (link back to list), error + retry |
| `/projects/:projectId/edit` | Edit form (charge code read-only) | `GET` then `PUT` with `If-Match` | As create, plus version conflict (reload prompt), not found, unsaved-changes warning on leave |
| (dialog on detail) | Delete confirmation showing name + charge code | `DELETE /api/v1/projects/{id}` | Confirm/cancel, deleting, success → list with confirmation, not found |
| `*` | Page not found | — | Link back to list |

## Behavior rules

- **Layout**: persistent application header with product name and a "Projects" navigation item;
  page title (`<h1>`) and primary actions at the top of each page; breadcrumbs on detail/edit.
- **List columns**: Project Name, Charge Code, Project Manager, Start Date, End Date, Project Type,
  Billing Type (FR-016). Sortable: name, charge code, start date, end date (FR-017). Search box
  label: "Search projects"; search applies after typing pauses (~300 ms) or on Enter; the search
  term, sort, and page are reflected in the URL query so views can be shared and reloaded.
- **Form sections** (FR-032): *General* (Project Name, Project Type, Client Name — shown only for
  Client Project), *Project Manager* (Name, Email), *Schedule* (Start Date, End Date),
  *Billing* (Billing Type). Required fields marked visually and with `aria-required`.
- **Validation feedback**: on submit, show an error summary at the top that links to each invalid
  field and move focus to it; each field shows its own message (`aria-describedby`). Server
  `errors[]` are mapped onto the same fields. Entered values are kept (FR-026).
- **Notifications**: success messages after create/edit/delete announced via a polite live region
  (FR-027).
- **Dates**: shown as `DD MMM YYYY` (e.g., `06 Oct 2026`) in the list and detail; entered with a
  native date input.
- **Charge code**: always shown as 8 digits in a monospace style; never editable.
- **Accessibility**: WCAG 2.1 AA (FR-034) — keyboard-only operation of every flow, visible focus,
  focus returned to the triggering control when dialogs close, colour contrast ≥ 4.5:1 for text.
- **Page titles** (WCAG 2.4.2): every route sets a unique `document.title` of the form
  `"{page} – timesheet-demo"`, updated on client-side navigation: "Projects", "Create project",
  "{project name} – Project", "Edit {project name}", "Loading project", "Project not found",
  "Page not found".
- **Start Date hint**: a Start Date before the browser's date shows a non-blocking hint; the form
  still submits and the server's `START_DATE_IN_PAST` error (if any) is shown on the field.
- **Create replay**: if the server answers `200` (same request already processed), the UI opens the
  saved project and announces "This project was already created. Showing the saved project."
- **Development-only banner**: a non-dismissible banner states "Development environment — no
  sign-in. Do not enter confidential data." (FR-036).
