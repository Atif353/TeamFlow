import type { ProjectStatus } from '@/features/projects'
import type { Task } from '@/features/tasks'

export type ColumnItems = Record<string, string[]>

export function groupByStatus(tasks: Task[], statuses: ProjectStatus[]): ColumnItems {
  const columns: ColumnItems = Object.fromEntries(statuses.map((status) => [status.id, []]))
  const ordered = [...tasks].sort((a, b) => a.position - b.position)
  for (const task of ordered) columns[task.status_id]?.push(task.id)
  return columns
}

export function neighborsOf(column: string[], taskId: string) {
  const index = column.indexOf(taskId)
  return {
    previous: index > 0 ? (column[index - 1] ?? null) : null,
    next: index >= 0 ? (column[index + 1] ?? null) : null,
  }
}

export function isSamePlacement(
  original: ColumnItems,
  statusId: string,
  taskId: string,
  previous: string | null,
  next: string | null,
): boolean {
  const column = original[statusId]
  if (!column || !column.includes(taskId)) return false
  const before = neighborsOf(column, taskId)
  return before.previous === previous && before.next === next
}
