import { motion } from 'framer-motion'
import { Outlet } from 'react-router-dom'
import { ErrorBoundary } from '@/components/common/ErrorBoundary'
import { useBreakpoint } from '@/hooks/useMediaQuery'
import { sidebarTransition } from '@/lib/motion'
import { useLayoutStore } from '@/store/layoutStore'
import { MobileNav } from './MobileNav'
import { PageTransition } from './PageTransition'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'

const EXPANDED_WIDTH = 260
const COLLAPSED_WIDTH = 72

export function AppShell() {
  const { isMobile, isTablet } = useBreakpoint()
  const sidebarCollapsed = useLayoutStore((state) => state.sidebarCollapsed)
  const toggleSidebar = useLayoutStore((state) => state.toggleSidebar)
  const collapsed = isTablet || sidebarCollapsed

  return (
    <div className="flex min-h-screen bg-background">
      {isMobile ? (
        <MobileNav />
      ) : (
        <motion.aside
          initial={false}
          animate={{ width: collapsed ? COLLAPSED_WIDTH : EXPANDED_WIDTH }}
          transition={sidebarTransition}
          className="sticky top-0 hidden h-screen shrink-0 border-r border-border bg-surface md:block"
        >
          <Sidebar collapsed={collapsed} onToggleCollapse={isTablet ? undefined : toggleSidebar} />
        </motion.aside>
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar />
        <main className="mx-auto w-full max-w-page flex-1 p-4 md:p-6 lg:p-8">
          <ErrorBoundary>
            <PageTransition>
              <Outlet />
            </PageTransition>
          </ErrorBoundary>
        </main>
      </div>
    </div>
  )
}
