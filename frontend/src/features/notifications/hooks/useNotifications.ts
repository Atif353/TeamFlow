import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { errorMessage } from '@/lib/axios'
import {
  fetchNotifications,
  fetchUnreadCount,
  markAllNotificationsRead,
  markNotificationRead,
} from '../api/notificationsApi'
import type { NotificationParams } from '../types'

export const NOTIFICATION_POLL_MS = 30_000

export const notificationKeys = {
  all: ['notifications'] as const,
  list: (params: NotificationParams) => ['notifications', 'list', params] as const,
  unread: ['notifications', 'unread-count'] as const,
}

export function useUnreadCount() {
  return useQuery({
    queryKey: notificationKeys.unread,
    queryFn: fetchUnreadCount,
    refetchInterval: NOTIFICATION_POLL_MS,
  })
}

export function useNotifications(params: NotificationParams) {
  return useQuery({
    queryKey: notificationKeys.list(params),
    queryFn: () => fetchNotifications(params),
    refetchInterval: NOTIFICATION_POLL_MS,
    placeholderData: keepPreviousData,
  })
}

export function useMarkRead() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: markNotificationRead,
    onSuccess: () => client.invalidateQueries({ queryKey: notificationKeys.all }),
    onError: (error) => toast.error(errorMessage(error)),
  })
}

export function useMarkAllRead() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: markAllNotificationsRead,
    onSuccess: () => client.invalidateQueries({ queryKey: notificationKeys.all }),
    onError: (error) => toast.error(errorMessage(error)),
  })
}
