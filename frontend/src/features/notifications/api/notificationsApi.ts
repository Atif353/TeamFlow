import { api } from '@/lib/axios'
import type { Page } from '@/types/common'
import type { AppNotification, NotificationParams } from '../types'

export async function fetchNotifications(params: NotificationParams) {
  const { data } = await api.get<Page<AppNotification>>('/notifications', { params })
  return data
}

export async function fetchUnreadCount() {
  const { data } = await api.get<{ count: number }>('/notifications/unread-count')
  return data.count
}

export async function markNotificationRead(id: string) {
  const { data } = await api.patch<AppNotification>(`/notifications/${id}/read`)
  return data
}

export async function markAllNotificationsRead() {
  const { data } = await api.post<{ updated: number }>('/notifications/read-all')
  return data
}
