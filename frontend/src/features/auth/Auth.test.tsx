import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { buildProject, buildUser, buildWorkspace, page, signIn } from '@/test/fixtures'
import { server } from '@/test/msw/server'
import { currentPath, renderApp } from '@/test/utils'
import { useAuthStore } from '@/store/authStore'

const authPayload = (role = 'member') => ({
  user: buildUser(),
  workspace: buildWorkspace(),
  role,
  access_token: 'issued-token',
})

function mockDashboard() {
  server.use(
    http.get('*/api/v1/dashboard/me', () =>
      HttpResponse.json({
        stats: { assigned_open: 0, overdue: 0, due_this_week: 0, completed_this_week: 0 },
        my_tasks: [],
        projects: [],
      }),
    ),
    http.get('*/api/v1/projects', () => HttpResponse.json(page([buildProject()]))),
  )
}

describe('login page', () => {
  beforeEach(() => useAuthStore.getState().clearSession())

  it('shows inline validation for empty forms', async () => {
    renderApp('/login')

    await userEvent.click(await screen.findByRole('button', { name: 'Sign in' }))

    expect(await screen.findByText('Email is required')).toBeInTheDocument()
    expect(screen.getByText('Password is required')).toBeInTheDocument()
  })

  it('rejects a malformed email without calling the API', async () => {
    renderApp('/login')

    await userEvent.type(await screen.findByLabelText('Email'), 'not-an-email')
    await userEvent.type(screen.getByLabelText('Password'), 'Password1')
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(await screen.findByText('Enter a valid email')).toBeInTheDocument()
  })

  it('redirects to the dashboard after a successful login', async () => {
    mockDashboard()
    server.use(http.post('*/api/v1/auth/login', () => HttpResponse.json(authPayload())))
    const { router } = renderApp('/login')

    await userEvent.type(await screen.findByLabelText('Email'), 'mia@teamflow.io')
    await userEvent.type(screen.getByLabelText('Password'), 'Password1')
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }))

    await waitFor(() => expect(currentPath(router)).toBe('/dashboard'))
    expect(useAuthStore.getState().accessToken).toBe('issued-token')
  })

  it('shows the generic server error for bad credentials', async () => {
    server.use(
      http.post('*/api/v1/auth/login', () =>
        HttpResponse.json(
          { code: 'invalid_credentials', message: 'Invalid email or password', details: {} },
          { status: 401 },
        ),
      ),
    )
    renderApp('/login')

    await userEvent.type(await screen.findByLabelText('Email'), 'mia@teamflow.io')
    await userEvent.type(screen.getByLabelText('Password'), 'WrongPass1')
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid email or password')
  })

  it('toggles password visibility', async () => {
    renderApp('/login')
    const field = await screen.findByLabelText('Password')

    await userEvent.click(screen.getByRole('button', { name: 'Show password' }))

    expect(field).toHaveAttribute('type', 'text')
  })
})

