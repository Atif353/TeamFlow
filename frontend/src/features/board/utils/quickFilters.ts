import type { Task } from '@/features/tasks'

export type QuickFilter = 'mine' | 'unassigned' | 'flagged' | 'blocked'

export function applyQuickFilters(
  tasks: Task[],
  active: ReadonlySet<QuickFilter>,
  userId: string | undefined,
): Task[] {
  return tasks.filter(
    (task) =>
      (!active.has('mine') || task.assignee_id === userId) &&
      (!active.has('unassigned') || task.assignee_id === null) &&
      (!active.has('flagged') || task.flagged) &&
      (!active.has('blocked') || task.blocked_by_open > 0),
  )
}
