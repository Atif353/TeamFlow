import { useDraggable, useDroppable } from '@dnd-kit/core'
import { format, isSameMonth, isToday } from 'date-fns'
import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { IssueTypeIcon } from '@/components/common/IssueTypeIcon'
import { routes } from '@/config/routes'
import { ISSUE_TYPE_META } from '@/config/issueTypes'
import type { Task } from '@/features/tasks'
import { cn } from '@/lib/cn'
import { dayKey } from '../utils/dates'

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const MAX_VISIBLE_MONTH = 3

export function CalendarChip({ task, canMove }: { task: Task; canMove: boolean }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: task.id,
    disabled: !canMove,
  })
  const dragged = useRef(false)
  useEffect(() => {
    if (isDragging) {
      dragged.current = true
      return
    }
    const timer = setTimeout(() => {
      dragged.current = false
    }, 100)
    return () => clearTimeout(timer)
  }, [isDragging])
  return (
    <Link
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      to={routes.issue(task.key)}
      onClick={(event) => {
        if (dragged.current) event.preventDefault()
      }}
      style={{
        transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
        borderLeftColor: ISSUE_TYPE_META[task.issue_type].color,
      }}
      title={`${task.key} ${task.title}`}
      className={cn(
        'flex items-center gap-1 truncate rounded border-l-4 bg-surface-muted px-1.5 py-0.5 text-xs hover:bg-border',
        task.completed_at && 'text-muted-foreground line-through',
        isDragging && 'relative z-30 opacity-80 shadow-lift',
        canMove && 'cursor-grab touch-none',
      )}
    >
      <IssueTypeIcon type={task.issue_type} size={12} />
      <span className="truncate">{task.title}</span>
    </Link>
  )
}

interface DayCellProps {
  date: Date
  month: Date
  tasks: Task[]
  tall: boolean
  canMove: (task: Task) => boolean
}

function DayCell({ date, month, tasks, tall, canMove }: DayCellProps) {
  const { setNodeRef, isOver } = useDroppable({ id: dayKey(date) })
  const visible = tall ? tasks : tasks.slice(0, MAX_VISIBLE_MONTH)
  return (
    <div
      ref={setNodeRef}
      role="gridcell"
      aria-label={format(date, 'EEEE, MMMM d')}
      className={cn(
        'flex flex-col gap-1 border-b border-r border-border p-1.5',
        tall ? 'min-h-[260px]' : 'min-h-[110px]',
        !isSameMonth(date, month) && 'bg-surface-muted/40 text-muted-foreground',
        isOver && 'bg-primary-50',
      )}
    >
      <span
        className={cn(
          'inline-flex h-6 w-6 items-center justify-center self-end rounded-full text-xs',
          isToday(date) && 'bg-primary text-white',
        )}
      >
        {format(date, 'd')}
      </span>
      {visible.map((task) => (
        <CalendarChip key={task.id} task={task} canMove={canMove(task)} />
      ))}
      {tasks.length > visible.length && (
        <span className="px-1 text-xs text-muted-foreground">
          +{tasks.length - visible.length} more
        </span>
      )}
    </div>
  )
}

interface CalendarGridProps {
  days: Date[]
  month: Date
  tasksByDay: Map<string, Task[]>
  tall: boolean
  canMove: (task: Task) => boolean
}

export function CalendarGrid({ days, month, tasksByDay, tall, canMove }: CalendarGridProps) {
  return (
    <div
      role="grid"
      aria-label="Calendar"
      className="overflow-hidden rounded-xl border-l border-t border-border"
    >
      <div role="row" className="grid grid-cols-7">
        {WEEKDAYS.map((day) => (
          <div
            key={day}
            role="columnheader"
            className="border-b border-r border-border bg-surface-muted/60 px-2 py-1.5 text-xs font-medium text-muted-foreground"
          >
            {day}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((date) => (
          <DayCell
            key={dayKey(date)}
            date={date}
            month={month}
            tasks={tasksByDay.get(dayKey(date)) ?? []}
            tall={tall}
            canMove={canMove}
          />
        ))}
      </div>
    </div>
  )
}
