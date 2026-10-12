import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { Spinner } from '@/components/ui/Spinner'
import { routes } from '@/config/routes'
import { useAuthStore } from '@/store/authStore'

export function FullPageSpinner() {
  return (
    <div className="flex min-h-screen items-center justify-center text-primary-text">
      <Spinner size={28} label="Loading session" />
    </div>
  )
}

export function ProtectedRoute() {
  const status = useAuthStore((state) => state.status)
  const location = useLocation()

  if (status === 'loading') return <FullPageSpinner />
  if (status === 'unauthenticated') {
    return (
      <Navigate to={routes.login} replace state={{ from: location.pathname + location.search }} />
    )
  }
  return <Outlet />
}
