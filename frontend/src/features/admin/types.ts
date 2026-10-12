import type { NamedCount, UserCount } from '@/features/agile/types'
import type { Role, UserBrief } from '@/types/common'

export interface AdminStats {
  total_users: number
  active_users: number
  inactive_users: number
  users_by_role: Partial<Record<Role, number>>
  pending_invitations: number
  total_projects: number
  total_tasks: number
  completed_tasks: number
}

export interface AdminUser {
  id: string
  name: string
  email: string
  avatar_color: string
  role: Role
  is_active: boolean
  last_login_at: string | null
  created_at: string
  project_count: number
}

export interface AdminUserProject {
  project_id: string
  name: string
  key: string
  color: string
  role_override: Role | null
  effective_role: Role
}

export interface AdminUserDetail extends AdminUser {
  projects: AdminUserProject[]
}

export type InvitationStatus = 'pending' | 'accepted' | 'revoked' | 'expired'

export interface Invitation {
  id: string
  email: string
  role: Role
  status: InvitationStatus
  expires_at: string
  created_at: string
  invited_by: UserBrief | null
}

export interface InvitationCreated extends Invitation {
  invite_url: string
}

export interface AdminUserParams {
  page?: number
  page_size?: number
  q?: string
  role?: Role
  is_active?: boolean
}

export interface InvitationParams {
  page?: number
  page_size?: number
  status?: InvitationStatus
}

export interface AdminUserCreateInput {
  name: string
  email: string
  password: string
  role: Role
}

export interface AuditEntry {
  id: string
  action: string
  entity_type: string
  entity_id: string | null
  summary: string
  metadata: Record<string, unknown>
  actor: UserBrief | null
  created_at: string
}

export interface AuditParams {
  page?: number
  page_size?: number
  action?: string
  q?: string
}

export interface TeamMemberRow {
  user: UserBrief
  role: Role
  open_issues: number
  overdue: number
  completed_30_days: number
  minutes_30_days: number
}

export interface WorkspaceAnalytics {
  team: TeamMemberRow[]
  total_open: number
  total_overdue: number
  total_completed_30_days: number
  projects: {
    project_id: string
    name: string
    key: string
    color: string
    total: number
    done: number
  }[]
  type_counts: NamedCount[]
  priority_counts: NamedCount[]
  created_vs_resolved: { date: string; created: number; resolved: number }[]
  signups: { date: string; count: number }[]
  top_contributors: UserCount[]
  active_sprints: number
  total_minutes_logged: number
  audit_events: NamedCount[]
}
