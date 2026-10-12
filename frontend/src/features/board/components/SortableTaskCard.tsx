import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { KeyboardEvent } from 'react'
import { Tooltip } from '@/components/ui/Tooltip'
import { StatusMenu } from '@/features/tasks/components/StatusMenu'
import type { ProjectStatus } from '@/features/projects'
import { allowedStatusIds } from '@/features/projects/utils/workflow'
import type { Task } from '@/features/tasks'
import { TaskCard } from './TaskCard'

interface SortableTaskCardProps {
  task: Task
  statuses: ProjectStatus[]
  transitions: Record<string, string[]>
  canEdit: boolean
  readOnly: boolean
  onOpen: (taskId: string) => void
  onMoveTo: (taskId: string, statusId: string) => void
}

export function SortableTaskCard({
  task,
  statuses,
  transitions,
  canEdit,
  readOnly,
  onOpen,
  onMoveTo,
}: SortableTaskCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    disabled: !canEdit,
  })

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    listeners?.onKeyDown?.(event)
    if (event.key === 'Enter' && event.target === event.currentTarget) onOpen(task.id)
  }

  const card = (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className="relative touch-manipulation"
    >
      <div
        {...attributes}
        {...listeners}
        role="button"
        tabIndex={0}
        aria-label={`Open task ${task.title}`}
        aria-roledescription={canEdit ? 'draggable task' : 'task'}
        aria-disabled={undefined}
        onKeyDown={onKeyDown}
        onClick={() => onOpen(task.id)}
        className={
          canEdit ? 'cursor-grab rounded-xl active:cursor-grabbing' : 'cursor-pointer rounded-xl'
        }
      >
        <TaskCard task={task} dragging={isDragging} />
      </div>
      {canEdit && (
        <div className="absolute right-1 top-1">
          <StatusMenu
            allowedIds={allowedStatusIds({ statuses, transitions }, task.status_id)}
            taskTitle={task.title}
            statuses={statuses}
            currentStatusId={task.status_id}
            onSelect={(statusId) => onMoveTo(task.id, statusId)}
          />
        </div>
      )}
    </div>
  )

  if (canEdit || readOnly) return card
  return (
    <Tooltip content="You can only move your own tasks" className="block">
      <div className="w-full">{card}</div>
    </Tooltip>
  )
}
