export type Role = 'super_admin' | 'project_manager' | 'member' | 'viewer'

export type Priority = 'low' | 'medium' | 'high' | 'urgent'

export interface Page<T> {
  items: T[]
  total: number
  page: number
  page_size: number
}

export interface PageQuery {
  page?: number
  page_size?: number
}

export interface UserBrief {
  id: string
  name: string
  avatar_color: string
  is_active: boolean
}

export interface EmailPreferences {
  assigned: boolean
  mentioned: boolean
  overdue: boolean
  comments: boolean
  status_changes: boolean
  daily_digest: boolean
}

export interface User {
  id: string
  name: string
  email: string
  avatar_color: string
  is_active: boolean
  email_verified: boolean
  email_preferences: EmailPreferences
  last_login_at: string | null
  created_at: string
}

export interface Workspace {
  id: string
  name: string
  owner_id: string
  created_at: string
}

export interface AuthPayload {
  user: User
  workspace: Workspace
  role: Role
  access_token: string
}
