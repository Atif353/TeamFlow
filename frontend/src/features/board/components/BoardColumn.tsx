import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { cn } from '@/lib/cn'
import type { ProjectStatus } from '@/features/projects'
import type { Task } from '@/features/tasks'
import { QuickAdd } from './QuickAdd'
import { SortableTaskCard } from './SortableTaskCard'

interface BoardColumnProps {
  status: ProjectStatus
  statuses: ProjectStatus[]
  transitions: Record<string, string[]>
  tasks: Task[]
  canEditTask: (task: Task) => boolean
  readOnly: boolean
  canCreate: boolean
  creating: boolean
  onOpen: (taskId: string) => void
  onMoveTo: (taskId: string, statusId: string) => void
  onQuickAdd: (statusId: string, title: string, done: () => void) => void
}

export function BoardColumn({
  status,
  statuses,
  transitions,
  tasks,
  canEditTask,
  readOnly,
  canCreate,
  creating,
  onOpen,
  onMoveTo,
  onQuickAdd,
}: BoardColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: status.id })
  const overLimit = status.wip_limit !== null && tasks.length > status.wip_limit
  return (
    <section
      aria-label={`${status.name} column`}
      className="flex w-[85%] shrink-0 snap-center flex-col rounded-xl bg-surface-muted/60 md:w-72 md:snap-align-none"
    >
      <header className="flex items-center gap-2 px-3 py-3">
        <span
          className="h-2.5 w-2.5 rounded-full"
          style={{ backgroundColor: status.color }}
          aria-hidden="true"
        />
        <h3 className="text-sm font-semibold">{status.name}</h3>
        <span
          className={cn(
            'rounded-full bg-surface px-2 py-0.5 text-xs tabular-nums text-muted-foreground',
            overLimit && 'bg-danger/10 font-medium text-danger-fg',
          )}
          aria-label={`${tasks.length} tasks${status.wip_limit ? `, limit ${status.wip_limit}` : ''}`}
        >
          {status.wip_limit ? `${tasks.length} / ${status.wip_limit}` : tasks.length}
        </span>
      </header>
      <div
        ref={setNodeRef}
        className={cn(
          'flex min-h-24 flex-1 flex-col gap-2 rounded-lg px-2 pb-2 transition-colors',
          isOver && 'bg-primary-50/70',
        )}
      >
        <SortableContext
          items={tasks.map((task) => task.id)}
          strategy={verticalListSortingStrategy}
        >
          {tasks.map((task) => (
            <SortableTaskCard
              key={task.id}
              task={task}
              statuses={statuses}
              transitions={transitions}
              canEdit={canEditTask(task)}
              readOnly={readOnly}
              onOpen={onOpen}
              onMoveTo={onMoveTo}
            />
          ))}
        </SortableContext>
        {tasks.length === 0 && (
          <p className="px-2 py-6 text-center text-xs text-muted-foreground">No tasks here</p>
        )}
      </div>
      {canCreate && (
        <div className="p-2">
          <QuickAdd
            statusName={status.name}
            loading={creating}
            onAdd={(title, done) => onQuickAdd(status.id, title, done)}
          />
        </div>
      )}
    </section>
  )
}
