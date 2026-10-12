import { Calendar, Flag, GitBranch } from 'lucide-react'
import { IssueTypeIcon } from '@/components/common/IssueTypeIcon'
import { PriorityBadge } from '@/components/common/PriorityBadge'
import { LabelChip } from '@/components/common/LabelChip'
import { Avatar } from '@/components/ui/Avatar'
import { cn } from '@/lib/cn'
import { formatShortDate, isOverdueDate } from '@/lib/formatters'
import type { Task } from '@/features/tasks'

interface TaskCardProps {
  task: Task
  dragging?: boolean
  overlay?: boolean
}

export function TaskCard({ task, dragging = false, overlay = false }: TaskCardProps) {
  const overdue = isOverdueDate(task.due_date) && task.completed_at === null
  return (
    <div
      className={cn(
        'flex flex-col gap-3 rounded-xl border border-border bg-surface p-3 text-left shadow-sm transition-shadow dark:shadow-none',
        dragging && 'opacity-40',
        overlay && 'rotate-1 shadow-lift',
      )}
    >
      {task.labels.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {task.labels.slice(0, 2).map((label) => (
            <LabelChip key={label.id} label={label} />
          ))}
          {task.labels.length > 2 && (
            <span className="text-xs text-muted-foreground">+{task.labels.length - 2}</span>
          )}
        </div>
      )}
      <p
        className={cn(
          'line-clamp-2 pr-8 text-sm font-medium text-foreground',
          task.completed_at && 'text-muted-foreground line-through',
        )}
      >
        {task.title}
      </p>
      {task.epic && (
        <span
          className="max-w-full self-start truncate rounded px-1.5 py-0.5 text-xs font-medium"
          style={{ backgroundColor: '#8B5CF622', color: 'rgb(var(--accent-fg))' }}
        >
          {task.epic.title}
        </span>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <IssueTypeIcon type={task.issue_type} size={14} />
        <span className="text-xs font-medium text-muted-foreground">{task.key}</span>
        {task.flagged && <Flag size={12} className="text-warning-fg" aria-label="Flagged" />}
        <PriorityBadge priority={task.priority} />
        {task.story_points !== null && (
          <span
            className="rounded-full bg-surface-muted px-1.5 text-xs font-medium text-muted-foreground"
            title="Story points"
          >
            {task.story_points}
          </span>
        )}
        {task.due_date && (
          <span
            className={cn(
              'inline-flex items-center gap-1 text-xs',
              overdue ? 'font-medium text-danger-fg' : 'text-muted-foreground',
            )}
          >
            <Calendar size={12} aria-hidden="true" />
            {formatShortDate(task.due_date)}
          </span>
        )}
        {task.subtask_total > 0 && (
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <GitBranch size={12} aria-hidden="true" />
            {task.subtask_done}/{task.subtask_total}
          </span>
        )}
        {task.assignee && (
          <span className="ml-auto">
            <Avatar
              name={task.assignee.name}
              color={task.assignee.avatar_color}
              size="sm"
              inactive={!task.assignee.is_active}
            />
          </span>
        )}
      </div>
    </div>
  )
}
