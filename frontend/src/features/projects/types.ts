import type { Role, UserBrief } from '@/types/common'

export interface ProjectStatus {
  id: string
  name: string
  color: string
  order: number
  is_done: boolean
  wip_limit: number | null
}

export interface Project {
  id: string
  workspace_id: string
  name: string
  key: string
  description: string
  color: string
  statuses: ProjectStatus[]
  components: string[]
  transitions: Record<string, string[]>
  created_by: string
  created_at: string
  updated_at: string
  my_role: Role
  member_count: number
  task_count: number
  done_task_count: number
  members: UserBrief[]
}

export interface ProjectMember {
  user_id: string
  name: string
  email: string
  avatar_color: string
  is_active: boolean
  workspace_role: Role
  role_override: Role | null
  effective_role: Role
}

export interface Label {
  id: string
  project_id: string
  name: string
  color: string
}

export interface StatusInput {
  id?: string
  name: string
  color: string
  is_done: boolean
  wip_limit: number | null
}

export interface ProjectListParams {
  page?: number
  page_size?: number
  q?: string
}
