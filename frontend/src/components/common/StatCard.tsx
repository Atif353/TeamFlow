import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/cn'

export type StatTone = 'primary' | 'danger' | 'success' | 'warning' | 'info'

const ALERT_VALUE: Partial<Record<StatTone, string>> = { danger: 'text-danger-fg' }

interface StatCardProps {
  label: string
  value: number | string | undefined
  icon: LucideIcon
  loading?: boolean
  tone?: StatTone
  hint?: string
}

export function StatCard({
  label,
  value,
  icon: Icon,
  loading = false,
  tone = 'primary',
  hint,
}: StatCardProps) {
  const alert = typeof value === 'number' && value > 0 ? ALERT_VALUE[tone] : undefined
  return (
    <div className="flex flex-col gap-2 bg-surface px-4 py-4 sm:px-5">
      <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Icon size={14} aria-hidden="true" />
        {label}
      </p>
      {loading ? (
        <Skeleton className="h-7 w-12" />
      ) : (
        <p className={cn('text-2xl font-semibold tabular-nums tracking-tight', alert)}>
          {value ?? 0}
        </p>
      )}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}

interface StatGroupProps {
  children: ReactNode
  className?: string
}

export function StatGroup({ children, className }: StatGroupProps) {
  return (
    <div
      className={cn(
        'grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border bg-border lg:auto-cols-fr lg:grid-flow-col',
        className,
      )}
    >
      {children}
    </div>
  )
}
