import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/cn'

interface SpinnerProps {
  size?: number
  className?: string
  label?: string
}

export function Spinner({ size = 18, className, label = 'Loading' }: SpinnerProps) {
  return (
    <span role="status" aria-label={label} className="inline-flex">
      <Loader2 size={size} className={cn('animate-spin', className)} aria-hidden="true" />
    </span>
  )
}
