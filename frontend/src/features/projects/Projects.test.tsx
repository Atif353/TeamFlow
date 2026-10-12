import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import type { Project } from '@/features/projects/types'
import { buildMember, buildProject, buildTask, page, signIn } from '@/test/fixtures'
import { server } from '@/test/msw/server'
import { mockProjectApi } from '@/test/projectApi'
import { currentPath, renderApp } from '@/test/utils'

function mockProjectList(initial: Project[]) {
  const state = { projects: [...initial], posted: [] as Record<string, unknown>[] }
  server.use(
    http.get('*/api/v1/projects', () => HttpResponse.json(page(state.projects))),
    http.post('*/api/v1/projects', async ({ request }) => {
      const body = (await request.json()) as Record<string, unknown>
      state.posted.push(body)
      const created = buildProject({
        id: 'p-new',
        name: String(body.name),
        key: String(body.key),
        my_role: 'project_manager',
      })
      state.projects.push(created)
      return HttpResponse.json(created, { status: 201 })
    }),
    http.delete('*/api/v1/projects/:id', ({ params }) => {
      state.projects = state.projects.filter((project) => project.id !== params.id)
      return new HttpResponse(null, { status: 204 })
    }),
  )
  return state
}

describe('projects page', () => {
  it('shows an empty state with a create action to project managers', async () => {
    signIn('project_manager')
    mockProjectList([])

    renderApp('/projects')

    expect(await screen.findByText('No projects yet')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /new project/i }).length).toBeGreaterThan(0)
  })

  it('creates a project and shows it in the grid', async () => {
    signIn('project_manager')
    const state = mockProjectList([])
    renderApp('/projects')

    await userEvent.click(
      (await screen.findAllByRole('button', { name: /new project/i }))[0] as HTMLElement,
    )
    const dialog = await screen.findByRole('dialog', { name: 'New project' })
    await userEvent.type(within(dialog).getByLabelText('Name'), 'Gemini')
    await userEvent.type(within(dialog).getByLabelText('Key'), 'gem')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Create project' }))

    expect(
      await within(screen.getByRole('main')).findByRole('link', { name: 'Gemini' }),
    ).toBeInTheDocument()
    expect(state.posted[0]).toMatchObject({ name: 'Gemini', key: 'gem', color: '#6366F1' })
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'New project' })).not.toBeInTheDocument(),
    )
  })

  it('validates the key format and reports duplicate keys', async () => {
    signIn('project_manager')
    mockProjectList([])
    server.use(
      http.post('*/api/v1/projects', () =>
        HttpResponse.json(
          { code: 'project_key_taken', message: 'taken', details: {} },
          { status: 409 },
        ),
      ),
    )
    renderApp('/projects')

    await userEvent.click(
      (await screen.findAllByRole('button', { name: /new project/i }))[0] as HTMLElement,
    )
    const dialog = await screen.findByRole('dialog')
    await userEvent.type(within(dialog).getByLabelText('Name'), 'Gemini')
    await userEvent.type(within(dialog).getByLabelText('Key'), '1')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Create project' }))
    expect(await within(dialog).findByText(/2–10 letters or digits/)).toBeInTheDocument()

    await userEvent.clear(within(dialog).getByLabelText('Key'))
    await userEvent.type(within(dialog).getByLabelText('Key'), 'GEM')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Create project' }))
    expect(
      await within(dialog).findByText('This key is already used in your workspace'),
    ).toBeInTheDocument()
  })

  it('hides create, edit and delete controls from viewers', async () => {
    signIn('viewer')
    mockProjectList([buildProject({ my_role: 'viewer' })])

    renderApp('/projects')

    expect(await screen.findByRole('link', { name: 'Apollo' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /new project/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /actions for apollo/i })).not.toBeInTheDocument()
  })

  it('explains to viewers with no projects that they must be added', async () => {
    signIn('viewer')
    mockProjectList([])

    renderApp('/projects')

    expect(await screen.findByText(/have not been added to any project/i)).toBeInTheDocument()
  })

  it('lets a project manager delete a project after confirming', async () => {
    signIn('project_manager')
    const state = mockProjectList([buildProject({ my_role: 'project_manager' })])
    renderApp('/projects')

    await userEvent.click(await screen.findByRole('button', { name: 'Actions for Apollo' }))
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Delete project' }))
    await userEvent.click(
      within(await screen.findByRole('dialog')).getByRole('button', { name: 'Delete project' }),
    )

    await waitFor(() => expect(state.projects).toHaveLength(0))
    expect(await screen.findByText('No projects yet')).toBeInTheDocument()
  })

  it('shows skeletons while loading and an error state with retry on failure', async () => {
    signIn('member')
    server.use(http.get('*/api/v1/projects', () => HttpResponse.error()))

    renderApp('/projects')

    expect(await screen.findByRole('status', { name: 'Loading projects' })).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: 'Try again' })).toBeInTheDocument()
  })
})

