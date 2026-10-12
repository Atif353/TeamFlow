import { Avatar } from '@/components/ui/Avatar'
import { SkeletonList } from '@/components/ui/Skeleton'
import { formatRelative } from '@/lib/formatters'
import { useActivity } from '../../hooks/useTasks'
import type { ActivityEntry } from '../../types'

function describe(entry: ActivityEntry): string {
  if (entry.action === 'created') return 'created this issue'
  if (entry.action === 'commented') return 'added a comment'
  if (entry.action === 'worklog') return `logged ${entry.new_value ?? 'work'}`
  if (entry.action === 'attachment')
    return entry.new_value ? `attached ${entry.new_value}` : `removed attachment ${entry.old_value}`
  if (entry.action === 'link') return `linked this issue: ${entry.new_value}`
  if (entry.field === 'description') return 'updated the description'
  if (entry.old_value && entry.new_value)
    return `changed ${entry.field} from “${entry.old_value}” to “${entry.new_value}”`
  if (entry.new_value) return `set ${entry.field} to “${entry.new_value}”`
  return `cleared ${entry.field} (was “${entry.old_value ?? ''}”)`
}

export function HistoryList({ taskId }: { taskId: string }) {
  const activity = useActivity(taskId)
  if (activity.isPending) return <SkeletonList rows={3} />
  const entries = activity.data ?? []
  if (entries.length === 0) return <p className="text-sm text-muted-foreground">No history yet.</p>
  return (
    <ul className="flex flex-col gap-3">
      {entries.map((entry) => (
        <li key={entry.id} className="flex items-start gap-3">
          {entry.actor && (
            <Avatar name={entry.actor.name} color={entry.actor.avatar_color} size="sm" />
          )}
          <div className="min-w-0 text-sm">
            <p>
              <span className="font-medium">{entry.actor?.name ?? 'Someone'}</span>{' '}
              <span className="text-muted-foreground">{describe(entry)}</span>
            </p>
            <p className="text-xs text-muted-foreground">{formatRelative(entry.created_at)}</p>
          </div>
        </li>
      ))}
    </ul>
  )
}
