import type { UserBrief } from '@/types/common'

export interface AppNotification {
  id: string
  type: 'task_assigned' | 'mentioned' | 'comment_added' | 'status_changed' | 'task_overdue'
  task_id: string
  task_title: string | null
  task_key: string | null
  project_id: string
  project_name: string | null
  project_key: string | null
  actor: UserBrief | null
  is_read: boolean
  created_at: string
}

export interface NotificationParams {
  page?: number
  page_size?: number
  unread_only?: boolean
}
