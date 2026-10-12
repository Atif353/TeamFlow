import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { buildProject, page, signIn } from '@/test/fixtures'
import { setViewportWidth } from '@/test/matchMedia'
import { server } from '@/test/msw/server'
import { renderApp } from '@/test/utils'
import type { Role } from '@/types/common'
import type { AdminUser, AdminUserDetail, Invitation } from './types'

function adminUser(overrides: Partial<AdminUser> = {}): AdminUser {
  return {
    id: 'u-1',
    name: 'Mark Member',
    email: 'mark@teamflow.io',
    avatar_color: '#10B981',
    role: 'member',
    is_active: true,
    last_login_at: null,
    created_at: '2026-01-01T00:00:00Z',
    project_count: 0,
    ...overrides,
  }
}

function mockAdmin(initial: AdminUser[]) {
  const state = {
    users: initial,
    overrides: new Map<string, Role | null>(),
    calls: [] as string[],
  }
  const detail = (user: AdminUser): AdminUserDetail => ({
    ...user,
    projects: [...state.overrides.entries()]
      .filter(([key]) => key.startsWith(`${user.id}:`))
      .map(([key, role]) => ({
        project_id: key.split(':')[1] as string,
        name: 'Apollo',
        key: 'APO',
        color: '#6366F1',
        role_override: role,
        effective_role: role ?? user.role,
      })),
  })
  server.use(
    http.get('*/api/v1/admin/users', ({ request }) => {
      const url = new URL(request.url)
      const role = url.searchParams.get('role')
      const items = state.users.filter((user) => !role || user.role === role)
      return HttpResponse.json(page(items))
    }),
    http.get('*/api/v1/admin/users/:id', ({ params }) => {
      const user = state.users.find((entry) => entry.id === params.id)
      return user ? HttpResponse.json(detail(user)) : HttpResponse.json({}, { status: 404 })
    }),
    http.patch('*/api/v1/admin/users/:id/role', async ({ params, request }) => {
      const body = (await request.json()) as { role: Role }
      const user = state.users.find((entry) => entry.id === params.id) as AdminUser
      user.role = body.role
      state.calls.push(`role:${body.role}`)
      return HttpResponse.json(detail(user))
    }),
    http.patch('*/api/v1/admin/users/:id/status', async ({ params, request }) => {
      const body = (await request.json()) as { is_active: boolean }
      const user = state.users.find((entry) => entry.id === params.id) as AdminUser
      user.is_active = body.is_active
      state.calls.push(`status:${body.is_active}`)
      return HttpResponse.json(detail(user))
    }),
    http.put('*/api/v1/admin/users/:id/projects/:projectId', async ({ params, request }) => {
      const body = (await request.json()) as { role_override: Role | null }
      state.overrides.set(`${String(params.id)}:${String(params.projectId)}`, body.role_override)
      state.calls.push(`override:${String(body.role_override)}`)
      return HttpResponse.json(
        detail(state.users.find((entry) => entry.id === params.id) as AdminUser),
      )
    }),
    http.delete('*/api/v1/admin/users/:id/projects/:projectId', ({ params }) => {
      state.overrides.delete(`${String(params.id)}:${String(params.projectId)}`)
      state.calls.push('removed')
      return HttpResponse.json(
        detail(state.users.find((entry) => entry.id === params.id) as AdminUser),
      )
    }),
    http.get('*/api/v1/projects', () =>
      HttpResponse.json(page([buildProject({ my_role: 'super_admin' })])),
    ),
  )
  return state
}

