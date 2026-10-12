import { api } from '@/lib/axios'
import type { Page, Role } from '@/types/common'
import type {
  AdminStats,
  AdminUser,
  AdminUserCreateInput,
  AdminUserDetail,
  AdminUserParams,
  AuditEntry,
  AuditParams,
  WorkspaceAnalytics,
  Invitation,
  InvitationCreated,
  InvitationParams,
} from '../types'

export async function fetchAdminStats() {
  return (await api.get<AdminStats>('/admin/stats')).data
}

export async function fetchAdminUsers(params: AdminUserParams) {
  return (await api.get<Page<AdminUser>>('/admin/users', { params })).data
}

export async function fetchAdminUser(userId: string) {
  return (await api.get<AdminUserDetail>(`/admin/users/${userId}`)).data
}

export async function changeUserRole(userId: string, role: Role) {
  return (await api.patch<AdminUserDetail>(`/admin/users/${userId}/role`, { role })).data
}

export async function changeUserStatus(userId: string, isActive: boolean) {
  return (
    await api.patch<AdminUserDetail>(`/admin/users/${userId}/status`, { is_active: isActive })
  ).data
}

export async function setProjectOverride(
  userId: string,
  projectId: string,
  roleOverride: Role | null,
) {
  return (
    await api.put<AdminUserDetail>(`/admin/users/${userId}/projects/${projectId}`, {
      role_override: roleOverride,
    })
  ).data
}

export async function removeFromProject(userId: string, projectId: string) {
  return (await api.delete<AdminUserDetail>(`/admin/users/${userId}/projects/${projectId}`)).data
}

export async function fetchInvitations(params: InvitationParams) {
  return (await api.get<Page<Invitation>>('/invitations', { params })).data
}

export async function createInvitation(input: { email: string; role: Role }) {
  return (await api.post<InvitationCreated>('/invitations', input)).data
}

export async function revokeInvitation(invitationId: string) {
  await api.delete(`/invitations/${invitationId}`)
}

export async function createAdminUser(input: AdminUserCreateInput) {
  return (await api.post<AdminUserDetail>('/admin/users', input)).data
}

export async function updateAdminUser(userId: string, input: { name?: string; email?: string }) {
  return (await api.patch<AdminUserDetail>(`/admin/users/${userId}`, input)).data
}

export async function resetUserPassword(userId: string, password: string) {
  return (await api.post<AdminUserDetail>(`/admin/users/${userId}/password`, { password })).data
}

export async function fetchAnalytics() {
  return (await api.get<WorkspaceAnalytics>('/admin/analytics')).data
}

export async function fetchAuditLogs(params: AuditParams) {
  return (await api.get<Page<AuditEntry>>('/admin/audit-logs', { params })).data
}

export async function fetchAuditActions() {
  return (await api.get<{ actions: string[] }>('/admin/audit-logs/actions')).data.actions
}
