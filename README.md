# TeamFlow

A Jira-style project management and team collaboration platform: workspaces, role-based access, agile projects (backlog, sprints, board, timeline, calendar, reports), full-page issues with estimates and work logs, rich-text docs, dashboards, an admin console and email notifications.

- **Backend:** Python 3.11+, FastAPI, Pydantic v2, Beanie (PyMongo async) on MongoDB, JWT access tokens with a rotating httpOnly refresh cookie, Argon2 password hashing, aiosmtplib and Jinja2 for email.
- **Frontend:** React 18, Vite, TypeScript, Tailwind CSS 3.4 (CSS-variable design tokens, light and dark), Zustand (client state), TanStack Query (server state), React Router with lazy routes, React Hook Form + Zod, dnd-kit, Recharts, TipTap.
- **Tests:** pytest against a real MongoDB; Vitest + React Testing Library + MSW; Playwright end-to-end with axe accessibility checks.

Planning documents (SRS and blueprint) live in [`docs/`](docs).

## Contents

- [Feature overview](#feature-overview)
- [Prerequisites](#prerequisites)
- [Quick start](#quick-start)
- [Demo data](#demo-data)
- [Email](#email)
- [Configuration](#configuration-backendenv)
- [Commands](#commands)
- [Project layout](#project-layout)
- [Security notes](#security-notes)
- [Testing summary](#testing-summary)
- [Known limitations](#known-limitations)

## Feature overview

### Issues
- Eleven issue types: Epic, Story, Task, Bug, Subtask, Feature, Improvement, Merge request, Incident, Spike and Test.
- Project keys (`WEB-12`) and a full-page issue view at `/browse/WEB-12` with details sidebar, rich-text description, subtasks, checklist, linked issues, attachments, comments with @mentions, history and work log.
- Links: blocks, duplicates, relates to and clones, with cycle prevention.
- Story points, original and remaining estimates (`2w 3d 4h 30m`), time logging that adjusts estimates, flags, watchers, components and releases (fix versions).
- Clone an issue, and bulk edit from the list (status, assignee, priority, delete) with per-issue failure reporting.
- Descriptions are rich text and are sanitized on the server.

### Project views
- **Summary:** status, type and priority breakdowns, epic progress, active sprint and recent activity.
- **Timeline:** epics and sprints on a time axis.
- **Backlog:** sprints, epics panel and drag-and-drop planning.
- **Board:** Kanban for the active sprint or all issues, with quick filters (mine, unassigned, flagged, blocked), WIP counts and workflow-aware drag and drop.
- **Calendar:** month and week views with drag to reschedule, and an agenda on phones.
- **List:** sortable table, saved filters and bulk actions.
- **Reports:** burndown, sprint report, velocity, cumulative flow, created vs resolved, time tracking and workload, each with a table view.
- **Docs:** rich-text pages with version history and issue links.
- **Members and Settings:** statuses, labels, components, releases, workflow, WIP limits and automation.

### Workflow and agile
- Per-project allowed status transitions and soft WIP limits per status.
- Sprints: create, start (one active per project), complete (unfinished issues return to the backlog or move to the next sprint).
- Automation rules, for example "when an issue moves to In Review, notify the assignee"; overdue issues notify the assignee once.

### Search
- Global search with Ctrl+K across issues, docs and projects, respecting project visibility.

### Administration
- Super admins create users directly, edit names and emails, reset passwords, change roles, set per-project roles, deactivate accounts, invite by link and review an audit log.
- The admin dashboard shows workspace-wide analytics (a "Workspace" tab and a personal "My work" tab).

### Dashboards
- Personal dashboard with open work by status and type, completed per day and time logged.
- Workspace dashboard with project health, team workload and signups.

### Email
- Six-digit sign-up verification code, password reset, invitations and account-created notices.
- Issue emails: assigned, mentioned, status changed, overdue and (opt-in) comments.
- Opt-in daily digest. Each user controls these under **Profile → Email notifications**.
- Mail is queued in MongoDB and delivered by an in-process scheduler with retries and job locks.

### Design
- Neutral palette with a single blue accent, light and dark themes, and a responsive layout from 375px up (project sections become a scrollable tab bar on phones).

## Prerequisites

- Python 3.11+
- Node.js 20+
- A MongoDB server (local install or Atlas). Docker is **not** required.
- Microsoft Edge or Google Chrome for the end-to-end tests (or run `npx playwright install chromium`).

## Quick start

### 1. Backend

```bash
cd backend
python -m venv .venv
.venv/Scripts/python -m pip install -r requirements-dev.txt     # macOS/Linux: .venv/bin/python
cp .env.example .env                                             # then edit JWT_SECRET
.venv/Scripts/python -m uvicorn app.main:app --reload --port 8000
```

API docs: <http://localhost:8000/docs>

### 2. Frontend

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

App: <http://localhost:5173>. The dev server proxies `/api` to the backend on port 8000, so the refresh cookie works without CORS setup.

### 3. First account

Open <http://localhost:5173/register> to create your own workspace; you become its Super Admin and can invite teammates from **Admin → Invitations**. New accounts must confirm a six-digit code before signing in. Without SMTP configured, the code is shown on the verification page in development and logged by the API.

## Demo data

```bash
cd backend
.venv/Scripts/python -m scripts.seed
```

**This deletes every collection in the configured database.** It creates:

- 16 users across all roles (one deactivated) and three pending or revoked invitations.
- 5 projects with different workflows: Website Redesign (restricted transitions and WIP limits), Mobile App (adds a QA stage), Platform API (Code Review and Testing), Marketing Launch (Kanban, Approval stage) and Support Portal (Kanban, Blocked status).
- About 340 issues of every type, with estimates, checklists, subtasks, watchers, flags, labels and components.
- Sprints 1 to 7 from 1 September to early December 2026, with carry-over of unfinished work.
- About 180 work logs, 200 comments, 70 links, 10 docs with versions, 13 releases, 9 automation rules, 14 saved filters, 15 attachments, per-project role overrides, an audit log and notifications.

Dates are back-dated so burndown, velocity and cumulative flow have real history. Work dated before today is finished and later work is planned. To treat another date as today and fill all three months with history:

```bash
.venv/Scripts/python -m scripts.seed --today 2026-11-30
```

The seed never sends email. Every account uses the password `Demo12345`.

| Role | Accounts (`@teamflow.demo`) |
|---|---|
| Super Admin | `admin` |
| Project Manager | `manager`, `noah` |
| Member | `member`, `member2`, `priya`, `liam`, `sofia`, `ethan`, `hana`, `lucas`, `zara`, `diego` |
| Viewer | `viewer`, `victor` |
| Deactivated | `ian` |

## Email

Set these in `backend/.env` to deliver real mail. If `SMTP_HOST`, `SMTP_USER` or `SMTP_PASSWORD` is empty, messages are logged instead of sent.

```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURITY=starttls
SMTP_USER=you@gmail.com
SMTP_PASSWORD=your-app-password
SMTP_FROM=you@gmail.com
```

- **Gmail:** turn on 2-Step Verification and create an App Password. `SMTP_USER` must be the full address. If it has no `@`, the address in `SMTP_FROM` is used for login. Spaces in the app password are ignored.
- **Verification codes** expire after 10 minutes, allow five attempts and can be resent once per minute.
- **Password reset** links are single-use and expire; the request page answers the same way whether or not the email exists.
- **Failures:** a failed send is retried with backoff up to five times. The API log shows the exact error, for example `Email to a@b.com failed: SMTPAuthenticationError(...)`.
- **Tests and the seed** never send mail.

## Configuration (`backend/.env`)

| Variable | Purpose | Default |
|---|---|---|
| `MONGODB_URI` | MongoDB connection string (required) | `mongodb://localhost:27017` |
| `MONGODB_DB` | Database name (required) | `teamflow` |
| `JWT_SECRET` | Signing key, at least 16 characters (required) | none |
| `ACCESS_TOKEN_MINUTES` | Access token lifetime | `15` |
| `REFRESH_TOKEN_DAYS` | Refresh token lifetime | `7` |
| `CORS_ORIGINS` | Comma-separated allowed origins | `http://localhost:5173` |
| `FRONTEND_URL` | Base URL used in links inside emails | `http://localhost:5173` |
| `ENVIRONMENT` | `development`, `test` or `production` (production enables Secure cookies and HSTS and hides on-screen verification codes) | `development` |
| `RATE_LIMIT_ENABLED` | Rate limit login and register (10 per minute per IP) | `true` |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURITY`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM` | Outgoing mail; `SMTP_SECURITY` is `starttls`, `ssl` or `none` | empty |
| `APP_NAME` | Name shown in emails | `TeamFlow` |
| `STORAGE_DIR` | Folder for issue attachments (10 MB limit per file) | `storage` |

The API refuses to start if a required value is missing.

## Commands

| Where | Command | What it does |
|---|---|---|
| `backend` | `.venv/Scripts/python -m pytest -q` | Backend suite (isolated throwaway database, dropped afterwards; email is disabled) |
| `backend` | `.venv/Scripts/python -m ruff check .` / `ruff format .` | Lint / format |
| `backend` | `.venv/Scripts/python -m mypy app tests scripts` | Strict type check |
| `backend` | `.venv/Scripts/python -m scripts.seed` | Demo data (wipes the database first) |
| `frontend` | `npm run dev` | Dev server |
| `frontend` | `npm run test` | Vitest component and integration tests |
| `frontend` | `npm run lint` | ESLint and TypeScript |
| `frontend` | `npm run build` | Type-check and production build |
| `frontend` | `npx playwright test` | End-to-end tests (starts its own API on :8100 and UI on :5273 with the `teamflow_e2e` database) |

## Project layout

```
backend/
  app/
    api/           routers and dependencies (authentication, role and project-context guards)
    services/      business rules and orchestration (tasks, sprints, reports, email, automation)
    repositories/  all database queries
    models/        Beanie documents and indexes
    schemas/       request and response contracts
    permissions/   roles, permission matrix and pure policy functions
    emails/        Jinja2 templates and renderer
    core/          config, database, security, mailer, storage, migrations
  scripts/         seed.py (demo data) and seed_data.py (its content)
  tests/           unit and integration tests
frontend/
  src/
    app/           router, layouts (app shell, project layout and tab bar)
    components/    ui (design system), layout, common, charts, guards
    features/      auth, projects, tasks (issue page), agile (summary, backlog, timeline,
                   calendar, reports), board, docs, search, comments, notifications,
                   dashboard, admin, profile, workspace
    store/         Zustand stores (session, theme, layout)
    lib/           axios client with silent token refresh, formatters, duration and rich-text helpers
  e2e/             Playwright specs and helpers
docs/              SRS and project blueprint
```

## Security notes

- Passwords are hashed with Argon2; login errors are generic and use constant-time verification for unknown emails.
- Access tokens (15 min) are kept in memory only. Refresh tokens are random, stored hashed, rotated on every use and delivered in an httpOnly, SameSite=Lax cookie scoped to `/api/v1/auth`.
- Every request re-checks that the user is active and that the token version matches, so deactivation and password changes take effect immediately.
- Every endpoint enforces the SRS permission matrix on the server. Projects a user cannot see return 404, never 403.
- Request bodies reject unknown fields and operator-style payloads. Invitation, reset and verification tokens are single-use, expiring and stored hashed.
- Rich-text content is sanitized on the server before it is stored.
- Security headers on all responses, strict CORS origin list, and rate limiting on login and registration.

## Testing summary

- **Backend:** 289 tests covering the permission matrix, auth and token rotation, email verification and delivery, invitations, project visibility and overrides, admin user management, issue types, epics and keys, sprints and burndown, work logs, links, attachments, reports, docs, automation, search, audit log, password reset, workflow rules and bulk edit.
- **Frontend:** 286 component, guard, store and feature tests with MSW.
- **End to end:** 13 Playwright tests for sign-up with verification, project and board flow, invitations, viewer read-only access, per-project overrides, deactivation, the Jira workflow (epic, child issues, estimates, work log, sprint, reports), admin user creation, theme and mobile navigation, and axe accessibility scans in light and dark.

## Known limitations

- Attachments are stored on the local disk (`STORAGE_DIR`), not in object storage.
- Search is plain text; there is no JQL-style query language.
- The board has no swimlanes, and the timeline does not support drag-to-resize or dependency lines.
- Analytics are computed on request without caching, and very large boards are not virtualized.
- Email is delivered by an in-process scheduler, so run a single backend instance or move delivery to a worker before scaling out.
