import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { routes } from '@/config/routes'
import { useAuthStore } from '@/store/authStore'
import { FullPageSpinner } from './ProtectedRoute'

interface LocationState {
  from?: string
}

export function GuestRoute() {
  const status = useAuthStore((state) => state.status)
  const location = useLocation()

  if (status === 'loading') return <FullPageSpinner />
  if (status === 'authenticated') {
    const target = (location.state as LocationState | null)?.from ?? routes.dashboard
    return <Navigate to={target} replace />
  }
  return <Outlet />
}
