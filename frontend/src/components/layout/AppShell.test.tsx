import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { buildProject, page, signIn } from '@/test/fixtures'
import { setViewportWidth } from '@/test/matchMedia'
import { server } from '@/test/msw/server'
import { renderApp } from '@/test/utils'

function mockShellApis() {
  server.use(
    http.get('*/api/v1/dashboard/me', () =>
      HttpResponse.json({
        stats: { assigned_open: 0, overdue: 0, due_this_week: 0, completed_this_week: 0 },
        my_tasks: [],
        projects: [],
      }),
    ),
    http.get('*/api/v1/notifications/unread-count', () => HttpResponse.json({ count: 0 })),
    http.get('*/api/v1/notifications', () => HttpResponse.json(page([]))),
    http.get('*/api/v1/projects', () => HttpResponse.json(page([buildProject()]))),
  )
}

describe('AppShell responsive behaviour', () => {
  beforeEach(() => {
    signIn('member')
    mockShellApis()
  })

  it('shows the full sidebar on desktop', async () => {
    setViewportWidth(1280)
    renderApp('/dashboard')

    const sidebar = await screen.findByTestId('sidebar')

    expect(sidebar).toHaveAttribute('data-collapsed', 'false')
    expect(within(sidebar).getByText('Dashboard')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Open menu' })).not.toBeInTheDocument()
  })

  it('collapses to an icon rail on tablet', async () => {
    setViewportWidth(768)
    renderApp('/dashboard')

    const sidebar = await screen.findByTestId('sidebar')

    expect(sidebar).toHaveAttribute('data-collapsed', 'true')
    expect(within(sidebar).queryByText('Dashboard')).not.toBeInTheDocument()
    expect(within(sidebar).getByRole('link', { name: 'Dashboard' })).toBeInTheDocument()
  })

  it('uses a slide-in drawer on mobile', async () => {
    setViewportWidth(375)
    renderApp('/dashboard')

    const menuButton = await screen.findByRole('button', { name: 'Open menu' })
    expect(screen.queryByTestId('sidebar')).not.toBeInTheDocument()
    await userEvent.click(menuButton)

    const drawer = await screen.findByRole('dialog', { name: 'Menu' })
    expect(within(drawer).getByRole('link', { name: 'Projects' })).toBeInTheDocument()
    await userEvent.click(within(drawer).getByRole('link', { name: 'Projects' }))
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'Menu' })).not.toBeInTheDocument(),
    )
  })

  it('lets desktop users collapse and expand the sidebar', async () => {
    renderApp('/dashboard')
    await screen.findByTestId('sidebar')

    await userEvent.click(screen.getByRole('button', { name: 'Collapse sidebar' }))
    expect(screen.getByTestId('sidebar')).toHaveAttribute('data-collapsed', 'true')

    await userEvent.click(screen.getByRole('button', { name: 'Expand sidebar' }))
    expect(screen.getByTestId('sidebar')).toHaveAttribute('data-collapsed', 'false')
  })
})

describe('AppShell navigation by role', () => {
  beforeEach(mockShellApis)

  it('hides administration from non-admins', async () => {
    signIn('project_manager')
    renderApp('/dashboard')

    const sidebar = await screen.findByTestId('sidebar')

    expect(within(sidebar).queryByText('Administration')).not.toBeInTheDocument()
    expect(within(sidebar).queryByRole('link', { name: 'Users' })).not.toBeInTheDocument()
  })

  it('shows administration to the Super Admin', async () => {
    signIn('super_admin')
    renderApp('/dashboard')

    const sidebar = await screen.findByTestId('sidebar')

    await userEvent.click(within(sidebar).getByRole('button', { name: 'Administration' }))
    expect(within(sidebar).getByRole('link', { name: 'Users' })).toBeInTheDocument()
    expect(within(sidebar).getByRole('link', { name: 'Audit log' })).toBeInTheDocument()
    expect(within(sidebar).getByRole('link', { name: 'Invitations' })).toBeInTheDocument()
  })
})
