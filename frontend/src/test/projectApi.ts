import { http, HttpResponse } from 'msw'
import type { Label, Project, ProjectMember } from '@/features/projects/types'
import type { Task } from '@/features/tasks/types'
import type { Role } from '@/types/common'
import { buildMember, buildProject, buildTask, page } from './fixtures'
import { server } from './msw/server'

interface Options {
  role?: Role
  tasks?: Task[]
  members?: ProjectMember[]
  labels?: Label[]
  project?: Partial<Project>
}

export interface RecordedRequest {
  method: string
  path: string
  body: Record<string, unknown> | null
}

export function mockProjectApi(options: Options = {}) {
  const state = {
    tasks: [...(options.tasks ?? [buildTask()])],
    requests: [] as RecordedRequest[],
  }
  const project = buildProject({ my_role: options.role ?? 'member', ...options.project })
  const members = options.members ?? [buildMember()]
  const labels = options.labels ?? []

  const record = async (request: Request, path: string) => {
    const body =
      request.method === 'GET' || request.method === 'DELETE'
        ? null
        : ((await request.json()) as Record<string, unknown>)
    state.requests.push({ method: request.method, path, body })
    return body ?? {}
  }

  server.use(
    http.get('*/api/v1/projects/:projectId', () => HttpResponse.json(project)),
    http.get('*/api/v1/projects/:projectId/members', () => HttpResponse.json(page(members))),
    http.get('*/api/v1/projects/:projectId/labels', () => HttpResponse.json(labels)),
    http.get('*/api/v1/projects/:projectId/sprints', () => HttpResponse.json([])),
    http.get('*/api/v1/projects/:projectId/versions', () => HttpResponse.json([])),
    http.get('*/api/v1/projects/:projectId/filters', () => HttpResponse.json([])),
    http.get('*/api/v1/projects/:projectId/tasks', ({ request }) => {
      const query = new URL(request.url).searchParams
      const parent = query.get('parent_id')
      const types = query.getAll('issue_type')
      const items = state.tasks.filter(
        (task) =>
          (parent ? task.parent_id === parent : task.parent_id === null) &&
          (types.length === 0 || types.includes(task.issue_type)) &&
          (query.get('exclude_epics') !== 'true' || task.issue_type !== 'epic') &&
          (!query.get('epic_id') || task.epic_id === query.get('epic_id')),
      )
      return HttpResponse.json(page(items))
    }),
    http.post('*/api/v1/projects/:projectId/tasks', async ({ request }) => {
      const body = await record(request, '/tasks')
      const created = buildTask({
        id: `t-new-${state.tasks.length + 1}`,
        key: `APO-${state.tasks.length + 1}`,
        issue_type: (body.issue_type as Task['issue_type'] | undefined) ?? 'task',
        title: String(body.title),
        status_id: String(body.status_id ?? 's-todo'),
        parent_id: (body.parent_id as string | undefined) ?? null,
        position: 9000 + state.tasks.length,
      })
      state.tasks.push(created)
      return HttpResponse.json(created, { status: 201 })
    }),
    http.get('*/api/v1/tasks/:taskId', ({ params }) => {
      const task = state.tasks.find(
        (item) => item.id === params.taskId || item.key === params.taskId,
      )
      return task
        ? HttpResponse.json(task)
        : HttpResponse.json(
            { code: 'task_not_found', message: 'Task not found', details: {} },
            { status: 404 },
          )
    }),
    http.get('*/api/v1/tasks/:taskId/comments', () => HttpResponse.json(page([]))),
    http.get('*/api/v1/tasks/:taskId/activity', () => HttpResponse.json([])),
    http.get('*/api/v1/tasks/:taskId/worklogs', () => HttpResponse.json([])),
    http.get('*/api/v1/tasks/:taskId/links', () => HttpResponse.json([])),
    http.get('*/api/v1/tasks/:taskId/attachments', () => HttpResponse.json([])),
    http.patch('*/api/v1/tasks/:taskId/move', async ({ request, params }) => {
      const body = await record(request, `/tasks/${String(params.taskId)}/move`)
      const task = state.tasks.find((item) => item.id === params.taskId)
      if (!task)
        return HttpResponse.json(
          { code: 'task_not_found', message: 'x', details: {} },
          { status: 404 },
        )
      const previous = state.tasks.find((item) => item.id === body.previous_task_id)
      const next = state.tasks.find((item) => item.id === body.next_task_id)
      task.status_id = String(body.status_id)
      task.position = previous ? previous.position + 0.5 : next ? next.position - 0.5 : 1024
      return HttpResponse.json(task)
    }),
    http.patch('*/api/v1/tasks/:taskId', async ({ request, params }) => {
      const body = await record(request, `/tasks/${String(params.taskId)}`)
      const task = state.tasks.find((item) => item.id === params.taskId)
      if (!task)
        return HttpResponse.json(
          { code: 'task_not_found', message: 'x', details: {} },
          { status: 404 },
        )
      Object.assign(task, body)
      return HttpResponse.json(task)
    }),
  )
  return state
}
