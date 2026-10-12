import { Layers, Menu } from 'lucide-react'
import { ThemeToggle } from '@/components/common/ThemeToggle'
import { IconButton } from '@/components/ui/IconButton'
import { NotificationBell } from '@/features/notifications'
import { SearchTrigger } from '@/features/search'
import { GlobalCreate } from '@/features/tasks'
import { useBreakpoint } from '@/hooks/useMediaQuery'
import { useLayoutStore } from '@/store/layoutStore'
import { UserMenu } from './UserMenu'

export function Topbar() {
  const { isMobile } = useBreakpoint()
  const setMobileNavOpen = useLayoutStore((state) => state.setMobileNavOpen)

  return (
    <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-3 border-b border-border bg-surface/90 px-4 backdrop-blur md:px-6 lg:px-8">
      {isMobile && (
        <>
          <IconButton icon={Menu} label="Open menu" onClick={() => setMobileNavOpen(true)} />
          <span className="flex items-center gap-1.5 font-semibold text-primary-text max-[420px]:hidden">
            <Layers size={16} aria-hidden="true" /> TeamFlow
          </span>
        </>
      )}
      {!isMobile && <SearchTrigger compact={false} />}
      <div className="ml-auto flex items-center gap-1">
        {isMobile && <SearchTrigger compact />}
        <GlobalCreate compact={isMobile} />
        <NotificationBell />
        <ThemeToggle />
        <UserMenu />
      </div>
    </header>
  )
}
