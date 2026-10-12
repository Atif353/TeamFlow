import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'
import { useId, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useDialogBehavior } from '@/hooks/useDialogBehavior'
import { useMediaQuery, MOBILE_QUERY } from '@/hooks/useMediaQuery'
import { cn } from '@/lib/cn'
import { drawerVariants, fadeVariants } from '@/lib/motion'
import { IconButton } from './IconButton'

export interface DrawerProps {
  open: boolean
  onClose: () => void
  title: string
  side?: 'right' | 'left'
  fullOnMobile?: boolean
  headerActions?: ReactNode
  widthClassName?: string
  children: ReactNode
}

function DrawerPanel({
  onClose,
  title,
  side = 'right',
  fullOnMobile = false,
  headerActions,
  widthClassName = 'md:w-[520px]',
  children,
}: Omit<DrawerProps, 'open'>) {
  const titleId = useId()
  const isMobile = useMediaQuery(MOBILE_QUERY)
  const ref = useDialogBehavior(onClose)
  const variants =
    side === 'left'
      ? { ...drawerVariants, initial: { x: '-100%' }, exit: { x: '-100%' } }
      : drawerVariants
  return (
    <div className="fixed inset-0 z-50">
      <motion.div
        variants={fadeVariants}
        initial="initial"
        animate="animate"
        exit="exit"
        className="absolute inset-0 bg-slate-900/50"
        data-testid="drawer-backdrop"
        onClick={onClose}
      />
      <motion.aside
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        custom={isMobile && side === 'right'}
        variants={variants}
        initial="initial"
        animate="animate"
        exit="exit"
        className={cn(
          'absolute flex flex-col border-border bg-surface shadow-lift outline-none dark:shadow-none',
          side === 'left'
            ? 'inset-y-0 left-0 w-[280px] max-w-[85vw] border-r'
            : cn(
                'inset-x-0 bottom-0 rounded-t-2xl border-t md:inset-y-0 md:left-auto md:right-0 md:max-h-none md:rounded-none md:border-l md:border-t-0',
                fullOnMobile ? 'h-[100dvh] rounded-none' : 'max-h-[92dvh]',
                widthClassName,
              ),
        )}
      >
        <header className="flex items-center justify-between gap-3 border-b border-border p-4">
          <h2 id={titleId} className="truncate text-base font-semibold text-foreground">
            {title}
          </h2>
          <div className="flex items-center gap-1">
            {headerActions}
            <IconButton icon={X} label="Close panel" size="sm" onClick={onClose} />
          </div>
        </header>
        <div className="flex-1 overflow-y-auto">{children}</div>
      </motion.aside>
    </div>
  )
}

export function Drawer({ open, ...props }: DrawerProps) {
  return createPortal(
    <AnimatePresence>{open && <DrawerPanel key="drawer" {...props} />}</AnimatePresence>,
    document.body,
  )
}
