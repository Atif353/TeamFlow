import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { buildProject, buildTask, page, signIn } from '@/test/fixtures'
import { server } from '@/test/msw/server'
import { mockProjectApi } from '@/test/projectApi'
import { currentPath, renderApp } from '@/test/utils'
import type { AppNotification } from './types'

function notification(overrides: Partial<AppNotification> = {}): AppNotification {
  return {
    id: 'n-1',
    type: 'task_assigned',
    task_id: 't-9',
    task_title: 'Review designs',
    task_key: 'APO-9',
    project_id: 'p-1',
    project_name: 'Apollo',
    project_key: 'APO',
    actor: { id: 'u-maya', name: 'Maya Manager', avatar_color: '#6366F1', is_active: true },
    is_read: false,
    created_at: new Date().toISOString(),
    ...overrides,
  }
}

function mockNotifications(initial: AppNotification[]) {
  const state = { items: initial, readIds: [] as string[], readAll: 0 }
  const unread = () => state.items.filter((item) => !item.is_read).length
  server.use(
    http.get('*/api/v1/notifications/unread-count', () => HttpResponse.json({ count: unread() })),
    http.get('*/api/v1/notifications', ({ request }) => {
      const onlyUnread = new URL(request.url).searchParams.get('unread_only') === 'true'
      return HttpResponse.json(page(state.items.filter((item) => !onlyUnread || !item.is_read)))
    }),
    http.patch('*/api/v1/notifications/:id/read', ({ params }) => {
      state.readIds.push(String(params.id))
      const item = state.items.find((entry) => entry.id === params.id)
      if (item) item.is_read = true
      return HttpResponse.json(item)
    }),
    http.post('*/api/v1/notifications/read-all', () => {
      state.readAll += 1
      state.items.forEach((item) => (item.is_read = true))
      return HttpResponse.json({ updated: 1 })
    }),
  )
  return state
}

describe('notification bell', () => {
  it('shows the unread count badge', async () => {
    signIn('member')
    mockNotifications([
      notification(),
      notification({ id: 'n-2' }),
      notification({ id: 'n-3', is_read: true }),
    ])
    mockProjectApi({ tasks: [buildTask({ id: 't-9' })] })

    renderApp('/projects/p-1/board')

    expect(await screen.findByTestId('unread-badge')).toHaveTextContent('2')
    expect(screen.getByRole('button', { name: 'Notifications, 2 unread' })).toBeInTheDocument()
  })

  it('has no badge when everything is read', async () => {
    signIn('member')
    mockNotifications([notification({ is_read: true })])
    server.use(
      http.get('*/api/v1/dashboard/me', () =>
        HttpResponse.json({ stats: {}, my_tasks: [], projects: [] }),
      ),
    )

    renderApp('/dashboard')

    await screen.findByRole('button', { name: 'Notifications' })
    expect(screen.queryByTestId('unread-badge')).not.toBeInTheDocument()
  })

  it('marks a notification read and opens the issue page when clicked', async () => {
    signIn('member')
    const state = mockNotifications([notification()])
    mockProjectApi({ tasks: [buildTask({ id: 't-9', key: 'APO-9', title: 'Review designs' })] })
    const { router } = renderApp('/projects/p-1/board')

    await userEvent.click(await screen.findByRole('button', { name: 'Notifications, 1 unread' }))
    const popover = await screen.findByRole('dialog', { name: 'Notifications' })
    await userEvent.click(await within(popover).findByRole('button', { name: /assigned you/i }))

    await waitFor(() => expect(state.readIds).toEqual(['n-1']))
    await waitFor(() => expect(currentPath(router)).toBe('/browse/APO-9'))
    expect(
      await screen.findByRole('button', { name: 'Edit title: Review designs' }),
    ).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByTestId('unread-badge')).not.toBeInTheDocument())
  })

  it('marks everything read from the popover', async () => {
    signIn('member')
    const state = mockNotifications([notification(), notification({ id: 'n-2' })])
    server.use(
      http.get('*/api/v1/dashboard/me', () =>
        HttpResponse.json({ stats: {}, my_tasks: [], projects: [] }),
      ),
    )
    renderApp('/dashboard')

    await userEvent.click(await screen.findByRole('button', { name: 'Notifications, 2 unread' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Mark all read' }))

    await waitFor(() => expect(state.readAll).toBe(1))
    await waitFor(() => expect(screen.queryByTestId('unread-badge')).not.toBeInTheDocument())
  })

  it('shows an empty state when there are no notifications', async () => {
    signIn('member')
    mockNotifications([])
    server.use(
      http.get('*/api/v1/dashboard/me', () =>
        HttpResponse.json({ stats: {}, my_tasks: [], projects: [] }),
      ),
    )
    renderApp('/dashboard')

    await userEvent.click(await screen.findByRole('button', { name: 'Notifications' }))

    expect(await screen.findByText("You're all caught up")).toBeInTheDocument()
  })
})

describe('notifications page', () => {
  it('lists notifications and filters to unread', async () => {
    signIn('member')
    mockNotifications([
      notification({ task_title: 'Unread one' }),
      notification({ id: 'n-2', task_title: 'Old one', is_read: true }),
    ])
    renderApp('/notifications')

    expect(await screen.findByText('Old one')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('tab', { name: /^Unread/ }))

    await waitFor(() => expect(screen.queryByText('Old one')).not.toBeInTheDocument())
    expect(screen.getByText('Unread one')).toBeInTheDocument()
  })

  it('shows an empty state for the unread filter', async () => {
    signIn('member')
    mockNotifications([])
    renderApp('/notifications')

    await userEvent.click(await screen.findByRole('tab', { name: 'Unread' }))

    expect(await screen.findByText('No unread notifications')).toBeInTheDocument()
  })

  it('keeps project fixtures valid', () => {
    expect(buildProject().id).toBe('p-1')
  })
})
