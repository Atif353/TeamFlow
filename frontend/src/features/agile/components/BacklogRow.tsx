import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Flag, GripVertical, MoveRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { IssueTypeIcon } from '@/components/common/IssueTypeIcon'
import { StatusPill } from '@/components/common/StatusPill'
import { Avatar } from '@/components/ui/Avatar'
import { Dropdown, type DropdownItem } from '@/components/ui/Dropdown'
import { routes } from '@/config/routes'
import type { Task } from '@/features/tasks'
import type { ProjectStatus } from '@/features/projects'
import { cn } from '@/lib/cn'

interface BacklogRowProps {
  task: Task
  status: ProjectStatus | undefined
  draggable: boolean
  moveItems: DropdownItem[]
  overlay?: boolean
}

export function BacklogRowContent({
  task,
  status,
  draggable,
  moveItems,
  handle,
}: Omit<BacklogRowProps, 'overlay'> & { handle?: Record<string, unknown> }) {
  return (
    <div className="flex min-h-[48px] items-center gap-2 px-2 py-1.5 sm:gap-3 sm:px-3">
      {draggable && (
        <span
          {...handle}
          aria-label={`Drag ${task.key}`}
          className="hidden shrink-0 cursor-grab touch-none text-muted-foreground sm:inline-flex"
        >
          <GripVertical size={16} aria-hidden="true" />
        </span>
      )}
      <IssueTypeIcon type={task.issue_type} />
      <Link
        to={routes.issue(task.key)}
        className={cn(
          'min-w-0 flex-1 truncate text-sm hover:underline',
          task.completed_at && 'text-muted-foreground line-through',
        )}
      >
        <span className="mr-2 font-medium text-muted-foreground">{task.key}</span>
        {task.title}
      </Link>
      {task.flagged && <Flag size={14} className="shrink-0 text-warning-fg" aria-label="Flagged" />}
      {task.epic && (
        <span
          className="hidden max-w-[140px] truncate rounded px-1.5 py-0.5 text-xs font-medium md:inline"
          style={{ backgroundColor: '#8B5CF622', color: 'rgb(var(--accent-fg))' }}
          title={task.epic.title}
        >
          {task.epic.title}
        </span>
      )}
      {status && (
        <span className="hidden sm:inline">
          <StatusPill name={status.name} color={status.color} />
        </span>
      )}
      <span
        className="min-w-[28px] shrink-0 rounded-full bg-surface-muted px-2 py-0.5 text-center text-xs font-medium text-muted-foreground"
        title="Story points"
      >
        {task.story_points ?? '–'}
      </span>
      {task.assignee ? (
        <Avatar name={task.assignee.name} color={task.assignee.avatar_color} size="sm" />
      ) : (
        <span className="h-7 w-7 shrink-0 rounded-full border border-dashed border-border" />
      )}
      {moveItems.length > 0 && (
        <Dropdown
          label={`Move ${task.key}`}
          trigger={<MoveRight size={16} aria-hidden="true" />}
          items={moveItems}
          triggerClassName="h-9 w-9 shrink-0 justify-center text-muted-foreground hover:bg-surface-muted"
        />
      )}
    </div>
  )
}

export function SortableBacklogRow(props: BacklogRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: props.task.id,
    disabled: !props.draggable,
  })
  return (
    <li
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      className={cn(
        'border-b border-border bg-surface last:border-b-0',
        isDragging && 'opacity-40',
      )}
    >
      <BacklogRowContent {...props} handle={{ ...attributes, ...listeners }} />
    </li>
  )
}
