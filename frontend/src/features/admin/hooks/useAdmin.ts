import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query'
import { toast } from 'sonner'
import { errorMessage } from '@/lib/axios'
import type { Role } from '@/types/common'
import {
  changeUserRole,
  changeUserStatus,
  createAdminUser,
  createInvitation,
  fetchAnalytics,
  fetchAuditActions,
  fetchAuditLogs,
  resetUserPassword,
  updateAdminUser,
  fetchAdminStats,
  fetchAdminUser,
  fetchAdminUsers,
  fetchInvitations,
  removeFromProject,
  revokeInvitation,
  setProjectOverride,
} from '../api/adminApi'
import type { AdminUserDetail, AdminUserParams, AuditParams, InvitationParams } from '../types'

export const adminKeys = {
  stats: ['admin', 'stats'] as const,
  users: (params: AdminUserParams) => ['admin', 'users', params] as const,
  detail: (userId: string) => ['admin', 'user', userId] as const,
  invitations: (params: InvitationParams) => ['admin', 'invitations', params] as const,
}

export function useAdminStats() {
  return useQuery({ queryKey: adminKeys.stats, queryFn: fetchAdminStats })
}

export function useAdminUsers(params: AdminUserParams) {
  return useQuery({
    queryKey: adminKeys.users(params),
    queryFn: () => fetchAdminUsers(params),
    placeholderData: keepPreviousData,
  })
}

export function useAdminUser(userId: string | null) {
  return useQuery({
    queryKey: adminKeys.detail(userId ?? ''),
    queryFn: () => fetchAdminUser(userId as string),
    enabled: Boolean(userId),
  })
}

function refreshAfterUserChange(client: QueryClient, detail: AdminUserDetail) {
  client.setQueryData(adminKeys.detail(detail.id), detail)
  void client.invalidateQueries({ queryKey: ['admin', 'users'] })
  void client.invalidateQueries({ queryKey: adminKeys.stats })
  void client.invalidateQueries({ queryKey: ['projects'] })
}

export function useUserAdminActions(userId: string) {
  const client = useQueryClient()
  const onSuccess = (detail: AdminUserDetail) => refreshAfterUserChange(client, detail)
  const onError = (error: unknown) => toast.error(errorMessage(error))
  return {
    changeRole: useMutation({
      mutationFn: (role: Role) => changeUserRole(userId, role),
      onSuccess,
      onError,
    }),
    changeStatus: useMutation({
      mutationFn: (isActive: boolean) => changeUserStatus(userId, isActive),
      onSuccess,
      onError,
    }),
    setOverride: useMutation({
      mutationFn: ({ projectId, role }: { projectId: string; role: Role | null }) =>
        setProjectOverride(userId, projectId, role),
      onSuccess,
      onError,
    }),
    updateProfile: useMutation({
      mutationFn: (input: { name?: string; email?: string }) => updateAdminUser(userId, input),
      onSuccess,
      onError,
    }),
    resetPassword: useMutation({
      mutationFn: (password: string) => resetUserPassword(userId, password),
      onSuccess,
      onError,
    }),
    removeFromProject: useMutation({
      mutationFn: (projectId: string) => removeFromProject(userId, projectId),
      onSuccess,
      onError,
    }),
  }
}

export function useInvitations(params: InvitationParams) {
  return useQuery({
    queryKey: adminKeys.invitations(params),
    queryFn: () => fetchInvitations(params),
    placeholderData: keepPreviousData,
  })
}

export function useCreateInvitation() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: createInvitation,
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['admin', 'invitations'] })
      void client.invalidateQueries({ queryKey: adminKeys.stats })
    },
  })
}

export function useRevokeInvitation() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: revokeInvitation,
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['admin', 'invitations'] })
      void client.invalidateQueries({ queryKey: adminKeys.stats })
    },
    onError: (error) => toast.error(errorMessage(error)),
  })
}

export function useCreateAdminUser() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: createAdminUser,
    onSuccess: (detail) => refreshAfterUserChange(client, detail),
  })
}

export function useAnalytics() {
  return useQuery({ queryKey: ['admin', 'analytics'], queryFn: fetchAnalytics })
}

export function useAuditLogs(params: AuditParams) {
  return useQuery({
    queryKey: ['admin', 'audit', params],
    queryFn: () => fetchAuditLogs(params),
    placeholderData: keepPreviousData,
  })
}

export function useAuditActions() {
  return useQuery({ queryKey: ['admin', 'audit', 'actions'], queryFn: fetchAuditActions })
}
