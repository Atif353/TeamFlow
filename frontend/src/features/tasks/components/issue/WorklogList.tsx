import { Trash2 } from 'lucide-react'
import { Avatar } from '@/components/ui/Avatar'
import { IconButton } from '@/components/ui/IconButton'
import { SkeletonList } from '@/components/ui/Skeleton'
import { formatDuration } from '@/lib/duration'
import { formatDate } from '@/lib/formatters'
import { useWorklogActions, useWorklogs } from '../../hooks/useIssueWork'
import type { Worklog } from '../../types'

interface WorklogListProps {
  taskId: string
  projectId: string
  canManage: (worklog: Worklog) => boolean
}

export function WorklogList({ taskId, projectId, canManage }: WorklogListProps) {
  const logs = useWorklogs(taskId)
  const { remove } = useWorklogActions(projectId, taskId)
  if (logs.isPending) return <SkeletonList rows={2} />
  const entries = logs.data ?? []
  if (entries.length === 0)
    return <p className="text-sm text-muted-foreground">No work logged yet.</p>
  return (
    <ul className="flex flex-col gap-3">
      {entries.map((entry) => (
        <li key={entry.id} className="flex items-start gap-3">
          {entry.author && (
            <Avatar name={entry.author.name} color={entry.author.avatar_color} size="sm" />
          )}
          <div className="min-w-0 flex-1 text-sm">
            <p>
              <span className="font-medium">{entry.author?.name ?? 'Someone'}</span>{' '}
              <span className="text-muted-foreground">logged</span>{' '}
              <span className="font-medium">{formatDuration(entry.minutes)}</span>
            </p>
            <p className="text-xs text-muted-foreground">{formatDate(entry.started_at)}</p>
            {entry.comment && (
              <p className="mt-1 whitespace-pre-wrap break-words">{entry.comment}</p>
            )}
          </div>
          {canManage(entry) && (
            <IconButton
              icon={Trash2}
              label="Delete work log"
              size="sm"
              onClick={() => remove.mutate(entry.id)}
            />
          )}
        </li>
      ))}
    </ul>
  )
}
