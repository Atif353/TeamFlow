import type { ReactNode } from 'react'
import { Navigate, Outlet } from 'react-router-dom'
import { routes } from '@/config/routes'
import { useAuthStore } from '@/store/authStore'
import type { Role } from '@/types/common'

interface RoleGuardProps {
  roles: Role[]
  children?: ReactNode
}

export function RoleGuard({ roles, children }: RoleGuardProps) {
  const role = useAuthStore((state) => state.role)
  if (!role || !roles.includes(role)) return <Navigate to={routes.forbidden} replace />
  return <>{children ?? <Outlet />}</>
}
