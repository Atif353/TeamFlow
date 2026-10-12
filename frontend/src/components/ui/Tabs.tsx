import type { LucideIcon } from 'lucide-react'
import { useRef, type KeyboardEvent, type ReactNode } from 'react'
import { cn } from '@/lib/cn'

export interface TabItem {
  value: string
  label: string
  icon?: LucideIcon
  badge?: ReactNode
}

interface TabsProps {
  items: TabItem[]
  value: string
  onChange: (value: string) => void
  ariaLabel: string
  className?: string
}

export function Tabs({ items, value, onChange, ariaLabel, className }: TabsProps) {
  const refs = useRef<Record<string, HTMLButtonElement | null>>({})

  const activate = (index: number) => {
    const target = items[(index + items.length) % items.length]
    if (!target) return
    onChange(target.value)
    refs.current[target.value]?.focus()
  }

  const onKeyDown = (event: KeyboardEvent, index: number) => {
    if (event.key === 'ArrowRight') {
      event.preventDefault()
      activate(index + 1)
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault()
      activate(index - 1)
    } else if (event.key === 'Home') {
      event.preventDefault()
      activate(0)
    } else if (event.key === 'End') {
      event.preventDefault()
      activate(items.length - 1)
    }
  }

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn('flex gap-1 overflow-x-auto border-b border-border', className)}
    >
      {items.map((item, index) => {
        const selected = item.value === value
        return (
          <button
            key={item.value}
            ref={(node) => {
              refs.current[item.value] = node
            }}
            type="button"
            role="tab"
            id={`tab-${item.value}`}
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(item.value)}
            onKeyDown={(event) => onKeyDown(event, index)}
            className={cn(
              '-mb-px flex min-h-[44px] items-center gap-2 whitespace-nowrap border-b-2 px-3 text-sm font-medium transition-colors md:min-h-[40px]',
              selected
                ? 'border-primary-600 text-primary-text'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {item.icon && <item.icon size={16} aria-hidden="true" />}
            {item.label}
            {item.badge}
          </button>
        )
      })}
    </div>
  )
}
