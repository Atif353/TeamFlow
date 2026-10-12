import { AnimatePresence, motion } from 'framer-motion'
import { Bell, BellOff } from 'lucide-react'
import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { IconButton } from '@/components/ui/IconButton'
import { SkeletonList } from '@/components/ui/Skeleton'
import { routes } from '@/config/routes'
import { useClickOutside } from '@/hooks/useClickOutside'
import { popoverVariants, springTransition } from '@/lib/motion'
import { useMarkAllRead, useNotifications, useUnreadCount } from '../hooks/useNotifications'
import { useOpenNotification } from '../hooks/useOpenNotification'
import { NotificationItem } from './NotificationItem'

const PREVIEW_SIZE = 8

export function NotificationBell() {
  const [open, setOpen] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const unread = useUnreadCount()
  const list = useNotifications({ page: 1, page_size: PREVIEW_SIZE })
  const markAll = useMarkAllRead()
  const openNotification = useOpenNotification(() => setOpen(false))
  const count = unread.data ?? 0

  useClickOutside(wrapperRef, () => setOpen(false), open)

  return (
    <div
      ref={wrapperRef}
      className="relative"
      onKeyDown={(event) => event.key === 'Escape' && setOpen(false)}
    >
      <IconButton
        icon={Bell}
        label={count > 0 ? `Notifications, ${count} unread` : 'Notifications'}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((value) => !value)}
      />
      <AnimatePresence>
        {count > 0 && (
          <motion.span
            key="badge"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0 }}
            transition={springTransition}
            data-testid="unread-badge"
            className="pointer-events-none absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-danger-solid px-1 text-[11px] font-semibold text-white"
          >
            {count > 99 ? '99+' : count}
          </motion.span>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {open && (
          <motion.div
            role="dialog"
            aria-label="Notifications"
            variants={popoverVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            className="fixed inset-x-3 top-16 z-50 rounded-xl border border-border bg-surface shadow-lift dark:shadow-none sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 sm:w-96"
          >
            <div className="flex items-center justify-between border-b border-border p-3">
              <h2 className="text-sm font-semibold">Notifications</h2>
              <Button
                size="sm"
                variant="ghost"
                disabled={count === 0}
                loading={markAll.isPending}
                onClick={() => markAll.mutate()}
              >
                Mark all read
              </Button>
            </div>
            <div className="max-h-96 overflow-y-auto p-1">
              {list.isPending ? (
                <SkeletonList rows={3} className="p-2" />
              ) : list.isError ? (
                <p className="p-4 text-sm text-danger-fg">Could not load notifications.</p>
              ) : list.data.items.length === 0 ? (
                <EmptyState
                  icon={BellOff}
                  title="You're all caught up"
                  description="Task assignments will show up here."
                />
              ) : (
                <ul>
                  {list.data.items.map((notification) => (
                    <NotificationItem
                      key={notification.id}
                      notification={notification}
                      onSelect={openNotification}
                    />
                  ))}
                </ul>
              )}
            </div>
            <Link
              to={routes.notifications}
              onClick={() => setOpen(false)}
              className="block border-t border-border p-3 text-center text-sm font-medium text-primary-text hover:underline"
            >
              View all notifications
            </Link>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
