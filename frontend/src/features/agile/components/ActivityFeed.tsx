import { Link } from 'react-router-dom'
import { Avatar } from '@/components/ui/Avatar'
import { Card } from '@/components/ui/Card'
import { routes } from '@/config/routes'
import { formatRelative } from '@/lib/formatters'
import type { ActivityRow } from '../types'

function verb(row: ActivityRow): string {
  if (row.action === 'created') return 'created'
  if (row.action === 'commented') return 'commented on'
  if (row.action === 'worklog') return 'logged work on'
  if (row.action === 'attachment') return 'changed attachments on'
  if (row.action === 'link') return 'linked'
  if (row.field && row.new_value) return `changed ${row.field} to “${row.new_value}” on`
  return `updated ${row.field ?? ''} on`
}

export function ActivityFeed({ rows }: { rows: ActivityRow[] }) {
  return (
    <Card className="flex flex-col gap-3 p-4 md:p-5">
      <h3 className="text-sm font-semibold">Recent activity</h3>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">Activity will appear here.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {rows.map((row, index) => (
            <li key={`${row.task_id}-${row.created_at}-${index}`} className="flex gap-3">
              {row.actor && (
                <Avatar name={row.actor.name} color={row.actor.avatar_color} size="sm" />
              )}
              <div className="min-w-0 text-sm">
                <p>
                  <span className="font-medium">{row.actor?.name ?? 'Someone'}</span>{' '}
                  <span className="text-muted-foreground">{verb(row)}</span>{' '}
                  <Link to={routes.issue(row.task_key)} className="font-medium hover:underline">
                    {row.task_key}
                  </Link>
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {row.task_title} · {formatRelative(row.created_at)}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
