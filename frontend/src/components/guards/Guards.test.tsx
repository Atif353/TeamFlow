import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { buildProject, buildUser, buildWorkspace, page, signIn } from '@/test/fixtures'
import { server } from '@/test/msw/server'
import { currentPath, renderApp } from '@/test/utils'
import { useAuthStore } from '@/store/authStore'

function mockApis() {
  server.use(
    http.get('*/api/v1/projects', () => HttpResponse.json(page([buildProject()]))),
    http.get('*/api/v1/notifications/unread-count', () => HttpResponse.json({ count: 0 })),
    http.get('*/api/v1/notifications', () => HttpResponse.json(page([]))),
    http.get('*/api/v1/dashboard/me', () =>
      HttpResponse.json({
        stats: { assigned_open: 0, overdue: 0, due_this_week: 0, completed_this_week: 0 },
        my_tasks: [],
        projects: [],
      }),
    ),
  )
}

describe('route guards', () => {
  it('redirects logged-out visitors to login and returns them afterwards', async () => {
    mockApis()
    useAuthStore.getState().clearSession()
    server.use(
      http.post('*/api/v1/auth/login', () =>
        HttpResponse.json({
          user: buildUser(),
          workspace: buildWorkspace(),
          role: 'member',
          access_token: 'fresh',
        }),
      ),
    )

    const { router } = renderApp('/projects')

    await screen.findByRole('heading', { name: 'Welcome back' })
    expect(currentPath(router)).toBe('/login')
    await userEvent.type(screen.getByLabelText('Email'), 'mia@teamflow.io')
    await userEvent.type(screen.getByLabelText('Password'), 'Password1')
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }))

    await waitFor(() => expect(currentPath(router)).toBe('/projects'))
    expect(await screen.findByRole('heading', { name: 'Projects' })).toBeInTheDocument()
  })

  it('keeps authenticated users away from the login page', async () => {
    mockApis()
    signIn('member')

    const { router } = renderApp('/login')

    await waitFor(() => expect(currentPath(router)).toBe('/dashboard'))
  })

  it('shows a spinner while the session is being restored', async () => {
    renderApp('/dashboard')

    expect(await screen.findByRole('status', { name: 'Loading session' })).toBeInTheDocument()
  })

  it.each(['member', 'viewer', 'project_manager'] as const)(
    'sends %s users who open an admin URL to the 403 page',
    async (role) => {
      mockApis()
      signIn(role)

      const { router } = renderApp('/admin/users')

      await screen.findByText("You don't have access to this page")
      expect(currentPath(router)).toBe('/403')
    },
  )

  it('lets the Super Admin open admin pages', async () => {
    mockApis()
    signIn('super_admin')
    server.use(
      http.get('*/api/v1/admin/users', () => HttpResponse.json(page([]))),
      http.get('*/api/v1/admin/stats', () =>
        HttpResponse.json({
          total_users: 3,
          active_users: 3,
          inactive_users: 0,
          users_by_role: { super_admin: 1, member: 2 },
          pending_invitations: 1,
          total_projects: 2,
          total_tasks: 9,
          completed_tasks: 4,
        }),
      ),
    )

    const { router } = renderApp('/admin')

    expect(await screen.findByRole('heading', { name: 'Users' })).toBeInTheDocument()
    expect(currentPath(router)).toBe('/admin/users')
    expect(
      await screen.findByText(/3 users · 3 active · 1 pending invitations/),
    ).toBeInTheDocument()
  })

  it('renders a 404 page for unknown routes', async () => {
    mockApis()
    signIn('member')

    renderApp('/no/such/page')

    expect(await screen.findByText('Page not found')).toBeInTheDocument()
  })
})