describe('project layout', () => {
  it('shows the project sections and hides Settings from members', async () => {
    signIn('member')
    mockProjectApi({ role: 'member' })

    renderApp('/projects/p-1/board')

    const nav = await screen.findByRole('navigation', { name: 'Project sections' })
    expect(within(nav).getByRole('link', { name: 'Board' })).toBeInTheDocument()
    expect(within(nav).getByRole('link', { name: 'List' })).toBeInTheDocument()
    expect(within(nav).getByRole('link', { name: 'Members' })).toBeInTheDocument()
    expect(within(nav).queryByRole('link', { name: 'Settings' })).not.toBeInTheDocument()
  })

  it('navigates between sections', async () => {
    signIn('project_manager')
    mockProjectApi({ role: 'project_manager' })
    const { router } = renderApp('/projects/p-1')

    await waitFor(() => expect(currentPath(router)).toBe('/projects/p-1/summary'))
    const nav = await screen.findByRole('navigation', { name: 'Project sections' })
    await userEvent.click(within(nav).getByRole('link', { name: 'List' }))

    await waitFor(() => expect(currentPath(router)).toBe('/projects/p-1/list'))
    expect(
      within(await screen.findByRole('navigation', { name: 'Project sections' })).getByRole(
        'link',
        { name: 'Settings' },
      ),
    ).toBeInTheDocument()
  })

  it('shows a not found state for a project the user cannot see', async () => {
    signIn('member')
    server.use(
      http.get('*/api/v1/projects/:id', () =>
        HttpResponse.json(
          { code: 'project_not_found', message: 'Project not found', details: {} },
          { status: 404 },
        ),
      ),
    )

    renderApp('/projects/hidden/board')

    expect(await screen.findByText('Project not found')).toBeInTheDocument()
  })

  it('sends members who open the settings URL to the 403 page', async () => {
    signIn('member')
    mockProjectApi({ role: 'member' })

    const { router } = renderApp('/projects/p-1/settings')

    await waitFor(() => expect(currentPath(router)).toBe('/403'))
  })
})

