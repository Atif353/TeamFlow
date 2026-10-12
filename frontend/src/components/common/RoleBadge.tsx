import { Badge } from '@/components/ui/Badge'
import { ROLE_LABELS } from '@/config/roles'
import type { Role } from '@/types/common'

const TONES = {
  super_admin: 'accent',
  project_manager: 'primary',
  member: 'success',
  viewer: 'neutral',
} as const

export function RoleBadge({ role }: { role: Role }) {
  return <Badge tone={TONES[role]}>{ROLE_LABELS[role]}</Badge>
}
