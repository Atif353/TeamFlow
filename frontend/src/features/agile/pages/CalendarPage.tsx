import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  addMonths,
  addWeeks,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  startOfMonth,
  startOfWeek,
} from 'date-fns'
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { IssueTypeIcon } from '@/components/common/IssueTypeIcon'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorState } from '@/components/ui/ErrorState'
import { IconButton } from '@/components/ui/IconButton'
import { Skeleton } from '@/components/ui/Skeleton'
import { Tabs } from '@/components/ui/Tabs'
import { canEditTask } from '@/config/roles'
import { routes } from '@/config/routes'
import { useProject } from '@/features/projects'
import { useAllTasks, useUpdateTask, type Task } from '@/features/tasks'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { formatShortDate } from '@/lib/formatters'
import { useAuthStore } from '@/store/authStore'
import { CalendarGrid } from '../components/CalendarGrid'
import { dayKey } from '../utils/dates'

type Mode = 'month' | 'week'
const WEEK = { weekStartsOn: 1 } as const

export function CalendarPage() {
  const { projectId = '' } = useParams()
  const userId = useAuthStore((state) => state.user?.id)
  const project = useProject(projectId)
  const update = useUpdateTask(projectId)
  const isMobile = useMediaQuery('(max-width: 767px)')
  const [mode, setMode] = useState<Mode>('month')
  const [cursor, setCursor] = useState(new Date())

  const range = useMemo(() => {
    const first =
      mode === 'month' ? startOfWeek(startOfMonth(cursor), WEEK) : startOfWeek(cursor, WEEK)
    const last = mode === 'month' ? endOfWeek(endOfMonth(cursor), WEEK) : endOfWeek(cursor, WEEK)
    return { first, last, days: eachDayOfInterval({ start: first, end: last }) }
  }, [cursor, mode])

  const tasks = useAllTasks(projectId, {
    due_after: dayKey(range.first),
    due_before: dayKey(range.last),
    include_subtasks: true,
  })
  const tasksByDay = useMemo(() => {
    const map = new Map<string, Task[]>()
    for (const task of tasks.data ?? []) {
      if (!task.due_date) continue
      map.set(task.due_date, [...(map.get(task.due_date) ?? []), task])
    }
    return map
  }, [tasks.data])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 6 } }),
    useSensor(KeyboardSensor),
  )

  if (project.isError || tasks.isError) {
    return <ErrorState onRetry={() => void tasks.refetch()} />
  }
  if (project.isPending) return <Skeleton className="h-96 w-full" />

  const role = project.data.my_role
  const canMove = (task: Task) => canEditTask(role, userId, task)
  const step = (direction: 1 | -1) =>
    setCursor((current) =>
      mode === 'month' ? addMonths(current, direction) : addWeeks(current, direction),
    )

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over) return
    const task = (tasks.data ?? []).find((item) => item.id === active.id)
    const target = String(over.id)
    if (!task || task.due_date === target) return
    update.mutate({
      taskId: task.id,
      changes: { due_date: target },
      optimistic: { due_date: target },
    })
  }

  const agenda = [...(tasks.data ?? [])]
    .filter((task) => task.due_date)
    .sort((a, b) => (a.due_date ?? '').localeCompare(b.due_date ?? ''))

  return (
    <section aria-label="Calendar" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <IconButton
            icon={ChevronLeft}
            label="Previous"
            variant="outline"
            onClick={() => step(-1)}
          />
          <h2 className="min-w-[160px] text-center text-lg font-semibold">
            {mode === 'month'
              ? format(cursor, 'MMMM yyyy')
              : `${format(range.first, 'MMM d')} – ${format(range.last, 'MMM d, yyyy')}`}
          </h2>
          <IconButton icon={ChevronRight} label="Next" variant="outline" onClick={() => step(1)} />
          <Button variant="outline" onClick={() => setCursor(new Date())}>
            Today
          </Button>
        </div>
        {!isMobile && (
          <Tabs
            ariaLabel="Calendar mode"
            value={mode}
            onChange={(value) => setMode(value as Mode)}
            items={[
              { value: 'month', label: 'Month' },
              { value: 'week', label: 'Week' },
            ]}
          />
        )}
      </div>

      {tasks.isPending ? (
        <Skeleton className="h-96 w-full" />
      ) : isMobile ? (
        agenda.length === 0 ? (
          <EmptyState
            icon={CalendarDays}
            title="Nothing due"
            description="No issues have a due date in this period."
          />
        ) : (
          <ul
            aria-label="Agenda"
            className="flex flex-col divide-y divide-border rounded-xl border border-border"
          >
            {agenda.map((task) => (
              <li key={task.id}>
                <Link
                  to={routes.issue(task.key)}
                  className="flex min-h-[52px] items-center gap-3 px-3 py-2"
                >
                  <span className="w-14 shrink-0 text-xs font-medium text-muted-foreground">
                    {task.due_date ? formatShortDate(task.due_date) : ''}
                  </span>
                  <IssueTypeIcon type={task.issue_type} />
                  <span className="min-w-0 flex-1 truncate text-sm">
                    <span className="mr-2 text-muted-foreground">{task.key}</span>
                    {task.title}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )
      ) : (
        <DndContext sensors={sensors} onDragEnd={onDragEnd}>
          <CalendarGrid
            days={range.days}
            month={cursor}
            tasksByDay={tasksByDay}
            tall={mode === 'week'}
            canMove={canMove}
          />
        </DndContext>
      )}
      {!isMobile && (
        <p className="text-xs text-muted-foreground">
          Drag an issue to another day to change its due date.
        </p>
      )}
    </section>
  )
}
