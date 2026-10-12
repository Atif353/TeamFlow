import type { Priority } from '@/types/common'

export const PRIORITY_LABELS: Record<Priority, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  urgent: 'Urgent',
}

export const PRIORITIES: Priority[] = ['low', 'medium', 'high', 'urgent']
