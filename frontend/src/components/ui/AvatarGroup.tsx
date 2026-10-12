import type { UserBrief } from '@/types/common'
import { Avatar } from './Avatar'

interface AvatarGroupProps {
  users: UserBrief[]
  total?: number
  max?: number
  size?: 'xs' | 'sm' | 'md'
}

export function AvatarGroup({ users, total, max = 4, size = 'sm' }: AvatarGroupProps) {
  const visible = users.slice(0, max)
  const hidden = Math.max((total ?? users.length) - visible.length, 0)
  return (
    <div className="flex items-center -space-x-2">
      {visible.map((user) => (
        <Avatar
          key={user.id}
          name={user.name}
          color={user.avatar_color}
          inactive={!user.is_active}
          size={size}
          className="ring-2 ring-surface"
        />
      ))}
      {hidden > 0 && (
        <span className="z-10 inline-flex h-7 min-w-7 items-center justify-center rounded-full bg-surface-muted px-1.5 text-[11px] font-medium text-muted-foreground ring-2 ring-surface">
          +{hidden}
        </span>
      )}
    </div>
  )
}
