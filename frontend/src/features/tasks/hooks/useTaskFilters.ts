import { useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useNavigate } from 'react-router-dom'
import { routes } from '@/config/routes'
import type { IssueType } from '@/config/issueTypes'
import type { Priority } from '@/types/common'
import type { Task, TaskFilterState, TaskListParams, TaskSortField } from '../types'

const FILTER_KEYS = ['q', 'assignee', 'priority', 'label', 'status', 'type', 'epic'] as const
const SORT_FIELDS: TaskSortField[] = [
  'position',
  'rank',
  'key',
  'story_points',
  'created_at',
  'updated_at',
  'due_date',
  'priority',
  'title',
]

export interface TaskViewState {
  filters: TaskFilterState
  sort: TaskSortField
  order: 'asc' | 'desc'
  page: number
}

export function useTaskFilters(defaultSort: TaskSortField = 'position') {
  const [params, setParams] = useSearchParams()

  const state = useMemo<TaskViewState>(() => {
    const sortParam = params.get('sort') as TaskSortField | null
    return {
      filters: {
        q: params.get('q') ?? '',
        assignee: params.get('assignee') ?? '',
        priority: params.get('priority') ?? '',
        label: params.get('label') ?? '',
        status: params.get('status') ?? '',
        type: params.get('type') ?? '',
        epic: params.get('epic') ?? '',
      },
      sort: sortParam && SORT_FIELDS.includes(sortParam) ? sortParam : defaultSort,
      order: params.get('order') === 'desc' ? 'desc' : 'asc',
      page: Math.max(Number(params.get('page')) || 1, 1),
    }
  }, [params, defaultSort])

  const update = useCallback(
    (
      changes: Partial<Record<(typeof FILTER_KEYS)[number] | 'sort' | 'order' | 'page', string>>,
    ) => {
      setParams(
        (previous) => {
          const next = new URLSearchParams(previous)
          for (const [key, value] of Object.entries(changes)) {
            if (value) next.set(key, value)
            else next.delete(key)
          }
          if (!('page' in changes)) next.delete('page')
          return next
        },
        { replace: true },
      )
    },
    [setParams],
  )

  const clear = useCallback(() => {
    setParams(
      (previous) => {
        const next = new URLSearchParams(previous)
        for (const key of [...FILTER_KEYS, 'page']) next.delete(key)
        return next
      },
      { replace: true },
    )
  }, [setParams])

  const replace = useCallback(
    (values: Record<string, string>) => {
      setParams(
        (previous) => {
          const next = new URLSearchParams(previous)
          for (const key of [...FILTER_KEYS, 'sort', 'order', 'page']) next.delete(key)
          for (const [key, value] of Object.entries(values)) if (value) next.set(key, value)
          return next
        },
        { replace: true },
      )
    },
    [setParams],
  )

  const activeCount = FILTER_KEYS.filter((key) => state.filters[key]).length

  return { ...state, update, clear, replace, activeCount }
}

export function savedParams(view: TaskViewState): Record<string, string> {
  const params: Record<string, string> = {}
  for (const key of FILTER_KEYS) if (view.filters[key]) params[key] = view.filters[key]
  if (view.sort !== 'position') params.sort = view.sort
  if (view.order === 'desc') params.order = 'desc'
  return params
}

export function toListParams(view: TaskViewState, pageSize: number): TaskListParams {
  const { filters } = view
  return {
    q: filters.q || undefined,
    assignee_id: filters.assignee || undefined,
    priority: (filters.priority || undefined) as Priority | undefined,
    label_id: filters.label || undefined,
    status_id: filters.status || undefined,
    issue_type: filters.type ? [filters.type as IssueType] : undefined,
    epic_id: filters.epic || undefined,
    include_subtasks: true,
    sort: view.sort,
    order: view.order,
    page: view.page,
    page_size: pageSize,
  }
}

export function filterTasks(tasks: Task[], filters: TaskFilterState): Task[] {
  const needle = filters.q.trim().toLowerCase()
  return tasks.filter(
    (task) =>
      (!needle ||
        task.title.toLowerCase().includes(needle) ||
        task.key.toLowerCase() === needle ||
        task.description.toLowerCase().includes(needle)) &&
      (!filters.assignee || task.assignee_id === filters.assignee) &&
      (!filters.priority || task.priority === filters.priority) &&
      (!filters.label || task.labels.some((label) => label.id === filters.label)) &&
      (!filters.status || task.status_id === filters.status) &&
      (!filters.type || task.issue_type === filters.type) &&
      (!filters.epic || task.epic_id === filters.epic),
  )
}

export function useOpenTask() {
  const navigate = useNavigate()
  const open = useCallback((ref: string) => navigate(routes.issue(ref)), [navigate])
  return { open }
}
