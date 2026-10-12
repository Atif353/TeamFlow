import { screen, within } from '@testing-library/react'
import { http, HttpResponse, delay } from 'msw'
import { signIn } from '@/test/fixtures'
import { server } from '@/test/msw/server'
import { renderApp } from '@/test/utils'
import type { Dashboard } from './types'

const FULL: Dashboard = {
  stats: { assigned_open: 5, overdue: 2, due_this_week: 3, completed_this_week: 4 },
  charts: {
    by_status: [],
    by_type: [],
    by_priority: [],
    completed_per_day: [],
    logged_per_day: [],
    minutes_logged_week: 0,
  },
  my_tasks: [
    {
      id: 't-1',
      key: 'APO-1',
      issue_type: 'bug',
      title: 'Fix login bug',
      project_id: 'p-1',
      project_key: 'APO',
      project_name: 'Apollo',
      priority: 'urgent',
      due_date: '2020-01-01',
      status_name: 'In Progress',
      status_color: '#6366F1',
      is_overdue: true,
    },
  ],
  projects: [
    {
      id: 'p-1',
      name: 'Apollo',
      key: 'APO',
      color: '#6366F1',
      total_tasks: 8,
      done_tasks: 2,
      progress_percent: 25,
    },
  ],
}

describe('dashboard', () => {
  it('shows skeletons first and then the stats, tasks and projects', async () => {
    signIn('member', { name: 'Mia Member' })
    server.use(
      http.get('*/api/v1/dashboard/me', async () => {
        await delay(50)
        return HttpResponse.json(FULL)
      }),
    )

    renderApp('/dashboard')

    expect(await screen.findByRole('status', { name: 'Loading tasks' })).toBeInTheDocument()
    expect(await screen.findByText('Fix login bug')).toBeInTheDocument()
    expect(screen.getByText('Assigned to me').nextElementSibling).toHaveTextContent('5')
    expect(screen.getByText('Overdue').nextElementSibling).toHaveTextContent('2')
    expect(screen.getByText('Due this week').nextElementSibling).toHaveTextContent('3')
    expect(screen.getByText('Completed this week').nextElementSibling).toHaveTextContent('4')
    expect(screen.getByText(/Overdue · /)).toBeInTheDocument()
    const projects = screen.getByRole('heading', { name: 'My projects' }).closest('div')
      ?.parentElement as HTMLElement
    expect(within(projects).getByRole('progressbar', { name: 'Apollo progress' })).toHaveAttribute(
      'aria-valuenow',
      '25',
    )
  })

  it('greets the user by first name', async () => {
    signIn('member', { name: 'Mia Member' })
    server.use(http.get('*/api/v1/dashboard/me', () => HttpResponse.json(FULL)))

    renderApp('/dashboard')

    expect(await screen.findByRole('heading', { name: /Mia$/ })).toBeInTheDocument()
  })

  it('shows empty states when there is no work', async () => {
    signIn('member')
    server.use(
      http.get('*/api/v1/dashboard/me', () =>
        HttpResponse.json({
          stats: { assigned_open: 0, overdue: 0, due_this_week: 0, completed_this_week: 0 },
          my_tasks: [],
          projects: [],
        }),
      ),
    )

    renderApp('/dashboard')

    expect(await screen.findByText('Nothing assigned to you')).toBeInTheDocument()
    expect(screen.getByText('No projects yet')).toBeInTheDocument()
  })

  it('shows an error state with retry', async () => {
    signIn('member')
    server.use(http.get('*/api/v1/dashboard/me', () => HttpResponse.error()))

    renderApp('/dashboard')

    expect(await screen.findByRole('button', { name: 'Try again' })).toBeInTheDocument()
  })
})
