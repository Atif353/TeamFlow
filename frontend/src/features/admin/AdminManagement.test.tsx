import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { buildProject, page, signIn } from '@/test/fixtures'
import { server } from '@/test/msw/server'
import { renderApp } from '@/test/utils'
import type { AdminUserDetail, AuditEntry } from './types'

const USER: AdminUserDetail = {
  id: 'u-1',
  name: 'Mark Member',
  email: 'mark@teamflow.io',
  avatar_color: '#10B981',
  role: 'member',
  is_active: true,
  last_login_at: null,
  created_at: '2026-01-01T00:00:00Z',
  project_count: 0,
  projects: [],
}

function mockUsers() {
  const calls: { method: string; path: string; body: unknown }[] = []
  server.use(
    http.get('*/api/v1/admin/users', () => HttpResponse.json(page([USER]))),
    http.get('*/api/v1/admin/users/u-1', () => HttpResponse.json(USER)),
    http.get('*/api/v1/projects', () => HttpResponse.json(page([buildProject()]))),
    http.post('*/api/v1/admin/users', async ({ request }) => {
      const body = (await request.json()) as { name: string; email: string; role: string }
      calls.push({ method: 'POST', path: '/admin/users', body })
      return HttpResponse.json(
        { ...USER, id: 'u-new', name: body.name, email: body.email, role: body.role },
        { status: 201 },
      )
    }),
    http.get('*/api/v1/admin/users/u-new', () =>
      HttpResponse.json({ ...USER, id: 'u-new', name: 'Nia New', email: 'nia@teamflow.io' }),
    ),
    http.patch('*/api/v1/admin/users/u-1', async ({ request }) => {
      const body = (await request.json()) as { name?: string; email?: string }
      calls.push({ method: 'PATCH', path: '/admin/users/u-1', body })
      return HttpResponse.json({ ...USER, ...body })
    }),
    http.post('*/api/v1/admin/users/u-1/password', async ({ request }) => {
      calls.push({ method: 'POST', path: '/admin/users/u-1/password', body: await request.json() })
      return HttpResponse.json(USER)
    }),
  )
  return calls
}

describe('admin user management', () => {
  beforeEach(() => signIn('super_admin', { id: 'u-admin', name: 'Ada Admin' }))

  it('creates a user with a role and opens their drawer', async () => {
    const calls = mockUsers()
    renderApp('/admin/users')

    await userEvent.click(await screen.findByRole('button', { name: /create user/i }))
    const dialog = await screen.findByRole('dialog', { name: 'Create user' })
    await userEvent.type(within(dialog).getByLabelText('Full name'), 'Nia New')
    await userEvent.type(within(dialog).getByLabelText('Email'), 'nia@teamflow.io')
    await userEvent.type(within(dialog).getByLabelText('Initial password'), 'Welcome123')
    await userEvent.selectOptions(within(dialog).getByLabelText('Role'), 'project_manager')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Create user' }))

    await waitFor(() =>
      expect(calls).toContainEqual({
        method: 'POST',
        path: '/admin/users',
        body: {
          name: 'Nia New',
          email: 'nia@teamflow.io',
          password: 'Welcome123',
          role: 'project_manager',
        },
      }),
    )
    expect(await screen.findByRole('dialog', { name: 'Manage user' })).toBeInTheDocument()
  })

  it('validates the new user form', async () => {
    mockUsers()
    renderApp('/admin/users')

    await userEvent.click(await screen.findByRole('button', { name: /create user/i }))
    const dialog = await screen.findByRole('dialog', { name: 'Create user' })
    await userEvent.type(within(dialog).getByLabelText('Initial password'), 'short')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Create user' }))

    expect(await within(dialog).findByText('Name is required')).toBeInTheDocument()
    expect(within(dialog).getByText('Email is required')).toBeInTheDocument()
    expect(within(dialog).getByText('Password must be at least 8 characters')).toBeInTheDocument()
  })

  it('edits a user name and email from the drawer', async () => {
    const calls = mockUsers()
    renderApp('/admin/users')

    await userEvent.click(await screen.findByRole('row', { name: 'Manage Mark Member' }))
    await userEvent.click(await screen.findByRole('button', { name: /edit details/i }))
    const dialog = await screen.findByRole('dialog', { name: 'Edit user details' })
    const name = within(dialog).getByLabelText('Full name')
    await userEvent.clear(name)
    await userEvent.type(name, 'Marcus Member')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save changes' }))

    await waitFor(() =>
      expect(calls).toContainEqual({
        method: 'PATCH',
        path: '/admin/users/u-1',
        body: { name: 'Marcus Member', email: 'mark@teamflow.io' },
      }),
    )
  })

  it('resets a password after validating it', async () => {
    const calls = mockUsers()
    renderApp('/admin/users')

    await userEvent.click(await screen.findByRole('row', { name: 'Manage Mark Member' }))
    await userEvent.click(await screen.findByRole('button', { name: /reset password/i }))
    const dialog = await screen.findByRole('dialog', { name: 'Reset password' })
    await userEvent.type(within(dialog).getByLabelText('New password'), 'weak')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Reset password' }))
    expect(await within(dialog).findByText(/at least 8 characters/i)).toBeInTheDocument()
    await userEvent.clear(within(dialog).getByLabelText('New password'))
    await userEvent.type(within(dialog).getByLabelText('New password'), 'Brandnew123')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Reset password' }))

    await waitFor(() =>
      expect(calls).toContainEqual({
        method: 'POST',
        path: '/admin/users/u-1/password',
        body: { password: 'Brandnew123' },
      }),
    )
  })
})

