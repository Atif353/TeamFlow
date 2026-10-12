import type { Role } from '@/types/common'

export const ROLES: Role[] = ['super_admin', 'project_manager', 'member', 'viewer']

export const ROLE_LABELS: Record<Role, string> = {
  super_admin: 'Super Admin',
  project_manager: 'Project Manager',
  member: 'Member',
  viewer: 'Viewer',
}

export const OVERRIDE_ROLES: Role[] = ['project_manager', 'member', 'viewer']

export type Permission =
  | 'admin:access'
  | 'user:manage'
  | 'project:create'
  | 'project:delete'
  | 'project:members'
  | 'project:view'
  | 'task:create'
  | 'task:edit_any'
  | 'task:edit_own'
  | 'task:delete_any'
  | 'task:delete_own'
  | 'comment:create'
  | 'comment:delete_any'
  | 'doc:write'
  | 'automation:manage'
  | 'sprint:manage'

const MEMBER_PERMISSIONS: Permission[] = [
  'project:view',
  'task:create',
  'task:edit_own',
  'task:delete_own',
  'comment:create',
  'doc:write',
]

const MANAGER_PERMISSIONS: Permission[] = [
  ...MEMBER_PERMISSIONS,
  'project:create',
  'project:delete',
  'project:members',
  'task:edit_any',
  'task:delete_any',
  'comment:delete_any',
  'automation:manage',
  'sprint:manage',
]

const ROLE_PERMISSIONS: Record<Role, ReadonlySet<Permission>> = {
  super_admin: new Set<Permission>([...MANAGER_PERMISSIONS, 'admin:access', 'user:manage']),
  project_manager: new Set(MANAGER_PERMISSIONS),
  member: new Set(MEMBER_PERMISSIONS),
  viewer: new Set<Permission>(['project:view']),
}

export function can(role: Role | null | undefined, permission: Permission): boolean {
  return role ? ROLE_PERMISSIONS[role].has(permission) : false
}

interface TaskOwnership {
  creator_id: string
  assignee_id: string | null
}

export function isTaskOwner(userId: string | undefined, task: TaskOwnership): boolean {
  return Boolean(userId) && (task.creator_id === userId || task.assignee_id === userId)
}

export function canEditTask(
  role: Role | null | undefined,
  userId: string | undefined,
  task: TaskOwnership,
) {
  return can(role, 'task:edit_any') || (can(role, 'task:edit_own') && isTaskOwner(userId, task))
}

export function canDeleteTask(
  role: Role | null | undefined,
  userId: string | undefined,
  task: TaskOwnership,
) {
  return can(role, 'task:delete_any') || (can(role, 'task:delete_own') && isTaskOwner(userId, task))
}
