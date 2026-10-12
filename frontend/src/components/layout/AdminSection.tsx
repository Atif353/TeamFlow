import { ChevronDown, ShieldCheck } from 'lucide-react'
import { useState } from 'react'
import { useLocation } from 'react-router-dom'
import { adminNavigation } from '@/config/navigation'
import { cn } from '@/lib/cn'
import { SidebarItem } from './SidebarItem'

interface AdminSectionProps {
  collapsed: boolean
  onNavigate?: () => void
}

export function AdminSection({ collapsed, onNavigate }: AdminSectionProps) {
  const location = useLocation()
  const inAdmin = location.pathname.startsWith('/admin')
  const [opened, setOpened] = useState(false)
  const open = opened || inAdmin

  if (collapsed) {
    return (
      <div className="flex flex-col gap-1 border-t border-border pt-3">
        {adminNavigation.map((item) => (
          <SidebarItem key={item.to} item={item} collapsed onNavigate={onNavigate} />
        ))}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-0.5 border-t border-border pt-3">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpened((value) => !value)}
        className="flex min-h-[44px] items-center gap-2.5 rounded-md px-2.5 text-sm font-medium text-muted-foreground hover:bg-surface-muted/70 hover:text-foreground md:min-h-[34px]"
      >
        <ShieldCheck size={16} aria-hidden="true" />
        <span className="flex-1 text-left">Administration</span>
        <ChevronDown
          size={14}
          aria-hidden="true"
          className={cn('transition-transform', open && 'rotate-180')}
        />
      </button>
      {open && (
        <div className="ml-3 flex flex-col gap-0.5 border-l border-border pl-2">
          {adminNavigation.map((item) => (
            <SidebarItem key={item.to} item={item} collapsed={false} onNavigate={onNavigate} />
          ))}
        </div>
      )}
    </div>
  )
}