describe('admin users page', () => {
  beforeEach(() => signIn('super_admin', { id: 'u-admin', name: 'Ada Admin' }))

  it('lists users with role and status badges', async () => {
    mockAdmin([
      adminUser(),
      adminUser({ id: 'u-2', name: 'Dee Deactivated', is_active: false, role: 'viewer' }),
    ])

    renderApp('/admin/users')

    const table = await screen.findByRole('table', { name: 'Workspace users' })
    expect(within(table).getByText('Mark Member')).toBeInTheDocument()
    expect(within(table).getByText('Deactivated')).toBeInTheDocument()
    expect(within(table).getByText('Viewer')).toBeInTheDocument()
  })

  it('filters by role', async () => {
    mockAdmin([adminUser(), adminUser({ id: 'u-2', name: 'Vera Viewer', role: 'viewer' })])
    renderApp('/admin/users')
    await screen.findByText('Vera Viewer')

    await userEvent.selectOptions(screen.getByLabelText('Filter by role'), 'viewer')

    await waitFor(() => expect(screen.queryByText('Mark Member')).not.toBeInTheDocument())
    expect(screen.getByText('Vera Viewer')).toBeInTheDocument()
  })

  it('changes a role in the drawer and updates the row without a reload', async () => {
    const state = mockAdmin([adminUser()])
    renderApp('/admin/users')

    await userEvent.click(await screen.findByRole('row', { name: 'Manage Mark Member' }))
    const drawer = await screen.findByRole('dialog', { name: 'Manage user' })
    await userEvent.selectOptions(
      await within(drawer).findByLabelText('Workspace role'),
      'project_manager',
    )

    await waitFor(() => expect(state.calls).toContain('role:project_manager'))
    const row = await screen.findByRole('row', { name: 'Manage Mark Member' })
    await waitFor(() => expect(within(row).getByText('Project Manager')).toBeInTheDocument())
  })

  it('sets and clears a per-project role override', async () => {
    const state = mockAdmin([adminUser()])
    renderApp('/admin/users')

    await userEvent.click(await screen.findByRole('row', { name: 'Manage Mark Member' }))
    const drawer = await screen.findByRole('dialog', { name: 'Manage user' })
    await userEvent.click(await within(drawer).findByRole('checkbox', { name: 'Apollo (APO)' }))
    await waitFor(() => expect(state.calls).toContain('override:null'))
    await userEvent.selectOptions(await within(drawer).findByLabelText('Role in Apollo'), 'viewer')
    await waitFor(() => expect(state.calls).toContain('override:viewer'))
    await userEvent.selectOptions(within(drawer).getByLabelText('Role in Apollo'), '')
    await waitFor(() =>
      expect(state.calls.filter((call) => call === 'override:null')).toHaveLength(2),
    )
    await userEvent.click(within(drawer).getByRole('checkbox', { name: 'Apollo (APO)' }))

    await waitFor(() => expect(state.calls).toContain('removed'))
  })

  it('deactivates a user only after confirmation and can reactivate', async () => {
    const state = mockAdmin([adminUser()])
    renderApp('/admin/users')

    await userEvent.click(await screen.findByRole('row', { name: 'Manage Mark Member' }))
    const drawer = await screen.findByRole('dialog', { name: 'Manage user' })
    await userEvent.click(await within(drawer).findByRole('button', { name: /deactivate user/i }))
    expect(state.calls).not.toContain('status:false')
    await userEvent.click(
      within(await screen.findByRole('dialog', { name: 'Deactivate user?' })).getByRole('button', {
        name: 'Deactivate',
      }),
    )

    await waitFor(() => expect(state.calls).toContain('status:false'))
    await userEvent.click(await within(drawer).findByRole('button', { name: /reactivate user/i }))
    await waitFor(() => expect(state.calls).toContain('status:true'))
  })

  it('does not let admins deactivate themselves', async () => {
    mockAdmin([adminUser({ id: 'u-admin', name: 'Ada Admin', role: 'super_admin' })])
    renderApp('/admin/users')

    await userEvent.click(await screen.findByRole('row', { name: 'Manage Ada Admin' }))
    const drawer = await screen.findByRole('dialog', { name: 'Manage user' })

    expect(await within(drawer).findByRole('button', { name: /deactivate user/i })).toBeDisabled()
    expect(within(drawer).getByText('You cannot deactivate your own account.')).toBeInTheDocument()
  })

  it('shows a conflict error toast when the last super admin is protected', async () => {
    mockAdmin([adminUser({ id: 'u-admin', name: 'Ada Admin', role: 'super_admin' })])
    server.use(
      http.patch('*/api/v1/admin/users/:id/role', () =>
        HttpResponse.json(
          { code: 'last_super_admin', message: 'Keep at least one Super Admin', details: {} },
          { status: 409 },
        ),
      ),
    )
    renderApp('/admin/users')

    await userEvent.click(await screen.findByRole('row', { name: 'Manage Ada Admin' }))
    await userEvent.selectOptions(await screen.findByLabelText('Workspace role'), 'member')

    expect(await screen.findByText('Keep at least one Super Admin')).toBeInTheDocument()
  })

  it('renders users as cards in a bottom sheet drawer on mobile', async () => {
    setViewportWidth(375)
    mockAdmin([adminUser()])
    renderApp('/admin/users')

    expect(await screen.findByRole('list', { name: 'Workspace users' })).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Manage Mark Member' }))

    const sheet = await screen.findByRole('dialog', { name: 'Manage user' })
    expect(sheet).toHaveClass('bottom-0')
  })
})

