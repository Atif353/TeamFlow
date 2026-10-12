# TeamFlow — Project Blueprint (Phase 1 + Phase 2)

This file is the authoritative technical plan for building TeamFlow. The attached SRS (`TeamFlow_SRS.docx`) defines WHAT the system does. This blueprint defines HOW it is built, in what order, and how each step is tested.

**Alignment rule:** SRS version 1.1 already uses this stack (FastAPI + MongoDB on the backend, React + Tailwind on the frontend) and the same two-phase split. If the two documents ever disagree, the blueprint wins on technical detail and the SRS wins on requirement IDs, roles, permission matrix, and acceptance criteria. Report any disagreement instead of silently picking one.

---

## 1. Technology Decisions

| Layer | Choice | Reason |
|---|---|---|
| Frontend framework | React 18 + Vite + TypeScript | Fast dev server, type safety catches integration bugs early |
| Styling | Tailwind CSS 3.4 with CSS-variable design tokens | Config-based theme, easy dark mode, consistent design system |
| Animation | Framer Motion | Page transitions, modals, drawers, list and kanban layout animation |
| Client state | **Zustand** | See 1.1 |
| Server state | TanStack Query v5 | Caching, refetching, optimistic updates, loading/error states for free |
| Routing | React Router v6 | Nested layouts, route guards |
| HTTP | Axios with interceptors | Silent token refresh and uniform error mapping |
| Forms | React Hook Form + Zod | Typed validation shared between form and API types |
| Drag and drop | @dnd-kit/core + @dnd-kit/sortable | Accessible, touch-friendly kanban |
| Icons | lucide-react | Consistent, clean line icon set |
| Toasts | sonner | Lightweight, accessible |
| Utilities | clsx + tailwind-merge (`cn` helper), date-fns | Class merging, date handling |
| Charts (Phase 2) | Recharts | Burndown and dashboard charts |
| Rich text (Phase 2) | TipTap | Docs module editor |
| Frontend tests | Vitest, React Testing Library, MSW, Playwright (E2E) | Unit, component, API-mocked, and full-flow tests |
| Backend framework | FastAPI, Python 3.11+, Pydantic v2, pydantic-settings | Async, typed, auto OpenAPI docs |
| Database | MongoDB 7 | Per project requirement |
| ODM | Beanie (on Motor) | Async, Pydantic-native documents, index declarations in code |
| Auth | PyJWT + argon2-cffi | Short-lived access token, rotating refresh token, strong hashing |
| Rate limiting | slowapi | Protects auth endpoints |
| Backend tests | pytest, pytest-asyncio, httpx AsyncClient, real MongoDB test database | Integration tests against real Mongo behaviour, not mocks |
| Tooling | ruff (backend), eslint + prettier (frontend), docker compose | Consistent quality gates |

### 1.1 Context API vs Zustand — decision: Zustand

- Context re-renders every consumer on any value change; Zustand components subscribe only to the slices they select.
- Zustand needs no provider nesting and has far less boilerplate.
- Its `persist` middleware handles theme and sidebar preferences cleanly.
- It can be read outside React (Axios interceptors need the access token), which Context cannot do.
- Rule: Zustand holds client-only state (auth session, theme, sidebar, UI preferences). TanStack Query holds everything that comes from the API. Never copy server data into Zustand.

### 1.2 Auth token strategy

- Access token (JWT, 15 minutes) lives in Zustand memory only.
- Refresh token (7 days, rotating, stored hashed in MongoDB) lives in an httpOnly, SameSite=Lax cookie.
- Vite dev proxy forwards `/api` to the backend so the cookie works without cross-origin setup.
- On a 401, the Axios interceptor calls `/auth/refresh` once, retries the original request, and logs out if refresh fails.
- Every request checks that the user is active and that `token_version` in the JWT matches the database, so deactivation and role changes take effect immediately.

---

## 2. Phase Scope

### Phase 1 — Working core product

| Area | SRS requirements covered |
|---|---|
| Authentication | FR-AUTH-001, 002, 004 to 009 |
| Workspace and projects | FR-WS-001 to 004 |
| Tasks | FR-TASK-001, 002, 003, 004, 005, 008 |
| Views | FR-VIEW-001, 002 (List and Kanban) |
| Kanban | FR-AGL-003 |
| Roles and permissions | FR-ROLE-001 to 006 |
| Admin dashboard | FR-ADMIN-001, 002, 003, 004, 005, 007, 008 |
| Notifications | FR-NOTIF-001, 003 (assignment notifications and unread badge) |
| Dashboard | FR-DASH-001 (personal dashboard) |
| NFRs | NFR-SEC-001 to 007, NFR-REL-001, NFR-USE-001 to 006, NFR-MAIN-001 to 004, NFR-PERF-002 |

### Phase 2 — Remaining requirements

| Area | SRS requirements covered |
|---|---|
| Sprints and agile | FR-AGL-001, 002, 004, 005 (sprints, story points, burndown, backlog) |
| Calendar and saved views | FR-VIEW-003, 004 |
| Docs | FR-DOC-001, 002, 003 |
| Automation | FR-AUTO-001, 002 |
| Search and project dashboard | FR-SRCH-001, FR-DASH-002 |
| Task extras | FR-TASK-006, 007, 009 (dependencies, attachments, activity trail) |
| Notifications | FR-NOTIF-002 (mention notifications) |
| Admin | FR-ADMIN-006 (audit log) |
| Auth | FR-AUTH-003 (password reset) |
| NFRs | NFR-PERF-001, NFR-REL-002 |

---

## 3. Business Rules (authoritative)