describe('members tab', () => {
  it('lets managers add and remove members', async () => {
    signIn('project_manager', { id: 'u-manager' })
    mockProjectApi({
      role: 'project_manager',
      members: [
        buildMember({ user_id: 'u-manager', name: 'Maya Manager' }),
        buildMember({ user_id: 'u-mia', name: 'Mia Member' }),
      ],
    })
    let removed = ''
    server.use(
      http.delete('*/api/v1/projects/p-1/members/:userId', ({ params }) => {
        removed = String(params.userId)
        return new HttpResponse(null, { status: 204 })
      }),
    )
    renderApp('/projects/p-1/members')

    expect(await screen.findByText('Maya Manager')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add member' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Remove Mia Member' }))
    await userEvent.click(
      within(await screen.findByRole('dialog')).getByRole('button', { name: 'Remove' }),
    )

    await waitFor(() => expect(removed).toBe('u-mia'))
  })

  it('is read-only for members and viewers', async () => {
    signIn('viewer')
    mockProjectApi({ role: 'viewer', members: [buildMember({ name: 'Maya Manager' })] })

    renderApp('/projects/p-1/members')

    expect(await screen.findByText('Maya Manager')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Add member' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Remove/ })).not.toBeInTheDocument()
  })

  it('lists workspace people in the picker and adds one', async () => {
    signIn('project_manager')
    mockProjectApi({
      role: 'project_manager',
      members: [buildMember({ user_id: 'u-in', name: 'Already In' })],
    })
    let added: unknown = null
    server.use(
      http.get('*/api/v1/workspaces/current/members', () =>
        HttpResponse.json(
          page([
            {
              user_id: 'u-in',
              name: 'Already In',
              email: 'in@teamflow.io',
              avatar_color: '#111',
              role: 'member',
              is_active: true,
            },
            {
              user_id: 'u-new',
              name: 'New Person',
              email: 'new@teamflow.io',
              avatar_color: '#222',
              role: 'member',
              is_active: true,
            },
          ]),
        ),
      ),
      http.post('*/api/v1/projects/p-1/members', async ({ request }) => {
        added = await request.json()
        return HttpResponse.json(buildMember({ user_id: 'u-new', name: 'New Person' }), {
          status: 201,
        })
      }),
    )
    renderApp('/projects/p-1/members')

    await userEvent.click(await screen.findByRole('button', { name: 'Add member' }))
    const dialog = await screen.findByRole('dialog', { name: 'Add project member' })
    expect(await within(dialog).findByText('New Person')).toBeInTheDocument()
    expect(within(dialog).queryByText('Already In')).not.toBeInTheDocument()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Add New Person' }))

    await waitFor(() => expect(added).toEqual({ user_id: 'u-new', role_override: null }))
  })
})

describe('project settings', () => {
  it('saves reordered statuses', async () => {
    signIn('project_manager')
    mockProjectApi({ role: 'project_manager', tasks: [buildTask()] })
    const captured: { body?: { statuses: { id?: string; name: string }[] } } = {}
    server.use(
      http.put('*/api/v1/projects/p-1/statuses', async ({ request }) => {
        captured.body = (await request.json()) as typeof captured.body
        return HttpResponse.json(buildProject({ my_role: 'project_manager' }))
      }),
    )
    renderApp('/projects/p-1/settings')

    await userEvent.click(await screen.findByRole('button', { name: 'Move To Do down' }))
    await userEvent.click(screen.getByRole('button', { name: 'Save statuses' }))

    await waitFor(() =>
      expect(captured.body?.statuses.map((status) => status.name)).toEqual([
        'In Progress',
        'To Do',
        'In Review',
        'Done',
      ]),
    )
    expect(captured.body?.statuses[1]?.id).toBe('s-todo')
  })

  it('explains why a status with tasks cannot be deleted', async () => {
    signIn('project_manager')
    mockProjectApi({ role: 'project_manager' })
    server.use(
      http.put('*/api/v1/projects/p-1/statuses', () =>
        HttpResponse.json({ code: 'status_has_tasks', message: 'x', details: {} }, { status: 409 }),
      ),
    )
    renderApp('/projects/p-1/settings')

    await userEvent.click(await screen.findByRole('button', { name: 'Delete To Do' }))
    await userEvent.click(screen.getByRole('button', { name: 'Save statuses' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/still has tasks/i)
  })

  it('blocks saving statuses with empty or duplicate names', async () => {
    signIn('project_manager')
    mockProjectApi({ role: 'project_manager' })
    renderApp('/projects/p-1/settings')

    const name = await screen.findByLabelText('Name of status 2')
    await userEvent.clear(name)

    expect(screen.getByRole('button', { name: 'Save statuses' })).toBeDisabled()
    await userEvent.type(name, 'to do')
    expect(screen.getByRole('button', { name: 'Save statuses' })).toBeDisabled()
  })
})
