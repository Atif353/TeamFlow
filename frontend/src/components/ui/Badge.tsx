import { cva, type VariantProps } from 'class-variance-authority'
import type { HTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

const badgeVariants = cva(
  'inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium',
  {
    variants: {
      tone: {
        neutral: 'bg-surface-muted text-muted-foreground',
        primary: 'bg-primary-100 text-primary-text',
        accent: 'bg-accent/15 text-accent-fg',
        success: 'bg-success/15 text-success-fg',
        warning: 'bg-warning/15 text-warning-fg',
        danger: 'bg-danger/15 text-danger-fg',
        info: 'bg-info/15 text-info-fg',
      },
    },
    defaultVariants: { tone: 'neutral' },
  },
)

interface BadgeProps extends HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ tone, className, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />
}
