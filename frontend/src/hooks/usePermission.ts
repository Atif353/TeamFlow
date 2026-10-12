import { can, type Permission } from '@/config/roles'
import { useAuthStore } from '@/store/authStore'
import type { Role } from '@/types/common'

export function usePermission(permission: Permission, projectRole?: Role | null): boolean {
  const workspaceRole = useAuthStore((state) => state.role)
  return can(projectRole ?? workspaceRole, permission)
}
