import { useNavigate } from 'react-router-dom'
import { routes } from '@/config/routes'
import type { AppNotification } from '../types'
import { useMarkRead } from './useNotifications'

export function useOpenNotification(onOpened?: () => void) {
  const navigate = useNavigate()
  const markRead = useMarkRead()
  return (notification: AppNotification) => {
    if (!notification.is_read) markRead.mutate(notification.id)
    navigate(routes.issue(notification.task_key ?? notification.task_id))
    onOpened?.()
  }
}