1. Roles: `super_admin`, `project_manager`, `member`, `viewer`. Exactly one role per user.
2. v1 supports one workspace per user account. Self sign-up creates a user, a new workspace, and makes that user its Super Admin.
3. Users join an existing workspace only through an invitation created by a Super Admin. The invitation fixes the role.
4. Invitation tokens are single-use, expire after 7 days, can be revoked, and are stored hashed. The invite link is returned by the API and logged to the console in development. Sending real email is optional behind an SMTP env flag.
5. A workspace must always have at least one active Super Admin. Demoting or deactivating the last one is rejected with 409.
6. A Super Admin cannot deactivate themselves.
7. Super Admin sees every project in the workspace. Every other role sees only projects where they are a project member. A non-visible project returns 404, never 403, so existence is not leaked.
8. Effective role in a project = the project-level override if one exists, otherwise the workspace role. A Super Admin's effective role is always `super_admin`.
9. Project Manager can create projects and becomes a member automatically. A Project Manager can delete or manage only projects they are a member of (effective role `project_manager`).
10. "Own task" means the user is the task creator or the assignee. Members edit, move, and delete only own tasks. Project Managers and Super Admins act on any task. Viewers cannot write anything.
11. A task assignee must be a member of the task's project.
12. Deactivated users cannot authenticate; their comments, tasks, and history stay intact and show the user as deactivated.
13. Every project starts with default statuses: To Do, In Progress, In Review, Done (Done is flagged `is_done`). Statuses are editable per project. A status that still has tasks cannot be deleted until its tasks are reassigned.
14. Deleting a project cascades to its tasks, comments, labels, and project memberships.
15. Passwords: minimum 8 characters, at least one letter and one number.
16. All list endpoints are paginated (`page`, `page_size`, max 100). All timestamps are UTC ISO-8601.

---

## 4. Repository Structure

```
teamflow/
├── docker-compose.yml
├── .gitignore
├── README.md
├── docs/
│   ├── PROJECT_BLUEPRINT.md
│   └── TeamFlow_SRS.docx
├── backend/
│   ├── .env.example
│   ├── Dockerfile
│   ├── pyproject.toml
│   ├── requirements.txt
│   ├── scripts/
│   │   └── seed.py
│   ├── app/
│   │   ├── main.py
│   │   ├── core/
│   │   │   ├── config.py
│   │   │   ├── database.py
│   │   │   ├── security.py
│   │   │   ├── exceptions.py
│   │   │   ├── rate_limit.py
│   │   │   └── logging.py
│   │   ├── api/
│   │   │   ├── deps.py
│   │   │   └── v1/
│   │   │       ├── router.py
│   │   │       └── endpoints/
│   │   │           ├── auth.py
│   │   │           ├── workspaces.py
│   │   │           ├── invitations.py
│   │   │           ├── projects.py
│   │   │           ├── project_members.py
│   │   │           ├── tasks.py
│   │   │           ├── comments.py
│   │   │           ├── labels.py
│   │   │           ├── notifications.py
│   │   │           ├── dashboard.py
│   │   │           ├── users.py
│   │   │           └── admin.py
│   │   ├── models/
│   │   │   ├── user.py
│   │   │   ├── workspace.py
│   │   │   ├── workspace_member.py
│   │   │   ├── invitation.py
│   │   │   ├── refresh_token.py
│   │   │   ├── project.py
│   │   │   ├── project_member.py
│   │   │   ├── label.py
│   │   │   ├── task.py
│   │   │   ├── comment.py
│   │   │   └── notification.py
│   │   ├── schemas/
│   │   │   ├── common.py
│   │   │   ├── auth.py
│   │   │   ├── user.py
│   │   │   ├── workspace.py
│   │   │   ├── invitation.py
│   │   │   ├── project.py
│   │   │   ├── task.py
│   │   │   ├── comment.py
│   │   │   ├── notification.py
│   │   │   ├── dashboard.py
│   │   │   └── admin.py
│   │   ├── repositories/
│   │   │   ├── base.py
│   │   │   ├── user_repository.py
│   │   │   ├── project_repository.py
│   │   │   ├── task_repository.py
│   │   │   └── notification_repository.py
│   │   ├── services/
│   │   │   ├── auth_service.py
│   │   │   ├── workspace_service.py
│   │   │   ├── invitation_service.py
│   │   │   ├── project_service.py
│   │   │   ├── task_service.py
│   │   │   ├── comment_service.py
│   │   │   ├── notification_service.py
│   │   │   ├── dashboard_service.py
│   │   │   └── admin_service.py
│   │   ├── permissions/
│   │   │   ├── roles.py
│   │   │   ├── matrix.py
│   │   │   └── policies.py
│   │   └── utils/
│   │       ├── pagination.py
│   │       ├── object_id.py
│   │       └── mentions.py
│   └── tests/
│       ├── conftest.py
│       ├── factories.py
│       ├── unit/
│       └── integration/
│           ├── test_health.py
│           ├── test_auth.py
│           ├── test_rbac_matrix.py
│           ├── test_invitations.py
│           ├── test_projects.py
│           ├── test_admin.py
│           ├── test_tasks.py
│           ├── test_task_details.py
│           ├── test_notifications.py
│           └── test_dashboard.py
└── frontend/
    ├── index.html
    ├── package.json
    ├── tsconfig.json
    ├── vite.config.ts
    ├── tailwind.config.ts
    ├── postcss.config.js
    ├── playwright.config.ts
    ├── .env.example
    ├── e2e/
    └── src/
        ├── main.tsx
        ├── App.tsx
        ├── index.css
        ├── app/
        │   ├── providers.tsx
        │   ├── router.tsx
        │   └── queryClient.ts
        ├── config/
        │   ├── env.ts
        │   ├── navigation.ts
        │   └── roles.ts
        ├── lib/
        │   ├── axios.ts
        │   ├── cn.ts
        │   ├── formatters.ts
        │   └── motion.ts
        ├── types/
        ├── store/
        │   ├── authStore.ts
        │   ├── themeStore.ts
        │   └── layoutStore.ts
        ├── hooks/
        │   ├── useDebounce.ts
        │   ├── useMediaQuery.ts
        │   ├── useClickOutside.ts
        │   └── usePermission.ts
        ├── components/
        │   ├── ui/
        │   │   ├── Button.tsx
        │   │   ├── IconButton.tsx
        │   │   ├── Input.tsx
        │   │   ├── Textarea.tsx
        │   │   ├── Select.tsx
        │   │   ├── Checkbox.tsx
        │   │   ├── Badge.tsx
        │   │   ├── Avatar.tsx
        │   │   ├── AvatarGroup.tsx
        │   │   ├── Card.tsx
        │   │   ├── Modal.tsx
        │   │   ├── Drawer.tsx
        │   │   ├── Dropdown.tsx
        │   │   ├── Tabs.tsx
        │   │   ├── Tooltip.tsx
        │   │   ├── Skeleton.tsx
        │   │   ├── Spinner.tsx
        │   │   ├── EmptyState.tsx
        │   │   ├── ConfirmDialog.tsx
        │   │   ├── DataTable.tsx
        │   │   ├── Pagination.tsx
        │   │   ├── SearchInput.tsx
        │   │   ├── DatePicker.tsx
        │   │   └── index.ts
        │   ├── layout/
        │   │   ├── AppShell.tsx
        │   │   ├── Sidebar.tsx
        │   │   ├── SidebarItem.tsx
        │   │   ├── Topbar.tsx
        │   │   ├── UserMenu.tsx
        │   │   ├── MobileNav.tsx
        │   │   ├── PageHeader.tsx
        │   │   ├── PageTransition.tsx
        │   │   └── AuthLayout.tsx
        │   ├── common/
        │   │   ├── StatCard.tsx
        │   │   ├── RoleBadge.tsx
        │   │   ├── PriorityBadge.tsx
        │   │   ├── StatusPill.tsx
        │   │   ├── UserPicker.tsx
        │   │   ├── ErrorBoundary.tsx
        │   │   └── ThemeToggle.tsx
        │   └── guards/
        │       ├── ProtectedRoute.tsx
        │       ├── GuestRoute.tsx
        │       └── RoleGuard.tsx
        ├── features/
        │   ├── auth/            (api, hooks, components, pages, schemas)
        │   ├── workspace/
        │   ├── projects/
        │   ├── tasks/
        │   ├── board/
        │   ├── comments/
        │   ├── notifications/
        │   ├── dashboard/
        │   ├── admin/
        │   └── profile/
        └── pages/
            ├── NotFoundPage.tsx
            └── ForbiddenPage.tsx
```

