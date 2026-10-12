import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { page, signIn } from '@/test/fixtures'
import { server } from '@/test/msw/server'
import { mockProjectApi } from '@/test/projectApi'
import { currentPath, renderApp } from '@/test/utils'
import type { Doc, DocSummary } from './types'

const SUMMARY: DocSummary = {
  id: 'd-1',
  project_id: 'p-1',
  title: 'Design principles',
  updated_by: { id: 'u-me', name: 'Mia Member', avatar_color: '#6366F1', is_active: true },
  updated_at: new Date().toISOString(),
  created_at: new Date().toISOString(),
  version_count: 2,
}

const DOC: Doc = {
  ...SUMMARY,
  content: '<p>Clear and fast</p>',
  versions: [
    { number: 2, title: 'Design principles', saved_by: null, saved_at: new Date().toISOString() },
    { number: 1, title: 'Design principles', saved_by: null, saved_at: new Date().toISOString() },
  ],
  linked_tasks: [
    {
      id: 't-1',
      key: 'APO-1',
      title: 'Write specs',
      issue_type: 'task',
      status_id: 's-todo',
      priority: 'medium',
      done: false,
    },
  ],
}

describe('docs', () => {
  it('lists docs and lets writers create one', async () => {
    signIn('member')
    mockProjectApi()
    const created: unknown[] = []
    server.use(
      http.get('*/api/v1/projects/p-1/docs', () => HttpResponse.json(page([SUMMARY]))),
      http.post('*/api/v1/projects/p-1/docs', async ({ request }) => {
        created.push(await request.json())
        return HttpResponse.json({ ...DOC, id: 'd-new', title: 'Meeting notes' }, { status: 201 })
      }),
      http.get('*/api/v1/docs/d-new', () => HttpResponse.json({ ...DOC, id: 'd-new' })),
    )
    const { router } = renderApp('/projects/p-1/docs')

    expect(await screen.findByText('Design principles')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /new doc/i }))
    const dialog = await screen.findByRole('dialog', { name: 'New doc' })
    await userEvent.type(within(dialog).getByLabelText('Title'), 'Meeting notes')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Create doc' }))

    await waitFor(() => expect(currentPath(router)).toBe('/projects/p-1/docs/d-new'))
    expect(created).toEqual([{ title: 'Meeting notes', content: '' }])
  })

  it('hides the new doc button from viewers', async () => {
    signIn('viewer')
    mockProjectApi({ role: 'viewer' })
    server.use(http.get('*/api/v1/projects/p-1/docs', () => HttpResponse.json(page([SUMMARY]))))

    renderApp('/projects/p-1/docs')

    await screen.findByText('Design principles')
    expect(screen.queryByRole('button', { name: /new doc/i })).not.toBeInTheDocument()
  })

  it('shows an empty state when there are no docs', async () => {
    signIn('member')
    mockProjectApi()
    server.use(http.get('*/api/v1/projects/p-1/docs', () => HttpResponse.json(page([]))))

    renderApp('/projects/p-1/docs')

    expect(await screen.findByText('No docs yet')).toBeInTheDocument()
  })

  it('shows versions and linked issues in the editor', async () => {
    signIn('member')
    mockProjectApi()
    server.use(http.get('*/api/v1/docs/d-1', () => HttpResponse.json(DOC)))

    renderApp('/projects/p-1/docs/d-1')

    expect(await screen.findByLabelText('Document title')).toHaveValue('Design principles')
    expect(screen.getByRole('link', { name: /APO-1/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Restore version 1' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Saved$/ })).toBeDisabled()
  })

  it('makes the editor read-only for viewers', async () => {
    signIn('viewer')
    mockProjectApi({ role: 'viewer' })
    server.use(http.get('*/api/v1/docs/d-1', () => HttpResponse.json(DOC)))

    renderApp('/projects/p-1/docs/d-1')

    expect(await screen.findByLabelText('Document title')).toBeDisabled()
    expect(screen.queryByRole('button', { name: 'Restore version 1' })).not.toBeInTheDocument()
    expect(screen.queryByRole('toolbar', { name: 'Formatting' })).not.toBeInTheDocument()
  })
})