const ENTRY: AuditEntry = {
  id: 'a-1',
  action: 'role_changed',
  entity_type: 'user',
  entity_id: 'u-1',
  summary: 'Changed role of Mark Member from member to viewer',
  metadata: {},
  actor: { id: 'u-admin', name: 'Ada Admin', avatar_color: '#6366F1', is_active: true },
  created_at: new Date().toISOString(),
}

describe('audit log', () => {
  beforeEach(() => signIn('super_admin', { id: 'u-admin', name: 'Ada Admin' }))

  it('lists entries and filters by action', async () => {
    const queries: string[] = []
    server.use(
      http.get('*/api/v1/admin/audit-logs/actions', () =>
        HttpResponse.json({ actions: ['role_changed', 'project_deleted'] }),
      ),
      http.get('*/api/v1/admin/audit-logs', ({ request }) => {
        queries.push(new URL(request.url).search)
        return HttpResponse.json(page([ENTRY]))
      }),
    )
    renderApp('/admin/audit')

    expect(
      await screen.findByText('Changed role of Mark Member from member to viewer'),
    ).toBeInTheDocument()
    expect(screen.getAllByText('Ada Admin').length).toBeGreaterThan(0)
    await userEvent.selectOptions(screen.getByLabelText('Filter by action'), 'role_changed')

    await waitFor(() =>
      expect(queries.some((query) => query.includes('action=role_changed'))).toBe(true),
    )
  })

  it('is only reachable by super admins', async () => {
    signIn('member')

    const { router } = renderApp('/admin/audit')

    await waitFor(() => expect(router.state.location.pathname).toBe('/403'))
  })
})

describe('workspace dashboard for admins', () => {
  const analytics = {
    team: [
      {
        user: { id: 'u-1', name: 'Mark Member', avatar_color: '#10B981', is_active: true },
        role: 'member',
        open_issues: 3,
        overdue: 1,
        completed_30_days: 5,
        minutes_30_days: 180,
      },
    ],
    total_open: 9,
    total_overdue: 2,
    total_completed_30_days: 5,
    projects: [
      { project_id: 'p-1', name: 'Apollo', key: 'APO', color: '#6366F1', total: 4, done: 1 },
    ],
    type_counts: [{ key: 'bug', name: 'Bug', color: '#F43F5E', count: 2 }],
    priority_counts: [],
    created_vs_resolved: [],
    signups: [],
    top_contributors: [],
    active_sprints: 1,
    total_minutes_logged: 180,
    audit_events: [],
  }

  it('shows workspace-wide numbers and every team member, not personal stats', async () => {
    signIn('super_admin', { id: 'u-admin', name: 'Ada Admin' })
    server.use(http.get('*/api/v1/admin/analytics', () => HttpResponse.json(analytics)))

    renderApp('/dashboard')

    expect(await screen.findByText('Open issues')).toBeInTheDocument()
    expect(await screen.findByText('Team workload')).toBeInTheDocument()
    expect(await screen.findByText('Mark Member')).toBeInTheDocument()
    expect(screen.queryByText('Assigned to me')).not.toBeInTheDocument()
  })

  it('lets an admin switch to their own work', async () => {
    signIn('super_admin', { id: 'u-admin', name: 'Ada Admin' })
    server.use(
      http.get('*/api/v1/admin/analytics', () => HttpResponse.json(analytics)),
      http.get('*/api/v1/dashboard/me', () =>
        HttpResponse.json({
          stats: { assigned_open: 0, overdue: 0, due_this_week: 0, completed_this_week: 0 },
          charts: {
            by_status: [],
            by_type: [],
            by_priority: [],
            completed_per_day: [],
            logged_per_day: [],
            minutes_logged_week: 0,
          },
          my_tasks: [],
          projects: [],
        }),
      ),
    )
    renderApp('/dashboard')

    await userEvent.click(await screen.findByRole('tab', { name: 'My work' }))

    expect(await screen.findByText('Assigned to me')).toBeInTheDocument()
  })
})