Phase 2 adds `features/sprints`, `features/calendar`, `features/docs`, `features/automation`, `features/search`, `features/activity`, `features/audit` on the frontend and the matching models, schemas, services, and endpoints on the backend.

### Feature folder convention (frontend)

Every folder under `features/<name>/` contains: `api/` (Axios calls), `hooks/` (TanStack Query hooks), `components/` (feature-specific UI), `pages/` (route-level components), `schemas/` (Zod), and `types.ts`. Features import from `components/ui` and `components/common` but never from each other's internals; cross-feature use goes through each feature's `index.ts`.

---

## 5. Backend Architecture

### 5.1 Layering

`endpoint (router)` → `service` → `repository` → `model (Beanie document)`.

- Endpoints only parse input, call a service, and shape the response. No business logic.
- Services hold business rules, permission checks via `policies`, notification triggers, and orchestration.
- Repositories hold all database queries.
- Schemas (Pydantic) define request and response contracts; models are never returned directly.
- Dependencies in `api/deps.py`: `get_current_user`, `get_workspace_member`, `require_roles(...)`, `get_project_context` (resolves project + effective role, returns 404 if not visible).

### 5.2 Conventions

- API prefix `/api/v1`. OpenAPI at `/docs`.
- IDs exposed as strings. Field names `snake_case`.
- Error body: `{"code": "string_code", "message": "human readable", "details": {}}`. Validation errors use code `validation_error` with per-field details.
- Domain exceptions (`NotFoundError`, `ForbiddenError`, `ConflictError`, `UnauthorizedError`, `BusinessRuleError`) are mapped to HTTP responses by one global handler.
- Pagination response: `{"items": [], "total": 0, "page": 1, "page_size": 20}`.
- Config only through `pydantic-settings` reading environment variables: `MONGODB_URI`, `MONGODB_DB`, `JWT_SECRET`, `ACCESS_TOKEN_MINUTES`, `REFRESH_TOKEN_DAYS`, `CORS_ORIGINS`, `FRONTEND_URL`, `ENVIRONMENT`, optional SMTP settings.
- Rate limit: login and register at 10 requests per minute per IP.
- Security headers middleware and strict CORS origins list.

### 5.3 RBAC implementation

- `permissions/roles.py`: `Role` enum.
- `permissions/matrix.py`: dictionary mapping each role to a set of permission strings (`admin:access`, `user:manage`, `project:create`, `project:delete`, `project:members`, `task:create`, `task:edit_any`, `task:edit_own`, `task:delete_any`, `task:delete_own`, `comment:create`, `comment:delete_any`, `doc:write`, `automation:manage`, `project:view`). It mirrors SRS Appendix B exactly.
- `permissions/policies.py`: pure functions such as `can(role, permission)`, `can_modify_task(role, user_id, task)`, and `effective_role(workspace_role, override)`.
- A parametrized test iterates every role against every action and asserts the SRS matrix.

---

## 6. MongoDB Design

Primary keys are ObjectIds. References are stored as ObjectIds. Indexes are declared in each Beanie `Settings`.

