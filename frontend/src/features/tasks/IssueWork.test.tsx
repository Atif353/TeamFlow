import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { buildTask, signIn } from '@/test/fixtures'
import { server } from '@/test/msw/server'
import { mockProjectApi } from '@/test/projectApi'
import { renderApp } from '@/test/utils'

describe('issue work', () => {
  it('logs work using Jira style durations', async () => {
    signIn('member')
    mockProjectApi({
      tasks: [buildTask({ original_estimate_minutes: 480, remaining_estimate_minutes: 480 })],
    })
    const bodies: Record<string, unknown>[] = []
    server.use(
      http.post('*/api/v1/tasks/t-1/worklogs', async ({ request }) => {
        bodies.push((await request.json()) as Record<string, unknown>)
        return HttpResponse.json({}, { status: 201 })
      }),
    )
    renderApp('/browse/APO-1')

    await userEvent.click(await screen.findByRole('button', { name: 'Log work' }))
    const dialog = await screen.findByRole('dialog', { name: 'Log work' })
    await userEvent.type(within(dialog).getByLabelText('Time spent'), '1h 30m')
    await userEvent.type(within(dialog).getByLabelText('Work description'), 'Wrote the first draft')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Log work' }))

    await waitFor(() => expect(bodies).toHaveLength(1))
    expect(bodies[0]).toMatchObject({ minutes: 90, comment: 'Wrote the first draft' })
  })

  it('rejects an invalid duration without calling the server', async () => {
    signIn('member')
    mockProjectApi()
    const calls: unknown[] = []
    server.use(
      http.post('*/api/v1/tasks/t-1/worklogs', async ({ request }) => {
        calls.push(await request.json())
        return HttpResponse.json({}, { status: 201 })
      }),
    )
    renderApp('/browse/APO-1')

    await userEvent.click(await screen.findByRole('button', { name: 'Log work' }))
    const dialog = await screen.findByRole('dialog', { name: 'Log work' })
    await userEvent.type(within(dialog).getByLabelText('Time spent'), 'lots')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Log work' }))

    expect(await within(dialog).findByText('Enter a time like 2h 30m')).toBeInTheDocument()
    expect(calls).toHaveLength(0)
  })

  it('saves an estimate typed as a duration', async () => {
    signIn('member')
    const api = mockProjectApi()
    renderApp('/browse/APO-1')

    const field = await screen.findByLabelText('Original estimate')
    await userEvent.type(field, '2d 4h{Enter}')

    await waitFor(() =>
      expect(api.requests).toContainEqual({
        method: 'PATCH',
        path: '/tasks/t-1',
        body: { original_estimate_minutes: 1200 },
      }),
    )
  })

  it('links another issue by key and lists existing links', async () => {
    signIn('member')
    mockProjectApi()
    const bodies: unknown[] = []
    server.use(
      http.get('*/api/v1/tasks/t-1/links', () =>
        HttpResponse.json([
          {
            id: 'l-1',
            link_type: 'blocks',
            direction: 'outward',
            label: 'blocks',
            issue: {
              id: 't-2',
              key: 'APO-2',
              title: 'Ship it',
              issue_type: 'task',
              status_id: 's-todo',
              priority: 'medium',
              done: false,
            },
            created_at: '2026-01-01T00:00:00Z',
          },
        ]),
      ),
      http.post('*/api/v1/tasks/t-1/links', async ({ request }) => {
        bodies.push(await request.json())
        return HttpResponse.json([], { status: 201 })
      }),
    )
    renderApp('/browse/APO-1')

    expect(await screen.findByRole('link', { name: /APO-2\s*Ship it/ })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /link issue/i }))
    await userEvent.selectOptions(screen.getByLabelText('Relationship'), 'relates_to')
    await userEvent.type(screen.getByLabelText('Issue key'), 'APO-9')
    await userEvent.click(screen.getByRole('button', { name: 'Link' }))

    await waitFor(() => expect(bodies).toEqual([{ target: 'APO-9', link_type: 'relates_to' }]))
  })

  it('warns when the issue is blocked by unresolved issues', async () => {
    signIn('member')
    mockProjectApi({ tasks: [buildTask({ blocked_by_open: 2 })] })

    renderApp('/browse/APO-1')

    expect(await screen.findByText(/blocked by 2 unresolved issues/i)).toBeInTheDocument()
  })

  it('creates child issues under an epic', async () => {
    signIn('member')
    const api = mockProjectApi({
      tasks: [buildTask({ issue_type: 'epic', title: 'Big epic', child_total: 0 })],
    })
    renderApp('/browse/APO-1')

    await userEvent.type(await screen.findByLabelText('New child issue title'), 'First story')
    await userEvent.click(screen.getByRole('button', { name: 'Add child issue' }))

    await waitFor(() =>
      expect(
        api.requests.some(
          (entry) =>
            entry.path === '/tasks' &&
            entry.body?.epic_id === 't-1' &&
            entry.body?.issue_type === 'story',
        ),
      ).toBe(true),
    )
  })

  it('shows the history tab with recorded changes', async () => {
    signIn('member')
    mockProjectApi()
    server.use(
      http.get('*/api/v1/tasks/t-1/activity', () =>
        HttpResponse.json([
          {
            id: 'a-1',
            task_id: 't-1',
            action: 'updated',
            field: 'status',
            old_value: 'To Do',
            new_value: 'In Progress',
            actor: { id: 'u-me', name: 'Mia Member', avatar_color: '#6366F1', is_active: true },
            created_at: new Date().toISOString(),
          },
        ]),
      ),
    )
    renderApp('/browse/APO-1')

    await userEvent.click(await screen.findByRole('tab', { name: 'History' }))

    expect(
      await screen.findByText(/changed status from “To Do” to “In Progress”/),
    ).toBeInTheDocument()
  })
})
