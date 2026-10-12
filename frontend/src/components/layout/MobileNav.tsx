import { Drawer } from '@/components/ui/Drawer'
import { useLayoutStore } from '@/store/layoutStore'
import { Sidebar } from './Sidebar'

export function MobileNav() {
  const open = useLayoutStore((state) => state.mobileNavOpen)
  const setOpen = useLayoutStore((state) => state.setMobileNavOpen)
  return (
    <Drawer open={open} onClose={() => setOpen(false)} title="Menu" side="left">
      <Sidebar collapsed={false} onNavigate={() => setOpen(false)} />
    </Drawer>
  )
}
