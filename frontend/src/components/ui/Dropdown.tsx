import { AnimatePresence, motion } from 'framer-motion'
import type { LucideIcon } from 'lucide-react'
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import { useClickOutside } from '@/hooks/useClickOutside'
import { cn } from '@/lib/cn'
import { popoverVariants } from '@/lib/motion'

export interface DropdownItem {
  key: string
  label: string
  icon?: LucideIcon
  onSelect: () => void
  danger?: boolean
  disabled?: boolean
}

interface DropdownProps {
  label: string
  trigger: ReactNode
  items: DropdownItem[]
  align?: 'left' | 'right'
  triggerClassName?: string
}

interface MenuPosition {
  top?: number
  bottom?: number
  left?: number
  right?: number
}

const ITEM_HEIGHT = 40

export function Dropdown({
  label,
  trigger,
  items,
  align = 'right',
  triggerClassName,
}: DropdownProps) {
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState<MenuPosition>({})
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const focusFirstRef = useRef(false)

  const close = useCallback((restoreFocus = false) => {
    setOpen(false)
    if (restoreFocus) triggerRef.current?.focus()
  }, [])

  useClickOutside([triggerRef, menuRef], () => close(), open)

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return
    const rect = triggerRef.current.getBoundingClientRect()
    const estimated = items.length * ITEM_HEIGHT + 8
    const flip = rect.bottom + estimated > window.innerHeight && rect.top > estimated
    setPosition({
      ...(flip ? { bottom: window.innerHeight - rect.top + 4 } : { top: rect.bottom + 4 }),
      ...(align === 'right' ? { right: window.innerWidth - rect.right } : { left: rect.left }),
    })
  }, [open, align, items.length])

  useEffect(() => {
    if (!open) return
    const items = menuRef.current?.querySelectorAll<HTMLElement>(
      '[role="menuitem"]:not([disabled])',
    )
    if (focusFirstRef.current) items?.[0]?.focus()
    else menuRef.current?.focus()
    focusFirstRef.current = false
    const onScroll = () => close()
    window.addEventListener('resize', onScroll)
    window.addEventListener('scroll', onScroll, true)
    return () => {
      window.removeEventListener('resize', onScroll)
      window.removeEventListener('scroll', onScroll, true)
    }
  }, [open, close])

  const onTriggerKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      focusFirstRef.current = true
      setOpen(true)
    }
  }

  const onMenuKeyDown = (event: KeyboardEvent) => {
    const nodes = Array.from(
      menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]:not([disabled])') ?? [],
    )
    const index = nodes.indexOf(document.activeElement as HTMLElement)
    const focusAt = (next: number) => nodes[(next + nodes.length) % nodes.length]?.focus()
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault()
        focusAt(index + 1)
        break
      case 'ArrowUp':
        event.preventDefault()
        focusAt(index <= 0 ? nodes.length - 1 : index - 1)
        break
      case 'Home':
        event.preventDefault()
        focusAt(0)
        break
      case 'End':
        event.preventDefault()
        focusAt(nodes.length - 1)
        break
      case 'Escape':
        event.preventDefault()
        event.stopPropagation()
        close(true)
        break
      case 'Tab':
        close()
        break
    }
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        onKeyDown={onTriggerKeyDown}
        className={cn('inline-flex items-center rounded-lg', triggerClassName)}
      >
        {trigger}
      </button>
      {createPortal(
        <AnimatePresence>
          {open && (
            <motion.div
              ref={menuRef}
              role="menu"
              aria-label={label}
              tabIndex={-1}
              variants={popoverVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              onKeyDown={onMenuKeyDown}
              style={{ position: 'fixed', ...position }}
              className="z-[60] min-w-44 rounded-xl border border-border bg-surface p-1 shadow-lift outline-none dark:shadow-none"
            >
              {items.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  role="menuitem"
                  tabIndex={-1}
                  disabled={item.disabled}
                  onClick={() => {
                    close(true)
                    item.onSelect()
                  }}
                  className={cn(
                    'flex min-h-[44px] w-full items-center gap-2 rounded-lg px-3 text-left text-sm transition-colors hover:bg-surface-muted focus-visible:bg-surface-muted disabled:opacity-50 md:min-h-[36px]',
                    item.danger ? 'text-danger-fg' : 'text-foreground',
                  )}
                >
                  {item.icon && <item.icon size={16} aria-hidden="true" />}
                  {item.label}
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </>
  )
}
