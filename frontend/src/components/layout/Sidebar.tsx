import { Layers, PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { Link } from 'react-router-dom'
import { RoleBadge } from '@/components/common/RoleBadge'
import { Avatar } from '@/components/ui/Avatar'
import { IconButton } from '@/components/ui/IconButton'
import { mainNavigation } from '@/config/navigation'
import { routes } from '@/config/routes'
import { cn } from '@/lib/cn'
import { useAuthStore } from '@/store/authStore'
import { AdminSection } from './AdminSection'
import { RecentProjects } from './RecentProjects'
import { SidebarItem } from './SidebarItem'

interface SidebarProps {
  collapsed: boolean
  onToggleCollapse?: () => void
  onNavigate?: () => void
}

export function Sidebar({ collapsed, onToggleCollapse, onNavigate }: SidebarProps) {
  const user = useAuthStore((state) => state.user)
  const role = useAuthStore((state) => state.role)

  return (
    <nav
      aria-label="Main navigation"
      data-testid="sidebar"
      data-collapsed={collapsed}
      className="flex h-full flex-col gap-5 overflow-hidden p-3"
    >
      <div
        className={cn('flex items-center', collapsed ? 'justify-center' : 'justify-between px-1')}
      >
        <Link
          to={routes.dashboard}
          onClick={onNavigate}
          className="flex items-center gap-2 text-lg font-semibold tracking-tight text-foreground"
          aria-label="TeamFlow home"
        >
          <Layers size={20} className="text-primary-text" aria-hidden="true" />
          {!collapsed && <span>TeamFlow</span>}
        </Link>
        {onToggleCollapse && !collapsed && (
          <IconButton
            icon={PanelLeftClose}
            label="Collapse sidebar"
            size="sm"
            onClick={onToggleCollapse}
          />
        )}
      </div>
      {onToggleCollapse && collapsed && (
        <IconButton
          icon={PanelLeftOpen}
          label="Expand sidebar"
          size="sm"
          className="mx-auto"
          onClick={onToggleCollapse}
        />
      )}
      <div className="flex flex-1 flex-col gap-5 overflow-y-auto">
        <div className="flex flex-col gap-0.5">
          {mainNavigation.map((item) => (
            <SidebarItem key={item.to} item={item} collapsed={collapsed} onNavigate={onNavigate} />
          ))}
        </div>
        {!collapsed && <RecentProjects onNavigate={onNavigate} />}
        {role === 'super_admin' && <AdminSection collapsed={collapsed} onNavigate={onNavigate} />}
      </div>
      {user && role && (
        <Link
          to={routes.profile}
          onClick={onNavigate}
          aria-label="Your profile"
          className={cn(
            'flex items-center gap-3 rounded-lg p-2 hover:bg-surface-muted',
            collapsed && 'justify-center border-0 p-0',
          )}
        >
          <Avatar name={user.name} color={user.avatar_color} />
          {!collapsed && (
            <span className="flex min-w-0 flex-col items-start gap-1">
              <span className="max-w-full truncate text-sm font-medium">{user.name}</span>
              <RoleBadge role={role} />
            </span>
          )}
        </Link>
      )}
    </nav>
  )
}
