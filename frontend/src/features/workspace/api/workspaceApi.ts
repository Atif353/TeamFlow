import { api } from '@/lib/axios'
import type { Page, Role, Workspace } from '@/types/common'

export interface WorkspaceMember {
  user_id: string
  name: string
  email: string
  avatar_color: string
  role: Role
  is_active: boolean
}

export async function fetchWorkspace() {
  const { data } = await api.get<Workspace>('/workspaces/current')
  return data
}

export async function fetchWorkspaceMembers() {
  const { data } = await api.get<Page<WorkspaceMember>>('/workspaces/current/members', {
    params: { page_size: 100 },
  })
  return data
}