| Collection | Key fields | Indexes |
|---|---|---|
| `users` | name, email (lowercase), password_hash, avatar_color, is_active, token_version, last_login_at, created_at, updated_at | unique(email) |
| `workspaces` | name, owner_id, created_at | none |
| `workspace_members` | workspace_id, user_id, role, created_at | unique(user_id), index(workspace_id, role) |
| `invitations` | workspace_id, email, role, token_hash, status (pending/accepted/revoked/expired), invited_by, expires_at, created_at | unique(token_hash), index(workspace_id, status), index(email) |
| `refresh_tokens` | user_id, jti_hash, expires_at, revoked_at, created_at | unique(jti_hash), TTL on expires_at |
| `projects` | workspace_id, name, key, description, color, statuses[{id, name, color, order, is_done}], created_by, created_at, updated_at | index(workspace_id), unique(workspace_id, key) |
| `project_members` | project_id, user_id, role_override (nullable), created_at | unique(project_id, user_id), index(user_id) |
| `labels` | project_id, name, color | unique(project_id, name) |
| `tasks` | project_id, parent_id (nullable), title, description, status_id, priority (low/medium/high/urgent), assignee_id, creator_id, due_date, label_ids[], checklist[{id, text, done}], position (float), completed_at, created_at, updated_at | index(project_id, status_id, position), index(assignee_id, due_date), index(parent_id) |
| `comments` | task_id, project_id, author_id, body, mentions[], created_at, edited_at | index(task_id, created_at) |
| `notifications` | user_id, type, task_id, project_id, actor_id, is_read, created_at | index(user_id, is_read, created_at) |

Phase 2 collections: `sprints`, `docs` (with embedded capped `versions[]`), `automation_rules`, `saved_views`, `attachments`, `activity_logs`, `audit_logs`, `password_reset_tokens`. Phase 2 task fields: `story_points`, `sprint_id`, `blocked_by[]`, plus a text index on `tasks.title` and `tasks.description`.

Position ordering uses fractional floats (midpoint between neighbours) so a drag only updates one document.

---

## 7. API Contract

Roles shown are the minimum allowed. "Visible" means the caller must be able to see the project.

### Phase 1

| Method | Path | Access |
|---|---|---|
| GET | /health | public |
| POST | /auth/register | public |
| POST | /auth/login | public |
| POST | /auth/refresh | cookie |
| POST | /auth/logout | authenticated |
| GET | /auth/me | authenticated |
| PATCH | /users/me | authenticated |
| POST | /users/me/password | authenticated |
| GET | /workspaces/current | authenticated |
| PATCH | /workspaces/current | super_admin |
| GET | /workspaces/current/members | super_admin, project_manager |
| POST | /invitations | super_admin |
| GET | /invitations | super_admin |
| DELETE | /invitations/{id} | super_admin |
| GET | /invitations/preview/{token} | public |
| POST | /invitations/accept/{token} | public |
| GET | /projects | authenticated (visible only) |
| POST | /projects | super_admin, project_manager |
| GET | /projects/{id} | visible |
| PATCH | /projects/{id} | project_manager (effective) |
| DELETE | /projects/{id} | project_manager (effective) |
| GET | /projects/{id}/members | visible |
| POST | /projects/{id}/members | project_manager (effective) |
| DELETE | /projects/{id}/members/{user_id} | project_manager (effective) |
| PUT | /projects/{id}/statuses | project_manager (effective) |
| GET, POST | /projects/{id}/labels | visible / member+ |
| GET | /projects/{id}/tasks | visible (filters: status_id, assignee_id, priority, label_id, due_before, due_after, q, parent_id) |
| POST | /projects/{id}/tasks | member+ |
| GET | /tasks/{id} | visible |
| PATCH | /tasks/{id} | own or project_manager |
| PATCH | /tasks/{id}/move | own or project_manager |
| DELETE | /tasks/{id} | own or project_manager |
| POST, PATCH, DELETE | /tasks/{id}/checklist | own or project_manager |
| GET | /tasks/{id}/comments | visible |
| POST | /tasks/{id}/comments | member+ |
| PATCH, DELETE | /comments/{id} | author, or project_manager for delete |
| GET | /notifications | authenticated |
| GET | /notifications/unread-count | authenticated |
| PATCH | /notifications/{id}/read | authenticated |
| POST | /notifications/read-all | authenticated |
| GET | /dashboard/me | authenticated |
| GET | /admin/stats | super_admin |
| GET | /admin/users | super_admin |
| GET | /admin/users/{id} | super_admin |
| PATCH | /admin/users/{id}/role | super_admin |
| PATCH | /admin/users/{id}/status | super_admin |
| PUT | /admin/users/{id}/projects/{project_id} | super_admin |
| DELETE | /admin/users/{id}/projects/{project_id} | super_admin |

### Phase 2 additions

Sprints (`/projects/{id}/sprints`, start, complete, burndown), backlog, calendar data via task filters, saved views, docs and doc versions, task-doc links, automation rules, `/search`, `/projects/{id}/dashboard`, attachments, task dependencies, task activity, `/admin/audit-logs`, `/auth/forgot-password`, `/auth/reset-password`.

---

## 8. Frontend Architecture

### 8.1 Routing

| Path | Page | Guard |
|---|---|---|
| /login, /register | Auth pages | GuestRoute |
| /invite/:token | Accept invitation | GuestRoute |
| / | Redirect to /dashboard | ProtectedRoute |
| /dashboard | Personal dashboard | ProtectedRoute |
| /projects | Projects grid | ProtectedRoute |
| /projects/:projectId | Project layout (tabs: Board, List, Members, Settings) | ProtectedRoute |
| /projects/:projectId/board | Kanban | ProtectedRoute |
| /projects/:projectId/list | List view | ProtectedRoute |
| /projects/:projectId/members | Project members | ProtectedRoute |
| /projects/:projectId/settings | Statuses, labels, details | RoleGuard (project_manager+) |
| /notifications | Full notifications page | ProtectedRoute |
| /profile | Profile and password | ProtectedRoute |
| /admin | Admin overview | RoleGuard (super_admin) |
| /admin/users | User management | RoleGuard (super_admin) |
| /admin/invitations | Invitations | RoleGuard (super_admin) |
| /403, * | Forbidden, Not found | none |

