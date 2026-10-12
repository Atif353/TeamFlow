import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse, delay } from 'msw'
import { buildTask, signIn } from '@/test/fixtures'
import { setViewportWidth } from '@/test/matchMedia'
import { server } from '@/test/msw/server'
import { mockProjectApi } from '@/test/projectApi'
import { renderApp } from '@/test/utils'

const OTHERS_TASK = buildTask({
  id: 't-other',
  title: 'Someone elses task',
  creator_id: 'u-other',
  creator: null,
})

describe('Kanban board', () => {
  it('groups tasks into status columns with counts', async () => {
    signIn('member')
    mockProjectApi({
      tasks: [buildTask(), buildTask({ id: 't-2', title: 'Ship it', status_id: 's-done' })],
    })

    renderApp('/projects/p-1/board')

    const todo = await screen.findByRole('region', { name: 'To Do column' })
    const done = screen.getByRole('region', { name: 'Done column' })
    expect(within(todo).getByText('Write specs')).toBeInTheDocument()
    expect(within(todo).getByLabelText('1 tasks')).toBeInTheDocument()
    expect(within(done).getByText('Ship it')).toBeInTheDocument()
  })

  it('makes cards read-only for viewers with no quick add', async () => {
    signIn('viewer')
    mockProjectApi({ role: 'viewer' })

    renderApp('/projects/p-1/board')

    const card = await screen.findByRole('button', { name: 'Open task Write specs' })
    expect(card).toHaveAttribute('aria-roledescription', 'task')
    expect(screen.queryByRole('button', { name: /add task/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /new task/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /move write specs/i })).not.toBeInTheDocument()
  })

  it('prevents members from dragging other peoples cards and explains why', async () => {
    signIn('member')
    mockProjectApi({ tasks: [OTHERS_TASK] })

    renderApp('/projects/p-1/board')

    const card = await screen.findByRole('button', { name: 'Open task Someone elses task' })
    expect(card).toHaveAttribute('aria-roledescription', 'task')
    expect(
      screen.queryByRole('button', { name: /move someone elses task/i }),
    ).not.toBeInTheDocument()
    await userEvent.hover(card)
    expect(await screen.findByRole('tooltip')).toHaveTextContent('You can only move your own tasks')
  })

  it('lets members drag their own cards', async () => {
    signIn('member')
    mockProjectApi()

    renderApp('/projects/p-1/board')

    const card = await screen.findByRole('button', { name: 'Open task Write specs' })
    expect(card).toHaveAttribute('aria-roledescription', 'draggable task')
  })

  it('changes status from the "move to" menu on a 375px screen', async () => {
    setViewportWidth(375)
    signIn('member')
    const api = mockProjectApi()
    renderApp('/projects/p-1/board')

    await userEvent.click(await screen.findByRole('button', { name: 'Move Write specs to status' }))
    await userEvent.click(await screen.findByRole('menuitem', { name: 'In Progress' }))

    await waitFor(() =>
      expect(api.requests).toContainEqual({
        method: 'PATCH',
        path: '/tasks/t-1/move',
        body: { status_id: 's-progress', previous_task_id: null, next_task_id: null },
      }),
    )
    const progress = screen.getByRole('region', { name: 'In Progress column' })
    await waitFor(() => expect(within(progress).getByText('Write specs')).toBeInTheDocument())
  })

  it('returns the card to its origin and shows a toast when the move fails', async () => {
    signIn('member')
    mockProjectApi()
    server.use(
      http.patch('*/api/v1/tasks/:id/move', async () => {
        await delay(60)
        return HttpResponse.json(
          { code: 'permission_denied', message: 'Move rejected', details: {} },
          { status: 403 },
        )
      }),
    )
    renderApp('/projects/p-1/board')

    await userEvent.click(await screen.findByRole('button', { name: 'Move Write specs to status' }))
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Done' }))

    expect(await screen.findByText('Move rejected')).toBeInTheDocument()
    const todo = screen.getByRole('region', { name: 'To Do column' })
    await waitFor(() => expect(within(todo).getByText('Write specs')).toBeInTheDocument())
    expect(
      within(screen.getByRole('region', { name: 'Done column' })).queryByText('Write specs'),
    ).not.toBeInTheDocument()
  })

  it('creates a task from the quick add form in a column', async () => {
    signIn('member')
    const api = mockProjectApi({ tasks: [] })
    renderApp('/projects/p-1/board')

    await userEvent.click(await screen.findByRole('button', { name: 'Add task to In Progress' }))
    await userEvent.type(
      screen.getByLabelText('New task title in In Progress'),
      'Fresh idea{Enter}',
    )

    await waitFor(() =>
      expect(api.requests).toContainEqual({
        method: 'POST',
        path: '/tasks',
        body: { title: 'Fresh idea', status_id: 's-progress', sprint_id: null },
      }),
    )
    const progress = screen.getByRole('region', { name: 'In Progress column' })
    expect(await within(progress).findByText('Fresh idea')).toBeInTheDocument()
  })

  it('filters cards from the filter bar', async () => {
    signIn('member')
    mockProjectApi({
      tasks: [buildTask(), buildTask({ id: 't-2', title: 'Urgent bug', priority: 'urgent' })],
    })
    renderApp('/projects/p-1/board')
    await screen.findByText('Write specs')

    await userEvent.selectOptions(screen.getByLabelText('Filter by priority'), 'urgent')

    await waitFor(() => expect(screen.queryByText('Write specs')).not.toBeInTheDocument())
    expect(screen.getByText('Urgent bug')).toBeInTheDocument()
  })

  it('shows an error state with retry when tasks fail to load', async () => {
    signIn('member')
    mockProjectApi()
    server.use(http.get('*/api/v1/projects/:id/tasks', () => HttpResponse.error()))

    renderApp('/projects/p-1/board')

    expect(await screen.findByRole('button', { name: 'Try again' })).toBeInTheDocument()
  })
})
