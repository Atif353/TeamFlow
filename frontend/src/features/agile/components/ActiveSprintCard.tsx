import { Rocket } from 'lucide-react'
import { Link } from 'react-router-dom'
import { ProgressBar } from '@/components/common/ProgressBar'
import { Card } from '@/components/ui/Card'
import { routes } from '@/config/routes'
import { formatShortDate, percent } from '@/lib/formatters'
import type { Sprint } from '../types'

interface ActiveSprintCardProps {
  projectId: string
  sprint: Sprint
  daysRemaining: number | null
}

export function ActiveSprintCard({ projectId, sprint, daysRemaining }: ActiveSprintCardProps) {
  const share = percent(sprint.done_count, sprint.issue_count)
  return (
    <Card className="flex flex-col gap-3 p-4 md:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <Rocket size={16} aria-hidden="true" /> {sprint.name}
          </h3>
          {sprint.goal && <p className="mt-1 text-xs text-muted-foreground">{sprint.goal}</p>}
        </div>
        <Link
          to={routes.board(projectId)}
          className="text-xs font-medium text-primary-text hover:underline"
        >
          Open board
        </Link>
      </div>
      <ProgressBar value={share} label="Sprint progress" />
      <dl className="grid grid-cols-3 gap-3 text-center">
        <div>
          <dd className="text-lg font-semibold">
            {sprint.done_count}/{sprint.issue_count}
          </dd>
          <dt className="text-xs text-muted-foreground">Issues done</dt>
        </div>
        <div>
          <dd className="text-lg font-semibold">
            {sprint.done_points}/{sprint.story_points}
          </dd>
          <dt className="text-xs text-muted-foreground">Points done</dt>
        </div>
        <div>
          <dd className="text-lg font-semibold">{daysRemaining ?? '—'}</dd>
          <dt className="text-xs text-muted-foreground">Days left</dt>
        </div>
      </dl>
      {sprint.start_date && sprint.end_date && (
        <p className="text-xs text-muted-foreground">
          {formatShortDate(sprint.start_date)} – {formatShortDate(sprint.end_date)}
        </p>
      )}
    </Card>
  )
}
