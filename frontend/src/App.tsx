import { RouterProvider } from 'react-router-dom'
import { Spinner } from '@/components/ui/Spinner'
import { Providers } from '@/app/providers'
import { router } from '@/app/router'
import { ErrorBoundary } from '@/components/common/ErrorBoundary'
import { useSessionBootstrap } from '@/features/auth'

export function App() {
  useSessionBootstrap()
  return (
    <ErrorBoundary>
      <RouterProvider
        router={router}
        fallbackElement={
          <div className="flex min-h-screen items-center justify-center">
            <Spinner size={24} label="Loading" />
          </div>
        }
        future={{ v7_startTransition: true }}
      />
    </ErrorBoundary>
  )
}

export function Root() {
  return (
    <Providers>
      <App />
    </Providers>
  )
}
