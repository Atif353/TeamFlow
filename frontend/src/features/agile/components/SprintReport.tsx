import { useState } from 'react'
import { Link } from 'react-router-dom'
import { IssueTypeIcon } from '@/components/common/IssueTypeIcon'
import { Card } from '@/components/ui/Card'
import { Select } from '@/components/ui/Select'
import { routes } from '@/config/routes'
import { useAllTasks, type Task } from '@/features/tasks'
import { formatShortDate } from '@/lib/formatters'
import { useSprints } from '../hooks/useAgile'

function IssueList({ title, tasks }: { title: string; tasks: Task[] }) {
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <h4 className="text-xs font-medium text-muted-foreground">
        {title} ({tasks.length})
      </h4>
      {tasks.length === 0 ? (
        <p className="text-sm text-muted-foreground">None</p>
      ) : (
        <ul className="flex flex-col divide-y divide-border rounded-lg border border-border">
          {tasks.map((task) => (
            <li key={task.id} className="flex items-center gap-2 px-3 py-2 text-sm">
              <IssueTypeIcon type={task.issue_type} />
              <Link to={routes.issue(task.key)} className="min-w-0 flex-1 truncate hover:underline">
                <span className="mr-2 text-muted-foreground">{task.key}</span>
                {task.title}
              </Link>
              <span className="text-xs tabular-nums text-muted-foreground">
                {task.story_points ?? '–'}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export function SprintReport({ projectId }: { projectId: string }) {
  const sprints = useSprints(projectId, ['active', 'completed'])
  const [selected, setSelected] = useState('')
  const list = sprints.data ?? []
  const current =
    list.find((sprint) => sprint.id === selected) ??
    list.find((sprint) => sprint.state === 'active') ??
    list.at(-1)
  const issues = useAllTasks(projectId, { sprint_id: current?.id }, Boolean(current))

  if (!current) return null
  const tasks = issues.data ?? []
  const done = tasks.filter((task) => task.completed_at !== null)
  const open = tasks.filter((task) => task.completed_at === null)
  const movedOut = Math.max(current.committed_issues - current.completed_issues - open.length, 0)

  return (
    <Card className="flex flex-col gap-4 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">Sprint report</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {current.start_date && current.end_date
              ? `${formatShortDate(current.start_date)} – ${formatShortDate(current.end_date)}`
              : 'Dates not set'}
            {current.state === 'completed'
              ? ` · committed ${current.committed_points} pts, completed ${current.completed_points} pts`
              : ''}
          </p>
        </div>
        <Select
          aria-label="Choose sprint for report"
          value={current.id}
          onChange={(event) => setSelected(event.target.value)}
          options={list.map((sprint) => ({ value: sprint.id, label: sprint.name }))}
          className="w-44"
        />
      </div>
      <div className="grid gap-5 md:grid-cols-2">
        <IssueList title="Completed issues" tasks={done} />
        <IssueList title="Issues not completed" tasks={open} />
      </div>
      {movedOut > 0 && (
        <p className="text-sm text-muted-foreground">
          {movedOut} unfinished {movedOut === 1 ? 'issue was' : 'issues were'} moved out when the
          sprint was completed.
        </p>
      )}
    </Card>
  )
}
