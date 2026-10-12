import {
  addDays,
  differenceInCalendarDays,
  eachWeekOfInterval,
  endOfMonth,
  format,
  parseISO,
  startOfWeek,
} from 'date-fns'
import { ChevronDown, ChevronRight, GanttChart } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { IssueTypeIcon } from '@/components/common/IssueTypeIcon'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorState } from '@/components/ui/ErrorState'
import { Skeleton } from '@/components/ui/Skeleton'
import { ISSUE_TYPE_META } from '@/config/issueTypes'
import { routes } from '@/config/routes'
import { useAllTasks, type Task } from '@/features/tasks'
import { cn } from '@/lib/cn'
import { percent } from '@/lib/formatters'
import { useSprints } from '../hooks/useAgile'
import type { Sprint } from '../types'

const DAY_WIDTH = 22
const LABEL_WIDTH = 220
const PAD_BEFORE = 14
const PAD_AFTER = 45
const DEFAULT_SPAN_DAYS = 7
const SPRINT_COLORS = { planned: '#64748B', active: '#10B981', completed: '#0EA5E9' } as const

interface Span {
  start: Date
  end: Date
}

function dayOf(value: string | null): Date | null {
  return value ? parseISO(value.slice(0, 10)) : null
}

function spanOfTask(task: Task, children: Task[]): Span | null {
  const starts = [dayOf(task.start_date), ...children.map((child) => dayOf(child.start_date))]
  const ends = [dayOf(task.due_date), ...children.map((child) => dayOf(child.due_date))]
  const known = [...starts, ...ends].filter((value): value is Date => value !== null)
  if (known.length === 0) return null
  const first = new Date(Math.min(...known.map((date) => date.getTime())))
  const last = new Date(Math.max(...known.map((date) => date.getTime())))
  const start = dayOf(task.start_date) ?? first
  const end = dayOf(task.due_date) ?? (last > start ? last : addDays(start, DEFAULT_SPAN_DAYS))
  return { start, end: end < start ? start : end }
}

function spanOfSprint(sprint: Sprint): Span | null {
  const start = dayOf(sprint.start_date)
  const end = dayOf(sprint.end_date)
  return start && end ? { start, end } : null
}

