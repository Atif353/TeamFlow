import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { buildProject, buildTask, page, signIn } from '@/test/fixtures'
import { server } from '@/test/msw/server'
import { mockProjectApi } from '@/test/projectApi'
import { currentPath, renderApp } from '@/test/utils'
import type { Role } from '@/types/common'
import type { Backlog, ProjectSummary, Sprint } from './types'

function sprint(overrides: Partial<Sprint> = {}): Sprint {
  return {
    id: 'sp-1',
    project_id: 'p-1',
    name: 'Sprint 1',
    goal: 'Ship it',
    state: 'planned',
    start_date: null,
    end_date: null,
    started_at: null,
    completed_at: null,
    issue_count: 1,
    done_count: 0,
    story_points: 5,
    done_points: 0,
    committed_points: 0,
    committed_issues: 0,
    completed_points: 0,
    completed_issues: 0,
    ...overrides,
  }
}

function mockBacklog(role: Role, data: Backlog) {
  const calls: { path: string; body: unknown }[] = []
  mockProjectApi({ role })
  server.use(
    http.get('*/api/v1/projects/p-1/backlog', () => HttpResponse.json(data)),
    http.patch('*/api/v1/tasks/:id/rank', async ({ request, params }) => {
      calls.push({ path: `/tasks/${String(params.id)}/rank`, body: await request.json() })
      return HttpResponse.json(buildTask())
    }),
  )
  return calls
}

const BACKLOG: Backlog = {
  sprints: [
    {
      sprint: sprint(),
      issues: [buildTask({ id: 't-s', key: 'APO-2', title: 'In sprint', story_points: 5 })],
    },
  ],
  backlog: [buildTask({ id: 't-b', key: 'APO-3', title: 'Backlog item' })],
  epics: [buildTask({ id: 't-e', key: 'APO-1', title: 'Big epic', issue_type: 'epic' })],
}

describe('backlog', () => {
  it('shows sprints, the backlog and epics', async () => {
    signIn('project_manager')
    mockBacklog('project_manager', BACKLOG)

    renderApp('/projects/p-1/backlog')

    expect(await screen.findByText('In sprint')).toBeInTheDocument()
    expect(screen.getByText('Backlog item')).toBeInTheDocument()
    expect(screen.getByText('Big epic')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /start sprint/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /create sprint/i })).toBeInTheDocument()
  })

  it('lets a manager move an issue between the backlog and a sprint', async () => {
    signIn('project_manager')
    const calls = mockBacklog('project_manager', BACKLOG)
    renderApp('/projects/p-1/backlog')
    await screen.findByText('Backlog item')

    await userEvent.click(screen.getByRole('button', { name: 'Move APO-3' }))
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Move to Sprint 1' }))

    await waitFor(() =>
      expect(calls).toContainEqual({
        path: '/tasks/t-b/rank',
        body: {
          previous_task_id: null,
          next_task_id: null,
          change_sprint: true,
          sprint_id: 'sp-1',
        },
      }),
    )
  })

  it('hides planning controls from members', async () => {
    signIn('member')
    mockBacklog('member', BACKLOG)

    renderApp('/projects/p-1/backlog')

    await screen.findByText('In sprint')
    expect(screen.queryByRole('button', { name: /start sprint/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /create sprint/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Move APO-3' })).not.toBeInTheDocument()
  })

  it('filters the backlog by epic', async () => {
    signIn('project_manager')
    mockBacklog('project_manager', {
      ...BACKLOG,
      backlog: [
        buildTask({ id: 't-b', key: 'APO-3', title: 'Backlog item', epic_id: 't-e' }),
        buildTask({ id: 't-c', key: 'APO-4', title: 'Other item' }),
      ],
    })
    renderApp('/projects/p-1/backlog')
    await screen.findByText('Other item')

    await userEvent.click(screen.getByRole('button', { name: /big epic/i }))

    await waitFor(() => expect(screen.queryByText('Other item')).not.toBeInTheDocument())
    expect(screen.getByText('Backlog item')).toBeInTheDocument()
  })
})

const SUMMARY: ProjectSummary = {
  total: 4,
  done: 1,
  open: 3,
  overdue: 1,
  due_soon: 2,
  unassigned: 3,
  created_last_7_days: 4,
  resolved_last_7_days: 1,
  estimate_minutes: 480,
  spent_minutes: 120,
  remaining_minutes: 360,
  status_counts: [{ key: 's-todo', name: 'To Do', color: '#64748B', count: 3 }],
  type_counts: [{ key: 'bug', name: 'Bug', color: '#F43F5E', count: 2 }],
  priority_counts: [],
  assignee_counts: [],
  created_vs_resolved: [],
  active_sprint: { sprint: sprint({ state: 'active', name: 'Sprint Alpha' }), days_remaining: 5 },
  epics: [
    {
      id: 't-e',
      key: 'APO-1',
      title: 'Big epic',
      total: 4,
      done: 1,
      story_points: 8,
      done_points: 2,
    },
  ],
  recent_activity: [],
}

describe('project summary', () => {
  it('shows the headline numbers, the active sprint and epic progress', async () => {
    signIn('member')
    mockProjectApi()
    server.use(http.get('*/api/v1/projects/p-1/summary', () => HttpResponse.json(SUMMARY)))

    renderApp('/projects/p-1/summary')

    expect(await screen.findByText('Sprint Alpha')).toBeInTheDocument()
    expect(screen.getByText('Completed in 7 days')).toBeInTheDocument()
    expect(screen.getByText('Overdue')).toBeInTheDocument()
    expect(screen.getByText('Big epic')).toBeInTheDocument()
    expect(screen.getByText('1d')).toBeInTheDocument()
  })

  it('is reachable through the project navigation', async () => {
    signIn('member')
    mockProjectApi()
    server.use(http.get('*/api/v1/projects/p-1/summary', () => HttpResponse.json(SUMMARY)))
    const { router } = renderApp('/projects/p-1/summary')

    const nav = await screen.findByRole('navigation', { name: 'Project sections' })
    for (const name of [
      'Summary',
      'Timeline',
      'Backlog',
      'Board',
      'Calendar',
      'List',
      'Reports',
      'Docs',
    ]) {
      expect(within(nav).getByRole('link', { name })).toBeInTheDocument()
    }
    await userEvent.click(within(nav).getByRole('link', { name: 'Calendar' }))

    await waitFor(() => expect(currentPath(router)).toBe('/projects/p-1/calendar'))
  })
})

describe('calendar', () => {
  it('places an issue on its due date', async () => {
    signIn('member')
    const today = new Date()
    const due = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
    mockProjectApi()
    server.use(
      http.get('*/api/v1/projects/p-1/tasks', () =>
        HttpResponse.json(page([buildTask({ title: 'Due today', due_date: due })])),
      ),
    )

    renderApp('/projects/p-1/calendar')

    const cell = await screen.findByRole('gridcell', {
      name: new Intl.DateTimeFormat('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
      }).format(today),
    })
    expect(await within(cell).findByText('Due today')).toBeInTheDocument()
  })
})

