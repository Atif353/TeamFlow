import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { STATUSES, buildMember, buildProject, buildTask, signIn } from '@/test/fixtures'
import { server } from '@/test/msw/server'
import { mockProjectApi } from '@/test/projectApi'
import { currentPath, renderApp } from '@/test/utils'

const RESTRICTED = { 's-todo': ['s-progress'] }

describe('workflow rules in the issue page', () => {
  it('offers only the statuses reachable from the current one', async () => {
    signIn('member')
    mockProjectApi({ project: { transitions: RESTRICTED } })

    renderApp('/browse/APO-1')

    const status = await screen.findByLabelText('Status')
    const options = within(status)
      .getAllByRole('option')
      .map((option) => option.textContent)
    expect(options).toEqual(['To Do', 'In Progress'])
  })

  it('offers every status when no rule is set', async () => {
    signIn('member')
    mockProjectApi()

    renderApp('/browse/APO-1')

    const status = await screen.findByLabelText('Status')
    expect(within(status).getAllByRole('option')).toHaveLength(STATUSES.length)
  })
})

describe('workflow rules on the board', () => {
  it('disables moves the workflow does not allow in the card menu', async () => {
    signIn('member')
    mockProjectApi({ project: { transitions: RESTRICTED } })
    renderApp('/projects/p-1/board')

    await userEvent.click(await screen.findByRole('button', { name: 'Move Write specs to status' }))

    expect(await screen.findByRole('menuitem', { name: 'In Progress' })).toBeEnabled()
    expect(screen.getByRole('menuitem', { name: 'Done' })).toBeDisabled()
    expect(screen.getByRole('menuitem', { name: 'In Review' })).toBeDisabled()
  })

  it('shows the WIP limit and flags a column that is over it', async () => {
    signIn('member')
    const limited = STATUSES.map((status) =>
      status.id === 's-todo' ? { ...status, wip_limit: 1 } : status,
    )
    mockProjectApi({
      project: { statuses: limited },
      tasks: [buildTask(), buildTask({ id: 't-2', key: 'APO-2', title: 'Second' })],
    })

    renderApp('/projects/p-1/board')

    expect(await screen.findByLabelText('2 tasks, limit 1')).toHaveTextContent('2 / 1')
    expect(screen.getByLabelText('2 tasks, limit 1')).toHaveClass('text-danger-fg')
  })

  it('filters the board with quick filters', async () => {
    signIn('member', { id: 'u-me' })
    mockProjectApi({
      tasks: [
        buildTask({ title: 'Mine', assignee_id: 'u-me' }),
        buildTask({ id: 't-2', key: 'APO-2', title: 'Flagged one', flagged: true }),
        buildTask({ id: 't-3', key: 'APO-3', title: 'Unowned' }),
      ],
    })
    renderApp('/projects/p-1/board')
    await screen.findByText('Mine')

    await userEvent.click(screen.getByRole('button', { name: 'Only my issues' }))
    await waitFor(() => expect(screen.queryByText('Unowned')).not.toBeInTheDocument())
    expect(screen.getByText('Mine')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Only my issues' }))
    await userEvent.click(screen.getByRole('button', { name: 'Flagged' }))

    await waitFor(() => expect(screen.queryByText('Mine')).not.toBeInTheDocument())
    expect(screen.getByText('Flagged one')).toBeInTheDocument()
  })
})

describe('workflow editor in project settings', () => {
  it('saves allowed transitions for a restricted status', async () => {
    signIn('project_manager')
    mockProjectApi({ role: 'project_manager' })
    server.use(http.get('*/api/v1/projects/p-1/automation', () => HttpResponse.json([])))
    const bodies: unknown[] = []
    server.use(
      http.put('*/api/v1/projects/p-1/workflow', async ({ request }) => {
        bodies.push(await request.json())
        return HttpResponse.json(buildProject())
      }),
    )
    renderApp('/projects/p-1/settings')

    await userEvent.click(
      await screen.findByRole('checkbox', { name: 'Limit where issues in To Do can go' }),
    )
    const group = screen.getByRole('group', { name: 'Allowed targets from To Do' })
    await userEvent.click(within(group).getByRole('checkbox', { name: 'Done' }))
    await userEvent.click(within(group).getByRole('checkbox', { name: 'In Review' }))
    await userEvent.click(screen.getByRole('button', { name: 'Save workflow' }))

    await waitFor(() => expect(bodies).toEqual([{ transitions: { 's-todo': ['s-progress'] } }]))
  })

  it('saves WIP limits with the statuses', async () => {
    signIn('project_manager')
    mockProjectApi({ role: 'project_manager' })
    server.use(http.get('*/api/v1/projects/p-1/automation', () => HttpResponse.json([])))
    const bodies: { statuses: { wip_limit: number | null }[] }[] = []
    server.use(
      http.put('*/api/v1/projects/p-1/statuses', async ({ request }) => {
        bodies.push((await request.json()) as never)
        return HttpResponse.json(buildProject())
      }),
    )
    renderApp('/projects/p-1/settings')

    await userEvent.type(await screen.findByLabelText('WIP limit of status 2'), '3')
    await userEvent.click(screen.getByRole('button', { name: 'Save statuses' }))

    await waitFor(() => expect(bodies).toHaveLength(1))
    expect(bodies[0]?.statuses.map((status) => status.wip_limit)).toEqual([null, 3, null, null])
  })
})

describe('bulk actions in the list', () => {
  const tasks = [
    buildTask({ id: 't-a', key: 'APO-1', title: 'Alpha' }),
    buildTask({ id: 't-b', key: 'APO-2', title: 'Beta' }),
  ]

  it('moves the selected issues to a status', async () => {
    signIn('project_manager')
    mockProjectApi({ role: 'project_manager', tasks, members: [buildMember()] })
    const bodies: unknown[] = []
    server.use(
      http.post('*/api/v1/projects/p-1/tasks/bulk', async ({ request }) => {
        bodies.push(await request.json())
        return HttpResponse.json({ succeeded: 2, failed: [] })
      }),
    )
    renderApp('/projects/p-1/list')
    await screen.findByText('Alpha')

    await userEvent.click(screen.getByRole('checkbox', { name: 'Select all rows' }))
    expect(await screen.findByText('2 selected')).toBeInTheDocument()
    await userEvent.selectOptions(screen.getByLabelText('Move selected to status'), 's-progress')

    await waitFor(() =>
      expect(bodies).toEqual([{ task_ids: ['t-a', 't-b'], changes: { status_id: 's-progress' } }]),
    )
    await waitFor(() => expect(screen.queryByText('2 selected')).not.toBeInTheDocument())
  })

  it('reports partial failures', async () => {
    signIn('member')
    mockProjectApi({ tasks, members: [buildMember()] })
    server.use(
      http.post('*/api/v1/projects/p-1/tasks/bulk', () =>
        HttpResponse.json({
          succeeded: 1,
          failed: [
            {
              task_id: 't-b',
              message: 'You can only modify your own tasks',
              code: 'permission_denied',
            },
          ],
        }),
      ),
    )
    renderApp('/projects/p-1/list')
    await screen.findByText('Alpha')

    await userEvent.click(screen.getByRole('checkbox', { name: 'Select all rows' }))
    await userEvent.selectOptions(screen.getByLabelText('Set priority of selected'), 'urgent')

    expect(await screen.findByText(/1 issues updated, 1 failed/)).toBeInTheDocument()
  })

  it('does not offer selection to viewers', async () => {
    signIn('viewer')
    mockProjectApi({ role: 'viewer', tasks })

    renderApp('/projects/p-1/list')

    await screen.findByText('Alpha')
    expect(screen.queryByRole('checkbox', { name: 'Select all rows' })).not.toBeInTheDocument()
  })

  it('only offers deleting to people allowed to delete', async () => {
    signIn('viewer')
    mockProjectApi({ role: 'member', tasks })
    renderApp('/projects/p-1/list')
    await screen.findByText('Alpha')

    await userEvent.click(screen.getByRole('checkbox', { name: 'Select all rows' }))

    expect(await screen.findByRole('button', { name: 'Delete' })).toBeInTheDocument()
  })
})

describe('clone and rich descriptions', () => {
  it('clones an issue and opens the copy', async () => {
    signIn('member')
    mockProjectApi()
    server.use(
      http.post('*/api/v1/tasks/t-1/clone', () =>
        HttpResponse.json(buildTask({ id: 't-copy', key: 'APO-9', title: 'CLONE - Write specs' }), {
          status: 201,
        }),
      ),
      http.get('*/api/v1/tasks/APO-9', () =>
        HttpResponse.json(buildTask({ id: 't-copy', key: 'APO-9', title: 'CLONE - Write specs' })),
      ),
    )
    const { router } = renderApp('/browse/APO-1')

    await userEvent.click(await screen.findByRole('button', { name: 'Clone' }))

    await waitFor(() => expect(currentPath(router)).toBe('/browse/APO-9'))
    expect(
      await screen.findByRole('button', { name: 'Edit title: CLONE - Write specs' }),
    ).toBeInTheDocument()
  })

  it('renders html descriptions as formatted content and keeps line breaks in plain text', async () => {
    signIn('member')
    mockProjectApi({
      tasks: [buildTask({ description: '<h2>Plan</h2><ul><li>First step</li></ul>' })],
    })

    const first = renderApp('/browse/APO-1')

    expect(await screen.findByRole('heading', { name: 'Plan', level: 2 })).toBeInTheDocument()
    expect(screen.getByText('First step')).toBeInTheDocument()
    first.unmount()
  })

  it('shows plain legacy descriptions safely', async () => {
    signIn('member')
    mockProjectApi({ tasks: [buildTask({ description: 'a < b & c\nsecond line' })] })

    renderApp('/browse/APO-1')

    expect(await screen.findByText(/a < b & c/)).toBeInTheDocument()
    expect(screen.getByText(/second line/)).toBeInTheDocument()
  })
})
