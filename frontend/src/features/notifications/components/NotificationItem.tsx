import { Avatar } from '@/components/ui/Avatar'
import { cn } from '@/lib/cn'
import { formatRelative } from '@/lib/formatters'
import type { AppNotification } from '../types'

interface NotificationItemProps {
  notification: AppNotification
  onSelect: (notification: AppNotification) => void
}

const MESSAGES: Record<AppNotification['type'], string> = {
  task_assigned: 'assigned you',
  mentioned: 'mentioned you on',
  comment_added: 'commented on',
  status_changed: 'changed the status of',
  task_overdue: 'Overdue:',
}

export function NotificationItem({ notification, onSelect }: NotificationItemProps) {
  const actor = notification.actor?.name ?? 'Someone'
  const title = notification.task_title ?? 'a task'
  return (
    <li>
      <button
        type="button"
        onClick={() => onSelect(notification)}
        className={cn(
          'flex min-h-[56px] w-full items-start gap-3 rounded-lg p-3 text-left transition-colors hover:bg-surface-muted',
          !notification.is_read && 'bg-primary-50/60',
        )}
      >
        <Avatar
          name={notification.actor?.name ?? 'Unknown'}
          color={notification.actor?.avatar_color ?? '#64748B'}
          size="sm"
        />
        <span className="min-w-0 flex-1 text-sm">
          {notification.type === 'task_overdue' ? (
            <>
              {MESSAGES.task_overdue} <span className="font-medium">{title}</span> is past its due
              date
            </>
          ) : (
            <>
              <span className="font-medium">{actor}</span> {MESSAGES[notification.type]}{' '}
              <span className="font-medium">{title}</span>
            </>
          )}
          <span className="mt-0.5 block text-xs text-muted-foreground">
            {notification.task_key ? `${notification.task_key} · ` : ''}
            {formatRelative(notification.created_at)}
          </span>
        </span>
        {!notification.is_read && (
          <span
            className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary-600"
            aria-label="Unread"
          />
        )}
      </button>
    </li>
  )
}
