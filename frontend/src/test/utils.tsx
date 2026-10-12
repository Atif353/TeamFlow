import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import { MotionConfig } from 'framer-motion'
import type { ReactElement } from 'react'
import { createMemoryRouter, MemoryRouter, RouterProvider, useLocation } from 'react-router-dom'
import { Toaster } from 'sonner'
import { appRoutes } from '@/app/router'

export function createTestClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } })
}

export function LocationProbe() {
  const location = useLocation()
  return <output data-testid="location">{location.pathname + location.search}</output>
}

export function renderWithProviders(ui: ReactElement, route = '/') {
  const client = createTestClient()
  const utils = render(
    <QueryClientProvider client={client}>
      <MotionConfig reducedMotion="always">
        <MemoryRouter initialEntries={[route]}>
          {ui}
          <LocationProbe />
        </MemoryRouter>
      </MotionConfig>
    </QueryClientProvider>,
  )
  return { ...utils, client }
}

export function renderApp(route: string) {
  const client = createTestClient()
  const router = createMemoryRouter(appRoutes, { initialEntries: [route] })
  const utils = render(
    <QueryClientProvider client={client}>
      <MotionConfig reducedMotion="always">
        <RouterProvider router={router} />
      </MotionConfig>
      <Toaster />
    </QueryClientProvider>,
  )
  return { ...utils, router, client }
}

export function currentPath(router: ReturnType<typeof createMemoryRouter>) {
  return router.state.location.pathname + router.state.location.search
}
