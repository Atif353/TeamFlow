import { Zap } from 'lucide-react'
import { Link } from 'react-router-dom'
import { ProgressBar } from '@/components/common/ProgressBar'
import { Card } from '@/components/ui/Card'
import { ISSUE_TYPE_META } from '@/config/issueTypes'
import { routes } from '@/config/routes'
import { percent } from '@/lib/formatters'
import type { EpicProgress } from '../types'

export function EpicProgressList({ epics }: { epics: EpicProgress[] }) {
  return (
    <Card className="flex flex-col gap-3 p-4 md:p-5">
      <h3 className="flex items-center gap-2 text-sm font-semibold">
        <Zap size={16} aria-hidden="true" /> Epic progress
      </h3>
      {epics.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Create an epic to group related stories and track their progress.
        </p>
      ) : (
        <ul className="flex flex-col gap-4">
          {epics.map((epic) => (
            <li key={epic.id} className="flex flex-col gap-1.5">
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <Link to={routes.issue(epic.key)} className="min-w-0 truncate hover:underline">
                  <span className="mr-2 text-muted-foreground">{epic.key}</span>
                  {epic.title}
                </Link>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {epic.done}/{epic.total} done
                </span>
              </div>
              <ProgressBar
                value={percent(epic.done, epic.total)}
                label={`${epic.title} progress`}
                color={ISSUE_TYPE_META.epic.color}
              />
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
