import { Flag } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import type { Priority } from '@/types/common'
import { PRIORITY_LABELS } from './priorities'

const TONES = { low: 'neutral', medium: 'info', high: 'warning', urgent: 'danger' } as const

export function PriorityBadge({ priority }: { priority: Priority }) {
  return (
    <Badge tone={TONES[priority]}>
      <Flag size={12} aria-hidden="true" />
      {PRIORITY_LABELS[priority]}
    </Badge>
  )
}