describe('admin invitations page', () => {
  beforeEach(() => signIn('super_admin'))

  const pending: Invitation = {
    id: 'i-1',
    email: 'invitee@teamflow.io',
    role: 'viewer',
    status: 'pending',
    expires_at: '2030-01-01T00:00:00Z',
    created_at: '2026-01-01T00:00:00Z',
    invited_by: { id: 'u-admin', name: 'Ada Admin', avatar_color: '#000', is_active: true },
  }

  it('creates an invitation and shows the copyable link', async () => {
    let posted: unknown = null
    server.use(
      http.get('*/api/v1/invitations', () => HttpResponse.json(page([]))),
      http.post('*/api/v1/invitations', async ({ request }) => {
        posted = await request.json()
        return HttpResponse.json(
          { ...pending, invite_url: 'http://localhost:5173/invite/secret-token' },
          { status: 201 },
        )
      }),
    )
    renderApp('/admin/invitations')

    await userEvent.click(
      (await screen.findAllByRole('button', { name: /invite user/i }))[0] as HTMLElement,
    )
    const form = await screen.findByRole('dialog', { name: 'Invite a teammate' })
    await userEvent.type(within(form).getByLabelText('Email'), 'invitee@teamflow.io')
    await userEvent.selectOptions(within(form).getByLabelText('Role'), 'viewer')
    await userEvent.click(within(form).getByRole('button', { name: 'Create invitation' }))

    const link = await screen.findByRole('dialog', { name: 'Invitation link' })
    expect(posted).toEqual({ email: 'invitee@teamflow.io', role: 'viewer' })
    expect(within(link).getByLabelText('Invite link')).toHaveValue(
      'http://localhost:5173/invite/secret-token',
    )
    expect(within(link).getByRole('button', { name: /copy link/i })).toBeInTheDocument()
  })

  it('reports an existing account on the email field', async () => {
    server.use(
      http.get('*/api/v1/invitations', () => HttpResponse.json(page([]))),
      http.post('*/api/v1/invitations', () =>
        HttpResponse.json({ code: 'email_taken', message: 'exists', details: {} }, { status: 409 }),
      ),
    )
    renderApp('/admin/invitations')

    await userEvent.click(
      (await screen.findAllByRole('button', { name: /invite user/i }))[0] as HTMLElement,
    )
    const form = await screen.findByRole('dialog')
    await userEvent.type(within(form).getByLabelText('Email'), 'taken@teamflow.io')
    await userEvent.click(within(form).getByRole('button', { name: 'Create invitation' }))

    expect(
      await within(form).findByText('A user with this email already exists'),
    ).toBeInTheDocument()
  })

  it('revokes a pending invitation after confirming', async () => {
    let revoked = ''
    server.use(
      http.get('*/api/v1/invitations', () => HttpResponse.json(page([pending]))),
      http.delete('*/api/v1/invitations/:id', ({ params }) => {
        revoked = String(params.id)
        return new HttpResponse(null, { status: 204 })
      }),
    )
    renderApp('/admin/invitations')

    await userEvent.click(
      await screen.findByRole('button', { name: 'Revoke invitation for invitee@teamflow.io' }),
    )
    await userEvent.click(
      within(await screen.findByRole('dialog')).getByRole('button', { name: 'Revoke' }),
    )

    await waitFor(() => expect(revoked).toBe('i-1'))
  })

  it('resends by creating a fresh link', async () => {
    server.use(
      http.get('*/api/v1/invitations', () => HttpResponse.json(page([pending]))),
      http.post('*/api/v1/invitations', () =>
        HttpResponse.json(
          { ...pending, invite_url: 'http://localhost:5173/invite/new-token' },
          { status: 201 },
        ),
      ),
    )
    renderApp('/admin/invitations')

    await userEvent.click(
      await screen.findByRole('button', { name: 'Resend invitation to invitee@teamflow.io' }),
    )

    const link = await screen.findByRole('dialog', { name: 'Invitation link' })
    expect(within(link).getByLabelText('Invite link')).toHaveValue(
      'http://localhost:5173/invite/new-token',
    )
  })

  it('shows an empty state per filter', async () => {
    server.use(http.get('*/api/v1/invitations', () => HttpResponse.json(page([]))))
    renderApp('/admin/invitations')

    expect(await screen.findByText('No invitations here')).toBeInTheDocument()
  })
})