describe('register page', () => {
  beforeEach(() => useAuthStore.getState().clearSession())

  it('validates every field and the password rules', async () => {
    renderApp('/register')

    await userEvent.click(await screen.findByRole('button', { name: 'Create workspace' }))
    expect(await screen.findByText('Name is required')).toBeInTheDocument()
    expect(screen.getByText('Email is required')).toBeInTheDocument()

    await userEvent.type(screen.getByLabelText('Password'), 'allletters')
    await userEvent.click(screen.getByRole('button', { name: 'Create workspace' }))
    expect(await screen.findByText('Password must contain a number')).toBeInTheDocument()
  })

  it('creates the workspace and continues to email verification', async () => {
    server.use(
      http.post('*/api/v1/auth/register', () =>
        HttpResponse.json(
          { email: 'ada@teamflow.io', verification_required: true, dev_code: '123456' },
          { status: 201 },
        ),
      ),
    )
    const { router } = renderApp('/register')

    await userEvent.type(await screen.findByLabelText('Full name'), 'Ada Lovelace')
    await userEvent.type(screen.getByLabelText('Email'), 'ada@teamflow.io')
    await userEvent.type(screen.getByLabelText('Password'), 'Password1')
    await userEvent.click(screen.getByRole('button', { name: 'Create workspace' }))

    await waitFor(() => expect(currentPath(router)).toBe('/verify-email'))
    expect(await screen.findByText(/ada@teamflow.io/)).toBeInTheDocument()
    expect(useAuthStore.getState().status).not.toBe('authenticated')
  })

  it('reports an already registered email on the field', async () => {
    server.use(
      http.post('*/api/v1/auth/register', () =>
        HttpResponse.json(
          { code: 'email_taken', message: 'Email is already registered', details: {} },
          { status: 409 },
        ),
      ),
    )
    renderApp('/register')

    await userEvent.type(await screen.findByLabelText('Full name'), 'Ada')
    await userEvent.type(screen.getByLabelText('Email'), 'ada@teamflow.io')
    await userEvent.type(screen.getByLabelText('Password'), 'Password1')
    await userEvent.click(screen.getByRole('button', { name: 'Create workspace' }))

    expect(await screen.findByText('This email is already registered')).toBeInTheDocument()
  })
})

describe('accept invitation page', () => {
  beforeEach(() => useAuthStore.getState().clearSession())

  it('shows the workspace and role, then logs the new user in', async () => {
    mockDashboard()
    server.use(
      http.get('*/api/v1/invitations/preview/good-token', () =>
        HttpResponse.json({
          workspace_name: 'Acme',
          email: 'nina@teamflow.io',
          role: 'viewer',
          invited_by_name: 'Ada Admin',
          expires_at: '2026-12-01T00:00:00Z',
        }),
      ),
      http.post('*/api/v1/invitations/accept/good-token', () =>
        HttpResponse.json(authPayload('viewer'), { status: 201 }),
      ),
    )
    const { router } = renderApp('/invite/good-token')

    expect(await screen.findByRole('heading', { name: 'Join Acme' })).toBeInTheDocument()
    expect(screen.getByText('Ada Admin invited you.')).toBeInTheDocument()
    expect(screen.getByText('nina@teamflow.io')).toBeInTheDocument()
    expect(screen.getByText('Viewer')).toBeInTheDocument()
    await userEvent.type(screen.getByLabelText('Full name'), 'Nina Newcomer')
    await userEvent.type(screen.getByLabelText('Password'), 'Password1')
    await userEvent.click(screen.getByRole('button', { name: 'Accept invitation' }))

    await waitFor(() => expect(currentPath(router)).toBe('/dashboard'))
    expect(useAuthStore.getState().role).toBe('viewer')
  })

  it('explains when the invitation is no longer valid', async () => {
    server.use(
      http.get('*/api/v1/invitations/preview/old', () =>
        HttpResponse.json(
          { code: 'invitation_expired', message: 'This invitation is expired', details: {} },
          { status: 410 },
        ),
      ),
    )
    renderApp('/invite/old')

    expect(
      await screen.findByRole('heading', { name: 'Invitation unavailable' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Go to sign in' })).toBeInTheDocument()
  })
})

describe('logout', () => {
  it('clears the session, revokes the token and blocks protected routes', async () => {
    mockDashboard()
    signIn('member')
    let loggedOut = false
    server.use(
      http.post('*/api/v1/auth/logout', () => {
        loggedOut = true
        return new HttpResponse(null, { status: 204 })
      }),
    )
    const { router } = renderApp('/dashboard')

    await userEvent.click(await screen.findByRole('button', { name: 'Account menu' }))
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Sign out' }))

    await waitFor(() => expect(currentPath(router)).toBe('/login'))
    expect(loggedOut).toBe(true)
    expect(useAuthStore.getState().accessToken).toBeNull()
    expect(useAuthStore.getState().user).toBeNull()
    await router.navigate('/projects')
    await waitFor(() => expect(currentPath(router)).toBe('/login'))
    expect(within(document.body).getByRole('heading', { name: 'Welcome back' })).toBeInTheDocument()
  })
})
