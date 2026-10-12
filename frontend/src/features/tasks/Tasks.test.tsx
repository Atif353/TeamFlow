import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse, delay } from 'msw'
import { buildMember, buildTask, signIn } from '@/test/fixtures'
import { server } from '@/test/msw/server'
import { mockProjectApi } from '@/test/projectApi'
import { currentPath, renderApp } from '@/test/utils'

describe('issue page', () => {
  it('opens by key and restores the same issue after a refresh', async () => {
    signIn('member')
    mockProjectApi({ tasks: [buildTask({ title: 'Linked task' })] })

    const first = renderApp('/browse/APO-1')
    expect(
      await screen.findByRole('button', { name: 'Edit title: Linked task' }),
    ).toBeInTheDocument()
    first.unmount()

    renderApp('/browse/APO-1')
    expect(
      await screen.findByRole('button', { name: 'Edit title: Linked task' }),
    ).toBeInTheDocument()
  })

  it('canonicalises an id to the issue key in the URL', async () => {
    signIn('member')
    mockProjectApi()
    const { router } = renderApp('/browse/t-1')

    await screen.findByRole('button', { name: 'Edit title: Write specs' })

    await waitFor(() => expect(currentPath(router)).toBe('/browse/APO-1'))
  })

  it('opens a card on the board as a full page', async () => {
    signIn('member')
    mockProjectApi()
    const { router } = renderApp('/projects/p-1/board')

    await userEvent.click(await screen.findByRole('button', { name: 'Open task Write specs' }))

    await waitFor(() => expect(currentPath(router)).toBe('/browse/APO-1'))
    expect(await screen.findByRole('navigation', { name: 'Breadcrumb' })).toBeInTheDocument()
  })

  it('shows a friendly error for an issue that does not exist', async () => {
    signIn('member')
    mockProjectApi()

    renderApp('/browse/APO-99')

    expect(await screen.findByText('Issue not found')).toBeInTheDocument()
  })

  it('shows details, time tracking and activity sections', async () => {
    signIn('member')
    mockProjectApi({
      tasks: [buildTask({ original_estimate_minutes: 120, remaining_estimate_minutes: 90 })],
    })

    renderApp('/browse/APO-1')

    expect(await screen.findByRole('complementary', { name: 'Issue details' })).toBeInTheDocument()
    expect(screen.getByLabelText('Original estimate')).toHaveValue('2h')
    expect(screen.getByLabelText('Remaining')).toHaveValue('1h 30m')
    expect(screen.getByRole('button', { name: 'Log work' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'History' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Work log' })).toBeInTheDocument()
  })

  it('updates optimistically and persists an inline edit', async () => {
    signIn('member')
    const api = mockProjectApi()
    server.use(
      http.patch('*/api/v1/tasks/:id', async ({ request }) => {
        await delay(80)
        api.requests.push({
          method: 'PATCH',
          path: '/tasks/t-1',
          body: (await request.json()) as Record<string, unknown>,
        })
        const task = api.tasks[0]
        if (task) task.priority = 'urgent'
        return HttpResponse.json(task)
      }),
    )
    renderApp('/browse/APO-1')
    const priority = await screen.findByLabelText('Priority')

    await userEvent.selectOptions(priority, 'urgent')

    expect(priority).toHaveValue('urgent')
    await waitFor(() =>
      expect(api.requests).toContainEqual({
        method: 'PATCH',
        path: '/tasks/t-1',
        body: { priority: 'urgent' },
      }),
    )
    await waitFor(() => expect(screen.getByLabelText('Priority')).toHaveValue('urgent'))
  })

  it('rolls an inline edit back and shows a toast when the server rejects it', async () => {
    signIn('member')
    mockProjectApi()
    let release: () => void = () => undefined
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    server.use(
      http.patch('*/api/v1/tasks/:id', async () => {
        await gate
        return HttpResponse.json(
          { code: 'permission_denied', message: 'Edit rejected', details: {} },
          { status: 403 },
        )
      }),
    )
    renderApp('/browse/APO-1')
    const priority = await screen.findByLabelText('Priority')

    await userEvent.selectOptions(priority, 'urgent')
    expect(priority).toHaveValue('urgent')
    release()

    expect(await screen.findByText('Edit rejected')).toBeInTheDocument()
    await waitFor(() => expect(screen.getByLabelText('Priority')).toHaveValue('medium'))
  })

  it('edits the title inline', async () => {
    signIn('member')
    const api = mockProjectApi()
    renderApp('/browse/APO-1')

    await userEvent.click(await screen.findByRole('button', { name: 'Edit title: Write specs' }))
    const input = screen.getByLabelText('Task title')
    await userEvent.clear(input)
    await userEvent.type(input, 'Renamed task{Enter}')

    await waitFor(() =>
      expect(api.requests).toContainEqual({
        method: 'PATCH',
        path: '/tasks/t-1',
        body: { title: 'Renamed task' },
      }),
    )
    expect(
      await screen.findByRole('button', { name: 'Edit title: Renamed task' }),
    ).toBeInTheDocument()
  })

  it('makes someone elses task read-only for a member', async () => {
    signIn('member')
    mockProjectApi({ tasks: [buildTask({ creator_id: 'u-other' })] })

    renderApp('/browse/APO-1')

    expect(await screen.findByLabelText('Priority')).toBeDisabled()
    expect(screen.getByLabelText('Status')).toBeDisabled()
    expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument()
    expect(
      screen.getByText('You can only edit issues you created or are assigned to.'),
    ).toBeInTheDocument()
  })

  it('makes every field read-only for a viewer', async () => {
    signIn('viewer')
    mockProjectApi({ role: 'viewer' })

    renderApp('/browse/APO-1')

    expect(await screen.findByLabelText('Due date')).toBeDisabled()
    expect(screen.queryByRole('button', { name: 'Log work' })).not.toBeInTheDocument()
    expect(screen.getByText('You have read-only access to this project.')).toBeInTheDocument()
    expect(screen.queryByLabelText('Write a comment')).not.toBeInTheDocument()
  })

  it('adds checklist items and subtasks', async () => {
    signIn('member')
    const api = mockProjectApi()
    server.use(
      http.post('*/api/v1/tasks/t-1/checklist', async ({ request }) => {
        const body = (await request.json()) as { text: string }
        api.requests.push({ method: 'POST', path: '/checklist', body })
        return HttpResponse.json(
          buildTask({
            checklist: [{ id: 'c1', text: body.text, done: false }],
            checklist_total: 1,
          }),
          { status: 201 },
        )
      }),
    )
    renderApp('/browse/APO-1')

    await userEvent.type(await screen.findByLabelText('New checklist item'), 'Draft outline')
    await userEvent.click(screen.getByRole('button', { name: 'Add checklist item' }))

    expect(await screen.findByRole('checkbox', { name: 'Draft outline' })).toBeInTheDocument()
    await userEvent.type(screen.getByLabelText('New subtask title'), 'Child task{Enter}')
    await waitFor(() =>
      expect(
        api.requests.some((entry) => entry.path === '/tasks' && entry.body?.parent_id === 't-1'),
      ).toBe(true),
    )
  })
})

describe('list view', () => {
  const tasks = [
    buildTask({ id: 't-a', title: 'Alpha', priority: 'high' }),
    buildTask({ id: 't-b', title: 'Beta', priority: 'low' }),
  ]

  it('reflects filters in the URL and keeps them after a reload', async () => {
    signIn('member')
    mockProjectApi({ tasks, members: [buildMember()] })
    const first = renderApp('/projects/p-1/list')
    await screen.findByText('Alpha')

    await userEvent.selectOptions(screen.getByLabelText('Filter by priority'), 'high')

    await waitFor(() => expect(currentPath(first.router)).toContain('priority=high'))
    first.unmount()

    renderApp('/projects/p-1/list?priority=high')
    expect(await screen.findByLabelText('Filter by priority')).toHaveValue('high')
  })

  it('sorts by a column and records the sort in the URL', async () => {
    signIn('member')
    mockProjectApi({ tasks })
    const { router } = renderApp('/projects/p-1/list')
    await screen.findByText('Alpha')

    await userEvent.click(screen.getByRole('button', { name: /^summary/i }))

    await waitFor(() => expect(currentPath(router)).toContain('sort=title'))
  })

  it('shows an empty state with a way to clear filters', async () => {
    signIn('member')
    server.use()
    mockProjectApi({ tasks: [] })
    const { router } = renderApp('/projects/p-1/list?priority=urgent')

    expect(await screen.findByText('No issues match these filters')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Clear filters' }))

    await waitFor(() => expect(currentPath(router)).not.toContain('priority'))
  })

  it('creates an issue of the chosen type and opens its page', async () => {
    signIn('member')
    const api = mockProjectApi({ tasks: [] })
    const { router } = renderApp('/projects/p-1/list')

    await userEvent.click(await screen.findByRole('button', { name: /new issue/i }))
    await userEvent.click(await screen.findByRole('radio', { name: /bug/i }))
    await userEvent.type(await screen.findByLabelText('Summary'), 'Brand new bug')
    await userEvent.click(
      within(screen.getByRole('dialog', { name: 'Create issue' })).getByRole('button', {
        name: 'Create',
      }),
    )

    await waitFor(() => expect(currentPath(router)).toBe('/browse/APO-1'))
    expect(api.requests.find((entry) => entry.path === '/tasks')?.body?.issue_type).toBe('bug')
  })

  it('offers every issue type in the create dialog', async () => {
    signIn('member')
    mockProjectApi({ tasks: [] })
    renderApp('/projects/p-1/list')

    await userEvent.click(await screen.findByRole('button', { name: /new issue/i }))

    for (const label of ['Task', 'Story', 'Bug', 'Epic', 'Feature', 'Merge request']) {
      expect(await screen.findByRole('radio', { name: new RegExp(label, 'i') })).toBeInTheDocument()
    }
  })

  it('validates the title when creating a task', async () => {
    signIn('member')
    mockProjectApi({ tasks: [] })
    renderApp('/projects/p-1/list')

    await userEvent.click(await screen.findByRole('button', { name: /new issue/i }))
    await userEvent.click(
      within(await screen.findByRole('dialog', { name: 'Create issue' })).getByRole('button', {
        name: 'Create',
      }),
    )

    expect(await screen.findByText('Summary is required')).toBeInTheDocument()
  })

  it('hides create controls from viewers', async () => {
    signIn('viewer')
    mockProjectApi({ role: 'viewer', tasks })

    renderApp('/projects/p-1/list')

    await screen.findByText('Alpha')
    expect(screen.queryByRole('button', { name: /new issue/i })).not.toBeInTheDocument()
  })
})