Task detail opens as a route-driven panel (`?task=<id>` query param) so it is linkable and survives refresh.

### 8.2 Data and state rules

- One Axios instance in `lib/axios.ts` attaches the token from `authStore` and handles refresh.
- Each feature has query-key factories and hooks (`useProjects`, `useTasks`, `useMoveTask`).
- Mutations invalidate precise keys. Board moves use optimistic updates with rollback and an error toast.
- `usePermission(permission, projectContext?)` reads the role from `authStore` and the shared matrix in `config/roles.ts`, and is used to hide or disable controls. The server remains the source of truth.

---

## 9. UI / UX Design System

### 9.1 Color palette (define as CSS variables, expose through Tailwind)

| Token | Light | Dark |
|---|---|---|
| primary-50 / 100 | #EEF2FF / #E0E7FF | #1E1B4B / #312E81 |
| primary-500 / 600 / 700 | #6366F1 / #4F46E5 / #4338CA | #818CF8 / #6366F1 / #4F46E5 |
| accent (violet) | #8B5CF6 | #A78BFA |
| background | #F8FAFC | #0B1120 |
| surface | #FFFFFF | #111827 |
| surface-muted | #F1F5F9 | #1E293B |
| border | #E2E8F0 | #1E293B |
| foreground | #0F172A | #F1F5F9 |
| muted-foreground | #64748B | #94A3B8 |
| success | #10B981 | #34D399 |
| warning | #F59E0B | #FBBF24 |
| danger | #F43F5E | #FB7185 |
| info | #0EA5E9 | #38BDF8 |

Semantic mappings: priority low = slate, medium = info, high = warning, urgent = danger. Default statuses: To Do slate, In Progress primary, In Review accent, Done success. Role badges: Super Admin accent, Project Manager primary, Member success, Viewer slate.

Components use semantic classes (`bg-surface text-foreground border-border`) so dark mode needs no per-component overrides. `darkMode: "class"`, default follows the system and the choice persists.

### 9.2 Typography, shape, depth

- Font: Inter (variable). Scale: 12, 14 (body), 16, 20, 24, 30.
- Radius: `rounded-xl` for cards and modals, `rounded-lg` for inputs and buttons.
- Shadows: soft layered shadows in light mode; borders instead of shadows in dark mode.
- Subtle gradient (primary to accent) only on the auth hero panel, primary buttons on hover, and stat-card icon tiles.
- Spacing on a 4px grid; page content max width 1400px with 16px (mobile) / 24px (tablet) / 32px (desktop) gutters.

### 9.3 Icons

lucide-react only, sizes 16 (inline), 18 (buttons and nav), 20 (headers), 24 (empty states). Examples: LayoutDashboard, FolderKanban, ListChecks, Users, ShieldCheck, Bell, Settings, Search, Plus, Calendar, MessageSquare, Flag, CheckCircle2, MoreHorizontal, LogOut, Sun, Moon.

### 9.4 Motion (Framer Motion)

- `MotionConfig reducedMotion="user"` at the root.
- Route change: fade and 8px rise, 200ms.
- Lists and grids: staggered entrance, 40ms per item, capped at 8 items.
- Modal: scale 0.96 to 1 with fade, spring (stiffness 300, damping 30). Drawer: slide in from the right (bottom sheet on mobile).
- Kanban cards: `layout` animation on reorder; lift shadow while dragging.
- Buttons: `whileTap` scale 0.98. Sidebar collapse: width animation 220ms.
- Shared variants live in `lib/motion.ts`; no ad hoc durations inside components.

### 9.5 Responsive behaviour

| Breakpoint | Behaviour |
|---|---|
| below 768px (mobile) | Sidebar becomes a slide-in drawer opened from the topbar menu button; tables render as stacked cards; task panel becomes a full-screen bottom sheet; board columns become horizontal snap-scroll with a "move to status" menu on each card as a drag alternative; touch targets at least 44px |
| 768 to 1023px (tablet) | Sidebar collapsed to icon rail with tooltips; two-column grids |
| 1024px and above | Full 260px sidebar (collapsible to 72px), multi-column layouts, side-panel task detail |

### 9.6 Layout and key screens

- **AppShell:** sidebar left, sticky topbar (page title or breadcrumb, global search placeholder in Phase 1, notification bell with badge, theme toggle, user menu), scrollable content area. Sidebar groups: Workspace (Dashboard, Projects, Notifications), Admin (Overview, Users, Invitations; visible only to Super Admin), and the user card with role badge at the bottom.
- **Auth pages:** split layout on desktop (brand hero with gradient and feature highlights, form card on the right); single centered card on mobile.
- **Dashboard:** greeting, four stat cards (Assigned to me, Overdue, Due this week, Completed this week), "My tasks" list with priority and due chips, "My projects" cards with progress bars.
- **Projects:** responsive card grid with color accent, member avatar group, progress bar, and a "New project" card.
- **Board:** horizontally scrolling columns with status color header and count, cards showing title, priority badge, due date chip, assignee avatar, subtask progress; "Add task" at the column foot; filter bar above.
- **List view:** sortable table with inline status and priority pills, filter bar, saved-filter slot (Phase 2).
- **Task panel:** title (inline edit), status, assignee, priority, due date, labels, description, checklist with progress, subtasks, comments with @mention picker.
- **Admin Users:** search, role and status filters, table with avatar, role badge, status badge, last login, project count and row actions; row opens a drawer with role selector, project membership toggles with per-project role select, deactivate/reactivate.
- Every data screen has skeleton loading, an illustrated empty state with a primary action, and an error state with retry.

