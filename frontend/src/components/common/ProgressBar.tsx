import { cn } from '@/lib/cn'

interface ProgressBarProps {
  value: number
  label: string
  color?: string
  className?: string
}

export function ProgressBar({ value, label, color, className }: ProgressBarProps) {
  const clamped = Math.min(Math.max(value, 0), 100)
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
      className={cn('h-1.5 w-full overflow-hidden rounded-full bg-surface-muted', className)}
    >
      <div
        className="h-full rounded-full bg-primary-600 transition-[width] duration-300"
        style={{ width: `${clamped}%`, ...(color ? { backgroundColor: color } : {}) }}
      />
    </div>
  )
}
