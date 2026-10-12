import { motion } from 'framer-motion'
import {
  AlertCircle,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  FolderKanban,
  ListChecks,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { PriorityBadge } from '@/components/common/PriorityBadge'
import { ProgressBar } from '@/components/common/ProgressBar'
import { StatCard, StatGroup } from '@/components/common/StatCard'
import { StatusPill } from '@/components/common/StatusPill'
import { buttonVariants } from '@/components/ui/buttonVariants'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorState } from '@/components/ui/ErrorState'
import { Skeleton } from '@/components/ui/Skeleton'
import { routes } from '@/config/routes'
import { cn } from '@/lib/cn'
import { formatShortDate } from '@/lib/formatters'
import { listItemVariants } from '@/lib/motion'
import { IssueTypeIcon } from '@/components/common/IssueTypeIcon'
import { DashboardCharts } from './DashboardCharts'
import { useDashboard } from '../hooks/useDashboard'

export function MyWork() {
  const { data, isPending, isError, refetch } = useDashboard()

  return (
    <>
      {isError ? (
        <ErrorState onRetry={() => void refetch()} />
      ) : (
        <div className="flex flex-col gap-6">
          <StatGroup>
            <StatCard
              label="Assigned to me"
              value={data?.stats.assigned_open}
              icon={ListChecks}
              loading={isPending}
            />
            <StatCard
              label="Overdue"
              tone="danger"
              value={data?.stats.overdue}
              icon={AlertCircle}
              loading={isPending}
            />
            <StatCard
              label="Due this week"
              tone="warning"
              value={data?.stats.due_this_week}
              icon={CalendarClock}
              loading={isPending}
            />
            <StatCard
              label="Completed this week"
              tone="success"
              value={data?.stats.completed_this_week}
              icon={CheckCircle2}
              loading={isPending}
            />
          </StatGroup>
          <DashboardCharts charts={data?.charts} loading={isPending} />
          <div className="grid gap-6 xl:grid-cols-5">
            <Card className="xl:col-span-3">
              <CardHeader>
                <h2 className="text-base font-semibold">My tasks</h2>
              </CardHeader>
              <CardBody>
                {isPending ? (
                  <div role="status" aria-label="Loading tasks" className="flex flex-col gap-2">
                    {Array.from({ length: 4 }, (_, index) => (
                      <Skeleton key={index} className="h-14" />
                    ))}
                  </div>
                ) : data.my_tasks.length === 0 ? (
                  <EmptyState
                    icon={ClipboardList}
                    title="Nothing assigned to you"
                    description="Tasks assigned to you will appear here."
                    action={
                      <Link
                        to={routes.projects}
                        className={cn(buttonVariants({ variant: 'outline' }))}
                      >
                        Browse projects
                      </Link>
                    }
                  />
                ) : (
                  <ul className="flex flex-col divide-y divide-border">
                    {data.my_tasks.map((task, index) => (
                      <motion.li
                        key={task.id}
                        custom={index}
                        variants={listItemVariants}
                        initial="initial"
                        animate="animate"
                      >
                        <Link
                          to={routes.issue(task.key)}
                          className="flex min-h-[56px] flex-wrap items-center gap-x-3 gap-y-1 py-3 hover:bg-surface-muted/60 sm:flex-nowrap"
                        >
                          <IssueTypeIcon type={task.issue_type} />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium">{task.title}</span>
                            <span className="text-xs text-muted-foreground">{task.key}</span>
                          </span>
                          <StatusPill name={task.status_name} color={task.status_color} />
                          <PriorityBadge priority={task.priority} />
                          {task.due_date && (
                            <span
                              className={cn(
                                'text-xs',
                                task.is_overdue
                                  ? 'font-medium text-danger-fg'
                                  : 'text-muted-foreground',
                              )}
                            >
                              {task.is_overdue ? 'Overdue · ' : 'Due '}
                              {formatShortDate(task.due_date)}
                            </span>
                          )}
                        </Link>
                      </motion.li>
                    ))}
                  </ul>
                )}
              </CardBody>
            </Card>
            <Card className="xl:col-span-2">
              <CardHeader>
                <h2 className="text-base font-semibold">My projects</h2>
                <Link to={routes.projects} className="text-sm text-primary-text hover:underline">
                  View all
                </Link>
              </CardHeader>
              <CardBody>
                {isPending ? (
                  <Skeleton className="h-32" />
                ) : data.projects.length === 0 ? (
                  <EmptyState
                    icon={FolderKanban}
                    title="No projects yet"
                    description="Projects you belong to will appear here."
                  />
                ) : (
                  <ul className="flex flex-col gap-4">
                    {data.projects.map((project) => (
                      <li key={project.id}>
                        <Link
                          to={routes.board(project.id)}
                          className="flex flex-col gap-2 rounded-lg p-2 hover:bg-surface-muted/60"
                        >
                          <span className="flex items-center justify-between gap-2 text-sm font-medium">
                            <span className="truncate">{project.name}</span>
                            <span className="text-xs text-muted-foreground">
                              {project.progress_percent}%
                            </span>
                          </span>
                          <ProgressBar
                            value={project.progress_percent}
                            label={`${project.name} progress`}
                            color={project.color}
                          />
                          <span className="text-xs text-muted-foreground">
                            {project.done_tasks}/{project.total_tasks} tasks done
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </CardBody>
            </Card>
          </div>
        </div>
      )}
    </>
  )
}
