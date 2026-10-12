import { LogOut, UserRound } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Avatar } from '@/components/ui/Avatar'
import { Dropdown } from '@/components/ui/Dropdown'
import { routes } from '@/config/routes'
import { useLogout } from '@/features/auth'
import { useAuthStore } from '@/store/authStore'

export function UserMenu() {
  const user = useAuthStore((state) => state.user)
  const navigate = useNavigate()
  const logout = useLogout()
  if (!user) return null

  return (
    <Dropdown
      label="Account menu"
      triggerClassName="gap-2 p-1 hover:bg-surface-muted"
      trigger={
        <>
          <Avatar name={user.name} color={user.avatar_color} size="sm" />
          <span className="hidden max-w-32 truncate text-sm font-medium lg:inline">
            {user.name}
          </span>
        </>
      }
      items={[
        {
          key: 'profile',
          label: 'Profile',
          icon: UserRound,
          onSelect: () => navigate(routes.profile),
        },
        {
          key: 'logout',
          label: 'Sign out',
          icon: LogOut,
          danger: true,
          onSelect: () => logout.mutate(),
        },
      ]}
    />
  )
}
