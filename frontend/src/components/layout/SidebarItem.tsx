import { NavLink } from 'react-router-dom'
import { Tooltip } from '@/components/ui/Tooltip'
import type { NavItem } from '@/config/navigation'
import { cn } from '@/lib/cn'

interface SidebarItemProps {
  item: NavItem
  collapsed: boolean
  onNavigate?: () => void
}

export function SidebarItem({ item, collapsed, onNavigate }: SidebarItemProps) {
  const link = (
    <NavLink
      to={item.to}
      end={item.end}
      onClick={onNavigate}
      aria-label={collapsed ? item.label : undefined}
      className={({ isActive }) =>
        cn(
          'flex min-h-[44px] items-center gap-2.5 rounded-md px-2.5 text-sm font-medium transition-colors md:min-h-[34px]',
          collapsed && 'justify-center px-0',
          isActive
            ? 'bg-surface-muted text-foreground'
            : 'text-muted-foreground hover:bg-surface-muted/70 hover:text-foreground',
        )
      }
    >
      <item.icon size={16} className="shrink-0" aria-hidden="true" />
      {!collapsed && <span className="truncate">{item.label}</span>}
    </NavLink>
  )
  return collapsed ? (
    <Tooltip content={item.label} side="right" className="block">
      {link}
    </Tooltip>
  ) : (
    link
  )
}