---

## 10. Build Workflow (step by step)

Rules for every step: build backend and frontend together for that slice; the step is finished only when its automated tests pass and its workflow checklist has been walked through. Do not start the next step until the current one is green. Do not leave stubs or mock data in finished steps.

### PHASE 1

#### Step 0 — Scaffold and tooling
- Monorepo structure, `docker-compose.yml` (MongoDB + API), backend skeleton with `/health`, config, logging, global exception handler, Beanie initialisation, test fixtures with an isolated test database dropped after the session.
- Frontend Vite + TypeScript + Tailwind with design tokens, fonts, Vitest, eslint, prettier, Axios instance, providers, router shell.

| Test | Expected |
|---|---|
| T0.1 `GET /api/v1/health` | 200, `{status: "ok", database: "up"}` |
| T0.2 Start API with missing `MONGODB_URI` | Fails fast with a clear configuration error |
| T0.3 `pytest` and `npm run test` | Both run green |
| T0.4 `npm run lint` and `ruff check` | No errors |
| T0.5 `docker compose up` | MongoDB and API start; frontend dev server reaches the API through the proxy |

#### Step 1 — Design system and app shell
- Build all `components/ui`, `layout`, `common` components, theme store with persistence, layout store, `useMediaQuery`, motion variants.
- Dev-only `/__ui` showcase route rendering every component and state.

| Test | Expected |
|---|---|
| T1.1 Button variants, loading, disabled (unit) | Correct classes; click blocked when loading or disabled |
| T1.2 Modal (unit) | Opens, traps focus, closes on ESC and backdrop click, restores focus |
| T1.3 Dropdown and Tabs keyboard navigation | Arrow keys and Enter work |
| T1.4 Theme toggle | Switches class on html, persists after reload |
| T1.5 Sidebar at 375px, 768px, 1280px | Drawer, icon rail, full sidebar respectively |
| T1.6 Reduced-motion OS setting | Animations are minimised |

#### Step 2 — Authentication
- Backend: register (creates user, workspace, membership as Super Admin), login, refresh with rotation, logout, me, argon2 hashing, rate limiting, token_version check.
- Frontend: Login and Register pages with Zod validation, auth store, Axios refresh interceptor, ProtectedRoute and GuestRoute, session bootstrap on app load.

| Test | Expected |
|---|---|
| T2.1 Register valid | 201, user plus workspace plus super_admin membership created, access token returned, refresh cookie set |
| T2.2 Register duplicate email (case-insensitive) | 409 `email_taken` |
| T2.3 Register weak password | 422 with field detail |
| T2.4 Login valid | 200 with tokens |
| T2.5 Login wrong password or unknown email | 401 with the same generic message |
| T2.6 Login deactivated user | 403 `account_deactivated` |
| T2.7 Refresh | New access token; old refresh token rejected afterwards |
| T2.8 Protected endpoint without or with expired token | 401 |
| T2.9 Password stored | Database contains an argon2 hash, never plaintext |
| T2.10 Frontend: submit empty forms | Inline validation messages |
| T2.11 Frontend: login success | Redirect to dashboard; reload keeps session through refresh |
| T2.12 Frontend: visit `/projects` logged out | Redirected to login, returned to `/projects` after login |
| T2.13 Frontend: access token expires mid-use | Request silently retried, user not logged out |
| T2.14 Logout | State cleared, refresh token revoked, protected routes blocked |

#### Step 3 — Roles, workspace members, invitations
- Backend: permissions package (roles, matrix, policies), dependencies, workspace endpoints, invitation create, list, revoke, preview, accept.
- Frontend: `usePermission`, `RoleGuard`, 403 page, accept-invite page.

| Test | Expected |
|---|---|
| T3.1 Parametrized matrix test: every role against every permission | Matches SRS Appendix B exactly |
| T3.2 Non-admin creates invitation | 403 |
| T3.3 Invite an email that already has an account | 409 |
| T3.4 Accept valid invitation | User created with the invited role in the workspace; token cannot be reused |
| T3.5 Accept expired or revoked token | 410 |
| T3.6 Invitation token storage | Only the hash is stored |
| T3.7 Frontend: invite link opens accept page showing workspace name and role | Form submits and logs the user in |
| T3.8 Frontend: Member opens an admin URL | Redirected to 403 page |

#### Step 4 — Projects and project members
- Backend: project CRUD with seeded default statuses, project members add and remove, visibility rules, cascade delete, effective role resolution including override.
- Frontend: projects grid, create and edit modal, project layout with tabs, members tab with add-member picker.

| Test | Expected |
|---|---|
| T4.1 Project Manager creates project | 201, creator auto-added as member, default statuses present |
| T4.2 Member or Viewer creates project | 403 |
| T4.3 Viewer lists projects | Only projects they were added to |
| T4.4 Non-member opens a project | 404 |
| T4.5 Super Admin lists projects | All projects in workspace |
| T4.6 Duplicate project key in workspace | 409 |
| T4.7 Delete project | Tasks, comments, labels, memberships removed |
| T4.8 Member with project override `viewer` | Read-only in that project, normal in others |
| T4.9 Frontend: create project | Appears in grid with animation; empty-state shown when none |
| T4.10 Frontend: Viewer | No create, edit, or delete controls rendered |

#### Step 5 — Admin dashboard
- Backend: stats, user list with search, role and status filters, pagination, user detail, role change, status change, per-project override set and remove, last-Super-Admin protection.
- Frontend: Admin overview stat cards, Users table (card list on mobile), user drawer with role select and project membership toggles with per-project role, Invitations page with create form, copy-link, resend, revoke.

