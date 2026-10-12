import type { Project, ProjectMember, ProjectStatus } from '@/features/projects/types'
import type { Task } from '@/features/tasks/types'
import { useAuthStore } from '@/store/authStore'
import type { Page, Role, User, Workspace } from '@/types/common'

export const STATUSES: ProjectStatus[] = [
  { id: 's-todo', name: 'To Do', color: '#64748B', order: 0, is_done: false, wip_limit: null },
  {
    id: 's-progress',
    name: 'In Progress',
    color: '#6366F1',
    order: 1,
    is_done: false,
    wip_limit: null,
  },
  {
    id: 's-review',
    name: 'In Review',
    color: '#8B5CF6',
    order: 2,
    is_done: false,
    wip_limit: null,
  },
  { id: 's-done', name: 'Done', color: '#10B981', order: 3, is_done: true, wip_limit: null },
]

export function buildUser(overrides: Partial<User> = {}): User {
  return {
    id: 'u-me',
    name: 'Mia Member',
    email: 'mia@teamflow.io',
    avatar_color: '#6366F1',
    is_active: true,
    email_verified: true,
    email_preferences: {
      assigned: true,
      mentioned: true,
      overdue: true,
      comments: false,
      status_changes: false,
      daily_digest: false,
    },
    last_login_at: null,
    created_at: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

export function buildWorkspace(overrides: Partial<Workspace> = {}): Workspace {
  return {
    id: 'w-1',
    name: 'Acme',
    owner_id: 'u-admin',
    created_at: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

export function buildProject(overrides: Partial<Project> = {}): Project {
  return {
    id: 'p-1',
    workspace_id: 'w-1',
    name: 'Apollo',
    key: 'APO',
    description: 'Moon landing',
    color: '#6366F1',
    statuses: STATUSES,
    components: [],
    transitions: {},
    created_by: 'u-admin',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-02T00:00:00Z',
    my_role: 'member',
    member_count: 2,
    task_count: 4,
    done_task_count: 1,
    members: [],
    ...overrides,
  }
}

export function buildTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 't-1',
    key: 'APO-1',
    issue_number: 1,
    issue_type: 'task',
    project_id: 'p-1',
    parent_id: null,
    parent: null,
    epic_id: null,
    epic: null,
    sprint_id: null,
    sprint: null,
    version_id: null,
    version: null,
    title: 'Write specs',
    description: '',
    environment: '',
    status_id: 's-todo',
    priority: 'medium',
    assignee_id: null,
    assignee: null,
    creator_id: 'u-me',
    creator: { id: 'u-me', name: 'Mia Member', avatar_color: '#6366F1', is_active: true },
    start_date: null,
    due_date: null,
    labels: [],
    components: [],
    checklist: [],
    checklist_total: 0,
    checklist_done: 0,
    subtask_total: 0,
    subtask_done: 0,
    child_total: 0,
    child_done: 0,
    story_points: null,
    original_estimate_minutes: null,
    remaining_estimate_minutes: null,
    time_spent_minutes: 0,
    flagged: false,
    watchers: [],
    is_watching: false,
    blocked_by_open: 0,
    position: 1024,
    rank: 1024,
    completed_at: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

export function buildMember(overrides: Partial<ProjectMember> = {}): ProjectMember {
  return {
    user_id: 'u-me',
    name: 'Mia Member',
    email: 'mia@teamflow.io',
    avatar_color: '#6366F1',
    is_active: true,
    workspace_role: 'member',
    role_override: null,
    effective_role: 'member',
    ...overrides,
  }
}

export function page<T>(items: T[], overrides: Partial<Page<T>> = {}): Page<T> {
  return { items, total: items.length, page: 1, page_size: 20, ...overrides }
}

export function signIn(role: Role = 'member', user: Partial<User> = {}) {
  useAuthStore.getState().setSession({
    user: buildUser(user),
    workspace: buildWorkspace(),
    role,
    access_token: 'test-token',
  })
}
