import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { buildProject, page, signIn } from '@/test/fixtures'
import { server } from '@/test/msw/server'
import { currentPath, renderApp } from '@/test/utils'

function mockSearch() {
  const queries: string[] = []
  server.use(
    http.get('*/api/v1/projects', () => HttpResponse.json(page([buildProject()]))),
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
    http.get('*/api/v1/search', ({ request }) => {
      const q = new URL(request.url).searchParams.get('q') ?? ''
      queries.push(q)
      return HttpResponse.json({
        issues: [
          {
            id: 't-1',
            key: 'APO-1',
            title: 'Fix login flow',
            issue_type: 'bug',
            priority: 'high',
            done: false,
            project_id: 'p-1',
            project_name: 'Apollo',
          },
        ],
        docs: [{ id: 'd-1', title: 'Login spec', project_id: 'p-1', project_name: 'Apollo' }],
        projects: [{ id: 'p-1', name: 'Apollo', key: 'APO', color: '#6366F1' }],
      })
    }),
  )
  return queries
}

describe('global search', () => {
  beforeEach(() => signIn('member'))

  it('opens with Ctrl+K and finds issues, docs and projects', async () => {
    const queries = mockSearch()
    renderApp('/dashboard')
    await screen.findByRole('button', { name: /search issues, docs and projects/i })

    await userEvent.keyboard('{Control>}k{/Control}')
    const input = await screen.findByRole('combobox', { name: /search issues, docs and projects/i })
    await userEvent.type(input, 'login')

    expect(await screen.findByRole('option', { name: /APO-1 Fix login flow/ })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: /Login spec/ })).toBeInTheDocument()
    expect(screen.getAllByRole('option', { name: /Apollo/ })).toHaveLength(3)
    expect(queries).toContain('login')
  })

  it('navigates to the chosen issue with the keyboard', async () => {
    mockSearch()
    const { router } = renderApp('/dashboard')
    await screen.findByRole('button', { name: /search issues, docs and projects/i })

    await userEvent.keyboard('{Control>}k{/Control}')
    await userEvent.type(
      await screen.findByRole('combobox', { name: /search issues, docs and projects/i }),
      'login',
    )
    await screen.findByRole('option', { name: /APO-1/ })
    await userEvent.keyboard('{Enter}')

    await waitFor(() => expect(currentPath(router)).toBe('/browse/APO-1'))
  })

  it('closes with Escape', async () => {
    mockSearch()
    renderApp('/dashboard')
    await screen.findByRole('button', { name: /search issues, docs and projects/i })

    await userEvent.keyboard('{Control>}k{/Control}')
    await screen.findByRole('dialog', { name: 'Search' })
    await userEvent.keyboard('{Escape}')

    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'Search' })).not.toBeInTheDocument(),
    )
  })
})