| Test | Expected |
|---|---|
| T5.1 Any admin endpoint as non-Super-Admin | 403 |
| T5.2 Change a user's role | Persisted; that user's next request uses the new role |
| T5.3 Demote or deactivate the only Super Admin | 409 |
| T5.4 Super Admin deactivates self | 409 |
| T5.5 Deactivate user | Their existing access token is rejected immediately; their data remains |
| T5.6 Reactivate user | They can log in again |
| T5.7 Set per-project override | Effective role changes only in that project |
| T5.8 Remove override | Falls back to workspace role |
| T5.9 User list search and filters | Correct subset; pagination totals correct |
| T5.10 Frontend: sidebar | Admin group visible only for Super Admin |
| T5.11 Frontend: change role in drawer | Table row and badge update without reload |
| T5.12 Frontend: mobile | Users shown as cards, drawer becomes bottom sheet |

#### Step 6 — Tasks core
- Backend: task CRUD, filters, pagination, own-task rule, assignee-must-be-member rule, position ordering, completed_at handling when moving into a done status.
- Frontend: task create modal, task panel (title, description, status, assignee, priority, due date), assignee picker limited to project members, URL-driven panel.

| Test | Expected |
|---|---|
| T6.1 Create task with required fields | 201; missing title gives 422 |
| T6.2 Assignee not in project | 422 |
| T6.3 Member edits own task (creator or assignee) | 200 |
| T6.4 Member edits someone else's task | 403 |
| T6.5 Project Manager edits any task | 200 |
| T6.6 Viewer creates or edits | 403 |
| T6.7 Filter by status, assignee, priority, due range, text | Correct results; combinations work |
| T6.8 Move into a done status | `completed_at` set; moving out clears it |
| T6.9 Frontend: create then reopen via URL | Panel restores the same task after refresh |
| T6.10 Frontend: inline edit | Optimistic update; error rolls back with toast |

#### Step 7 — Task details: subtasks, checklist, labels, statuses, comments
- Backend: subtasks (tasks with `parent_id`), embedded checklist, project labels CRUD and assignment, status management (add, rename, reorder, recolor, delete-with-reassign), comments with mention parsing against project members.
- Frontend: subtask list with progress, checklist with progress bar, label picker, project settings page for statuses and labels, comment thread with @mention autocomplete and highlighted mentions.

| Test | Expected |
|---|---|
| T7.1 Create subtask | Linked to parent; parent shows progress count |
| T7.2 Subtask of a subtask | Rejected (one level in v1) |
| T7.3 Checklist add, toggle, delete | Persisted state |
| T7.4 Assign labels | Stored; label deletion removes it from tasks |
| T7.5 Delete status that has tasks | 409 until tasks are reassigned |
| T7.6 Reorder statuses | Order persisted and reflected on board |
| T7.7 Comment with `@name` of a project member | `mentions` contains that user id; non-members ignored |
| T7.8 Viewer comments | 403 |
| T7.9 Author edits and deletes own comment; Project Manager deletes any | Allowed; others 403 |
| T7.10 Frontend: @ opens member picker, keyboard selectable | Mention rendered highlighted |

#### Step 8 — List and Kanban views
- Backend: move endpoint (status plus fractional position).
- Frontend: List view with sortable columns and filter bar synced to URL query, Kanban board with dnd-kit, optimistic move, column task counts, quick add per column, mobile snap-scroll with "Move to" menu.

| Test | Expected |
|---|---|
| T8.1 Move task to another status and position | Persisted; order correct after reload |
| T8.2 Move fails server-side | Card returns to origin, error toast shown |
| T8.3 Viewer | Cards not draggable, no quick add |
| T8.4 Member drags another user's card | Prevented, with explanatory tooltip |
| T8.5 Filters in List view | Reflected in URL; refresh preserves them |
| T8.6 Mobile 375px | Columns snap-scroll; "Move to" menu changes status |
| T8.7 Drag animation | Card lifts, neighbours animate into place |

#### Step 9 — Notifications
- Backend: notification on assignment (not on self-assignment), list, unread count, mark read, read-all.
- Frontend: bell with animated badge, popover list, full notifications page, refetch every 30 seconds.

| Test | Expected |
|---|---|
| T9.1 Assign task to another user | Notification created for the assignee |
| T9.2 Assign task to self | No notification |
| T9.3 Reassign | New assignee notified |
| T9.4 Mark one read and read-all | Unread count updates |
| T9.5 Access another user's notification | 404 |
| T9.6 Frontend: click notification | Marks read and opens the task panel |

#### Step 10 — Dashboard and profile
- Backend: `/dashboard/me` aggregating assigned open tasks, overdue, due this week, completed this week, and the user's projects with progress. Profile update, change password (revokes other refresh tokens).
- Frontend: dashboard page, profile page.

| Test | Expected |
|---|---|
| T10.1 Seed known data, request dashboard | Counts match exactly |
| T10.2 Dashboard for a Viewer | Only tasks from visible projects |
| T10.3 Change password with wrong current password | 400 |
| T10.4 Change password success | Old password fails; new works; other sessions logged out |
| T10.5 Frontend: stat cards and lists | Skeletons then data; empty states when no tasks |

#### Step 11 — Phase 1 hardening and release
- Seed script (demo workspace with one user per role, three projects, varied tasks, comments, notifications), security review (CORS, headers, rate limits, input validation), error boundary, 404 and 403 pages, accessibility pass (labels, focus, contrast), loading and empty state audit, README with run instructions, Dockerfiles, full regression.

