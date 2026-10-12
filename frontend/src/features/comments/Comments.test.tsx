import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { http, HttpResponse } from 'msw'
import { buildMember, buildTask, page, signIn } from '@/test/fixtures'
import { server } from '@/test/msw/server'
import { mockProjectApi } from '@/test/projectApi'
import { renderApp } from '@/test/utils'
import { CommentBody } from './components/CommentBody'
import { MentionTextarea } from './components/MentionTextarea'
import { activeMentionQuery, insertMention, splitMentions } from './utils/mentions'

describe('mention helpers', () => {
  it('detects an active mention query before the caret', () => {
    expect(activeMentionQuery('hello @Om', 9)).toEqual({ query: 'Om', start: 6 })
    expect(activeMentionQuery('@', 1)).toEqual({ query: '', start: 0 })
    expect(activeMentionQuery('mail a@b.com', 12)).toBeNull()
    expect(activeMentionQuery('no mention', 10)).toBeNull()
  })

  it('inserts the chosen name and moves the caret past it', () => {
    expect(insertMention('hi @Om there', 6, 3, 'Omar Other')).toEqual({
      text: 'hi @Omar Other  there',
      caret: 15,
    })
  })

  it('splits a body into plain and mention segments, longest name first', () => {
    const segments = splitMentions('ping @Ann Lee and @Ann', ['Ann', 'Ann Lee'])

    expect(segments.filter((s) => s.mention).map((s) => s.text)).toEqual(['@Ann Lee', '@Ann'])
  })
})

describe('MentionTextarea', () => {
  const candidates = [
    { id: '1', name: 'Omar Other', avatar_color: '#111111' },
    { id: '2', name: 'Olivia Owens', avatar_color: '#222222' },
    { id: '3', name: 'Zed', avatar_color: '#333333' },
  ]

  function Harness() {
    const [value, setValue] = useState('')
    return (
      <MentionTextarea label="Comment" value={value} onChange={setValue} candidates={candidates} />
    )
  }

  it('opens the member picker on @ and is selectable by keyboard', async () => {
    render(<Harness />)
    const box = screen.getByRole('combobox', { name: 'Comment' })

    await userEvent.type(box, 'hey @o')

    const list = await screen.findByRole('listbox', { name: 'Mention suggestions' })
    expect(within(list).getAllByRole('option')).toHaveLength(2)
    await userEvent.keyboard('{ArrowDown}{Enter}')

    expect(box).toHaveValue('hey @Olivia Owens ')
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })

  it('closes the picker on Escape without inserting', async () => {
    render(<Harness />)
    const box = screen.getByRole('combobox', { name: 'Comment' })

    await userEvent.type(box, '@z')
    await screen.findByRole('listbox')
    await userEvent.keyboard('{Escape}')

    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    expect(box).toHaveValue('@z')
  })

  it('selects with the mouse', async () => {
    render(<Harness />)

    await userEvent.type(screen.getByRole('combobox'), '@')
    await userEvent.click(await screen.findByRole('option', { name: /Zed/ }))

    expect(screen.getByRole('combobox')).toHaveValue('@Zed ')
  })
})

describe('CommentBody', () => {
  it('highlights mentions', () => {
    render(<CommentBody body="Thanks @Omar Other, please review" mentionNames={['Omar Other']} />)

    expect(screen.getByTestId('mention')).toHaveTextContent('@Omar Other')
  })

  it('does not highlight text that is not a recorded mention', () => {
    render(<CommentBody body="Thanks @Stranger" mentionNames={['Omar Other']} />)

    expect(screen.queryByTestId('mention')).not.toBeInTheDocument()
  })
})

describe('comment thread in the task panel', () => {
  const author = { id: 'u-me', name: 'Mia Member', avatar_color: '#6366F1', is_active: true }

  it('posts a comment with a picked mention and renders it highlighted', async () => {
    signIn('member')
    const api = mockProjectApi({
      members: [buildMember(), buildMember({ user_id: 'u-omar', name: 'Omar Other' })],
    })
    const posted: unknown[] = []
    server.use(
      http.get('*/api/v1/tasks/t-1/comments', () =>
        HttpResponse.json(
          page(
            posted.length
              ? [
                  {
                    id: 'c-1',
                    task_id: 't-1',
                    author,
                    body: 'Hi @Omar Other',
                    mentions: [
                      { id: 'u-omar', name: 'Omar Other', avatar_color: '#000', is_active: true },
                    ],
                    created_at: '2026-01-01T00:00:00Z',
                    edited_at: null,
                  },
                ]
              : [],
          ),
        ),
      ),
      http.post('*/api/v1/tasks/t-1/comments', async ({ request }) => {
        posted.push(await request.json())
        return HttpResponse.json({}, { status: 201 })
      }),
    )
    api.tasks[0] = buildTask()
    renderApp('/browse/APO-1')

    const box = await screen.findByRole('combobox', { name: 'Write a comment' })
    await userEvent.type(box, 'Hi @Om')
    await userEvent.keyboard('{Enter}')
    await userEvent.click(screen.getByRole('button', { name: 'Comment' }))

    await waitFor(() => expect(posted).toEqual([{ body: 'Hi @Omar Other' }]))
    expect(await screen.findByTestId('mention')).toHaveTextContent('@Omar Other')
  })

  it('shows the author controls only on own comments and lets managers moderate', async () => {
    signIn('project_manager', { id: 'u-manager' })
    mockProjectApi({ role: 'project_manager' })
    server.use(
      http.get('*/api/v1/tasks/t-1/comments', () =>
        HttpResponse.json(
          page([
            {
              id: 'c-1',
              task_id: 't-1',
              author,
              body: 'Mine? no',
              mentions: [],
              created_at: '2026-01-01T00:00:00Z',
              edited_at: null,
            },
          ]),
        ),
      ),
    )
    renderApp('/browse/APO-1')

    expect(await screen.findByText('Mine? no')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Delete comment' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Edit comment' })).not.toBeInTheDocument()
  })
})