export function TimelinePage() {
  const { projectId = '' } = useParams()
  const epics = useAllTasks(projectId, { issue_type: ['epic'] })
  const issues = useAllTasks(projectId, { exclude_epics: true })
  const sprints = useSprints(projectId)
  const [open, setOpen] = useState<Set<string>>(new Set())
  const scroller = useRef<HTMLDivElement>(null)

  const model = useMemo(() => {
    const byEpic = new Map<string, Task[]>()
    for (const issue of issues.data ?? []) {
      if (!issue.epic_id) continue
      byEpic.set(issue.epic_id, [...(byEpic.get(issue.epic_id) ?? []), issue])
    }
    const rows = (epics.data ?? []).map((epic) => ({
      epic,
      children: byEpic.get(epic.id) ?? [],
      span: spanOfTask(epic, byEpic.get(epic.id) ?? []),
    }))
    const sprintSpans = (sprints.data ?? []).flatMap((sprint) => {
      const span = spanOfSprint(sprint)
      return span ? [{ sprint, span }] : []
    })
    const dates = [
      new Date(),
      ...rows.flatMap((row) => (row.span ? [row.span.start, row.span.end] : [])),
      ...sprintSpans.flatMap((item) => [item.span.start, item.span.end]),
    ]
    const min = new Date(Math.min(...dates.map((date) => date.getTime())))
    const max = new Date(Math.max(...dates.map((date) => date.getTime())))
    const start = startOfWeek(addDays(min, -PAD_BEFORE), { weekStartsOn: 1 })
    const end = endOfMonth(addDays(max, PAD_AFTER))
    return { rows, sprintSpans, start, end }
  }, [epics.data, issues.data, sprints.data])
  const ready = epics.isSuccess && issues.isSuccess && sprints.isSuccess
  const todayStart = differenceInCalendarDays(new Date(), model.start) * DAY_WIDTH

  useEffect(() => {
    if (ready && scroller.current) scroller.current.scrollLeft = Math.max(todayStart - 280, 0)
  }, [ready, todayStart])

  if (epics.isError || issues.isError || sprints.isError) {
    return <ErrorState onRetry={() => void epics.refetch()} />
  }
  if (epics.isPending || issues.isPending || sprints.isPending) {
    return <Skeleton className="h-72 w-full" />
  }

  const totalDays = differenceInCalendarDays(model.end, model.start) + 1
  const width = totalDays * DAY_WIDTH
  const offset = (date: Date) => differenceInCalendarDays(date, model.start) * DAY_WIDTH
  const barStyle = (span: Span) => ({
    left: offset(span.start),
    width: Math.max((differenceInCalendarDays(span.end, span.start) + 1) * DAY_WIDTH, DAY_WIDTH),
  })
  const weeks = eachWeekOfInterval({ start: model.start, end: model.end }, { weekStartsOn: 1 })
  const todayLeft = offset(new Date()) + DAY_WIDTH / 2

  if (model.rows.length === 0 && model.sprintSpans.length === 0) {
    return (
      <EmptyState
        icon={GanttChart}
        title="Nothing to plot yet"
        description="Create epics and give them start and due dates, or schedule sprints in the backlog, to see them on the timeline."
      />
    )
  }

  const toggle = (id: string) =>
    setOpen((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  return (
    <section aria-label="Timeline">
      <Card className="overflow-hidden">
        <div ref={scroller} className="overflow-x-auto">
          <div style={{ width: width + LABEL_WIDTH }} className="relative">
            <div className="sticky top-0 z-10 flex border-b border-border bg-surface">
              <div
                style={{ width: LABEL_WIDTH }}
                className="sticky left-0 z-20 shrink-0 border-r border-border bg-surface px-3 py-2 text-xs font-semibold text-muted-foreground"
              >
                Epics & sprints
              </div>
              <div className="relative h-10" style={{ width }}>
                {weeks.map((week) => (
                  <span
                    key={week.toISOString()}
                    style={{ left: offset(week) }}
                    className="absolute top-0 h-full border-l border-border pl-1.5 pt-1 text-[11px] text-muted-foreground"
                  >
                    {format(week, week.getDate() <= 7 ? 'MMM d' : 'd')}
                  </span>
                ))}
              </div>
            </div>

            <div className="relative">
              <div
                aria-hidden="true"
                style={{ left: LABEL_WIDTH + todayLeft }}
                className="pointer-events-none absolute inset-y-0 z-[5] w-px bg-danger"
              />
              {model.sprintSpans.length > 0 && (
                <TimelineRow label="Sprints" labelIcon={null}>
                  {model.sprintSpans.map(({ sprint, span }) => (
                    <div
                      key={sprint.id}
                      style={{ ...barStyle(span), backgroundColor: SPRINT_COLORS[sprint.state] }}
                      title={`${sprint.name} · ${sprint.state}`}
                      className="absolute top-1.5 h-6 truncate rounded px-2 text-xs font-medium leading-6 text-white"
                    >
                      {sprint.name}
                    </div>
                  ))}
                </TimelineRow>
              )}
              {model.rows.map(({ epic, children, span }) => {
                const expanded = open.has(epic.id)
                return (
                  <div key={epic.id}>
                    <TimelineRow
                      label={
                        <span className="flex min-w-0 items-center gap-1.5">
                          <button
                            type="button"
                            aria-expanded={expanded}
                            aria-label={`${expanded ? 'Collapse' : 'Expand'} ${epic.title}`}
                            onClick={() => toggle(epic.id)}
                            className="shrink-0 rounded p-1 hover:bg-surface-muted"
                          >
                            {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                          </button>
                          <IssueTypeIcon type="epic" />
                          <Link to={routes.issue(epic.key)} className="truncate hover:underline">
                            {epic.title}
                          </Link>
                        </span>
                      }
                    >
                      {span ? (
                        <Link
                          to={routes.issue(epic.key)}
                          style={{
                            ...barStyle(span),
                            backgroundColor: `${ISSUE_TYPE_META.epic.color}33`,
                          }}
                          title={`${epic.key} · ${percent(epic.child_done, epic.child_total)}% done`}
                          className="absolute top-1.5 h-6 overflow-hidden rounded border border-accent"
                        >
                          <span
                            style={{
                              width: `${percent(epic.child_done, epic.child_total)}%`,
                              backgroundColor: ISSUE_TYPE_META.epic.color,
                            }}
                            className="absolute inset-y-0 left-0"
                          />
                          <span className="relative truncate px-2 text-xs font-medium leading-6 text-foreground">
                            {epic.key}
                          </span>
                        </Link>
                      ) : (
                        <span className="absolute left-2 top-2 text-xs text-muted-foreground">
                          No dates — set a start or due date on the epic
                        </span>
                      )}
                    </TimelineRow>
                    {expanded &&
                      children.map((child) => {
                        const childSpan = spanOfTask(child, [])
                        return (
                          <TimelineRow
                            key={child.id}
                            indent
                            label={
                              <span className="flex min-w-0 items-center gap-1.5">
                                <IssueTypeIcon type={child.issue_type} />
                                <Link
                                  to={routes.issue(child.key)}
                                  className={cn(
                                    'truncate hover:underline',
                                    child.completed_at && 'text-muted-foreground line-through',
                                  )}
                                >
                                  {child.title}
                                </Link>
                              </span>
                            }
                          >
                            {childSpan && (
                              <Link
                                to={routes.issue(child.key)}
                                style={{
                                  ...barStyle(childSpan),
                                  backgroundColor: ISSUE_TYPE_META[child.issue_type].color,
                                  opacity: child.completed_at ? 0.5 : 1,
                                }}
                                className="absolute top-2 h-4 rounded"
                                title={child.key}
                              />
                            )}
                          </TimelineRow>
                        )
                      })}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </Card>
      <p className="mt-3 text-xs text-muted-foreground">
        The red line marks today. Expand an epic to see its issues with start and due dates.
      </p>
    </section>
  )
}

interface TimelineRowProps {
  label: React.ReactNode
  labelIcon?: null
  indent?: boolean
  children?: React.ReactNode
}

function TimelineRow({ label, indent = false, children }: TimelineRowProps) {
  return (
    <div className="flex border-b border-border last:border-b-0">
      <div
        style={{ width: LABEL_WIDTH }}
        className={cn(
          'sticky left-0 z-[6] flex shrink-0 items-center border-r border-border bg-surface px-3 py-2 text-sm',
          indent && 'pl-8',
        )}
      >
        {label}
      </div>
      <div className="relative h-9 flex-1">{children}</div>
    </div>
  )
}