| Test | Expected |
|---|---|
| E2E-1 | Sign up, create project, create task, drag on board, see it on dashboard |
| E2E-2 | Admin invites a Member, invitation accepted, Member sees only the allowed projects |
| E2E-3 | Viewer can read everything assigned and has no write controls |
| E2E-4 | Admin sets a per-project override and the user's permissions change in that project only |
| E2E-5 | Deactivated user is kicked out on the next request |
| T11.1 Full backend and frontend suites | All green |
| T11.2 Manual pass at 375px, 768px, 1280px in light and dark | No layout breaks |

**Phase 1 acceptance:** a fresh clone runs with `docker compose up` plus `npm run dev`, the seed script produces a demo, and E2E-1 to E2E-5 pass.

### PHASE 2

#### Step P2-1 — Sprints, backlog, story points, burndown
- One active sprint per project; start, complete (unfinished tasks return to backlog); story points on tasks; backlog page; burndown computed from `completed_at` and story points; Recharts burndown.
- Tests: only one active sprint (409 otherwise); completing moves unfinished tasks to backlog; burndown values match seeded data; Viewer cannot plan sprints; chart renders on mobile.

#### Step P2-2 — Calendar view and saved views
- Month and week calendar by due date with drag-to-reschedule; mobile agenda list; saved personal views storing filters and sort.
- Tests: task appears on its due date; rescheduling persists; saved view reproduces filters; another user cannot read a personal view.

#### Step P2-3 — Docs
- TipTap rich text docs per project, version snapshots on save (keep latest 20), view and restore versions, link docs to tasks.
- Tests: Viewer reads but cannot edit; save creates a version; restore creates a new version; link and unlink with tasks; unsafe HTML is sanitised.

#### Step P2-4 — Automation
- Rules: "when status changes to X, notify assignee" and "when due date passed and not done, mark overdue". Overdue is a derived flag in task responses plus a scheduled job that sends a single overdue notification.
- Tests: status change triggers notification once; disabled rule does nothing; only Project Manager and Super Admin manage rules; overdue flag correct around midnight UTC.

#### Step P2-5 — Search and project dashboard
- MongoDB text index, `/search` scoped to visible projects, command palette on Ctrl+K and topbar search; project dashboard with status donut, progress bar, workload by assignee.
- Tests: search respects visibility; case-insensitive; empty query handled; chart totals equal task counts.

#### Step P2-6 — Attachments, dependencies, activity trail, mention notifications
- Local-disk storage behind a storage interface (10 MB limit, extension allowlist); blocked-by dependencies with cycle prevention and a warning when moving a blocked task to done; per-task activity log; mention notifications.
- Tests: oversized or disallowed file rejected; downloads require visibility; cycle rejected; activity records status, assignee, and edit changes; mention notifies each mentioned member once.

#### Step P2-7 — Audit log, password reset, final release
- Audit log for role changes, removals, deactivations, project deletions with admin viewer and filters; forgot and reset password with single-use expiring token (link logged in development); final performance check against NFR-PERF-001 and 002 with 500 seeded tasks; backup and restore instructions; deployment guide (Atlas, a container host for the API, a static host for the frontend); full regression and E2E suite.
- Tests: audit entries for each action with actor and timestamp; reset token single-use and expiring; board with 500 tasks loads within 2 seconds locally; full suites green.

---

## 11. Testing Strategy and Commands

| Level | Tool | Scope |
|---|---|---|
| Backend integration | pytest + httpx + real MongoDB test DB | Every endpoint, permission, business rule |
| Backend unit | pytest | Policies, mention parser, pagination, position math |
| Frontend unit and component | Vitest + React Testing Library + MSW | UI components, hooks, forms, guards |
| End-to-end | Playwright | The workflows listed at the end of Phase 1 and Phase 2 |

Commands the project must support: `docker compose up -d mongo`, `pytest -q`, `ruff check .`, `npm run dev`, `npm run test`, `npm run lint`, `npm run build`, `npx playwright test`, `python -m scripts.seed`.

Coverage targets: backend services and policies at 85% or higher; frontend guards, stores, and forms covered.

---

## 12. Scrum Mapping (2-week sprints)

| Sprint | Work |
|---|---|
| 1 | Steps 0, 1, 2 |
| 2 | Steps 3, 4 |
| 3 | Steps 5, 6 (midterm demo: roles, admin dashboard, tasks) |
| 4 | Steps 7, 8 |
| 5 | Steps 9, 10, 11 (Phase 1 release) |
| 6 | Steps P2-1, P2-2 |
| 7 | Steps P2-3, P2-4, P2-5 |
| 8 | Steps P2-6, P2-7 (final release and demo) |

The product backlog may be re-prioritised each sprint review; the order above is the starting plan.

---

## 13. Code Quality Standards

- No comments in code, no TODO markers, no commented-out code, no placeholder or mock data in shipped paths. Code must read clearly through naming and small functions.
- Backend: type hints everywhere, async I/O only, one responsibility per function, no business logic in endpoints, no database access outside repositories.
- Frontend: TypeScript strict mode, no `any`, one component per file, components under about 150 lines (extract hooks and subcomponents), no inline API calls inside components, no duplicated Tailwind class clusters (extract into `ui` components or `cva` variants).
- Constants, enums, and route paths defined once and imported.
- Every user-visible action has loading, success, and error feedback.
- Accessibility: semantic elements, labelled inputs, visible focus rings, ARIA on custom widgets, color contrast AA.
- Git: small commits per step with message `step N: summary`.

---

## 14. Definition of Done (per step)

1. All listed automated tests for the step exist and pass, together with all earlier tests.
2. The step's workflow can be performed by hand in the browser end to end with real data from MongoDB.
3. Responsive at 375px, 768px, 1280px; light and dark mode checked.
4. Lint and type checks pass with zero warnings.
5. No comments, TODOs, or placeholder data left in the code.
6. A short summary is given: files added, commands to run, test results, and anything that deviates from this blueprint.