describe('timeline', () => {
  it('lists epics with their progress bars', async () => {
    signIn('member')
    mockProjectApi({
      tasks: [
        buildTask({
          id: 't-e',
          key: 'APO-1',
          title: 'Big epic',
          issue_type: 'epic',
          start_date: '2026-10-01',
          due_date: '2026-11-15',
        }),
      ],
    })

    renderApp('/projects/p-1/timeline')

    expect(await screen.findByRole('link', { name: 'Big epic' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'APO-1' })).toBeInTheDocument()
  })

  it('shows an empty state without epics or sprints', async () => {
    signIn('member')
    mockProjectApi({ tasks: [] })

    renderApp('/projects/p-1/timeline')

    expect(await screen.findByText('Nothing to plot yet')).toBeInTheDocument()
  })
})

describe('reports', () => {
  it('switches between agile, time tracking and team reports', async () => {
    signIn('member')
    mockProjectApi()
    server.use(
      http.get('*/api/v1/projects/p-1/summary', () => HttpResponse.json(SUMMARY)),
      http.get('*/api/v1/projects/p-1/reports/velocity', () =>
        HttpResponse.json({ sprints: [], average_points: 0 }),
      ),
      http.get('*/api/v1/projects/p-1/reports/cumulative-flow', () =>
        HttpResponse.json({ dates: [], series: [] }),
      ),
      http.get('*/api/v1/projects/p-1/reports/time-tracking', () =>
        HttpResponse.json({
          estimate_minutes: 600,
          spent_minutes: 240,
          remaining_minutes: 360,
          by_user: [],
          by_day: [],
          top_issues: [
            {
              task_id: 't-1',
              key: 'APO-1',
              title: 'Write specs',
              spent_minutes: 240,
              estimate_minutes: 600,
              remaining_minutes: 360,
            },
          ],
        }),
      ),
      http.get('*/api/v1/projects/p-1/reports/workload', () => HttpResponse.json({ rows: [] })),
    )
    renderApp('/projects/p-1/reports')

    expect(await screen.findByText('Sprint burndown')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('tab', { name: 'Time tracking' }))

    expect(await screen.findByText('Most time spent')).toBeInTheDocument()
    expect((await screen.findAllByText('4h')).length).toBeGreaterThan(0)
    await userEvent.click(screen.getByRole('tab', { name: 'Team workload' }))
    expect(await screen.findByText('Open issues per assignee')).toBeInTheDocument()
  })
})

describe('project settings', () => {
  it('offers components, releases and automation to managers', async () => {
    signIn('project_manager')
    mockProjectApi({ role: 'project_manager' })
    server.use(http.get('*/api/v1/projects/p-1/automation', () => HttpResponse.json([])))

    renderApp('/projects/p-1/settings')

    expect(await screen.findByRole('heading', { name: 'Components' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Releases' })).toBeInTheDocument()
    expect(await screen.findByRole('heading', { name: 'Automation' })).toBeInTheDocument()
    expect(buildProject().components).toEqual([])
  })
})
